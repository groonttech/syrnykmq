import { LoggerService } from '@nestjs/common';
import { AmqpConnectionOptions } from 'amqp-connection-manager/dist/types/AmqpConnectionManager';
import * as amqplib from 'amqplib';

export type Binding = {
  exchange: string;
  patterns: string[];
  args?: any;
};

export type Exchange = amqplib.Options.AssertExchange & {
  name: string;
  default?: boolean;
  type: 'direct' | 'topic' | 'headers' | 'fanout' | 'match';
  bindings?: Binding[];
};

export type Queue = amqplib.Options.AssertQueue & {
  name: string;
  default?: boolean;
  bindings?: Binding[];
};

export type SyrnykmqModuleOptions = {
  urls: string[];
  reconnectTimeInSeconds?: number;
  heartbeatIntervalInSeconds?: number;
  connectionOptions?: AmqpConnectionOptions;
  logger?: LoggerService;
  exchanges?: Exchange[];
  queues?: (Queue | string)[];
  resolveTopics?: boolean;
};
