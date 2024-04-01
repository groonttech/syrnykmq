import { assignMetadata, PipeTransform, Type } from '@nestjs/common';
import { ROUTE_ARGS_METADATA } from '@nestjs/common/constants';

export const SYRNYKMQ_CONTENT_PARAM = 0;
export const SYRNYKMQ_MESSAGE_PARAM = 1;
export const SYRNYKMQ_CONTROLS_PARAM = 2;

export const createParamDecorator =
  (
    propertyOrPipe: unknown,
    type: number = SYRNYKMQ_CONTENT_PARAM,
    ...pipes: (Type<PipeTransform> | PipeTransform)[]
  ): ParameterDecorator =>
  (target, key, index) => {
    const meta = Reflect.getMetadata(ROUTE_ARGS_METADATA, target.constructor, key || '') || {};
    const propertyKey = typeof propertyOrPipe === 'string' ? propertyOrPipe : undefined;
    const paramPipes = propertyKey ? pipes : [propertyOrPipe, ...pipes];
    Reflect.defineMetadata(
      ROUTE_ARGS_METADATA,
      assignMetadata(meta, type, index, propertyKey, ...(paramPipes as (Type<PipeTransform> | PipeTransform)[])),
      target.constructor,
      key || '',
    );
  };

export function Content(...pipes: (Type<PipeTransform> | PipeTransform)[]): ParameterDecorator;
export function Content(propertyKey?: string, ...pipes: (Type<PipeTransform> | PipeTransform)[]): ParameterDecorator;
export function Content(
  propertyOrPipe?: string | (Type<PipeTransform> | PipeTransform),
  ...pipes: (Type<PipeTransform> | PipeTransform)[]
): ParameterDecorator {
  return createParamDecorator(propertyOrPipe, SYRNYKMQ_CONTENT_PARAM, ...pipes);
}

export function Message(...pipes: (Type<PipeTransform> | PipeTransform)[]): ParameterDecorator;
export function Message(propertyKey?: string, ...pipes: (Type<PipeTransform> | PipeTransform)[]): ParameterDecorator;
export function Message(
  propertyOrPipe?: string | (Type<PipeTransform> | PipeTransform),
  ...pipes: (Type<PipeTransform> | PipeTransform)[]
): ParameterDecorator {
  return createParamDecorator(propertyOrPipe, SYRNYKMQ_MESSAGE_PARAM, ...pipes);
}

export function Controls(...pipes: (Type<PipeTransform> | PipeTransform)[]): ParameterDecorator;
export function Controls(propertyKey?: string, ...pipes: (Type<PipeTransform> | PipeTransform)[]): ParameterDecorator;
export function Controls(
  propertyOrPipe?: string | (Type<PipeTransform> | PipeTransform),
  ...pipes: (Type<PipeTransform> | PipeTransform)[]
): ParameterDecorator {
  return createParamDecorator(propertyOrPipe, SYRNYKMQ_CONTROLS_PARAM, ...pipes);
}
