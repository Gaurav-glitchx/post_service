import { ApiProperty } from "@nestjs/swagger";
import {
  IsString,
  IsOptional,
  IsArray,
  IsIn,
  IsNotEmpty,
  IsEnum,
} from "class-validator";
import { PostVisibility } from "../post.schema";

export class CreatePostDto {
  @ApiProperty({ example: "Hello world!" })
  @IsString()
  @IsNotEmpty()
  content: string;

  @ApiProperty({
    example: ["file-key-1", "file-key-2"],
    required: false,
    description: "Array of file keys for media that has already been uploaded",
  })
  @IsArray()
  @IsOptional()
  @IsString({ each: true })
  mediaKeys?: string[];

  @ApiProperty({ example: "public", enum: ["public", "private"] })
  @IsOptional()
  @IsEnum(PostVisibility)
  visibility?: PostVisibility;

  @ApiProperty({ example: ["userId1", "userId2"], required: false })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  taggedUsers?: string[];
}
