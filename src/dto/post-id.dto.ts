import { ApiProperty } from '@nestjs/swagger';
import { IsString } from 'class-validator';

export class PostIdDto {
  @ApiProperty({ example: 'postId123' })
  @IsString()
  postId: string;
} 