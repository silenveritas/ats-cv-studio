import {z} from 'zod';
import {collectionSchema,type CvCollection} from './resume-collection';
export const MAX_COLLECTION_BYTES=1_500_000;
export const saveRequestSchema=z.object({collection:collectionSchema,revision:z.number().int().min(0).max(2147483646),mutationId:z.string().uuid()}).strict();
export const snapshotSchema=z.object({collection:collectionSchema.nullable(),revision:z.number().int().min(0),ownerId:z.string().min(1),mutationId:z.string().nullable()});
export type CvSnapshot=z.infer<typeof snapshotSchema>;
function same(a:unknown,b:unknown){return JSON.stringify(a)===JSON.stringify(b);}
// Three-way recovery keeps remote changes and copies conflicting local edits.
export function recoverCollection(remote:CvCollection|null,local:CvCollection,base:CvCollection|null):CvCollection{
 if(!remote)return collectionSchema.parse(local);
 const items=[...remote.items],mapped=new Map<string,string>();
 for(const cv of local.items){
  const old=base?.items.find(x=>x.id===cv.id),index=items.findIndex(x=>x.id===cv.id),saved=items[index];
  if(old&&same(cv,old))continue;
  if(saved&&same(cv,saved)){mapped.set(cv.id,saved.id);continue;}
  if(index>=0&&old&&same(saved,old)){items[index]=cv;mapped.set(cv.id,cv.id);continue;}
  if(index<0&&!old){items.push(cv);mapped.set(cv.id,cv.id);continue;}
  const id=crypto.randomUUID();items.push({...cv,id,label:`${cv.label||cv.draft.contact.name||'CV'} (2)`.slice(0,200)});mapped.set(cv.id,id);
 }
 if(base)for(const old of base.items){if(local.items.some(x=>x.id===old.id))continue;const i=items.findIndex(x=>x.id===old.id);if(i>=0&&same(items[i],old))items.splice(i,1);}
 const activeId=mapped.get(local.activeId)||local.activeId;
 return collectionSchema.parse({version:1,items,activeId:items.some(x=>x.id===activeId)?activeId:items[0]?.id});
}
