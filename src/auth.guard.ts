import { Injectable, CanActivate, ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { Observable } from 'rxjs';
import { GrpcAuthService } from './grpc/grpc-auth.service';
import { Reflector } from '@nestjs/core';

@Injectable()
export class AuthGuard implements CanActivate {
  constructor(private readonly grpcAuthService: GrpcAuthService, private readonly reflector: Reflector) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const authHeader = request.headers['authorization'];
    if (!authHeader) throw new UnauthorizedException('No authorization header');
    const token = authHeader.replace('Bearer ', '');
    const user = await this.grpcAuthService.validateToken(token);
    if (!user) throw new UnauthorizedException('Invalid token');
    request.user = user;
    return true;
  }
} 