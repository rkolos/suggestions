import { IsBoolean, IsOptional, IsString, MinLength } from 'class-validator';

export class CreateCommentDto {
  @IsString()
  @MinLength(1, { message: 'Comment cannot be empty' })
  body!: string;

  @IsOptional()
  @IsBoolean()
  isInternal?: boolean = true;
}
