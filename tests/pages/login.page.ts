import type { Locator, Page } from '@playwright/test';
import { BasePage } from './base.page';

export class LoginPage extends BasePage {
  constructor(page: Page) {
    super(page);
  }

  get form(): Locator {
    return this.page.getByTestId('login-form');
  }

  get emailInput(): Locator {
    return this.page.getByTestId('login-email');
  }

  get passwordInput(): Locator {
    return this.page.getByTestId('login-password');
  }

  get submitButton(): Locator {
    return this.page.getByTestId('login-submit');
  }

  get error(): Locator {
    return this.page.getByTestId('login-error');
  }

  get registerLink(): Locator {
    return this.page.getByTestId('login-register-link');
  }

  async goto(): Promise<void> {
    await this.page.goto('/login');
    await this.form.waitFor({ state: 'visible' });
  }

  async signIn(email: string, password: string): Promise<void> {
    await this.emailInput.fill(email);
    await this.passwordInput.fill(password);
    await this.submitButton.click();
  }

  /** Attempts a sign-in that is expected to fail, and returns the message shown. */
  async signInExpectingFailure(email: string, password: string): Promise<string> {
    await this.signIn(email, password);
    await this.error.waitFor({ state: 'visible' });
    return (await this.error.innerText()).trim();
  }
}

export class RegisterPage extends BasePage {
  constructor(page: Page) {
    super(page);
  }

  get form(): Locator {
    return this.page.getByTestId('register-form');
  }

  get nameInput(): Locator {
    return this.page.getByTestId('register-name');
  }

  get emailInput(): Locator {
    return this.page.getByTestId('register-email');
  }

  get passwordInput(): Locator {
    return this.page.getByTestId('register-password');
  }

  get submitButton(): Locator {
    return this.page.getByTestId('register-submit');
  }

  get success(): Locator {
    return this.page.getByTestId('register-success');
  }

  get error(): Locator {
    return this.page.getByTestId('register-error');
  }

  get loginLinkFromRegister(): Locator {
    return this.page.getByTestId('register-login-link');
  }

  fieldError(field: string): Locator {
    return this.page.getByTestId(`field-error-${field}`);
  }

  async goto(): Promise<void> {
    await this.page.goto('/register');
    await this.form.waitFor({ state: 'visible' });
  }

  async register(name: string, email: string, password: string): Promise<void> {
    await this.nameInput.fill(name);
    await this.emailInput.fill(email);
    await this.passwordInput.fill(password);
    await this.submitButton.click();
  }

  /** Submits and waits for whichever outcome the server returns. */
  async registerAndWait(name: string, email: string, password: string): Promise<void> {
    await this.register(name, email, password);
    await this.page
      .locator(
        '[data-testid="register-success"], [data-testid="register-error"], [data-testid^="field-error-"]',
      )
      .first()
      .waitFor({ state: 'visible' });
  }
}
