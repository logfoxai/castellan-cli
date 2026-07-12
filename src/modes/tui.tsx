import {render} from 'ink';
import React from 'react';

import {App} from '../ui/App.js';
import type {CliContext} from '../types.js';

const ENTER_ALT_SCREEN = '\x1b[?1049h';
const LEAVE_ALT_SCREEN = '\x1b[?1049l';

export async function runTui(ctx: CliContext): Promise<number> {

    let restored = false;
    const restore = (): void => {

        if (restored) return;
        restored = true;
        process.stdout.write(LEAVE_ALT_SCREEN);

};

    process.stdout.write(ENTER_ALT_SCREEN);
    process.on('exit', restore);

    const {waitUntilExit} = render(<App ctx={ctx} />, {
        exitOnCtrlC: false,
    });

    try {

        await waitUntilExit();

} finally {

        restore();
        process.removeListener('exit', restore);

}
    return 0;

}
