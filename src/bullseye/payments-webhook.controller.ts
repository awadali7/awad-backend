import {
  Controller,
  Headers,
  Logger,
  Post,
  Req,
  UnauthorizedException,
} from '@nestjs/common';
import { ApiExcludeController } from '@nestjs/swagger';
import type { RawBodyRequest } from '@nestjs/common';
import type { Request } from 'express';
import { RazorpayService } from '../payments/razorpay.service';
import { OrdersService } from './orders/orders.service';

interface RazorpayWebhookBody {
  event: string;
  payload?: {
    payment?: {
      entity?: { id: string; order_id: string };
    };
  };
}

/** Razorpay calls this directly — no user session, so the HMAC signature check is the auth. */
@ApiExcludeController()
@Controller('bullseye/payments')
export class PaymentsWebhookController {
  private readonly logger = new Logger(PaymentsWebhookController.name);

  constructor(
    private readonly razorpay: RazorpayService,
    private readonly ordersService: OrdersService,
  ) {}

  @Post('webhook')
  async handleWebhook(
    @Req() req: RawBodyRequest<Request>,
    @Headers('x-razorpay-signature') signature: string,
  ) {
    if (
      !req.rawBody ||
      !signature ||
      !this.razorpay.verifyWebhookSignature(req.rawBody, signature)
    ) {
      throw new UnauthorizedException('Invalid webhook signature');
    }

    const body = req.body as RazorpayWebhookBody;
    if (body.event !== 'payment.captured') {
      return { received: true };
    }

    const payment = body.payload?.payment?.entity;
    if (!payment) {
      this.logger.warn('payment.captured webhook missing payment entity');
      return { received: true };
    }

    await this.ordersService.markPaidByRazorpayOrderId(
      payment.order_id,
      payment.id,
    );
    return { received: true };
  }
}
