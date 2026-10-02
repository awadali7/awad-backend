import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsDateString,
  IsInt,
  IsOptional,
  IsString,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';

export class UpsertBorrowingDto {
  @ApiProperty({ description: 'Who the money came from', example: 'Rahul' })
  @IsString()
  @MinLength(1)
  @MaxLength(80)
  lender!: string;

  @ApiProperty({ description: 'Amount in rupees', example: 25000 })
  @IsInt()
  @Min(0)
  amount!: number;

  @ApiProperty({
    description: 'Date the money was taken',
    example: '2026-10-02',
  })
  @IsDateString()
  startDate!: string;

  @ApiProperty({ description: 'Date it is owed back', example: '2027-01-15' })
  @IsDateString()
  dueDate!: string;

  @ApiPropertyOptional({
    description: 'Set once settled. Omit while still outstanding.',
    example: '2026-12-20',
    nullable: true,
  })
  @IsOptional()
  @IsDateString()
  repaidOn?: string | null;

  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  notes?: string | null;
}
