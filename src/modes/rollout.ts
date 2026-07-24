// Pure compose rollout outcome logic — unit-tested without SSH.
//
// Signal: image digests of watched services + health.
//   - deploying: digests changing, or unhealthy/restarting after a change
//   - success: saw a digest change, digests stable, all watched healthy/running
//   - failed: restart loop / exited / prolonged unhealthy after a change

import type {ContainerSnapshot, StackSnapshot} from '../types.js';

export type RolloutOutcome =
    | {kind: 'pending'; reason: string}
    | {kind: 'success'; digests: Record<string, string>}
    | {kind: 'failed'; reason: string};

export interface RolloutWatchState {
    /** Digests captured on first successful poll. */
    baselineDigests: Record<string, string>;
    /** True once any watched service digest differs from baseline. */
    sawDigestChange: boolean;
    /** Digests we expect to settle on (captured when change first observed / updated while still moving). */
    targetDigests: Record<string, string>;
    /** True once targetDigests stopped changing between consecutive polls after a change. */
    digestsStable: boolean;
}

export function digestsEqual(a: Record<string, string>, b: Record<string, string>): boolean {

    const keys = new Set([...Object.keys(a), ...Object.keys(b)]);

    for (const k of keys) {

        if ((a[k] ?? '') !== (b[k] ?? '')) return false;

}
    return true;

}

export function nextRolloutState(
    prev: RolloutWatchState,
    currentDigests: Record<string, string>,
): RolloutWatchState {

    let {sawDigestChange, targetDigests, digestsStable} = prev;
    const baselineDigests = prev.baselineDigests;

    if (!sawDigestChange) {

        if (!digestsEqual(baselineDigests, currentDigests)) {

            sawDigestChange = true;
            targetDigests = {...currentDigests};
            digestsStable = false;

}

} else if (!digestsEqual(targetDigests, currentDigests)) {

        targetDigests = {...currentDigests};
        digestsStable = false;

} else {

        digestsStable = true;

}

    return {baselineDigests, sawDigestChange, targetDigests, digestsStable};

}

function watchedOf(stack: StackSnapshot): ContainerSnapshot[] {

    return stack.containers.filter((c) => c.watched);

}

export function evaluateRollout(stack: StackSnapshot, state: RolloutWatchState): RolloutOutcome {

    const watched = watchedOf(stack);

    if (watched.length === 0) {

        return {kind: 'pending', reason: 'no watched containers yet'};

}

    // Hard failures anytime after we've started watching a change.
    if (state.sawDigestChange) {

        for (const c of watched) {

            if (c.state === 'exited' || c.state === 'dead') {

                return {
                    kind: 'failed',
                    reason: `${c.service} exited (exit=${c.exitCode ?? '?'}) during rollout`,
                };

}
            if (c.state === 'restarting') {

                return {
                    kind: 'failed',
                    reason: `${c.service} is in a restart loop during rollout`,
                };

}
            if (c.restartCount >= 8) {

                return {
                    kind: 'failed',
                    reason: `${c.service} restartCount=${c.restartCount} during rollout`,
                };

}

}

}

    if (!state.sawDigestChange) {

        return {kind: 'pending', reason: 'waiting for image digest change'};

}

    if (!state.digestsStable) {

        return {kind: 'pending', reason: 'image digests still changing'};

}

    for (const c of watched) {

        if (c.state !== 'running') {

            return {kind: 'pending', reason: `${c.service} state=${c.state}`};

}
        if (c.health === 'unhealthy') {

            return {kind: 'pending', reason: `${c.service} still unhealthy`};

}
        if (c.health === 'starting') {

            return {kind: 'pending', reason: `${c.service} health starting`};

}

}

    return {kind: 'success', digests: state.targetDigests};

}

/** True when every watched container is running and not unhealthy (for --once / inspect). */
export function stackHealthy(stack: StackSnapshot): boolean {

    const watched = watchedOf(stack);

    if (watched.length === 0) return false;
    return watched.every((c) =>
        c.state === 'running' && c.health !== 'unhealthy' && c.health !== 'starting');

}
