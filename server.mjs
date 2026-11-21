import http from 'node:http';
import { readFileSync } from 'node:fs';
import { join, extname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { randomBytes, timingSafeEqual } from 'node:crypto';
import { createStore, audit, notify, tx } from './src/store.mjs';
import { SERVICES, COOKIE_NAME, normalizeRut, validRut, displayRut, checkPassword, signToken, verifyToken, parseDateTime, localIso, cleanText, MAX_DAYS_AHEAD, CANCEL_MIN_HOURS, NO_SHOW_GRACE_MINUTES } from './src/domain.mjs';

process.env.TZ='America/Santiago';
const ROOT=resolve(fileURLToPath(new URL('.',import.meta.url)));
const PUBLIC=join(ROOT,'public');
const TYPES={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.svg':'image/svg+xml','.png':'image/png','.ico':'image/x-icon'};
const STATUS={400:'Solicitud incorrecta',401:'Debes iniciar sesión',403:'Acceso no autorizado',404:'No encontrado',409:'Existe un conflicto',422:'Datos incorrectos',429:'Demasiados intentos'};
class ApiError extends Error { constructor(code,message){ super(message||STATUS[code]);this.code=code;} }
const fail=(status,message)=>{throw new ApiError(status,message);};
const isInt=x=>Number.isSafeInteger(x)&&x>0;
const serialize=user=>({id:user.id,name:user.display_name,role:user.role,rut:displayRut(user.rut),sector:user.sector,clinicalFile:user.role==='paciente'?user.clinical_file:null});
const today=()=>localIso().slice(0,10);
const starts=slot=>new Date(slot.starts_at).getTime();
const stamp=()=>localIso();

export function createGalenoServer({ databasePath=process.env.GALENO_DB_FILE||join(ROOT,'data','galeno.sqlite'), secret=process.env.GALENO_SECRET||'solo-para-demostracion-cambiar-antes-de-publicar' }={}) {
 if(process.env.NODE_ENV==='production' && secret==='solo-para-demostracion-cambiar-antes-de-publicar') throw Error('Configura GALENO_SECRET en producción.');
 if(process.env.NODE_ENV==='production' && (!process.env.GALENO_DEMO_USER || !process.env.GALENO_DEMO_PASSWORD || process.env.GALENO_DEMO_PASSWORD.length < 12)) throw Error('Configura GALENO_DEMO_USER y GALENO_DEMO_PASSWORD (mínimo 12 caracteres) en producción.');
 const db=createStore(databasePath);const attempts=new Map();
 const one=(sql,...args)=>db.prepare(sql).get(...args);
 const all=(sql,...args)=>db.prepare(sql).all(...args);
 const run=(sql,...args)=>db.prepare(sql).run(...args);
 const userById=id=>one('SELECT * FROM users WHERE id=?',id);
 function patientFor(actor,patientId){
  const pid=patientId===undefined?actor.id:Number(patientId);
  if(!isInt(pid)) fail(422,'Paciente inválido.');
  const patient=userById(pid); if(!patient||patient.role!=='paciente'||!patient.registered) fail(403,'Paciente no habilitado.');
  if(actor.role==='paciente'&&pid===actor.id) return patient;
  if(actor.role==='tutor'&&one("SELECT id FROM dependent_links WHERE tutor_id=? AND patient_id=? AND status='aprobado'",actor.id,pid)) return patient;
  fail(403,'No tienes autorización para gestionar las horas de este paciente.');
 }
 function auth(req){
  const cookie=(req.headers.cookie||'').split(';').map(x=>x.trim()).find(x=>x.startsWith(COOKIE_NAME+'='));
  const payload=verifyToken(cookie?.slice(COOKIE_NAME.length+1),secret);
  if(!payload || !isInt(payload.uid) || typeof payload.sid!=='string') fail(401);
  const record=one('SELECT * FROM sessions WHERE id=? AND user_id=? AND revoked=0 AND expires_at>?',payload.sid,payload.uid,stamp());
  if(!record) fail(401);
  const person=userById(payload.uid);if(!person)fail(401);return {person,payload};
 }
 function only(role,actor){if(![].concat(role).includes(actor.role))fail(403,'Tu perfil no permite realizar esta acción.');}
 async function input(req){
  const pieces=[];let length=0;
  for await(const p of req){length+=p.length;if(length>16384)fail(413,'Solicitud demasiado grande.');pieces.push(p);}
  try {const json=JSON.parse(Buffer.concat(pieces).toString('utf8')||'{}');if(!json||Array.isArray(json)||typeof json!=='object')fail(422);return json;}
  catch(err){if(err instanceof ApiError)throw err;fail(400,'El contenido enviado no es un JSON válido.');}
 }
 function send(res,status,data,extra={}){res.writeHead(status,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store',...extra});res.end(JSON.stringify(data));}
 function secureCookie(req){return req.socket.encrypted||req.headers['x-forwarded-proto']==='https'?'; Secure':'';}
 const sessionCookie=(req,token)=>`${COOKIE_NAME}=${token}; HttpOnly; Path=/; SameSite=Lax; Max-Age=28800${secureCookie(req)}`;
 function slotList(patient,service,date){
  if(!SERVICES.some(s=>s.id===service))fail(422,'Servicio desconocido.');
  if(!/^\d{4}-\d{2}-\d{2}$/.test(date||''))fail(422,'Fecha incorrecta.');
  const lower=new Date(`${date}T00:00:00`);if(!Number.isFinite(lower.getTime())||localIso(lower).slice(0,10)!==date)fail(422,'Fecha incorrecta.');
  if(lower < new Date(`${today()}T00:00:00`)||lower>new Date(new Date(`${today()}T00:00:00`).getTime()+MAX_DAYS_AHEAD*86400000))fail(422,'La fecha está fuera del plazo de reserva.');
  const rows=all(`SELECT s.id,s.service,s.sector,s.starts_at,s.duration_minutes,s.box,u.display_name AS professional,
    EXISTS(SELECT 1 FROM bookings b WHERE b.slot_id=s.id AND b.status='reservada') AS taken
    FROM slots s JOIN users u ON u.id=s.professional_id
    WHERE s.starts_at>=? AND s.starts_at<? AND s.service=? AND (s.sector IS NULL OR s.sector=?) ORDER BY s.starts_at`,`${date}T00:00:00`,`${date}T23:59:59`,service,patient.sector);
  return rows.map(s=>({...s,available:!s.taken&&starts(s)>Date.now(),taken:Boolean(s.taken)}));
 }
 function getSlot(id,patient){
  const slot=one('SELECT * FROM slots WHERE id=?',id);if(!slot)fail(404,'El bloque no existe.');
  if(slot.sector!==null && slot.sector!==patient.sector)fail(403,'No puedes reservar horas de otro sector.');
  const delta=starts(slot)-Date.now();if(delta<=0 || delta>MAX_DAYS_AHEAD*86400000)fail(422,'El bloque no está dentro de las fechas permitidas.');
  return slot;
 }
 function canCancel(booking){
  if(booking.status!=='reservada')fail(409,'La reserva ya no está activa.');
  if(new Date(booking.starts_at).getTime()-Date.now()<CANCEL_MIN_HOURS*3600000)fail(409,'Las cancelaciones deben realizarse con al menos 2 horas de anticipación.');
 }
 function bookingInfo(booking){return {...booking, clinical_file: booking.clinical_file??null};}
 const bookingSelect=`SELECT b.id,b.slot_id,b.patient_id,b.created_by,b.status,b.created_at,b.cancellation_reason,
  s.service,s.sector,s.starts_at,s.duration_minutes,s.box,doc.display_name AS professional,
  p.display_name AS patient_name,p.rut AS patient_rut,p.clinical_file
  FROM bookings b JOIN slots s ON s.id=b.slot_id JOIN users p ON p.id=b.patient_id
  JOIN users doc ON doc.id=s.professional_id`;
 function guardBooking(actor,id){
  const b=one(bookingSelect+' WHERE b.id=?',id);if(!b)fail(404,'Reserva no encontrada.');
  patientFor(actor,b.patient_id);return b;
 }
 function makeBooking(actor,patient,slot){
  return tx(db,()=>{
    // Revalidate inside the transaction before inserting. The partial unique index is the final safeguard.
    if(one("SELECT id FROM bookings WHERE slot_id=? AND status='reservada'",slot.id))fail(409,'Esta hora acaba de ser reservada por otro paciente.');
    if(one(`SELECT b.id FROM bookings b JOIN slots s ON s.id=b.slot_id WHERE b.patient_id=? AND s.service=? AND b.status='reservada'`,patient.id,slot.service))fail(409,'El paciente ya tiene una reserva activa en este tipo de atención.');
    const id=Number(run("INSERT INTO bookings(slot_id,patient_id,created_by,status,created_at) VALUES (?,?,?,'reservada',?)",slot.id,patient.id,actor.id,stamp()).lastInsertRowid);
    audit(db,actor.id,'RESERVA_CREADA',`booking:${id}`,{slotId:slot.id,patientId:patient.id});
    notify(db,patient.id,id,`Reserva confirmada para el ${slot.starts_at.replace('T',' a las ').slice(0,16)}. Código GAL-${String(id).padStart(5,'0')}.`,`confirmacion-${id}`);
    if(actor.id!==patient.id)notify(db,actor.id,id,`Reservaste una atención para ${patient.display_name}. Código GAL-${String(id).padStart(5,'0')}.`,`confirmacion-tutor-${id}`);
    return id;
  });
 }
 function emitReminders(user){
  const rows=all(`${bookingSelect} WHERE b.patient_id=? AND b.status='reservada' AND b.show_reminder=1`,user.id);
  for(const b of rows){const delta=new Date(b.starts_at).getTime()-Date.now();if(delta>0&&delta<=86400000)notify(db,user.id,b.id,`Recordatorio: tienes una hora médica el ${b.starts_at.slice(0,10)} a las ${b.starts_at.slice(11,16)}.`,`recordatorio-${b.id}`);}
 }
 const server=http.createServer(async(req,res)=>{
  res.setHeader('X-Content-Type-Options','nosniff');res.setHeader('Referrer-Policy','same-origin');res.setHeader('X-Frame-Options','DENY');
  res.setHeader('Content-Security-Policy',"default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data:; connect-src 'self'; object-src 'none'; frame-ancestors 'none'; base-uri 'self'");
  try{
   const url=new URL(req.url,`http://${req.headers.host||'localhost'}`);const path=url.pathname;const method=req.method;
   // Cierre de acceso para demostración académica. La ruta de salud queda disponible para Render.
   if(process.env.NODE_ENV==='production' && path!=='/api/health'){
     const provided=req.headers.authorization||'';
     let valid=false;
     if(provided.startsWith('Basic ')){
       try {
         const raw=Buffer.from(provided.slice(6),'base64').toString('utf8');
         const expected=`${process.env.GALENO_DEMO_USER}:${process.env.GALENO_DEMO_PASSWORD}`;
         const a=Buffer.from(raw),b=Buffer.from(expected);
         valid=a.length===b.length && timingSafeEqual(a,b);
       } catch {valid=false;}
     }
     if(!valid){res.writeHead(401,{'WWW-Authenticate':'Basic realm="Proyecto Galeno - Demo académica"','Cache-Control':'no-store'});res.end('Acceso privado para demostración.');return;}
   }

   if (path.startsWith('/api/')&& !['GET','HEAD','POST'].includes(method))fail(405,'Método no permitido.');
   if (path.startsWith('/api/') && method==='POST' && req.headers.origin){
     const origin=new URL(req.headers.origin);
     if(origin.host!==req.headers.host)fail(403,'Origen no permitido.');
   }
   if(path==='/api/health'&&method==='GET')return send(res,200,{ok:true,name:'Proyecto Galeno',mode:'demo-local',database:'SQLite'});
   if(path==='/api/login'&&method==='POST'){
    const data=await input(req);const rut=normalizeRut(data.rut),password=data.password;
    if(!validRut(rut)||typeof password!=='string'||password.length>200)fail(422,'Revisa el RUT y la contraseña.');
    const ip=req.socket.remoteAddress||'local';const old=attempts.get(ip)||{count:0,until:0};
    const state=Date.now()>old.until?{count:0,until:Date.now()+15*60000}:old;
    if(state.count>=12)fail(429,'Demasiados intentos. Intenta más tarde.');
    const user=one('SELECT * FROM users WHERE rut=? AND registered=1',rut);
    if(!user||!checkPassword(password,user.password_hash)){
      state.count++;attempts.set(ip,state);fail(401,'RUT o contraseña incorrectos.');
    }
    attempts.delete(ip);const sid=randomBytes(24).toString('hex');const exp=Date.now()+8*3600000;
    run('INSERT INTO sessions(id,user_id,expires_at) VALUES (?,?,?)',sid,user.id,localIso(new Date(exp)));
    audit(db,user.id,'INICIO_SESION',`user:${user.id}`);
    const token=signToken({uid:user.id,sid,exp:Math.floor(exp/1000)},secret);
    return send(res,200,{user:serialize(user)},{'Set-Cookie':sessionCookie(req,token)});
   }
   if(path==='/api/demo-accounts'&&method==='GET'){
    return send(res,200,all('SELECT rut,display_name,role,sector FROM users WHERE id <= 7 ORDER BY id').map(u=>({...u,rut:displayRut(u.rut)})));
   }
   if(path==='/api/logout'&&method==='POST'){
    try{const {person,payload}=auth(req);run('UPDATE sessions SET revoked=1 WHERE id=?',payload.sid);audit(db,person.id,'CIERRE_SESION',`user:${person.id}`);}catch{}
    return send(res,200,{ok:true},{'Set-Cookie':`${COOKIE_NAME}=; HttpOnly; Path=/; SameSite=Lax; Max-Age=0${secureCookie(req)}`});
   }
   if(path.startsWith('/api/')){
    const {person:actor}=auth(req);
    if(path==='/api/me'&&method==='GET')return send(res,200,{user:serialize(actor),services:SERVICES});
    if(path==='/api/services'&&method==='GET')return send(res,200,{services:SERVICES});
    if(path==='/api/notifications'&&method==='GET'){
      if(actor.role==='paciente')emitReminders(actor);
      return send(res,200,{notifications:all('SELECT id,message,created_at FROM notifications WHERE recipient_id=? ORDER BY id DESC LIMIT 20',actor.id)});
    }
    if(path==='/api/dashboard'&&method==='GET'){
      if(['paciente','tutor'].includes(actor.role)){
        const patients=actor.role==='paciente'?[actor.id]:all("SELECT patient_id FROM dependent_links WHERE tutor_id=? AND status='aprobado'",actor.id).map(x=>x.patient_id);
        const ids=patients.length?patients:[-1];const appointments=all(bookingSelect+` WHERE b.patient_id IN (${ids.map(()=>'?').join(',')}) AND b.status='reservada' ORDER BY s.starts_at LIMIT 10`,...ids);
        return send(res,200,{upcoming:appointments.filter(b=>new Date(b.starts_at)>new Date()),total:appointments.length,role:actor.role});
      }
      const b=all(bookingSelect+' WHERE s.starts_at>=? AND s.starts_at<? ORDER BY s.starts_at',`${today()}T00:00:00`,`${today()}T23:59:59`);
      const owned=actor.role==='profesional'?b.filter(r=>one('SELECT professional_id FROM slots WHERE id=?',r.slot_id).professional_id===actor.id):b;
      return send(res,200,{today:owned.length,booked:owned.filter(b=>b.status==='reservada').length,noShow:owned.filter(b=>b.status==='no_show').length,pendingLinks:actor.role==='some'?one("SELECT count(*) AS n FROM dependent_links WHERE status='pendiente'").n:0});
    }
    if(path==='/api/slots'&&method==='GET'){
      only(['paciente','tutor'],actor);const patient=patientFor(actor,url.searchParams.get('patientId')||undefined);
      return send(res,200,{slots:slotList(patient,url.searchParams.get('service')||'medicina_general',url.searchParams.get('date')||today()),patient:serialize(patient)});
    }
    if(path==='/api/bookings'&&method==='GET'){
      only(['paciente','tutor'],actor);const patient=patientFor(actor,url.searchParams.get('patientId')||undefined);
      return send(res,200,{bookings:all(bookingSelect+' WHERE b.patient_id=? ORDER BY s.starts_at DESC LIMIT 50',patient.id).map(bookingInfo)});
    }
    if(path==='/api/bookings'&&method==='POST'){
      only(['paciente','tutor'],actor);const body=await input(req);const patient=patientFor(actor,body.patientId);
      const slotId=Number(body.slotId);if(!isInt(slotId))fail(422,'El bloque es inválido.');const slot=getSlot(slotId,patient);
      const id=makeBooking(actor,patient,slot);
      return send(res,201,{booking:one(bookingSelect+' WHERE b.id=?',id),code:`GAL-${String(id).padStart(5,'0')}`});
    }
    const cancel=path.match(/^\/api\/bookings\/(\d+)\/cancel$/);
    if(cancel&&method==='POST'){
      only(['paciente','tutor'],actor);const body=await input(req);const b=guardBooking(actor,Number(cancel[1]));canCancel(b);
      const reason=cleanText(body.reason,200);if(reason.length<3)fail(422,'Indica un motivo de cancelación.');
      tx(db,()=>{
       run("UPDATE bookings SET status='cancelada',cancelled_at=?,cancellation_reason=?,status_updated_by=? WHERE id=? AND status='reservada'",stamp(),reason,actor.id,b.id);
       audit(db,actor.id,'RESERVA_CANCELADA',`booking:${b.id}`,{reason});
       notify(db,b.patient_id,b.id,`La reserva GAL-${String(b.id).padStart(5,'0')} fue cancelada.`,`cancelacion-${b.id}`);
      });
      return send(res,200,{ok:true});
    }
    const reschedule=path.match(/^\/api\/bookings\/(\d+)\/reschedule$/);
    if(reschedule&&method==='POST'){
      only(['paciente','tutor'],actor);const body=await input(req);const b=guardBooking(actor,Number(reschedule[1]));canCancel(b);
      const newSlotId=Number(body.slotId);if(!isInt(newSlotId))fail(422,'El nuevo bloque es inválido.');
      const patient=patientFor(actor,b.patient_id),slot=getSlot(newSlotId,patient);
      if(slot.service!==b.service)fail(422,'El servicio de la nueva hora debe ser el mismo.');
      const booking=tx(db,()=>{
       if(one("SELECT id FROM bookings WHERE slot_id=? AND status='reservada'",slot.id))fail(409,'La nueva hora ya está ocupada.');
       run("UPDATE bookings SET status='cancelada',cancelled_at=?,cancellation_reason=?,status_updated_by=? WHERE id=?",stamp(),'Reprogramación',actor.id,b.id);
       const id=Number(run("INSERT INTO bookings(slot_id,patient_id,created_by,status,created_at) VALUES (?,?,?,'reservada',?)",slot.id,patient.id,actor.id,stamp()).lastInsertRowid);
       audit(db,actor.id,'RESERVA_REPROGRAMADA',`booking:${id}`,{previousBooking:b.id,newSlot:slot.id});
       notify(db,patient.id,id,`Hora reprogramada al ${slot.starts_at.replace('T',' a las ').slice(0,16)}.`,`reprogramacion-${id}`);
       return one(bookingSelect+' WHERE b.id=?',id);
      });return send(res,201,{booking});
    }
    if(path==='/api/dependents'&&method==='GET'){
      only('tutor',actor);
      return send(res,200,{dependents:all(`SELECT l.id,l.patient_id,l.status,l.consent_at,p.display_name AS name,p.rut,p.sector
      FROM dependent_links l JOIN users p ON p.id=l.patient_id WHERE l.tutor_id=? ORDER BY l.id DESC`,actor.id).map(d=>({...d,rut:displayRut(d.rut)}))});
    }
    if(path==='/api/dependents'&&method==='POST'){
      only('tutor',actor);const body=await input(req);const rut=normalizeRut(body.rut);
      if(!validRut(rut))fail(422,'RUT inválido.');if(body.consent!==true)fail(422,'Debes aceptar la declaración de privacidad y autorización.');
      const patient=one("SELECT id,display_name FROM users WHERE rut=? AND role='paciente' AND registered=1",rut);
      if(!patient)fail(404,'No existe un paciente inscrito en los datos de esta demostración.');
      const existing=one('SELECT status FROM dependent_links WHERE tutor_id=? AND patient_id=?',actor.id,patient.id);
      if(existing)fail(409,'El vínculo ya existe y está '+existing.status+'.');
      const id=Number(run("INSERT INTO dependent_links(tutor_id,patient_id,consent_at,status) VALUES (?,?,?,'pendiente')",actor.id,patient.id,stamp()).lastInsertRowid);
      audit(db,actor.id,'VINCULO_SOLICITADO',`link:${id}`,{patientId:patient.id});
      return send(res,201,{id,status:'pendiente',message:'Solicitud enviada. Debe ser validada por personal SOME.'});
    }
    if(path==='/api/dependent-requests'&&method==='GET'){
      only('some',actor);
      return send(res,200,{requests:all(`SELECT l.id,l.status,l.consent_at,t.display_name AS tutor_name,t.rut AS tutor_rut,
         p.display_name AS patient_name,p.rut AS patient_rut,p.sector FROM dependent_links l
         JOIN users t ON t.id=l.tutor_id JOIN users p ON p.id=l.patient_id ORDER BY l.id DESC`).map(r=>({...r,tutor_rut:displayRut(r.tutor_rut),patient_rut:displayRut(r.patient_rut)}))});
    }
    const approval=path.match(/^\/api\/dependent-requests\/(\d+)\/review$/);
    if(approval&&method==='POST'){
      only('some',actor);const body=await input(req);if(!['aprobado','rechazado'].includes(body.status))fail(422,'Estado inválido.');
      const link=one('SELECT * FROM dependent_links WHERE id=?',Number(approval[1]));if(!link)fail(404);
      if(link.status!=='pendiente')fail(409,'La solicitud ya fue revisada.');
      run('UPDATE dependent_links SET status=?,reviewed_by=?,reviewed_at=? WHERE id=?',body.status,actor.id,stamp(),link.id);
      audit(db,actor.id,'VINCULO_REVISADO',`link:${link.id}`,{status:body.status});
      notify(db,link.tutor_id,null,`Tu solicitud de vínculo fue ${body.status}.`,`vinculo-${link.id}`);
      return send(res,200,{ok:true,status:body.status});
    }
    if(path==='/api/professionals'&&method==='GET'){
      only('some',actor);return send(res,200,{professionals:all("SELECT id,display_name AS name FROM users WHERE role='profesional'")});
    }
    if(path==='/api/slots'&&method==='POST'){
      only('some',actor);const body=await input(req);const {service,sector,professionalId,startsAt}=body;
      if(!SERVICES.some(s=>s.id===service))fail(422,'Servicio inválido.');
      const dt=parseDateTime(startsAt);if(!dt||dt.getTime()<=Date.now()||dt.getTime()>Date.now()+MAX_DAYS_AHEAD*86400000)fail(422,'Selecciona una fecha futura dentro de 30 días.');
      const prof=userById(Number(professionalId));if(!prof||prof.role!=='profesional')fail(422,'Profesional inválido.');
      const sect=service==='programas'?Number(sector):null;
      if(service==='programas' && ![1,2,3].includes(sect))fail(422,'Sector inválido.');
      const box=cleanText(body.box,40);if(!box)fail(422,'Ingresa el box.');
      const length=Number(body.durationMinutes)||15;if(![15,20,30].includes(length))fail(422,'Duración inválida.');
      try {const result=run('INSERT INTO slots(service,sector,professional_id,starts_at,duration_minutes,box) VALUES (?,?,?,?,?,?)',service,sect,prof.id,startsAt,length,box);
      audit(db,actor.id,'BLOQUE_CREADO',`slot:${result.lastInsertRowid}`);return send(res,201,{id:Number(result.lastInsertRowid)});
      } catch(e){if(e.message?.includes('UNIQUE'))fail(409,'El profesional ya tiene un bloque en ese horario.');throw e;}
    }
    if(path==='/api/roster'&&method==='GET'){
      only('some',actor);const date=url.searchParams.get('date')||today();if(!/^\d{4}-\d{2}-\d{2}$/.test(date))fail(422,'Fecha inválida.');
      return send(res,200,{bookings:all(bookingSelect+' WHERE s.starts_at>=? AND s.starts_at<? ORDER BY s.starts_at',`${date}T00:00:00`,`${date}T23:59:59`).map(b=>({...b,patient_rut:displayRut(b.patient_rut)}))});
    }
    if(path==='/api/professional/appointments'&&method==='GET'){
      only('profesional',actor);const date=url.searchParams.get('date')||today();if(!/^\d{4}-\d{2}-\d{2}$/.test(date))fail(422,'Fecha inválida.');
      return send(res,200,{bookings:all(bookingSelect+' JOIN slots owned ON owned.id=b.slot_id WHERE owned.professional_id=? AND s.starts_at>=? AND s.starts_at<? ORDER BY s.starts_at',actor.id,`${date}T00:00:00`,`${date}T23:59:59`).map(b=>({...b,patient_rut:displayRut(b.patient_rut)}))});
    }
    const noshow=path.match(/^\/api\/bookings\/(\d+)\/no-show$/);
    if(noshow&&method==='POST'){
      only('profesional',actor);const b=one(bookingSelect+' WHERE b.id=?',Number(noshow[1]));if(!b)fail(404);
      const slot=one('SELECT * FROM slots WHERE id=?',b.slot_id);if(slot.professional_id!==actor.id)fail(403,'Solo el profesional asignado puede registrar la inasistencia.');
      if(b.status!=='reservada')fail(409,'La reserva ya no está activa.');
      if(Date.now()<new Date(slot.starts_at).getTime()+NO_SHOW_GRACE_MINUTES*60000)fail(409,'Deben transcurrir al menos 20 minutos desde el inicio de la cita.');
      tx(db,()=>{run("UPDATE bookings SET status='no_show',status_updated_by=? WHERE id=?",actor.id,b.id);audit(db,actor.id,'NO_SHOW',`booking:${b.id}`);});
      return send(res,200,{ok:true});
    }
    if(path==='/api/audit'&&method==='GET'){
      only('some',actor);return send(res,200,{events:all('SELECT a.id,a.action,a.target,a.created_at,u.display_name AS actor FROM audits a LEFT JOIN users u ON u.id=a.actor_id ORDER BY a.id DESC LIMIT 40')});
    }
    fail(404,'Ruta desconocida.');
   }
   if(method!=='GET' && method!=='HEAD')fail(405,'Método no permitido.');
   const file=path==='/'?'index.html':decodeURIComponent(path).replace(/^\/+/, '');
   const filePath=resolve(PUBLIC,file);
   if(!filePath.startsWith(PUBLIC+'/')&&filePath!==join(PUBLIC,'index.html'))fail(404);
   let bytes;try{bytes=readFileSync(filePath);}catch{fail(404);}
   res.writeHead(200,{'Content-Type':TYPES[extname(filePath)]||'application/octet-stream','Cache-Control':'no-cache'});
   if(method==='HEAD')res.end();else res.end(bytes);
  } catch(e){
   const status=e instanceof ApiError?e.code:e.message?.includes('UNIQUE constraint')?409:500;
   if(status===500)console.error('[Galeno API]',e.stack||e);
   if(!res.headersSent)send(res,status,{error:status===500?'Ocurrió un error interno. Inténtalo nuevamente.':e.message});
   else res.end();
  }
 });
 server.on('close',()=>db.close());
 return {server,db};
}
if(process.argv[1] && resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 const {server}=createGalenoServer();const port=Number(process.env.PORT)||3000;
 server.listen(port,'0.0.0.0',()=>console.log(`Proyecto Galeno disponible en http://localhost:${port}`));
}
