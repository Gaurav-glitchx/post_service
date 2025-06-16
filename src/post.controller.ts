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
  Logger,
  Request,
  HttpStatus,
} from "@nestjs/common";
import { Request as ExpressRequest } from "express";
import {
  ApiTags,
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiQuery,
  ApiParam,
} from "@nestjs/swagger";
import { PostService } from "./post.service";
import { CreatePostDto } from "./dto/create-post.dto";
import { UpdatePostDto } from "./dto/update-post.dto";
import { PostIdDto } from "./dto/post-id.dto";
import { GrpcAuthGuard } from "./guards/grpc-auth.guard";

interface RequestWithUser extends ExpressRequest {
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

  @ApiOperation({ summary: "Search posts" })
  @ApiResponse({
    status: HttpStatus.OK,
    description: "List of posts matching the search query",
  })
  @ApiResponse({
    status: HttpStatus.UNAUTHORIZED,
    description: "User is not authenticated",
  })
  @ApiQuery({ name: "q", required: true, description: "Search query" })
  @ApiQuery({ name: "page", required: false, type: Number })
  @ApiQuery({ name: "limit", required: false, type: Number })
  @UseGuards(GrpcAuthGuard)
  @Get("search")
  search(
    @Query("q") query: string,
    @Query("page") page: number = 1,
    @Query("limit") limit: number = 10,
    @Req() req: RequestWithUser
  ) {
    return this.postService.search(query, page, limit, req.user);
  }

  @ApiOperation({ summary: "Get all posts by user" })
  @ApiResponse({
    status: HttpStatus.OK,
    description: "List of posts by the specified user",
  })
  @ApiResponse({
    status: HttpStatus.UNAUTHORIZED,
    description: "User is not authenticated",
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: "User not found",
  })
  @ApiParam({ name: "userId", description: "User ID" })
  @ApiQuery({ name: "page", required: false })
  @ApiQuery({ name: "limit", required: false })
  @UseGuards(GrpcAuthGuard)
  @Get("user/:userId")
  getByUser(
    @Param("userId") userId: string,
    @Query("page") page: number = 1,
    @Query("limit") limit: number = 10,
    @Req() req: RequestWithUser
  ) {
    const currentUserId = req.user.userId;
    return this.postService.getByUser(userId, page, limit, currentUserId);
  }

  @ApiOperation({ summary: "Get user's feed" })
  @ApiResponse({
    status: HttpStatus.OK,
    description: "List of posts in user's feed",
  })
  @ApiResponse({
    status: HttpStatus.UNAUTHORIZED,
    description: "User is not authenticated",
  })
  @ApiQuery({ name: "page", required: false })
  @ApiQuery({ name: "limit", required: false })
  @UseGuards(GrpcAuthGuard)
  @Get("feed")
  getFeed(
    @Req() req: RequestWithUser,
    @Query("page") page: number = 1,
    @Query("limit") limit: number = 10
  ) {
    const userId = req.user.userId;
    return this.postService.getFeed(userId, page, limit);
  }

  @ApiOperation({ summary: "Get posts where user is tagged" })
  @ApiResponse({
    status: HttpStatus.OK,
    description: "List of posts where user is tagged",
  })
  @ApiResponse({
    status: HttpStatus.UNAUTHORIZED,
    description: "User is not authenticated",
  })
  @ApiQuery({ name: "page", required: false, type: Number })
  @ApiQuery({ name: "limit", required: false, type: Number })
  @UseGuards(GrpcAuthGuard)
  @Get("tagged")
  getTaggedPosts(
    @Req() req: RequestWithUser,
    @Query("page") page: number = 1,
    @Query("limit") limit: number = 10
  ) {
    const userId = req.user.userId;
    return this.postService.getTaggedPosts(userId, page, limit);
  }

  @ApiOperation({ summary: "Get a post by ID" })
  @ApiResponse({
    status: HttpStatus.OK,
    description: "Post found",
  })
  @ApiResponse({
    status: HttpStatus.UNAUTHORIZED,
    description: "User is not authenticated",
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: "Post not found",
  })
  @ApiResponse({
    status: HttpStatus.FORBIDDEN,
    description: "User doesn't have access to this post",
  })
  @ApiParam({ name: "postId", description: "Post ID" })
  @UseGuards(GrpcAuthGuard)
  @Get(":postId")
  get(@Param("postId") postId: string, @Req() req: RequestWithUser) {
    const userId = req.user.userId;
    return this.postService.get(postId, userId);
  }

