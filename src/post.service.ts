import { Injectable, NotFoundException, ForbiddenException, Inject } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Post, PostDocument } from './post.schema';
import { CreatePostDto } from './dto/create-post.dto';
import { UpdatePostDto } from './dto/update-post.dto';
import { KafkaProducerService } from './kafka-producer.service';
import { GrpcUserService } from './grpc/grpc-user.service';
import { GrpcMediaService } from './grpc/grpc-media.service';
import { GrpcInteractionService } from './grpc/grpc-interaction.service';
import { GrpcNotificationService } from './grpc/grpc-notification.service';
import { CustomLogger } from './logger/logger.service';

@Injectable()
export class PostService {
  constructor(
    @InjectModel(Post.name) private postModel: Model<PostDocument>,
    private readonly kafkaProducer: KafkaProducerService,
    private readonly grpcUserService: GrpcUserService,
    private readonly grpcMediaService: GrpcMediaService,
    private readonly grpcInteractionService: GrpcInteractionService,
    private readonly grpcNotificationService: GrpcNotificationService,
    private readonly logger: CustomLogger,
  ) {
    this.logger.setContext('PostService');
  }

  async create(dto: CreatePostDto, user: any) {
    this.logger.log('Creating new post', { userId: dto.userId });
    await this.grpcUserService.validateUser(dto.userId);
    let mediaUrls = dto.media || [];
    if (mediaUrls.length) {
      this.logger.log('Getting signed URLs for media', { files: mediaUrls });
      await this.grpcMediaService.getSignedUploadUrls(mediaUrls);
    }
    const keywords = dto.content.split(' ');
    const created = await this.postModel.create({ ...dto, keywords });
    this.logger.log('Post created successfully', { postId: created._id });
    await this.kafkaProducer.emit('post.created', created);
    await this.grpcInteractionService.providePostDetails(created._id.toString());

    // Send notification to followers
    const followers = await this.grpcUserService.getFriends(dto.userId);
    for (const followerId of followers) {
      await this.grpcNotificationService.sendNotification(
        followerId,
        'NEW_POST',
        'New Post from User',
        `${user.name} created a new post`,
        {
          postId: created._id.toString(),
          userId: dto.userId,
        },
      );
    }

    return created;
  }

  async get(postId: string, user: any) {
    this.logger.log('Getting post', { postId, userId: user.id });
    const post = await this.postModel.findById(postId);
    if (!post || post.deleted || post.moderated) {
      this.logger.warn('Post not found or unavailable', { postId });
      throw new NotFoundException('Post not found');
    }
    return post;
  }

  async update(postId: string, dto: UpdatePostDto, user: any) {
    this.logger.log('Updating post', { postId, userId: user.id });
    const post = await this.postModel.findById(postId);
    if (!post || post.deleted || post.moderated) {
      this.logger.warn('Post not found or unavailable', { postId });
      throw new NotFoundException('Post not found');
    }
    if (post.userId !== user.id) {
      this.logger.warn('Unauthorized post update attempt', { postId, userId: user.id });
      throw new ForbiddenException('Not your post');
    }
    Object.assign(post, dto);
    if (dto.content) post.keywords = dto.content.split(' ');
    await post.save();
    this.logger.log('Post updated successfully', { postId });
    return post;
  }

  async delete(postId: string, user: any) {
    this.logger.log('Deleting post', { postId, userId: user.id });
    const post = await this.postModel.findById(postId);
    if (!post || post.deleted || post.moderated) {
      this.logger.warn('Post not found or unavailable', { postId });
      throw new NotFoundException('Post not found');
    }
    if (post.userId !== user.id) {
      this.logger.warn('Unauthorized post deletion attempt', { postId, userId: user.id });
      throw new ForbiddenException('Not your post');
    }
    post.deleted = true;
    await post.save();
    if (post.media.length) {
      this.logger.log('Deleting associated media files', { files: post.media });
      await this.grpcMediaService.deleteMedia(post.media);
    }
    await this.kafkaProducer.emit('post.deleted', { postId });
    this.logger.log('Post deleted successfully', { postId });
    return post;
  }

  async getByUser(userId: string, page = 1, limit = 10, user: any) {
    this.logger.log('Getting posts by user', { userId, page, limit });
    await this.grpcUserService.validateUser(userId);
    const query = { userId, deleted: false, moderated: false };
    const posts = await this.postModel
      .find(query)
      .skip((page - 1) * limit)
      .limit(limit)
      .sort({ createdAt: -1 });
    const total = await this.postModel.countDocuments(query);
    this.logger.log('Retrieved user posts', { userId, count: posts.length, total });
    return { posts, total };
  }

