import { Inject, Injectable, Logger } from '@nestjs/common';
import { ClientGrpc } from '@nestjs/microservices';
import { lastValueFrom, Observable } from 'rxjs';

interface InteractionService {
  getPostInteractionCounts(data: { postId: string, userId: string }): Observable<{ reactionCount: number; commentCount: number; isLiked: boolean }>;
}

@Injectable()
export class GrpcService {
  private interactionService: InteractionService;
  private readonly logger = new Logger(GrpcService.name);

  constructor(@Inject('INTERACTION_PACKAGE') private client: ClientGrpc) {
    this.interactionService = this.client.getService<InteractionService>('PostService');
  }

  async getPostInteractionCounts(postId: string, userId: string): Promise<{ reactionCount: number; commentCount: number; isLiked: boolean }> {
    try {
      this.logger.debug(`Getting interaction counts for post ${postId}`);
      const result = await lastValueFrom(
        this.interactionService.getPostInteractionCounts({ postId , userId}),
      );
      this.logger.debug(`Received interaction counts for post ${postId}:`, result);
      return result;
    } catch (error) {
      this.logger.error(`Error getting interaction counts for post ${postId}:`, error);
      return {
        reactionCount: 0,
        commentCount: 0,
        isLiked: false
      };
    }
  }
} 