import { IsIn, IsOptional, IsString, MaxLength } from 'class-validator';

const SUGGESTION_STATUSES = [
  'NEW',
  'OPEN',
  'DUPLICATE',
  'PLANNED',
  'IN_PROGRESS',
  'COMPLETED',
  'REJECTED',
] as const;

export class UpdateSuggestionStatusDto {
  @IsIn(SUGGESTION_STATUSES)
  status!: (typeof SUGGESTION_STATUSES)[number];

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  comment?: string;
}
