import { Locator } from '@playwright/test';
import winston from 'winston';

/**
 * Thin wrapper around common Locator actions so every page object gets
 * consistent waiting + logging without repeating it in each page class.
 */
export class ElementActions {
    constructor(private readonly log: winston.Logger) {}

    async fill(locator: Locator, value: string): Promise<void> {
        this.log.debug(`fill "${value}" -> ${locator}`);
        await locator.waitFor({ state: 'visible' });
        await locator.fill(value);
    }

    async click(locator: Locator): Promise<void> {
        this.log.debug(`click -> ${locator}`);
        await locator.waitFor({ state: 'visible' });
        await locator.click();
    }

    async waitForHidden(locator: Locator): Promise<void> {
        await locator.waitFor({ state: 'hidden' });
    }

    async getText(locator: Locator): Promise<string> {
        await locator.waitFor({ state: 'visible' });
        return (await locator.textContent())?.trim() ?? '';
    }

    async getAllTexts(locator: Locator): Promise<string[]> {
        const texts = await locator.allTextContents();
        return texts.map((t) => t.trim());
    }
}
