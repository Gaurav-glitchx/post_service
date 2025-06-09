import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import { CustomLogger } from './logger.service';

@Injectable()
export class GrpcLoggingInterceptor implements NestInterceptor {
  constructor(private readonly logger: CustomLogger) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const rpcContext = context.switchToRpc();
    const handler = context.getHandler();
    const data = rpcContext.getData();
    const startTime = Date.now();

    this.logger.setContext('gRPC');
    this.logger.log(`Incoming gRPC call to ${handler.name}`, {
      data,
    });

    return next.handle().pipe(
      tap({
        next: (response) => {
          const duration = Date.now() - startTime;
          this.logger.log(`Completed gRPC call to ${handler.name}`, {
            duration: `${duration}ms`,
          });
        },
        error: (error) => {
          const duration = Date.now() - startTime;
          this.logger.error(`Failed gRPC call to ${handler.name}`, error.stack, {
            duration: `${duration}ms`,
            error: error.message,
          });
        },
      }),
    );
  }
} 