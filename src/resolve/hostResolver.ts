// Resolve which compose host to talk to.
//
// Precedence for SSH target:
//   1. --ssh flag / COMPOSEWATCH_SSH
//   2. config.json hosts.<env>.ssh
//
// Config path: $XDG_CONFIG_HOME/composewatch/config.json
//            or ~/.config/composewatch/config.json

import {readFile} from 'node:fs/promises';
import {homedir} from 'node:os';
import {join} from 'node:path';

import type {CliContext} from '../types.js';

export const DEFAULT_COMPOSE_FILE = 'docker-compose.yml';

export interface HostConfig {
    ssh: string;
    dir?: string;
    compose_file?: string;
    env_file?: string | null;
    watched?: string[];
}

export interface ComposewatchConfig {
    hosts?: Record<string, HostConfig>;
    default_env?: string;
}

export interface ResolveOpts {
    env?: string;
    ssh?: string;
    dir?: string;
    composeFile?: string;
    envFile?: string | null;
    watched?: string[];
    configPath?: string;
}

function configDir(): string {

    if (process.env.XDG_CONFIG_HOME) return join(process.env.XDG_CONFIG_HOME, 'composewatch');
    return join(homedir(), '.config', 'composewatch');

}

export function defaultConfigPath(): string {

    return join(configDir(), 'config.json');

}

export async function loadConfig(path = defaultConfigPath()): Promise<ComposewatchConfig> {

    try {

        const raw = await readFile(path, 'utf8');

        return JSON.parse(raw) as ComposewatchConfig;

} catch (err) {

        const code = err && typeof err === 'object' && 'code' in err ? (err as {code?: string}).code : undefined;

        if (code === 'ENOENT') return {};
        throw err;

}

}

export async function resolveHost(opts: ResolveOpts = {}): Promise<CliContext> {

    const configPath = opts.configPath ?? defaultConfigPath();
    const config = await loadConfig(configPath);
    const env = opts.env
        ?? process.env.COMPOSEWATCH_ENV
        ?? config.default_env;

    if (!env) {

        throw new Error(
            `No target env. Set --env, COMPOSEWATCH_ENV, or default_env in ${configPath}.`,
        );

}

    const host = config.hosts?.[env];
    const ssh = opts.ssh
        ?? process.env.COMPOSEWATCH_SSH
        ?? host?.ssh;

    if (!ssh) {

        throw new Error(
            `No SSH target for env "${env}". Set --ssh, COMPOSEWATCH_SSH, or add hosts.${env}.ssh in ${configPath}.`,
        );

}

    const dir = opts.dir ?? host?.dir;

    if (!dir) {

        throw new Error(
            `No compose project directory for env "${env}". Set --dir or add hosts.${env}.dir in ${configPath}.`,
        );

}

    const watched = opts.watched
        ?? host?.watched;

    if (!watched || watched.length === 0) {

        throw new Error(
            `No watched services for env "${env}". Set --watched or add hosts.${env}.watched in ${configPath}.`,
        );

}

    const composeFile = opts.composeFile ?? host?.compose_file ?? DEFAULT_COMPOSE_FILE;
    const envFile = opts.envFile !== undefined
        ? opts.envFile
        : (host?.env_file !== undefined ? host.env_file : null);

    return {
        env,
        ssh,
        dir,
        composeFile,
        envFile,
        watchedServices: watched,
    };

}
