import { NextResponse } from 'next/server';
import { randomUUID } from 'crypto';
import { mockPaymentSchema } from '@/schemas/payment';

/**
 * Stand-in payment gateway. The outcome is a pure function of the card number so
 * the test suite can drive every branch without a network call or a sandbox
 * account.
 *
 * The card number never leaves this module: it is not logged, not persisted, and
 * not echoed in the response body.
 */

export interface PaymentResponse {
  status: 'approved' | 'declined' | 'error';
  transactionId?: string;
  errorCode?: string;
  message: string;
}

interface Outcome {
  response: PaymentResponse;
  http: number;
  delayMs?: number;
}

const OUTCOMES: Record<string, Outcome> = {
  '4242424242424242': {
    http: 200,
    response: { status: 'approved', message: 'Payment approved.' },
  },
  '4000000000000002': {
    http: 402,
    response: {
      status: 'declined',
      errorCode: 'card_declined',
      message: 'Your card was declined.',
    },
  },
  '4000000000000069': {
    http: 402,
    response: { status: 'declined', errorCode: 'expired_card', message: 'That card has expired.' },
  },
  '4000000000009995': {
    http: 402,
    response: {
      status: 'declined',
      errorCode: 'insufficient_funds',
      message: 'Insufficient funds on that card.',
    },
  },
  '4000000000000119': {
    http: 500,
    delayMs: 3000,
    response: {
      status: 'error',
      errorCode: 'gateway_error',
      message: 'The payment gateway is unavailable. Please try again.',
    },
  },
};

const INVALID_CARD: Outcome = {
  http: 402,
  response: { status: 'declined', errorCode: 'invalid_card', message: 'That card is not valid.' },
};

/**
 * Results are retained per idempotency key so a replayed request — including one
 * arriving while the first is still in flight — yields the same answer rather than
 * a second charge. The promise, not the resolved value, is what gets cached, which
 * is what makes concurrent duplicates safe.
 */
const inFlight = new Map<string, Promise<{ body: PaymentResponse; http: number }>>();

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function settle(cardNumber: string): Promise<{ body: PaymentResponse; http: number }> {
  const outcome = OUTCOMES[cardNumber] ?? INVALID_CARD;
  if (outcome.delayMs !== undefined) await sleep(outcome.delayMs);

  const body: PaymentResponse = { ...outcome.response };
  if (body.status === 'approved') body.transactionId = `txn_${randomUUID()}`;
  return { body, http: outcome.http };
}

export async function POST(request: Request): Promise<NextResponse> {
  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return NextResponse.json(
      { status: 'error', errorCode: 'invalid_request', message: 'Request body must be JSON.' },
      { status: 400 },
    );
  }

  const parsed = mockPaymentSchema.safeParse(payload);
  if (!parsed.success) {
    return NextResponse.json(
      {
        status: 'error',
        errorCode: 'invalid_request',
        message: parsed.error.issues[0]?.message ?? 'Invalid payment details.',
      },
      { status: 400 },
    );
  }

  const { cardNumber, idempotencyKey } = parsed.data;

  let pending = inFlight.get(idempotencyKey);
  if (!pending) {
    pending = settle(cardNumber);
    inFlight.set(idempotencyKey, pending);
  }

  const { body, http } = await pending;
  return NextResponse.json(body, { status: http });
}
