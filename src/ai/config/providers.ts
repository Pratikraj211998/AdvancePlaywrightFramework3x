/**
 * Whichever LLM key is present selects the provider the AI agents (RCA,
 * flaky summary) call out to. No key configured -> agents no-op.
 */
export type Provider = 'openai' | 'anthropic';

export function hasApiKey(): boolean {
    return Boolean(process.env.OPENAI_API_KEY || process.env.ANTHROPIC_API_KEY);
}

export function activeProvider(): Provider | undefined {
    if (process.env.ANTHROPIC_API_KEY) return 'anthropic';
    if (process.env.OPENAI_API_KEY) return 'openai';
    return undefined;
}
