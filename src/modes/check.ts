import type {CastellanClient} from '../castellan/client.js';
import * as gh from '../ghAnnotations.js';
import {c} from '../theme.js';

const TAG = c.accent('[castellan]');

export type CheckOptions = {
    client: CastellanClient;
};

/** POST /v1/forceCheck and exit. */
export async function runCheck(opts: CheckOptions): Promise<number> {

    console.log(`${c.primary('==>')} Castellan forceCheck`);

    try {

        await opts.client.health();
        console.log(`${TAG} ${c.muted('POST /v1/forceCheck')}`);
        await opts.client.forceCheck();
        console.log(`${TAG} ${c.success('forceCheck accepted')}`);
        gh.notice('Castellan forceCheck accepted', {title: 'castellan-cli'});
        return 0;

    } catch (err) {

        const msg = err instanceof Error ? err.message : String(err);

        gh.error(msg, {title: 'castellan-cli: forceCheck failed'});
        console.error(c.error(msg));
        return 1;

    }

}
