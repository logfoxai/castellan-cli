import {test} from 'kizu';
import {CastellanClient, resolveCastellanToken, resolveCastellanUrl} from './client.js';

test('resolveCastellanUrl requires value', (assert) => {

    const previous = process.env.CASTELLAN_URL;

    delete process.env.CASTELLAN_URL;

    try {

        assert.throws(() => resolveCastellanUrl(), /CASTELLAN_URL/);

    } finally {

        if (previous === undefined) delete process.env.CASTELLAN_URL;
        else process.env.CASTELLAN_URL = previous;

    }

});

test('resolveCastellanToken requires value', (assert) => {

    const previous = process.env.CASTELLAN_AUTH_TOKEN;

    delete process.env.CASTELLAN_AUTH_TOKEN;

    try {

        assert.throws(() => resolveCastellanToken(), /CASTELLAN_AUTH_TOKEN/);

    } finally {

        if (previous === undefined) delete process.env.CASTELLAN_AUTH_TOKEN;
        else process.env.CASTELLAN_AUTH_TOKEN = previous;

    }

});

test('CastellanClient posts forceCheck with bearer auth', async (assert) => {

    const calls: {url: string; init?: RequestInit}[] = [];
    const fetchImpl: typeof fetch = async (input, init) => {

        calls.push({url: String(input), init});
        return new Response(JSON.stringify({ok: true}), {status: 200});

    };

    const client = new CastellanClient({
        baseUrl: 'http://castellan.test:8443/',
        authToken: 'secret',
        fetchImpl,
    });

    await client.forceCheck();

    assert.equal(calls[0]?.url, 'http://castellan.test:8443/v1/forceCheck');
    const headers = calls[0]?.init?.headers as Record<string, string>;

    assert.equal(headers.authorization, 'Bearer secret');

});

test('CastellanClient status and history parse JSON', async (assert) => {

    const fetchImpl: typeof fetch = async (input) => {

        const url = String(input);

        if (url.endsWith('/status')) {

            return new Response(JSON.stringify({
                paused: false,
                services: [{
                    name: 'api',
                    registry: 'example.com',
                    repository: 'api-service',
                    tag: 'prime',
                    state: 'stable',
                    currentDigest: 'sha256:abc',
                    desiredDigest: 'sha256:abc',
                    rejectedDigests: [],
                    lastCheckAt: null,
                    lastError: null,
                    pollEnabled: true,
                }],
            }), {status: 200});

        }

        return new Response(JSON.stringify({events: []}), {status: 200});

    };

    const client = new CastellanClient({
        baseUrl: 'http://castellan.test:8443',
        authToken: 'secret',
        fetchImpl,
    });

    const status = await client.status();
    const history = await client.history();

    assert.equal(status.services[0]?.name, 'api');
    assert.equal(history.events.length, 0);

});
