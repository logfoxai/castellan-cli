/** Castellan managed-service runtime states (from Castellan ServiceRuntime). */
export type ServiceState =
    | 'idle'
    | 'checking'
    | 'updating'
    | 'stable'
    | 'rollback'
    | 'failed';

export type DeploymentEventType = 'check' | 'deploy' | 'rollback' | 'failure';

export type ServiceStatus = {
    name: string;
    registry: string;
    repository: string;
    tag: string;
    state: ServiceState;
    currentDigest: string | null;
    desiredDigest: string | null;
    rejectedDigests: string[];
    lastCheckAt: string | null;
    lastError: string | null;
    pollEnabled: boolean;
};

export type StatusResponse = {
    paused: boolean;
    services: ServiceStatus[];
};

export type DeploymentEvent = {
    at: string;
    type: DeploymentEventType;
    service: string;
    message: string;
};

export type HistoryResponse = {
    events: DeploymentEvent[];
};

export type ForceCheckResponse = {
    ok?: boolean;
    error?: string;
};
