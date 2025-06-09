import { Injectable, OnModuleInit, Inject } from '@nestjs/common';
import { ClientGrpc } from '@nestjs/microservices';
import { join } from 'path';
import { ConfigService } from '@nestjs/config';
import { CustomLogger } from '../logger/logger.service';

interface NotificationService {
  sendNotification(request: {
    userId: string;
    type: string;
    title: string;
    message: string;
    data: Record<string, string>;
  }): Promise<{ success: boolean; notificationId: string }>;
}

@Injectable()
export class GrpcNotificationService implements OnModuleInit {
  private notificationService: NotificationService;

  constructor(
    @Inject('NOTIFICATION_PACKAGE') private readonly client: ClientGrpc,
    private readonly logger: CustomLogger,
  ) {
    this.logger.setContext('GrpcNotificationService');
  }

  onModuleInit() {
    this.notificationService = this.client.getService<NotificationService>('NotificationService');
  }

  async sendNotification(
    userId: string,
    type: string,
    title: string,
    message: string,
    data: Record<string, string> = {},
  ) {
    try {
      this.logger.log('Sending notification', { userId, type, title });
      const response = await this.notificationService.sendNotification({
        userId,
        type,
        title,
        message,
        data,
      });
      this.logger.log('Notification sent successfully', { notificationId: response.notificationId });
      return response;
    } catch (error) {
      this.logger.error('Failed to send notification', error.stack, { error: error.message, userId, type });
      throw error;
    }
  }
} 