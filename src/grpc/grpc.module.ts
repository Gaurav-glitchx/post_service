import { Module } from '@nestjs/common';
import { ClientsModule, Transport } from '@nestjs/microservices';
import { join } from 'path';
import { GrpcService } from './grpc.service';

@Module({
  imports: [
    ClientsModule.register([
      {
        name: 'INTERACTION_PACKAGE',
        transport: Transport.GRPC,
        options: {
          package: 'post',
          protoPath: join(__dirname, 'proto/post.proto'),
          url: 'localhost:50056', // Interaction service port
          loader: {
            keepCase: true,
            longs: String,
            enums: String,
            defaults: true,
            oneofs: true
          }
        },
      },
    ]),
  ],
  providers: [GrpcService],
  exports: [GrpcService],
})
export class GrpcModule {} 