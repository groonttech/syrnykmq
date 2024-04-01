import { ParamData } from '@nestjs/common';

export class SyrnykmqParamsFactory {
  public exchangeKeyForValue(type: number, propertyKey: ParamData, args: Record<string, unknown>[]) {
    if (!args) return null;
    return propertyKey && !(typeof propertyKey === 'object') ? args[type]?.[propertyKey] : args[type];
  }
}
