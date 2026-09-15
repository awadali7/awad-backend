import { createHmac } from 'crypto';
import { verifySignature } from './razorpay-signature.util';

describe('verifySignature', () => {
  const secret = 'test-secret';
  const payload = 'order_123|pay_456';
  const validSignature = createHmac('sha256', secret)
    .update(payload)
    .digest('hex');

  it('returns true for a matching signature', () => {
    expect(verifySignature(payload, validSignature, secret)).toBe(true);
  });

  it('returns false for a wrong signature', () => {
    const wrongSignature = createHmac('sha256', 'wrong-secret')
      .update(payload)
      .digest('hex');
    expect(verifySignature(payload, wrongSignature, secret)).toBe(false);
  });

  it('returns false for a tampered payload', () => {
    expect(verifySignature('order_999|pay_456', validSignature, secret)).toBe(
      false,
    );
  });

  it('returns false (not throw) for a signature of a different length', () => {
    expect(() => verifySignature(payload, 'short', secret)).not.toThrow();
    expect(verifySignature(payload, 'short', secret)).toBe(false);
  });
});
