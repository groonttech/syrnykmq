import { Injectable } from '@nestjs/common';
import { DiscoveryService, ExternalContextCreator, MetadataScanner, Reflector } from '@nestjs/core';
import { InstanceWrapper } from '@nestjs/core/injector/instance-wrapper';
import { SYRNYKMQ_HANDLERS_GROUP, SYRNYKMQ_HANDLER, HandlersGroupMeta, HandlerMeta, HandlerType } from './decorators';
import { ROUTE_ARGS_METADATA } from '@nestjs/common/constants';
import { SyrnykmqParamsFactory } from './params.factory';

export type HandlerWrapper = {
  instance: object;
  handler: (...args: unknown[]) => unknown;
  type: HandlerType;
  pattern: string;
  queue?: string;
  exchange?: string;
};

@Injectable()
export class SyrnykmqHandlersExplorer {
  constructor(
    private readonly discoveryService: DiscoveryService,
    private readonly metadataScanner: MetadataScanner,
    private readonly externalContextCreator: ExternalContextCreator,
    private readonly reflector: Reflector,
  ) {}

  public exploreHandlers(): HandlerWrapper[] {
    const providerWrappers = this.discoveryService.getProviders();
    const handlerWrappers = providerWrappers
      .filter(wrapper => wrapper.metatype && this.reflector.get(SYRNYKMQ_HANDLERS_GROUP, wrapper.metatype))
      .filter(wrapper => wrapper.instance && Object.getPrototypeOf(wrapper.instance))
      .map(wrapper => this.exploreHandlersGroup(wrapper))
      .reduce((acc, wrappers) => acc.concat(wrappers), []);
    return handlerWrappers;
  }

  private exploreHandlersGroup(wrapper: InstanceWrapper): HandlerWrapper[] {
    const groupMeta = this.reflector.get<HandlersGroupMeta>(SYRNYKMQ_HANDLERS_GROUP, wrapper.metatype);
    const handlerWrappers = this.metadataScanner
      .getAllMethodNames(Object.getPrototypeOf(wrapper.instance))
      .filter(methodKey => this.reflector.get<HandlerMeta>(SYRNYKMQ_HANDLER, wrapper.instance[methodKey]))
      .map(methodKey => this.exploreHandler(methodKey, wrapper, groupMeta))
      .reduce((acc, wrappers) => acc.concat(wrappers), []);
    return handlerWrappers;
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
      undefined, // contextId
      undefined, // inquirerId
      undefined, // options
      'amqp', // contextType
    );
    const handlerMeta = this.reflector.get<HandlerMeta>(SYRNYKMQ_HANDLER, consumerWrapper.instance[methodKey]);
    const handlerWrapper = handlerMeta.patterns.map<HandlerWrapper>(pattern => ({
      instance: consumerWrapper.instance,
      pattern,
      handler,
      type: handlerMeta.type,
      queue: handlerMeta.queue || groupMeta.queue,
      exchange: handlerMeta.exchange || groupMeta.exchange,
    }));
    return handlerWrapper;
  }
}
