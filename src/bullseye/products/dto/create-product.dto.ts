import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsInt, IsOptional, IsString, Min } from 'class-validator';

export class CreateProductDto {
  @ApiProperty({ example: 'my-ebook' })
  @IsString()
  slug!: string;

  @ApiProperty({ example: 'My Ebook' })
  @IsString()
  name!: string;

  @ApiProperty({ example: 'A short description of the product.' })
  @IsString()
  description!: string;

  @ApiProperty({
    description: 'Price in paise (smallest INR unit)',
    example: 19900,
  })
  @IsInt()
  @Min(100)
  priceInPaise!: number;

  @ApiProperty({ example: 'https://cdn.example.com/files/my-ebook.pdf' })
  @IsString()
  downloadUrl!: string;

  @ApiPropertyOptional({
    example: 'https://cdn.example.com/images/my-ebook.png',
  })
  @IsOptional()
  @IsString()
  imageUrl?: string;
}
