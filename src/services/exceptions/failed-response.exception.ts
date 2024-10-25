import { BadRequestException } from '@nestjs/common';

export class FailedResponseException extends BadRequestException {
  constructor(message?: string) {
    super(message || 'Failed response', FailedResponseException.name);
  }
}