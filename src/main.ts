import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { ConfigService } from '@nestjs/config';
import { HttpExceptionFilter } from './http-exception.filter';
import { MicroserviceOptions, Transport } from '@nestjs/microservices';
import { join } from 'path';
import { CustomLogger } from './logger/logger.service';
import { LoggingInterceptor } from './logger/logging.interceptor';
import { GrpcLoggingInterceptor } from './logger/grpc-logging.interceptor';
import { ValidationPipe } from '@nestjs/common';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const configService = app.get(ConfigService);
  const logger = app.get(CustomLogger);

  app.useLogger(logger);
  app.useGlobalFilters(new HttpExceptionFilter());

  // Global pipes
  app.useGlobalPipes(new ValidationPipe());

  // Global interceptors
  app.useGlobalInterceptors(
    new LoggingInterceptor(logger),
    new GrpcLoggingInterceptor(logger),
  );

  const config = new DocumentBuilder()
    .setTitle('Post Service API')
    .setDescription('API documentation for the Post microservice')
    .setVersion('1.0')
    .addBearerAuth()
    .build();
  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api', app, document);

  // gRPC microservice setup
  const microservice = app.connectMicroservice<MicroserviceOptions>({
    transport: Transport.GRPC,
    options: {
      package: 'post',
      protoPath: join(__dirname, './grpc/proto/post.proto'),
      url: '0.0.0.0:50055',
    },
  });
  await app.startAllMicroservices();

  const port = configService.get('PORT') || 3000;
  await app.listen(port);
  logger.log(`PostService is running on port ${port}`);
}

bootstrap(); 