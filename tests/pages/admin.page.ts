import type { Locator, Page } from '@playwright/test';
import { BasePage } from './base.page';

export type OrderStatus = 'PENDING' | 'PAID' | 'PROCESSING' | 'SHIPPED' | 'DELIVERED' | 'CANCELLED';

export class AdminPage extends BasePage {
  constructor(page: Page) {
    super(page);
  }

  // ── Overview ───────────────────────────────────────────────────────────────────

  get nav(): Locator {
    return this.page.getByTestId('admin-nav');
  }

  statTile(name: string): Locator {
    return this.page.getByTestId(`stat-${name}`);
  }

  // ── Products ───────────────────────────────────────────────────────────────────

  get productList(): Locator {
    return this.page.getByTestId('admin-product-list');
  }

  get newProductLink(): Locator {
    return this.page.getByTestId('admin-new-product-link');
  }

  get productSaveButton(): Locator {
    return this.page.getByTestId('admin-product-save');
  }

  get productSuccess(): Locator {
    return this.page.getByTestId('admin-product-success');
  }

  get productError(): Locator {
    return this.page.getByTestId('admin-product-error');
  }

  productRow(slug: string): Locator {
    return this.page.getByTestId(`admin-product-${slug}`);
  }

  productState(slug: string): Locator {
    return this.page.getByTestId(`admin-product-state-${slug}`);
  }

  productEditLink(slug: string): Locator {
    return this.page.getByTestId(`admin-edit-${slug}`);
  }

  productActiveToggle(slug: string): Locator {
    return this.page.getByTestId(`admin-toggle-active-${slug}`);
  }

  productField(
    field: 'name' | 'slug' | 'description' | 'category' | 'price' | 'image' | 'active',
  ): Locator {
    return this.page.getByTestId(`admin-product-${field}`);
  }

  fieldError(field: string): Locator {
    return this.page.getByTestId(`field-error-${field}`);
  }

  // ── Stock ──────────────────────────────────────────────────────────────────────

  stockInput(sku: string): Locator {
    return this.page.getByTestId(`admin-stock-input-${sku}`);
  }

  stockSaveButton(sku: string): Locator {
    return this.page.getByTestId(`admin-stock-save-${sku}`);
  }

  stockMessage(sku: string): Locator {
    return this.page.getByTestId(`admin-stock-message-${sku}`);
  }

  // ── Orders ─────────────────────────────────────────────────────────────────────

  get ordersList(): Locator {
    return this.page.getByTestId('admin-orders-list');
  }

  get ordersEmpty(): Locator {
    return this.page.getByTestId('admin-orders-empty');
  }

  get statusFilter(): Locator {
    return this.page.getByTestId('admin-status-filter');
  }

  statusFilterLink(status: OrderStatus | 'all'): Locator {
    return this.page.getByTestId(`admin-filter-${status === 'all' ? 'all' : status}`);
  }

  orderRow(orderNumber: string): Locator {
    return this.page.getByTestId(`admin-order-${orderNumber}`);
  }

  orderLink(orderNumber: string): Locator {
    return this.page.getByTestId(`admin-order-link-${orderNumber}`);
  }

  orderListStatus(orderNumber: string): Locator {
    return this.page.getByTestId(`admin-order-status-${orderNumber}`);
  }

  get orderDetailNumber(): Locator {
    return this.page.getByTestId('admin-order-number');
  }

  get currentStatus(): Locator {
    return this.page.getByTestId('admin-order-current-status');
  }

  get statusSelect(): Locator {
    return this.page.getByTestId('status-select');
  }

  get statusSubmit(): Locator {
    return this.page.getByTestId('status-submit');
  }

  get statusSuccess(): Locator {
    return this.page.getByTestId('status-success');
  }

  get statusError(): Locator {
    return this.page.getByTestId('status-error');
  }

  get statusTerminal(): Locator {
    return this.page.getByTestId('status-terminal');
  }

  // ── Navigation ─────────────────────────────────────────────────────────────────

  async gotoOverview(): Promise<void> {
    await this.page.goto('/admin');
  }

  async gotoProducts(): Promise<void> {
    await this.page.goto('/admin/products');
    await this.productList.waitFor({ state: 'visible' });
  }

  async gotoNewProduct(): Promise<void> {
    await this.page.goto('/admin/products/new');
    await this.productField('name').waitFor({ state: 'visible' });
  }

  async gotoEditProduct(id: string): Promise<void> {
    await this.page.goto(`/admin/products/${id}`);
    await this.productField('name').waitFor({ state: 'visible' });
  }

  async gotoOrders(status?: OrderStatus): Promise<void> {
    await this.page.goto(status ? `/admin/orders?status=${status}` : '/admin/orders');
    await this.page
      .locator('[data-testid="admin-orders-list"], [data-testid="admin-orders-empty"]')
      .first()
      .waitFor({ state: 'visible' });
  }