  @ApiOperation({ summary: "Create a post" })
  @ApiResponse({
    status: HttpStatus.CREATED,
    description: "Post created successfully",
  })
  @ApiResponse({
    status: HttpStatus.UNAUTHORIZED,
    description: "User is not authenticated",
  })
  @ApiResponse({
    status: HttpStatus.BAD_REQUEST,
    description: "Invalid post data",
  })
  @UseGuards(GrpcAuthGuard)
  @Post()
  create(@Body() createPostDto: CreatePostDto, @Req() req: RequestWithUser) {
    const UserId = req.user.userId;
    return this.postService.create(createPostDto, UserId);
  }

  @ApiOperation({ summary: "Update a post" })
  @ApiResponse({
    status: HttpStatus.OK,
    description: "Post updated successfully",
  })
  @ApiResponse({
    status: HttpStatus.UNAUTHORIZED,
    description: "User is not authenticated",
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: "Post not found",
  })
  @ApiResponse({
    status: HttpStatus.FORBIDDEN,
    description: "User is not the post owner",
  })
  @ApiParam({ name: "postId", description: "Post ID" })
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
  @ApiResponse({
    status: HttpStatus.OK,
    description: "Post deleted successfully",
  })
  @ApiResponse({
    status: HttpStatus.UNAUTHORIZED,
    description: "User is not authenticated",
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: "Post not found",
  })
  @ApiResponse({
    status: HttpStatus.FORBIDDEN,
    description: "User is not the post owner",
  })
  @ApiParam({ name: "postId", description: "Post ID" })
  @UseGuards(GrpcAuthGuard)
  @Delete(":postId")
  delete(@Param("postId") postId: string, @Req() req: RequestWithUser) {
    const userId = req.user.userId;
    return this.postService.deletePost(postId, userId);
  }

  @ApiOperation({ summary: "Report a post" })
  @ApiResponse({
    status: HttpStatus.OK,
    description: "Post reported successfully",
  })
  @ApiResponse({
    status: HttpStatus.UNAUTHORIZED,
    description: "User is not authenticated",
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: "Post not found",
  })
  @ApiResponse({
    status: HttpStatus.BAD_REQUEST,
    description: "Post already reported or invalid request",
  })
  @ApiParam({ name: "postId", description: "Post ID" })
  @UseGuards(GrpcAuthGuard)
  @Post("report/:postId")
  reportPost(
    @Param("postId") postId: string,
    @Body("reason") reason: string,
    @Req() req: RequestWithUser
  ) {
    const userId = req.user.userId;
    return this.postService.reportPost(postId, userId, reason);
  }

  @ApiOperation({ summary: "Get user's saved posts" })
  @ApiResponse({
    status: HttpStatus.OK,
    description: "List of user's saved posts",
  })
  @ApiResponse({
    status: HttpStatus.UNAUTHORIZED,
    description: "User is not authenticated",
  })
  @ApiQuery({ name: "page", required: false, type: Number })
  @ApiQuery({ name: "limit", required: false, type: Number })
  @UseGuards(GrpcAuthGuard)
  @Get("saved")
  async getSavedPosts(
    @Request() req: RequestWithUser,
    @Query("page") page: number = 1,
    @Query("limit") limit: number = 10
  ) {
    return this.postService.getSavedPosts(req.user.userId, page, limit);
  }

  @ApiOperation({ summary: "Save a post" })
  @ApiResponse({
    status: HttpStatus.OK,
    description: "Post saved successfully",
  })
  @ApiResponse({
    status: HttpStatus.UNAUTHORIZED,
    description: "User is not authenticated",
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: "Post not found",
  })
  @ApiParam({ name: "postId", description: "Post ID" })
  @UseGuards(GrpcAuthGuard)
  @Post(":postId/save")
  async savePost(
    @Request() req: RequestWithUser,
    @Param("postId") postId: string
  ) {
    return this.postService.savePost(postId, req.user.userId);
  }

