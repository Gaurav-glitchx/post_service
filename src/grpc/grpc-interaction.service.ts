import { Injectable, Inject } from '@nestjs/common';
import { ClientGrpc } from '@nestjs/microservices';
import { lastValueFrom } from 'rxjs';

interface InteractionServiceGrpc {
  providePostDetails(data: { postId: string }): Promise<any>;
}

@Injectable()
export class GrpcInteractionService {
  private interactionService: InteractionServiceGrpc;

  constructor(@Inject('INTERACTION_PACKAGE') private readonly client: ClientGrpc) {}

  onModuleInit() {
    this.interactionService = this.client.getService<InteractionServiceGrpc>('InteractionService');
  }

  async providePostDetails(postId: string): Promise<any> {
    return lastValueFrom(await this.interactionService.providePostDetails({ postId }));
  }
} 