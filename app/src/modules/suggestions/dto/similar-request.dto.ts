import { IsString } from 'class-validator';

export class SimilarRequestDto {
  @IsString()
  text!: string;
}
