import { test, expect } from '../../fixtures/base';
import { USERS } from '../../fixtures/users';
import { testDb, createOrderFor, uniqueOrderNumber } from '../../fixtures/db';
import type { OrderStatus } from '../../pages/admin.page';

/**
 * The order status state machine, per PRD 4.8.
 *
 * Parametrised across every from/to pair in the lifecycle, so each transition is
 * named in its own test and a failure says exactly which one broke. Legal transitions
 * must succeed and illegal ones must be refused: including DELIVERED back to
 * PENDING, which the spec calls out explicitly.
 *
 * The admin UI only offers legal targets from a given status, so reaching an illegal
 * one needs the action invoked directly. That is what the API-level test in this file
 * does, and it is the only way to tell "the server refused" apart from "the dropdown
 * did not offer it".
 */
const ALL_STATUSES: OrderStatus[] = [
  'PENDING',
  'PAID',
  'PROCESSING',
  'SHIPPED',
  'DELIVERED',
  'CANCELLED',
];

/** The lifecycle from PRD 4.8, restated here so the test carries its own oracle. */
const LEGAL: Record<OrderStatus, OrderStatus[]> = {
  PENDING: ['PAID', 'CANCELLED'],
  PAID: ['PROCESSING', 'CANCELLED'],
  PROCESSING: ['SHIPPED', 'CANCELLED'],
  SHIPPED: ['DELIVERED'],
  DELIVERED: [],
  CANCELLED: [],
};

test.use({ storageState: USERS.admin.storageState });

/**
 * Creates an order parked at a given status, for one test to move.
 *
 * The order number comes from the shared fixture helper, which guarantees uniqueness
 * across workers. This used to draw a random six-digit suffix, which was only
 * probably unique: and it shared its range with literals hardcoded in other specs,
 * so it eventually collided. See docs/TRIAGE_NOTES.md.
 */
async function orderAt(status: OrderStatus, prefix: string) {
  const orderNumber = uniqueOrderNumber();

  await testDb.orderItem.deleteMany({ where: { order: { orderNumber } } });
  await testDb.order.deleteMany({ where: { orderNumber } });

  const order = await createOrderFor({
    email: USERS.customer.email,
    idempotencyKey: `${prefix}-${orderNumber}-${Date.now()}`,
    orderNumber,
    status,
  });
  return order;
}

async function removeOrder(orderNumber: string): Promise<void> {
  await testDb.orderItem.deleteMany({ where: { order: { orderNumber } } });
  await testDb.order.deleteMany({ where: { orderNumber } });
}

test.describe('SK-ADM: order status, legal transitions', () => {
  for (const from of ALL_STATUSES) {
    for (const to of LEGAL[from]) {
      test(`SK-ADM-0${ALL_STATUSES.indexOf(from)}${ALL_STATUSES.indexOf(to)} ${from} to ${to} is allowed`, async ({
        adminPage,
      }) => {
        const order = await orderAt(from, 'adm-legal');
        try {
          await adminPage.gotoOrderDetail(order.id);
          await expect(adminPage.currentStatus).toHaveText(from);

          await adminPage.changeStatus(to);

          // Asserted against the stored status rather than the success banner: moving
          // into a terminal status replaces the whole form, banner included, so the
          // banner is not a reliable witness for every legal transition.
          const updated = await testDb.order.findUniqueOrThrow({ where: { id: order.id } });
          expect(updated.status, `${from} to ${to} should be accepted`).toBe(to);
          await expect(adminPage.statusError).toBeHidden();
        } finally {
          await removeOrder(order.orderNumber);
        }
      });
    }
  }

  test('SK-ADM-090 a terminal status offers no transitions', async ({ adminPage }) => {
    for (const terminal of ['DELIVERED', 'CANCELLED'] as OrderStatus[]) {
      const order = await orderAt(terminal, 'adm-terminal');
      try {
        await adminPage.gotoOrderDetail(order.id);

        await expect(
          adminPage.statusTerminal,
          `${terminal} is terminal, so the UI should offer nothing`,
        ).toBeVisible();
        expect(await adminPage.availableStatusTargets()).toEqual([]);
      } finally {
        await removeOrder(order.orderNumber);
      }
    }
  });

  test('SK-ADM-091 the UI offers exactly the legal targets', async ({ adminPage }) => {
    for (const from of ALL_STATUSES) {
      if (LEGAL[from].length === 0) continue;

      const order = await orderAt(from, 'adm-offers');
      try {
        await adminPage.gotoOrderDetail(order.id);
        const offered = await adminPage.availableStatusTargets();

        expect(
          offered.sort(),
          `from ${from} the dropdown should offer exactly ${LEGAL[from].join(', ')}`,
        ).toEqual([...LEGAL[from]].sort());
      } finally {
        await removeOrder(order.orderNumber);
      }
    }
  });
});

