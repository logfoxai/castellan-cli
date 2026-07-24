// Shared types for composewatch. Normalized shapes so UI / CI never juggle
// raw `docker compose` JSON quirks.

export type HealthStatus = 'healthy' | 'unhealthy' | 'starting' | 'none' | 'unknown';

export type ContainerState = 'running' | 'exited' | 'restarting' | 'created' | 'paused' | 'dead' | 'unknown';

export interface ContainerSnapshot {
    /** Compose service name (e.g. web). */
    service: string;
    /** Container name. */
    name: string;
    /** Container ID (short). */
    id: string;
    state: ContainerState;
    health: HealthStatus;
    /** Image reference as reported by compose (tag or digest). */
    image: string;
    /** Image ID / digest from `docker inspect` — used for rollout tracking. */
    imageId: string;
    /** Raw Status string from compose (includes uptime / exit info). */
    status: string;
    exitCode: number | null;
    startedAt: Date | null;
    createdAt: Date | null;
    restartCount: number;
    /** True when this service is in the watched set for rollout / CI. */
    watched: boolean;
}

export interface LogLine {
    timestamp: Date;
    message: string;
    stream: string;
    severity: 'info' | 'warn' | 'error' | 'debug';
}

export interface Diagnostic {
    id: string;
    severity: 'info' | 'warn' | 'error';
    title: string;
    detail: string;
    suggestion?: string;
    sourceServices?: string[];
}

export interface RootCauseAnalysis {
    source: 'heuristic';
    summary: string;
    likelyCauses: string[];
    suggestedFixes: string[];
    elapsedMs: number;
}

export interface StackSnapshot {
    env: string;
    ssh: string;
    dir: string;
    project: string;
    containers: ContainerSnapshot[];
    fetchedAt: Date;
}

export interface CliContext {
    env: string;
    ssh: string;
    dir: string;
    composeFile: string;
    watchedServices: string[];
    /** Env-file path on the remote host (optional). */
    envFile: string | null;
}
