import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsIn,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  MinLength,
} from 'class-validator';

const KINDS = ['expense', 'income', 'emi', 'borrowing'] as const;

export class InterpretDto {
  @ApiProperty({ example: 'i buy vegetable for 243 rupees' })
  @IsString()
  @MinLength(1)
  @MaxLength(500)
  message!: string;

  @ApiPropertyOptional({
    description:
      'Month in view, "YYYY-MM". Used when the message says "this month".',
    example: '2026-10',
  })
  @IsOptional()
  @IsString()
  @Matches(/^\d{4}-(0[1-9]|1[0-2])$/, {
    message: 'cycle must be formatted as YYYY-MM',
  })
  cycle?: string;

  @ApiPropertyOptional({
    enum: KINDS,
    description:
      'Set when the operator picked a kind from the menu, so the assistant does not have to guess.',
  })
  @IsOptional()
  @IsIn(KINDS)
  kind?: (typeof KINDS)[number];
}
