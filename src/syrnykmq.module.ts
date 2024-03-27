import { Module } from '@nestjs/common';
import { DiscoveryModule } from '@nestjs/core';
import { ConfigurableModuleClass } from './syrnykmq.module-definition';
import { SyrnykmqService } from './syrnykmq.service';
import { SyrnykmqHandlersExplorer } from './handlers.explorer';

@Module({
  imports: [DiscoveryModule],
  providers: [SyrnykmqService, SyrnykmqHandlersExplorer],
})
export class SyrnykmqModule extends ConfigurableModuleClass {}
