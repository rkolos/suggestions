import { IsBoolean, IsOptional, IsString, MinLength } from 'class-validator';

export class CreateCommentDto {
  @IsString()
  @MinLength(1, { message: 'Комментарий не может быть пустым' })
  body!: string;

  @IsOptional()
  @IsBoolean()
  isInternal?: boolean = true;
}
