import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ClientsModule, Transport } from '@nestjs/microservices';
import { MongooseModule } from '@nestjs/mongoose';
import { join } from 'path';
import { Post, PostSchema } from './post.schema';
import { PostController } from './post.controller';
import { PostService } from './post.service';
import { KafkaProducerService } from './kafka-producer.service';
import { AuthGuard } from './auth.guard';
import { PostGrpcController } from './post.grpc.controller';
import { GrpcAuthService } from './grpc/grpc-auth.service';
import { GrpcUserService } from './grpc/grpc-user.service';
import { GrpcMediaService } from './grpc/grpc-media.service';
import { GrpcInteractionService } from './grpc/grpc-interaction.service';
import { GrpcNotificationService } from './grpc/grpc-notification.service';
import { CustomLogger } from './logger/logger.service';

@Module({
  imports: [
    MongooseModule.forFeature([{ name: Post.name, schema: PostSchema }]),
    ClientsModule.registerAsync([
      {
        name: 'AUTH_PACKAGE',
        useFactory: (configService: ConfigService) => ({
          transport: Transport.GRPC,
          options: {
            package: 'auth',
            protoPath: join(process.cwd(), 'dist/grpc/proto/auth.proto'),
            url: configService.get('GRPC_AUTH_URL'),
          },
        }),
        inject: [ConfigService],
      },
      {
        name: 'USER_PACKAGE',
        useFactory: (configService: ConfigService) => ({
          transport: Transport.GRPC,
          options: {
            package: 'user',
            protoPath: join(process.cwd(), 'dist/grpc/proto/user.proto'),
            url: configService.get('GRPC_USER_URL'),
          },
        }),
        inject: [ConfigService],
      },
      {
        name: 'MEDIA_PACKAGE',
        useFactory: (configService: ConfigService) => ({
          transport: Transport.GRPC,
          options: {
            package: 'media',
            protoPath: join(process.cwd(), 'dist/grpc/proto/media.proto'),
            url: configService.get('GRPC_MEDIA_URL'),
          },
        }),
        inject: [ConfigService],
      },
      {
        name: 'INTERACTION_PACKAGE',
        useFactory: (configService: ConfigService) => ({
          transport: Transport.GRPC,
          options: {
            package: 'interaction',
            protoPath: join(process.cwd(), 'dist/grpc/proto/interaction.proto'),
            url: configService.get('GRPC_INTERACTION_URL'),
          },
        }),
        inject: [ConfigService],
      },
      {
        name: 'NOTIFICATION_PACKAGE',
        useFactory: (configService: ConfigService) => ({
          transport: Transport.GRPC,
          options: {
            package: 'notification',
            protoPath: join(process.cwd(), 'dist/grpc/proto/notification.proto'),
            url: configService.get('GRPC_NOTIFICATION_URL'),
          },
        }),
        inject: [ConfigService],
      },
    ]),
  ],
  controllers: [PostController, PostGrpcController],
  providers: [
    PostService,
    KafkaProducerService,
    AuthGuard,
    GrpcAuthService,
    GrpcUserService,
    GrpcMediaService,
    GrpcInteractionService,
    GrpcNotificationService,
    CustomLogger,
  ],
  exports: [PostService],
})
export class PostModule {}