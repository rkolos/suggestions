import { ArrayNotEmpty, IsArray, IsString } from 'class-validator';

export class BulkDeleteDto {
  @IsArray()
  @ArrayNotEmpty()
  @IsString({ each: true })
  ids!: string[];
}
