// CI/streaming mode for compose + Watchtower rollouts.

import {analyzeWithExpected} from '../analyze/diagnostics.js';
import {rootCause} from '../analyze/rootCause.js';
import {describeStack, watchedDigests} from '../docker/compose.js';
import {tailLogs} from '../docker/logs.js';
import * as gh from '../ghAnnotations.js';
import {c, colorRolloutKind, colorStatusMessage, pill} from '../theme.js';
import type {CliContext, LogLine, StackSnapshot} from '../types.js';
import {evaluateRollout, nextRolloutState, stackHealthy, type RolloutWatchState} from './rollout.js';

const POLL_MS = 5_000;
const TAG = c.accent('[compose]');

export interface CiOptions {
    once: boolean;
}

export async function runCi(ctx: CliContext, opts: CiOptions): Promise<number> {

    console.log(`${c.primary('==>')} Watching ${c.fg(ctx.env)} via ${c.fg(ctx.ssh)} (${c.muted(ctx.dir)})`);

    let stack: StackSnapshot;

    try {

        stack = await describeStack(ctx);

} catch (err) {

        const msg = err instanceof Error ? err.message : String(err);

        gh.error(msg, {title: 'composewatch: host lookup failed'});
        console.error(c.error(msg));
        return 1;

}

    if (opts.once) {

        printSnapshot(stack, ctx);
        return stackHealthy(stack) ? 0 : 1;

}

    let rollout: RolloutWatchState = {
        baselineDigests: watchedDigests(stack),
        sawDigestChange: false,
        targetDigests: {},
        digestsStable: false,
    };

    let lastSig = '';
    const onSigint = (): void => {

        process.exit(130);

};

    process.on('SIGINT', onSigint);
    console.log(`${TAG} ${c.muted('waiting for Watchtower digest change (use --once for snapshot, Ctrl-C to stop)')}`);

    while (true) {

        try {

            stack = await describeStack(ctx);

} catch (err) {

            const msg = err instanceof Error ? err.message : String(err);

            console.error(`${TAG} ${c.warning(`describe failed: ${msg}`)}`);
            await sleep(POLL_MS);
            continue;

}

        const digests = watchedDigests(stack);

        rollout = nextRolloutState(rollout, digests);

        const sig = progressSignature(stack, rollout);
        const outcome = evaluateRollout(stack, rollout);

        if (sig !== lastSig) {

            printProgress(stack, rollout, outcome.kind === 'pending' ? outcome.reason : outcome.kind);
            lastSig = sig;

}

        if (outcome.kind === 'success') {

            console.log('');
            printSnapshot(stack, ctx);
            gh.notice(`Rollout complete on ${ctx.env}`, {title: 'composewatch: rollout complete'});
            process.removeListener('SIGINT', onSigint);
            return 0;

}
        if (outcome.kind === 'failed') {

            console.log('');
            console.error(c.error(`Rollout failed: ${outcome.reason}`));
            await emitFailureReport(ctx, stack);
            process.removeListener('SIGINT', onSigint);
            return 1;

}

        await sleep(POLL_MS);

}

}

function progressSignature(stack: StackSnapshot, state: RolloutWatchState): string {

    const watched = stack.containers.filter((c) => c.watched);

    return [
        state.sawDigestChange ? '1' : '0',
        state.digestsStable ? '1' : '0',
        ...watched.map((c) => `${c.service}:${c.imageId}:${c.state}:${c.health}:${c.restartCount}`),
    ].join('|');

}

function printProgress(stack: StackSnapshot, state: RolloutWatchState, reason: string): void {

    const watched = stack.containers.filter((c) => c.watched);
    const healthy = watched.filter((c) => c.state === 'running' && c.health !== 'unhealthy' && c.health !== 'starting').length;
    const phase = !state.sawDigestChange ? 'waiting'
        : !state.digestsStable ? 'pulling'
            : 'settling';

    console.log(
        `  ${TAG} ${colorRolloutKind(phase === 'settling' ? 'deploying' : 'pending')} `
        + `${c.fg(`${healthy}/${watched.length}`)} healthy  ${c.muted(reason)}`,
    );

}

