// CLI entry point for `composewatch`.
//
// Subcommands:
//   watch     live monitor — TUI by default, CI streaming in CI
//   inspect   rich one-shot snapshot
//   ci        force CI streaming mode
//   tui       force interactive TUI
//
// Host resolution: --env <name> → ~/.config/composewatch/config.json
// Override with --ssh / COMPOSEWATCH_SSH.

import {Command} from 'commander';

import {runCi} from './modes/ci.js';
import {runSnapshot} from './modes/snapshot.js';
import {runTui} from './modes/tui.js';
import {defaultConfigPath, resolveHost} from './resolve/hostResolver.js';
import {c} from './theme.js';
import type {CliContext} from './types.js';

interface GlobalOpts {
    env?: string;
    ssh?: string;
    dir?: string;
    composeFile?: string;
    envFile?: string;
    watched?: string;
}

interface WatchCmdOpts {
    once?: boolean;
    forceCi?: boolean;
    forceTui?: boolean;
}

async function resolveContext(opts: GlobalOpts): Promise<CliContext> {

    const watched = opts.watched
        ? opts.watched.split(',').map((s) => s.trim()).filter(Boolean)
        : undefined;

    return resolveHost({
        env: opts.env,
        ssh: opts.ssh,
        dir: opts.dir,
        composeFile: opts.composeFile,
        envFile: opts.envFile,
        watched,
    });

}

async function contextOrExit(opts: GlobalOpts): Promise<CliContext | null> {

    try {

        const ctx = await resolveContext(opts);

        process.stderr.write(
            `${c.dim(`env ${ctx.env} · ${ctx.ssh} · ${ctx.dir}`)}\n`,
        );
        return ctx;

} catch (err) {

        console.error(c.error(err instanceof Error ? err.message : String(err)));
        process.exitCode = 1;
        return null;

}

}

async function main(): Promise<void> {

    const program = new Command();

    program
        .name('composewatch')
        .description(
            'Docker Compose deploy watcher + TUI over SSH. '
            + 'Streams plain output in CI; interactive TUI otherwise.',
        )
        .option('--env <name>', 'target env name; default COMPOSEWATCH_ENV or config default_env')
        .option('--ssh <user@host>', 'SSH target (overrides config)')
        .option('--dir <path>', 'remote compose project directory')
        .option('--compose-file <file>', 'compose file name (default docker-compose.yml)')
        .option('--env-file <path>', 'remote docker compose --env-file path (omit when unset in config)')
        .option('--watched <list>', 'comma-separated watched services')
        .showHelpAfterError();

    program
        .command('watch')
        .description('live monitor — TUI in a TTY, streaming output in CI')
        .option('--once', 'snapshot then exit')
        .option('--force-ci', 'force CI streaming output even on a TTY')
        .option('--force-tui', 'force the TUI even when CI=true or stdout is not a TTY')
        .action(async (cmdOpts: WatchCmdOpts) => {

            const ctx = await contextOrExit(program.opts<GlobalOpts>());

            if (!ctx) return;
            if (cmdOpts.once) {

                process.exitCode = await runCi(ctx, {once: true});
                return;

}
            const mode = cmdOpts.forceTui ? 'tui' : cmdOpts.forceCi ? 'ci' : 'auto';

            if (shouldUseTui(mode)) process.exitCode = await runTui(ctx);
            else process.exitCode = await runCi(ctx, {once: false});

});

    program
        .command('inspect')
        .description('rich one-shot snapshot (services, digests, health, diagnostics)')
        .option('--logs <n>', 'tail N recent log lines', (v) => parseInt(v, 10), 0)
        .action(async (cmdOpts: {logs: number}) => {

            const ctx = await contextOrExit(program.opts<GlobalOpts>());

            if (!ctx) return;
            process.exitCode = await runSnapshot(ctx, {logLines: cmdOpts.logs});

});

    program
        .command('ci')
        .description('force CI streaming mode (same as watch --force-ci)')
        .action(async () => {

            const ctx = await contextOrExit(program.opts<GlobalOpts>());

            if (!ctx) return;
            process.exitCode = await runCi(ctx, {once: false});

});

    program
        .command('tui')
        .description('force interactive TUI (overrides CI auto-detection)')
        .action(async () => {

            const ctx = await contextOrExit(program.opts<GlobalOpts>());

            if (!ctx) return;
            process.exitCode = await runTui(ctx);

});

    program.addHelpText('after', `
Config: ${defaultConfigPath()}
Example:
  {
    "default_env": "staging",
    "hosts": {
      "staging": {
        "ssh": "deploy@my-server",
        "dir": "/srv/app/compose",
        "watched": ["web", "worker"]
      }
    }
  }
`);

    await program.parseAsync(process.argv);

}

function shouldUseTui(force: 'tui' | 'ci' | 'auto'): boolean {

    if (force === 'tui') return true;
    if (force === 'ci') return false;
    if (process.env.CI === 'true' || process.env.GITHUB_ACTIONS === 'true') return false;
    if (!process.stdout.isTTY) return false;
    return true;

}

main().catch((err) => {

    console.error(c.error(err instanceof Error ? err.stack ?? err.message : String(err)));
    process.exit(1);

});
