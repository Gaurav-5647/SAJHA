import React,{useState,useEffect,useRef} from 'react';
import {Sun,Moon,Monitor,Check} from 'lucide-react';
import {localizedElement} from './i18n.jsx';

/*
  SAJHA light / dark mode
  -----------------------
  preference  : 'system' (default) | 'light' | 'dark'   -> saved in localStorage
  light       : Pearl Light 3D UI   (zip 1)
  dark        : Obsidian Glass 3D UI (zip 2)
  system      : follows the device (prefers-color-scheme) and updates live when the OS switches.
  The resolved theme is written to <html data-theme="light|dark">; all CSS is scoped to it.
*/
export const THEME_KEY='sajha-theme';
const COLORS={light:'#f6f5fc',dark:'#282a2e'};
const mq=typeof window!=='undefined'&&window.matchMedia?window.matchMedia('(prefers-color-scheme: dark)'):null;

export function getPref(){try{const v=localStorage.getItem(THEME_KEY);return v==='light'||v==='dark'?v:'system'}catch{return 'system'}}
export function resolveTheme(pref){return pref==='dark'||(pref==='system'&&!!mq&&mq.matches)?'dark':'light'}
export function applyTheme(pref=getPref()){
  const theme=resolveTheme(pref),root=document.documentElement;
  root.dataset.theme=theme;root.dataset.themePref=pref;root.style.colorScheme=theme;
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content',COLORS[theme]);
  return theme;
}
export function setThemePref(pref){
  try{pref==='system'?localStorage.removeItem(THEME_KEY):localStorage.setItem(THEME_KEY,pref)}catch{}
  applyTheme(pref);window.dispatchEvent(new Event('sajha-theme'));
}
export function initTheme(){
  if(window.__sajhaTheme)return;window.__sajhaTheme=true;
  applyTheme();
  // device switched between light/dark -> follow it only while preference is "system"
  const onSystem=()=>{if(getPref()==='system'&&document.documentElement.dataset.theme!==resolveTheme('system')){applyTheme('system');window.dispatchEvent(new Event('sajha-theme'))}};
  if(mq){mq.addEventListener?mq.addEventListener('change',onSystem):mq.addListener&&mq.addListener(onSystem)}
  // safety net for browsers that deliver the media-query event late: re-check when the tab/app is shown again
  window.addEventListener('focus',onSystem);document.addEventListener('visibilitychange',()=>{if(!document.hidden)onSystem()});
  // another tab changed the preference
  window.addEventListener('storage',e=>{if(e.key===THEME_KEY||e.key===null){applyTheme();window.dispatchEvent(new Event('sajha-theme'))}});
}

const OPTIONS=[['light','Light',Sun],['dark','Dark',Moon],['system','Auto (system)',Monitor]];

export function ThemeToggle({className=''}){
  const[pref,setPref]=useState(getPref),[theme,setTheme]=useState(()=>document.documentElement.dataset.theme||resolveTheme(getPref())),[open,setOpen]=useState(false),box=useRef();
  useEffect(()=>{
    const sync=()=>{setPref(getPref());setTheme(document.documentElement.dataset.theme||resolveTheme(getPref()))};
    window.addEventListener('sajha-theme',sync);sync();
    return()=>window.removeEventListener('sajha-theme',sync);
  },[]);
  useEffect(()=>{
    if(!open)return;
    const away=e=>{if(box.current&&!box.current.contains(e.target))setOpen(false)},esc=e=>{if(e.key==='Escape')setOpen(false)};
    document.addEventListener('pointerdown',away);document.addEventListener('keydown',esc);
    return()=>{document.removeEventListener('pointerdown',away);document.removeEventListener('keydown',esc)};
  },[open]);
  return <div className={'theme-toggle '+className} ref={box}>
    <button type="button" className="theme-btn" aria-haspopup="menu" aria-expanded={open} aria-label="Theme" title="Theme" onClick={()=>setOpen(!open)}>
      {theme==='dark'?<Moon size={18}/>:<Sun size={18}/>}{pref==='system'&&<i className="auto-dot"/>}
    </button>
    {open&&<div className="theme-menu" role="menu">
      {OPTIONS.map(([value,label,Icon])=><button type="button" role="menuitemradio" aria-checked={pref===value} key={value} className={pref===value?'on':''} onClick={()=>{setThemePref(value);setOpen(false)}}>
        <Icon size={16}/><span>{label}</span>{pref===value&&<Check size={15} className="tick"/>}
      </button>)}
    </div>}
  </div>
}