function printSnapshot(stack: StackSnapshot, ctx: CliContext): void {

    console.log(c.accent('━'.repeat(60)));
    console.log(`${c.muted('env:')}        ${c.fg(ctx.env)}`);
    console.log(`${c.muted('ssh:')}        ${c.fg(ctx.ssh)}`);
    console.log(`${c.muted('dir:')}        ${c.fg(ctx.dir)}`);
    console.log(`${c.muted('project:')}    ${c.fg(stack.project)}`);
    console.log(`${c.muted('healthy:')}    ${pill(stackHealthy(stack) ? 'yes' : 'no', stackHealthy(stack) ? 'success' : 'error')}`);
    console.log(c.accent('━'.repeat(60)));
    console.log(c.muted('Watched services:'));
    for (const ctn of stack.containers.filter((x) => x.watched)) {

        const health = ctn.health === 'none' ? '—' : ctn.health;

        console.log(
            `  ${colorStatusMessage(ctn.service.padEnd(16))} ${c.fg(ctn.state.padEnd(10))} `
            + `${c.muted(health.padEnd(10))} ${c.dim(ctn.imageId)}  ${c.muted(ctn.status)}`,
        );

}

}

async function emitFailureReport(ctx: CliContext, stack: StackSnapshot): Promise<void> {

    gh.error(`${ctx.env} compose rollout FAILED`, {title: 'composewatch: rollout failed'});
    printSnapshot(stack, ctx);

    let logs: LogLine[] = [];

    await gh.withGroup('composewatch: recent logs', async () => {

        try {

            logs = await tailLogs(ctx, {tail: 80, services: ctx.watchedServices});
            if (logs.length === 0) {

                console.log(c.muted('  (no log lines)'));
                return;

}
            for (const line of logs.slice(-60)) {

                const stamp = c.dim(line.timestamp.toISOString().slice(11, 19));
                const colored = line.severity === 'error' ? c.error(line.message)
                    : line.severity === 'warn' ? c.warning(line.message)
                        : c.fg(line.message);

                console.log(`  ${stamp}  ${c.muted(line.stream)}  ${colored}`);

}

} catch (err) {

            console.log(c.dim(`  (could not tail logs: ${err instanceof Error ? err.message : String(err)})`));

}

});

    const diagnostics = analyzeWithExpected(stack, ctx.watchedServices);

    await gh.withGroup('composewatch: diagnostics', async () => {

        if (diagnostics.length === 0) {

            console.log(c.muted('  (no diagnostics matched)'));
            return;

}
        for (const d of diagnostics) {

            const tag = d.severity === 'error' ? c.error('[ERROR]')
                : d.severity === 'warn' ? c.warning('[WARN]') : c.info('[INFO]');

            console.log(`  ${tag} ${c.fg(d.title)}`);
            console.log(`    ${c.muted(d.detail)}`);
            if (d.suggestion) console.log(`    ${c.info(`→ ${d.suggestion}`)}`);

}

});

    await gh.withGroup('composewatch: root cause analysis', async () => {

        const analysis = rootCause({stack, diagnostics});

        console.log(`  ${pill('HEURISTIC', 'warning')} ${c.muted(`(${analysis.elapsedMs}ms)`)}`);
        console.log(`  ${c.accent('SUMMARY:')} ${c.fg(analysis.summary)}`);
        for (const cause of analysis.likelyCauses) console.log(`    ${c.warning('•')} ${c.fg(cause)}`);
        for (const fix of analysis.suggestedFixes) console.log(`    ${c.success('•')} ${c.fg(fix)}`);

});

}

function sleep(ms: number): Promise<void> {

    return new Promise((r) => setTimeout(r, ms));

}
