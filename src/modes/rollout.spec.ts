import {test} from 'kizu';

import {digestsEqual, evaluateRollout, nextRolloutState, type RolloutWatchState} from './rollout.js';
import type {ContainerSnapshot, StackSnapshot} from '../types.js';

function container(partial: Partial<ContainerSnapshot> & {service: string}): ContainerSnapshot {

    return {
        name: partial.name ?? partial.service,
        id: partial.id ?? 'abc',
        state: partial.state ?? 'running',
        health: partial.health ?? 'healthy',
        image: partial.image ?? 'img:latest',
        imageId: partial.imageId ?? 'digest1',
        status: partial.status ?? 'Up',
        exitCode: partial.exitCode ?? null,
        startedAt: partial.startedAt ?? new Date(),
        createdAt: partial.createdAt ?? new Date(),
        restartCount: partial.restartCount ?? 0,
        watched: partial.watched ?? true,
        service: partial.service,
    };

}

function stack(containers: ContainerSnapshot[]): StackSnapshot {

    return {
        env: 'staging',
        ssh: 'deploy@staging',
        dir: '/srv/app/compose',
        project: 'app',
        containers,
        fetchedAt: new Date(),
    };

}

function state(partial: Partial<RolloutWatchState> = {}): RolloutWatchState {

    return {
        baselineDigests: partial.baselineDigests ?? {api: 'old'},
        sawDigestChange: partial.sawDigestChange ?? false,
        targetDigests: partial.targetDigests ?? {},
        digestsStable: partial.digestsStable ?? false,
    };

}

test('digestsEqual compares key sets', (assert) => {

    assert.equal(digestsEqual({a: '1'}, {a: '1'}), true);
    assert.equal(digestsEqual({a: '1'}, {a: '2'}), false);
    assert.equal(digestsEqual({a: '1'}, {a: '1', b: '2'}), false);

});

test('nextRolloutState detects digest change from baseline', (assert) => {

    const next = nextRolloutState(state({baselineDigests: {api: 'old'}}), {api: 'new'});

    assert.equal(next.sawDigestChange, true);
    assert.equal(next.targetDigests, {api: 'new'});
    assert.equal(next.digestsStable, false);

});

test('nextRolloutState marks digests stable when unchanged after change', (assert) => {

    const mid = nextRolloutState(state({baselineDigests: {api: 'old'}}), {api: 'new'});
    const stable = nextRolloutState(mid, {api: 'new'});

    assert.equal(stable.digestsStable, true);

});

test('evaluateRollout pending while waiting for digest change', (assert) => {

    const outcome = evaluateRollout(
        stack([container({service: 'api', imageId: 'old'})]),
        state({baselineDigests: {api: 'old'}, sawDigestChange: false}),
    );

    assert.equal(outcome.kind, 'pending');

});

test('evaluateRollout succeeds when digests stable and healthy after change', (assert) => {

    const outcome = evaluateRollout(
        stack([container({service: 'api', imageId: 'new', health: 'healthy'})]),
        state({
            baselineDigests: {api: 'old'},
            sawDigestChange: true,
            targetDigests: {api: 'new'},
            digestsStable: true,
        }),
    );

    assert.equal(outcome, {kind: 'success', digests: {api: 'new'}});

});

test('evaluateRollout fails on exit during rollout', (assert) => {

    const outcome = evaluateRollout(
        stack([container({service: 'api', state: 'exited', exitCode: 1, health: 'none'})]),
        state({sawDigestChange: true, digestsStable: true, targetDigests: {api: 'new'}}),
    );

    assert.equal(outcome.kind, 'failed');

});

test('evaluateRollout fails on restart loop during rollout', (assert) => {

    const outcome = evaluateRollout(
        stack([container({service: 'api', state: 'restarting'})]),
        state({sawDigestChange: true, targetDigests: {api: 'new'}}),
    );

    assert.equal(outcome.kind, 'failed');

});

test('evaluateRollout pending while unhealthy after digest change', (assert) => {

    const outcome = evaluateRollout(
        stack([container({service: 'api', health: 'unhealthy'})]),
        state({
            sawDigestChange: true,
            digestsStable: true,
            targetDigests: {api: 'new'},
        }),
    );

    assert.equal(outcome.kind, 'pending');

});
