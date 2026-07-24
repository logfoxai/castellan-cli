import type {CastellanClient} from '../castellan/client.js';
import {resolveServices} from '../castellan/resolve.js';
import type {ServiceStatus} from '../castellan/types.js';
import * as gh from '../ghAnnotations.js';
import {c, colorServiceState, shortDigest} from '../theme.js';

const TAG = c.accent('[castellan]');

export type StatusOptions = {
    client: CastellanClient;
    serviceQueries: string[];
};

/** One-shot /v1/status dump. */
export async function runStatus(opts: StatusOptions): Promise<number> {

    let services: ServiceStatus[];
    let paused: boolean;

    try {

        await opts.client.health();
        const status = await opts.client.status();

        paused = status.paused;
        services = status.services;

    } catch (err) {

        const msg = err instanceof Error ? err.message : String(err);

        gh.error(msg, {title: 'castellan-cli: Castellan unreachable'});
        console.error(c.error(msg));
        return 1;

    }

    if (opts.serviceQueries.length > 0) {

        let resolved;

        try {

            resolved = resolveServices(services, opts.serviceQueries);

        } catch (err) {

            const msg = err instanceof Error ? err.message : String(err);

            gh.error(msg, {title: 'castellan-cli: ambiguous service'});
            console.error(c.error(msg));
            return 1;

        }

        if (resolved.missing.length > 0) {

            const known = services.map((service) => service.name).sort().join(', ') || '(none)';
            const msg = `Unknown Castellan service(s): ${resolved.missing.join(', ')}. Known: ${known}`;

            gh.error(msg, {title: 'castellan-cli: service not found'});
            console.error(c.error(msg));
            return 1;

        }

        services = resolved.resolved;

    }

    if (paused) {

        console.log(`${TAG} ${c.warning('Castellan polling is paused')}`);

    }

    if (services.length === 0) {

        console.log(`${TAG} ${c.muted('No managed services')}`);
        return 0;

    }

    console.log(`${c.primary('==>')} Castellan status (${services.length})`);

    for (const service of services) {

        const desired =
            service.desiredDigest && service.desiredDigest !== service.currentDigest
                ? ` ${c.muted('→')} ${c.dim(shortDigest(service.desiredDigest))}`
                : '';

        console.log(
            `${TAG} ${c.fg(service.name)} ${colorServiceState(service.state)} `
            + `${c.muted(`${service.repository}:${service.tag}`)} `
            + `${c.dim(shortDigest(service.currentDigest))}${desired}`,
        );

        if (service.lastError) {

            console.log(`  ${c.error(service.lastError)}`);

        }

    }

    return 0;

}
