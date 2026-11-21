import test,{after} from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createGalenoServer } from '../server.mjs';
import { futureDay } from '../src/domain.mjs';

const dir=mkdtempSync(join(tmpdir(),'galeno-tests-'));
const {server,db}=createGalenoServer({databasePath:join(dir,'case.sqlite'),secret:'secreto-de-prueba-123'});
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
const base=`http://127.0.0.1:${server.address().port}`;
const sessions={};
after(async()=>{await new Promise(resolve=>server.close(resolve));rmSync(dir,{recursive:true,force:true});});
async function call(path, {method='GET',data,as}={}) {
 const response=await fetch(base+'/api'+path,{method,headers:{...(data?{'Content-Type':'application/json'}:{}),...(as?{Cookie:sessions[as]}:{})},body:data?JSON.stringify(data):undefined});
 const cookie=response.headers.get('set-cookie');if(as&&cookie)sessions[as]=cookie.split(';')[0];
 let body;try{body=await response.json();}catch{body={}};
 return {status:response.status,body,headers:response.headers};
}
async function login(as,rut){const res=await call('/login',{method:'POST',data:{rut,password:'Galeno2026!'},as});assert.equal(res.status,200,`Login de ${as}: ${JSON.stringify(res.body)}`);return res.body.user;}
let futureDate=futureDay(3).slice(0,10); // puede ser fin de semana; tomar fecha real de un bloque publicado
futureDate='';

test('API pública y rutas protegidas',async()=>{
 assert.equal((await call('/health')).status,200);
 assert.equal((await call('/roster')).status,401);
 assert.equal((await call('/bookings',{method:'POST',data:{slotId:1}})).status,401);
 assert.equal((await call('/login',{method:'POST',data:{rut:'123',password:'x'}})).status,422);
 assert.equal((await call('/login',{method:'POST',data:{rut:'12.345.678-5',password:'equivocada'}})).status,401);
});

test('Ingreso con RUT, contraseña y rol',async()=>{
 const p=await login('paciente','12.345.678-5');assert.equal(p.sector,2);assert.equal(p.role,'paciente');
 assert.equal((await call('/roster',{as:'paciente'})).status,403);
 await login('paciente2','87.654.321-4');
 await login('tutor','22.222.222-2');
 await login('some','33.333.333-3');
 await login('doctor','44.444.444-4');
 await login('doctor2','55.555.555-5');
});

test('RF-01 y RF-02: catálogo por sector, RUT y fechas',async()=>{
 const r=await call('/slots?service=programas&date='+encodeURIComponent(futureDay(4).slice(0,10)),{as:'paciente'});
 // tomar fecha de un bloque programado en la base para evitar fines de semana
 futureDate=db.prepare("SELECT substr(starts_at,1,10) AS date FROM slots WHERE service='programas' AND sector=2 ORDER BY starts_at LIMIT 1").get().date;
 const agenda=await call('/slots?service=programas&date='+futureDate,{as:'paciente'});
 assert.equal(agenda.status,200);assert.ok(agenda.body.slots.length>0);
 assert.ok(agenda.body.slots.every(x=>x.sector===2));
 const another= db.prepare("SELECT id FROM slots WHERE service='programas' AND sector=1 AND starts_at > ? LIMIT 1").get(futureDay(0));
 assert.equal((await call('/bookings',{method:'POST',data:{slotId:another.id},as:'paciente'})).status,403);
 assert.equal((await call('/slots?service=programas&date=2020-01-01',{as:'paciente'})).status,422);
});

test('RF-02: reserva, doble reserva, cupo liberado y reprogramación',async()=>{
 const slots=await call('/slots?service=medicina_general&date='+futureDate,{as:'paciente2'});
 const usable=slots.body.slots.filter(x=>x.available);assert.ok(usable.length>2);
 const first=await call('/bookings',{method:'POST',data:{slotId:usable[0].id},as:'paciente2'});
 assert.equal(first.status,201); assert.equal(first.body.booking.starts_at,usable[0].starts_at);
 assert.ok(first.body.code.startsWith('GAL-'));
 assert.equal((await call('/bookings',{method:'POST',data:{slotId:usable[0].id},as:'paciente2'})).status,409);
 assert.equal((await call('/bookings',{method:'POST',data:{slotId:usable[1].id},as:'paciente2'})).status,409);
 const changed=await call(`/bookings/${first.body.booking.id}/reschedule`,{method:'POST',data:{slotId:usable[1].id},as:'paciente2'});
 assert.equal(changed.status,201); assert.equal(changed.body.booking.starts_at,usable[1].starts_at);
 assert.equal((await call(`/bookings/${changed.body.booking.id}/cancel`,{method:'POST',data:{reason:'No puedo asistir'},as:'paciente2'})).status,200);
 const reuse=await call('/bookings',{method:'POST',data:{slotId:usable[0].id},as:'paciente2'});
 assert.equal(reuse.status,201);
 assert.equal((await call(`/bookings/${reuse.body.booking.id}/cancel`,{method:'POST',data:{reason:'Cambio de turno'},as:'paciente2'})).status,200);
});

