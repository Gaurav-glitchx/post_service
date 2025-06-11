import { Injectable, Inject } from "@nestjs/common";
import { ClientGrpc } from "@nestjs/microservices";
import { lastValueFrom, Observable } from "rxjs";

interface AuthServiceGrpc {
  validateToken(data: TokenValidationRequest): Observable<UserPayload>;
}

interface TokenValidationRequest {
  access_token: string;
}

interface UserPayload {
  userId: string;
  email: string;
  role: string;
  issuedAt: number;
  expiresAt: number;
}

@Injectable()
export class GrpcAuthService {
  private authService: AuthServiceGrpc;

  constructor(@Inject("AUTH_PACKAGE") private readonly client: ClientGrpc) {}

  onModuleInit() {
    this.authService = this.client.getService<AuthServiceGrpc>("AuthService");
  }

  async validateToken(access_token: string): Promise<UserPayload> {
    console.log("Sending validateToken request with token:", access_token);
    const observable = this.authService.validateToken({ access_token });
    try {
      const result = await lastValueFrom(observable);
      console.log("Received validateToken response:", result);
      return result;
    } catch (error) {
      console.error("Error in validateToken:", error);
      throw error;
    }
  }
}
