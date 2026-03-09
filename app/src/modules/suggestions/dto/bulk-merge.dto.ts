import { ArrayNotEmpty, IsArray, IsString } from 'class-validator';

export class BulkMergeDto {
  @IsArray()
  @ArrayNotEmpty()
  @IsString({ each: true })
  sourceIds!: string[];

  @IsString()
  targetId!: string;
}
