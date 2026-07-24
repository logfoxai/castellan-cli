// SSH remote exec. Shell out to `ssh` so we reuse the user's keys/agent with zero extra deps on the host.

import {spawn} from 'node:child_process';

export interface SshResult {
    stdout: string;
    stderr: string;
    code: number;
}

export class SshError extends Error {

    readonly result: SshResult;

    constructor(message: string, result: SshResult) {

        super(message);
        this.name = 'SshError';
        this.result = result;

}

}

/**
 * Run `command` on `user@host` via OpenSSH.
 * Uses BatchMode so a missing key fails fast instead of hanging on a password prompt.
 */
export async function sshExec(sshTarget: string, command: string, opts: {timeoutMs?: number} = {}): Promise<SshResult> {

    const timeoutMs = opts.timeoutMs ?? 30_000;

    return new Promise((resolve, reject) => {

        const child = spawn(
            'ssh',
            [
                '-o', 'BatchMode=yes',
                '-o', 'ConnectTimeout=10',
                '-o', 'StrictHostKeyChecking=accept-new',
                sshTarget,
                command,
            ],
            {stdio: ['ignore', 'pipe', 'pipe']},
        );

        let stdout = '';
        let stderr = '';
        let settled = false;

        const timer = setTimeout(() => {

            if (settled) return;
            settled = true;
            child.kill('SIGKILL');
            reject(new SshError(
                `ssh to ${sshTarget} timed out after ${timeoutMs}ms — is the host reachable?`,
                {stdout, stderr, code: -1},
            ));

}, timeoutMs);

        child.stdout.on('data', (chunk: Buffer) => {

            stdout += chunk.toString('utf8');

});
        child.stderr.on('data', (chunk: Buffer) => {

            stderr += chunk.toString('utf8');

});

        child.on('error', (err) => {

            if (settled) return;
            settled = true;
            clearTimeout(timer);
            reject(new SshError(
                `failed to spawn ssh: ${err.message}`,
                {stdout, stderr, code: -1},
            ));

});

        child.on('close', (code) => {

            if (settled) return;
            settled = true;
            clearTimeout(timer);
            const result: SshResult = {stdout, stderr, code: code ?? 1};

            if (result.code !== 0) {

                const hint = stderr.trim() || stdout.trim() || `exit ${result.code}`;

                reject(new SshError(
                    `ssh ${sshTarget} failed: ${hint}`,
                    result,
                ));
                return;

}
            resolve(result);

});

});

}

/** Shell-escape a single argument for remote `sh -c`. */
export function shellQuote(value: string): string {

    return `'${value.replace(/'/g, '\'\\\'\'')}'`;

}
