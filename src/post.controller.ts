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
} from "@nestjs/common";
import { Request as ExpressRequest } from "express";
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
    status: 200,
    description: "List of posts matching the search query",
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

  @ApiOperation({ summary: "Get feed" })
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
    status: 200,
    description: "List of posts where user is tagged",
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
  @ApiResponse({ status: 200, description: "Post found" })
  @UseGuards(GrpcAuthGuard)
  @Get(":postId")
  get(@Param("postId") postId: string, @Req() req: RequestWithUser) {
    const userId = req.user.userId;
    return this.postService.get(postId, userId);
  }

  @ApiOperation({ summary: "Create a post" })
  @ApiResponse({ status: 201, description: "Post created" })
  @UseGuards(GrpcAuthGuard)
  @Post()
  create(@Body() createPostDto: CreatePostDto, @Req() req: RequestWithUser) {
    const UserId = req.user.userId;
    return this.postService.create(createPostDto, UserId);
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

  @ApiOperation({ summary: "Report a post" })
  @ApiResponse({ status: 200, description: "Post reported successfully" })
  @ApiResponse({
    status: 400,
    description: "Already reported or invalid request",
  })
  @ApiResponse({ status: 404, description: "Post not found" })
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
   @Get("saved")
  @UseGuards(GrpcAuthGuard)
  @ApiOperation({ summary: "Get user's saved posts" })
  @ApiResponse({
    status: 200,
    description: "Returns the user's saved posts",
  })
  @ApiQuery({ name: "page", required: false, type: Number })
  @ApiQuery({ name: "limit", required: false, type: Number })
  async getSavedPosts(
    @Request() req: RequestWithUser,
    @Query("page") page: number = 1,
    @Query("limit") limit: number = 10
  ) {
    return this.postService.getSavedPosts(req.user.userId, page, limit);
  }

  @Post(":postId/save")
  @UseGuards(GrpcAuthGuard)
  @ApiOperation({ summary: "Save a post" })
  @ApiResponse({
    status: 200,
    description: "Post saved successfully",
  })
  @ApiResponse({
    status: 404,
    description: "Post not found",
  })
  async savePost(
    @Request() req: RequestWithUser,
    @Param("postId") postId: string
  ) {
    return this.postService.savePost(postId, req.user.userId);
  }

  @Delete(":postId/save")
  @UseGuards(GrpcAuthGuard)
  @ApiOperation({ summary: "Unsave a post" })
  @ApiResponse({
    status: 200,
    description: "Post unsaved successfully",
  })
  @ApiResponse({
    status: 404,
    description: "Post not found",
  })
  async unsavePost(
    @Request() req: RequestWithUser,
    @Param("postId") postId: string
  ) {
    return this.postService.unsavePost(postId, req.user.userId);
  }

  @ApiOperation({ summary: "Validate a post" })
  @ApiResponse({ status: 200, description: "Post validated" })
  @UseGuards(GrpcAuthGuard)
  @Get("validate/:postId")
  validatePost(@Param("postId") postId: string) {
    return this.postService.validatePost(postId);
  }

  @ApiOperation({ summary: "Get all posts (admin only)" })
  @ApiResponse({ status: 200, description: "List of all posts" })
  @ApiQuery({ name: "page", required: false, type: Number })
  @ApiQuery({ name: "limit", required: false, type: Number })
  @UseGuards(GrpcAuthGuard)
  @Get("admin/all")
  getAllPosts(
    @Query("page") page: number = 1,
    @Query("limit") limit: number = 10
  ) {
    return this.postService.getAllPosts(page, limit);
  }

  @ApiOperation({ summary: "Get reported posts (admin only)" })
  @ApiResponse({ status: 200, description: "List of reported posts" })
  @UseGuards(GrpcAuthGuard)
  @Get("admin/reported")
  getReportedPosts() {
    return this.postService.getReportedPosts();
  }

  @ApiOperation({ summary: "Flag a post (admin only)" })
  @ApiResponse({ status: 200, description: "Post flagged" })
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
  @ApiResponse({ status: 200, description: "Post deleted" })
  @UseGuards(GrpcAuthGuard)
  @Delete("admin/:postId")
  adminDeletePost(@Param("postId") postId: string) {
    return this.postService.adminDeletePost(postId);
  }

 
}
