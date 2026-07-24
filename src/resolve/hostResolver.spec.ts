import {test} from 'kizu';

import {parseComposeLogLine} from '../docker/logs.js';
import {shellQuote} from '../docker/ssh.js';
import {resolveHost} from '../resolve/hostResolver.js';
import {writeFile, mkdir, rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';

test('shellQuote escapes single quotes', (assert) => {

    assert.equal(shellQuote('abc'), '\'abc\'');
    assert.equal(shellQuote('a\'b'), '\'a\'\\\'\'b\'');

});

test('parseComposeLogLine extracts service and timestamp', (assert) => {

    const line = parseComposeLogLine(
        'web  | 2024-06-01T12:00:00.000000000Z hello world',
        new Date('2024-01-01T00:00:00Z'),
    );

    assert.equal(line?.stream, 'web');
    assert.equal(line?.message, 'hello world');
    assert.equal(line?.timestamp.toISOString(), '2024-06-01T12:00:00.000Z');

});

test('parseComposeLogLine classifies errors', (assert) => {

    const line = parseComposeLogLine('worker  | FATAL boom');

    assert.equal(line?.severity, 'error');

});

test('resolveHost reads config.json', async (assert) => {

    const dir = join(tmpdir(), `composewatch-test-${Date.now()}`);

    await mkdir(dir, {recursive: true});
    const path = join(dir, 'config.json');

    await writeFile(path, JSON.stringify({
        default_env: 'dev',
        hosts: {
            staging: {
                ssh: 'deploy@staging',
                dir: '/srv/app/compose',
                watched: ['web', 'worker'],
            },
            dev: {
                ssh: 'deploy@dev',
                dir: '/srv/dev/compose',
                watched: ['web'],
            },
            prod: {
                ssh: 'deploy@prod',
                dir: '/srv/prod/compose',
                watched: ['web'],
            },
        },
    }));

    try {

        const ctx = await resolveHost({env: 'staging', configPath: path});

        assert.equal(ctx.ssh, 'deploy@staging');
        assert.equal(ctx.dir, '/srv/app/compose');
        assert.equal(ctx.watchedServices, ['web', 'worker']);

        const prod = await resolveHost({env: 'prod', configPath: path});

        assert.equal(prod.ssh, 'deploy@prod');
        assert.equal(prod.watchedServices, ['web']);

        const overridden = await resolveHost({
            env: 'staging',
            ssh: 'deploy@override',
            configPath: path,
        });

        assert.equal(overridden.ssh, 'deploy@override');

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

            await resolveHost({env: 'staging', configPath: path});

} catch (err) {

            message = err instanceof Error ? err.message : String(err);

}
        assert.equal(/No SSH target/.test(message), true);

} finally {

        await rm(dir, {recursive: true, force: true});

}

});

test('resolveHost errors when dir missing', async (assert) => {

    const dir = join(tmpdir(), `composewatch-test-${Date.now()}-dir`);

    await mkdir(dir, {recursive: true});
    const path = join(dir, 'config.json');

    await writeFile(path, JSON.stringify({
        hosts: {
            staging: {ssh: 'deploy@staging', watched: ['web']},
        },
    }));

    try {

        let message = '';

        try {

            await resolveHost({env: 'staging', configPath: path});

} catch (err) {

            message = err instanceof Error ? err.message : String(err);

}
        assert.equal(/compose project directory/.test(message), true);

} finally {

        await rm(dir, {recursive: true, force: true});

}

});

test('resolveHost errors when watched missing', async (assert) => {

    const dir = join(tmpdir(), `composewatch-test-${Date.now()}-watched`);

    await mkdir(dir, {recursive: true});
    const path = join(dir, 'config.json');

    await writeFile(path, JSON.stringify({
        hosts: {
            staging: {ssh: 'deploy@staging', dir: '/srv/app/compose'},
        },
    }));

    try {

        let message = '';

        try {

            await resolveHost({env: 'staging', configPath: path});

} catch (err) {

            message = err instanceof Error ? err.message : String(err);

}
        assert.equal(/watched services/.test(message), true);

} finally {

        await rm(dir, {recursive: true, force: true});

}

});
