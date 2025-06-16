import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  Inject,
  BadRequestException,
} from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import mongoose, { Model, Types } from "mongoose";
import {
  Post,
  PostDocument,
  PostVisibility,
  TaggedUserInfo,
  PaginatedResponse,
} from "./post.schema";
import { CreatePostDto } from "./dto/create-post.dto";
import { UpdatePostDto } from "./dto/update-post.dto";
import { GrpcUserService } from "./grpc/grpc-user.service";
import { GrpcMediaService } from "./grpc/grpc-media.service";
import { GrpcNotificationService } from "./grpc/grpc-notification.service";
import { CustomLogger } from "./logger/logger.service";
import { GrpcService } from "./grpc/grpc.service";
import { User, UserDocument } from "./user.schema";
import { SavedPost } from "./saved-post.schema";
import { ErrorMessages, SuccessMessages } from "./constants/error-messages";

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

@Injectable()
export class PostService {
  constructor(
    @InjectModel(Post.name) private readonly postModel: Model<Post>,
    @InjectModel(SavedPost.name)
    private readonly savedPostModel: Model<SavedPost>,
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

  async create(createPostDto: CreatePostDto, userId: string): Promise<Post> {
    this.logger.log("Creating post", { userId });

    try {
      const user = await this.grpcUserService.getUserNameById(userId);
      if (!user) {
        throw new NotFoundException(ErrorMessages.USER_NOT_FOUND);
      }

      // Extract keywords from content
      const keywords = this.extractKeywords(createPostDto.content);

      const post = new this.postModel({
        ...createPostDto,
        UserId: new Types.ObjectId(userId),
        username: user.username || "unknown",
        fullName: user.fullName || "Unknown User",
        keywords,
        media: createPostDto.mediaKeys || [], // Store mediaKeys directly in media field
      });

      // Handle tagged users
      if (createPostDto.taggedUsers && createPostDto.taggedUsers.length > 0) {
        // Validate user IDs
        const validUserIds = createPostDto.taggedUsers.filter((id) => {
          try {
            new Types.ObjectId(id);
            return true;
          } catch (error) {
            this.logger.warn(`Invalid user ID format: ${id}`);
            return false;
          }
        });

        if (validUserIds.length === 0) {
          this.logger.warn("No valid user IDs found in taggedUsers");
          post.taggedUsers = [];
          post.taggedUsersInfo = [];
        } else {
          const taggedUsersInfo = await Promise.all(
            validUserIds.map(async (taggedUserId) => {
              try {
                const taggedUser =
                  await this.grpcUserService.getUserNameById(taggedUserId);
                if (!taggedUser) {
                  this.logger.warn(`Tagged user not found: ${taggedUserId}`);
                  return null;
                }
                return {
                  userId: new Types.ObjectId(taggedUserId),
                  username: taggedUser.username || "unknown",
                  fullName: taggedUser.fullName || "Unknown User",
                };
              } catch (error) {
                this.logger.error(
                  `Error fetching tagged user info: ${taggedUserId}`,
                  error.stack
                );
                return null;
              }
            })
          );

          // Filter out null values from failed user lookups
          const validTaggedUsersInfo = taggedUsersInfo.filter(
            (info) => info !== null
          );

          post.taggedUsers = validTaggedUsersInfo.map((info) => info.userId);
          post.taggedUsersInfo = validTaggedUsersInfo;
        }
      }

      await post.save();
      return post;
    } catch (error) {
      this.logger.error("Error creating post", error.stack);
      throw error;
    }
  }

  private extractKeywords(content: string): string[] {
    // Remove special characters and convert to lowercase
    const cleanContent = content.toLowerCase().replace(/[^\w\s]/g, "");

    // Split into words
    const words = cleanContent.split(/\s+/);

    // Remove common words (stop words)
    const stopWords = new Set([
      "a",
      "an",
      "the",
      "and",
      "or",
      "but",
      "in",
      "on",
      "at",
      "to",
      "for",
      "with",
      "by",
      "about",
      "like",
      "through",
      "over",
      "before",
      "between",
      "after",
      "since",
      "without",
      "under",
      "within",
      "along",
      "following",
      "across",
      "behind",
      "beyond",
      "plus",
      "except",
      "but",
      "up",
      "out",
      "around",
      "down",
      "off",
      "above",
      "near",
    ]);

    // Filter out stop words and short words
    const keywords = words.filter(
      (word) => word.length > 2 && !stopWords.has(word)
    );

    // Remove duplicates
    return [...new Set(keywords)];
  }

  async get(postId: string, userid: any) {
    this.logger.log("Getting post", { postId, userId: userid });
    const post = await this.postModel.findById(postId);
    if (!post || post.deleted || post.moderated) {
      this.logger.warn("Post not found or unavailable", { postId });
      throw new NotFoundException("Post not found");
    }

    // Check post visibility
    const postUserId = post.UserId.toString();
    const currentUserId = userid.toString();

    // If post is private, check if user has access
    if (post.visibility === PostVisibility.PRIVATE) {
      // Allow access if user is the post owner
      if (postUserId === currentUserId) {
        this.logger.debug("User accessing their own private post", {
          postId,
          userId: currentUserId,
        });
      } else {
        // Check if user is a follower of the post owner
        const postOwner = await this.userModel.findById(postUserId);
        if (!postOwner || !postOwner.followers.includes(currentUserId)) {
          this.logger.warn("Unauthorized access to private post", {
            postId,
            userId: currentUserId,
            postOwnerId: postUserId,
          });
          throw new ForbiddenException("You don't have access to this post");
        }
        this.logger.debug("Follower accessing private post", {
          postId,
          userId: currentUserId,
        });
      }
    }

    // Get interaction counts
    const interactionCounts = await this.getPostInteractionCounts(
      postId,
      userid
    );

    // Add interaction counts to the post response
    const postResponse = post.toObject();
    return {
      ...postResponse,
      reactionCount: interactionCounts.reactionCount,
      commentCount: interactionCounts.commentCount,
      isLiked: interactionCounts.isLiked,
    };
  }

  async update(
    postId: string,
    updatePostDto: UpdatePostDto,
    userId: string
  ): Promise<Post> {
    this.logger.log("Updating post", { postId, userId });

    const post = await this.postModel.findById(postId);
    if (!post) {
      throw new NotFoundException(ErrorMessages.POST_NOT_FOUND);
    }

    if (post.UserId.toString() !== userId) {
      throw new BadRequestException(ErrorMessages.NOT_POST_OWNER);
    }

    if (post.deleted) {
      throw new BadRequestException(ErrorMessages.POST_NOT_AVAILABLE);
    }

    const updateData: any = { ...updatePostDto };

    // Handle tagged users update
    if (updatePostDto.taggedUsers && updatePostDto.taggedUsers.length > 0) {
      const taggedUsersInfo = await Promise.all(
        updatePostDto.taggedUsers.map(async (taggedUserId: string) => {
          const taggedUser =
            await this.grpcUserService.getUserNameById(taggedUserId);
          if (!taggedUser) {
            throw new NotFoundException(ErrorMessages.USER_NOT_FOUND);
          }
          return {
            userId: new Types.ObjectId(taggedUserId),
            username: taggedUser.username || "unknown",
            fullName: taggedUser.fullName || "Unknown User",
          };
        })
      );

      updateData.taggedUsers = updatePostDto.taggedUsers.map(
        (id) => new Types.ObjectId(id)
      );
      updateData.taggedUsersInfo = taggedUsersInfo;
    }

    const updatedPost = await this.postModel.findByIdAndUpdate(
      postId,
      { $set: updateData },
      { new: true }
    );

    if (!updatedPost) {
      throw new NotFoundException(ErrorMessages.POST_NOT_FOUND);
    }

    return updatedPost;
  }

  async deletePost(postId: string, userId: string): Promise<void> {
    this.logger.log("Deleting post", { postId, userId });

    const post = await this.postModel.findById(postId);
    if (!post) {
      throw new NotFoundException(ErrorMessages.POST_NOT_FOUND);
    }

    if (post.UserId.toString() !== userId) {
      throw new BadRequestException(ErrorMessages.NOT_POST_OWNER);
    }

    post.deleted = true;
    await post.save();
  }

  async getByUser(
    userId: string,
    page = 1,
    limit = 10,
    userid: any
  ): Promise<PaginatedResponse<any>> {
    this.logger.log("Getting posts by user", { userId, page, limit });

    const query = {
      UserId: new Types.ObjectId(userId),
      deleted: false,
      moderated: false,
    };

    const [posts, total] = await Promise.all([
      this.postModel
        .find(query)
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit),
      this.postModel.countDocuments(query),
    ]);

    // Get interaction counts for all posts
    const postsWithCounts = await Promise.all(
      posts.map(async (post) => {
        const postObj = post.toObject();
        const interactionCounts = await this.getPostInteractionCounts(
          post._id.toString(),
          userid
        );
        return {
          ...postObj,
          reactionCount: interactionCounts.reactionCount,
          commentCount: interactionCounts.commentCount,
          isLiked: interactionCounts.isLiked,
        };
      })
    );

    const totalPages = Math.ceil(total / limit);

    return {
      data: postsWithCounts,
      total,
      page,
      limit,
      totalPages,
      hasNextPage: page < totalPages,
      hasPreviousPage: page > 1,
    };
  }

