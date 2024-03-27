import {
  Inject,
  Injectable,
  Logger,
  LoggerService,
  OnApplicationBootstrap,
  OnApplicationShutdown,
} from '@nestjs/common';
import { MODULE_OPTIONS_TOKEN } from './syrnykmq.module-definition';
import { Binding, SyrnykmqModuleOptions } from './syrnykmq.module-options';
import { AmqpConnectionManager, ChannelWrapper, connect } from 'amqp-connection-manager';
import { Channel, ConsumeMessage } from 'amqplib';
import { Subject } from 'rxjs';
import { SyrnykmqHandlersExplorer, HandlerWrapper } from './handlers.explorer';

export const DEFAULT_RECONNECT_TIME = 5;
export const DEFAULT_HEARTBEAT_TIME = 5;

export type ReplyMessage = {
  correlationId: string;
  message: Record<string, unknown>;
};

@Injectable()
export class SyrnykmqService implements OnApplicationBootstrap, OnApplicationShutdown {
  private manager!: AmqpConnectionManager;
  private channel!: ChannelWrapper;
  private defaultExchange?: string;
  private defaultQueue?: string;
  private readonly directReplyMessage$ = new Subject<ReplyMessage>();
  private readonly logger: LoggerService;

  constructor(
    @Inject(MODULE_OPTIONS_TOKEN) private options: SyrnykmqModuleOptions,
    private readonly handlersExplorer: SyrnykmqHandlersExplorer,
  ) {
    this.logger = this.options.logger || new Logger(SyrnykmqService.name);
  }

  public async onApplicationBootstrap(): Promise<void> {
    await this.setup();
  }

  public async onApplicationShutdown(signal?: string): Promise<void> {
    await this.manager.close();
  }

  private async setup(): Promise<void> {
    return new Promise((resolveSetup, rejectSetup) => {
      this.manager = connect(this.options.urls, {
        reconnectTimeInSeconds: this.options.reconnectTimeInSeconds || DEFAULT_RECONNECT_TIME,
        heartbeatIntervalInSeconds: this.options.heartbeatIntervalInSeconds || DEFAULT_HEARTBEAT_TIME,
        connectionOptions: this.options.connectionOptions || {},
      });
      this.manager.on('connect', () => {
        this.logger.log('Successfully connected to AMQP broker');
        this.channel = this.manager.createChannel({
          json: false,
          setup: async (channel: Channel) => {
            await this.setupExchanges(channel);
            await this.setupQueues(channel);
            await this.setupHandlers(channel);
            resolveSetup();
          },
        });
      });
      this.manager.on('connectFailed', err => {
        //! throw custom error
        this.logger.error('Failed to connect to RabbitMQ broker', err.err);
        rejectSetup();
      });
      this.manager.on('disconnect', () => {
        this.logger.warn('Disconnected from AMQP broker');
      });
    });
  }

  private async setupExchanges(channel: Channel): Promise<void> {
    this.options.exchanges = this.options.exchanges || [];
    await Promise.all(
      this.options.exchanges.map(async exchange => {
        await channel.assertExchange(exchange.name, exchange.type);
        this.logger.log(`Asserted exchange: ${exchange.name} (${exchange.type})`);
        if (exchange.default) this.defaultExchange = exchange.name;
        exchange.bindings = exchange.bindings || [];
        await Promise.all(exchange.bindings.map(binding => this.bindExchange(exchange.name, binding, channel)));
      }),
    );
    if (!this.defaultExchange) {
      this.defaultExchange = this.options.exchanges[0].name;
      this.logger.warn(`Implicitly set the default exchange: ${this.defaultExchange}`);
    }
  }

  private async bindExchange(exchange: string, binding: Binding, channel: Channel): Promise<void> {
    await Promise.all(
      binding.patterns.map(async pattern => {
        await channel.bindExchange(exchange, binding.exchange, pattern, binding.args);
        this.logger.log(`Bound exchange: ${exchange} -> ${binding.exchange} (${pattern})`);
      }),
    );
  }

  private async setupQueues(channel: Channel): Promise<void> {
    if (!this.options.queues || !this.options.queues.length) {
      // this.notConsumer = true;
      // this.logger.warn('Since no queue has been asserted, it is only possible to send messages');
      return;
    }
    await Promise.all(
      this.options.queues.map(async queue => {
        if (typeof queue === 'string') {
          await channel.assertQueue(queue);
          return;
        }
        await channel.assertQueue(queue.name, queue);
        this.logger.log(`Asserted queue: ${queue.name}`);
        if (queue.default) this.defaultQueue = queue.name;
        queue.bindings = queue.bindings || [];
        await Promise.all(queue.bindings.map(binding => this.bindQueue(queue.name, binding, channel)));
      }),
    );
    if (!this.defaultQueue) {
      this.defaultQueue =
        typeof this.options.queues[0] === 'string' ? this.options.queues[0] : this.options.queues[0].name;
      this.logger.warn(`Implicitly set the default queue: ${this.defaultQueue}`);
    }
  }

  private async bindQueue(queue: string, binding: Binding, channel: Channel): Promise<void> {
    await Promise.all(
      binding.patterns.map(async pattern => {
        await channel.bindQueue(queue, binding.exchange, pattern, binding.args);
        this.logger.log(`Bound queue: ${queue} -> ${binding.exchange} (${pattern})`);
      }),
    );
  }

  private async setupHandlers(channel: Channel): Promise<void> {
    const handlerWrappers = this.handlersExplorer.exploreHandlers().map(wrapper => ({
      ...wrapper,
      queue: wrapper.queue || (this.defaultQueue as string),
      exchange: wrapper.exchange || (this.defaultExchange as string),
    }));
    await Promise.all(
      handlerWrappers.map(wrapper =>
        this.bindQueue(wrapper.queue, { exchange: wrapper.exchange, patterns: [wrapper.pattern] }, channel),
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
    const wrapper = handlerWrappers.find(wrapper => wrapper.pattern === message.fields.routingKey);
    if (!wrapper) return;

    await wrapper.handler(JSON.parse(message.content.toString()), message);
    channel.ack(message);
  }
}
