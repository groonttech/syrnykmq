import { BadRequestException } from '@nestjs/common';

export class NotSetDefaultExchangeException extends BadRequestException {
  constructor(message?: string) {
    super(message || 'Default exchange is not set', NotSetDefaultExchangeException.name);
  }
}
