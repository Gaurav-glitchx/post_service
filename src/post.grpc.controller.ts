import { Controller } from '@nestjs/common';
import { GrpcMethod } from '@nestjs/microservices';
import { PostService } from './post.service';
import { CreatePostDto } from './dto/create-post.dto';
import { UpdatePostDto } from './dto/update-post.dto';

@Controller()
export class PostGrpcController {
  constructor(private readonly postService: PostService) {}

  @GrpcMethod('PostService', 'CreatePost')
  async createPost(data: CreatePostDto) {
    // No auth here, assumed trusted inter-service call
    const created = await this.postService.create(data, { id: data.userId });
    return { post: created };
  }

  @GrpcMethod('PostService', 'GetPost')
  async getPost(data: { postId: string }) {
    const post = await this.postService.get(data.postId, { id: data.postId });
    return { post };
  }

  @GrpcMethod('PostService', 'UpdatePost')
  async updatePost(data: UpdatePostDto & { postId: string; userId: string }) {
    const { postId, userId, ...dto } = data;
    const updated = await this.postService.update(postId, dto, { id: userId });
    return { post: updated };
  }

  @GrpcMethod('PostService', 'DeletePost')
  async deletePost(data: { postId: string; userId: string }) {
    const deleted = await this.postService.delete(data.postId, { id: data.userId });
    return { post: deleted };
  }

  @GrpcMethod('PostService', 'GetPostsByUser')
  async getPostsByUser(data: { userId: string; page: number; limit: number }) {
    const { posts, total } = await this.postService.getByUser(data.userId, data.page, data.limit, { id: data.userId });
    return { posts, total };
  }

  @GrpcMethod('PostService', 'GetFeed')
  async getFeed(data: { userId: string; page: number; limit: number }) {
    const { posts, total } = await this.postService.getFeed({ id: data.userId }, data.page, data.limit);
    return { posts, total };
  }

  @GrpcMethod('PostService', 'RemovePost')
  async removePost(data: { postId: string }) {
    const post = await this.postService.removePost(data.postId);
    return { post };
  }

  @GrpcMethod('PostService', 'ValidatePost')
  async validatePost(data: { postId: string }) {
    return this.postService.validatePost(data.postId);
  }

  @GrpcMethod('PostService', 'AllPosts')
  async allPosts() {
    return this.postService.getAllPosts();
  }

  @GrpcMethod('PostService', 'ReportedPosts')
  async reportedPosts() {
    return this.postService.getReportedPosts();
  }

  @GrpcMethod('PostService', 'FlagPost')
  async flagPost(data: { postId: string; reason: string }) {
    return this.postService.flagPost(data.postId, data.reason);
  }

  @GrpcMethod('PostService', 'AdminDeletePost')
  async adminDeletePost(data: { postId: string }) {
    return this.postService.adminDeletePost(data.postId);
  }
} 