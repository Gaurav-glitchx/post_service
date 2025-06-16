import { Injectable, OnModuleInit, Inject } from "@nestjs/common";
import { ClientGrpc } from "@nestjs/microservices";
import { CustomLogger } from "../logger/logger.service";

interface NotificationService {
  TagNotification(request: {
    userId: string;
    postId: string;
    TagedUserIds: string[];
  }): Promise<{ message: string; success: boolean }>;
}

@Injectable()
export class GrpcNotificationService implements OnModuleInit {
  private notificationService: NotificationService;

  constructor(
    @Inject("NOTIFICATION_PACKAGE") private readonly client: ClientGrpc,
    private readonly logger: CustomLogger
  ) {
    this.logger.setContext("GrpcNotificationService");
  }

  onModuleInit() {
    this.notificationService = this.client.getService<NotificationService>(
      "NotificationService"
    );
  }

  async TagNotification(
    userId: string,
    postId: string,
    TagedUserIds: string[]
  ): Promise<{ message: string; success: boolean }> {
    try {
      this.logger.log("Initiating TagNotification gRPC call", {
        userId,
        postId,
        TagedUserIds,
        timestamp: new Date().toISOString(),
      });

      const response = await this.notificationService.TagNotification({
        userId,
        postId,
        TagedUserIds,
      });

      this.logger.log("TagNotification gRPC call successful", {
        response,
        timestamp: new Date().toISOString(),
      });

      return response;
    } catch (error) {
      this.logger.error("TagNotification gRPC call failed", error.stack, {
        userId,
        postId,
        error: error.message,
        timestamp: new Date().toISOString(),
      });
      throw error;
    }
  }
}
