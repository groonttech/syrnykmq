import { Module } from '@nestjs/common';
import { DiscoveryModule } from '@nestjs/core';
import { ConfigurableModuleClass } from './syrnykmq.module-definition';
import { SyrnykmqConsumerService, SyrnykmqManagerService, SyrnykmqTopologyService } from './services';

@Module({
  imports: [DiscoveryModule],
  providers: [SyrnykmqManagerService, SyrnykmqTopologyService, SyrnykmqConsumerService],
})
export class SyrnykmqModule extends ConfigurableModuleClass {}
