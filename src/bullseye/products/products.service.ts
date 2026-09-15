import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { Prisma } from '../../../generated/prisma/client';
import { CreateProductDto } from './dto/create-product.dto';
import { UpdateProductDto } from './dto/update-product.dto';

// Never includes downloadUrl — the digital asset must never be visible before payment.
const PUBLIC_PRODUCT_SELECT = {
  id: true,
  slug: true,
  name: true,
  description: true,
  priceInPaise: true,
  imageUrl: true,
  createdAt: true,
} satisfies Prisma.ProductSelect;

@Injectable()
export class ProductsService {
  constructor(private readonly prisma: PrismaService) {}

  findAllPublic() {
    return this.prisma.product.findMany({
      where: { archived: false },
      select: PUBLIC_PRODUCT_SELECT,
      orderBy: { createdAt: 'asc' },
    });
  }

  async findBySlugPublic(slug: string) {
    const product = await this.prisma.product.findFirst({
      where: { slug, archived: false },
      select: PUBLIC_PRODUCT_SELECT,
    });
    if (!product) throw new NotFoundException(`Product ${slug} not found`);
    return product;
  }

  async create(dto: CreateProductDto) {
    try {
      return await this.prisma.product.create({ data: dto });
    } catch (err) {
      if (
        err instanceof Prisma.PrismaClientKnownRequestError &&
        err.code === 'P2002'
      ) {
        throw new ConflictException(
          `Product slug "${dto.slug}" already exists`,
        );
      }
      throw err;
    }
  }

  async update(id: string, dto: UpdateProductDto) {
    await this.findOneOrThrow(id);
    return this.prisma.product.update({ where: { id }, data: dto });
  }

  async archive(id: string) {
    await this.findOneOrThrow(id);
    await this.prisma.product.update({
      where: { id },
      data: { archived: true },
    });
  }

  private async findOneOrThrow(id: string) {
    const product = await this.prisma.product.findUnique({ where: { id } });
    if (!product) throw new NotFoundException(`Product ${id} not found`);
    return product;
  }
}
