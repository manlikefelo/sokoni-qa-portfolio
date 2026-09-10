import type { Locator, Page } from '@playwright/test';
import { BasePage } from './base.page';

export class AccountPage extends BasePage {
  constructor(page: Page) {
    super(page);
  }

  get profileName(): Locator {
    return this.page.getByTestId('profile-name');
  }

  get profileEmail(): Locator {
    return this.page.getByTestId('profile-email');
  }

  // ── Password change ────────────────────────────────────────────────────────────

  get currentPasswordInput(): Locator {
    return this.page.getByTestId('password-currentPassword');
  }

  get newPasswordInput(): Locator {
    return this.page.getByTestId('password-newPassword');
  }

  get confirmPasswordInput(): Locator {
    return this.page.getByTestId('password-confirmPassword');
  }

  get passwordSubmit(): Locator {
    return this.page.getByTestId('password-submit');
  }

  get passwordSuccess(): Locator {
    return this.page.getByTestId('password-success');
  }

  get passwordError(): Locator {
    return this.page.getByTestId('password-error');
  }

  // ── Orders ─────────────────────────────────────────────────────────────────────

  get ordersList(): Locator {
    return this.page.getByTestId('orders-list');
  }

  get ordersEmpty(): Locator {
    return this.page.getByTestId('orders-empty');
  }

  orderRow(orderNumber: string): Locator {
    return this.page.getByTestId(`order-row-${orderNumber}`);
  }

  orderLink(orderNumber: string): Locator {
    return this.page.getByTestId(`order-link-${orderNumber}`);
  }

  orderTotal(orderNumber: string): Locator {
    return this.page.getByTestId(`order-total-${orderNumber}`);
  }

  orderStatus(orderNumber: string): Locator {
    return this.page.getByTestId(`order-status-${orderNumber}`);
  }

  get orderDetailNumber(): Locator {
    return this.page.getByTestId('order-detail-number');
  }

  get orderDetailStatus(): Locator {
    return this.page.getByTestId('order-detail-status');
  }

  // ── Addresses ──────────────────────────────────────────────────────────────────

  get addressList(): Locator {
    return this.page.getByTestId('address-list');
  }

  get addressEmpty(): Locator {
    return this.page.getByTestId('address-empty');
  }

  get addAddressButton(): Locator {
    return this.page.getByTestId('address-add-btn');
  }

  get addressSaveButton(): Locator {
    return this.page.getByTestId('address-save-btn');
  }

  get addressCancelButton(): Locator {
    return this.page.getByTestId('address-cancel-btn');
  }

  get addressDefaultCheckbox(): Locator {
    return this.page.getByTestId('address-input-isDefault');
  }

  get addressSuccess(): Locator {
    return this.page.getByTestId('address-success');
  }

  get addressError(): Locator {
    return this.page.getByTestId('address-error');
  }

  addressInput(field: string): Locator {
    return this.page.getByTestId(`address-input-${field}`);
  }

  addressCard(id: string): Locator {
    return this.page.getByTestId(`address-card-${id}`);
  }

  addressDefaultBadge(id: string): Locator {
    return this.page.getByTestId(`address-default-badge-${id}`);
  }

  addressEditButton(id: string): Locator {
    return this.page.getByTestId(`address-edit-${id}`);
  }

  addressDeleteButton(id: string): Locator {
    return this.page.getByTestId(`address-delete-${id}`);
  }

  addressSetDefaultButton(id: string): Locator {
    return this.page.getByTestId(`address-set-default-${id}`);
  }

  fieldError(field: string): Locator {
    return this.page.getByTestId(`field-error-${field}`);
  }

  // ── Navigation ─────────────────────────────────────────────────────────────────

  async gotoProfile(): Promise<void> {
    await this.page.goto('/account');
    await this.profileEmail.waitFor({ state: 'visible' });
  }

  async gotoOrders(): Promise<void> {
    await this.page.goto('/account/orders');
    await this.page
      .locator('[data-testid="orders-list"], [data-testid="orders-empty"]')
      .first()
      .waitFor({ state: 'visible' });
  }

  async gotoOrderDetail(orderNumber: string): Promise<void> {
    await this.page.goto(`/account/orders/${orderNumber}`);
  }

  async gotoAddresses(): Promise<void> {
    await this.page.goto('/account/addresses');
    await this.page
      .locator('[data-testid="address-list"], [data-testid="address-empty"]')
      .first()
      .waitFor({ state: 'visible' });
  }

  async changePassword(current: string, next: string, confirm = next): Promise<void> {
    await this.currentPasswordInput.fill(current);
    await this.newPasswordInput.fill(next);
    await this.confirmPasswordInput.fill(confirm);
    await this.passwordSubmit.click();
    await this.page
      .locator(
        '[data-testid="password-success"], [data-testid="password-error"], [data-testid^="field-error-"]',
      )
      .first()
      .waitFor({ state: 'visible' });
  }

  async addAddress(fields: Record<string, string>, asDefault = false): Promise<void> {
    await this.addAddressButton.click();
    for (const [field, value] of Object.entries(fields)) {
      await this.addressInput(field).fill(value);
    }
    const checked = await this.addressDefaultCheckbox.isChecked();
    if (checked !== asDefault) await this.addressDefaultCheckbox.click();
    await this.addressSaveButton.click();
    await this.page
      .locator(
        '[data-testid="address-success"], [data-testid="address-error"], [data-testid^="field-error-"]',
      )
      .first()
      .waitFor({ state: 'visible' });
  }

  async addressCount(): Promise<number> {
    return this.page.locator('[data-testid^="address-card-"]').count();
  }
}
