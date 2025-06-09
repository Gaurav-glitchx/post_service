import { Injectable, Inject } from '@nestjs/common';
import { ClientGrpc } from '@nestjs/microservices';
import { lastValueFrom } from 'rxjs';

interface AuthServiceGrpc {
  validateToken(data: { token: string }): Promise<any>;
}

@Injectable()
export class GrpcAuthService {
  private authService: AuthServiceGrpc;

  constructor(@Inject('AUTH_PACKAGE') private readonly client: ClientGrpc) {}

  onModuleInit() {
    this.authService = this.client.getService<AuthServiceGrpc>('AuthService');
  }

  async validateToken(token: string): Promise<any> {
    return lastValueFrom(await this.authService.validateToken({ token }));
  }
} 