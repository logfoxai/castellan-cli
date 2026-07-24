import {test} from 'kizu';

import {analyzeWithExpected} from './diagnostics.js';
import type {ContainerSnapshot, StackSnapshot} from '../types.js';

function container(partial: Partial<ContainerSnapshot> & {service: string}): ContainerSnapshot {

    return {
        name: partial.name ?? partial.service,
        id: 'id',
        state: partial.state ?? 'running',
        health: partial.health ?? 'healthy',
        image: 'img',
        imageId: 'abc',
        status: 'Up',
        exitCode: partial.exitCode ?? null,
        startedAt: partial.startedAt ?? new Date(),
        createdAt: new Date(),
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

test('analyzeWithExpected flags missing watched services', (assert) => {

    const diags = analyzeWithExpected(stack([]), ['web']);

    assert.equal(diags.some((d) => d.id === 'missing-web'), true);

});

test('analyzeWithExpected flags exited containers', (assert) => {

    const diags = analyzeWithExpected(
        stack([container({service: 'web', state: 'exited', exitCode: 1, health: 'none'})]),
        ['web'],
    );

    assert.equal(diags.some((d) => d.id === 'exited-web'), true);

});

test('analyzeWithExpected flags unhealthy containers', (assert) => {

    const diags = analyzeWithExpected(
        stack([container({
            service: 'web',
            health: 'unhealthy',
            startedAt: new Date(Date.now() - (5 * 60_000)),
        })]),
        ['web'],
    );

    assert.equal(diags.some((d) => d.id === 'unhealthy-web' && d.severity === 'error'), true);

});
