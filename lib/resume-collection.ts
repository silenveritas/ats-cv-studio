import {z} from 'zod';
import {blankDraft,draftSchema,STORAGE_KEY,type Draft,type Locale} from './resume';
export const COLLECTION_KEY='cv-studio:collection:v1';
export const MAX_CVS=50;
const recordSchema=z.object({id:z.string().min(1).max(100),label:z.string().max(200),createdAt:z.string().datetime(),updatedAt:z.string().datetime(),sample:z.boolean(),draft:draftSchema});
export type SavedCv=z.infer<typeof recordSchema>;
export const collectionSchema=z.object({version:z.literal(1),activeId:z.string().min(1),items:z.array(recordSchema).min(1).max(MAX_CVS)}).superRefine((c,ctx)=>{if(new Set(c.items.map(x=>x.id)).size!==c.items.length||!c.items.some(x=>x.id===c.activeId))ctx.addIssue({code:'custom',message:'Invalid CV identities'});});
export type CvCollection=z.infer<typeof collectionSchema>;
export function newCv(draft:Draft=blankDraft(),sample=false):SavedCv{const now=new Date().toISOString();return {id:crypto.randomUUID(),label:'',createdAt:now,updatedAt:now,sample,draft};}
export function initialCollection():CvCollection{return {version:1,activeId:'initial',items:[{id:'initial',label:'',createdAt:'1970-01-01T00:00:00.000Z',updatedAt:'1970-01-01T00:00:00.000Z',sample:false,draft:blankDraft()}]};}
export function cvLabel(cv:SavedCv,locale:Locale,index=0){return cv.label||[cv.draft.contact.name,cv.draft.title[locale]||cv.draft.title[locale==='en'?'id':'en']].filter(s=>s.trim()).join(' · ')||(locale==='en'?`Untitled CV ${index+1}`:`CV tanpa judul ${index+1}`);}
type BrowserStorage=Pick<Storage,'getItem'|'setItem'|'removeItem'>;
export function restoreCollection(source:BrowserStorage|(()=>BrowserStorage)):{collection:CvCollection;legacy:boolean;recovery:boolean;raw?:string;unavailable:boolean}{
 try{
  const storage=typeof source==='function'?source():source;
  const raw=storage.getItem(COLLECTION_KEY);
  if(raw!==null){try{return {collection:collectionSchema.parse(JSON.parse(raw)),legacy:false,recovery:false,unavailable:false};}catch{return {collection:initialCollection(),legacy:false,recovery:true,raw,unavailable:false};}}
  const legacy=storage.getItem(STORAGE_KEY);let draft=blankDraft(),sample=false;
  if(legacy!==null){try{draft=draftSchema.parse(JSON.parse(legacy));}catch{return {collection:initialCollection(),legacy:true,recovery:true,raw:legacy,unavailable:false};}}
  try{sample=JSON.parse(storage.getItem('cv-studio:preferences:v1')||'{}').sample===true;}catch{/* Theme preferences must not block migration. */}
  const first=newCv(draft,sample);return {collection:{version:1,activeId:first.id,items:[first]},legacy:legacy!==null,recovery:false,unavailable:false};
 }catch{return {collection:initialCollection(),legacy:false,recovery:false,unavailable:true};}
}
export function persistCollection(storage:BrowserStorage,collection:CvCollection,legacy:boolean){storage.setItem(COLLECTION_KEY,JSON.stringify(collectionSchema.parse(collection)));if(legacy)storage.removeItem(STORAGE_KEY);}
export function updateActive(collection:CvCollection,fn:(cv:SavedCv)=>SavedCv):CvCollection{return {...collection,items:collection.items.map(cv=>cv.id===collection.activeId?{...fn(cv),updatedAt:new Date().toISOString()}:cv)};}
