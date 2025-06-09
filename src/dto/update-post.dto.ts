import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsOptional, IsArray, IsIn } from 'class-validator';

export class UpdatePostDto {
  @ApiProperty({ example: 'Updated content', required: false })
  @IsString()
  @IsOptional()
  content?: string;

  @ApiProperty({ example: ['media1.jpg'], required: false })
  @IsArray()
  @IsOptional()
  media?: string[];

  @ApiProperty({ example: 'private', enum: ['public', 'private'], required: false })
  @IsString()
  @IsIn(['public', 'private'])
  @IsOptional()
  visibility?: string;
} 