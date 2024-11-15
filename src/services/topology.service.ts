import { Inject, Injectable, Logger, LoggerService } from '@nestjs/common';
import { MODULE_OPTIONS_TOKEN } from '../syrnykmq.module-definition';
import { Binding, Exchange, Queue, SyrnykmqModuleOptions } from '../syrnykmq.module-options';
import { Channel } from 'amqplib';
import { NotSetDefaultExchangeException, NotSetDefaultQueueException } from './exceptions';

@Injectable()
export class SyrnykmqTopologyService {
  private _defaultExchange?: string;
  private _defaultQueue?: string;
  private readonly logger: LoggerService;

  constructor(@Inject(MODULE_OPTIONS_TOKEN) private options: SyrnykmqModuleOptions) {
    this.logger = this.options.logger || new Logger(SyrnykmqTopologyService.name);
  }

  public get defaultExchange(): string {
    if (!this._defaultExchange) throw new NotSetDefaultExchangeException();
    return this._defaultExchange;
  }

  public get defaultQueue(): string {
    if (!this._defaultQueue) throw new NotSetDefaultQueueException();
    return this._defaultQueue;
  }

  public async setupExchanges(channel: Channel): Promise<void> {
    this.options.exchanges = this.options.exchanges || [];

    await Promise.all(this.options.exchanges.map(exchange => this.assertExchange(exchange, channel)));
    if (!this._defaultExchange) {
      this._defaultExchange = this.options.exchanges[0].name;
      this.logger.warn(`Implicitly set the default exchange: ${this._defaultExchange}`);
    }
  }

  public async setupQueues(channel: Channel): Promise<void> {
    if (!this.options.queues || !this.options.queues.length) {
      // this.notConsumer = true;
      // this.logger.warn('Since no queue has been asserted, it is only possible to send messages');
      return;
    }

    await Promise.all(this.options.queues.map(queue => this.assertQueue(queue, channel)));
    if (!this._defaultQueue) {
      this._defaultQueue =
        typeof this.options.queues[0] === 'string' ? this.options.queues[0] : this.options.queues[0].name;
      this.logger.warn(`Implicitly set the default queue: ${this._defaultQueue}`);
    }
  }

  public async assertExchange(exchange: Exchange, channel: Channel): Promise<void> {
    await channel.assertExchange(exchange.name, exchange.type);
    this.logger.log(`Asserted exchange: ${exchange.name} (${exchange.type})`);
    if (exchange.default) this._defaultExchange = exchange.name;
    exchange.bindings = exchange.bindings || [];

    await Promise.all(exchange.bindings.map(binding => this.bindExchange(exchange.name, binding, channel)));
  }

  public async assertQueue(queue: Queue | string, channel: Channel): Promise<void> {
    if (typeof queue === 'string') {
      await channel.assertQueue(queue);
      return;
    }

    await channel.assertQueue(queue.name, queue);
    this.logger.log(`Asserted queue: ${queue.name}`);
    if (queue.default) this._defaultQueue = queue.name;
    queue.bindings = queue.bindings || [];

    await Promise.all(queue.bindings.map(binding => this.bindQueue(queue.name, binding, channel)));
  }

  public async bindExchange(exchange: string, binding: Binding, channel: Channel): Promise<void> {
    await Promise.all(
      binding.patterns.map(async pattern => {
        await channel.bindExchange(exchange, binding.exchange, pattern, binding.args);
        this.logger.log(`Bound exchange: ${exchange} -> ${binding.exchange} (${pattern})`);
      }),
    );
  }

  public async bindQueue(queue: string, binding: Binding, channel: Channel): Promise<void> {
    await Promise.all(
      binding.patterns.map(async pattern => {
        await channel.bindQueue(queue, binding.exchange, pattern, binding.args);
        this.logger.log(`Bound queue: ${queue} -> ${binding.exchange} (${pattern})`);
      }),
    );
  }
}
