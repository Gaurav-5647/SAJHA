// Chatbot localisation: the assistant always answers in the customer's profile language.
// Hindi and English replies are written natively in app.js; every other language is produced by
// translating the English reply (cached in MongoDB, so each sentence is translated only once).
import {translateMany,validLanguage} from './translation.js';
import {matchServices} from './service-matcher.js';

export const chatLanguage=(req,requested)=>validLanguage(requested)?requested:(validLanguage(req.user?.language)?req.user.language:'en');
export const baseLanguage=l=>l==='hi'?'hi':'en';

// Customer typed in another language/script (Bengali, Tamil, Urdu...) -> translate to English so the
// service matcher can understand it. Hindi/English/Hinglish that already match are left untouched.
export async function understandChat(text,services){
  if(!text||!/[^\u0000-\u007f]/.test(text))return text;
  if(matchServices(text,services).length)return text;
  try{const [r]=await translateMany([text],'en','auto');return r?.status==='translated'&&r.text?.trim()?r.text:text}catch{return text}
}

export async function localizeChat(body,target){
  if(!body||target==='en'||target==='hi'||!validLanguage(target))return body;
  const slots=[];const add=(value,set)=>{if(typeof value==='string'&&value.trim())slots.push({value,set})};
  add(body.message,x=>{body.message=x});
  for(const s of body.suggestions||[])add(s.label,x=>{s.label=x});
  if(!slots.length)return body;
  const out=await translateMany(slots.map(s=>s.value),target,'en');
  out.forEach((r,i)=>{if(r?.status==='translated'&&r.text?.trim())slots[i].set(r.text)});
  body.language=target;
  return body;
}
