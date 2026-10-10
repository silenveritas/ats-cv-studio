import {FileText} from 'lucide-react';
import {copy} from '@/lib/copy';
import {normalizeResume,type Draft,type Locale} from '@/lib/resume';
export default function ResumePreview({draft,ui,lang,id='preview-panel'}:{draft:Draft;ui:Locale;lang:Locale;id?:string}){
 const t=copy[ui],pt=copy[lang],r=normalizeResume(draft,lang);
 return <section className="preview-panel" id={id} aria-label={t.preview}><article className="resume-paper" lang={lang}><h2>{r.name||pt.yourName}</h2>{r.title&&<p className="resume-title">{r.title}</p>}{r.contact.length>0&&<p className="resume-contact">{r.contact.join(' · ')}</p>}{r.summary&&<section className="resume-section"><h3>{r.summaryHeading}</h3><p className="resume-summary">{r.summary}</p></section>}{r.blocks.map(block=><section className="resume-section" key={block.heading}><h3>{block.heading}</h3>{block.items.map((item,i)=><div className="resume-entry" key={i}>{item.title&&<h4>{item.title}</h4>}{item.meta&&<p className="resume-meta">{item.meta}</p>}{item.dates&&<p className="resume-dates">{item.dates}</p>}{item.link&&<p className="resume-link">{item.link}</p>}{item.lines.length>0&&<ul>{item.lines.map((line,j)=><li key={j}>{line}</li>)}</ul>}</div>)}</section>)}{!r.summary&&!r.blocks.length&&<div className="empty-preview"><FileText size={28}/><h3>{pt.startsHere}</h3><p>{pt.emptyPreview}</p></div>}</article></section>;
}
