import { createHmac, timingSafeEqual } from 'crypto';

/**
 * Verifies a Razorpay HMAC-SHA256 signature. Used for both the client-side
 * payment-verification payload (`orderId|paymentId`) and the raw webhook body.
 */
export function verifySignature(
  payload: string,
  signature: string,
  secret: string,
): boolean {
  const expected = createHmac('sha256', secret).update(payload).digest('hex');

  const expectedBuffer = Buffer.from(expected, 'utf8');
  const providedBuffer = Buffer.from(signature, 'utf8');
  if (expectedBuffer.length !== providedBuffer.length) {
    return false;
  }
  return timingSafeEqual(expectedBuffer, providedBuffer);
}
