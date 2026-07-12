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
        env: 'prime',
        ssh: 'u@h',
        dir: '/opt/logfox/compose',
        project: 'logfox',
        containers,
        fetchedAt: new Date(),
    };

}

test('analyzeWithExpected flags missing watched services', (assert) => {

    const diags = analyzeWithExpected(stack([]), ['api-1']);

    assert.equal(diags.some((d) => d.id === 'missing-api-1'), true);

});

test('analyzeWithExpected flags exited containers', (assert) => {

    const diags = analyzeWithExpected(
        stack([container({service: 'api-1', state: 'exited', exitCode: 1, health: 'none'})]),
        ['api-1'],
    );

    assert.equal(diags.some((d) => d.id === 'exited-api-1'), true);

});

test('analyzeWithExpected flags unhealthy containers', (assert) => {

    const diags = analyzeWithExpected(
        stack([container({
            service: 'api-1',
            health: 'unhealthy',
            startedAt: new Date(Date.now() - (5 * 60_000)),
        })]),
        ['api-1'],
    );

    assert.equal(diags.some((d) => d.id === 'unhealthy-api-1' && d.severity === 'error'), true);

});
