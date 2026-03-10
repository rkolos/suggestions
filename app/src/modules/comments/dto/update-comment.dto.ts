import { IsString, MinLength } from 'class-validator';

export class UpdateCommentDto {
  @IsString()
  @MinLength(1, { message: 'Comment cannot be empty' })
  body!: string;
}
