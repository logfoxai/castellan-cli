// Container log tail over SSH (`docker compose logs`).

import type {CliContext, LogLine} from '../types.js';
import {shellQuote, sshExec} from './ssh.js';

function composePrefix(ctx: CliContext): string {

    const cd = `cd ${shellQuote(ctx.dir)}`;
    const base = ctx.envFile
        ? `docker compose --env-file ${shellQuote(ctx.envFile)} -f ${shellQuote(ctx.composeFile)}`
        : `docker compose -f ${shellQuote(ctx.composeFile)}`;

    return `${cd} && ${base}`;

}

function classifySeverity(message: string): LogLine['severity'] {

    const lower = message.toLowerCase();

    if (/\berror\b|\bfatal\b|\bexception\b|\bpanic\b/.test(lower)) return 'error';
    if (/\bwarn(ing)?\b/.test(lower)) return 'warn';
    if (/\bdebug\b/.test(lower)) return 'debug';
    return 'info';

}

/**
 * Parse `docker compose logs` lines. Format is typically:
 *   service-name  | message
 * With --timestamps:
 *   service-name  | 2024-01-01T12:00:00.000000000Z message
 */
export function parseComposeLogLine(raw: string, now = new Date()): LogLine | null {

    const line = raw.replace(/\r$/, '');

    if (!line.trim()) return null;

    const pipe = line.indexOf('|');

    if (pipe === -1) {

        return {
            timestamp: now,
            message: line.trim(),
            stream: '',
            severity: classifySeverity(line),
        };

}

    const stream = line.slice(0, pipe).trim();
    const rest = line.slice(pipe + 1).trimStart();

    // Optional RFC3339 / nanosecond timestamp prefix.
    const tsMatch = rest.match(/^(\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:?\d{2})?)\s+(.*)$/);
    let timestamp = now;
    let message = rest;

    if (tsMatch) {

        const parsed = new Date(tsMatch[1]!);

        if (!Number.isNaN(parsed.getTime())) timestamp = parsed;
        message = tsMatch[2] ?? '';

}

    return {
        timestamp,
        message,
        stream,
        severity: classifySeverity(message),
    };

}

export async function tailLogs(
    ctx: CliContext,
    opts: {tail?: number; services?: string[]} = {},
): Promise<LogLine[]> {

    const tail = opts.tail ?? 80;
    const services = opts.services?.length ? opts.services.map(shellQuote).join(' ') : '';
    const prefix = composePrefix(ctx);
    const cmd = `${prefix} logs --no-color --timestamps --tail ${tail}${services ? ` ${services}` : ''}`;
    const result = await sshExec(ctx.ssh, cmd, {timeoutMs: 45_000});
    const lines: LogLine[] = [];

    for (const raw of result.stdout.split('\n')) {

        const parsed = parseComposeLogLine(raw);

        if (parsed) lines.push(parsed);

}
    return lines;

}

/**
 * One-shot poll of recent logs. Used by the TUI ring buffer (no long-lived
 * SSH stream — we re-poll every few seconds for simplicity and reliability).
 */
export async function pollLogs(
    ctx: CliContext,
    opts: {tail?: number; services?: string[]; since?: Date} = {},
): Promise<LogLine[]> {

    const lines = await tailLogs(ctx, {tail: opts.tail ?? 100, services: opts.services});

    if (!opts.since) return lines;
    const sinceMs = opts.since.getTime();

    return lines.filter((l) => l.timestamp.getTime() >= sinceMs);

}
