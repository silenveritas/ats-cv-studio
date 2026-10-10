'use client';
import {useEffect,useRef,useState} from 'react';
import {FileText,Languages,Download,Check,Trash2,LoaderCircle,TriangleAlert,Palette,BookOpen,Plus,Save,FolderOpen} from 'lucide-react';
import {Tabs,TabsList,TabsTrigger} from '@/components/ui/tabs';
import {Accordion,AccordionItem,AccordionTrigger,AccordionContent} from '@/components/ui/accordion';
import {AlertDialog,AlertDialogTrigger,AlertDialogContent,AlertDialogHeader,AlertDialogTitle,AlertDialogDescription,AlertDialogFooter,AlertDialogCancel,AlertDialogAction} from '@/components/ui/alert-dialog';
import {Toaster} from '@/components/ui/sonner';
import {toast} from 'sonner';
import {headings,normalizeResume,filename,sectionKeys,type Draft,type Locale,type Section,type Entry} from '@/lib/resume';
import {copy} from '@/lib/copy';
import {useResumeDraft} from '@/hooks/use-resume-draft';
import {useResumeTools} from '@/hooks/use-resume-tools';
import ResumeEditor,{validation} from './resume-editor';
import ResumePreview from './resume-preview';
import ExampleLibrary from './example-library';
import {useStudioPreferences,type StudioTheme} from '@/hooks/use-studio-preferences';
import {studioCopy} from '@/lib/studio-copy';
import {cvLabel} from '@/lib/resume-collection';
import CvLibrary from './cv-library';
import StudioSelect from './studio-select';
const order:Section[]=['personal','summary',...sectionKeys];
function translationMissing(d:Draft,l:Locale){const other=l==='en'?'id':'en';return (!!d.title[other]&&!d.title[l])|| (!!d.summary[other]&&!d.summary[l])||sectionKeys.some(k=>d.sections[k].some(e=>Object.entries(e.text[other]).some(([key,s])=>s.trim()&&!e.text[l][key as keyof Entry['text']['en']].trim())));}
function ClearDraft({ui,disabled,onClear}:{ui:Locale;disabled:boolean;onClear:()=>void}){const t=copy[ui];return <AlertDialog><AlertDialogTrigger asChild><button className="clear-button" aria-label={t.clear} title={t.clear} disabled={disabled}><Trash2 size={14}/><span>{t.clear}</span></button></AlertDialogTrigger><AlertDialogContent><AlertDialogHeader><AlertDialogTitle>{t.clearTitle}</AlertDialogTitle><AlertDialogDescription>{t.clearDescription}</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel>{t.cancel}</AlertDialogCancel><AlertDialogAction onClick={onClear}>{t.confirmClear}</AlertDialogAction></AlertDialogFooter></AlertDialogContent></AlertDialog>;}
export default function ResumeBuilder({ownerId,signInHref,onSignOut,initialUi='en'}:{ownerId:string|null;signInHref:string;onSignOut:(flush:()=>Promise<boolean>,locale:Locale)=>Promise<void>;initialUi?:Locale}){
 const {theme,setTheme,failed:preferenceFailed}=useStudioPreferences();const [examplesOpen,setExamplesOpen]=useState(false),[cvsOpen,setCvsOpen]=useState(false);
 const {draft,setDraft,ready,recovery,save,reset,sample,setSample,items,activeId,create,open,rename,remove,saveNow,needsSignIn,migrationWarning,recovered}=useResumeDraft(ownerId);const [ui,setUi]=useState<Locale>(initialUi),[lang,setLang]=useState<Locale>('en'),[expanded,setExpanded]=useState<string[]>(['personal','summary']),[view,setView]=useState('edit');const [busy,setBusy]=useState<'pdf'|'docx'|null>(null),[issue,setIssue]=useState<'name'|'fields'|'failed'|null>(null);const exportRef=useRef(false);const t=copy[ui];
 useEffect(()=>{document.documentElement.lang=ui;},[ui]);useResumeTools(draft,setDraft,ui,lang,ready);
 const change=(fn:(d:Draft)=>Draft)=>{setDraft(fn);setIssue(null);};
 const clear=()=>{if(!reset()){toast.error(t.saveError);return;}setIssue(null);setExpanded(['personal','summary']);setView('edit');toast.success(t.cleared);};
 const st=studioCopy[ui];const hasDraft=Object.values(draft.contact).some(s=>s.trim())||Object.values(draft.title).some(s=>s.trim())||Object.values(draft.summary).some(s=>s.trim())||sectionKeys.some(k=>draft.sections[k].length>0);
 const loadExample=(next:Draft)=>{if(!reset()){toast.error(t.saveError);return;}setDraft(next);setSample(true);setIssue(null);setExpanded(['personal','summary']);setView('edit');toast.success(st.loaded);};
 const selectCv=(id:string)=>{if(open(id)){setIssue(null);setExpanded(['personal','summary']);setView('edit');}};
 const createCv=()=>{if(create()){setIssue(null);setExpanded(['personal','summary']);setView('edit');toast.success(st.created);}else toast.error(st.cvLimit);};
 const reveal=(section:Section)=>{setExpanded(open=>open.includes(section)?open:[...open,section]);setView('edit');requestAnimationFrame(()=>document.getElementById(`section-${section}`)?.scrollIntoView({block:'nearest'}));};
 const download=async(format:'pdf'|'docx')=>{
  if(exportRef.current)return;
  if(!draft.contact.name.trim()){setIssue('name');reveal('personal');return;}
  const errors=validation(draft,lang);if(errors.email||errors.dates.length){setIssue('fields');reveal(errors.email?'personal':sectionKeys.find(k=>draft.sections[k].some(e=>errors.dates.includes(e.id)))!);return;}
  exportRef.current=true;setBusy(format);setIssue(null);
  try{const n=normalizeResume(draft,lang);const blob=format==='pdf'?await(await import('@/lib/export-pdf')).createPdf(n):await(await import('@/lib/export-docx')).createDocx(n);const url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;a.download=filename(draft,lang,format);document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),30000);toast.success(t.exportSuccess);}catch{setIssue('failed');toast.error(t.exportError);}finally{setBusy(null);exportRef.current=false;}
 };
 return <div className="studio"><Toaster theme={theme==='dark'?'dark':'light'} position="bottom-right"/><header className="app-header">
  <a href="/" className="brand" aria-label="CV Studio"><FileText size={25}/><h1>CV Studio</h1></a>
  <div className="header-tools">
  <div className="ui-language"><Languages size={16}/><StudioSelect label={t.interfaceLanguage} value={ui} onChange={v=>setUi(v as Locale)} options={[{value:"en",label:"English"},{value:"id",label:"Bahasa Indonesia"}]}/></div>
  <div className="theme-control" title={st.themeHint}><Palette size={16}/><StudioSelect label={st.theme} value={theme} onChange={v=>setTheme(v as StudioTheme)} options={[{value:"light",label:st.light},{value:"dark",label:st.dark},{value:"monochrome",label:st.monochrome}]}/></div>
  <div className="download-actions" aria-label={t.downloadHint}><button className="button button-secondary" onClick={()=>download('docx')} disabled={!ready||!!busy}>{busy==='docx'?<LoaderCircle size={15} className="spin"/>:<FileText size={15}/>} {busy==='docx'?t.exportBusy:'DOCX'}</button><button className="button button-primary" onClick={()=>download('pdf')} disabled={!ready||!!busy}>{busy==='pdf'?<LoaderCircle size={15} className="spin"/>:<Download size={15}/>} {busy==='pdf'?t.exportBusy:t.download}</button></div>
  <button className="button button-secondary account-signout" onClick={()=>void onSignOut(saveNow,ui)} disabled={!ready||!!busy}>{ui==='en'?'Sign out':'Keluar'}</button><ClearDraft ui={ui} disabled={!ready||!!busy} onClear={clear}/></div>
 </header>
 <div className="cv-workspace-bar"><label className="current-cv"><span>{st.currentCv}</span><StudioSelect label={st.currentCv} value={activeId} onChange={selectCv} disabled={!ready||!!busy||recovery} options={items.map((cv,i)=>({value:cv.id,label:cvLabel(cv,ui,i)}))}/></label><span className={`database-status ${save==='unsaved'?'save-warning':''}`} role="status">{save==='saving'||save==='restoring'?<LoaderCircle size={14} className="spin"/>:save==='saved'?<Check size={14}/>:<TriangleAlert size={14}/>} {t[save]}</span><div className="cv-workspace-actions"><button className="button button-secondary" disabled={!ready||!!busy||recovery} onClick={()=>setCvsOpen(true)}><FolderOpen size={16}/>{st.myCvs} ({items.length})</button><button className="button button-secondary" disabled={!ready||!!busy} onClick={async()=>{if(await saveNow())toast.success(st.cvSaved);else toast.error(t.saveError);}}><Save size={16}/>{st.saveCv}</button><button className="button button-primary" disabled={!ready||!!busy||recovery} onClick={createCv}><Plus size={17}/>{st.newCv}</button></div></div>
 <Tabs className="mobile-view-tabs" value={view} onValueChange={setView}><TabsList aria-label={t.workspace}><TabsTrigger value="edit" id="edit-tab" aria-controls="editor-panel">{t.edit}</TabsTrigger><TabsTrigger value="preview" id="preview-tab" aria-controls="preview-panel">{t.preview}</TabsTrigger></TabsList></Tabs>
 <main className={`builder-grid view-${view}`}>
  <div className="editor-scroll" id="editor-panel" aria-label={t.editor}>
   <div className="resume-language-bar"><div><span>{t.resumeLanguage}</span><Tabs value={lang} onValueChange={v=>{setLang(v as Locale);setIssue(null)}}><TabsList aria-label={t.resumeLanguage}><TabsTrigger value="en">English</TabsTrigger><TabsTrigger value="id">Indonesia</TabsTrigger></TabsList></Tabs></div><button className="button button-secondary examples-button" onClick={()=>setExamplesOpen(true)} disabled={!ready||!!busy}><BookOpen size={16}/>{st.examples}</button></div>
   {preferenceFailed&&<div className="notice" role="status"><p>{st.themeSaveError}</p></div>}
   {sample&&<div className="notice example-notice" role="status"><BookOpen size={16}/><div><p>{st.loadedNotice}</p><button onClick={()=>setSample(false)}>{st.acknowledge}</button></div></div>}
   {needsSignIn&&<div className="notice notice-error" role="status"><p>{st.signInRequired} <a href={signInHref} target="_top">{st.signIn}</a></p></div>}
   {migrationWarning&&<div className="notice" role="status"><p>{st.migrationWarning}</p></div>}
   {recovered&&<div className="notice" role="status"><p>{st.recovered}</p></div>}
   {save==='unsaved'&&!needsSignIn&&<div className="notice notice-error" role="status"><TriangleAlert size={16}/><p>{recovery?t.restoreError:t.saveError}</p></div>}
   {issue&&<div className="notice notice-error" role="alert"><TriangleAlert size={16}/><p>{issue==='name'?t.nameError:issue==='fields'?t.fixError:t.exportError}</p></div>}
   {translationMissing(draft,lang)&&<div className="notice translation-notice" role="status"><Languages size={16}/><p>{t.missingTranslation}</p></div>}
   <Accordion type="multiple" value={expanded} onValueChange={setExpanded} className="resume-sections">{order.map(section=><AccordionItem key={section} value={section} id={`section-${section}`} className="section-card"><AccordionTrigger>{headings[ui][section]}</AccordionTrigger><AccordionContent><ResumeEditor draft={draft} ui={ui} lang={lang} active={section} ready={ready} issue={issue} change={change}/></AccordionContent></AccordionItem>)}</Accordion>
  </div>
  <ResumePreview draft={draft} ui={ui} lang={lang}/>
 </main><ExampleLibrary open={examplesOpen} onOpenChange={setExamplesOpen} ui={ui} lang={lang} confirmReplace={hasDraft||recovery} onLoad={loadExample}/><CvLibrary open={cvsOpen} onOpenChange={setCvsOpen} ui={ui} items={items} activeId={activeId} onSelect={selectCv} onRename={(id,name)=>{if(rename(id,name))toast.success(st.renamed);}} onDelete={id=>{if(remove(id)){setIssue(null);toast.success(st.deleted);}}}/></div>;
}
