import {spawn} from 'node:child_process';
import {loadEnvFile} from 'node:process';
import {build} from 'esbuild';
try{loadEnvFile('.env');}catch(e){if(e.code!=='ENOENT')throw e;}
const port=Number(process.env.DEV_PORT||5173),backendPort=Number(process.env.PORT||3000);
await build({entryPoints:['server/index.ts'],outfile:'dist/server/index.mjs',platform:'node',target:'node24',format:'esm',bundle:true,packages:'external'});
const api=spawn(process.execPath,['dist/server/index.mjs'],{stdio:'inherit',env:{...process.env,APP_ORIGIN:`http://127.0.0.1:${port}`,PORT:String(backendPort),BIND_ADDRESS:'127.0.0.1'}});
const web=spawn(process.execPath,['node_modules/vite/bin/vite.js','--host','127.0.0.1','--port',String(port)],{stdio:'inherit',env:{...process.env,API_PORT:String(backendPort)}});
let stopping=false;const stop=()=>{if(stopping)return;stopping=true;api.kill('SIGTERM');web.kill('SIGTERM');};process.on('SIGINT',stop);process.on('SIGTERM',stop);for(const p of [api,web])p.on('exit',()=>{stop();});
