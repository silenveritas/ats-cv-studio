import {Document,Paragraph,TextRun,Packer,HeadingLevel,AlignmentType} from 'docx';
import type {Resume} from './resume';
export function buildDocx(r:Resume){
 const children:Paragraph[]=[];
 const p=(text:string,keepNext=false)=>new Paragraph({text,spacing:{after:100},keepNext,widowControl:true});
 if(r.name)children.push(new Paragraph({children:[new TextRun({text:r.name,bold:true,size:44})],spacing:{after:140},keepNext:true,alignment:AlignmentType.LEFT}));
 if(r.title)children.push(new Paragraph({text:r.title,alignment:AlignmentType.LEFT,spacing:{after:100},keepNext:true}));
 if(r.contact.length)children.push(new Paragraph({text:r.contact.join(' · '),alignment:AlignmentType.LEFT,spacing:{after:100}}));
 const heading=(text:string)=>new Paragraph({text:text.toUpperCase(),heading:HeadingLevel.HEADING_2,spacing:{before:260,after:120},keepNext:true});
 if(r.summary)children.push(heading(r.summaryHeading),p(r.summary));
 for(const block of r.blocks){children.push(heading(block.heading));for(const item of block.items){
 if(item.title)children.push(new Paragraph({children:[new TextRun({text:item.title,bold:true})],spacing:{before:100,after:60},keepNext:!!(item.meta||item.dates||item.link||item.lines.length)}));
 if(item.meta)children.push(p(item.meta,!!(item.dates||item.link||item.lines.length)));
 if(item.dates)children.push(p(item.dates,!!(item.link||item.lines.length)));
 if(item.link)children.push(p(item.link,!!item.lines.length));
 for(const line of item.lines)children.push(new Paragraph({text:line,bullet:{level:0},spacing:{after:70},widowControl:true}));
 }}
 return new Document({
  creator:'CV Studio',title:r.name?`${r.name} — Resume`:'Resume',
  styles:{default:{
   document:{run:{font:'Calibri',size:22,color:'111111'},paragraph:{spacing:{line:276}}},
   heading2:{run:{font:'Calibri',size:24,bold:true,color:'111111'},paragraph:{keepNext:true}}
  }},
  sections:[{properties:{page:{size:{width:11906,height:16838},margin:{top:1020,bottom:1020,left:1020,right:1020}}},children:children.length?children:[new Paragraph('')]}]
 });
}
export async function createDocx(r:Resume){return Packer.toBlob(buildDocx(r));}