test('RF-03: vínculo pendiente, revisión SOME y reserva por tutor',async()=>{
 const first=(await call('/dependents',{as:'tutor'})).body.dependents;
 assert.ok(first.some(x=>x.status==='aprobado'));
 const requested=await call('/dependents',{method:'POST',data:{rut:'87.654.321-4',consent:true},as:'tutor'});
 assert.equal(requested.status,201);assert.equal(requested.body.status,'pendiente');
 const patient2=db.prepare("SELECT id FROM users WHERE display_name='Tomás Muñoz'").get();
 const s=db.prepare("SELECT id FROM slots WHERE service='programas' AND sector=1 AND starts_at > ? ORDER BY starts_at LIMIT 1").get(futureDay(0));
 assert.equal((await call('/bookings',{method:'POST',data:{patientId:patient2.id,slotId:s.id},as:'tutor'})).status,403);
 assert.equal((await call('/dependent-requests',{as:'paciente'})).status,403);
 assert.equal((await call(`/dependent-requests/${requested.body.id}/review`,{method:'POST',data:{status:'aprobado'},as:'some'})).status,200);
 const yes=await call('/bookings',{method:'POST',data:{patientId:patient2.id,slotId:s.id},as:'tutor'});
 assert.equal(yes.status,201);
 assert.equal(yes.body.booking.patient_id,patient2.id);
 assert.equal((await call('/bookings',{method:'POST',data:{patientId:patient2.id,slotId:s.id},as:'paciente'})).status,403);
});

test('RF-04: nómina SOME con fichas y filtros',async()=>{
 const roster=await call('/roster?date='+futureDate,{as:'some'});
 assert.equal(roster.status,200);
 assert.ok(roster.body.bookings.every(x=>x.clinical_file));
 assert.equal((await call('/roster?date='+futureDate,{as:'tutor'})).status,403);
});

test('RF-05: solo profesional asignado y control de 20 minutos',async()=>{
 const existing=db.prepare("SELECT b.id,s.professional_id FROM bookings b JOIN slots s ON s.id=b.slot_id WHERE s.starts_at < ? AND b.status='reservada' ORDER BY b.id LIMIT 1").get(futureDay(0));
 assert.ok(existing);
 assert.equal((await call(`/bookings/${existing.id}/no-show`,{method:'POST',as:'paciente'})).status,403);
 assert.equal((await call(`/bookings/${existing.id}/no-show`,{method:'POST',as:'doctor2'})).status,403);
 assert.equal((await call(`/bookings/${existing.id}/no-show`,{method:'POST',as:'doctor'})).status,200);
 assert.equal((await call(`/bookings/${existing.id}/no-show`,{method:'POST',as:'doctor'})).status,409);
 // agenda futura nunca puede marcarse no-show de inmediato
 const future=db.prepare("SELECT b.id FROM bookings b JOIN slots s ON s.id=b.slot_id WHERE b.status='reservada' AND s.starts_at > ? AND s.professional_id=6 LIMIT 1").get(futureDay(0));
 assert.ok(future);
 assert.equal((await call(`/bookings/${future.id}/no-show`,{method:'POST',as:'doctor'})).status,409);
});

test('RNF seguridad: auditoría, cookies y cierre de sesión',async()=>{
 const r=await call('/audit',{as:'some'});assert.equal(r.status,200);
 assert.ok(r.body.events.some(x=>x.action==='RESERVA_CREADA'));
 assert.ok(r.body.events.some(x=>x.action==='NO_SHOW'));
 assert.equal((await call('/audit',{as:'paciente'})).status,403);
 const out=await call('/logout',{method:'POST',as:'paciente'});assert.equal(out.status,200);
 assert.equal((await call('/me',{as:'paciente'})).status,401);
});
