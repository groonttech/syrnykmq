import { Inject, Injectable } from '@nestjs/common';
import { MODULE_OPTIONS_TOKEN } from '../syrnykmq.module-definition';
import { SyrnykmqModuleOptions } from '../syrnykmq.module-options';
import { SyrnykmqManagerService } from './manager.service';
import { PublishOptions } from 'amqp-connection-manager/dist/types/ChannelWrapper';
import { defaultSerializer } from '../serial';
import { first, interval, lastValueFrom, map, race } from 'rxjs';
import { randomUUID } from 'crypto';
import { SyrnykmqConsumerService } from './consumer.service';
import { FailedReceiveResponseException, FailedResponseException } from './exceptions';

export const requestReplyTimeout = 5000;

@Injectable()
export class SyrnykmqProducerService {
  constructor(
    @Inject(MODULE_OPTIONS_TOKEN) private options: SyrnykmqModuleOptions,
    private readonly managerService: SyrnykmqManagerService,
    private readonly consumerService: SyrnykmqConsumerService,
  ) {}

  public async publish<TContent extends Record<string, unknown>>(
    exchange: string,
    routingKey: string,
    content: TContent,
    options?: PublishOptions,
  ): Promise<void> {
    const serializedContent = this.options.serializer ? this.options.serializer(content) : defaultSerializer(content);
    await this.managerService.channel.publish(exchange, routingKey, serializedContent, options);
  }

  public async request<TResponse extends Record<string, unknown>, TContent extends Record<string, unknown>>(
    exchange: string,
    routingKey: string,
    content: TContent,
    options?: PublishOptions,
  ): Promise<TResponse> {
    const correlationId = randomUUID();
    const response$ = this.consumerService.replyMessage$.pipe(
      first(response => response.correlationId === correlationId),
      map(response => {
        if (response.error) throw new FailedResponseException(response.error);
        return response.content as TResponse;
      }),
    );
    const timeout$ = interval(requestReplyTimeout).pipe(
      first(),
      map(() => {
        throw new FailedReceiveResponseException();
      }),
    );
    const response = lastValueFrom(race(response$, timeout$));
    const serializedContent = this.options.serializer ? this.options.serializer(content) : defaultSerializer(content);
    await this.managerService.channel.publish(exchange, routingKey, serializedContent, {
      replyTo: 'amq.rabbitmq.reply-to',
      correlationId,
      headers: options?.headers,
      expiration: options?.expiration,
    });
    return response;
  }
}
