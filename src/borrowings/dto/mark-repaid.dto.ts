import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsDateString, IsOptional } from 'class-validator';

export class MarkRepaidDto {
  @ApiPropertyOptional({
    description: 'Date it was settled. Defaults to today.',
    example: '2026-12-20',
  })
  @IsOptional()
  @IsDateString()
  repaidOn?: string;
}
