import { Inject, Injectable, Logger, LoggerService } from '@nestjs/common';
import { MODULE_OPTIONS_TOKEN } from '../syrnykmq.module-definition';
import { SyrnykmqModuleOptions } from '../syrnykmq.module-options';
import { Channel, ConsumeMessage } from 'amqplib';
import { SyrnykmqTopologyService } from './topology.service';
import { DiscoveryService, ExternalContextCreator, MetadataScanner, Reflector } from '@nestjs/core';
import { HandlerMeta, HandlersGroupMeta, HandlerType, SYRNYKMQ_HANDLER, SYRNYKMQ_HANDLERS_GROUP } from '../decorators';
import { InstanceWrapper } from '@nestjs/core/injector/instance-wrapper';
import { ROUTE_ARGS_METADATA } from '@nestjs/common/constants';
import { SyrnykmqParamsFactory } from '../params.factory';
import { defaultDeserializer, defaultSerializer } from '../serial';
import { Observable, Subject } from 'rxjs';

export type HandlerWrapper = {
  instance: object;
  handler: (...args: unknown[]) => Record<string, unknown> | Promise<Record<string, unknown>>;
  type: HandlerType;
  pattern: string;
  queue?: string;
  exchange?: string;
};

export type AckControl = () => void;
export type NackControl = (requeue?: boolean) => void;

export type HandlerControls = {
  readonly ack: AckControl;
  readonly nack: NackControl;
};

export type ReplyMessage = {
  correlationId: string;
  content: Record<string, unknown>;
  error?: string;
};

@Injectable()
export class SyrnykmqConsumerService {
  private readonly _replyMessage$ = new Subject<ReplyMessage>();
  private readonly logger: LoggerService;

  constructor(
    @Inject(MODULE_OPTIONS_TOKEN) private options: SyrnykmqModuleOptions,
    private readonly topologyService: SyrnykmqTopologyService,
    private readonly discoveryService: DiscoveryService,
    private readonly metadataScanner: MetadataScanner,
    private readonly externalContextCreator: ExternalContextCreator,
    private readonly reflector: Reflector,
  ) {
    this.logger = this.options.logger || new Logger(SyrnykmqConsumerService.name);
  }

  public get replyMessage$(): Observable<ReplyMessage> {
    return this._replyMessage$.asObservable();
  }

  public async setupReplyMessageHandler(channel: Channel): Promise<void> {
    await channel.consume(
      'amq.rabbitmq.reply-to',
      message => {
        if (!message) return;
        const content = this.options.deserializer
          ? this.options.deserializer(message.content)
          : defaultDeserializer(message.content);
        this._replyMessage$.next({
          correlationId: message.properties.correlationId,
          content,
          error: message.properties.headers?.['x-error'] || undefined,
        });
      },
      { noAck: true },
    );
  }

  public async setupHandlers(channel: Channel): Promise<void> {
    const handlerWrappers = this.exploreHandlers().map(wrapper => ({
      ...wrapper,
      queue: wrapper.queue || this.topologyService.defaultQueue,
      exchange: wrapper.exchange || this.topologyService.defaultExchange,
    }));
    await Promise.all(
      handlerWrappers.map(wrapper =>
        this.topologyService.bindQueue(
          wrapper.queue,
          { exchange: wrapper.exchange, patterns: [wrapper.pattern] },
          channel,
        ),
      ),
    );
    const queuesToConsume = [...new Set(handlerWrappers.map(wrapper => wrapper.queue))];
    await Promise.all(
      queuesToConsume.map(async queue => {
        await channel.consume(queue, message => message && this.handleMessage(message, channel, handlerWrappers));
      }),
    );
  }

  private async handleMessage(
    message: ConsumeMessage,
    channel: Channel,
    handlerWrappers: HandlerWrapper[],
  ): Promise<void> {
    const wrapper = handlerWrappers.find(wrapper => {
      const regexPattern = new RegExp(
        `^${wrapper.pattern
            .replace(/\./g, '\\.')
            .replace(/\*/g, '[^.]+')
            .replace(/#/g, '.*')
        }$`
      );
      return regexPattern.test(message.fields.routingKey);
    });
    if (!wrapper) return;
    const controls: HandlerControls = {
      ack: () => channel.ack(message),
      nack: (requeue?: boolean) => channel.nack(message, undefined, requeue),
      // TODO: Add response headers control
    };
    const content = this.options.deserializer
      ? this.options.deserializer(message.content)
      : defaultDeserializer(message.content);
    const response = await wrapper.handler(content, message, controls);
    if (wrapper.type !== 'event' && message.properties.replyTo) {
      const { replyTo, correlationId } = message.properties;
      const serializedResponse = this.options.serializer
        ? this.options.serializer(response)
        : defaultSerializer(response);
      channel.publish('', replyTo, serializedResponse, {
        correlationId,
        persistent: false,
      });
    }
    if (this.options.autoAck || this.options.autoAck === undefined) channel.ack(message);
  }

  private exploreHandlers(): HandlerWrapper[] {
    const providerWrappers = this.discoveryService.getProviders();
    return providerWrappers
      .filter(wrapper => wrapper.metatype && this.reflector.get(SYRNYKMQ_HANDLERS_GROUP, wrapper.metatype))
      .filter(wrapper => wrapper.instance && Object.getPrototypeOf(wrapper.instance))
      .map(wrapper => this.exploreHandlersGroup(wrapper))
      .reduce((acc, wrappers) => acc.concat(wrappers), []);
  }

  private exploreHandlersGroup(wrapper: InstanceWrapper): HandlerWrapper[] {
    const groupMeta = this.reflector.get<HandlersGroupMeta>(SYRNYKMQ_HANDLERS_GROUP, wrapper.metatype);
    return this.metadataScanner
      .getAllMethodNames(Object.getPrototypeOf(wrapper.instance))
      .filter(methodKey => this.reflector.get<HandlerMeta>(SYRNYKMQ_HANDLER, wrapper.instance[methodKey]))
      .map(methodKey => this.exploreHandler(methodKey, wrapper, groupMeta))
      .reduce((acc, wrappers) => acc.concat(wrappers), []);
  }

  private exploreHandler(
    methodKey: string,
    consumerWrapper: InstanceWrapper,
    groupMeta: HandlersGroupMeta,
  ): HandlerWrapper[] {
    const handler = this.externalContextCreator.create(
      consumerWrapper.instance,
      consumerWrapper.instance[methodKey],
      methodKey,
      ROUTE_ARGS_METADATA,
      new SyrnykmqParamsFactory(),
      undefined,
      undefined,
      undefined,
      'amqp',
    );
    const handlerMeta = this.reflector.get<HandlerMeta>(SYRNYKMQ_HANDLER, consumerWrapper.instance[methodKey]);
    return handlerMeta.patterns.map<HandlerWrapper>(pattern => ({
      instance: consumerWrapper.instance,
      pattern,
      handler,
      type: handlerMeta.type,
      queue: handlerMeta.queue || groupMeta.queue,
      exchange: handlerMeta.exchange || groupMeta.exchange,
    }));
  }
}
