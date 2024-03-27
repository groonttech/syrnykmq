import { ParamData } from '@nestjs/common';
import { SYRNYKMQ_CONTENT_PARAM, SYRNYKMQ_MESSAGE_PARAM } from './decorators';

export class SyrnykmqParamsFactory {
  public exchangeKeyForValue(type: number, data: ParamData, args: any[]) {
    if (!args) return null;
    let index = 0;
    if (type === SYRNYKMQ_CONTENT_PARAM) index = 0;
    else if (type === SYRNYKMQ_MESSAGE_PARAM) index = 1;
    return data && !(typeof data === 'object') ? args[index]?.[data] : args[index];
  }
}
