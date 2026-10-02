import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsInt,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';

const CYCLE_PATTERN = /^\d{4}-(0[1-9]|1[0-2])$/;

export class UpsertExpenseDto {
  @ApiProperty({ example: 'Groceries' })
  @IsString()
  @MinLength(1)
  @MaxLength(80)
  label!: string;

  @ApiProperty({ description: 'Amount in rupees', example: 8400 })
  @IsInt()
  @Min(0)
  amount!: number;

  @ApiProperty({
    description: 'Month this expense counts towards, "YYYY-MM".',
    example: '2026-10',
  })
  @IsString()
  @Matches(CYCLE_PATTERN, { message: 'cycle must be formatted as YYYY-MM' })
  cycle!: string;

  @ApiPropertyOptional({ example: 'Household', nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(60)
  category?: string | null;

  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  notes?: string | null;
}
