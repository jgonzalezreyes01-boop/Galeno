import { DatabaseSync } from 'node:sqlite';
import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { hashPassword, makeRut, futureDay, localIso } from './domain.mjs';

export function createStore(path=':memory:') {
 if (path!==':memory:') mkdirSync(dirname(path),{recursive:true});
 const db = new DatabaseSync(path);
 db.exec('PRAGMA foreign_keys=ON; PRAGMA journal_mode=WAL; PRAGMA busy_timeout=4000;');
 db.exec(`
 CREATE TABLE IF NOT EXISTS users (
 id INTEGER PRIMARY KEY AUTOINCREMENT, rut TEXT NOT NULL UNIQUE, display_name TEXT NOT NULL,
 role TEXT NOT NULL CHECK(role IN ('paciente','tutor','some','profesional')),
 password_hash TEXT NOT NULL, sector INTEGER CHECK(sector IN (1,2,3)),
 clinical_file TEXT, registered INTEGER NOT NULL DEFAULT 1, created_at TEXT NOT NULL);
 CREATE TABLE IF NOT EXISTS sessions (
 id TEXT PRIMARY KEY, user_id INTEGER NOT NULL REFERENCES users(id), expires_at TEXT NOT NULL,
 revoked INTEGER NOT NULL DEFAULT 0);
 CREATE TABLE IF NOT EXISTS dependent_links (
 id INTEGER PRIMARY KEY AUTOINCREMENT, tutor_id INTEGER NOT NULL REFERENCES users(id),
 patient_id INTEGER NOT NULL REFERENCES users(id), consent_at TEXT NOT NULL,
 status TEXT NOT NULL CHECK(status IN ('pendiente','aprobado','rechazado')) DEFAULT 'pendiente',
 reviewed_by INTEGER REFERENCES users(id), reviewed_at TEXT,
 UNIQUE (tutor_id, patient_id));
 CREATE TABLE IF NOT EXISTS slots (
 id INTEGER PRIMARY KEY AUTOINCREMENT,
 service TEXT NOT NULL CHECK(service IN ('medicina_general','programas')),
 sector INTEGER CHECK(sector IN (1,2,3)), professional_id INTEGER NOT NULL REFERENCES users(id),
 starts_at TEXT NOT NULL, duration_minutes INTEGER NOT NULL DEFAULT 15,
 box TEXT NOT NULL, UNIQUE(professional_id,starts_at),
 CHECK ((service='medicina_general' AND sector IS NULL) OR (service='programas' AND sector IS NOT NULL)));
 CREATE TABLE IF NOT EXISTS bookings (
 id INTEGER PRIMARY KEY AUTOINCREMENT, slot_id INTEGER NOT NULL REFERENCES slots(id),
 patient_id INTEGER NOT NULL REFERENCES users(id), created_by INTEGER NOT NULL REFERENCES users(id),
 status TEXT NOT NULL CHECK(status IN ('reservada','cancelada','no_show','atendida')) DEFAULT 'reservada',
 created_at TEXT NOT NULL, cancelled_at TEXT, cancellation_reason TEXT, status_updated_by INTEGER REFERENCES users(id),
 show_reminder INTEGER NOT NULL DEFAULT 1);
 CREATE UNIQUE INDEX IF NOT EXISTS one_active_per_slot ON bookings(slot_id) WHERE status='reservada';
 CREATE TABLE IF NOT EXISTS audits (
 id INTEGER PRIMARY KEY AUTOINCREMENT, actor_id INTEGER REFERENCES users(id),
 action TEXT NOT NULL, target TEXT NOT NULL, details TEXT, created_at TEXT NOT NULL);
 CREATE TABLE IF NOT EXISTS notifications (
 id INTEGER PRIMARY KEY AUTOINCREMENT, recipient_id INTEGER NOT NULL REFERENCES users(id),
 booking_id INTEGER REFERENCES bookings(id), message TEXT NOT NULL,
 event_key TEXT NOT NULL UNIQUE, created_at TEXT NOT NULL);
 `);
 const count=db.prepare('SELECT COUNT(*) AS n FROM users').get().n;
 if(!count) seed(db);
 return db;
}
function seed(db){
 const pass=hashPassword('Galeno2026!');const now=localIso();
 const ins=db.prepare('INSERT INTO users(rut,display_name,role,password_hash,sector,clinical_file,created_at) VALUES (?,?,?,?,?,?,?)');
 const users=[
  [makeRut('12345678'),'Camila Rojas','paciente',2,'F-1032'],
  [makeRut('87654321'),'Tomás Muñoz','paciente',1,'F-2071'],
  [makeRut('11111111'),'Elena Vega','paciente',2,'F-1384'],
  [makeRut('22222222'),'Patricia Fuentes','tutor',2,null],
  [makeRut('33333333'),'Daniela Herrera','some',null,null],
  [makeRut('44444444'),'Dr. Nicolás Araya','profesional',null,null],
  [makeRut('55555555'),'Dra. Paula Rivera','profesional',null,null],
  [makeRut('66666666'),'Rosa Zamora','paciente',2,'F-1500'],
 ];
 for(const [rut,name,role,sector,file] of users) ins.run(rut,name,role,pass,sector,file,now);
 const slot=db.prepare('INSERT INTO slots(service,sector,professional_id,starts_at,duration_minutes,box) VALUES (?,?,?,?,?,?)');
 for(let day=1;day<=12;day++){
  const weekday=new Date(futureDay(day)).getDay();if(weekday===0||weekday===6)continue;
  for (const h of [9,10,11,15]) for(const m of [0,15,30,45]) {
   slot.run('medicina_general',null,6,futureDay(day,h,m),15,'Box 04');
   slot.run('programas',2,7,futureDay(day,h,m),15,'Box 07');
  }
  for(const h of [8,12,13]) for(const m of [0,30]) slot.run('programas',1,6,futureDay(day,h,m),30,'Box 02');
 }
 const past=slot.run('medicina_general',null,6,futureDay(-2,8,0),15,'Box 04').lastInsertRowid;
 db.prepare('INSERT INTO bookings(slot_id,patient_id,created_by,status,created_at) VALUES (?,?,?,?,?)').run(past,8,8,'reservada',now);
 const next=db.prepare("SELECT id FROM slots WHERE service='medicina_general' AND starts_at > ? ORDER BY starts_at LIMIT 1").get(now);
 if(next) db.prepare('INSERT INTO bookings(slot_id,patient_id,created_by,status,created_at) VALUES (?,?,?,?,?)').run(next.id,3,3,'reservada',now);
 db.prepare("INSERT INTO dependent_links(tutor_id,patient_id,consent_at,status,reviewed_by,reviewed_at) VALUES (?,?,?,?,?,?)").run(4,3,now,'aprobado',5,now);
}
export function audit(db,actor,action,target,details={}){
 db.prepare('INSERT INTO audits(actor_id,action,target,details,created_at) VALUES (?,?,?,?,?)')
 .run(actor??null,action,String(target),JSON.stringify(details),localIso());
}
export function notify(db,recipient,bookingId,message,eventKey){
 db.prepare('INSERT OR IGNORE INTO notifications(recipient_id,booking_id,message,event_key,created_at) VALUES (?,?,?,?,?)')
 .run(recipient,bookingId,message,eventKey,localIso());
}
export function tx(db,fn){db.exec('BEGIN IMMEDIATE');try{const result=fn();db.exec('COMMIT');return result;}catch(err){db.exec('ROLLBACK');throw err;}}
