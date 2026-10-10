'use client';
import {useState} from 'react';
import {BookOpen,Check,X} from 'lucide-react';
import {Dialog,DialogContent,DialogTitle,DialogDescription,DialogClose} from '@/components/ui/dialog';
import {AlertDialog,AlertDialogContent,AlertDialogHeader,AlertDialogTitle,AlertDialogDescription,AlertDialogFooter,AlertDialogCancel,AlertDialogAction} from '@/components/ui/alert-dialog';
import {Tabs,TabsList,TabsTrigger} from '@/components/ui/tabs';
import {examples,exampleDraft} from '@/lib/examples';
import {studioCopy} from '@/lib/studio-copy';
import {copy} from '@/lib/copy';
import type {Draft,Locale} from '@/lib/resume';
import ResumePreview from './resume-preview';
export default function ExampleLibrary({open,onOpenChange,ui,lang,confirmReplace,onLoad}:{open:boolean;onOpenChange:(v:boolean)=>void;ui:Locale;lang:Locale;confirmReplace:boolean;onLoad:(draft:Draft)=>void}){
 const [selected,setSelected]=useState(examples[0].id),[previewLang,setPreviewLang]=useState<Locale>(lang),[confirm,setConfirm]=useState(false);const t=studioCopy[ui],example=examples.find(e=>e.id===selected)!;
 const load=()=>{onLoad(exampleDraft(selected));setConfirm(false);onOpenChange(false);};
 return <Dialog open={open} onOpenChange={onOpenChange}><DialogContent className="example-dialog" showCloseButton={false}>
  <div className="library-header"><div><DialogTitle>{t.examplesTitle}</DialogTitle><DialogDescription>{t.examplesDescription}</DialogDescription></div><DialogClose asChild><button className="icon-button" aria-label={t.close}><X size={20}/></button></DialogClose></div>
  <div className="library-body"><div className="library-info">
   <div className="portfolio-note"><strong>{t.portfolioTitle}</strong><p>{t.portfolioHint}</p></div>
   {example.jobUrl&&<div className="portfolio-note"><a href={example.jobUrl} target="_blank" rel="noreferrer">{t.targetVacancy}</a>{example.practicePack&&<><p>{t.practiceHint}</p><a className="button button-secondary" href={example.practicePack} download>{t.downloadPractice}</a></>}</div>}
   <div className="sample-list" aria-label={t.examples}>{examples.map(e=><button key={e.id} className={`sample-choice ${e.id===selected?'selected':''}`} aria-pressed={e.id===selected} onClick={()=>setSelected(e.id)}><span className="sample-level">{t[e.level]}</span><strong>{e.title[ui]}</strong><span>{e.description[ui]}</span>{e.id===selected&&<Check size={17} aria-hidden="true"/>}</button>)}</div>
   <div className="sample-advice"><h3>{t.why}</h3><ul>{example.why[ui].map(s=><li key={s}>{s}</li>)}</ul><h3>{t.evidenceTitle}</h3><ul>{example.evidence[ui].map(s=><li key={s}>{s}</li>)}</ul><h3>{t.adapt}</h3><ul>{example.adapt[ui].map(s=><li key={s}>{s}</li>)}</ul><p>{t.evidenceTip}</p><div className="writing-sources"><span>{t.sourceLabel}</span><a href="https://careerservices.fas.harvard.edu/resources/create-a-strong-resume/" target="_blank" rel="noreferrer">{t.sourceHarvard}</a><a href="https://careerservices.upenn.edu/blog/2022/10/11/how-to-write-a-resume-with-no-work-experience/" target="_blank" rel="noreferrer">{t.sourcePenn}</a>{example.level==='careerChange'&&<a href="https://labelstud.io/guide/labeling" target="_blank" rel="noreferrer">{t.sourceAnnotation}</a>}</div></div>
  </div><div className="library-preview"><Tabs value={previewLang} onValueChange={v=>setPreviewLang(v as Locale)}><TabsList aria-label={copy[ui].resumeLanguage}><TabsTrigger value="en">English</TabsTrigger><TabsTrigger value="id">Indonesia</TabsTrigger></TabsList></Tabs><ResumePreview draft={example.draft} ui={ui} lang={previewLang} id="example-preview"/></div></div>
  <div className="library-footer"><p>{t.sampleNotice}</p><button className="button button-primary" onClick={()=>confirmReplace?setConfirm(true):load()}><BookOpen size={16}/>{t.useExample}</button></div>
  <AlertDialog open={confirm} onOpenChange={setConfirm}><AlertDialogContent><AlertDialogHeader><AlertDialogTitle>{t.replaceTitle}</AlertDialogTitle><AlertDialogDescription>{t.replaceDescription}</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel>{copy[ui].cancel}</AlertDialogCancel><AlertDialogAction onClick={load}>{t.replace}</AlertDialogAction></AlertDialogFooter></AlertDialogContent></AlertDialog>
 </DialogContent></Dialog>;
}
