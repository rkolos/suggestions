import { ArrayNotEmpty, IsArray, IsIn, IsString } from 'class-validator';

const SUGGESTION_STATUSES = [
  'NEW',
  'OPEN',
  'DUPLICATE',
  'PLANNED',
  'IN_PROGRESS',
  'COMPLETED',
  'REJECTED',
] as const;

export class BulkUpdateStatusDto {
  @IsArray()
  @ArrayNotEmpty()
  @IsString({ each: true })
  ids!: string[];

  @IsIn(SUGGESTION_STATUSES)
  status!: (typeof SUGGESTION_STATUSES)[number];
}