  async gotoOrderDetail(id: string): Promise<void> {
    await this.page.goto(`/admin/orders/${id}`);
    await this.orderDetailNumber.waitFor({ state: 'visible' });
  }

  /** The transitions the UI offers from the order's current status. */
  async availableStatusTargets(): Promise<string[]> {
    if (await this.statusTerminal.isVisible()) return [];
    return this.statusSelect.locator('option').allInnerTexts();
  }

  /**
   * Changes the order's status and waits for the outcome.
   *
   * A move into a terminal status is a special case: the revalidated page replaces the
   * status form with the "no further changes" notice, so the success banner is unmounted
   * along with the form it lived in. Waiting only for the banner therefore times out on
   * a transition that actually succeeded. The terminal notice and the current-status
   * readout are both accepted as evidence the request was handled.
   */
  async changeStatus(target: OrderStatus): Promise<void> {
    await this.statusSelect.selectOption(target);
    await this.statusSubmit.click();
    await this.page
      .locator(
        '[data-testid="status-success"], [data-testid="status-error"], [data-testid="status-terminal"]',
      )
      .first()
      .waitFor({ state: 'visible' });
  }

  /**
   * Submits a status the dropdown does not offer, by reusing the form the page already
   * rendered and only widening its options.
   *
   * The admin UI lists just the transitions that are legal from the current status, so
   * an illegal one cannot be selected normally. Adding the option to the real select
   * and submitting the real form is how a determined user would do it, and the server
   * must refuse anyway.
   *
   * Returns false when the page rendered no form at all, which is the case for a
   * terminal status. A caller must decide what that means rather than being handed a
   * silent success — an earlier version of this method built a detached form instead,
   * which submitted nowhere and made every terminal-status test pass without ever
   * reaching the server. A test that cannot fail is worse than no test.
   */
  async forceStatus(target: OrderStatus): Promise<boolean> {
    if (await this.statusTerminal.isVisible()) return false;
    if ((await this.statusSelect.count()) === 0) return false;

    await this.statusSelect.evaluate((element, status) => {
      const select = element as HTMLSelectElement;
      if (!Array.from(select.options).some((option) => option.value === status)) {
        const option = document.createElement('option');
        option.value = status;
        option.textContent = status;
        select.append(option);
      }
      select.value = status;
      select.dispatchEvent(new Event('change', { bubbles: true }));
    }, target);

    await this.statusSubmit.click();
    await this.page
      .locator(
        '[data-testid="status-success"], [data-testid="status-error"], [data-testid="status-terminal"]',
      )
      .first()
      .waitFor({ state: 'visible' });

    return true;
  }

  /**
   * Points the rendered status form at a different order and submits an arbitrary
   * status.
   *
   * Used for the terminal statuses, which render no form of their own. The form here
   * belongs to a non-terminal order, so it is bound to the real server action; only
   * the hidden order id and the selected status are changed. The action therefore
   * receives a genuine request naming a terminal order, which is exactly the case the
   * state machine has to refuse.
   */
  async retargetStatusForm(orderId: string, target: OrderStatus): Promise<void> {
    await this.page
      .locator('[data-testid="status-form"] input[name="orderId"]')
      .evaluate((element, id) => {
        (element as HTMLInputElement).value = id;
      }, orderId);

    await this.statusSelect.evaluate((element, status) => {
      const select = element as HTMLSelectElement;
      if (!Array.from(select.options).some((option) => option.value === status)) {
        const option = document.createElement('option');
        option.value = status;
        option.textContent = status;
        select.append(option);
      }
      select.value = status;
      select.dispatchEvent(new Event('change', { bubbles: true }));
    }, target);

    await this.statusSubmit.click();
    await this.page
      .locator(
        '[data-testid="status-success"], [data-testid="status-error"], [data-testid="status-terminal"]',
      )
      .first()
      .waitFor({ state: 'visible' });
  }

  async setStock(sku: string, quantity: number): Promise<void> {
    await this.stockInput(sku).fill(String(quantity));
    await this.stockSaveButton(sku).click();
    await this.stockMessage(sku).waitFor({ state: 'visible' });
  }

  async createProduct(fields: {
    name: string;
    slug: string;
    description: string;
    priceCents: number;
    categoryIndex?: number;
  }): Promise<void> {
    await this.productField('name').fill(fields.name);
    await this.productField('slug').fill(fields.slug);
    await this.productField('description').fill(fields.description);
    await this.productField('category').selectOption({ index: fields.categoryIndex ?? 1 });
    await this.productField('price').fill(String(fields.priceCents));
    await this.productSaveButton.click();
    await this.page
      .locator(
        '[data-testid="admin-product-success"], [data-testid="admin-product-error"], [data-testid^="field-error-"]',
      )
      .first()
      .waitFor({ state: 'visible' });
  }
}
