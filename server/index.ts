import {createServer,type IncomingMessage,type ServerResponse} from 'node:http';
import {readFile} from 'node:fs/promises';
import {resolve,sep,extname} from 'node:path';
import {z} from 'zod';
import {openDatabase} from './database';
import {hashPassword,verifyPassword,cookieToken,sessionCookie} from './auth';
import {saveRequestSchema,MAX_COLLECTION_BYTES} from '../lib/cv-database';
const port=Number(process.env.PORT||3000),host=process.env.BIND_ADDRESS||'127.0.0.1';
const origin=new URL(process.env.APP_ORIGIN||`http://127.0.0.1:${port}`).origin;
const secure=origin.startsWith('https:');
if(!secure&&!['127.0.0.1','localhost','[::1]'].includes(new URL(origin).hostname))throw new Error('APP_ORIGIN must use HTTPS outside localhost');
const registration=process.env.ALLOW_REGISTRATION!=='false';
const database=openDatabase(process.env.DATABASE_PATH||'./data/cv-studio.sqlite');
const staticRoot=resolve('dist/client');
const credentials=z.object({email:z.string().trim().email().max(254).transform(s=>s.toLowerCase()),password:z.string().min(12).max(128)}).strict();
const windows=new Map<string,{count:number;expires:number}>();
function rateLimit(ip:string){const now=Date.now();for(const [key,v] of windows)if(v.expires<now)windows.delete(key);if(windows.size>=10000&&!windows.has(ip))throw Object.assign(new Error(),{status:429,code:'rate_limited'});const row=windows.get(ip)||{count:0,expires:now+15*60000};row.count++;windows.set(ip,row);if(row.count>30)throw Object.assign(new Error(),{status:429,code:'rate_limited'});}
function fail(status:number,code:string):never{throw Object.assign(new Error(code),{status,code});}
function json(res:ServerResponse,data:unknown,status=200,cookie?:string){res.writeHead(status,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'private, no-store','Vary':'Cookie',...(cookie?{'Set-Cookie':cookie}:{})});res.end(JSON.stringify(data));}
async function body(req:IncomingMessage,limit:number){
 if(!/^application\/json(?:\s*;|$)/i.test(req.headers['content-type']||''))fail(415,'invalid_input');
 if(Number(req.headers['content-length']||0)>limit)fail(413,'too_large');
 let size=0;const chunks:Buffer[]=[];
 for await(const chunk of req){size+=chunk.length;if(size>limit)fail(413,'too_large');chunks.push(chunk);}
 try{return JSON.parse(Buffer.concat(chunks).toString('utf8'));}catch{fail(400,'invalid_input');}
}
function checkOrigin(req:IncomingMessage){if(req.headers.origin!==origin||req.headers['sec-fetch-site']==='cross-site')fail(403,'forbidden');}
const mime:Record<string,string>={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.svg':'image/svg+xml','.ttf':'font/ttf','.woff':'font/woff','.woff2':'font/woff2','.png':'image/png','.jpg':'image/jpeg','.zip':'application/zip','.txt':'text/plain; charset=utf-8'};
const server=createServer(async(req,res)=>{
 res.setHeader('X-Content-Type-Options','nosniff');res.setHeader('Referrer-Policy','same-origin');res.setHeader('X-Frame-Options','DENY');
 // The bundled PDF layout engine compiles WebAssembly; JavaScript eval stays blocked.
 res.setHeader('Content-Security-Policy',"default-src 'self'; script-src 'self' 'wasm-unsafe-eval'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; font-src 'self' data:; connect-src 'self'; worker-src 'self' blob:; object-src 'none'; base-uri 'self'; frame-ancestors 'none'; form-action 'self'");
 try{
  const url=new URL(req.url||'/',origin),path=url.pathname;
  if(path.startsWith('/api/')){
   if(req.method!=='GET'&&req.method!=='POST')fail(405,'method_not_allowed');
   if(req.method==='POST')checkOrigin(req);
   if(path==='/api/session'&&req.method==='GET'){json(res,{user:database.sessionUser(cookieToken(req.headers.cookie)),registration});return;}
   if((path==='/api/auth/register'||path==='/api/auth/login')&&req.method==='POST'){
    rateLimit(req.socket.remoteAddress||'unknown');
    let input:z.infer<typeof credentials>;try{input=credentials.parse(await body(req,8192));}catch(e){if(e instanceof z.ZodError)fail(400,'invalid_credentials');throw e;}
    if(path.endsWith('/register')){
     if(!registration)fail(403,'registration_closed');
     const hash=await hashPassword(input.password);
     if(database.userByEmail(input.email))fail(409,'account_exists');
     const user=database.createUser(input.email,hash);const token=database.startSession(user.id);json(res,{user},201,sessionCookie(token,secure));return;
    }
    const row=database.userByEmail(input.email);
    // Run the same password derivation for unknown accounts to avoid a cheap timing distinction.
    const dummy='scrypt:000000000000000000000000000000000000000000000000:'+('0'.repeat(128));
    if(!(await verifyPassword(input.password,row?.password_hash||dummy))||!row)fail(401,'invalid_credentials');
    const user={id:row.id,email:row.email};const old=cookieToken(req.headers.cookie);database.endSession(old);const token=database.startSession(row.id);json(res,{user},200,sessionCookie(token,secure));return;
   }
   const token=cookieToken(req.headers.cookie),user=database.sessionUser(token);if(!user)fail(401,'unauthenticated');
   if(path==='/api/auth/logout'&&req.method==='POST'){database.endSession(token);json(res,{ok:true},200,sessionCookie('',secure,true));return;}
   if(path==='/api/cvs'){
    // The header is a guard against a changed account in another tab; it never selects the owner.
    if(req.headers['x-cv-owner']!==user.id)fail(401,'account_changed');
    if(req.method==='GET'){json(res,database.read(user.id));return;}
    let input;try{input=saveRequestSchema.parse(await body(req,MAX_COLLECTION_BYTES+5000));}catch(e){if(e instanceof z.ZodError)fail(400,'invalid_input');throw e;}
    const result=database.save(user.id,input);json(res,result.snapshot,result.conflict?409:200);return;
   }
   fail(404,'not_found');
  }
  if(req.method!=='GET'&&req.method!=='HEAD')fail(405,'method_not_allowed');
  const requested=resolve(staticRoot,'.'+decodeURIComponent(path));if(!requested.startsWith(staticRoot+sep)&&requested!==staticRoot)fail(404,'not_found');
  let file=requested===staticRoot?resolve(staticRoot,'index.html'):requested;
  let bytes:Buffer;try{bytes=await readFile(file);}catch{if(extname(file))fail(404,'not_found');file=resolve(staticRoot,'index.html');bytes=await readFile(file);}
  res.writeHead(200,{'Content-Type':mime[extname(file)]||'application/octet-stream','Cache-Control':extname(file)==='.html'?'no-store':'public, max-age=86400'});res.end(req.method==='HEAD'?undefined:bytes);
 }catch(error){const e=error as {status?:number;code?:string};if(error instanceof RangeError)json(res,{error:'too_large'},413);else if(e.status)json(res,{error:e.code},e.status);else{console.error('Request failed');json(res,{error:'server_unavailable'},503);}}
});
server.requestTimeout=15000;server.headersTimeout=10000;
server.listen(port,host,()=>{const address=server.address();console.log(`ATS CV Studio running at http://${host}:${typeof address==='object'&&address?address.port:port}`);});
const stop=()=>server.close(()=>{database.db.close();process.exit(0);});process.on('SIGINT',stop);process.on('SIGTERM',stop);
