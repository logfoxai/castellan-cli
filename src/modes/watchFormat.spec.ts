import {test} from 'kizu';
import {digestTransition, formatDuration, padVisible} from './watchFormat.js';

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

test('padVisible right-pads to the target width', (assert) => {

    assert.equal(padVisible('ab', 2, 5), 'ab   ');

});

test('padVisible never truncates when content is wider than target', (assert) => {

    assert.equal(padVisible('abcdef', 6, 4), 'abcdef');

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
