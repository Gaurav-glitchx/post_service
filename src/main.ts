import { NestFactory } from "@nestjs/core";
import { AppModule } from "./app.module";
import { SwaggerModule, DocumentBuilder } from "@nestjs/swagger";
import { ConfigService } from "@nestjs/config";
import { HttpExceptionFilter } from "./http-exception.filter";
import { MicroserviceOptions, Transport } from "@nestjs/microservices";
import { join } from "path";
import { CustomLogger } from "./logger/logger.service";
import { LoggingInterceptor } from "./logger/logging.interceptor";
import { GrpcLoggingInterceptor } from "./logger/grpc-logging.interceptor";
import { ValidationPipe } from "@nestjs/common";
import { Logger } from "@nestjs/common";

async function bootstrap() {
  const logger = new Logger("PostService");
  const app = await NestFactory.create(AppModule);
  const configService = app.get(ConfigService);
  const loggerService = app.get(CustomLogger);

  app.useLogger(loggerService);
  app.useGlobalFilters(new HttpExceptionFilter());

  // Global pipes
  app.useGlobalPipes(new ValidationPipe());

  // Global interceptors
  app.useGlobalInterceptors(
    new LoggingInterceptor(loggerService),
    new GrpcLoggingInterceptor(loggerService)
  );

  const config = new DocumentBuilder()
    .setTitle("Post Service API")
    .setDescription("API documentation for the Post microservice")
    .setVersion("1.0")
    .addBearerAuth()
    .build();
  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup("api", app, document);

  // gRPC microservice setup
  const microservice = app.connectMicroservice<MicroserviceOptions>({
    transport: Transport.GRPC,
    options: {
      package: "post",
      protoPath: join(__dirname, "./grpc/proto/post.proto"),
      url: "0.0.0.0:50055",
      loader: {
        keepCase: true,
        longs: String,
        enums: String,
        defaults: true,
        oneofs: true,
      },
    },
  });
  await app.startAllMicroservices();

  // Enable CORS
  app.enableCors();

  // Add global prefix

  const httpPort = configService.get("PORT") || 3000;
  await app.listen(httpPort);

  logger.log(`Post service HTTP server is running on port ${httpPort}`);
  logger.log(`Post service gRPC server is listening on localhost:50055`);
}

bootstrap();
