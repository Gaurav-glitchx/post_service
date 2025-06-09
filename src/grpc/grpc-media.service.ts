import { Injectable, Inject } from '@nestjs/common';
import { ClientGrpc } from '@nestjs/microservices';
import { lastValueFrom } from 'rxjs';

interface MediaServiceGrpc {
  getSignedUploadUrls(data: { files: string[] }): Promise<any>;
  deleteMedia(data: { files: string[] }): Promise<any>;
}

@Injectable()
export class GrpcMediaService {
  private mediaService: MediaServiceGrpc;

  constructor(@Inject('MEDIA_PACKAGE') private readonly client: ClientGrpc) {}

  onModuleInit() {
    this.mediaService = this.client.getService<MediaServiceGrpc>('MediaService');
  }

  async getSignedUploadUrls(files: string[]): Promise<any> {
    return lastValueFrom(await this.mediaService.getSignedUploadUrls({ files }));
  }

  async deleteMedia(files: string[]): Promise<any> {
    return lastValueFrom(await this.mediaService.deleteMedia({ files }));
  }
} 