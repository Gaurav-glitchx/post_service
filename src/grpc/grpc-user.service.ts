import { Injectable, Inject } from '@nestjs/common';
import { ClientGrpc } from '@nestjs/microservices';
import { lastValueFrom } from 'rxjs';

interface UserServiceGrpc {
  validateUser(data: { userId: string }): Promise<any>;
  GetFollowing(data: { userId: string }): Promise<any>;
  GetFollowers(data: { userId: string }): Promise<any>;
}

@Injectable()
export class GrpcUserService {
  private userService: UserServiceGrpc;

  constructor(@Inject('USER_PACKAGE') private readonly client: ClientGrpc) {}

  onModuleInit() {
    this.userService = this.client.getService<UserServiceGrpc>('UserService');
  }

  async validateUser(userId: string): Promise<any> {
    return lastValueFrom(await this.userService.validateUser({ userId }));
  }

  async getFriends(userId: string): Promise<any> {
    return lastValueFrom(await this.userService.GetFollowing({ userId }));
  }

  async getFollows(userId: string): Promise<any> {
    return lastValueFrom(await this.userService.GetFollowers({ userId }));
  }
} 