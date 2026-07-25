import {test} from 'kizu';
import type {ServiceStatus} from '../castellan/types.js';
import {
    evaluateRollout,
    initialWatchState,
    noteEvents,
    noteStatus,
} from './rollout.js';

function service(partial: Partial<ServiceStatus> & Pick<ServiceStatus, 'name' | 'state'>): ServiceStatus {

    return {
        registry: 'example.com',
        repository: 'api-service',
        tag: 'prime',
        currentDigest: 'sha256:old',
        desiredDigest: 'sha256:old',
        rejectedDigests: [],
        lastCheckAt: null,
        lastError: null,
        pollEnabled: true,
        ...partial,
    };

}

test('evaluateRollout stays pending until deploy activity', (assert) => {

    const services = [service({name: 'api', state: 'stable'})];
    const state = initialWatchState(services);
    const outcome = evaluateRollout(state, services);

    assert.equal(outcome.kind, 'pending');

});

test('evaluateRollout succeeds after digest advances and settles stable', (assert) => {

    const baseline = [service({name: 'api', state: 'stable', currentDigest: 'sha256:old'})];
    let state = initialWatchState(baseline);

    state = noteStatus(state, [
        service({
            name: 'api',
            state: 'updating',
            currentDigest: 'sha256:old',
            desiredDigest: 'sha256:new',
        }),
    ]);

    const settled = [
        service({
            name: 'api',
            state: 'stable',
            currentDigest: 'sha256:new',
            desiredDigest: 'sha256:new',
        }),
    ];

    state = noteStatus(state, settled);
    const outcome = evaluateRollout(state, settled);

    assert.equal(outcome.kind, 'success');

});

test('evaluateRollout fails on Castellan failed state', (assert) => {

    const baseline = [service({name: 'api', state: 'stable'})];
    let state = initialWatchState(baseline);

    state = noteStatus(state, [
        service({name: 'api', state: 'updating', desiredDigest: 'sha256:new'}),
    ]);

    const failed = [
        service({
            name: 'api',
            state: 'failed',
            lastError: 'health check timed out',
            desiredDigest: 'sha256:new',
        }),
    ];

    const outcome = evaluateRollout(state, failed);

    assert.equal(outcome.kind, 'failure');
    if (outcome.kind === 'failure') {

        assert.equal(outcome.reason.includes('health check timed out'), true);

    }

});

test('evaluateRollout fails after rollback to baseline digest', (assert) => {

    const baseline = [service({name: 'api', state: 'stable', currentDigest: 'sha256:old'})];
    let state = initialWatchState(baseline);

    state = noteEvents(state, [
        {
            at: new Date().toISOString(),
            type: 'rollback',
            service: 'api',
            message: 'rolling back',
        },
    ], new Set(['api']));

    const settled = [
        service({
            name: 'api',
            state: 'stable',
            currentDigest: 'sha256:old',
            desiredDigest: 'sha256:old',
        }),
    ];

    const outcome = evaluateRollout(state, settled);

    assert.equal(outcome.kind, 'failure');
    if (outcome.kind === 'failure') {

        assert.equal(outcome.reason.includes('rolled back'), true);

    }

});

test('evaluateRollout fails immediately when a sibling is still active', (assert) => {

    // Put the still-active service first so Object.values hits ACTIVE before
    // failed — the old single-pass evaluator returned pending and timed out.
    const baseline = [
        service({name: 'worker', state: 'stable', repository: 'worker'}),
        service({name: 'api', state: 'stable'}),
    ];
    let state = initialWatchState(baseline);

    state = noteStatus(state, [
        service({
            name: 'worker',
            state: 'updating',
            repository: 'worker',
            desiredDigest: 'sha256:new',
        }),
        service({name: 'api', state: 'updating', desiredDigest: 'sha256:new'}),
    ]);

    const mixed = [
        service({
            name: 'worker',
            state: 'updating',
            repository: 'worker',
            currentDigest: 'sha256:new',
            desiredDigest: 'sha256:new',
        }),
        service({
            name: 'api',
            state: 'failed',
            lastError: 'health check timed out',
            desiredDigest: 'sha256:new',
        }),
    ];

    const outcome = evaluateRollout(state, mixed);

    assert.equal(outcome.kind, 'failure');
    if (outcome.kind === 'failure') {

        assert.equal(outcome.reason.includes('health check timed out'), true);

    }

});
