import { ApiProperty } from '@nestjs/swagger';
import { IsString } from 'class-validator';

export class CreateOrderDto {
  @ApiProperty({ example: 'my-ebook' })
  @IsString()
  productSlug!: string;
}
