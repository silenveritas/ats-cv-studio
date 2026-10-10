import {test} from 'node:test';
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {randomUUID} from 'node:crypto';
import {DatabaseSync} from 'node:sqlite';
const origin='http://127.0.0.1:5173';
const blank={version:1,contact:{name:'Standalone QA',email:'',phone:'',location:'',website:''},title:{en:'Indonesian Language Expert',id:'Evaluator Bahasa Indonesia'},summary:{en:'Practice language review.',id:'Latihan review bahasa.'},sections:{experience:[],projects:[],education:[],skills:[],certifications:[],languages:[]}};
const collection=()=>{const id=randomUUID(),now=new Date().toISOString();return {version:1,activeId:id,items:[{id,label:'QA',createdAt:now,updatedAt:now,sample:false,draft:structuredClone(blank)}]};};
test('standalone accounts, sessions and private CV database',async t=>{
 const dir=await mkdtemp(join(tmpdir(),'ats-cv-test-')),database=join(dir,'cv.sqlite');let child,base;
 const start=async()=>{child=spawn(process.execPath,['dist/server/index.mjs'],{env:{...process.env,PORT:'0',BIND_ADDRESS:'127.0.0.1',APP_ORIGIN:origin,DATABASE_PATH:database,ALLOW_REGISTRATION:'true'},stdio:['ignore','pipe','pipe']});base=await new Promise((resolve,reject)=>{let output='';const timer=setTimeout(()=>reject(new Error('Server readiness timeout')),10000);child.stdout.on('data',s=>{output+=s;const m=output.match(/http:\/\/127\.0\.0\.1:(\d+)/);if(m){clearTimeout(timer);resolve(m[0]);}});child.once('exit',code=>{clearTimeout(timer);reject(new Error('Server exited '+code));});});};
 const stop=async()=>{if(child.exitCode!==null)return;await new Promise(resolve=>{child.once('exit',resolve);child.kill('SIGTERM');});};
 const request=async(path,{method='GET',cookie='',owner='',body,headers={}}={})=>{const r=await fetch(base+path,{method,headers:{Origin:origin,...(cookie?{Cookie:cookie}:{}),...(owner?{'X-CV-Owner':owner}:{}),...(body!==undefined?{'Content-Type':'application/json'}:{}),...headers},...(body!==undefined?{body:typeof body==='string'?body:JSON.stringify(body)}:{})});let data;try{data=await r.json();}catch{data=null;}return {status:r.status,data,cookie:r.headers.get('set-cookie')?.split(';')[0]||'',headers:r.headers};};
 try{
  await start();let a,b,cookieA,cookieB;const password='Local-QA-password-2026!';
  await t.test('signed-out access and validated registration',async()=>{
   assert.equal((await request('/api/session')).data.user,null);
   assert.equal((await request('/api/cvs')).status,401);
   assert.equal((await request('/api/auth/register',{method:'POST',body:{email:'a@example.test',password:'short'}})).status,400);
   const ra=await request('/api/auth/register',{method:'POST',body:{email:'a@example.test',password}});assert.equal(ra.status,201);a=ra.data.user;cookieA=ra.cookie;assert.match(ra.headers.get('set-cookie'),/HttpOnly; SameSite=Lax/);assert.ok(a.id);
   const rb=await request('/api/auth/register',{method:'POST',body:{email:'b@example.test',password}});assert.equal(rb.status,201);b=rb.data.user;cookieB=rb.cookie;
  });
  let snapshot,mutationId;const cv=collection();
  await t.test('bilingual save, retry and account isolation',async()=>{
   assert.equal((await request('/api/cvs',{cookie:cookieA,owner:a.id})).data.collection,null);
   mutationId=randomUUID();const input={collection:cv,revision:0,mutationId};const saved=await request('/api/cvs',{method:'POST',cookie:cookieA,owner:a.id,body:input});assert.equal(saved.status,200);snapshot=saved.data;assert.deepEqual(snapshot.collection,cv);assert.equal(snapshot.revision,1);
   const retry=await request('/api/cvs',{method:'POST',cookie:cookieA,owner:a.id,body:input});assert.equal(retry.status,200);assert.equal(retry.data.revision,1);
   assert.equal((await request('/api/cvs',{cookie:cookieB,owner:b.id})).data.collection,null);
   const wrong=await request('/api/cvs',{method:'POST',cookie:cookieB,owner:a.id,body:{collection:cv,revision:0,mutationId:randomUUID()}});assert.equal(wrong.status,401);assert.equal((await request('/api/cvs',{cookie:cookieB,owner:b.id})).data.collection,null);
  });
  await t.test('concurrent stale revisions have one winner',async()=>{
   const replies=await Promise.all([1,2].map(()=>request('/api/cvs',{method:'POST',cookie:cookieA,owner:a.id,body:{collection:cv,revision:1,mutationId:randomUUID()}})));assert.deepEqual(replies.map(r=>r.status).sort(),[200,409]);assert.equal((await request('/api/cvs',{cookie:cookieA,owner:a.id})).data.revision,2);
  });
  await t.test('origin, forged owner, input and byte guards',async()=>{
   const body={collection:cv,revision:2,mutationId:randomUUID()};
   assert.equal((await request('/api/cvs',{method:'POST',cookie:cookieA,owner:a.id,body,headers:{Origin:'https://untrusted.example'}})).status,403);
   assert.equal((await request('/api/cvs',{method:'POST',cookie:cookieA,owner:a.id,body:{...body,ownerId:b.id}})).status,400);
   assert.equal((await request('/api/cvs',{method:'POST',cookie:cookieA,owner:a.id,body,headers:{'Content-Type':'text/plain'}})).status,415);
   assert.equal((await request('/api/cvs',{method:'POST',cookie:cookieA,owner:a.id,body:'x'.repeat(1_510_000)})).status,413);
   assert.equal((await request('/api/cvs',{cookie:'cv_session=forged',owner:a.id})).status,401);
   assert.match((await request('/api/cvs',{cookie:cookieA,owner:a.id})).headers.get('cache-control'),/no-store/);
  });
  await t.test('persistent database and sessions survive restart',async()=>{await stop();await start();const r=await request('/api/cvs',{cookie:cookieA,owner:a.id});assert.equal(r.status,200);assert.equal(r.data.revision,2);assert.equal(r.data.collection.items[0].draft.summary.id,blank.summary.id);});
  await t.test('login rotation, password hashing and logout invalidation',async()=>{
   assert.equal((await request('/api/auth/login',{method:'POST',body:{email:a.email,password:'incorrect-password'}})).status,401);
   const r=await request('/api/auth/login',{method:'POST',cookie:cookieA,body:{email:a.email,password}});assert.equal(r.status,200);const next=r.cookie;assert.notEqual(next,cookieA);assert.equal((await request('/api/cvs',{cookie:cookieA,owner:a.id})).status,401);
   const db=new DatabaseSync(database);const row=db.prepare('SELECT password_hash FROM users WHERE id=?').get(a.id);assert.match(row.password_hash,/^scrypt:/);assert.ok(!row.password_hash.includes(password));const tokens=db.prepare('SELECT token_hash FROM sessions').all();assert.ok(tokens.every(r=>/^[a-f0-9]{64}$/.test(r.token_hash)));db.close();
   assert.equal((await request('/api/auth/logout',{method:'POST',cookie:next})).status,200);assert.equal((await request('/api/cvs',{cookie:next,owner:a.id})).status,401);
  });
 }finally{await stop();await rm(dir,{recursive:true,force:true});}
});
