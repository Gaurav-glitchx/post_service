import { Prop, Schema, SchemaFactory } from "@nestjs/mongoose";
import { HydratedDocument } from "mongoose";
import { ApiProperty } from "@nestjs/swagger";

export type UserDocument = HydratedDocument<User>;

@Schema({ timestamps: true })
export class User {
  @ApiProperty({
    description: "Unique username of the user",
    example: "johndoe123",
    required: true,
    uniqueItems: true,
  })
  @Prop({ required: true, unique: true })
  username: string;

  @ApiProperty({
    description: "Unique email address of the user",
    example: "john.doe@example.com",
    required: true,
    uniqueItems: true,
  })
  @Prop({ required: true, unique: true })
  email: string;

  @ApiProperty({
    description: "Hashed password for the user account",
    example: "$2b$10$examplehashedpassword",
    required: true,
    writeOnly: true,
  })
  @Prop({ required: true })
  password: string;

  @ApiProperty({
    description: "Full name of the user",
    example: "John Doe",
    required: false,
  })
  @Prop()
  fullName: string;

  @ApiProperty({
    description: "Short biography or description of the user",
    example: "Software developer and coffee enthusiast",
    required: false,
  })
  @Prop()
  bio: string;

  @ApiProperty({
    description: "Type of account (e.g., public, private)",
    example: "public",
    default: "public",
    enum: ["public", "private"],
  })
  @Prop({ default: "public" })
  accountType: string;

  @ApiProperty({
    description: "URL to the user’s profile picture",
    example: "https://example.com/profile.jpg",
    required: false,
  })
  @Prop()
  profilePicture: string;

  @ApiProperty({
    description: "Number of followers the user has",
    example: 150,
    default: 0,
    minimum: 0,
  })
  @Prop({ default: 0 })
  followersCount: number;

  @ApiProperty({
    description: "Number of users the user is following",
    example: 200,
    default: 0,
    minimum: 0,
  })
  @Prop({ default: 0 })
  followingCount: number;

  @ApiProperty({
    description: "Array of user IDs who follow this user",
    example: ["user123", "user456"],
    type: [String],
  })
  @Prop({ type: [{ type: String, ref: "User" }] })
  followers: string[];

  @ApiProperty({
    description: "Array of user IDs this user is following",
    example: ["user789", "user101"],
    type: [String],
  })
  @Prop({ type: [{ type: String, ref: "User" }] })
  following: string[];

  @ApiProperty({
    description: "Array of post IDs created by the user",
    example: ["post123", "post456"],
    type: [String],
  })
  @Prop({ type: [{ type: String, ref: "Post" }] })
  posts: string[];

  @ApiProperty({
    description: "Array of user IDs blocked by this user",
    example: ["user999"],
    type: [String],
    default: [],
  })
  @Prop({ type: [{ type: String, ref: "User" }], default: [] })
  blockedUsers: string[];

  @ApiProperty({
    description: "Indicates if the user is banned",
    example: false,
    default: false,
  })
  @Prop({ default: false })
  isBanned: boolean;

  @ApiProperty({
    description: "Reason for the user’s ban, if applicable",
    example: "Violation of community guidelines",
    required: false,
  })
  @Prop()
  banReason: string;

  @ApiProperty({
    description: "Indicates if the user account is active",
    example: true,
    default: true,
  })
  @Prop({ default: true })
  isActive: boolean;

  @ApiProperty({
    description: "Current status of the user (e.g., active, inactive)",
    example: "active",
    default: "active",
    enum: ["active", "inactive", "suspended"],
  })
  @Prop({ default: "active" })
  status: string;

  @ApiProperty({
    description: "Indicates if the user’s email is verified",
    example: false,
    default: false,
  })
  @Prop({ default: false })
  emailVerified: boolean;

  @ApiProperty({
    description:
      "Array of active user sessions with device ID, token, and last active timestamp",
    type: "array",
    items: {
      type: "object",
      properties: {
        deviceId: { type: "string", example: "device123" },
        token: { type: "string", example: "jwt.token.example" },
        lastActive: {
          type: "string",
          format: "date-time",
          example: "2025-06-10T18:21:00Z",
        },
      },
    },
    default: [],
  })
  @Prop({
    type: [{ deviceId: String, token: String, lastActive: Date }],
    default: [],
  })
  sessions: { deviceId: string; token: string; lastActive: Date }[];
}

export const UserSchema = SchemaFactory.createForClass(User);
