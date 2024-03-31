import { ParamData } from '@nestjs/common';

export class SyrnykmqParamsFactory {
  public exchangeKeyForValue(type: number, data: ParamData, args: any[]) {
    if (!args) return null;
    return data && !(typeof data === 'object') ? args[type]?.[data] : args[type];
  }
}
