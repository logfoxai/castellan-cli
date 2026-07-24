// Heuristic diagnostics for Docker Compose stacks.

import type {ContainerSnapshot, Diagnostic, StackSnapshot} from '../types.js';

interface AnalyzeInput {
    stack: StackSnapshot;
}

const RESTART_LOOP_THRESHOLD = 5;
const UNHEALTHY_AGE_MS = 2 * 60_000;

export function analyze(input: AnalyzeInput): Diagnostic[] {

    const out: Diagnostic[] = [];
    const watched = input.stack.containers.filter((c) => c.watched);
    const all = input.stack.containers;

    if (watched.length === 0 && all.length === 0) {

        out.push({
            id: 'stack-empty',
            severity: 'warn',
            title: 'No containers found',
            detail: `docker compose ps returned nothing under ${input.stack.dir}. Is the stack up?`,
            suggestion: `ssh ${input.stack.ssh} 'cd ${input.stack.dir} && docker compose up -d'`,
        });

}

    for (const c of watched.length > 0 ? watched : all) {

        out.push(...containerSignals(c));

}

    // Missing watched services entirely.
    const present = new Set(all.map((c) => c.service));
    const expected = watched.length > 0
        ? watched.map((c) => c.service)
        : [];

    // Prefer the configured watched list from containers that claim watched=false missing —
    // we only know what's present. Callers pass watched via container.watched flag.
    // If a service was expected but not in ps at all, the flag won't appear. Detect via
    // comparing stack.containers watched set vs names we saw.
    // Actually missing services aren't in the list — detect from a separate expected list
    // embedded by marking. For now: if watched filter is empty but all has items, skip.

    void expected;
    void present;

    const seen = new Set<string>();

    return out.filter((d) => {

        if (seen.has(d.id)) return false;
        seen.add(d.id);
        return true;

}).sort(severitySort);

}

/** Analyze with an explicit expected watched-service list (for missing services). */
export function analyzeWithExpected(stack: StackSnapshot, expectedServices: string[]): Diagnostic[] {

    const base = analyze({stack});
    const present = new Set(stack.containers.map((c) => c.service));

    for (const svc of expectedServices) {

        if (!present.has(svc)) {

            base.push({
                id: `missing-${svc}`,
                severity: 'error',
                title: `Watched service missing: ${svc}`,
                detail: `Expected compose service "${svc}" but it does not appear in docker compose ps.`,
                suggestion: 'Check compose file, scale settings, and recent deploy activity on the host.',
                sourceServices: [svc],
            });

}

}
    return base.sort(severitySort);

}

function containerSignals(c: ContainerSnapshot): Diagnostic[] {

    const out: Diagnostic[] = [];

    if (c.state === 'exited' || c.state === 'dead') {

        const oom = c.exitCode === 137;

        out.push({
            id: `exited-${c.service}`,
            severity: 'error',
            title: oom
                ? `Container OOM-killed (exit 137): ${c.service}`
                : `Container exited: ${c.service}`,
            detail: `${c.name} state=${c.state} exit=${c.exitCode ?? '?'} status="${c.status}" image=${c.image}`,
            suggestion: oom
                ? 'Bump container memory limits or fix a leak.'
                : `Tail logs: docker compose logs --tail 100 ${c.service}`,
            sourceServices: [c.service],
        });

}

    if (c.state === 'restarting') {

        out.push({
            id: `restarting-${c.service}`,
            severity: 'error',
            title: `Restart loop: ${c.service}`,
            detail: `${c.name} is restarting (restartCount=${c.restartCount}). ${c.status}`,
            suggestion: 'Inspect recent logs and healthcheck; a crash-looping container will never go healthy.',
            sourceServices: [c.service],
        });

}

    if (c.health === 'unhealthy') {

        const age = c.startedAt ? Date.now() - c.startedAt.getTime() : 0;
        const longUnhealthy = age > UNHEALTHY_AGE_MS;

        out.push({
            id: `unhealthy-${c.service}`,
            severity: longUnhealthy ? 'error' : 'warn',
            title: `Unhealthy: ${c.service}`,
            detail: `${c.name} health=unhealthy for ~${Math.round(age / 1000)}s. ${c.status}`,
            suggestion: 'Verify the healthcheck endpoint and that the process is listening on the expected port.',
            sourceServices: [c.service],
        });

}

    if (c.restartCount >= RESTART_LOOP_THRESHOLD && c.state === 'running') {

        out.push({
            id: `restarts-${c.service}`,
            severity: 'warn',
            title: `High restart count: ${c.service}`,
            detail: `${c.name} has restarted ${c.restartCount} times since create.`,
            suggestion: 'Even if currently running, frequent restarts suggest flapping — check OOM / crash logs.',
            sourceServices: [c.service],
        });

}

    return out;

}

function severitySort(a: Diagnostic, b: Diagnostic): number {

    const rank = (s: Diagnostic['severity']): number => (s === 'error' ? 0 : s === 'warn' ? 1 : 2);

    return rank(a.severity) - rank(b.severity);

}
