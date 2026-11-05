import { test, expect } from '@playwright/test';

/**
 * The mock gateway contract, per PRD 6. Tested at the route level with the request
 * fixture: no browser involved, because the contract is about HTTP, not about what
 * the checkout page does with the answer.
 */
const ENDPOINT = '/api/mock-payment';

interface PaymentBody {
  status: string;
  transactionId?: string;
  errorCode?: string;
  message: string;
}

function payload(cardNumber: string, idempotencyKey: string) {
  return {
    cardNumber,
    expiry: '12/28',
    cvc: '123',
    amountCents: 150_000,
    idempotencyKey,
  };
}

/** A key unique per test, so one test's cached result cannot leak into another. */
function key(label: string): string {
  return `api-${label}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

test.describe('SK-API: mock payment gateway', () => {
  const outcomes = [
    {
      id: 'SK-API-001',
      label: 'approved',
      card: '4242424242424242',
      http: 200,
      status: 'approved',
      errorCode: undefined,
    },
    {
      id: 'SK-API-002',
      label: 'card declined',
      card: '4000000000000002',
      http: 402,
      status: 'declined',
      errorCode: 'card_declined',
    },
    {
      id: 'SK-API-003',
      label: 'expired card',
      card: '4000000000000069',
      http: 402,
      status: 'declined',
      errorCode: 'expired_card',
    },
    {
      id: 'SK-API-004',
      label: 'insufficient funds',
      card: '4000000000009995',
      http: 402,
      status: 'declined',
      errorCode: 'insufficient_funds',
    },
    {
      id: 'SK-API-005',
      label: 'unrecognised card',
      card: '4111111111111111',
      http: 402,
      status: 'declined',
      errorCode: 'invalid_card',
    },
  ];

  for (const outcome of outcomes) {
    test(`${outcome.id} ${outcome.label} returns ${outcome.http}`, async ({ request }) => {
      const response = await request.post(ENDPOINT, {
        data: payload(outcome.card, key(outcome.label.replace(/\s+/g, '-'))),
      });

      expect(response.status()).toBe(outcome.http);

      const body = (await response.json()) as PaymentBody;
      expect(body.status).toBe(outcome.status);
      if (outcome.errorCode) expect(body.errorCode).toBe(outcome.errorCode);
      expect(body.message.length).toBeGreaterThan(0);
    });
  }

  test('SK-API-006 an approved payment carries a transaction id', async ({ request }) => {
    const response = await request.post(ENDPOINT, {
      data: payload('4242424242424242', key('txn')),
    });

    const body = (await response.json()) as PaymentBody;
    expect(body.transactionId).toBeTruthy();
    expect(body.transactionId).toMatch(/^txn_/);
  });

  test('SK-API-007 a declined payment carries no transaction id', async ({ request }) => {
    const response = await request.post(ENDPOINT, {
      data: payload('4000000000000002', key('no-txn')),
    });

    const body = (await response.json()) as PaymentBody;
    expect(body.transactionId).toBeUndefined();
  });

  /**
   * The gateway-error card is documented as taking three seconds. The assertion is on
   * the response, not on elapsed time: timing assertions are the fastest route to a
   * flaky suite. The only thing checked about duration is that the call did not
   * return instantly, which is the behaviour being described.
   */
  test('SK-API-008 the gateway error card returns 500 after its delay', async ({ request }) => {
    const startedAt = Date.now();
    const response = await request.post(ENDPOINT, {
      data: payload('4000000000000119', key('gw-error')),
      timeout: 20_000,
    });
    const elapsed = Date.now() - startedAt;

    expect(response.status()).toBe(500);

    const body = (await response.json()) as PaymentBody;
    expect(body.status).toBe('error');
    expect(body.errorCode).toBe('gateway_error');
    expect(elapsed, 'the documented delay means this cannot return immediately').toBeGreaterThan(
      2_000,
    );
  });

  test('SK-API-009 the card number never appears in the response', async ({ request }) => {
    const card = '4242424242424242';
    const response = await request.post(ENDPOINT, { data: payload(card, key('no-echo')) });
    const raw = await response.text();

    expect(raw, 'a response must never echo the card number').not.toContain(card);

    // Any run of 12 or more digits would be a card number leaking through. Checking
    // for the literal CVC would be unreliable, since a random transaction id can
    // contain any short digit sequence by chance.
    expect(raw, 'no long digit sequence should appear in the response').not.toMatch(/\d{12,}/);
  });

  test('SK-API-010 the same idempotency key yields the same transaction id', async ({
    request,
  }) => {
    const shared = key('idem-sequential');

    const first = await request.post(ENDPOINT, { data: payload('4242424242424242', shared) });
    const second = await request.post(ENDPOINT, { data: payload('4242424242424242', shared) });

    const firstBody = (await first.json()) as PaymentBody;
    const secondBody = (await second.json()) as PaymentBody;

    expect(second.status()).toBe(first.status());
    expect(secondBody.transactionId, 'a replayed key must not produce a second transaction').toBe(
      firstBody.transactionId,
    );
  });

  test('SK-API-011 concurrent calls with one key yield one transaction', async ({ request }) => {
    const shared = key('idem-concurrent');

    // Fired together rather than in sequence: the route has to be safe against a
    // genuine race, not just against a replay.
    const [first, second, third] = await Promise.all([
      request.post(ENDPOINT, { data: payload('4242424242424242', shared) }),
      request.post(ENDPOINT, { data: payload('4242424242424242', shared) }),
      request.post(ENDPOINT, { data: payload('4242424242424242', shared) }),
    ]);

    const bodies = (await Promise.all([
      first.json(),
      second.json(),
      third.json(),
    ])) as PaymentBody[];
    const ids = new Set(bodies.map((body) => body.transactionId));

    expect(ids.size, 'three concurrent calls with one key must settle on one result').toBe(1);
  });

  test('SK-API-012 a malformed body is rejected with 400', async ({ request }) => {
    const response = await request.post(ENDPOINT, {
      data: {
        cardNumber: 'not-a-card',
        expiry: 'nope',
        cvc: '1',
        amountCents: -5,
        idempotencyKey: 'x',
      },
    });

    expect(response.status()).toBe(400);
    const body = (await response.json()) as PaymentBody;
    expect(body.errorCode).toBe('invalid_request');
  });

  test('SK-API-013 a missing field is rejected', async ({ request }) => {
    const response = await request.post(ENDPOINT, {
      data: { cardNumber: '4242424242424242', idempotencyKey: key('missing') },
    });

    expect(response.status()).toBe(400);
  });

  test('SK-API-014 a non-JSON body is rejected without a stack trace', async ({ request }) => {
    const response = await request.post(ENDPOINT, {
      data: 'this is not json',
      headers: { 'content-type': 'application/json' },
    });

    expect(response.status()).toBe(400);
    const raw = await response.text();
    expect(raw, 'no stack trace should reach the client').not.toContain('at ');
  });

  test('SK-API-015 spaces and hyphens in the card number are tolerated', async ({ request }) => {
    const response = await request.post(ENDPOINT, {
      data: payload('4242 4242 4242 4242', key('spaced')),
    });

    expect(response.status()).toBe(200);
    const body = (await response.json()) as PaymentBody;
    expect(body.status).toBe('approved');
  });

  test('SK-API-016 an expiry in the wrong format is rejected', async ({ request }) => {
    const response = await request.post(ENDPOINT, {
      data: { ...payload('4242424242424242', key('bad-expiry')), expiry: '2028-12' },
    });

    expect(response.status()).toBe(400);
  });
});
