import {test} from 'kizu';

import {parseComposeLogLine} from '../docker/logs.js';
import {shellQuote} from '../docker/ssh.js';
import {DEFAULT_WATCHED, resolveHost} from '../resolve/hostResolver.js';
import {writeFile, mkdir, rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';

test('shellQuote escapes single quotes', (assert) => {

    assert.equal(shellQuote('abc'), '\'abc\'');
    assert.equal(shellQuote('a\'b'), '\'a\'\\\'\'b\'');

});

test('parseComposeLogLine extracts service and timestamp', (assert) => {

    const line = parseComposeLogLine(
        'api-1  | 2024-06-01T12:00:00.000000000Z hello world',
        new Date('2024-01-01T00:00:00Z'),
    );

    assert.equal(line?.stream, 'api-1');
    assert.equal(line?.message, 'hello world');
    assert.equal(line?.timestamp.toISOString(), '2024-06-01T12:00:00.000Z');

});

test('parseComposeLogLine classifies errors', (assert) => {

    const line = parseComposeLogLine('ingest-worker  | FATAL boom');

    assert.equal(line?.severity, 'error');

});

test('resolveHost reads config.json', async (assert) => {

    const dir = join(tmpdir(), `composewatch-test-${Date.now()}`);

    await mkdir(dir, {recursive: true});
    const path = join(dir, 'config.json');

    await writeFile(path, JSON.stringify({
        default_env: 'dev',
        hosts: {
            prime: {ssh: 'ubuntu@logfox-prime', dir: '/opt/logfox/compose'},
            dev: {ssh: 'ubuntu@logfox-dev'},
            prod: {ssh: 'root@logfox-prod', watched: ['api-1']},
        },
    }));

    try {

        const ctx = await resolveHost({env: 'prime', configPath: path});

        assert.equal(ctx.ssh, 'ubuntu@logfox-prime');
        assert.equal(ctx.dir, '/opt/logfox/compose');
        assert.equal(ctx.watchedServices, DEFAULT_WATCHED);

        const prod = await resolveHost({env: 'prod', configPath: path});

        assert.equal(prod.ssh, 'root@logfox-prod');
        assert.equal(prod.watchedServices, ['api-1']);

        const overridden = await resolveHost({
            env: 'prime',
            ssh: 'ubuntu@override',
            configPath: path,
        });

        assert.equal(overridden.ssh, 'ubuntu@override');

} finally {

        await rm(dir, {recursive: true, force: true});

}

});

test('resolveHost errors when ssh missing', async (assert) => {

    const dir = join(tmpdir(), `composewatch-test-${Date.now()}-empty`);

    await mkdir(dir, {recursive: true});
    const path = join(dir, 'config.json');

    await writeFile(path, JSON.stringify({hosts: {}}));

    try {

        let message = '';

        try {

            await resolveHost({env: 'prime', configPath: path});

} catch (err) {

            message = err instanceof Error ? err.message : String(err);

}
        assert.equal(/No SSH target/.test(message), true);

} finally {

        await rm(dir, {recursive: true, force: true});

}

});
