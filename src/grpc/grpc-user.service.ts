import { Injectable, Inject, OnModuleInit, Logger } from "@nestjs/common";
import { ClientGrpc } from "@nestjs/microservices";
import { lastValueFrom, Observable } from "rxjs";

interface UserResponse {
  _id: string;
}

interface UsersResponse {
  users: UserResponse[];
  totalCount: number;
}

interface ValidateResponse {
  message: boolean;
}

interface UserServiceGrpc {
  GetFollowing(data: { userId: string }): Observable<UsersResponse>;
  GetFollowers(data: { userId: string }): Observable<UsersResponse>;
  ValidateUser(data: { id: string }): Observable<ValidateResponse>;
  GetUserName(data: {
    userId: string;
  }): Observable<{ fullName: string; username: string }>;
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
      this.logger.debug(
        `Raw following response for user ${userId}:`,
        JSON.stringify(response, null, 2)
      );

      if (!response) {
        this.logger.warn(
          `No response received for following for user ${userId}`
        );
        return [];
      }

      if (typeof response === "string") {
        this.logger.error(
          `Received service name instead of response for following: ${response}`
        );
        return [];
      }

      // Log the exact structure of the response
      this.logger.debug(`Response type: ${typeof response}`);
      this.logger.debug(`Response keys: ${Object.keys(response)}`);
      this.logger.debug(`Response users type: ${typeof response.users}`);
      this.logger.debug(
        `Response users is array: ${Array.isArray(response.users)}`
      );

      if (!response.users || !Array.isArray(response.users)) {
        this.logger.warn(
          `Invalid response format for following for user ${userId}`,
          {
            response: JSON.stringify(response, null, 2),
          }
        );
        return [];
      }

      this.logger.debug(`Response users array for following:`, response.users);
      const following = response.users
        .map((user) => {
          this.logger.debug(`Processing user in following:`, user);
          if (!user || typeof user !== "object") {
            this.logger.warn(`Invalid user object in following:`, user);
            return null;
          }
          if (!user._id || typeof user._id !== "string") {
            this.logger.warn(`Invalid _id in following user:`, user);
            return null;
          }
          return user._id;
        })
        .filter((id): id is string => id !== null);

      this.logger.debug(`Final following list for user ${userId}:`, following);
      return following;
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
      this.logger.debug(
        `Raw followers response for user ${userId}:`,
        JSON.stringify(response, null, 2)
      );

      if (!response) {
        this.logger.warn(
          `No response received for followers for user ${userId}`
        );
        return [];
      }

      if (typeof response === "string") {
        this.logger.error(
          `Received service name instead of response for followers: ${response}`
        );
        return [];
      }

      // Log the exact structure of the response
      this.logger.debug(`Response type: ${typeof response}`);
      this.logger.debug(`Response keys: ${Object.keys(response)}`);
      this.logger.debug(`Response users type: ${typeof response.users}`);
      this.logger.debug(
        `Response users is array: ${Array.isArray(response.users)}`
      );

      if (!response.users || !Array.isArray(response.users)) {
        this.logger.warn(
          `Invalid response format for followers for user ${userId}`,
          {
            response: JSON.stringify(response, null, 2),
          }
        );
        return [];
      }

      this.logger.debug(`Response users array for followers:`, response.users);
      const followers = response.users
        .map((user) => {
          this.logger.debug(`Processing user in followers:`, user);
          if (!user || typeof user !== "object") {
            this.logger.warn(`Invalid user object in followers:`, user);
            return null;
          }
          if (!user._id || typeof user._id !== "string") {
            this.logger.warn(`Invalid _id in follower user:`, user);
            return null;
          }
          return user._id;
        })
        .filter((id): id is string => id !== null);

      this.logger.debug(`Final followers list for user ${userId}:`, followers);
      return followers;
    } catch (error) {
      this.logger.error(`Error getting followers for user ${userId}:`, error);
      return [];
    }
  }

  async getUser(userId: string): Promise<{ exists: boolean }> {
    try {
      this.logger.debug(`Getting user ${userId}`);
      const response = await lastValueFrom(
        this.userService.ValidateUser({ id: userId })
      );
      this.logger.debug(`Received user data for ${userId}:`, response);
      return { exists: response?.message || false };
    } catch (error) {
      this.logger.error(`Error getting user ${userId}:`, error);
      return { exists: false };
    }
  }
  async getUserNameById(
    userId: string
  ): Promise<{ fullName: string; username: string }> {
    try {
      const result = await lastValueFrom(
        this.userService.GetUserName({ userId })
      );
      if (!result) {
        return { fullName: "Unknown User", username: "unknown" };
      }
      return {
        fullName: result.fullName || "Unknown User",
        username: result.username || "unknown",
      };
    } catch (error) {
      this.logger.error(`Error getting user name for ${userId}:`, error);
      return { fullName: "Unknown User", username: "unknown" };
    }
  }
}
