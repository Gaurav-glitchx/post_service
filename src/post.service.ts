import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  Inject,
  BadRequestException,
} from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import mongoose, { Model, Types } from "mongoose";
import { Post, PostDocument } from "./post.schema";
import { CreatePostDto } from "./dto/create-post.dto";
import { UpdatePostDto } from "./dto/update-post.dto";
// import { KafkaProducerService } from "./kafka-producer.service";
import { GrpcUserService } from "./grpc/grpc-user.service";
import { GrpcMediaService } from "./grpc/grpc-media.service";
import { GrpcNotificationService } from "./grpc/grpc-notification.service";
import { CustomLogger } from "./logger/logger.service";
import { GrpcService } from "./grpc/grpc.service";

interface SignedUrl {
  fileKey: string;
  uploadUrl: string;
  publicUrl: string;
}

const ALLOWED_MEDIA_TYPES = [
  "image/jpeg",
  "image/png",
  "image/gif",
  "video/mp4",
];
const MAX_MEDIA_FILES = 5;
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB

@Injectable()
export class PostService {
  constructor(
    @InjectModel(Post.name) private postModel: Model<PostDocument>,
    // private readonly kafkaProducer: KafkaProducerService,
    private readonly grpcUserService: GrpcUserService,
    private readonly grpcMediaService: GrpcMediaService,
    private readonly grpcNotificationService: GrpcNotificationService,
    private readonly logger: CustomLogger,
    private readonly grpcService: GrpcService
  ) {
    this.logger.setContext("PostService");
  }

  async create(dto: CreatePostDto, userId: any) {
    this.logger.log("Creating new post", { UserId: userId });
    let mediaUrls = dto.media || [];
    let signedUrls = [];

    if (mediaUrls.length) {
      this.logger.log("Getting signed URLs for media", { files: mediaUrls });
      signedUrls = await this.grpcMediaService.getSignedUploadUrls(mediaUrls);

      // Extract file keys and public URLs from the signed URLs response
      const fileKeys = signedUrls.urls.map((url: SignedUrl) => url.fileKey);
      const publicUrls = signedUrls.urls.map((url: SignedUrl) => url.publicUrl);

      // Create post with media URLs
      const postData = {
        content: dto.content,
        visibility: dto.visibility,
        UserId: new Types.ObjectId(userId),
        keywords: dto.content.split(" "),
        media: fileKeys, // Store the file keys in media array
        signedMediaUrls: publicUrls, // Store the public URLs for viewing
      };

      const created = await this.postModel.create(postData);
      this.logger.log("Post created successfully", { postId: created._id });

      return {
        post: created,
        signedUrls: signedUrls.urls, // Return the signed URLs for upload
      };
    } else {
      // Create post without media
      const postData = {
        content: dto.content,
        visibility: dto.visibility,
        UserId: new Types.ObjectId(userId),
        keywords: dto.content.split(" "),
        media: [],
        signedMediaUrls: [],
      };

      const created = await this.postModel.create(postData);
      this.logger.log("Post created successfully", { postId: created._id });

      return {
        post: created,
        signedUrls: [],
      };
    }
  }

  async get(postId: string, user: any) {
    this.logger.log("Getting post", { postId, userId: user.id });
    const post = await this.postModel.findById(postId);
    if (!post || post.deleted || post.moderated) {
      this.logger.warn("Post not found or unavailable", { postId });
      throw new NotFoundException("Post not found");
    }

    // Get interaction counts
    const interactionCounts = await this.getPostInteractionCounts(postId);

    // Add interaction counts to the post response
    const postResponse = post.toObject();
    return {
      ...postResponse,
      reactionCount: interactionCounts.reactionCount,
      commentCount: interactionCounts.commentCount,
    };
  }

  private validateMediaFiles(files: string[]): void {
    if (files.length > MAX_MEDIA_FILES) {
      throw new BadRequestException(
        `Maximum ${MAX_MEDIA_FILES} media files allowed`
      );
    }

    // Validate file types
    files.forEach((file) => {
      const extension = file.split(".").pop()?.toLowerCase();
      if (!extension) {
        throw new BadRequestException("Invalid file name");
      }

      const mimeType = this.getMimeType(extension);
      if (!ALLOWED_MEDIA_TYPES.includes(mimeType)) {
        throw new BadRequestException(
          `File type ${extension} not allowed. Allowed types: jpg, png, gif, mp4`
        );
      }
    });
  }

