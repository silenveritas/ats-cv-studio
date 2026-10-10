'use client';
import {Select,SelectContent,SelectItem,SelectTrigger,SelectValue} from '@/components/ui/select';
export default function StudioSelect({label,value,options,onChange,disabled=false,className=''}:{label:string;value:string;options:{value:string;label:string}[];onChange:(value:string)=>void;disabled?:boolean;className?:string}){
 return <Select value={value} onValueChange={onChange} disabled={disabled}><SelectTrigger aria-label={label} className={`studio-select-trigger ${className}`}><SelectValue/></SelectTrigger><SelectContent className="studio-select-content" position="popper" align="start" sideOffset={4} collisionPadding={12}>{options.map(option=><SelectItem key={option.value} value={option.value} title={option.label}>{option.label}</SelectItem>)}</SelectContent></Select>;
}
