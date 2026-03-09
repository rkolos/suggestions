import { IsArray, IsBoolean, IsOptional, IsString, IsUrl, MaxLength } from 'class-validator';

export class CreateSuggestionBodyDto {
  @IsString()
  @MaxLength(500)
  title!: string;

  @IsString()
  @MaxLength(10000)
  description!: string;

  @IsString()
  @MaxLength(100)
  category!: string;

  @IsOptional()
  @IsBoolean()
  isOfficial?: boolean;

  @IsOptional()
  @IsString()
  authorId?: string;

  @IsOptional()
  @IsString()
  source?: 'web' | 'discord';

  @IsOptional()
  @IsArray()
  @IsUrl({}, { each: true })
  images?: string[];
}