  async getFeed(
    userId: any,
    page = 1,
    limit = 10
  ): Promise<PaginatedResponse<any>> {
    this.logger.log("Getting user feed", { userId, page, limit });

    // Get user's following list
    const following = await this.grpcUserService.getFollowing(
      userId.toString()
    );
    following.push(userId.toString()); // Include user's own posts

    const query = {
      UserId: { $in: following.map((id: string) => new Types.ObjectId(id)) },
      deleted: false,
      moderated: false,
    };

    const [posts, total] = await Promise.all([
      this.postModel
        .find(query)
        .skip((page - 1) * limit)
        .limit(limit)
        .sort({ createdAt: -1 }),
      this.postModel.countDocuments(query),
    ]);

    // Get interaction counts for all posts
    const postsWithCounts = await Promise.all(
      posts.map(async (post) => {
        const postObj = post.toObject();
        const interactionCounts = await this.getPostInteractionCounts(
          post._id.toString(),
          userId
        );
        return {
          ...postObj,
          reactionCount: interactionCounts.reactionCount,
          commentCount: interactionCounts.commentCount,
          isLiked: interactionCounts.isLiked,
        };
      })
    );

    const totalPages = Math.ceil(total / limit);

    return {
      data: postsWithCounts,
      total,
      page,
      limit,
      totalPages,
      hasNextPage: page < totalPages,
      hasPreviousPage: page > 1,
    };
  }