  @ApiOperation({ summary: "Unsave a post" })
  @ApiResponse({
    status: HttpStatus.OK,
    description: "Post unsaved successfully",
  })
  @ApiResponse({
    status: HttpStatus.UNAUTHORIZED,
    description: "User is not authenticated",
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: "Post not found",
  })
  @ApiParam({ name: "postId", description: "Post ID" })
  @UseGuards(GrpcAuthGuard)
  @Delete(":postId/save")
  async unsavePost(
    @Request() req: RequestWithUser,
    @Param("postId") postId: string
  ) {
    return this.postService.unsavePost(postId, req.user.userId);
  }

  @ApiOperation({ summary: "Validate a post" })
  @ApiResponse({
    status: HttpStatus.OK,
    description: "Post validation result",
  })
  @ApiResponse({
    status: HttpStatus.UNAUTHORIZED,
    description: "User is not authenticated",
  })
  @ApiParam({ name: "postId", description: "Post ID" })
  @UseGuards(GrpcAuthGuard)
  @Get("validate/:postId")
  validatePost(@Param("postId") postId: string) {
    return this.postService.validatePost(postId);
  }

  @ApiOperation({ summary: "Get all posts (admin only)" })
  @ApiResponse({
    status: HttpStatus.OK,
    description: "List of all posts",
  })
  @ApiResponse({
    status: HttpStatus.UNAUTHORIZED,
    description: "User is not authenticated",
  })
  @ApiResponse({
    status: HttpStatus.FORBIDDEN,
    description: "User is not an admin",
  })
  @ApiQuery({ name: "page", required: false, type: Number })
  @ApiQuery({ name: "limit", required: false, type: Number })
  @UseGuards(GrpcAuthGuard)
  @Get("admin/all")
  getAllPosts(
    @Req() req: RequestWithUser,
    @Query("page") page: number = 1,
    @Query("limit") limit: number = 10
  ) {
    return this.postService.getAllPosts(page, limit, req.user.userId);
  }

  @ApiOperation({ summary: "Get reported posts (admin only)" })
  @ApiResponse({
    status: HttpStatus.OK,
    description: "List of reported posts",
  })
  @ApiResponse({
    status: HttpStatus.UNAUTHORIZED,
    description: "User is not authenticated",
  })
  @ApiResponse({
    status: HttpStatus.FORBIDDEN,
    description: "User is not an admin",
  })
  @UseGuards(GrpcAuthGuard)
  @Get("admin/reported")
  getReportedPosts() {
    return this.postService.getReportedPosts();
  }

  @ApiOperation({ summary: "Flag a post (admin only)" })
  @ApiResponse({
    status: HttpStatus.OK,
    description: "Post flagged successfully",
  })
  @ApiResponse({
    status: HttpStatus.UNAUTHORIZED,
    description: "User is not authenticated",
  })
  @ApiResponse({
    status: HttpStatus.FORBIDDEN,
    description: "User is not an admin",
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: "Post not found",
  })
  @ApiParam({ name: "postId", description: "Post ID" })
  @UseGuards(GrpcAuthGuard)
  @Post("flag/:postId")
  flagPost(
    @Param("postId") postId: string,
    @Body("reason") reason: string,
    @Req() req: RequestWithUser
  ) {
    const userId = req.user.userId;
    return this.postService.flagPost(postId, reason);
  }

  @ApiOperation({ summary: "Delete a post (admin only)" })
  @ApiResponse({
    status: HttpStatus.OK,
    description: "Post deleted successfully",
  })
  @ApiResponse({
    status: HttpStatus.UNAUTHORIZED,
    description: "User is not authenticated",
  })
  @ApiResponse({
    status: HttpStatus.FORBIDDEN,
    description: "User is not an admin",
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: "Post not found",
  })
  @ApiParam({ name: "postId", description: "Post ID" })
  @UseGuards(GrpcAuthGuard)
  @Delete("admin/:postId")
  adminDeletePost(@Param("postId") postId: string) {
    return this.postService.adminDeletePost(postId);
  }
}