  private getMimeType(extension: string): string {
    const mimeTypes: Record<string, string> = {
      jpg: "image/jpeg",
      jpeg: "image/jpeg",
      png: "image/png",
      gif: "image/gif",
      mp4: "video/mp4",
    };
    return mimeTypes[extension] || "";
  }

  async update(postId: string, dto: UpdatePostDto, userId: any) {
    this.logger.log("Updating post", { postId, userId: userId });
    const post = await this.postModel.findById(postId);
    if (!post || post.deleted || post.moderated) {
      this.logger.warn("Post not found or unavailable", { postId });
      throw new NotFoundException("Post not found");
    }

    // Convert both IDs to strings for comparison
    const postUserId = post.UserId.toString();
    const currentUserId = userId.toString();

    if (postUserId !== currentUserId) {
      this.logger.warn("Unauthorized post update attempt", {
        postId,
        userId: userId,
        postUserId,
        currentUserId,
      });
      throw new ForbiddenException("Not your post");
    }

    // Handle media changes
    let signedUrls = [];
    let updatedMedia = [...post.media];
    let updatedSignedMediaUrls = [...post.signedMediaUrls];

    if (dto.media) {
      // Validate new media files
      this.validateMediaFiles(dto.media);

      // If new media is provided, get signed URLs for upload
      this.logger.log("Getting signed URLs for new media", {
        files: dto.media,
      });
      signedUrls = await this.grpcMediaService.getSignedUploadUrls(dto.media);

      // Add new media file keys and their public URLs
      const newFileKeys = signedUrls.urls.map((url: SignedUrl) => url.fileKey);
      const newPublicUrls = signedUrls.urls.map(
        (url: SignedUrl) => url.publicUrl
      );

      updatedMedia = [...updatedMedia, ...newFileKeys];
      updatedSignedMediaUrls = [...updatedSignedMediaUrls, ...newPublicUrls];
    }

    // Handle media deletions if specified
    if (dto.deleteMedia && dto.deleteMedia.length > 0) {
      // Delete specified media files from storage
      this.logger.log("Deleting specified media files", {
        files: dto.deleteMedia,
      });
      await this.grpcMediaService.deleteMedia(dto.deleteMedia);

      // Remove deleted media and their corresponding signed URLs
      const deleteSet = new Set(dto.deleteMedia);
      updatedMedia = updatedMedia.filter((fileKey) => !deleteSet.has(fileKey));
      updatedSignedMediaUrls = updatedSignedMediaUrls.filter((_, index) => {
        const mediaKey = updatedMedia[index];
        return mediaKey && !deleteSet.has(mediaKey);
      });
    }

    // Update post with new media arrays
    const updateData = {
      ...dto,
      media: updatedMedia,
      signedMediaUrls: updatedSignedMediaUrls,
    };

    // Update post content and other fields
    Object.assign(post, updateData);
    if (dto.content) post.keywords = dto.content.split(" ");
    await post.save();

    this.logger.log("Post updated successfully", {
      postId,
      mediaCount: updatedMedia.length,
      newMediaCount: dto.media ? dto.media.length : 0,
      deletedMediaCount: dto.deleteMedia ? dto.deleteMedia.length : 0,
    });

    // Return updated post and signed URLs if there are new media files
    return {
      post,
      signedUrls: signedUrls,
    };
  }

  async delete(postId: string, userid: any) {
    this.logger.log("Deleting post", { postId, userId: userid });
    const post = await this.postModel.findById(postId);
    if (!post || post.deleted || post.moderated) {
      this.logger.warn("Post not found or unavailable", { postId });
      throw new NotFoundException("Post not found");
    }

    // Convert both IDs to strings for comparison
    const postUserId = post.UserId.toString();
    const currentUserId = userid.toString();

    if (postUserId !== currentUserId) {
      this.logger.warn("Unauthorized post deletion attempt", {
        postId,
        userId: userid,
        postUserId,
        currentUserId,
      });
      throw new ForbiddenException("Not your post");
    }

    post.deleted = true;
    await post.save();
    if (post.media.length) {
      this.logger.log("Deleting associated media files", { files: post.media });
      await this.grpcMediaService.deleteMedia(post.media);
    }
    // await this.kafkaProducer.emit("post.deleted", { postId });
    this.logger.log("Post deleted successfully", { postId });
    return post;
  }

