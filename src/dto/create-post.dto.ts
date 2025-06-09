import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsOptional, IsArray, IsIn, IsNotEmpty } from 'class-validator';

export class CreatePostDto {
  @ApiProperty({ example: 'Hello world!' })
  @IsString()
  @IsNotEmpty()
  content: string;

  @ApiProperty({ example: ['media1.jpg', 'media2.png'], required: false })
  @IsArray()
  @IsOptional()
  media?: string[];

  @ApiProperty({ example: 'public', enum: ['public', 'private'] })
  @IsString()
  @IsIn(['public', 'private'])
  visibility: string;

  @ApiProperty({ example: 'userId123' })
  @IsString()
  @IsNotEmpty()
  userId: string;
} 