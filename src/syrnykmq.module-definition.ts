import { ConfigurableModuleBuilder } from '@nestjs/common';
import { SyrnykmqModuleOptions } from './syrnykmq.module-options';

export const { ConfigurableModuleClass, MODULE_OPTIONS_TOKEN } =
  new ConfigurableModuleBuilder<SyrnykmqModuleOptions>().build();
