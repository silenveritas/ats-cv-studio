'use client';
import {useCallback,useEffect,useRef,useState,type Dispatch,type SetStateAction} from 'react';
import {z} from 'zod';
import {blankDraft,STORAGE_KEY,type Draft} from '@/lib/resume';
import {initialCollection,restoreCollection,updateActive,newCv,MAX_CVS,COLLECTION_KEY,collectionSchema,type CvCollection} from '@/lib/resume-collection';
import {recoverCollection,snapshotSchema,type CvSnapshot} from '@/lib/cv-database';
const cacheSchema=z.object({version:z.literal(1),ownerId:z.string(),revision:z.number().int().nonnegative(),base:collectionSchema.nullable(),collection:collectionSchema,dirty:z.boolean(),legacyIncluded:z.boolean().optional()});
const equal=(a:unknown,b:unknown)=>JSON.stringify(a)===JSON.stringify(b);
function fresh():CvCollection{const cv=newCv();return {version:1,activeId:cv.id,items:[cv]};}
export function useResumeDraft(ownerId:string|null){
 const [collection,setCollection]=useState<CvCollection>(initialCollection),[ready,setReady]=useState(false),[save,setSave]=useState<'restoring'|'saving'|'saved'|'unsaved'>('restoring'),[migrationWarning,setMigrationWarning]=useState(false),[recovered,setRecovered]=useState(false),[needsSignIn,setNeedsSignIn]=useState(!ownerId);
 const current=useRef(collection),base=useRef<CvSnapshot>({ownerId:ownerId||'',collection:null,revision:0,mutationId:null}),loaded=useRef(false),dirty=useRef(false),initialised=useRef(false),mounted=useRef(false),migration=useRef(false),flight=useRef<Promise<boolean>|null>(null),loading=useRef<Promise<boolean>|null>(null),cacheAllowed=useRef(true);
 const cacheKey=`cv-studio:database-cache:v1:${ownerId}`,migrationKey=`cv-studio:database-migrated:v1:${ownerId}`;
 const cache=useCallback(()=>{if(!ownerId||!initialised.current||!cacheAllowed.current)return;try{localStorage.setItem(cacheKey,JSON.stringify({version:1,ownerId,revision:base.current.revision,base:base.current.collection,collection:current.current,dirty:dirty.current,legacyIncluded:migration.current}));}catch{/* Database saving still works when browser storage is unavailable. */}},[cacheKey,ownerId]);
 const install=useCallback((next:CvCollection)=>{current.current=next;if(mounted.current)setCollection(next);},[]);
 const mutate=useCallback((fn:(prev:CvCollection)=>CvCollection)=>{install(fn(current.current));dirty.current=true;setSave('saving');cache();},[install,cache]);
 const load=useCallback(()=>{
  if(loaded.current)return Promise.resolve(true);
  if(loading.current)return loading.current;
  const task=(async()=>{
   if(!ownerId){setNeedsSignIn(true);setSave('unsaved');return false;}
   let cached:z.infer<typeof cacheSchema>|null=null,legacy:CvCollection|null=null;
   if(!initialised.current){
    try{const raw=localStorage.getItem(cacheKey);if(raw){try{const parsed=cacheSchema.parse(JSON.parse(raw));if(parsed.ownerId===ownerId)cached=parsed;}catch{setMigrationWarning(true);try{localStorage.setItem(`${cacheKey}:unreadable:${Date.now()}`,raw);}catch{cacheAllowed.current=false;}}}
     if(!localStorage.getItem(migrationKey)){
      const hasLegacy=localStorage.getItem(COLLECTION_KEY)!==null||localStorage.getItem(STORAGE_KEY)!==null;
      if(hasLegacy){const restored=restoreCollection(localStorage);if(restored.recovery)setMigrationWarning(true);else{legacy=restored.collection;migration.current=true;}}
     }
    }catch{/* Local recovery is optional; use the authenticated database. */}
    let starting=cached?.collection||legacy||fresh();
    if(cached&&legacy&&!cached.legacyIncluded){try{starting=recoverCollection(cached.collection,legacy,null);}catch{starting=legacy;setMigrationWarning(true);}}
    install(starting);dirty.current=cached?.dirty||!!legacy;
    if(cached)base.current={ownerId,collection:cached.base,revision:cached.revision,mutationId:null};
    initialised.current=true;
   }
   try{
    const response=await fetch('/api/cvs',{credentials:'same-origin',headers:{'X-CV-Owner':ownerId},cache:'no-store',signal:AbortSignal.timeout(12000)});
    if(response.status===401){setNeedsSignIn(true);throw new Error('Sign in required');}
    if(!response.ok)throw new Error('Database unavailable');
    const snapshot=snapshotSchema.parse(await response.json());if(snapshot.ownerId!==ownerId)throw new Error('Account changed');
    const local=current.current,previousBase=base.current.collection;
    const next=dirty.current?recoverCollection(snapshot.collection,local,previousBase):snapshot.collection||local;
    if(dirty.current&&snapshot.collection&&!equal(next,local))setRecovered(true);
    base.current=snapshot;install(next);loaded.current=true;dirty.current=!equal(next,snapshot.collection);
    setNeedsSignIn(false);setSave(dirty.current?'saving':'saved');setReady(true);cache();return true;
   }catch{setSave('unsaved');setReady(true);cache();return false;}
  })();loading.current=task;void task.finally(()=>{loading.current=null;});return task;
 },[ownerId,cacheKey,migrationKey,install,cache]);
 const flush=useCallback(()=>{
  if(flight.current)return flight.current;
  const task=(async()=>{
   if(!loaded.current&&!(await load()))return false;
   if(!ownerId)return false;
   for(let attempt=0;attempt<6;attempt++){
    if(!dirty.current){setSave('saved');return true;}
    setSave('saving');const sending=current.current,previous=base.current;
    try{
     const response=await fetch('/api/cvs',{method:'POST',credentials:'same-origin',headers:{'Content-Type':'application/json','X-CV-Owner':ownerId},body:JSON.stringify({collection:sending,revision:previous.revision,mutationId:crypto.randomUUID()}),signal:AbortSignal.timeout(12000)});
     if(response.status===401)setNeedsSignIn(true);
     if(response.status!==409&&!response.ok)throw new Error('Database save failed');
     const snapshot=snapshotSchema.parse(await response.json());if(snapshot.ownerId!==ownerId)throw new Error('Account changed');
     if(response.status===409){const next=recoverCollection(snapshot.collection,current.current,previous.collection);base.current=snapshot;install(next);dirty.current=!equal(next,snapshot.collection);setRecovered(true);cache();continue;}
     base.current=snapshot;dirty.current=!equal(current.current,sending);cache();
     // Legacy data is removed only after the database has acknowledged the complete collection.
     if(migration.current){try{localStorage.setItem(migrationKey,'1');localStorage.removeItem(COLLECTION_KEY);localStorage.removeItem(STORAGE_KEY);migration.current=false;}catch{/* Preserve the original browser draft if cleanup fails. */}}
     if(!dirty.current){setSave('saved');return true;}
    }catch{cache();setSave('unsaved');return false;}
   }
   cache();setSave('unsaved');return false;
  })();flight.current=task;void task.finally(()=>{flight.current=null;});return task;
 },[ownerId,load,install,cache,migrationKey]);
 useEffect(()=>{mounted.current=true;void load();return()=>{mounted.current=false;};},[load]);
 useEffect(()=>{if(!ready||!ownerId||!loaded.current||!dirty.current)return;const timer=setTimeout(()=>void flush(),600);return()=>clearTimeout(timer);},[collection,ready,ownerId,flush]);
 useEffect(()=>{const retry=()=>{void flush();};window.addEventListener('online',retry);window.addEventListener('pagehide',cache);return()=>{window.removeEventListener('online',retry);window.removeEventListener('pagehide',cache);};},[flush,cache]);
 const setDraft:Dispatch<SetStateAction<Draft>>=useCallback(action=>mutate(prev=>updateActive(prev,cv=>({...cv,draft:typeof action==='function'?action(cv.draft):action}))),[mutate]);
 const setSample=useCallback((sample:boolean)=>mutate(prev=>updateActive(prev,cv=>({...cv,sample}))),[mutate]);
 function reset(){if(!ready||needsSignIn)return false;mutate(prev=>updateActive(prev,cv=>({...cv,draft:blankDraft(),sample:false})));return true;}
 function create(){if(!ready||needsSignIn||current.current.items.length>=MAX_CVS)return false;const cv=newCv();mutate(prev=>({...prev,activeId:cv.id,items:[...prev.items,cv]}));return true;}
 function open(id:string){if(!ready||needsSignIn||!current.current.items.some(cv=>cv.id===id))return false;mutate(prev=>({...prev,activeId:id}));return true;}
 function rename(id:string,label:string){if(!ready||needsSignIn||!label.trim()||label.trim().length>200)return false;mutate(prev=>({...prev,items:prev.items.map(cv=>cv.id===id?{...cv,label:label.trim(),updatedAt:new Date().toISOString()}:cv)}));return true;}
 function remove(id:string){if(!ready||needsSignIn)return false;mutate(prev=>{const items=prev.items.filter(cv=>cv.id!==id);if(!items.length)items.push(newCv());return {...prev,items,activeId:items.some(cv=>cv.id===prev.activeId)?prev.activeId:items[0].id};});return true;}
 const active=collection.items.find(cv=>cv.id===collection.activeId)!;
 return {draft:active.draft,setDraft,ready:ready&&!needsSignIn,recovery:false,save,reset,sample:active.sample,setSample,items:collection.items,activeId:collection.activeId,create,open,rename,remove,saveNow:flush,needsSignIn,migrationWarning,recovered};
}
