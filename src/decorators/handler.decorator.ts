import { SetMetadata } from '@nestjs/common';

export type HandlerType = 'event' | 'command' | 'query';

export type HandlerMeta = {
  type: HandlerType;
  queue?: string;
  exchange?: string;
  patterns: string[];
};

export type HandlerOptions = Pick<HandlerMeta, 'queue' | 'exchange'>;

export const SYRNYKMQ_HANDLER = Symbol('SYRNYKMQ_HANDLER');

export const createHandlerDecorator = (type: HandlerType, patterns: string[] | string, options?: HandlerOptions) =>
  SetMetadata<symbol, HandlerMeta>(SYRNYKMQ_HANDLER, {
    type,
    queue: options?.queue,
    exchange: options?.exchange,
    patterns: typeof patterns === 'string' ? [patterns] : patterns,
  });

export const EventHandler = (patterns: string[] | string, options?: HandlerOptions) =>
  createHandlerDecorator('event', patterns, options);

export const CommandHandler = (patterns: string[] | string, options?: HandlerOptions) =>
  createHandlerDecorator('command', patterns, options);

export const QueryHandler = (patterns: string[] | string, options?: HandlerOptions) =>
  createHandlerDecorator('query', patterns, options);
