import {test} from 'kizu';
import {
    digestTransition,
    eventEmoji,
    formatDuration,
    formatWatchHeartbeat,
    stateEmoji,
} from './watchFormat.js';

test('formatDuration renders seconds under a minute', (assert) => {

    assert.equal(formatDuration(0), '0s');
    assert.equal(formatDuration(1_499), '1s');
    assert.equal(formatDuration(47_000), '47s');

});

test('formatDuration renders minutes and seconds past a minute', (assert) => {

    assert.equal(formatDuration(60_000), '1m 0s');
    assert.equal(formatDuration(123_000), '2m 3s');

});

test('formatDuration clamps negative input to zero', (assert) => {

    assert.equal(formatDuration(-500), '0s');

});

test('formatWatchHeartbeat cycles dots and shows timeout proximity', (assert) => {

    assert.equal(
        formatWatchHeartbeat({
            elapsedMs: 45_000,
            timeoutMs: 15 * 60_000,
            states: ['UPDATING'],
            tick: 0,
        }),
        '· waiting. UPDATING — 45s elapsed, 14m 15s left',
    );
    assert.equal(
        formatWatchHeartbeat({
            elapsedMs: 45_000,
            timeoutMs: 15 * 60_000,
            states: ['UPDATING'],
            tick: 1,
        }),
        '· waiting.. UPDATING — 45s elapsed, 14m 15s left',
    );
    assert.equal(
        formatWatchHeartbeat({
            elapsedMs: 45_000,
            timeoutMs: 15 * 60_000,
            states: ['UPDATING', 'CHECKING'],
            tick: 2,
        }),
        '· waiting... UPDATING, CHECKING — 45s elapsed, 14m 15s left',
    );

});

test('digestTransition shows a single digest when there is no advance', (assert) => {

    assert.equal(digestTransition('sha256:f6e5d4c3b2a1aaaa', null), 'f6e5d4c3b2a1');
    assert.equal(
        digestTransition('sha256:f6e5d4c3b2a1aaaa', 'sha256:f6e5d4c3b2a1aaaa'),
        'f6e5d4c3b2a1',
    );

});

test('digestTransition shows from → to when the digest advances', (assert) => {

    assert.equal(
        digestTransition('sha256:a1b2c3d4e5f6aaaa', 'sha256:f6e5d4c3b2a1bbbb'),
        'a1b2c3d4e5f6 → f6e5d4c3b2a1',
    );

});

test('stateEmoji maps each Castellan state', (assert) => {

    assert.equal(stateEmoji('stable'), '✓');
    assert.equal(stateEmoji('idle'), '✓');
    assert.equal(stateEmoji('checking'), '🔎');
    assert.equal(stateEmoji('updating'), '🚀');
    assert.equal(stateEmoji('rollback'), '↩️');
    assert.equal(stateEmoji('failed'), '❌');

});

test('eventEmoji maps each Castellan event type', (assert) => {

    assert.equal(eventEmoji('deploy'), '📥');
    assert.equal(eventEmoji('check'), '🔎');
    assert.equal(eventEmoji('rollback'), '↩️');
    assert.equal(eventEmoji('failure'), '❌');

});
