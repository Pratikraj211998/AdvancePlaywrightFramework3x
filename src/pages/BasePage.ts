import { Page } from '@playwright/test';
import winston from 'winston';
import { createLogger } from '../utils/logger';
import { ElementActions } from '../utils/elementActions';

/**
 * Shared base for every page object: a named logger, a locator-action
 * helper (this.el) and a goto() that resolves against playwright.config's
 * baseURL.
 */
export abstract class BasePage {
    protected readonly page: Page;
    protected readonly log: winston.Logger;
    protected readonly el: ElementActions;

    constructor(page: Page, name: string) {
        this.page = page;
        this.log = createLogger(name);
        this.el = new ElementActions(this.log);
    }

    protected async goto(path: string): Promise<void> {
        await this.page.goto(path);
    }
}
