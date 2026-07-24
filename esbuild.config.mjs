// Build a single ESM bundle for castellan-cli.

import {build, context} from 'esbuild';
import {readFileSync} from 'node:fs';

const pkg = JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf8'));
const external = Object.keys(pkg.dependencies);

const options = {
    entryPoints: ['src/cli.ts'],
    outfile: 'dist/cli.js',
    bundle: true,
    platform: 'node',
    target: 'node24',
    format: 'esm',
    sourcemap: true,
    external,
    logLevel: 'info',
    banner: {
        js: 'import {createRequire as __castellanCliCreateRequire} from "module"; const require = __castellanCliCreateRequire(import.meta.url);',
    },
};

const watch = process.argv.includes('--watch');

if (watch) {
    const ctx = await context(options);
    await ctx.watch();
    console.log('castellan-cli: watching for changes…');
} else {
    await build(options);
}
