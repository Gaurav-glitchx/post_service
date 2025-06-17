import { Controller, NotFoundException } from "@nestjs/common";
import { GrpcMethod } from "@nestjs/microservices";
import { PostService } from "./post.service";
import { CustomLogger } from "./logger/logger.service";
import { CreatePostDto } from "./dto/create-post.dto";
import { UpdatePostDto } from "./dto/update-post.dto";
import { PostDocument } from "./post.schema";
import { InjectModel } from "@nestjs/mongoose";
import { Model } from "mongoose";
import { Post } from "./post.schema";

interface FlagPostRequest {
  postId: string;
  reason: string;
}

@Controller()
export class PostGrpcController {
  constructor(
    private readonly postService: PostService,
    private readonly logger: CustomLogger,
    @InjectModel(Post.name) private readonly postModel: Model<PostDocument>
  ) {}

  @GrpcMethod("PostService", "CreatePost")
  async createPost(data: CreatePostDto & { userId: string }) {
    // No auth here, assumed trusted inter-service call
    const created = await this.postService.create(data, data.userId);
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
    const updated = await this.postService.update(postId, dto, userId);
    return { post: updated };
  }

  @GrpcMethod("PostService", "DeletePost")
  async deletePost(data: { postId: string; userId: string }) {
    const deleted = await this.postService.deletePost(data.postId, data.userId);
    return { post: deleted };
  }

  @GrpcMethod("PostService", "GetPostsByUser")
  async getPostsByUser(data: { userId: string; page: number; limit: number }) {
    const result = await this.postService.getByUser(
      data.userId,
      data.page,
      data.limit,
      { id: data.userId }
    );
    return { posts: result.data, total: result.total };
  }

  @GrpcMethod("PostService", "GetFeed")
  async getFeed(data: { userId: string; page: number; limit: number }) {
    const result = await this.postService.getFeed(
      { id: data.userId },
      data.page,
      data.limit
    );
    return { posts: result.data, total: result.total };
  }

  @GrpcMethod("PostService", "ValidatePost")
  async validatePost(data: { postId: string }) {
    return this.postService.validatePost(data.postId);
  }

  @GrpcMethod("PostService", "AllPosts")
  async allPosts() {
    try {
      this.logger.log("Handling AllPosts gRPC request");
      const result = await this.postService.getAllPosts();
      this.logger.log("Raw result from getAllPosts:", result);

      // Transform the posts to match the gRPC interface
      const transformedPosts = result.data.map((post) => {
        const postObj = post.toObject();
        return {
          id: postObj._id.toString(),
          userId: postObj.UserId.toString(),
          content: postObj.content,
          media: postObj.media,
          visibility: postObj.visibility,
          deleted: postObj.deleted,
          moderated: postObj.moderated,
          keywords: postObj.keywords,
          createdAt: (postObj as any).createdAt.toISOString(),
          updatedAt: (postObj as any).updatedAt.toISOString(),
          isReported: postObj.isReported,
          reportReason: postObj.reportReason || "",
        };
      });

      const response = { posts: transformedPosts };
      this.logger.log("Transformed response:", response);
      return response;
    } catch (error) {
      this.logger.error(
        "Error in AllPosts gRPC method",
        error instanceof Error ? error.stack : String(error),
        { error: error instanceof Error ? error.message : String(error) }
      );
      throw error;
    }
  }

  @GrpcMethod("PostService", "reportedPosts")
  async reportedPosts() {
    try {
      this.logger.log("Handling reportedPosts gRPC request");
      const result = await this.postService.getReportedPosts();
      this.logger.log("Raw result from getReportedPosts:", result);

      // Transform the posts to match the gRPC interface
      const transformedPosts = result.posts.map((post) => {
        const postObj = post.toObject();
        return {
          id: postObj._id.toString(),
          userId: postObj.UserId.toString(),
          content: postObj.content,
          media: postObj.media,
          visibility: postObj.visibility,
          deleted: postObj.deleted,
          moderated: postObj.moderated,
          keywords: postObj.keywords,
          createdAt: (postObj as any).createdAt.toISOString(),
          updatedAt: (postObj as any).updatedAt.toISOString(),
          isReported: postObj.isReported,
          reportReason: postObj.reportReason || "",
        };
      });

      const response = { posts: transformedPosts };
      this.logger.log("Transformed response:", response);
      return response;
    } catch (error) {
      this.logger.error(
        "Error in reportedPosts gRPC method",
        error instanceof Error ? error.stack : String(error),
        { error: error instanceof Error ? error.message : String(error) }
      );
      throw error;
    }
  }

  @GrpcMethod("PostService", "flagPost")
  async flagPost(request: FlagPostRequest) {
    try {
      this.logger.log("Handling flagPost gRPC request", request);
      const result = await this.postService.flagPost(
        request.postId,
        request.reason
      );
      this.logger.log("Raw result from flagPost:", result);

      // Get the post directly from the database
      const post = await this.postModel.findById(request.postId);
      if (!post) {
        throw new NotFoundException("Post not found");
      }

      // Transform the post to match the gRPC interface
      const postObj = post.toObject();
      const transformedPost = {
        id: postObj._id.toString(),
        userId: postObj.UserId.toString(),
        content: postObj.content,
        media: postObj.media,
        visibility: postObj.visibility,
        deleted: postObj.deleted,
        moderated: postObj.moderated,
        keywords: postObj.keywords,
        createdAt: (postObj as any).createdAt.toISOString(),
        updatedAt: (postObj as any).updatedAt.toISOString(),
        isReported: postObj.isReported,
        reportReason: postObj.reportReason || "",
      };

      const response = { post: transformedPost };
      this.logger.log("Transformed response:", response);
      return response;
    } catch (error) {
      this.logger.error(
        "Error in flagPost gRPC method",
        error instanceof Error ? error.stack : String(error),
        { error: error instanceof Error ? error.message : String(error) }
      );
      throw error;
    }
  }

  @GrpcMethod("PostService", "adminDeletePost")
async adminDeletePost(data: { postId: string }) {
  try {
    this.logger.log("Handling adminDeletePost gRPC request", { postId: data.postId });
    
    // Delete the post and get the result
    const result = await this.postService.adminDeletePost(data.postId);
    this.logger.log("Raw result from adminDeletePost:", result);
    
    // Transform the post to match the gRPC interface
    const postObj = result.post;
    const transformedPost = {
      id: postObj._id.toString(),
      userId: postObj.UserId.toString(),
      content: postObj.content,
      media: postObj.media,
      visibility: postObj.visibility,
      deleted: postObj.deleted,
      moderated: postObj.moderated,
      keywords: postObj.keywords,
      createdAt: (postObj as any).createdAt.toISOString(),
      updatedAt: (postObj as any).updatedAt.toISOString(),
      isReported: postObj.isReported,
      reportReason: postObj.reportReason || ''
    };
    
    const response = { 
      post: transformedPost,
      message: result.message,
      success: result.success,
      alreadyDeleted: result.alreadyDeleted
    };
    this.logger.log("Transformed response:", response);
    return response;
  } catch (error) {
    this.logger.error(
      "Error in adminDeletePost gRPC method",
      error instanceof Error ? error.stack : String(error),
      { 
        postId: data.postId,
        error: error instanceof Error ? error.message : String(error)
      }
    );
    throw error;
  }
}

  @GrpcMethod("PostService", "ReportPost")
  async reportPost(data: { postId: string; userId: string; reason: string }) {
    return this.postService.reportPost(data.postId, data.userId, data.reason);
  }
}