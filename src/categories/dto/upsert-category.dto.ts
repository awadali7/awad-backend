import { ApiProperty } from '@nestjs/swagger';
import { IsIn, IsString, MaxLength, MinLength } from 'class-validator';

export const CATEGORY_KINDS = ['emi', 'income', 'expense'] as const;
export type CategoryKindDto = (typeof CATEGORY_KINDS)[number];

export class UpsertCategoryDto {
  @ApiProperty({ enum: CATEGORY_KINDS, example: 'expense' })
  @IsIn(CATEGORY_KINDS)
  kind!: CategoryKindDto;

  @ApiProperty({ example: 'Groceries' })
  @IsString()
  @MinLength(1)
  @MaxLength(60)
  name!: string;
}
