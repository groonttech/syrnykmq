import { Module } from '@nestjs/common';
import { DiscoveryModule } from '@nestjs/core';
import { ConfigurableModuleClass } from './syrnykmq.module-definition';
import {
  SyrnykmqConsumerService,
  SyrnykmqManagerService,
  SyrnykmqProducerService,
  SyrnykmqTopologyService,
} from './services';

@Module({
  imports: [DiscoveryModule],
  providers: [SyrnykmqManagerService, SyrnykmqTopologyService, SyrnykmqConsumerService, SyrnykmqProducerService],
  exports: [SyrnykmqProducerService],
})
export class SyrnykmqModule extends ConfigurableModuleClass {}