  async search(
    q: string,
    page = 1,
    limit = 10,
    userId: any
  ): Promise<PaginatedResponse<any>> {
    this.logger.log("Searching posts", { query: q, page, limit });

    const query = {
      $and: [
        {
          $or: [
            { keywords: { $regex: q, $options: "i" } },
            { location: { $regex: q, $options: "i" } },
          ],
        },
        { deleted: false },
        { moderated: false },
      ],
    };

    const [posts, total] = await Promise.all([
      this.postModel
        .find(query)
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit),
      this.postModel.countDocuments(query),
    ]);

    // Get interaction counts for all posts
    const postsWithCounts = await Promise.all(
      posts.map(async (post) => {
        const postObj = post.toObject();
        const interactionCounts = await this.getPostInteractionCounts(
          post._id.toString(),
          userId
        );
        return {
          ...postObj,
          reactionCount: interactionCounts.reactionCount,
          commentCount: interactionCounts.commentCount,
          isLiked: interactionCounts.isLiked,
        };
      })
    );

    const totalPages = Math.ceil(total / limit);

    return {
      data: postsWithCounts,
      total,
      page,
      limit,
      totalPages,
      hasNextPage: page < totalPages,
      hasPreviousPage: page > 1,
    };
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

  async getAllPosts(
    page?: number,
    limit?: number,
    userId?: string
  ): Promise<PaginatedResponse<any>> {
    this.logger.log("Getting all posts", { page, limit });

    const query = this.postModel.find({
      deleted: false,
      moderated: false,
    });

    // Only apply pagination if both page and limit are provided
    if (page !== undefined && limit !== undefined) {
      query.skip((page - 1) * limit).limit(limit);
    }

    const [posts, total] = await Promise.all([
      query.sort({ createdAt: -1 }).exec(),
      this.postModel.countDocuments({ deleted: false, moderated: false }),
    ]);

    // Get interaction counts for all posts
    const postsWithCounts = await Promise.all(
      posts.map(async (post) => {
        const postObj = post.toObject();
        const interactionCounts = await this.getPostInteractionCounts(
          post._id.toString(),
          userId || ""
        );
        return {
          ...postObj,
          reactionCount: interactionCounts.reactionCount,
          commentCount: interactionCounts.commentCount,
          isLiked: interactionCounts.isLiked,
        };
      })
    );

    const totalPages = Math.ceil(total / (limit || total));

    return {
      data: postsWithCounts,
      total,
      page: page || 1,
      limit: limit || total,
      totalPages,
      hasNextPage: page ? page < totalPages : false,
      hasPreviousPage: page ? page > 1 : false,
    };
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

  async getPostInteractionCounts(postId: string, userId: string) {
    this.logger.log("Getting post interaction counts", { postId });
    try {
      const post = await this.postModel.findById(postId);
      if (!post || post.deleted || post.moderated) {
        this.logger.warn("Post not found or unavailable", { postId });
        return {
          reactionCount: 0,
          commentCount: 0,
          isLiked: false,
        };
      }

      // Make gRPC call to interaction service to get counts
      const result = await this.grpcService.getPostInteractionCounts(
        postId,
        userId
      );
      return result;
    } catch (error) {
      this.logger.error("Error getting post interaction counts", error.stack, {
        postId,
        error: error.message,
      });
      return {
        reactionCount: 0,
        commentCount: 0,
        isLiked: false,
      };
    }
  }

  async reportPost(
    postId: string,
    userId: string,
    reason: string
  ): Promise<void> {
    this.logger.log("Reporting post", { postId, userId, reason });

    const post = await this.postModel.findById(postId);
    if (!post) {
      throw new NotFoundException(ErrorMessages.POST_NOT_FOUND);
    }

    if (post.deleted) {
      throw new BadRequestException(ErrorMessages.POST_NOT_AVAILABLE);
    }

    const hasReported = post.reportHistory.some(
      (report) => report.userId.toString() === userId
    );

    if (hasReported) {
      throw new BadRequestException(ErrorMessages.USER_ALREADY_REPORTED);
    }

    post.reportHistory.push({
      userId: new Types.ObjectId(userId),
      reason,
      createdAt: new Date(),
    });

    post.reportCount += 1;
    post.isReported = true;
    post.reportReason = reason;

    await post.save();
  }

  async unreportPost(postId: string, userId: string): Promise<void> {
    this.logger.log("Unreporting post", { postId, userId });

    const post = await this.postModel.findById(postId);
    if (!post) {
      throw new NotFoundException(ErrorMessages.POST_NOT_FOUND);
    }

    const reportIndex = post.reportHistory.findIndex(
      (report) => report.userId.toString() === userId
    );

    if (reportIndex === -1) {
      throw new BadRequestException(ErrorMessages.USER_NOT_REPORTED);
    }

    post.reportHistory.splice(reportIndex, 1);
    post.reportCount -= 1;

    if (post.reportCount === 0) {
      post.isReported = false;
      post.reportReason = null;
    }

    await post.save();
  }

  async moderatePost(
    postId: string,
    moderatorId: string,
    reason: string
  ): Promise<void> {
    this.logger.log("Moderating post", { postId, moderatorId, reason });

    const post = await this.postModel.findById(postId);
    if (!post) {
      throw new NotFoundException(ErrorMessages.POST_NOT_FOUND);
    }

    post.moderated = true;
    post.reportReason = reason;
    await post.save();
  }

  async unmoderatePost(postId: string, moderatorId: string): Promise<void> {
    this.logger.log("Unmoderating post", { postId, moderatorId });

    const post = await this.postModel.findById(postId);
    if (!post) {
      throw new NotFoundException(ErrorMessages.POST_NOT_FOUND);
    }

    post.moderated = false;
    post.reportReason = null;
    await post.save();
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
          post._id.toString(),
          userId
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

  async getSavedPosts(
    userId: string,
    page: number = 1,
    limit: number = 10
  ): Promise<PaginatedResponse<any>> {
    this.logger.log("Getting saved posts", { userId, page, limit });

    const [savedPosts, total] = await Promise.all([
      this.savedPostModel
        .find({ userId: new Types.ObjectId(userId) })
        .sort({ savedAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .populate({
          path: "postId",
          match: { deleted: false, moderated: false },
        }),
      this.savedPostModel.countDocuments({
        userId: new Types.ObjectId(userId),
      }),
    ]);

    // Filter out null posts (deleted or moderated)
    const validSavedPosts = savedPosts.filter((sp) => sp.postId);

    // Get interaction counts for all posts
    const postsWithCounts = await Promise.all(
      validSavedPosts.map(async (savedPost) => {
        const post = savedPost.postId as any;
        const postObj = post.toObject();
        const interactionCounts = await this.getPostInteractionCounts(
          post._id.toString(),
          userId
        );
        return {
          ...postObj,
          reactionCount: interactionCounts.reactionCount,
          commentCount: interactionCounts.commentCount,
          isLiked: interactionCounts.isLiked,
          savedAt: savedPost.savedAt,
        };
      })
    );

    const totalPages = Math.ceil(total / limit);

    return {
      data: postsWithCounts,
      total,
      page,
      limit,
      totalPages,
      hasNextPage: page < totalPages,
      hasPreviousPage: page > 1,
    };
  }

  async savePost(userId: string, postId: string): Promise<void> {
    this.logger.log("Saving post", { userId, postId });

    const post = await this.postModel.findById(postId);
    if (!post) {
      throw new NotFoundException(ErrorMessages.POST_NOT_FOUND);
    }

    try {
      await this.savedPostModel.create({
        userId: new Types.ObjectId(userId),
        postId: new Types.ObjectId(postId),
      });
    } catch (error) {
      if (error.code === 11000) {
        // Duplicate key error - post is already saved
        return;
      }
      throw error;
    }
  }

  async unsavePost(userId: string, postId: string): Promise<void> {
    this.logger.log("Unsaving post", { userId, postId });

    await this.savedPostModel.deleteOne({
      userId: new Types.ObjectId(userId),
      postId: new Types.ObjectId(postId),
    });
  }

  async isPostSaved(userId: string, postId: string): Promise<boolean> {
    const savedPost = await this.savedPostModel.findOne({
      userId: new Types.ObjectId(userId),
      postId: new Types.ObjectId(postId),
    });
    return !!savedPost;
  }
}
