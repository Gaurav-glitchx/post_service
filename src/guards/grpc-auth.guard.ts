import {
  CanActivate,
  ExecutionContext,
  Inject,
  Injectable,
  UnauthorizedException,
} from "@nestjs/common";
import { ClientGrpc } from "@nestjs/microservices";
import { Observable, lastValueFrom } from "rxjs";
import { Request } from "express";

interface RequestWithUser extends Request {
  user: {
    userId: string;
    email: string;
    role: string;
    issuedAt: number;
    expiresAt: number;
  };
}

interface AuthGrpcService {
  ValidateToken(data: { access_token: string }): Observable<{
    userId: string;
    email: string;
    role: string;
    issuedAt: number;
    expiresAt: number;
  }>;
}

@Injectable()
export class GrpcAuthGuard implements CanActivate {
  private authService: AuthGrpcService;

  constructor(@Inject("AUTH_PACKAGE") private readonly client: ClientGrpc) {}

  onModuleInit() {
    this.authService = this.client.getService<AuthGrpcService>("AuthService");
  }

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest<RequestWithUser>();
    const authHeader = req.headers["authorization"];


    if (!authHeader?.startsWith("Bearer ")) {
      throw new UnauthorizedException(
        "Authorization token missing or malformed"
      );
    }

    const token = authHeader.split(" ")[1];

    try {
      const requestData = { access_token: token.trim() };
      console.log(
        "Sending request data:",
        JSON.stringify(requestData, null, 2)
      );

      const userPayload = await lastValueFrom(
        this.authService.ValidateToken(requestData)
      );

      if (!userPayload) {
        throw new UnauthorizedException(
          "Invalid token response from auth service"
        );
      }

      req.user = userPayload;
      return true;
    } catch (error) {
      console.error("Token validation error:", error);
      if (error.code === 2) {
        console.error(
          "Request data that caused the error:",
          JSON.stringify({ access_token: token.trim() }, null, 2)
        );
        throw new UnauthorizedException("Invalid token format");
      }
      if (error.code === 14) {
        throw new UnauthorizedException("Auth service unavailable");
      }
      throw new UnauthorizedException("Invalid or expired token");
    }
  }
}