  async getByUser(userId: string, page = 1, limit = 10, user: any) {
    this.logger.log("Getting posts by user", { userId, page, limit });

    // Convert userId to ObjectId safely
    let userIdObj;
    try {
      userIdObj = new mongoose.Types.ObjectId(userId);
    } catch (error) {
      this.logger.error("Invalid userId format", error.stack, {
        userId,
        error: error.message,
      });
      throw new BadRequestException("Invalid user ID format");
    }

    const query = {
      UserId: userIdObj,
      deleted: false,
      moderated: false,
    };

    const posts = await this.postModel
      .find(query)
      .skip((page - 1) * limit)
      .limit(limit)
      .sort({ createdAt: -1 });

    const total = await this.postModel.countDocuments(query);

    // Get interaction counts for all posts
    const postsWithCounts = await Promise.all(
      posts.map(async (post) => {
        const postObj = post.toObject();
        const interactionCounts = await this.getPostInteractionCounts(
          post._id.toString()
        );
        return {
          ...postObj,
          reactionCount: interactionCounts.reactionCount,
          commentCount: interactionCounts.commentCount,
        };
      })
    );

    this.logger.log("Retrieved user posts", {
      userId,
      count: posts.length,
      total,
    });

    return { posts: postsWithCounts, total };
  }

  async getFeed(userId: any, page = 1, limit = 10) {
    try {
      if (!userId) {
        throw new BadRequestException("UserId must be provided");
      }

      const userIdStr = userId.toString();
      this.logger.log("Getting user feed", { userId: userIdStr, page, limit });

      // Get following and followers
      const [followingResponse, followersResponse] = await Promise.all([
        this.grpcUserService.getFollowing(userIdStr),
        this.grpcUserService.getFollowers(userIdStr),
      ]);

      // Ensure we have arrays, even if empty
      const following = Array.isArray(followingResponse)
        ? followingResponse
        : [];
      const followers = Array.isArray(followersResponse)
        ? followersResponse
        : [];

      this.logger.debug("Following and followers", { following, followers });

      const ids = [userIdStr, ...following, ...followers];
      this.logger.debug("User IDs for feed", { ids });

      const posts = await this.postModel
        .find({
          UserId: { $in: ids },
          deleted: false,
          moderated: false,
          $or: [
            { visibility: "public" },
            { visibility: "private", UserId: { $in: followers } },
          ],
        })
        .skip((page - 1) * limit)
        .limit(limit)
        .sort({ createdAt: -1 });

      // Get interaction counts for all posts
      const postsWithCounts = await Promise.all(
        posts.map(async (post) => {
          const postObj = post.toObject();
          const interactionCounts = await this.getPostInteractionCounts(
            post._id.toString()
          );
          return {
            ...postObj,
            reactionCount: interactionCounts.reactionCount,
            commentCount: interactionCounts.commentCount,
          };
        })
      );

      const total = await this.postModel.countDocuments({
        UserId: { $in: ids },
        deleted: false,
        moderated: false,
        $or: [
          { visibility: "public" },
          { visibility: "private", UserId: { $in: followers } },
        ],
      });

      this.logger.log("Retrieved user feed", {
        userId: userIdStr,
        count: posts.length,
        total,
      });

      return { posts: postsWithCounts, total };
    } catch (error) {
      this.logger.error("Error getting user feed", error.stack, {
        userId,
        page,
        limit,
        error: error.message,
      });
      throw error;
    }
  }

