import {
  Injectable,
  CanActivate,
  ExecutionContext,
  UnauthorizedException,
  Logger,
} from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { GrpcAuthService } from "./grpc/grpc-auth.service";
import { Request } from "express";

interface UserPayload {
  userId: string;
  email: string;
  role: string;
  issuedAt: number;
  expiresAt: number;
}

interface AuthenticatedRequest extends Request {
  user: UserPayload;
}

@Injectable()
export class AuthGuard implements CanActivate {
  private readonly logger = new Logger(AuthGuard.name);
  constructor(
    private readonly grpcAuthService: GrpcAuthService,
    private readonly reflector: Reflector
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();

    // Extract token from header
    const authHeader = request.headers["authorization"];
    this.logger.log(`Authorization header: ${authHeader}`);
    if (!authHeader) {
      this.logger.log("No authorization header");
      throw new UnauthorizedException("No authorization header");
    }

    // Verify token format
    const [bearer, token] = authHeader.split(" ");
    if (bearer !== "Bearer" || !token) {
      this.logger.log("Invalid authorization header format");
      throw new UnauthorizedException("Invalid authorization header format");
    }

    try {
      this.logger.log(`Validating token via gRPC: ${token}`);
      // Validate token via gRPC service
      const user = await this.grpcAuthService.validateToken(token);
      this.logger.log(`gRPC validation result: ${JSON.stringify(user)}`);

      // Check if token is expired
      if (Date.now() > user.expiresAt * 1000) {
        // Convert seconds to milliseconds
        this.logger.log("Token expired");
        throw new UnauthorizedException("Token expired");
      }

      // Attach user to request
      request.user = user;
      return true;
    } catch (error) {
      this.logger.log(`Token validation failed: ${error?.message || error}`);
      throw new UnauthorizedException("Invalid token");
    }
  }
}
