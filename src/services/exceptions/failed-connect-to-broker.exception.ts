import { BadRequestException } from '@nestjs/common';

export class FailedConnectToBrokerException extends BadRequestException {
  constructor(message?: string) {
    super(message || 'Failed to connect to RabbitMQ broker', FailedConnectToBrokerException.name);
  }
}