import {randomBytes, scrypt, timingSafeEqual, createHash} from 'node:crypto';
const options={N:65536,r:8,p:2,maxmem:96*1024*1024};
let running=0;
async function key(password:string,salt:string){
 if(running>=2)throw Object.assign(new Error('Try again shortly'),{status:429,code:'rate_limited'});
 running++;
 try{return await new Promise<Buffer>((resolve,reject)=>scrypt(password,salt,64,options,(error,value)=>error?reject(error):resolve(value)));}finally{running--;}
}
export async function hashPassword(password:string){const salt=randomBytes(24).toString('hex');return `scrypt:${salt}:${(await key(password,salt)).toString('hex')}`;}
export async function verifyPassword(password:string,stored:string){const [algorithm,salt,hash]=stored.split(':');if(algorithm!=='scrypt'||!salt||!hash)return false;const actual=await key(password,salt),expected=Buffer.from(hash,'hex');return expected.length===actual.length&&timingSafeEqual(actual,expected);}
export const tokenHash=(token:string)=>createHash('sha256').update(token).digest('hex');
export const newToken=()=>randomBytes(32).toString('base64url');
export function cookieToken(cookie:string|undefined){const matches=(cookie||'').split(';').map(s=>s.trim()).filter(s=>s.startsWith('cv_session='));if(matches.length!==1)return null;const token=matches[0].slice('cv_session='.length);return /^[A-Za-z0-9_-]{43}$/.test(token)?token:null;}
export function sessionCookie(token:string,secure:boolean,clear=false){return `cv_session=${clear?'':token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${clear?0:30*24*3600}${secure?'; Secure':''}`;}