  async getFeed(user: any, page = 1, limit = 10) {
    this.logger.log('Getting user feed', { userId: user.id, page, limit });
    const friends = await this.grpcUserService.getFriends(user.id);
    const follows = await this.grpcUserService.getFollows(user.id);
    const ids = [user.id, ...friends, ...follows];
    const posts = await this.postModel
      .find({
        userId: { $in: ids },
        deleted: false,
        moderated: false,
        $or: [
          { visibility: 'public' },
          { visibility: 'private', userId: { $in: friends } },
        ],
      })
      .skip((page - 1) * limit)
      .limit(limit)
      .sort({ createdAt: -1 });
    const total = await this.postModel.countDocuments({
      userId: { $in: ids },
      deleted: false,
      moderated: false,
      $or: [
        { visibility: 'public' },
        { visibility: 'private', userId: { $in: friends } },
      ],
    });
    this.logger.log('Retrieved user feed', { userId: user.id, count: posts.length, total });
    return { posts, total };
  }

  async search(q: string, page = 1, limit = 10, user: any) {
    this.logger.log('Searching posts', { query: q, userId: user.id, page, limit });
    const regex = new RegExp(q, 'i');
    const posts = await this.postModel
      .find({
        keywords: regex,
        deleted: false,
        moderated: false,
        $or: [
          { visibility: 'public' },
          { visibility: 'private', userId: user.id },
        ],
      })
      .skip((page - 1) * limit)
      .limit(limit)
      .sort({ createdAt: -1 });
    const total = await this.postModel.countDocuments({
      keywords: regex,
      deleted: false,
      moderated: false,
      $or: [
        { visibility: 'public' },
        { visibility: 'private', userId: user.id },
      ],
    });
    this.logger.log('Search completed', { query: q, count: posts.length, total });
    return { posts, total };
  }

  async removePost(postId: string) {
    this.logger.log('Admin removing post', { postId });
    const post = await this.postModel.findById(postId);
    if (!post || post.deleted) {
      this.logger.warn('Post not found or already deleted', { postId });
      throw new NotFoundException('Post not found');
    }
    post.moderated = true;
    await post.save();
    await this.kafkaProducer.emit('post.moderated', { postId });
    this.logger.log('Post removed by admin', { postId });
    return post;
  }

  async validatePost(postId: string) {
    this.logger.log('Validating post', { postId });
    try {
      const post = await this.postModel.findById(postId);
      if (!post || post.deleted || post.moderated) {
        this.logger.warn('Post not found or unavailable', { postId });
        return {
          exists: false,
          userId: '',
        };
      }
      return {
        exists: true,
        userId: post.userId,
      };
    } catch (error) {
      this.logger.error('Error validating post', error.stack, { postId, error: error.message });
      return {
        exists: false,
        userId: '',
      };
    }
  }

  async getAllPosts() {
    this.logger.log('Getting all posts');
    const posts = await this.postModel.find({ deleted: false }).sort({ createdAt: -1 });
    return { posts };
  }

  async getReportedPosts() {
    this.logger.log('Getting reported posts');
    const posts = await this.postModel.find({ isReported: true, deleted: false }).sort({ createdAt: -1 });
    return { posts };
  }

  async flagPost(postId: string, reason: string) {
    this.logger.log('Flagging post', { postId, reason });
    const post = await this.postModel.findById(postId);
    if (!post || post.deleted) {
      this.logger.warn('Post not found or already deleted', { postId });
      throw new NotFoundException('Post not found');
    }
    post.isReported = true;
    post.reportReason = reason;
    await post.save();
    await this.kafkaProducer.emit('post.flagged', { postId, reason });

    // Notify post owner about the report
    await this.grpcNotificationService.sendNotification(
      post.userId,
      'POST_REPORTED',
      'Your Post Has Been Reported',
      'Your post has been reported for review',
      {
        postId: post._id.toString(),
        reason,
      },
    );

    this.logger.log('Post flagged successfully', { postId });
    return {
      message: 'Post flagged successfully',
      success: true,
    };
  }

  async adminDeletePost(postId: string) {
    this.logger.log('Admin deleting post', { postId });
    const post = await this.postModel.findById(postId);
    if (!post || post.deleted) {
      this.logger.warn('Post not found or already deleted', { postId });
      throw new NotFoundException('Post not found');
    }
    post.deleted = true;
    await post.save();
    if (post.media.length) {
      this.logger.log('Deleting associated media files', { files: post.media });
      await this.grpcMediaService.deleteMedia(post.media);
    }
    await this.kafkaProducer.emit('post.deleted', { postId });

    // Notify post owner about deletion
    await this.grpcNotificationService.sendNotification(
      post.userId,
      'POST_DELETED',
      'Your Post Has Been Deleted',
      'Your post has been deleted by an administrator',
      {
        postId: post._id.toString(),
      },
    );

    this.logger.log('Post deleted by admin', { postId });
    return {
      message: 'Post deleted successfully',
      success: true,
    };
  }
} 