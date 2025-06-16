import { ApiProperty } from "@nestjs/swagger";
import {
  IsString,
  IsOptional,
  IsArray,
  IsIn,
  IsEnum,
  IsBoolean,
} from "class-validator";
import { PostVisibility } from "../post.schema";

export class UpdatePostDto {
  @ApiProperty({ example: "Updated content", required: false })
  @IsString()
  @IsOptional()
  content?: string;

  @ApiProperty({ example: ["media1.jpg"], required: false })
  @IsArray()
  @IsOptional()
  @IsString({ each: true })
  mediaKeys?: string[];

  @ApiProperty({ example: ["media1.jpg"], required: false })
  @IsArray()
  @IsOptional()
  @IsString({ each: true })
  deleteMedia?: string[];

  @ApiProperty({
    example: "private",
    enum: ["public", "private"],
    required: false,
  })
  @IsEnum(PostVisibility)
  @IsOptional()
  visibility?: PostVisibility;

  @IsOptional()
  @IsBoolean()
  isPinned?: boolean;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  taggedUsers?: string[];
}
