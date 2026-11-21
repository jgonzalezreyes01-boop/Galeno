import { createHash, randomBytes, scryptSync, timingSafeEqual, createHmac } from 'node:crypto';

export const MAX_DAYS_AHEAD = 30;
export const CANCEL_MIN_HOURS = 2;
export const NO_SHOW_GRACE_MINUTES = 20;
export const COOKIE_NAME = 'galeno_session';
export const SERVICES = [
  { id:'medicina_general', name:'Medicina general', caption:'Atención general · SOME', type:'general' },
  { id:'programas', name:'Programas de salud', caption:'Controles por sector', type:'program' }
];
export const ROLES = ['paciente','tutor','some','profesional'];

export function normalizeRut(value='') { return String(value).replace(/[^0-9kK]/g,'').toUpperCase(); }
export function validRut(value='') {
  const s = normalizeRut(value);
  if (!/^\d{7,8}[0-9K]$/.test(s)) return false;
  let sum=0, multiplier=2;
  for (const n of s.slice(0,-1).split('').reverse()) { sum+=Number(n)*multiplier; multiplier=multiplier===7?2:multiplier+1; }
  const rem=11-(sum%11);
  return s.at(-1) === (rem===11?'0':rem===10?'K':String(rem));
}
export function displayRut(value) {const s=normalizeRut(value); return s.length<2?'':`${Number(s.slice(0,-1)).toLocaleString('es-CL')}-${s.at(-1)}`;}
export function makeRut(base) {
  const s=String(base);let sum=0,m=2;
  for(const n of s.split('').reverse()){sum+=Number(n)*m;m=m===7?2:m+1;}
  let v=11-sum%11;return s+(v===11?'0':v===10?'K':v);
}
export const sha256 = value => createHash('sha256').update(value).digest('hex');
export function hashPassword(pass,salt=randomBytes(16).toString('hex')) { return `${salt}:${scryptSync(pass,salt,64).toString('hex')}`; }
export function checkPassword(pass,record) {
  try {const [salt,hex]=record.split(':');const got=scryptSync(pass,salt,64);const expected=Buffer.from(hex,'hex');return got.length===expected.length && timingSafeEqual(got,expected);}
  catch {return false;}
}
const b64 = data => Buffer.from(JSON.stringify(data)).toString('base64url');
export function signToken(payload,secret){
 const head=b64({alg:'HS256',typ:'JWT'}), body=b64(payload), content=`${head}.${body}`;
 return `${content}.${createHmac('sha256',secret).update(content).digest('base64url')}`;
}
export function verifyToken(token,secret) {
 try {
  const parts=token?.split('.'); if(parts?.length!==3) return null;
  const [h,b,sig]=parts;const exp=createHmac('sha256',secret).update(`${h}.${b}`).digest();const given=Buffer.from(sig,'base64url');
  if(exp.length!==given.length || !timingSafeEqual(exp,given)) return null;
  const header=JSON.parse(Buffer.from(h,'base64url')); if(header.alg!=='HS256') return null;
  const body=JSON.parse(Buffer.from(b,'base64url')); if(body.exp*1000<Date.now()) return null;
  return body;
 } catch{return null;}
}
export function parseDateTime(value){
 if(typeof value!=='string'|| !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}$/.test(value)) return null;
 const d=new Date(value);
 return Number.isFinite(d.valueOf()) && [d.getFullYear(),d.getMonth()+1,d.getDate(),d.getHours(),d.getMinutes(),d.getSeconds()].join(':')===value.replace(/[-T]/g,':').split(':').map(x=>Number(x)).join(':')?d:null;
}
export function localIso(date=new Date()){const p=n=>String(n).padStart(2,'0');return `${date.getFullYear()}-${p(date.getMonth()+1)}-${p(date.getDate())}T${p(date.getHours())}:${p(date.getMinutes())}:${p(date.getSeconds())}`;}
export function futureDay(days, hour=9, minute=0, base=new Date()) {let d=new Date(base);d.setHours(hour,minute,0,0);d.setDate(d.getDate()+days);return localIso(d);}
export function cleanText(value, max=150){return typeof value==='string'?value.trim().slice(0,max):'';}
