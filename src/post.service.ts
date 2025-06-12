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
import { User, UserDocument } from "./user.schema";

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
    @InjectModel(User.name) private userModel: Model<UserDocument>,
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

    // Validate tagged users if provided
    if (dto.taggedUsers && dto.taggedUsers.length > 0) {
      // Convert string IDs to ObjectIds
      const taggedUserIds = dto.taggedUsers
        .map((id) => {
          try {
            return new Types.ObjectId(id);
          } catch (error) {
            this.logger.warn("Invalid tagged user ID format", { userId: id });
            return null;
          }
        })
        .filter((id): id is Types.ObjectId => id !== null);

      // Verify all tagged users exist
      const validUsers = await Promise.all(
        taggedUserIds.map(async (taggedId) => {
          try {
            const user = await this.grpcUserService.getUser(
              taggedId.toString()
            );
            return user.exists ? taggedId : null;
          } catch (error) {
            this.logger.warn("Invalid tagged user", {
              userId: taggedId.toString(),
            });
            return null;
          }
        })
      );

      // Filter out invalid users
      const validTaggedUsers = validUsers.filter(
        (id): id is Types.ObjectId => id !== null
      );

      if (validTaggedUsers.length !== dto.taggedUsers.length) {
        this.logger.warn("Some tagged users are invalid", {
          provided: dto.taggedUsers.length,
          valid: validTaggedUsers.length,
        });
      }

      // Notify tagged users
      await Promise.all(
        validTaggedUsers.map((taggedId) =>
          this.grpcNotificationService.sendPostNotification(
            taggedId.toString(),
            "POST_TAG",
            "You were tagged in a post",
            "Someone tagged you in their post",
            {
              postId: "", // Will be updated after post creation
              taggedBy: userId,
            }
          )
        )
      );
    }

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
        UserId: new Types.ObjectId(userId.toString()),
        keywords: dto.content.split(" "),
        media: fileKeys,
        signedMediaUrls: publicUrls,
        taggedUsers: dto.taggedUsers
          ? dto.taggedUsers.map((id) => new Types.ObjectId(id))
          : [],
      };

      const created = await this.postModel.create(postData);
      this.logger.log("Post created successfully", { postId: created._id });

      // Update notifications with post ID
      if (dto.taggedUsers && dto.taggedUsers.length > 0) {
        await Promise.all(
          dto.taggedUsers.map((taggedId) =>
            this.grpcNotificationService.sendPostNotification(
              taggedId,
              "POST_TAG",
              "You were tagged in a post",
              "Someone tagged you in their post",
              {
                postId: created._id.toString(),
                taggedBy: userId,
              }
            )
          )
        );
      }

      return {
        post: created,
        signedUrls: signedUrls.urls,
      };
    } else {
      // Create post without media
      const postData = {
        content: dto.content,
        visibility: dto.visibility,
        UserId: new Types.ObjectId(userId.toString()),
        keywords: dto.content.split(" "),
        media: [],
        signedMediaUrls: [],
        taggedUsers: dto.taggedUsers
          ? dto.taggedUsers.map((id) => new Types.ObjectId(id))
          : [],
      };

      const created = await this.postModel.create(postData);
      this.logger.log("Post created successfully", { postId: created._id });

      // Update notifications with post ID
      if (dto.taggedUsers && dto.taggedUsers.length > 0) {
        await Promise.all(
          dto.taggedUsers.map((taggedId) =>
            this.grpcNotificationService.sendPostNotification(
              taggedId,
              "POST_TAG",
              "You were tagged in a post",
              "Someone tagged you in their post",
              {
                postId: created._id.toString(),
                taggedBy: userId,
              }
            )
          )
        );
      }

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

      // Get user's following and followers directly from user schema
      const user = await this.userModel.findById(userIdStr);
      if (!user) {
        throw new NotFoundException(`User with id ${userIdStr} not found`);
      }

      const following = user.following || [];
      const followers = user.followers || [];

      this.logger.debug("User network details", {
        userId: userIdStr,
        followingCount: following.length,
        followingIds: following,
        followersCount: followers.length,
        followersIds: followers,
      });

      // Convert string IDs to ObjectIds
      const userIdObj = new Types.ObjectId(userIdStr);
      const followingObjIds = following
        .map((id: string) => {
          try {
            return new Types.ObjectId(id);
          } catch (error) {
            this.logger.error(
              `Failed to convert following ID to ObjectId: ${id}`,
              error
            );
            return null;
          }
        })
        .filter(Boolean);

      const followersObjIds = followers
        .map((id: string) => {
          try {
            return new Types.ObjectId(id);
          } catch (error) {
            this.logger.error(
              `Failed to convert follower ID to ObjectId: ${id}`,
              error
            );
            return null;
          }
        })
        .filter(Boolean);

      const allUserIds = [userIdObj, ...followingObjIds, ...followersObjIds];

      this.logger.debug("Combined user IDs for feed query", {
        totalIds: allUserIds.length,
        userIds: allUserIds
          .filter((id): id is Types.ObjectId => id !== null)
          .map((id) => id.toString()),
      });

      const query = {
        UserId: { $in: allUserIds },
        deleted: false,
        moderated: false,
        $or: [
          { visibility: "public" },
          { visibility: "private", UserId: { $in: followersObjIds } },
          { UserId: userIdObj }, // Always show user's own posts
        ],
      };

      this.logger.debug("Executing feed query", {
        query: JSON.stringify(query, null, 2),
      });

      const posts = await this.postModel
        .find(query)
        .skip((page - 1) * limit)
        .limit(limit)
        .sort({ createdAt: -1 });

      this.logger.debug("Found posts", {
        count: posts.length,
        postIds: posts.map((post) => post._id.toString()),
      });

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

      const total = await this.postModel.countDocuments(query);

      this.logger.debug("Feed query results", {
        userId: userIdStr,
        postsFound: posts.length,
        totalPosts: total,
        page,
        limit,
        postIds: posts.map((post) => post._id.toString()),
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

  async getAllPosts(page?: number, limit?: number) {
    try {
      this.logger.log("Getting all posts", { page, limit });

      const query = this.postModel
        .find({ deleted: false })
        .sort({ createdAt: -1 });

      // Only apply pagination if both page and limit are provided
      if (page !== undefined && limit !== undefined) {
        query.skip((page - 1) * limit).limit(limit);
      }

      const posts = await query.exec();

      // Get interaction counts for all posts
      const postsWithCounts = await Promise.all(
        posts.map(async (post) => {
          try {
            const postObj = post.toObject();
            const interactionCounts = await this.getPostInteractionCounts(
              post._id.toString()
            );
            return {
              ...postObj,
              reactionCount: interactionCounts.reactionCount,
              commentCount: interactionCounts.commentCount,
            };
          } catch (error) {
            this.logger.error(
              `Error getting interaction counts for post ${post._id}: ${error.message}`
            );
            // Return post without interaction counts if there's an error
            return {
              ...post.toObject(),
              reactionCount: 0,
              commentCount: 0,
            };
          }
        })
      );

      this.logger.log("Retrieved all posts", {
        count: posts.length,
      });

      return { posts: postsWithCounts };
    } catch (error) {
      this.logger.error(`Error in getAllPosts: ${error.message}`);
      throw error;
    }
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

  async reportPost(postId: string, userId: string, reason: string) {
    this.logger.log("Reporting post", { postId, userId, reason });

    const post = await this.postModel.findById(postId);
    if (!post || post.deleted) {
      this.logger.warn("Post not found or already deleted", { postId });
      throw new NotFoundException("Post not found");
    }

    // Check if user has already reported this post
    const hasReported = post.reportHistory.some(
      (report) => report.userId.toString() === userId
    );

    if (hasReported) {
      throw new BadRequestException("You have already reported this post");
    }

    // Add report to history
    post.reportHistory.push({
      userId: new Types.ObjectId(userId),
      reason,
      createdAt: new Date(),
    });

    // Update report count
    post.reportCount += 1;
    post.isReported = true;
    post.reportReason = reason; // Keep the latest reason

    await post.save();

    // Notify post owner about the report
    const postOwnerId = post.UserId.toString();
    await this.grpcNotificationService.sendPostNotification(
      postOwnerId,
      "POST_REPORTED",
      "Your Post Has Been Reported",
      "Your post has been reported for review",
      {
        postId: post._id.toString(),
        reason,
        reportCount: post.reportCount.toString(),
      }
    );

    this.logger.log("Post reported successfully", {
      postId,
      userId,
      reportCount: post.reportCount,
    });

    return {
      message: "Post reported successfully",
      success: true,
      reportCount: post.reportCount,
    };
  }

  async getTaggedPosts(userId: string, page = 1, limit = 10) {
    this.logger.log("Getting posts where user is tagged", {
      userId,
      page,
      limit,
    });

    const posts = await this.postModel
      .find({
        taggedUsers: new Types.ObjectId(userId),
        deleted: false,
        moderated: false,
      })
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit);

    // Get interaction counts and signed URLs for all posts
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
      taggedUsers: new Types.ObjectId(userId),
      deleted: false,
      moderated: false,
    });

    this.logger.log("Retrieved tagged posts", {
      userId,
      count: posts.length,
      total,
      page,
      limit,
    });

    return {
      posts: postsWithCounts,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }
}
