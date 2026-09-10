import type { Locator, Page } from '@playwright/test';
import { BasePage } from './base.page';

export interface AddressInput {
  email?: string;
  line1: string;
  line2?: string;
  city: string;
  county: string;
  postalCode: string;
  phone: string;
}

/** Card numbers the mock gateway recognises, by outcome. */
export const CARDS = {
  approved: '4242424242424242',
  declined: '4000000000000002',
  expired: '4000000000000069',
  insufficientFunds: '4000000000009995',
  gatewayError: '4000000000000119',
  invalid: '4111111111111111',
} as const;

export const VALID_ADDRESS: AddressInput = {
  email: 'guest.shopper@example.com',
  line1: 'Riverside Court, Block B',
  line2: 'Apartment 12',
  city: 'Nairobi',
  county: 'Nairobi',
  postalCode: '00100',
  phone: '0712345678',
};

export class CheckoutPage extends BasePage {
  constructor(page: Page) {
    super(page);
  }

  // ── Step 1: address ────────────────────────────────────────────────────────────

  get addressForm(): Locator {
    return this.page.getByTestId('address-form');
  }

  get emailInput(): Locator {
    return this.page.getByTestId('address-email');
  }

  get useNewAddressRadio(): Locator {
    return this.page.getByTestId('use-new-address');
  }

  get addressContinueButton(): Locator {
    return this.page.getByTestId('address-continue-btn');
  }

  addressField(name: keyof Omit<AddressInput, 'email'>): Locator {
    return this.page.getByTestId(`address-${name}`);
  }

  fieldError(field: string): Locator {
    return this.page.getByTestId(`field-error-${field}`);
  }

  savedAddress(id: string): Locator {
    return this.page.getByTestId(`saved-address-${id}`);
  }

  // ── Step 2: review ─────────────────────────────────────────────────────────────

  get reviewItems(): Locator {
    return this.page.getByTestId('review-items');
  }

  get reviewAddress(): Locator {
    return this.page.getByTestId('review-address');
  }

  get reviewEmail(): Locator {
    return this.page.getByTestId('review-email');
  }

  get reviewContinueButton(): Locator {
    return this.page.getByTestId('review-continue-btn');
  }

  get editAddressLink(): Locator {
    return this.page.getByTestId('edit-address-link');
  }

  get editCartLink(): Locator {
    return this.page.getByTestId('edit-cart-link');
  }

  reviewLineTotal(variantId: string): Locator {
    return this.page.getByTestId(`review-line-total-${variantId}`);
  }

  // ── Step 3: payment ────────────────────────────────────────────────────────────

  get cardNumberInput(): Locator {
    return this.page.getByTestId('card-number');
  }

  get cardExpiryInput(): Locator {
    return this.page.getByTestId('card-expiry');
  }

  get cardCvcInput(): Locator {
    return this.page.getByTestId('card-cvc');
  }

  get payButton(): Locator {
    return this.page.getByTestId('pay-now-btn');
  }

  get paymentError(): Locator {
    return this.page.getByTestId('payment-error');
  }

  // ── Summary, shared across steps ───────────────────────────────────────────────

  get subtotal(): Locator {
    return this.page.getByTestId('cart-subtotal');
  }

  get discount(): Locator {
    return this.page.getByTestId('cart-discount');
  }

  get shipping(): Locator {
    return this.page.getByTestId('cart-shipping');
  }

  get total(): Locator {
    return this.page.getByTestId('cart-total');
  }

  // ── Confirmation ───────────────────────────────────────────────────────────────

  get confirmationHeading(): Locator {
    return this.page.getByTestId('confirmation-heading');
  }

  get confirmationOrderNumber(): Locator {
    return this.page.getByTestId('confirmation-order-number');
  }

  get confirmationEmail(): Locator {
    return this.page.getByTestId('confirmation-email');
  }

  // ── Navigation and flows ───────────────────────────────────────────────────────

  async gotoAddress(): Promise<void> {
    await this.page.goto('/checkout/address');
    await this.addressForm.waitFor({ state: 'visible' });
  }

  async gotoReview(): Promise<void> {
    await this.page.goto('/checkout/review');
    await this.reviewItems.waitFor({ state: 'visible' });
  }

  async gotoPayment(): Promise<void> {
    await this.page.goto('/checkout/payment');
    await this.cardNumberInput.waitFor({ state: 'visible' });
  }

  /**
   * Fills the address form.
   *
   * The email field only exists for guests and the "use a different address" radio
   * only for signed-in users with a saved address, so both are conditional. The
   * conditions wait for the form to be interactive first: `isVisible()` is an instant
   * check, and an earlier version of this method used it directly, which meant that
   * while the client component was still hydrating the email fill was silently
   * skipped and the form failed server-side validation with no obvious cause.
   */
  async fillAddress(address: AddressInput): Promise<void> {
    // line1 is present in every variant of this form, so waiting for it is the
    // signal that the form is ready to be typed into.
    await this.addressField('line1').waitFor({ state: 'visible' });

    if (await this.useNewAddressRadio.isVisible()) {
      await this.useNewAddressRadio.click();
      // Choosing a different address swaps in the manual fields.
      await this.addressField('line1').waitFor({ state: 'visible' });
    }

    if (address.email) {
      const emailCount = await this.emailInput.count();
      if (emailCount > 0) {
        await this.emailInput.waitFor({ state: 'visible' });
        await this.emailInput.fill(address.email);
      }
    }

    await this.addressField('line1').fill(address.line1);
    if (address.line2) await this.addressField('line2').fill(address.line2);
    await this.addressField('city').fill(address.city);
    await this.addressField('county').fill(address.county);
    await this.addressField('postalCode').fill(address.postalCode);
    await this.addressField('phone').fill(address.phone);
  }

  /**
   * Submits the address step and waits for the outcome — either the review step, or a
   * validation message on the form. Returning on the click alone would let a caller
   * assert against a page that has not changed yet.
   */
  async submitAddress(): Promise<void> {
    await this.addressContinueButton.click();
    await this.page
      .locator(
        '[data-testid="review-items"], [data-testid^="field-error-"], [data-testid="error-banner"]',
      )
      .first()
      .waitFor({ state: 'visible' });
  }

  async continueToPayment(): Promise<void> {
    await this.reviewContinueButton.click();
    await this.cardNumberInput.waitFor({ state: 'visible' });
  }

  async fillCard(cardNumber: string, expiry = '12/28', cvc = '123'): Promise<void> {
    await this.cardNumberInput.fill(cardNumber);
    await this.cardExpiryInput.fill(expiry);
    await this.cardCvcInput.fill(cvc);
  }

  /**
   * Submits the payment and waits for whichever outcome arrives — the confirmation
   * page or an error banner. The gateway-error card deliberately takes three seconds;
   * the wait is on the resulting UI state, never on elapsed time.
   */
  async pay(): Promise<void> {
    await this.payButton.click();
    await this.page
      .locator('[data-testid="confirmation-heading"], [data-testid="payment-error"]')
      .first()
      .waitFor({ state: 'visible', timeout: 30_000 });
  }

  /** Address, review and payment in one call, for specs that are about the outcome. */
  async completeCheckout(address: AddressInput, cardNumber: string): Promise<void> {
    await this.gotoAddress();
    await this.fillAddress(address);
    await this.submitAddress();
    await this.reviewItems.waitFor({ state: 'visible' });
    await this.continueToPayment();
    await this.fillCard(cardNumber);
    await this.pay();
  }

  async orderNumber(): Promise<string> {
    return (await this.confirmationOrderNumber.innerText()).trim();
  }
}
