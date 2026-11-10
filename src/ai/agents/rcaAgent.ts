import { activeProvider } from '../config/providers';

export interface RcaVerdict {
    severity: 'Critical' | 'High' | 'Medium' | 'Low';
    priority: 'P0' | 'P1' | 'P2' | 'P3';
    rootCause: string;
    fixes: string[];
}

export interface FailureInput {
    title: string;
    file: string;
    error: string;
    stack?: string;
}

const SYSTEM_PROMPT = `You are a senior QA automation engineer performing root-cause analysis on a failed Playwright test.
Given the test title, location, error message and stack trace, respond with ONLY a JSON object:
{"severity":"Critical|High|Medium|Low","priority":"P0|P1|P2|P3","rootCause":"...","fixes":["...","..."]}`;

/** Calls whichever LLM provider has a key configured and parses its JSON verdict. */
export async function analyzeFailure(input: FailureInput): Promise<RcaVerdict> {
    const provider = activeProvider();
    if (!provider) {
        throw new Error('No LLM API key configured');
    }

    const userPrompt = `Test: ${input.title}\nLocation: ${input.file}\nError: ${input.error}\nStack:\n${input.stack ?? 'n/a'}`;
    const raw = provider === 'anthropic'
        ? await callAnthropic(userPrompt)
        : await callOpenAI(userPrompt);

    return parseVerdict(raw);
}

async function callAnthropic(userPrompt: string): Promise<string> {
    const res = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
            'content-type': 'application/json',
            'x-api-key': process.env.ANTHROPIC_API_KEY ?? '',
            'anthropic-version': '2023-06-01',
        },
        body: JSON.stringify({
            model: 'claude-sonnet-5-5',
            max_tokens: 512,
            system: SYSTEM_PROMPT,
            messages: [{ role: 'user', content: userPrompt }],
        }),
    });
    if (!res.ok) throw new Error(`Anthropic API error: ${res.status}`);
    const data = await res.json() as { content: { text: string }[] };
    return data.content.map((c) => c.text).join('');
}

async function callOpenAI(userPrompt: string): Promise<string> {
    const res = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
            'content-type': 'application/json',
            authorization: `Bearer ${process.env.OPENAI_API_KEY ?? ''}`,
        },
        body: JSON.stringify({
            model: 'gpt-4o-mini',
            messages: [
                { role: 'system', content: SYSTEM_PROMPT },
                { role: 'user', content: userPrompt },
            ],
        }),
    });
    if (!res.ok) throw new Error(`OpenAI API error: ${res.status}`);
    const data = await res.json() as { choices: { message: { content: string } }[] };
    return data.choices[0]?.message?.content ?? '';
}

function parseVerdict(raw: string): RcaVerdict {
    const match = raw.match(/\{[\s\S]*\}/);
    if (!match) throw new Error('RCA agent returned no JSON');
    const parsed = JSON.parse(match[0]);
    return {
        severity: parsed.severity ?? 'Medium',
        priority: parsed.priority ?? 'P2',
        rootCause: parsed.rootCause ?? 'Unknown',
        fixes: Array.isArray(parsed.fixes) ? parsed.fixes : [],
    };
}
