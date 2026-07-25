import type {CastellanClient} from '../castellan/client.js';
import * as gh from '../ghAnnotations.js';
import {c} from '../theme.js';

export type CheckOptions = {
    client: CastellanClient;
};

/** Ask Castellan to check registries / roll out, then exit. */
export async function runCheck(opts: CheckOptions): Promise<number> {

    console.log('🔄 Checking registry for updates…');

    try {

        await opts.client.health();
        await opts.client.forceCheck();
        console.log('✓ Check started');
        gh.notice('Castellan check started', {title: 'castellan'});
        return 0;

    } catch (err) {

        const msg = err instanceof Error ? err.message : String(err);

        gh.error(msg, {title: 'castellan: check failed'});
        console.error(`❌ ${c.error(msg)}`);
        return 1;

    }

}
