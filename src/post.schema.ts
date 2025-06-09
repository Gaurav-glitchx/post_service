import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type PostDocument = Post & Document;

@Schema({ timestamps: true })
export class Post extends Document {
  @Prop({ required: true })
  userId: string;

  @Prop({ required: true })
  content: string;

  @Prop({ type: [String], default: [] })
  media: string[];

  @Prop({ default: 'public', enum: ['public', 'private'] })
  visibility: string;

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