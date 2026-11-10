/**
 * Shape of a `self-heal` attachment: candidate replacement locators for a
 * selector that failed to resolve, verified live against the page.
 * CustomReporter renders this on the Self-Heal tab; nothing is auto-applied.
 */
export interface HealCandidate {
    selector: string;
    strategy: string;
    matchCount: number;
    visible: boolean;
    reasoning: string;
}

export interface HealRejection {
    selector: string;
    reason: string;
}

export interface HealReport {
    failedSelector: string;
    intent: string;
    verified: HealCandidate[];
    rejected: HealRejection[];
    unavailableReason?: string;
}
