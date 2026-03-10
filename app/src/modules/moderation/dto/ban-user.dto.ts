import { IsString, MinLength } from 'class-validator';

export class BanUserDto {
  @IsString()
  @MinLength(1, { message: 'userId is required' })
  userId!: string;
}
