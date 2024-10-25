import { BadRequestException } from '@nestjs/common';

export class FailedReceiveResponseException extends BadRequestException {
  constructor(message?: string) {
    super(message || 'Failed to receive a response', FailedReceiveResponseException.name);
  }
}