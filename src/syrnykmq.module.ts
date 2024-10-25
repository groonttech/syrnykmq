import { Module } from '@nestjs/common';
import { DiscoveryModule, Reflector } from '@nestjs/core';
import { ConfigurableModuleClass } from './syrnykmq.module-definition';
import {
  SyrnykmqConsumerService,
  SyrnykmqManagerService,
  SyrnykmqProducerService,
  SyrnykmqTopologyService,
} from './services';

@Module({
  imports: [DiscoveryModule, Reflector],
  providers: [SyrnykmqManagerService, SyrnykmqTopologyService, SyrnykmqConsumerService, SyrnykmqProducerService],
  exports: [SyrnykmqProducerService],
})
export class SyrnykmqModule extends ConfigurableModuleClass {}
