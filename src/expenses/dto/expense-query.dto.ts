import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, Matches } from 'class-validator';

export class ExpenseQueryDto {
  @ApiPropertyOptional({
    description: 'Month to list, "YYYY-MM". Defaults to the current month.',
    example: '2026-10',
  })
  @IsOptional()
  @IsString()
  @Matches(/^\d{4}-(0[1-9]|1[0-2])$/, {
    message: 'cycle must be formatted as YYYY-MM',
  })
  cycle?: string;
}
