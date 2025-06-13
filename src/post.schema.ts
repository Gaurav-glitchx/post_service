import { Prop, Schema, SchemaFactory } from "@nestjs/mongoose";
import { Document, Types } from "mongoose";

export enum PostVisibility {
  PUBLIC = "public",
  PRIVATE = "private",
}

export type PostDocument = Post & Document;

@Schema({ timestamps: true })
export class Post extends Document {
  @Prop({ required: true })
  UserId: Types.ObjectId;

  @Prop({ required: true })
  content: string;

  @Prop({ type: [String], default: [] })
  media: string[];

  @Prop({ type: [String], default: [] })
  signedMediaUrls: string[];

  @Prop({ default: PostVisibility.PUBLIC, enum: Object.values(PostVisibility) })
  visibility: PostVisibility;

  @Prop({ type: [String], default: [] })
  keywords: string[];

  @Prop({ type: [Types.ObjectId], default: [] })
  taggedUsers: Types.ObjectId[];

  @Prop({ type: [Types.ObjectId], default: [] })
  savedBy: Types.ObjectId[];

  @Prop({ default: false })
  deleted: boolean;

  @Prop({ default: false })
  moderated: boolean;

  @Prop({ default: false })
  isReported: boolean;

  @Prop()
  reportReason: string;

  @Prop({ default: 0 })
  reportCount: number;

  @Prop({
    type: [
      {
        userId: Types.ObjectId,
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
