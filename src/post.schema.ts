import { Prop, Schema, SchemaFactory } from "@nestjs/mongoose";
import { Document, Types } from "mongoose";

export enum PostVisibility {
  PUBLIC = "public",
  PRIVATE = "private",
}

export interface TaggedUserInfo {
  userId: Types.ObjectId;
  username: string;
  fullName: string;
}

export type PostDocument = Post & Document;

@Schema({ timestamps: true })
export class Post extends Document {
  @Prop({ required: true, type: Types.ObjectId, ref: "User" })
  UserId: Types.ObjectId;

  @Prop({ required: true })
  content: string;

  @Prop({ required: true })
  username: string;

  @Prop({ required: true })
  fullName: string;

  @Prop({ type: [String], default: [] })
  media: string[];

  @Prop({ default: PostVisibility.PUBLIC, enum: Object.values(PostVisibility) })
  visibility: PostVisibility;

  @Prop({ type: [String], default: [] })
  keywords: string[];

  @Prop({ type: [Types.ObjectId], default: [], ref: "User" })
  taggedUsers: Types.ObjectId[];

  @Prop({
    type: [{ userId: Types.ObjectId, username: String, fullName: String }],
    default: [],
  })
  taggedUsersInfo: TaggedUserInfo[];

  @Prop({ default: false })
  deleted: boolean;

  @Prop({ default: false })
  moderated: boolean;

  @Prop({ default: false })
  isReported: boolean;

  @Prop({ type: String, default: null })
  reportReason: string | null;

  @Prop({ default: 0 })
  reportCount: number;

  @Prop({
    type: [
      {
        userId: { type: Types.ObjectId, ref: "User" },
        reason: String,
        createdAt: { type: Date, default: Date.now },
      },
    ],
    default: [],
  })
  reportHistory: Array<{
    userId: Types.ObjectId;
    reason: string;
    createdAt: Date;
  }>;
}

export const PostSchema = SchemaFactory.createForClass(Post);

// Create indexes for better query performance
PostSchema.index({ UserId: 1, createdAt: -1 }); // For user's posts queries
PostSchema.index({ visibility: 1, createdAt: -1 }); // For public posts queries
PostSchema.index({ keywords: "text" }); // For text search
PostSchema.index({ deleted: 1, moderated: 1 }); // For filtering deleted/moderated posts
PostSchema.index({ taggedUsers: 1 }); // For tagged posts queries

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
  hasNextPage: boolean;
  hasPreviousPage: boolean;
}