/**
 * Illegal transitions. These go at the server action directly, because the dropdown
 * filters its options and so cannot express an illegal request.
 *
 * A server action is reached by posting to its route with the action id Next.js
 * assigns, which is build-specific. Rather than depend on that, these drive the
 * action the way the application does: through the page: but with the select's
 * options replaced so an illegal value can be submitted. The DOM is altered, not the
 * application, and what is being asserted is entirely server-side.
 */
test.describe('SK-ADM: order status, illegal transitions refused', () => {
  /**
   * Transitions out of a non-terminal status. The page renders a form for these, so
   * widening its options is enough to put the request in front of the server.
   *
   * DELIVERED and CANCELLED are terminal and render no form, so they cannot be
   * exercised this way and are covered separately below.
   */
  const illegal: Array<{ from: OrderStatus; to: OrderStatus }> = [
    { from: 'PENDING', to: 'SHIPPED' },
    { from: 'PENDING', to: 'DELIVERED' },
    { from: 'PENDING', to: 'PROCESSING' },
    { from: 'PAID', to: 'DELIVERED' },
    { from: 'PAID', to: 'PENDING' },
    { from: 'PAID', to: 'SHIPPED' },
    { from: 'PROCESSING', to: 'PENDING' },
    { from: 'PROCESSING', to: 'PAID' },
    { from: 'PROCESSING', to: 'DELIVERED' },
    { from: 'SHIPPED', to: 'PROCESSING' },
    { from: 'SHIPPED', to: 'CANCELLED' },
    { from: 'SHIPPED', to: 'PENDING' },
  ];

  for (const transition of illegal) {
    test(`SK-ADM-1${illegal.indexOf(transition).toString().padStart(2, '0')} ${transition.from} to ${transition.to} is refused`, async ({
      adminPage,
    }) => {
      const order = await orderAt(transition.from, 'adm-illegal');

      try {
        await adminPage.gotoOrderDetail(order.id);

        const submitted = await adminPage.forceStatus(transition.to);
        expect(
          submitted,
          'the request must actually have been sent for this assertion to mean anything',
        ).toBe(true);

        const updated = await testDb.order.findUniqueOrThrow({ where: { id: order.id } });
        expect(
          updated.status,
          `${transition.from} to ${transition.to} is not in the lifecycle and must be refused`,
        ).toBe(transition.from);
      } finally {
        await removeOrder(order.orderNumber);
      }
    });
  }

  /**
   * The terminal statuses. These render no status form, so the only way to put a
   * request in front of the action is to reach it the way any client would, through
   * the page that owns it. DELIVERED to PENDING is the case PRD 4.8 names explicitly.
   */
  const terminalIllegal: Array<{ from: OrderStatus; to: OrderStatus }> = [
    { from: 'DELIVERED', to: 'PENDING' },
    { from: 'DELIVERED', to: 'SHIPPED' },
    { from: 'DELIVERED', to: 'CANCELLED' },
    { from: 'CANCELLED', to: 'PAID' },
    { from: 'CANCELLED', to: 'PENDING' },
    { from: 'CANCELLED', to: 'DELIVERED' },
  ];

  for (const transition of terminalIllegal) {
    test(`SK-ADM-2${terminalIllegal.indexOf(transition).toString().padStart(2, '0')} ${transition.from} to ${transition.to} is refused`, async ({
      adminPage,
    }) => {
      const order = await orderAt(transition.from, 'adm-terminal-illegal');

      try {
        await adminPage.gotoOrderDetail(order.id);

        // The page confirms there is no legal move from here.
        await expect(adminPage.statusTerminal).toBeVisible();

        // Borrow a form from an order that is not terminal, retarget it at this order,
        // and submit. The browser posts to the same server action either way, so what
        // is being tested is the action's own check rather than the page's rendering.
        const mover = await orderAt('PENDING', 'adm-terminal-mover');
        try {
          await adminPage.gotoOrderDetail(mover.id);
          await adminPage.retargetStatusForm(order.id, transition.to);

          const updated = await testDb.order.findUniqueOrThrow({ where: { id: order.id } });
          expect(
            updated.status,
            `${transition.from} is terminal, so ${transition.to} must be refused`,
          ).toBe(transition.from);
        } finally {
          await removeOrder(mover.orderNumber);
        }
      } finally {
        await removeOrder(order.orderNumber);
      }
    });
  }
});
