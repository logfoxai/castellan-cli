import {test} from 'kizu';
import {resolveServices} from './resolve.js';
import type {ServiceStatus} from './types.js';

function service(partial: Partial<ServiceStatus> & Pick<ServiceStatus, 'name' | 'repository'>): ServiceStatus {

    return {
        registry: 'example.com',
        tag: 'prime',
        state: 'stable',
        currentDigest: 'sha256:aaa',
        desiredDigest: 'sha256:aaa',
        rejectedDigests: [],
        lastCheckAt: null,
        lastError: null,
        pollEnabled: true,
        ...partial,
    };

}

test('resolveServices matches exact Castellan name', (assert) => {

    const services = [
        service({name: 'api', repository: 'api-service'}),
        service({name: 'ingest-worker', repository: 'ingest-worker'}),
    ];
    const {resolved, missing} = resolveServices(services, ['api']);

    assert.equal(missing.length, 0);
    assert.equal(resolved.map((item) => item.name).join(','), 'api');

});

test('resolveServices matches repository basename (api-service → api)', (assert) => {

    const services = [
        service({name: 'api', repository: '123.dkr.ecr.us-east-2.amazonaws.com/api-service'}),
    ];
    const {resolved, missing} = resolveServices(services, ['api-service']);

    assert.equal(missing.length, 0);
    assert.equal(resolved[0]?.name, 'api');

});

test('resolveServices reports missing queries', (assert) => {

    const services = [service({name: 'api', repository: 'api-service'})];
    const {resolved, missing} = resolveServices(services, ['nope']);

    assert.equal(resolved.length, 0);
    assert.equal(missing.join(','), 'nope');

});

test('resolveServices dedupes when query aliases the same service', (assert) => {

    const services = [service({name: 'api', repository: 'api-service'})];
    const {resolved, missing} = resolveServices(services, ['api', 'api-service']);

    assert.equal(missing.length, 0);
    assert.equal(resolved.length, 1);
    assert.equal(resolved[0]?.name, 'api');

});
