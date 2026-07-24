#!/usr/bin/env node
import {Command} from 'commander';
import {
    CastellanClient,
    resolveCastellanToken,
    resolveCastellanUrl,
} from './castellan/client.js';
import {runCi} from './modes/ci.js';
import {c} from './theme.js';

type CiCliOpts = {
    url?: string;
    token?: string;
    forceCheck: boolean;
    pollMs: string;
    timeoutMs: string;
};

async function runCiCommand(services: string[], opts: CiCliOpts): Promise<void> {

    if (services.length === 0) {

        throw new Error('At least one service name is required');

    }

    const baseUrl = resolveCastellanUrl(opts.url);
    const authToken = resolveCastellanToken(opts.token);
    const client = new CastellanClient({baseUrl, authToken});
    const code = await runCi({
        client,
        serviceQueries: services,
        forceCheck: opts.forceCheck,
        pollMs: Number(opts.pollMs),
        timeoutMs: Number(opts.timeoutMs),
    });

    process.exitCode = code;

}

const program = new Command();

program
    .name('castwatch')
    .description('Watch Castellan compose rollouts over HTTP (CI streaming).')
    .version('0.0.0-autorel');

program
    .command('ci', {isDefault: true})
    .description('Stream Castellan rollout status until settle or failure (CI gate)')
    .argument('<services...>', 'Castellan service name(s) or repository basename (e.g. api, api-service)')
    .option('--url <url>', 'Castellan base URL (or CASTELLAN_URL)')
    .option('--token <token>', 'Bearer token (or CASTELLAN_AUTH_TOKEN)')
    .option('--no-force-check', 'Do not POST /v1/forceCheck; only watch')
    .option('--poll-ms <ms>', 'Poll interval milliseconds', '5000')
    .option('--timeout-ms <ms>', 'Overall timeout milliseconds', String(15 * 60_000))
    .action(async (services: string[], opts: CiCliOpts) => {

        try {

            await runCiCommand(services, opts);

        } catch (err) {

            const msg = err instanceof Error ? err.message : String(err);

            console.error(c.error(msg));
            process.exitCode = 1;

        }

    });

await program.parseAsync(process.argv);
