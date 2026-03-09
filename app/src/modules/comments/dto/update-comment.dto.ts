import { IsString, MinLength } from 'class-validator';

export class UpdateCommentDto {
  @IsString()
  @MinLength(1, { message: 'Комментарий не может быть пустым' })
  body!: string;
}
