import { Prop, Schema, SchemaFactory } from "@nestjs/mongoose";
import { Document, Types } from "mongoose";

@Schema({ timestamps: true })
export class SavedPost extends Document {
  @Prop({ type: Types.ObjectId, ref: "User", required: true })
  userId: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: "Post", required: true })
  postId: Types.ObjectId;

  @Prop({ type: Date, default: Date.now })
  savedAt: Date;
}

export const SavedPostSchema = SchemaFactory.createForClass(SavedPost);

// Create compound index for userId and postId to ensure uniqueness
SavedPostSchema.index({ userId: 1, postId: 1 }, { unique: true });
