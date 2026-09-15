import { Injectable } from '@nestjs/common';
import Razorpay from 'razorpay';
import { verifySignature } from './razorpay-signature.util';

@Injectable()
export class RazorpayService {
  private readonly client: Razorpay;

  constructor() {
    const keyId = process.env.RAZORPAY_KEY_ID;
    const keySecret = process.env.RAZORPAY_KEY_SECRET;
    if (!keyId || !keySecret) {
      throw new Error(
        'RAZORPAY_KEY_ID / RAZORPAY_KEY_SECRET are not configured on the server',
      );
    }
    this.client = new Razorpay({ key_id: keyId, key_secret: keySecret });
  }

  async createOrder(params: {
    amountInPaise: number;
    receipt: string;
  }): Promise<{ id: string }> {
    const order = await this.client.orders.create({
      amount: params.amountInPaise,
      currency: 'INR',
      receipt: params.receipt,
    });
    return { id: order.id };
  }

  verifyOrderPaymentSignature(
    razorpayOrderId: string,
    razorpayPaymentId: string,
    signature: string,
  ): boolean {
    const secret = process.env.RAZORPAY_KEY_SECRET;
    if (!secret) {
      throw new Error('RAZORPAY_KEY_SECRET is not configured on the server');
    }
    const payload = `${razorpayOrderId}|${razorpayPaymentId}`;
    return verifySignature(payload, signature, secret);
  }

  verifyWebhookSignature(rawBody: Buffer, signature: string): boolean {
    const secret = process.env.RAZORPAY_WEBHOOK_SECRET;
    if (!secret) {
      throw new Error(
        'RAZORPAY_WEBHOOK_SECRET is not configured on the server',
      );
    }
    return verifySignature(rawBody.toString('utf8'), signature, secret);
  }
}
