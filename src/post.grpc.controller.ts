import { Controller, Logger } from "@nestjs/common";
import { GrpcMethod } from "@nestjs/microservices";
import { PostService } from "./post.service";
import { CreatePostDto } from "./dto/create-post.dto";
import { UpdatePostDto } from "./dto/update-post.dto";

@Controller()
export class PostGrpcController {
  private readonly logger = new Logger(PostGrpcController.name);

  constructor(private readonly postService: PostService) {}

  @GrpcMethod("PostService", "CreatePost")
  async createPost(data: CreatePostDto & { userId: string }) {
    // No auth here, assumed trusted inter-service call
    const created = await this.postService.create(data, { id: data.userId });
    return { post: created };
  }

  @GrpcMethod("PostService", "GetPost")
  async getPost(data: { postId: string }) {
    const post = await this.postService.get(data.postId, { id: data.postId });
    return { post };
  }

  @GrpcMethod("PostService", "UpdatePost")
  async updatePost(data: UpdatePostDto & { postId: string; userId: string }) {
    const { postId, userId, ...dto } = data;
    const updated = await this.postService.update(postId, dto, { id: userId });
    return { post: updated };
  }

  @GrpcMethod("PostService", "DeletePost")
  async deletePost(data: { postId: string; userId: string }) {
    const deleted = await this.postService.delete(data.postId, {
      id: data.userId,
    });
    return { post: deleted };
  }

  @GrpcMethod("PostService", "GetPostsByUser")
  async getPostsByUser(data: { userId: string; page: number; limit: number }) {
    const { posts, total } = await this.postService.getByUser(
      data.userId,
      data.page,
      data.limit,
      { id: data.userId }
    );
    return { posts, total };
  }

  @GrpcMethod("PostService", "GetFeed")
  async getFeed(data: { userId: string; page: number; limit: number }) {
    const { posts, total } = await this.postService.getFeed(
      { id: data.userId },
      data.page,
      data.limit
    );
    return { posts, total };
  }

  @GrpcMethod("PostService", "ValidatePost")
  async validatePost(data: { postId: string }) {
    return this.postService.validatePost(data.postId);
  }

  @GrpcMethod("PostService", "allPosts")
  async allPosts() {
    try {
      this.logger.log("Handling allPosts gRPC request");
      const result = await this.postService.getAllPosts();
      this.logger.log("Successfully retrieved all posts", {
        count: result.posts.length,
      });
      return result;
    } catch (error) {
      this.logger.error("Error in allPosts gRPC method", {
        error: error.message,
        stack: error.stack,
      });
      throw error;
    }
  }

  @GrpcMethod("PostService", "reportedPosts")
  async reportedPosts() {
    try {
      this.logger.log("Handling reportedPosts gRPC request");
      const result = await this.postService.getReportedPosts();
      this.logger.log("Successfully retrieved reported posts", {
        count: result.posts.length,
      });
      return result;
    } catch (error) {
      this.logger.error("Error in reportedPosts gRPC method", {
        error: error.message,
        stack: error.stack,
      });
      throw error;
    }
  }

  @GrpcMethod("PostService", "flagPost")
  async flagPost(data: { postId: string; reason: string }) {
    try {
      this.logger.log("Handling flagPost gRPC request", {
        postId: data.postId,
        reason: data.reason,
      });
      const result = await this.postService.flagPost(data.postId, data.reason);
      this.logger.log("Successfully flagged post", { postId: data.postId });
      return result;
    } catch (error) {
      this.logger.error("Error in flagPost gRPC method", {
        postId: data.postId,
        error: error.message,
        stack: error.stack,
      });
      throw error;
    }
  }

  @GrpcMethod("PostService", "adminDeletePost")
  async adminDeletePost(data: { postId: string }) {
    try {
      this.logger.log("Handling adminDeletePost gRPC request", {
        postId: data.postId,
      });
      const result = await this.postService.adminDeletePost(data.postId);
      this.logger.log("Successfully deleted post", { postId: data.postId });
      return result;
    } catch (error) {
      this.logger.error("Error in adminDeletePost gRPC method", {
        postId: data.postId,
        error: error.message,
        stack: error.stack,
      });
      throw error;
    }
  }

  @GrpcMethod("PostService", "GetPostInteractionCounts")
  async getPostInteractionCounts(data: { postId: string }) {
    return this.postService.getPostInteractionCounts(data.postId);
  }

  @GrpcMethod("PostService", "ReportPost")
  async reportPost(data: { postId: string; userId: string; reason: string }) {
    return this.postService.reportPost(data.postId, data.userId, data.reason);
  }
}
