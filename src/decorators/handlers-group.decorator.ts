import { applyDecorators, Injectable, SetMetadata } from '@nestjs/common';

export type HandlersGroupMeta = {
  queue?: string;
  exchange?: string;
};

export type HandlersGroupOptions = HandlersGroupMeta;

export const SYRNYKMQ_HANDLERS_GROUP = Symbol('SYRNYKMQ_HANDLERS_GROUP');

export const HandlersGroup = (options: HandlersGroupOptions) =>
  applyDecorators(Injectable(), SetMetadata<symbol, HandlersGroupMeta>(SYRNYKMQ_HANDLERS_GROUP, options));
