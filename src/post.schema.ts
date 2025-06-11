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

  @Prop({ default: false })
  deleted: boolean;

  @Prop({ default: false })
  moderated: boolean;

  @Prop({ default: false })
  isReported: boolean;

  @Prop()
  reportReason: string;
}

export const PostSchema = SchemaFactory.createForClass(Post);
