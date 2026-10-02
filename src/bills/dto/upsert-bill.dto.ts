import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Matches,
  Max,
  Min,
} from 'class-validator';

/** Billing cycles are stored as "YYYY-MM" throughout. */
const CYCLE_PATTERN = /^\d{4}-(0[1-9]|1[0-2])$/;

const BILL_TYPES = ['emi', 'chitty', 'recurring', 'credit_card'] as const;
export type BillTypeDto = (typeof BILL_TYPES)[number];

export class UpsertBillDto {
  @ApiProperty({ example: 'Washing machine' })
  @IsString()
  name!: string;

  @ApiProperty({ example: 'Appliance EMI' })
  @IsString()
  category!: string;

  @ApiProperty({ enum: BILL_TYPES, example: 'emi' })
  @IsIn(BILL_TYPES)
  type!: BillTypeDto;

  @ApiProperty({ description: 'Amount in rupees', example: 1100 })
  @IsInt()
  @Min(0)
  amount!: number;

  @ApiPropertyOptional({
    description:
      "Day of month (1-31), clamped to the month's last day. Omit if not set.",
    example: 25,
    nullable: true,
  })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(31)
  @Type(() => Number)
  dueDay?: number | null;

  @ApiPropertyOptional({
    description:
      'Due on the last calendar day of the month (overrides dueDay).',
  })
  @IsOptional()
  @IsBoolean()
  endOfMonth?: boolean;

  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @IsInt()
  @Min(0)
  installmentsPaid?: number | null;

  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @IsInt()
  @Min(0)
  installmentsTotal?: number | null;

  @ApiPropertyOptional({
    description:
      'For count-down style chits (e.g. Pocketly) instead of paid/total.',
    nullable: true,
  })
  @IsOptional()
  @IsInt()
  @Min(0)
  installmentsLeft?: number | null;

  @ApiPropertyOptional({
    description:
      '"YYYY-MM" of the first cycle this is billed in. Omit for a bill that is already running.',
    example: '2026-11',
    nullable: true,
  })
  @IsOptional()
  @IsString()
  @Matches(CYCLE_PATTERN, {
    message: 'startCycle must be formatted as YYYY-MM',
  })
  startCycle?: string | null;

  @ApiPropertyOptional({
    description: '"YYYY-MM" of the cycle last marked paid.',
    nullable: true,
  })
  @IsOptional()
  @IsString()
  lastPaidCycle?: string | null;

  @ApiPropertyOptional({
    description:
      '"YYYY-MM" of the cycle the "due tomorrow" notification already fired for.',
    nullable: true,
  })
  @IsOptional()
  @IsString()
  lastNotifiedCycle?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  archived?: boolean;
}
