import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsInt,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  Min,
} from 'class-validator';

const CYCLE_PATTERN = /^\d{4}-(0[1-9]|1[0-2])$/;

export class UpsertIncomeSourceDto {
  @ApiProperty({ example: 'My salary' })
  @IsString()
  @MaxLength(80)
  label!: string;

  @ApiProperty({ description: 'Amount in rupees', example: 30000 })
  @IsInt()
  @Min(0)
  amount!: number;

  @ApiPropertyOptional({
    description:
      'Omit for permanent income that counts every month. Set to "YYYY-MM" for a one-off that counts only towards that month.',
    example: '2026-10',
    nullable: true,
  })
  @IsOptional()
  @IsString()
  @Matches(CYCLE_PATTERN, { message: 'cycle must be formatted as YYYY-MM' })
  cycle?: string | null;
}
