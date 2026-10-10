'use client';
/* eslint-disable react-hooks/set-state-in-effect -- Restore browser preferences after hydration and report persistence failures. */
import {useEffect,useState} from 'react';
export const themes=['light','dark','monochrome'] as const;
export type StudioTheme=typeof themes[number];
const KEY='cv-studio:preferences:v1';
export function useStudioPreferences(){
 const [theme,setTheme]=useState<StudioTheme>('light'),[loaded,setLoaded]=useState(false),[failed,setFailed]=useState(false);
 useEffect(()=>{try{const stored=JSON.parse(localStorage.getItem(KEY)||'{}');if(themes.includes(stored.theme))setTheme(stored.theme);}catch{setFailed(true);}setLoaded(true);},[]);
 useEffect(()=>{document.documentElement.dataset.theme=theme;document.documentElement.style.colorScheme=theme==='dark'?'dark':'light';},[theme]);
 useEffect(()=>{if(!loaded)return;try{localStorage.setItem(KEY,JSON.stringify({theme}));setFailed(false);}catch{setFailed(true);}},[theme,loaded]);
 return {theme,setTheme,failed};
}
