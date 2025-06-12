import { Module } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { ClientsModule, Transport } from "@nestjs/microservices";
import { MongooseModule } from "@nestjs/mongoose";
import { join } from "path";
import { Post, PostSchema } from "./post.schema";
import { PostController } from "./post.controller";
import { PostService } from "./post.service";
// import { KafkaProducerService } from './kafka-producer.service';

import { PostGrpcController } from "./post.grpc.controller";
import { GrpcAuthService } from "./grpc/grpc-auth.service";
import { GrpcUserService } from "./grpc/grpc-user.service";
import { GrpcMediaService } from "./grpc/grpc-media.service";
import { GrpcNotificationService } from "./grpc/grpc-notification.service";
import { CustomLogger } from "./logger/logger.service";
import { GrpcAuthGuard } from "./guards/grpc-auth.guard";
import { GrpcAuthModule } from "./guards/grpc-auth.module";
import { GrpcModule } from "./grpc/grpc.module";
import { User, UserSchema } from "./user.schema";

@Module({
  imports: [
    GrpcAuthModule,
    MongooseModule.forFeature([{ name: Post.name, schema: PostSchema }]),
    MongooseModule.forFeature([{ name: User.name, schema: UserSchema }]),
    ClientsModule.registerAsync([
      {
        name: "AUTH_PACKAGE",
        useFactory: (configService: ConfigService) => ({
          transport: Transport.GRPC,
          options: {
            package: "auth",
            protoPath: join(process.cwd(), "dist/grpc/proto/auth.proto"),
            url: "localhost:50052",
          },
        }),
        inject: [ConfigService],
      },
      {
        name: "USER_PACKAGE",
        useFactory: (configService: ConfigService) => ({
          transport: Transport.GRPC,
          options: {
            package: "user",
            protoPath: join(process.cwd(), "dist/grpc/proto/user.proto"),
            url: "localhost:50051",
            loader: {
              keepCase: true,
              longs: String,
              enums: String,
              defaults: true,
              oneofs: true            },
            channelOptions: {
              "grpc.max_receive_message_length": 1024 * 1024 * 10, // 10MB
              "grpc.max_send_message_length": 1024 * 1024 * 10, // 10MB
            },
          },
        }),
        inject: [ConfigService],
      },
      {
        name: "MEDIA_PACKAGE",
        useFactory: (configService: ConfigService) => ({
          transport: Transport.GRPC,
          options: {
            package: "media",
            protoPath: join(process.cwd(), "dist/grpc/proto/media.proto"),
            url: configService.get("GRPC_MEDIA_URL"),
          },
        }),
        inject: [ConfigService],
      },
      {
        name: "NOTIFICATION_PACKAGE",
        useFactory: (configService: ConfigService) => ({
          transport: Transport.GRPC,
          options: {
            package: "postNotification",
            protoPath: join(
              process.cwd(),
              "dist/grpc/proto/notification.proto"
            ),
            url: configService.get("GRPC_NOTIFICATION_URL"),
          },
        }),
        inject: [ConfigService],
      },
    ]),
    GrpcModule,
  ],
  controllers: [PostController, PostGrpcController],
  providers: [
    PostService,
    GrpcAuthService,
    GrpcUserService,
    GrpcMediaService,
    GrpcNotificationService,
    CustomLogger,
    GrpcAuthGuard,
  ],
  exports: [PostService],
})
export class PostModule {}
