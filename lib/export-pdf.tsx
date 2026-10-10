import {Fragment} from 'react';
import {Document,Page,Text,View,StyleSheet,Font,pdf} from '@react-pdf/renderer';
import type {Resume} from './resume';
Font.register({family:'Lato',fonts:[{src:'/fonts/Lato-Regular.ttf',fontWeight:400},{src:'/fonts/Lato-Bold.ttf',fontWeight:700}]});
const s=StyleSheet.create({page:{paddingTop:40,paddingBottom:40,paddingHorizontal:44,fontFamily:'Lato',fontSize:10.5,lineHeight:1.35,color:'#111'},name:{fontSize:24,fontWeight:700,marginBottom:7,lineHeight:1.2,textAlign:'left'},title:{fontSize:12,marginBottom:7,textAlign:'left'},contact:{fontSize:10,marginBottom:12,textAlign:'left'},heading:{fontSize:12,fontWeight:700,marginTop:10,marginBottom:5,borderBottomWidth:.6,borderBottomColor:'#b9b9b9',paddingBottom:4},summary:{marginBottom:4},entryTitle:{fontWeight:700,fontSize:11.5,marginTop:5,marginBottom:2},meta:{fontSize:10,marginBottom:2},line:{marginBottom:3,paddingLeft:10},link:{fontSize:10,marginBottom:4}});
export function ResumePdf({resume:r}:{resume:Resume}){return <Document title={`${r.name} — Resume`} author={r.name} creator="CV Studio"><Page size="A4" style={s.page} wrap>
 {r.name&&<Text style={s.name} minPresenceAhead={35}>{r.name}</Text>}{r.title&&<Text style={s.title}>{r.title}</Text>}{r.contact.length>0&&<Text style={s.contact}>{r.contact.join(' · ')}</Text>}
 {r.summary&&<><Text style={s.heading} minPresenceAhead={30}>{r.summaryHeading.toUpperCase()}</Text><Text style={s.summary} orphans={2} widows={2}>{r.summary}</Text></>}
 {r.blocks.map((block,bi)=><Fragment key={bi}>{block.items.map((item,i)=><Fragment key={i}><View wrap={false} minPresenceAhead={item.link||item.lines.length?32:0}>{i===0&&<Text style={s.heading}>{block.heading.toUpperCase()}</Text>}{item.title&&<Text style={s.entryTitle}>{item.title}</Text>}{item.meta&&<Text style={s.meta}>{item.meta}</Text>}{item.dates&&<Text style={s.meta}>{item.dates}</Text>}</View>{item.link&&<Text style={s.link} orphans={2} widows={2}>{item.link}</Text>}{item.lines.map((line,j)=><Text key={j} style={s.line} orphans={2} widows={2}>• {line}</Text>)}</Fragment>)}</Fragment>)}
 </Page></Document>}
export async function createPdf(r:Resume){return pdf(<ResumePdf resume={r}/>).toBlob();}
