import type { Locator, Page } from '@playwright/test';
import { BasePage } from './base.page';

export type SortOption = 'newest' | 'price-asc' | 'price-desc' | 'name-asc';

export interface CatalogueFilters {
  q?: string;
  categories?: string[];
  minPriceShillings?: number;
  maxPriceShillings?: number;
  inStockOnly?: boolean;
  sort?: SortOption;
  page?: number;
  /** Opt out of the default seeded-category filter, to see fixture products too. */
  allCategories?: boolean;
}

export class CataloguePage extends BasePage {
  constructor(page: Page) {
    super(page);
  }

  get grid(): Locator {
    return this.page.getByTestId('product-grid');
  }

  get resultCount(): Locator {
    return this.page.getByTestId('result-count');
  }

  get emptyState(): Locator {
    return this.page.getByTestId('empty-state');
  }

  get searchInput(): Locator {
    return this.page.getByTestId('search-input');
  }

  get searchSubmit(): Locator {
    return this.page.getByTestId('search-submit');
  }

  get minPriceInput(): Locator {
    return this.page.getByTestId('filter-price-min');
  }

  get maxPriceInput(): Locator {
    return this.page.getByTestId('filter-price-max');
  }

  get inStockCheckbox(): Locator {
    return this.page.getByTestId('filter-in-stock');
  }

  get sortSelect(): Locator {
    return this.page.getByTestId('sort-select');
  }

  get clearFiltersButton(): Locator {
    return this.page.getByTestId('filters-clear');
  }

  get pagination(): Locator {
    return this.page.getByTestId('pagination');
  }

  get paginationNext(): Locator {
    return this.page.getByTestId('pagination-next');
  }

  get paginationPrevious(): Locator {
    return this.page.getByTestId('pagination-prev');
  }

  paginationPage(n: number): Locator {
    return this.page.getByTestId(`pagination-page-${n}`);
  }

  categoryCheckbox(slug: string): Locator {
    return this.page.getByTestId(`filter-category-${slug}`);
  }

  productCard(slug: string): Locator {
    return this.page.getByTestId(`product-card-${slug}`);
  }

  productPrice(slug: string): Locator {
    return this.page.getByTestId(`product-price-${slug}`);
  }

  outOfStockBadge(slug: string): Locator {
    return this.page.getByTestId(`out-of-stock-${slug}`);
  }

  /**
   * The three categories the seed creates. Other specs create fixture products in a
   * separate "qa-fixtures" category, so filtering to these keeps whole-catalogue
   * assertions stable regardless of what else is running in parallel.
   */
  static readonly SEED_CATEGORIES = ['electronics', 'home-kitchen', 'fashion'] as const;

  /**
   * Navigates straight to a filtered view by URL. Preferred over clicking the
   * controls when the spec is about the result set rather than about the controls,
   * because it removes a whole class of interaction timing from the test.
   *
   * When no category is named the three seeded categories are applied, which excludes
   * fixture products created by other specs. Pass `allCategories: true` to see
   * everything.
   */
  async goto(filters: CatalogueFilters = {}): Promise<void> {
    const params = new URLSearchParams();
    if (filters.q) params.set('q', filters.q);

    const categories =
      filters.categories ?? (filters.allCategories ? [] : [...CataloguePage.SEED_CATEGORIES]);
    for (const category of categories) params.append('category', category);
    if (filters.minPriceShillings !== undefined) {
      params.set('minPrice', String(filters.minPriceShillings * 100));
    }
    if (filters.maxPriceShillings !== undefined) {
      params.set('maxPrice', String(filters.maxPriceShillings * 100));
    }
    if (filters.inStockOnly) params.set('inStock', 'true');
    if (filters.sort) params.set('sort', filters.sort);
    if (filters.page && filters.page > 1) params.set('page', String(filters.page));

    const query = params.toString();
    await this.page.goto(query ? `/products?${query}` : '/products');
    await this.waitForResults();
  }

  /** Waits for the grid or the empty state, whichever the query produced. */
  async waitForResults(): Promise<void> {
    await this.page
      .locator('[data-testid="product-grid"], [data-testid="empty-state"]')
      .first()
      .waitFor({ state: 'visible' });
  }

  async search(term: string): Promise<void> {
    await this.searchInput.fill(term);
    await this.searchSubmit.click();
    await this.waitForResults();
  }

  async toggleCategory(slug: string): Promise<void> {
    await this.categoryCheckbox(slug).click();
    await this.waitForResults();
  }

  async setPriceRange(minShillings: number | null, maxShillings: number | null): Promise<void> {
    if (minShillings !== null) {
      await this.minPriceInput.fill(String(minShillings));
      await this.minPriceInput.blur();
      await this.waitForResults();
    }
    if (maxShillings !== null) {
      await this.maxPriceInput.fill(String(maxShillings));
      await this.maxPriceInput.blur();
      await this.waitForResults();
    }
  }

  async setSort(sort: SortOption): Promise<void> {
    await this.sortSelect.selectOption(sort);
    await this.waitForResults();
  }

  async toggleInStockOnly(): Promise<void> {
    await this.inStockCheckbox.click();
    await this.waitForResults();
  }

  /** The slugs currently rendered, in display order. */
  async visibleSlugs(): Promise<string[]> {
    const cards = this.page.locator('[data-testid^="product-card-"]');
    const count = await cards.count();
    const slugs: string[] = [];
    for (let index = 0; index < count; index += 1) {
      const testId = await cards.nth(index).getAttribute('data-testid');
      if (testId) slugs.push(testId.replace('product-card-', ''));
    }
    return slugs;
  }

  /** The displayed prices in cents, in display order, for sort assertions. */
  async visiblePricesInCents(): Promise<number[]> {
    const prices = this.page.locator('[data-testid^="product-price-"]');
    const count = await prices.count();
    const values: number[] = [];
    for (let index = 0; index < count; index += 1) {
      const text = await prices.nth(index).innerText();
      const digits = text.replace(/[^0-9.]/g, '');
      values.push(Math.round(Number(digits) * 100));
    }
    return values;
  }

  async visibleNames(): Promise<string[]> {
    const links = this.page.locator('[data-testid^="product-link-"]');
    return links.allInnerTexts();
  }

  /** Total matches, read from the result count line. */
  async totalMatches(): Promise<number> {
    const text = await this.resultCount.innerText();
    if (/no products found/i.test(text)) return 0;
    const match = text.match(/of\s+(\d+)\s+products/i);
    return match?.[1] ? Number(match[1]) : 0;
  }

  async pageCount(): Promise<number> {
    if (!(await this.pagination.isVisible())) return 1;
    return this.page.locator('[data-testid^="pagination-page-"]').count();
  }

  async openProduct(slug: string): Promise<void> {
    await this.page.getByTestId(`product-link-${slug}`).click();
  }
}
