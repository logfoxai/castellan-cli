// Heuristic-only root cause (v1 — no LLM).

import type {Diagnostic, RootCauseAnalysis, StackSnapshot} from '../types.js';

export function rootCause(input: {
    stack: StackSnapshot;
    diagnostics: Diagnostic[];
}): RootCauseAnalysis {

    const started = Date.now();
    const errors = input.diagnostics.filter((d) => d.severity === 'error');
    const warns = input.diagnostics.filter((d) => d.severity === 'warn');
    const watched = input.stack.containers.filter((c) => c.watched);
    const healthy = watched.filter((c) => c.state === 'running' && (c.health === 'healthy' || c.health === 'none'));

    if (errors.length === 0 && warns.length === 0) {

        return {
            source: 'heuristic',
            summary: watched.length === 0
                ? 'Stack has no watched containers configured.'
                : `Stack looks healthy — ${healthy.length}/${watched.length} watched services running.`,
            likelyCauses: [],
            suggestedFixes: [],
            elapsedMs: Date.now() - started,
        };

}

    return {
        source: 'heuristic',
        summary: errors[0]?.title ?? warns[0]?.title ?? 'Stack degraded.',
        likelyCauses: [...errors, ...warns].slice(0, 5).map((d) => `${d.title}: ${d.detail}`),
        suggestedFixes: [...errors, ...warns]
            .map((d) => d.suggestion)
            .filter((s): s is string => Boolean(s))
            .slice(0, 5),
        elapsedMs: Date.now() - started,
    };

}
