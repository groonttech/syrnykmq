import {
  Inject,
  Injectable,
  Logger,
  LoggerService,
  OnApplicationBootstrap,
  OnApplicationShutdown,
} from '@nestjs/common';
import { MODULE_OPTIONS_TOKEN } from '../syrnykmq.module-definition';
import { SyrnykmqModuleOptions } from '../syrnykmq.module-options';
import { AmqpConnectionManager, ChannelWrapper, connect } from 'amqp-connection-manager';
import { Channel } from 'amqplib';
import { SyrnykmqTopologyService } from './topology.service';
import { SyrnykmqConsumerService } from './consumer.service';
import { FailedConnectToBrokerException } from './exceptions';

export const DEFAULT_RECONNECT_TIME = 5;
export const DEFAULT_HEARTBEAT_TIME = 5;

@Injectable()
export class SyrnykmqManagerService implements OnApplicationBootstrap, OnApplicationShutdown {
  private manager!: AmqpConnectionManager;
  private channelWrapper!: ChannelWrapper;
  private readonly logger: LoggerService;

  constructor(
    @Inject(MODULE_OPTIONS_TOKEN) private options: SyrnykmqModuleOptions,
    private readonly topologyService: SyrnykmqTopologyService,
    private readonly consumerService: SyrnykmqConsumerService,
  ) {
    this.logger = this.options.logger || new Logger(SyrnykmqManagerService.name);
  }

  public get channel(): ChannelWrapper {
    return this.channelWrapper;
  }

  public async onApplicationBootstrap(): Promise<void> {
    return new Promise(resolveSetup => {
      this.manager = connect(this.options.urls, {
        reconnectTimeInSeconds: this.options.reconnectTimeInSeconds || DEFAULT_RECONNECT_TIME,
        heartbeatIntervalInSeconds: this.options.heartbeatIntervalInSeconds || DEFAULT_HEARTBEAT_TIME,
        connectionOptions: this.options.connectionOptions || {}
      });
      this.manager.on('connect', () => {
        this.logger.log('Successfully connected to AMQP broker');
        this.channelWrapper = this.manager.createChannel({
          json: false,
          setup: async (channel: Channel) => {
            await this.topologyService.setupExchanges(channel);
            await this.topologyService.setupQueues(channel);
            await this.consumerService.setupReplyMessageHandler(channel);
            await this.consumerService.setupHandlers(channel);
            resolveSetup();
          },
        });
      });
      
      this.manager.on('connectFailed', err => {
        throw new FailedConnectToBrokerException(err.err.message);
      });
      this.manager.on('disconnect', (params) => {
        this.logger.warn('Disconnected from AMQP broker');
      });
    });
  }

  public async onApplicationShutdown(): Promise<void> {
    await this.manager.close();
  }
}
