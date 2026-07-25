import {test} from 'kizu';
import type {DeploymentEvent} from '../castellan/types.js';
import {eventKey, seedRecoveredHistory} from './watch.js';

test('seedRecoveredHistory ignores only pre-watch events', (assert) => {

    const startedAtMs = Date.parse('2026-07-24T12:00:00.000Z');
    const seen = new Set<string>();
    const events: DeploymentEvent[] = [
        {
            at: '2026-07-24T11:59:59.000Z',
            type: 'failure',
            service: 'api',
            message: 'old failure',
        },
        {
            at: '2026-07-24T12:00:01.000Z',
            type: 'deploy',
            service: 'api',
            message: 'deploy during gap',
        },
        {
            at: '2026-07-24T12:00:02.000Z',
            type: 'rollback',
            service: 'api',
            message: 'rollback during gap',
        },
    ];

    seedRecoveredHistory(events, startedAtMs, seen);

    assert.equal(seen.has(eventKey(events[0]!)), true);
    assert.equal(seen.has(eventKey(events[1]!)), false);
    assert.equal(seen.has(eventKey(events[2]!)), false);

});
