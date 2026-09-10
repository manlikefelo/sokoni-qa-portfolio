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

  async changeStatus(target: OrderStatus): Promise<void> {
    await this.statusSelect.selectOption(target);
    await this.statusSubmit.click();
    await this.page
      .locator('[data-testid="status-success"], [data-testid="status-error"]')
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
