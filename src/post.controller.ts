import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  Req,
} from "@nestjs/common";
import { Request } from "express";
import {
  ApiTags,
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiQuery,
} from "@nestjs/swagger";
import { PostService } from "./post.service";
import { CreatePostDto } from "./dto/create-post.dto";
import { UpdatePostDto } from "./dto/update-post.dto";
import { PostIdDto } from "./dto/post-id.dto";
import { GrpcAuthGuard } from "./guards/grpc-auth.guard";

interface RequestWithUser extends Request {
  user: {
    userId: string;
    email: string;
    role: string;
    issuedAt: number;
    expiresAt: number;
  };
}

@ApiTags("posts")
@ApiBearerAuth()
@Controller("posts")
export class PostController {
  constructor(private readonly postService: PostService) {}

  @ApiOperation({ summary: "Create a post" })
  @ApiResponse({ status: 201, description: "Post created" })
  @UseGuards(GrpcAuthGuard)
  @Post()
  create(@Body() createPostDto: CreatePostDto, @Req() req: RequestWithUser) {
    const UserId = req.user.userId;
    return this.postService.create(createPostDto, UserId);
  }

  @ApiOperation({ summary: "Get a post by ID" })
  @ApiResponse({ status: 200, description: "Post found" })
  @UseGuards(GrpcAuthGuard)
  @Get(":postId")
  get(@Param("postId") postId: string, @Req() req: RequestWithUser) {
    const userId = req.user.userId;
    return this.postService.get(postId, userId);
  }

  @ApiOperation({ summary: "Update a post" })
  @ApiResponse({ status: 200, description: "Post updated" })
  @UseGuards(GrpcAuthGuard)
  @Put(":postId")
  update(
    @Param("postId") postId: string,
    @Body() updatePostDto: UpdatePostDto,
    @Req() req: RequestWithUser
  ) {
    const userId = req.user.userId;
    return this.postService.update(postId, updatePostDto, userId);
  }

  @ApiOperation({ summary: "Delete a post" })
  @ApiResponse({ status: 200, description: "Post deleted" })
  @UseGuards(GrpcAuthGuard)
  @Delete(":postId")
  delete(@Param("postId") postId: string, @Req() req: RequestWithUser) {
    const userId = req.user.userId;
    return this.postService.delete(postId, userId);
  }

  @ApiOperation({ summary: "Get all posts by user" })
  @ApiQuery({ name: "userId", required: true })
  @ApiQuery({ name: "page", required: false })
  @ApiQuery({ name: "limit", required: false })
  @UseGuards(GrpcAuthGuard)
  @Get("user/:userId")
  getByUser(@Param("userId") userId: string, @Req() req: RequestWithUser) {
    const currentUserId = req.user.userId;
    return this.postService.getByUser(userId, 1, 10, currentUserId);
  }

  @ApiOperation({ summary: "Get feed" })
  @ApiQuery({ name: "page", required: false })
  @ApiQuery({ name: "limit", required: false })
  @UseGuards(GrpcAuthGuard)
  @Get("feed")
  getFeed(@Req() req: RequestWithUser) {
    const userId = req.user.userId;
    return this.postService.getFeed(userId, 1, 10);
  }

  @ApiOperation({ summary: "Search posts by keyword" })
  @ApiQuery({ name: "q", required: true })
  @ApiQuery({ name: "page", required: false })
  @ApiQuery({ name: "limit", required: false })
  @UseGuards(GrpcAuthGuard)
  @Get("search")
  search(@Req() req: RequestWithUser) {
    const userId = req.user.userId;
    return this.postService.search("", 1, 10, userId);
  }
}
