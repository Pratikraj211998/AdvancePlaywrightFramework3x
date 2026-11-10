import { activeProvider } from '../config/providers';

export interface BuildSummary {
    runId: string;
    tests: Record<string, string>;
}

export interface FlakyResult {
    flaky: string[];
    failing: string[];
    counts: { flaky: number; failing: number; total: number };
    summary?: string;
}

/**
 * Diffs two build snapshots: a test is "flaky" when its status changed
 * between builds, "failing" when it's failed/timedOut in the latest build.
 * With an LLM key configured, also asks for a one-line human summary.
 */
export async function analyzeFlaky(
    prev: BuildSummary,
    curr: BuildSummary,
    withSummary: boolean,
): Promise<FlakyResult> {
    const flaky: string[] = [];
    const failing: string[] = [];

    for (const [title, status] of Object.entries(curr.tests)) {
        const prevStatus = prev.tests[title];
        if (prevStatus && prevStatus !== status) {
            flaky.push(title);
        }
        if (status === 'failed' || status === 'timedOut') {
            failing.push(title);
        }
    }

    const result: FlakyResult = {
        flaky,
        failing,
        counts: { flaky: flaky.length, failing: failing.length, total: Object.keys(curr.tests).length },
    };

    if (withSummary && flaky.length > 0 && activeProvider()) {
        try {
            result.summary = await summarize(flaky, prev.runId, curr.runId);
        } catch {
            // Summary is a nice-to-have; keep the raw counts either way.
        }
    }

    return result;
}

async function summarize(flaky: string[], prevRunId: string, currRunId: string): Promise<string> {
    const provider = activeProvider();
    const prompt = `These Playwright tests changed status between build ${prevRunId} and ${currRunId}: ${flaky.join(', ')}. In one sentence, summarize likely flakiness themes for a QA lead.`;

    if (provider === 'anthropic') {
        const res = await fetch('https://api.anthropic.com/v1/messages', {
            method: 'POST',
            headers: {
                'content-type': 'application/json',
                'x-api-key': process.env.ANTHROPIC_API_KEY ?? '',
                'anthropic-version': '2023-06-01',
            },
            body: JSON.stringify({ model: 'claude-sonnet-5-5', max_tokens: 200, messages: [{ role: 'user', content: prompt }] }),
        });
        const data = await res.json() as { content: { text: string }[] };
        return data.content.map((c) => c.text).join('').trim();
    }

    const res = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
            'content-type': 'application/json',
            authorization: `Bearer ${process.env.OPENAI_API_KEY ?? ''}`,
        },
        body: JSON.stringify({ model: 'gpt-4o-mini', messages: [{ role: 'user', content: prompt }] }),
    });
    const data = await res.json() as { choices: { message: { content: string } }[] };
    return (data.choices[0]?.message?.content ?? '').trim();
}
