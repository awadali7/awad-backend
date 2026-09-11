import { ApiProperty } from '@nestjs/swagger';
import { IsInt, Min } from 'class-validator';

export class UpdateIncomeDto {
  @ApiProperty({ example: 30_000 })
  @IsInt()
  @Min(0)
  userSalary!: number;

  @ApiProperty({ example: 10_000 })
  @IsInt()
  @Min(0)
  spouseSalary!: number;
}
