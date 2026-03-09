import {
  IsArray,
  IsObject,
  IsOptional,
  IsString,
  MaxLength,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

export class SuggestionCategoryDto {
  @IsString()
  id!: string;

  @IsString()
  @MaxLength(30)
  label!: string;

  @IsString()
  color!: string;
}

export class NotificationTemplatesDto {
  @IsOptional()
  @IsString()
  @MaxLength(500)
  ticket_created?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  ticket_approved?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  ticket_rejected?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  ticket_merged?: string;
}

export class UpdateConfigDto {
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => SuggestionCategoryDto)
  categories?: SuggestionCategoryDto[];

  @IsOptional()
  @IsObject()
  @ValidateNested()
  @Type(() => NotificationTemplatesDto)
  notifications?: NotificationTemplatesDto;

  @IsOptional()
  @IsString()
  suggestionsChannelId?: string;
}
