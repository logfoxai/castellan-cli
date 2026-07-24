#!/usr/bin/env node
import {Command} from 'commander';
import {
    CastellanClient,
    resolveCastellanToken,
    resolveCastellanUrl,
} from './castellan/client.js';
import {runWatch} from './modes/watch.js';
import {c} from './theme.js';

type WatchCliOpts = {
    url?: string;
    token?: string;
    forceCheck: boolean;
    pollMs: string;
    timeoutMs: string;
};

function parsePositiveInt(raw: string, flag: string): number {

    const value = Number(raw);

    if (!Number.isFinite(value) || !Number.isInteger(value) || value <= 0) {

        throw new Error(`${flag} must be a positive integer (got ${JSON.stringify(raw)})`);

    }

    return value;

}

async function runWatchCommand(services: string[], opts: WatchCliOpts): Promise<void> {

    if (services.length === 0) {

        throw new Error('At least one service name is required');

    }

    const baseUrl = resolveCastellanUrl(opts.url);
    const authToken = resolveCastellanToken(opts.token);
    const client = new CastellanClient({baseUrl, authToken});
    const code = await runWatch({
        client,
        serviceQueries: services,
        forceCheck: opts.forceCheck,
        pollMs: parsePositiveInt(opts.pollMs, '--poll-ms'),
        timeoutMs: parsePositiveInt(opts.timeoutMs, '--timeout-ms'),
    });

    process.exitCode = code;

}

const program = new Command();

program
    .name('castellan-cli')
    .description('Official CLI for Castellan — trigger rollouts and watch them settle.')
    .version('0.0.0-autorel')
    .argument('<services...>', 'Castellan service name(s) or repository basename (e.g. api, api-service)')
    .option('--url <url>', 'Castellan base URL (or CASTELLAN_URL)')
    .option('--token <token>', 'Bearer token (or CASTELLAN_AUTH_TOKEN)')
    .option('--no-force-check', 'Do not POST /v1/forceCheck; only watch')
    .option('--poll-ms <ms>', 'Poll interval milliseconds', '5000')
    .option('--timeout-ms <ms>', 'Overall timeout milliseconds', String(15 * 60_000))
    .action(async (services: string[], opts: WatchCliOpts) => {

        try {

            await runWatchCommand(services, opts);

        } catch (err) {

            const msg = err instanceof Error ? err.message : String(err);

            console.error(c.error(msg));
            process.exitCode = 1;

        }

    });

await program.parseAsync(process.argv);
