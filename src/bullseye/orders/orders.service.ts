import {
  BadGatewayException,
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { randomUUID } from 'crypto';
import { PrismaService } from '../../prisma/prisma.service';
import { RazorpayService } from '../../payments/razorpay.service';
import { Order } from '../../../generated/prisma/client';
import { CreateOrderDto } from './dto/create-order.dto';
import { VerifyOrderDto } from './dto/verify-order.dto';

const ORDER_WITH_PRODUCT_INCLUDE = {
  product: {
    select: { name: true, slug: true, imageUrl: true, downloadUrl: true },
  },
} as const;

type OrderWithProduct = Order & {
  product: {
    name: string;
    slug: string;
    imageUrl: string | null;
    downloadUrl: string;
  };
};

@Injectable()
export class OrdersService {
  private readonly logger = new Logger(OrdersService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly razorpay: RazorpayService,
  ) {}

  async create(userId: string, dto: CreateOrderDto) {
    const product = await this.prisma.product.findFirst({
      where: { slug: dto.productSlug, archived: false },
    });
    if (!product) {
      throw new NotFoundException(`Product ${dto.productSlug} not found`);
    }

    const orderId = randomUUID();
    let razorpayOrder: { id: string };
    try {
      razorpayOrder = await this.razorpay.createOrder({
        amountInPaise: product.priceInPaise,
        receipt: orderId,
      });
    } catch (err) {
      this.logger.error('Razorpay order creation failed', err as Error);
      throw new BadGatewayException(
        'Could not initiate payment, please try again',
      );
    }

    await this.prisma.order.create({
      data: {
        id: orderId,
        userId,
        productId: product.id,
        amountInPaise: product.priceInPaise,
        status: 'created',
        razorpayOrderId: razorpayOrder.id,
      },
    });

    return {
      orderId,
      razorpayOrderId: razorpayOrder.id,
      amount: product.priceInPaise,
      currency: 'INR',
      keyId: process.env.RAZORPAY_KEY_ID,
    };
  }

  async verify(userId: string, orderId: string, dto: VerifyOrderDto) {
    const order = await this.findOwnedOrThrow(userId, orderId);

    if (order.status === 'paid') {
      return this.serialize(order);
    }
    if (!order.razorpayOrderId) {
      throw new BadRequestException(
        'Order has no associated payment to verify',
      );
    }

    const isValid = this.razorpay.verifyOrderPaymentSignature(
      order.razorpayOrderId,
      dto.razorpayPaymentId,
      dto.razorpaySignature,
    );
    if (!isValid) {
      // Deliberately not marking the order `failed` — the webhook remains the
      // source of truth in case this call was spoofed, retried, or missed.
      throw new BadRequestException('Payment signature verification failed');
    }

    const updated = await this.prisma.order.update({
      where: { id: order.id },
      data: {
        status: 'paid',
        razorpayPaymentId: dto.razorpayPaymentId,
        razorpaySignature: dto.razorpaySignature,
      },
      include: ORDER_WITH_PRODUCT_INCLUDE,
    });
    return this.serialize(updated);
  }

  async findAllForUser(userId: string) {
    const orders = await this.prisma.order.findMany({
      where: { userId },
      include: ORDER_WITH_PRODUCT_INCLUDE,
      orderBy: { createdAt: 'desc' },
    });
    return orders.map((order) => this.serialize(order));
  }

  async findOneForUser(userId: string, orderId: string) {
    const order = await this.findOwnedOrThrow(userId, orderId);
    return this.serialize(order);
  }

  /** Called by the webhook handler. Idempotent: a no-op if already paid. */
  async markPaidByRazorpayOrderId(
    razorpayOrderId: string,
    razorpayPaymentId: string,
  ) {
    const order = await this.prisma.order.findUnique({
      where: { razorpayOrderId },
    });
    if (!order) {
      this.logger.warn(
        `Webhook: no order found for razorpayOrderId=${razorpayOrderId}`,
      );
      return;
    }
    if (order.status === 'paid') {
      return;
    }
    await this.prisma.order.update({
      where: { id: order.id },
      data: { status: 'paid', razorpayPaymentId },
    });
  }

  private async findOwnedOrThrow(
    userId: string,
    orderId: string,
  ): Promise<OrderWithProduct> {
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      include: ORDER_WITH_PRODUCT_INCLUDE,
    });
    if (!order || order.userId !== userId) {
      // 404, not 403 — don't reveal that an order id exists but belongs to someone else.
      throw new NotFoundException(`Order ${orderId} not found`);
    }
    return order;
  }

  private serialize(order: OrderWithProduct) {
    return {
      id: order.id,
      status: order.status,
      amountInPaise: order.amountInPaise,
      createdAt: order.createdAt,
      product: {
        name: order.product.name,
        slug: order.product.slug,
        imageUrl: order.product.imageUrl,
      },
      downloadUrl:
        order.status === 'paid' ? order.product.downloadUrl : undefined,
    };
  }
}
