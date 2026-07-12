// Rich snapshot mode (`composewatch inspect`).

import {analyzeWithExpected} from '../analyze/diagnostics.js';
import {rootCause} from '../analyze/rootCause.js';
import {describeStack} from '../docker/compose.js';
import {tailLogs} from '../docker/logs.js';
import {table, termWidth, trunc, type Column} from '../format/table.js';
import {c} from '../theme.js';
import type {CliContext, ContainerSnapshot, Diagnostic, LogLine, RootCauseAnalysis, StackSnapshot} from '../types.js';
import {stackHealthy} from './rollout.js';

export interface SnapshotOptions {
    logLines?: number;
}

export async function runSnapshot(ctx: CliContext, opts: SnapshotOptions = {}): Promise<number> {

    let stack: StackSnapshot;

    try {

        stack = await describeStack(ctx);

} catch (err) {

        console.error(c.error(err instanceof Error ? err.message : String(err)));
        return 1;

}

    let logs: LogLine[] = [];

    if ((opts.logLines ?? 0) > 0) {

        logs = await safe(
            () => tailLogs(ctx, {tail: opts.logLines, services: ctx.watchedServices}),
            [] as LogLine[],
        );

}

    printHeader(stack, ctx);
    section('SERVICES');
    printServices(stack.containers);
    if (logs.length > 0) {

        section('LOGS', `${logs.length} lines`);
        printLogs(logs);

}

    const diagnostics = analyzeWithExpected(stack, ctx.watchedServices);

    section('DIAGNOSTICS');
    printDiagnostics(diagnostics);

    const analysis = rootCause({stack, diagnostics});

    section('ROOT CAUSE', `heuristic · ${analysis.elapsedMs}ms`);
    printRootCause(analysis);
    console.log('');

    if (diagnostics.some((d) => d.severity === 'error')) return 1;
    if (!stackHealthy(stack) && ctx.watchedServices.length > 0) return 1;
    return 0;

}

function section(label: string, subtitle?: string): void {

    console.log('');
    const head = c.accent(label);

    if (subtitle) console.log(`${head}  ${c.dim(subtitle)}`);
    else console.log(head);

}

function printHeader(stack: StackSnapshot, ctx: CliContext): void {

    console.log('');
    const watched = stack.containers.filter((x) => x.watched);
    const healthy = watched.filter((x) => x.state === 'running' && x.health !== 'unhealthy').length;

    console.log(
        `${c.accent(ctx.env)}  ${c.muted('via')}  ${c.fg(ctx.ssh)}  ${c.muted(ctx.dir)}`,
    );
    const sep = c.dim(' · ');

    console.log([
        kv('project', c.fg(stack.project)),
        kv('containers', c.fg(String(stack.containers.length))),
        kv('watched', c.fg(`${healthy}/${watched.length} ok`)),
    ].join(sep));

}

function kv(label: string, value: string): string {

    return `${c.muted(label)} ${value}`;

}

function printServices(containers: ContainerSnapshot[]): void {

    if (containers.length === 0) {

        console.log(c.dim('  (no containers)'));
        return;

}

    const cols: Column<ContainerSnapshot>[] = [
        {
            header: 'service',
            text: (row) => row.service,
            color: (row, t) => row.watched ? c.primary(t) : c.fg(t),
        },
        {
            header: 'state',
            text: (row) => row.state,
            color: (row, t) => row.state === 'running' ? c.success(t)
                : row.state === 'restarting' ? c.pending(t) : c.error(t),
        },
        {
            header: 'health',
            text: (row) => row.health === 'none' ? '—' : row.health,
            color: (row, t) => row.health === 'healthy' ? c.success(t)
                : row.health === 'unhealthy' ? c.error(t)
                    : row.health === 'starting' ? c.pending(t) : c.dim(t),
        },
        {
            header: 'image id',
            text: (row) => row.imageId || '—',
            color: (_, t) => c.muted(t),
        },
        {
            header: 'restarts',
            text: (row) => String(row.restartCount),
            color: (row, t) => row.restartCount > 0 ? c.warning(t) : c.dim(t),
            align: 'right',
        },
        {
            header: 'uptime',
            text: (row) => row.startedAt ? relTime(row.startedAt) : '—',
            color: (_, t) => c.muted(t),
            align: 'right',
        },
        {
            header: 'image',
            text: (row) => shortImage(row.image),
            color: (_, t) => c.fg(t),
            maxWidth: 48,
        },
    ];

    for (const line of table(containers, cols)) console.log(line);

}

function printLogs(logs: LogLine[]): void {

    const reserved = 2 + 8 + 2 + 16;
    const msgCap = Math.max(40, termWidth() - reserved);
    const cols: Column<LogLine>[] = [
        {header: 'time', text: (l) => l.timestamp.toISOString().slice(11, 19), color: (_, t) => c.dim(t)},
        {header: 'svc', text: (l) => l.stream || '—', color: (_, t) => c.muted(t), maxWidth: 16},
        {
            header: 'message',
            text: (l) => l.message,
            color: (l, t) => l.severity === 'error' ? c.error(t)
                : l.severity === 'warn' ? c.warning(t)
                    : l.severity === 'debug' ? c.dim(t) : c.fg(t),
            maxWidth: msgCap,
        },
    ];

    for (const line of table(logs, cols)) console.log(line);

}

function printDiagnostics(diagnostics: Diagnostic[]): void {

    if (diagnostics.length === 0) {

        console.log(`  ${c.success('●')} ${c.fg('No issues detected.')}`);
        return;

}
    for (const d of diagnostics) {

        const dot = d.severity === 'error' ? c.error('●') : d.severity === 'warn' ? c.warning('●') : c.info('●');
        const label = d.severity === 'error' ? c.error('error')
            : d.severity === 'warn' ? c.warning('warn') : c.info('info');

        console.log(`  ${dot} ${label}  ${c.fg(d.title)}`);
        console.log(`    ${c.muted(trunc(d.detail, termWidth() - 6))}`);
        if (d.suggestion) console.log(`    ${c.info(`→ ${trunc(d.suggestion, termWidth() - 8)}`)}`);

}

}

function printRootCause(a: RootCauseAnalysis): void {

    console.log(`  ${c.fg(a.summary)}`);
    if (a.likelyCauses.length > 0) {

        console.log('');
        console.log(`  ${c.warning('causes')}`);
        for (const cause of a.likelyCauses) console.log(`    ${c.dim('·')} ${c.fg(cause)}`);

}
    if (a.suggestedFixes.length > 0) {

        console.log('');
        console.log(`  ${c.success('fixes')}`);
        for (const fix of a.suggestedFixes) console.log(`    ${c.dim('·')} ${c.fg(fix)}`);

}

}

function shortImage(image: string): string {

    if (!image) return '—';
    const parts = image.split('/');

    return parts[parts.length - 1] ?? image;

}

function relTime(d: Date): string {

    const diff = Date.now() - d.getTime();
    const s = Math.round(diff / 1000);

    if (s < 60) return `${s}s`;
    if (s < 3600) return `${Math.round(s / 60)}m`;
    if (s < 86400) return `${Math.round(s / 3600)}h`;
    return `${Math.round(s / 86400)}d`;

}

async function safe<T>(fn: () => Promise<T>, fallback: T): Promise<T> {

    try {

        return await fn();

} catch {

        return fallback;

}

}
