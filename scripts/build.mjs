import {spawnSync} from 'node:child_process';
import {build} from 'esbuild';
const result=spawnSync(process.execPath,['node_modules/vite/bin/vite.js','build'],{stdio:'inherit'});if(result.status!==0)process.exit(result.status||1);
await build({entryPoints:['server/index.ts'],outfile:'dist/server/index.mjs',platform:'node',target:'node24',format:'esm',bundle:true,packages:'external'});
