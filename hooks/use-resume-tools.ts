'use client';
import {useEffect,useLayoutEffect,useRef,type Dispatch,type SetStateAction} from 'react';
import {flushSync} from 'react-dom';
import {draftSchema,sectionKeys,type Draft,type Locale} from '@/lib/resume';
import {copy} from '@/lib/copy';
type Tool={name:string;title:string;description:string;inputSchema:object;annotations:{readOnlyHint:boolean;untrustedContentHint:boolean};execute:(input:unknown)=>unknown};
type ModelContext={registerTool:(tool:Tool,options?:{signal:AbortSignal})=>void|Promise<void>};
const strings=(names:string[])=>({type:'object',properties:Object.fromEntries(names.map(n=>[n,{type:'string'}])),required:names,additionalProperties:false});
const bilingual=(schema:object)=>({type:'object',properties:{en:schema,id:schema},required:['en','id'],additionalProperties:false});
const entry={type:'object',properties:{id:{type:'string'},start:{type:'string',description:'YYYY-MM or empty'},end:{type:'string',description:'YYYY-MM or empty'},current:{type:'boolean'},link:{type:'string'},text:bilingual(strings(['title','organization','location','description']))},required:['id','start','end','current','link','text'],additionalProperties:false};
const jsonSchema={type:'object',properties:{version:{type:'integer',const:1},contact:strings(['name','email','phone','location','website']),title:bilingual({type:'string'}),summary:bilingual({type:'string'}),sections:{type:'object',properties:Object.fromEntries(sectionKeys.map(k=>[k,{type:'array',items:entry,maxItems:100}])),required:[...sectionKeys],additionalProperties:false}},required:['version','contact','title','summary','sections'],additionalProperties:false};
export function useResumeTools(draft:Draft,setDraft:Dispatch<SetStateAction<Draft>>,ui:Locale,lang:Locale,ready:boolean){
 const current=useRef({draft,ui,lang,ready});
 useLayoutEffect(()=>{current.current={draft,ui,lang,ready};},[draft,ui,lang,ready]);
 useEffect(()=>{
  const context=(document as Document&{modelContext?:ModelContext}).modelContext;if(!context?.registerTool)return;
  const lifecycle=new AbortController();
  const tools:Tool[]=[{name:'read_resume_draft',title:'Read resume draft',description:'Read the current bilingual resume draft and selected languages in this browser.',inputSchema:{type:'object',properties:{},additionalProperties:false},annotations:{readOnlyHint:true,untrustedContentHint:true},execute(input){if(!input||typeof input!=='object'||Array.isArray(input)||Object.keys(input).length)throw new Error('Expected an empty object');if(!current.current.ready)throw new Error('Draft is not ready');return {draft:structuredClone(current.current.draft),interfaceLanguage:current.current.ui,resumeLanguage:current.current.lang};}},{name:'update_resume_draft',title:'Update resume draft',description:'Replace the complete bilingual draft in the visible editor. Autosave saves the active CV to your private database collection. Does not translate text or download a file.',inputSchema:{type:'object',properties:{draft:jsonSchema},required:['draft'],additionalProperties:false},annotations:{readOnlyHint:false,untrustedContentHint:true},execute(input){if(!current.current.ready)throw new Error('Draft is not ready');if(!input||typeof input!=='object'||Array.isArray(input)||Object.keys(input).some(k=>k!=='draft'))throw new Error('Expected { draft }');const result=draftSchema.safeParse((input as {draft:unknown}).draft);if(!result.success)throw new Error(copy[current.current.ui].invalidDraft);flushSync(()=>setDraft(result.data));return {updated:true,version:1};}}];
  for(const tool of tools){try{Promise.resolve(context.registerTool(tool,{signal:lifecycle.signal})).catch(()=>{});}catch{/* Experimental API failures must not block the editor. */}}
  return ()=>lifecycle.abort();
 },[setDraft]);
}
