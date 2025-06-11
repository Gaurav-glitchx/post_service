import { Injectable, Inject, OnModuleInit, Logger } from "@nestjs/common";
import { ClientGrpc } from "@nestjs/microservices";
import { lastValueFrom, Observable } from "rxjs";

interface GetFollowersResponse {
  followersIds: string[];
}

interface GetFollowingResponse {
  followingIds: string[];
}

interface UserServiceGrpc {
  GetFollowing(data: { userId: string }): Observable<GetFollowingResponse>;
  GetFollowers(data: { userId: string }): Observable<GetFollowersResponse>;
}

@Injectable()
export class GrpcUserService implements OnModuleInit {
  private userService: UserServiceGrpc;
  private readonly logger = new Logger(GrpcUserService.name);

  constructor(@Inject("USER_PACKAGE") private readonly client: ClientGrpc) {}

  onModuleInit() {
    this.userService = this.client.getService<UserServiceGrpc>("UserService");
    if (!this.userService) {
      this.logger.error("Failed to initialize UserService");
      throw new Error("Failed to initialize UserService");
    }
    this.logger.log("UserService initialized successfully");
  }

  async getFollowing(userId: string): Promise<string[]> {
    try {
      this.logger.debug(`Getting following for user ${userId}`);
      const response = await lastValueFrom(
        this.userService.GetFollowing({ userId })
      );
      this.logger.debug(`Received following for user ${userId}:`, response);
      return Array.isArray(response?.followingIds) ? response.followingIds : [];
    } catch (error) {
      this.logger.error(`Error getting following for user ${userId}:`, error);
      return [];
    }
  }

  async getFollowers(userId: string): Promise<string[]> {
    try {
      this.logger.debug(`Getting followers for user ${userId}`);
      const response = await lastValueFrom(
        this.userService.GetFollowers({ userId })
      );
      this.logger.debug(`Received followers for user ${userId}:`, response);
      return Array.isArray(response?.followersIds) ? response.followersIds : [];
    } catch (error) {
      this.logger.error(`Error getting followers for user ${userId}:`, error);
      return [];
    }
  }
}