  async search(q: string, page = 1, limit = 10, user: any) {
    this.logger.log("Searching posts", {
      query: q,
      userId: user.id,
      page,
      limit,
    });
    const regex = new RegExp(q, "i");
    const posts = await this.postModel
      .find({
        keywords: regex,
        deleted: false,
        moderated: false,
        $or: [
          { visibility: "public" },
          { visibility: "private", userId: user.id },
        ],
      })
      .skip((page - 1) * limit)
      .limit(limit)
      .sort({ createdAt: -1 });

    // Get interaction counts and signed URLs for all posts
    const postsWithCountsAndUrls = await Promise.all(
      posts.map(async (post) => {
        const postObj = post.toObject();
        const [interactionCounts, signedUrls] = await Promise.all([
          this.getPostInteractionCounts(post._id.toString()),
          post.media && post.media.length > 0
            ? this.grpcMediaService.getSignedUploadUrls(post.media)
            : { urls: [] },
        ]);

        return {
          ...postObj,
          reactionCount: interactionCounts.reactionCount,
          commentCount: interactionCounts.commentCount,
          signedMediaUrls: signedUrls.urls,
        };
      })
    );

    const total = await this.postModel.countDocuments({
      keywords: regex,
      deleted: false,
      moderated: false,
      $or: [
        { visibility: "public" },
        { visibility: "private", userId: user.id },
      ],
    });

    this.logger.log("Search completed", {
      query: q,
      count: posts.length,
      total,
    });
    return { posts: postsWithCountsAndUrls, total };
  }

  async validatePost(postId: string) {
    this.logger.log("Validating post", { postId });
    try {
      const post = await this.postModel.findById(postId);
      if (!post || post.deleted || post.moderated) {
        this.logger.warn("Post not found or unavailable", { postId });
        return {
          exists: false,
          userId: "",
        };
      }
      return {
        exists: true,
        userId: post.UserId,
      };
    } catch (error) {
      this.logger.error("Error validating post", error.stack, {
        postId,
        error: error.message,
      });
      return {
        exists: false,
        userId: "",
      };
    }
  }

  async getAllPosts() {
    this.logger.log("Getting all posts");
    const posts = await this.postModel
      .find({ deleted: false })
      .sort({ createdAt: -1 });
    return { posts };
  }

  async getReportedPosts() {
    this.logger.log("Getting reported posts");
    const posts = await this.postModel
      .find({ isReported: true, deleted: false })
      .sort({ createdAt: -1 });
    return { posts };
  }

  async flagPost(postId: string, reason: string) {
    this.logger.log("Flagging post", { postId, reason });
    const post = await this.postModel.findById(postId);
    if (!post || post.deleted) {
      this.logger.warn("Post not found or already deleted", { postId });
      throw new NotFoundException("Post not found");
    }
    post.isReported = true;
    post.reportReason = reason;
    await post.save();
    const UserId = post.UserId.toString();
    // await this.kafkaProducer.emit("post.flagged", { postId, reason });

    // Notify post owner about the report
    await this.grpcNotificationService.sendPostNotification(
      UserId,
      "POST_REPORTED",
      "Your Post Has Been Reported",
      "Your post has been reported for review",
      {
        postId: post._id.toString(),
        reason,
      }
    );

    this.logger.log("Post flagged successfully", { postId });
    return {
      message: "Post flagged successfully",
      success: true,
    };
  }

  async adminDeletePost(postId: string) {
    this.logger.log("Admin deleting post", { postId });
    const post = await this.postModel.findById(postId);
    if (!post || post.deleted) {
      this.logger.warn("Post not found or already deleted", { postId });
      throw new NotFoundException("Post not found");
    }
    post.deleted = true;
    await post.save();
    if (post.media.length) {
      this.logger.log("Deleting associated media files", { files: post.media });
      await this.grpcMediaService.deleteMedia(post.media);
    }
    const UserId = post.UserId.toString();
    // await this.kafkaProducer.emit("post.deleted", { postId });

    // Notify post owner about deletion
    await this.grpcNotificationService.sendPostNotification(
      UserId,
      "POST_DELETED",
      "Your Post Has Been Deleted",
      "Your post has been deleted by an administrator",
      {
        postId: post._id.toString(),
      }
    );

    this.logger.log("Post deleted by admin", { postId });
    return {
      message: "Post deleted successfully",
      success: true,
    };
  }

  async getPostInteractionCounts(postId: string) {
    this.logger.log("Getting post interaction counts", { postId });
    try {
      const post = await this.postModel.findById(postId);
      if (!post || post.deleted || post.moderated) {
        this.logger.warn("Post not found or unavailable", { postId });
        return {
          reactionCount: 0,
          commentCount: 0,
        };
      }

      // Make gRPC call to interaction service to get counts
      const result = await this.grpcService.getPostInteractionCounts(postId);
      return result;
    } catch (error) {
      this.logger.error("Error getting post interaction counts", error.stack, {
        postId,
        error: error.message,
      });
      return {
        reactionCount: 0,
        commentCount: 0,
      };
    }
  }
}
