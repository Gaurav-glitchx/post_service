import {
  Controller,
  Get,
  Post as HttpPost,
  Put,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  Req,
} from '@nestjs/common';
import { Request } from 'express';
import { ApiTags, ApiBearerAuth, ApiOperation, ApiResponse, ApiQuery } from '@nestjs/swagger';
import { PostService } from './post.service';
import { CreatePostDto } from './dto/create-post.dto';
import { UpdatePostDto } from './dto/update-post.dto';
import { PostIdDto } from './dto/post-id.dto';
import { AuthGuard } from './auth.guard';

interface RequestWithUser extends Request {
  user: any;
}

@ApiTags('posts')
@ApiBearerAuth()
@Controller('posts')
@UseGuards(AuthGuard)
export class PostController {
  constructor(private readonly postService: PostService) {}

  @ApiOperation({ summary: 'Create a post' })
  @ApiResponse({ status: 201, description: 'Post created' })
  @HttpPost()
  async create(@Body() dto: CreatePostDto, @Req() req: RequestWithUser) {
    return this.postService.create(dto, req.user);
  }

  @ApiOperation({ summary: 'Get a post by ID' })
  @ApiResponse({ status: 200, description: 'Post found' })
  @Get(':postId')
  async get(@Param() params: PostIdDto, @Req() req: RequestWithUser) {
    return this.postService.get(params.postId, req.user);
  }

  @ApiOperation({ summary: 'Update a post' })
  @ApiResponse({ status: 200, description: 'Post updated' })
  @Put(':postId')
  async update(@Param() params: PostIdDto, @Body() dto: UpdatePostDto, @Req() req: RequestWithUser) {
    return this.postService.update(params.postId, dto, req.user);
  }

  @ApiOperation({ summary: 'Delete a post' })
  @ApiResponse({ status: 200, description: 'Post deleted' })
  @Delete(':postId')
  async delete(@Param() params: PostIdDto, @Req() req: RequestWithUser) {
    return this.postService.delete(params.postId, req.user);
  }

  @ApiOperation({ summary: 'Get all posts by user' })
  @ApiQuery({ name: 'userId', required: true })
  @ApiQuery({ name: 'page', required: false })
  @ApiQuery({ name: 'limit', required: false })
  @Get('user/:userId')
  async getByUser(
    @Param('userId') userId: string,
    @Query('page') page = 1,
    @Query('limit') limit = 10,
    @Req() req: RequestWithUser,
  ) {
    return this.postService.getByUser(userId, Number(page), Number(limit), req.user);
  }

  @ApiOperation({ summary: 'Get feed' })
  @ApiQuery({ name: 'page', required: false })
  @ApiQuery({ name: 'limit', required: false })
  @Get('feed')
  async getFeed(@Query('page') page = 1, @Query('limit') limit = 10, @Req() req: RequestWithUser) {
    return this.postService.getFeed(req.user, Number(page), Number(limit));
  }

  @ApiOperation({ summary: 'Search posts by keyword' })
  @ApiQuery({ name: 'q', required: true })
  @ApiQuery({ name: 'page', required: false })
  @ApiQuery({ name: 'limit', required: false })
  @Get('search')
  async search(
    @Query('q') q: string,
    @Query('page') page = 1,
    @Query('limit') limit = 10,
    @Req() req: RequestWithUser,
  ) {
    return this.postService.search(q, Number(page), Number(limit), req.user);
  }
} 