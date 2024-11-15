import { BadRequestException } from '@nestjs/common';

export class NotSetDefaultQueueException extends BadRequestException {
  constructor(message?: string) {
    super(message || 'Default queue is not set', NotSetDefaultQueueException.name);
  }
}
