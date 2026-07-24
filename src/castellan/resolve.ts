import type {ServiceStatus} from './types.js';

function repositoryBasename(repository: string): string {

    const parts = repository.split('/');

    return parts[parts.length - 1] ?? repository;

}

/**
 * Resolve a user query to a Castellan managed service.
 * Matches exact name first, then repository basename (e.g. api-service → api).
 */
export function resolveServices(
    services: ServiceStatus[],
    queries: string[],
): {resolved: ServiceStatus[]; missing: string[]} {

    const resolved: ServiceStatus[] = [];
    const missing: string[] = [];
    const seen = new Set<string>();

    for (const query of queries) {

        const match = matchService(services, query);

        if (!match) {

            missing.push(query);
            continue;

        }

        if (seen.has(match.name)) continue;
        seen.add(match.name);
        resolved.push(match);

    }

    return {resolved, missing};

}

function matchService(services: ServiceStatus[], query: string): ServiceStatus | undefined {

    const exact = services.find((service) => service.name === query);

    if (exact) return exact;

    const byRepo = services.filter((service) => {

        const base = repositoryBasename(service.repository);

        return base === query || service.repository === query;

    });

    if (byRepo.length === 1) return byRepo[0];

    if (byRepo.length > 1) {

        const names = byRepo.map((service) => service.name).join(', ');

        throw new Error(
            `Ambiguous service "${query}" matches repositories for: ${names}. Use the Castellan service name.`,
        );

    }

    return undefined;

}
