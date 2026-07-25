#!/usr/bin/env node
import {Command} from 'commander';
import {
    CastellanClient,
    resolveCastellanToken,
    resolveCastellanUrl,
} from './castellan/client.js';
import {runCheck} from './modes/check.js';
import {runStatus} from './modes/status.js';
import {runWatch} from './modes/watch.js';
import {c} from './theme.js';

type GlobalOpts = {
    url?: string;
    token?: string;
};

type WatchOpts = GlobalOpts & {
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

function clientFrom(opts: GlobalOpts): CastellanClient {

    return new CastellanClient({
        baseUrl: resolveCastellanUrl(opts.url),
        authToken: resolveCastellanToken(opts.token),
    });

}

function addConnectionOptions(command: Command): Command {

    return command
        .option('--url <url>', 'Castellan base URL (or CASTELLAN_URL)')
        .option('--token <token>', 'Bearer token (or CASTELLAN_AUTH_TOKEN)');

}

async function withErrors(fn: () => Promise<void>): Promise<void> {

    try {

        await fn();

    } catch (err) {

        const msg = err instanceof Error ? err.message : String(err);

        console.error(c.error(msg));
        process.exitCode = 1;

    }

}

const program = new Command();

program
    .name('castellan')
    .description('Official CLI for Castellan — trigger rollouts and watch them settle.')
    .version('0.0.0-autorel');

addConnectionOptions(
    program
        .command('watch')
        .description('Stream rollout status until watched services settle (or fail)')
        .argument('<services...>', 'Castellan service name(s) or repository basename')
        .option('--no-force-check', 'Do not POST /v1/forceCheck; only watch')
        .option('--poll-ms <ms>', 'Poll interval milliseconds', '5000')
        .option('--timeout-ms <ms>', 'Overall timeout milliseconds', String(15 * 60_000))
        .action(async (services: string[], opts: WatchOpts) => {

            await withErrors(async () => {

                if (services.length === 0) {

                    throw new Error('At least one service name is required');

                }

                const code = await runWatch({
                    client: clientFrom(opts),
                    serviceQueries: services,
                    forceCheck: opts.forceCheck,
                    pollMs: parsePositiveInt(opts.pollMs, '--poll-ms'),
                    timeoutMs: parsePositiveInt(opts.timeoutMs, '--timeout-ms'),
                });

                process.exitCode = code;

            });

        }),
);

addConnectionOptions(
    program
        .command('status')
        .description('Print a one-shot Castellan status snapshot')
        .argument('[services...]', 'Optional service filter (name or repository basename)')
        .action(async (services: string[], opts: GlobalOpts) => {

            await withErrors(async () => {

                const code = await runStatus({
                    client: clientFrom(opts),
                    serviceQueries: services,
                });

                process.exitCode = code;

            });

        }),
);

addConnectionOptions(
    program
        .command('check')
        .description('POST /v1/forceCheck — ask Castellan to check registries and roll out if needed')
        .action(async (opts: GlobalOpts) => {

            await withErrors(async () => {

                const code = await runCheck({client: clientFrom(opts)});

                process.exitCode = code;

            });

        }),
);

await program.parseAsync(process.argv);
