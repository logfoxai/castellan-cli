import type {ForceCheckResponse, HistoryResponse, StatusResponse} from './types.js';

export type CastellanClientOptions = {
    baseUrl: string;
    authToken: string;
    fetchImpl?: typeof fetch;
};

export class CastellanClient {

    private readonly baseUrl: string;
    private readonly authToken: string;
    private readonly fetchImpl: typeof fetch;

    constructor(options: CastellanClientOptions) {

        this.baseUrl = options.baseUrl.replace(/\/$/, '');
        this.authToken = options.authToken;
        this.fetchImpl = options.fetchImpl ?? fetch;

    }

    async health(): Promise<void> {

        const response = await this.fetchImpl(`${this.baseUrl}/v1/health`, {method: 'GET'});

        if (!response.ok) {

            throw new Error(`Castellan health failed (${response.status})`);

        }

    }

    async status(): Promise<StatusResponse> {

        return this.rpc<StatusResponse>('status', {});

    }

    async history(): Promise<HistoryResponse> {

        return this.rpc<HistoryResponse>('history', {});

    }

    async forceCheck(): Promise<void> {

        const payload = await this.rpc<ForceCheckResponse>('forceCheck', {});

        if (payload.error) {

            throw new Error(`Castellan forceCheck error: ${payload.error}`);

        }

    }

    private async rpc<T>(method: string, body: unknown): Promise<T> {

        const response = await this.fetchImpl(`${this.baseUrl}/v1/${method}`, {
            method: 'POST',
            headers: {
                'content-type': 'application/json',
                authorization: `Bearer ${this.authToken}`,
            },
            body: JSON.stringify(body),
        });

        if (!response.ok) {

            const text = await response.text();

            throw new Error(`Castellan ${method} failed (${response.status}): ${text}`);

        }

        return await response.json() as T;

    }

}

export function resolveCastellanUrl(flag?: string): string {

    const url = (flag ?? process.env.CASTELLAN_URL)?.trim().replace(/\/$/, '');

    if (!url) {

        throw new Error('Castellan URL required via --url or CASTELLAN_URL');

    }

    return url;

}

export function resolveCastellanToken(flag?: string): string {

    const token = (flag ?? process.env.CASTELLAN_AUTH_TOKEN)?.trim();

    if (!token) {

        throw new Error('Castellan auth token required via --token or CASTELLAN_AUTH_TOKEN');

    }

    return token;

}
