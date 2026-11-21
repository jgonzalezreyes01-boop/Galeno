const app = document.querySelector('#app');
const state = {
 user:null, demo:[], view:'inicio', service:'medicina_general', date:'', patientId:null,
 slots:[], bookings:[], links:[], linkRequests:[], roster:[], professionals:[], audits:[], notifications:[], dashboard:{},
 rosterDate:'', loading:false
};
const iconPaths={
 home:'<path d="m3 10 9-7 9 7v10a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1z"/><path d="M9 21v-7h6v7"/>',
 calendar:'<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M7 3v4M17 3v4M3 10h18"/>',
 clock:'<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
 users:'<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"/>',
 file:'<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6M8 13h8M8 17h7"/>',
 shield:'<path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/><path d="m9 12 2 2 4-4"/>',
 bell:'<path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9M10 21h4"/>',
 logout:'<path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9"/>',
 arrow:'<path d="M5 12h14M13 6l6 6-6 6"/>',
 check:'<path d="m5 12 4 4L19 6"/>',
 heart:'<path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.5l-.9-.9a5.5 5.5 0 0 0-7.8 7.8L12 21l8.8-8.6a5.5 5.5 0 0 0 0-7.8z"/>',
 plus:'<path d="M12 5v14M5 12h14"/>',
 activity:'<path d="M22 12h-4l-3 9-6-18-3 9H2"/>',
 list:'<path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01"/>',
 lock:'<rect x="4" y="10" width="16" height="11" rx="2"/><path d="M8 10V7a4 4 0 0 1 8 0v3"/>',
 info:'<circle cx="12" cy="12" r="10"/><path d="M12 16v-4M12 8h.01"/>',
 chart:'<path d="M3 3v18h18M7 17v-4M12 17V8M17 17v-7"/>',
 x:'<path d="M18 6 6 18M6 6l12 12"/>',
 settings:'<path d="M4 6h16M4 12h16M4 18h16"/>'
};
const I=(name,size=18)=>`<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${iconPaths[name]||iconPaths.info}</svg>`;
const esc=x=>String(x??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const serviceName=k=>k==='programas'?'Programas de salud':'Medicina general';
const roleName=k=>({paciente:'Paciente',tutor:'Tutor o cuidador',some:'Administrativo SOME',profesional:'Profesional de salud'})[k]||k;
const abbrev=name=>name.split(/\s+/).slice(0,2).map(x=>x[0]).join('').toUpperCase();
const dateParts=iso=>({day:iso?.slice(8,10)||'',month:new Date(`${iso?.slice(0,10)}T12:00:00`).toLocaleDateString('es-CL',{month:'short'})||''});
const longDate=d=>new Date(`${d?.slice(0,10)}T12:00:00`).toLocaleDateString('es-CL',{day:'numeric',month:'long',year:'numeric'});
const showDate=iso=>`${longDate(iso)} · ${iso.slice(11,16)} hrs`;
const upcomingDays=()=>{let days=[];for(let d=0;d<=15;d++){let x=new Date();x.setDate(x.getDate()+d);if(x.getDay()===0||x.getDay()===6)continue;days.push(x.toLocaleDateString('sv-SE'));}return days;};
const $=s=>document.querySelector(s);
function toast(text,error=false){const root=$('#toasts');let div=document.createElement('div');div.className='toast'+(error?' error':'');div.textContent=text;root.append(div);setTimeout(()=>div.remove(),4300);}
async function api(path,{method='GET',body}={}){
 const resp=await fetch('/api'+path,{method,headers:body?{'Content-Type':'application/json'}:{},body:body?JSON.stringify(body):undefined,credentials:'same-origin'});
 let json={};try{json=await resp.json();}catch{}
 if(!resp.ok){if(resp.status===401&&path!=='/login'){state.user=null;renderLogin();}throw Error(json.error||'No fue posible completar la operación.');}
 return json;
}
const post=(path,body={})=>api(path,{method:'POST',body});
async function load(){
 try{let r=await api('/me');state.user=r.user;await open('inicio');}
 catch(e){state.user=null;try{const a=await api('/demo-accounts');state.demo=a.map(x=>({...x,sector:x.sector}));}catch{}renderLogin();}
}
function renderLogin(){
 app.innerHTML=`<section class="login-view">
 <aside class="login-info"><div class="brand"><span class="brand-mark">+</span> Proyecto Galeno</div>
 <div class="login-lede"><div class="eyebrow">Atención primaria · Prototipo de estudio</div>
 <h1>Tu salud, una hora más cerca.</h1><p>Consulta la agenda disponible, reserva una atención y revisa tus próximas citas sin hacer filas.</p>
 <div class="tag-row"><span class="light-tag">Reserva por sector</span><span class="light-tag">Gestión de cuidadores</span><span class="light-tag">Agenda protegida</span></div></div>
 <footer>Proyecto Galeno · Continuación de HoraSalud · Equipo Jorge González y Oscar Pacheco</footer></aside>
 <main class="login-content"><div class="login-box"><div class="mini-label">Bienvenido</div><h2>Ingresa a tu cuenta</h2>
 <p class="subline">Usa tu RUT y contraseña. Esta versión funciona con pacientes y profesionales ficticios.</p>
 <form id="login-form"><div class="field"><label for="rut">RUT</label><input required id="rut" name="rut" autocomplete="username" placeholder="12.345.678-5" /></div>
 <div class="field"><label for="password">Contraseña</label><input required id="password" name="password" type="password" autocomplete="current-password" placeholder="Ingresa tu contraseña" /></div>
 <button type="submit" class="primary wide">Ingresar ${I('arrow',17)}</button></form>
 <div class="demo-box"><p class="label">Acceso rápido para probar la plataforma</p><div class="demo-grid">${state.demo.map(d=>`<button type="button" class="demo-pick" data-demo-rut="${esc(d.rut)}"><b>${esc(roleName(d.role))}</b><span>${esc(d.display_name)} · ${esc(d.rut)}</span></button>`).join('')}</div>
 <div class="hint">Contraseña de demostración: <b>Galeno2026!</b></div><div style="margin-top:12px"><span class="demo-flag">Datos ficticios · No utilizar información clínica real</span></div></div></div></main></section>`;
}
function menu(){let v=state.user.role;
 const nav=[['inicio','Inicio','home']];
 if(v==='paciente'||v==='tutor')nav.push(['reservar','Reservar hora','calendar'],['mis-horas','Mis reservas','clock']);
 if(v==='tutor')nav.push(['dependientes','Mis dependientes','users']);
 if(v==='some')nav.push(['nomina','Nómina de pacientes','list'],['solicitudes','Validar tutorías','users'],['horarios','Gestionar bloques','calendar'],['auditoria','Registro de acciones','shield']);
 if(v==='profesional')nav.push(['agenda','Mi agenda','calendar']);
 nav.push(['avisos','Avisos','bell'],['perfil','Mi perfil','file']);return nav;
}
const titles={inicio:'Inicio',reservar:'Reservar hora','mis-horas':'Mis reservas',dependientes:'Mis dependientes',nomina:'Nómina del día',solicitudes:'Validación de tutorías',horarios:'Gestión de bloques',auditoria:'Registro de acciones',agenda:'Mi agenda',avisos:'Avisos',perfil:'Mi perfil'};
function layout(body){const u=state.user, m=menu();
 app.innerHTML=`<div class="layout"><aside class="sidebar">
 <div class="brand"><span class="brand-mark">+</span> Galeno<span style="color:#8fcbfa">.</span></div>
 <div class="nav-label">MENÚ PRINCIPAL</div><nav class="nav" aria-label="Menú principal">${m.map(([k,l,i])=>`<button class="nav-item ${k===state.view?'selected':''}" data-view="${k}" type="button">${I(i)} ${esc(l)}</button>`).join('')}</nav>
 <div class="sidebar-bottom"><div class="demo-sidebar">Entorno académico con datos simulados. Las reservas y cambios se guardan en la base local.</div>
 <div class="profile-mini"><div class="avatar">${esc(abbrev(u.name))}</div><div><b>${esc(u.name)}</b><span>${esc(roleName(u.role))}</span></div></div><button class="logout" data-action="logout">${I('logout')} Cerrar sesión</button></div></aside>
 <main class="main"><header class="topline"><div class="crumb">Proyecto Galeno &nbsp;/&nbsp; <strong>${esc(titles[state.view])}</strong></div><div class="topright"><span class="today-chip">${new Date().toLocaleDateString('es-CL',{day:'numeric',month:'long',year:'numeric'})}</span><button title="Ver avisos" aria-label="Ver avisos" class="bell" data-view="avisos">${I('bell',18)}</button></div></header>${body}</main></div>`;
}
const heading=(h,p)=>`<section class="page-heading"><h1>${h}</h1><p>${p}</p></section>`;
const panel=(title,desc,content,right='')=>`<section class="panel"><div class="panel-heading"><div><h2>${title}</h2>${desc?`<p>${desc}</p>`:''}</div>${right}</div>${content}</section>`;
const pill=(status)=>{let [text,kind]={reservada:['Confirmada','good'],cancelada:['Cancelada','neutral'],no_show:['Inasistencia','bad'],atendida:['Atendida','good'],pendiente:['Pendiente','wait'],aprobado:['Aprobado','good'],rechazado:['Rechazado','bad']}[status]||[status,'neutral'];return `<span class="pill ${kind}">${esc(text)}</span>`;};
const metrics=(a)=>`<div class="cols-3">${a.map(([label,value,note,i])=>`<div class="metric"><div class="meta"><span>${esc(label)}</span>${I(i||'chart')}</div><strong>${esc(value)}</strong><div class="under">${esc(note||'')}</div></div>`).join('')}</div>`;
function apptCard(b,withActions=true){let {day,month}=dateParts(b.starts_at),cancel=b.status==='reservada'&&new Date(b.starts_at).getTime()-Date.now()>=7200000;
 return `<article class="appt"><div class="appt-left"><div class="date-tile"><b>${esc(day)}</b><span>${esc(month)}</span></div><div><h3>${esc(serviceName(b.service))}</h3>
 <p>${esc(b.starts_at.slice(11,16))} hrs · ${esc(b.professional)} · ${esc(b.box)}${state.user.role==='tutor'?`<br/>Paciente: ${esc(b.patient_name)}`:''}</p></div></div>
 <div class="actions">${pill(b.status)}${withActions&&cancel?`<button class="danger tiny" data-cancel="${b.id}">Cancelar</button>`:''}</div></article>`;
}
const empty=(msg)=>`<div class="empty">${esc(msg)}</div>`;
function renderHome(){const u=state.user,d=state.dashboard;
 if(u.role==='paciente'||u.role==='tutor'){
  let next=d.upcoming||[];return layout(`${heading(`Hola, ${esc(u.name.split(' ')[0])}.`,`Desde aquí puedes organizar tus próximas atenciones ${u.role==='paciente'?`del sector ${u.sector}`:'y las de las personas a tu cuidado'}.`)}
  <section class="hero"><div><div class="kicker">Agenda de salud</div><h2>Una forma más simple de cuidar tu tiempo.</h2><p>Revisa los horarios disponibles, elige tu atención y mantén tus reservas en un solo lugar.</p><button class="white-btn" data-view="reservar">Buscar una hora ${I('arrow',16)}</button></div><div class="hero-illus">✳</div></section>
  ${metrics([['Próximas atenciones',next.length,'Reservas futuras activas','calendar'],['Sector asignado',u.sector?`Sector ${u.sector}`:'Según paciente','Validación local del registro','shield'],['Modalidad','En línea','Reservas disponibles 24/7 en demo','clock']])}
  <div class="cols-2">${panel('Próximas reservas','Atenciones que tienes agendadas',next.length?`<div class="card-list">${next.slice(0,3).map(b=>apptCard(b,false)).join('')}</div>`:empty('Todavía no tienes próximas atenciones.'),'<button class="ghost" data-view="mis-horas">Ver todas</button>')}
  ${panel('Accesos rápidos','Ir directamente a una función',`<div class="quick-links"><button class="quick-link" data-view="reservar">${I('calendar')} Reservar hora</button><button class="quick-link" data-view="mis-horas">${I('clock')} Mis reservas</button>${u.role==='tutor'?`<button class="quick-link" data-view="dependientes">${I('users')} Dependientes</button>`:''}<button class="quick-link" data-view="avisos">${I('bell')} Avisos</button></div><div class="note">El sistema consulta datos ficticios. La validación oficial contra la inscripción per cápita debe integrarse antes de su uso real.</div>`)}</div>`);
 }
 return layout(`${heading(`Bienvenida/o, ${esc(u.name.split(' ')[0])}.`,'Información del día y accesos principales según tu perfil.')}
 <section class="hero"><div><div class="kicker">Panel del personal</div><h2>Agenda de hoy, clara y ordenada.</h2><p>Consulta las atenciones programadas y revisa las acciones que te corresponden.</p><button class="white-btn" data-view="${u.role==='some'?'nomina':'agenda'}">Ver agenda ${I('arrow',16)}</button></div><div class="hero-illus">✳</div></section>
 ${metrics([['Reservas del día',d.today??0,'Citas en agenda','calendar'],['Activas',d.booked??0,'Pendientes de atención','clock'],[u.role==='some'?'Tutorías pendientes':'Inasistencias',u.role==='some'?d.pendingLinks??0:d.noShow??0,'Según permisos del perfil','users']])}
 ${panel('Acciones disponibles','El acceso está limitado por tu rol.',`<div class="quick-links">${u.role==='some'?`<button class="quick-link" data-view="nomina">${I('list')} Consultar nómina</button><button class="quick-link" data-view="solicitudes">${I('users')} Revisar tutorías</button><button class="quick-link" data-view="horarios">${I('calendar')} Crear horarios</button><button class="quick-link" data-view="auditoria">${I('shield')} Auditoría</button>`:`<button class="quick-link" data-view="agenda">${I('calendar')} Mis pacientes</button><button class="quick-link" data-view="avisos">${I('bell')} Avisos</button>`}</div>`)}`);
}
function patientSelection(){if(state.user.role!=='tutor')return '';
 const allowed=state.links.filter(l=>l.status==='aprobado');
 return `<div class="selection"><div class="field"><label for="patient-select">Paciente para gestionar sus horas</label><select id="patient-select">${allowed.map(x=>`<option value="${x.patient_id}" ${Number(state.patientId)===x.patient_id?'selected':''}>${esc(x.name)} · Sector ${esc(x.sector)}</option>`).join('')}</select></div><button class="secondary" data-view="dependientes">Gestionar vínculos</button></div>`;
}
function renderBooking(){
 if(state.user.role==='tutor'&&!state.links.some(x=>x.status==='aprobado'))return layout(heading('Reservar hora','Gestiona citas de tus dependientes.')+panel('Necesitas un vínculo aprobado','Antes de reservar, el SOME debe confirmar la tutoría.',empty('Todavía no hay dependientes autorizados para agendar.')+'<div style="margin-top:16px"><button class="primary" data-view="dependientes">Vincular un dependiente</button></div>'));
 const dates=upcomingDays();if(!state.date||!dates.includes(state.date))state.date=dates[0];
 return layout(`${heading('Reservar una hora','Escoge el tipo de atención y luego el bloque que mejor te acomode. Solo aparecen horas del sector correspondiente.')}
 ${patientSelection()}
 ${panel('Selecciona una atención','Los programas de salud se filtran según el sector del paciente.',`<div class="tabs"><button class="tab ${state.service==='medicina_general'?'selected':''}" data-service="medicina_general">${I('heart',15)} Medicina general</button><button class="tab ${state.service==='programas'?'selected':''}" data-service="programas">${I('activity',15)} Programas de salud</button></div>
 <p class="help">${state.service==='programas'?'En programas solo se muestran las agendas del sector inscrito.':'Medicina general se gestiona a través de la agenda SOME.'}</p>`)}
 ${panel('Fechas disponibles','Selecciona un día y una hora. Los bloques ocupados aparecen deshabilitados.',`<div class="date-strip">${dates.map(date=>{let dateObj=new Date(date+'T12:00:00');return `<button class="date-choice ${date===state.date?'selected':''}" data-date="${date}"><span>${dateObj.toLocaleDateString('es-CL',{weekday:'short'})}</span><b>${dateObj.getDate()}</b><span>${dateObj.toLocaleDateString('es-CL',{month:'short'})}</span></button>`}).join('')}</div>
 ${state.slots.length?`<div class="slot-grid">${state.slots.map(s=>`<button class="slot ${s.available?'':'taken'}" data-slot="${s.id}" ${s.available?'':'disabled'}><b>${esc(s.starts_at.slice(11,16))}</b><small>${s.available?'Disponible':'Reservado o vencido'}</small><small>${esc(s.professional)} · ${esc(s.box)}</small></button>`).join('')}</div>`:empty('No hay horarios publicados para este día. Prueba con otra fecha.')}<div class="note">Antes de confirmar se revisará nuevamente la disponibilidad para evitar dobles reservas.</div>`)}`);
}
function renderMyBookings(){return layout(`${heading('Mis reservas','Consulta tus horas confirmadas, canceladas y las que ya terminaron.')}${patientSelection()}
 ${panel('Historial de reservas',`${state.bookings.length} registros encontrados`,state.bookings.length?`<div class="card-list">${state.bookings.map(b=>apptCard(b)).join('')}</div>`:empty('No existen reservas para este paciente.'),'<button class="secondary tiny" data-view="reservar">Reservar otra hora</button>')}`);}
function renderDependents(){return layout(`${heading('Mis dependientes','Solicita autorización para gestionar citas de una persona inscrita en el CESFAM.')}
 ${panel('Solicitar vínculo','La autorización no es automática. El SOME debe validar la relación antes de habilitar las reservas.',`<form id="link-form"><div class="field"><label for="link-rut">RUT de la persona a vincular</label><input id="link-rut" required name="rut" placeholder="11.111.111-1" /></div><div class="field"><label style="display:flex;align-items:flex-start;gap:10px;font-size:12px;font-weight:500;line-height:1.6"><input style="width:17px;margin-top:3px" name="consent" type="checkbox" required/> Declaro que cuento con autorización para solicitar el vínculo y acepto el tratamiento de los datos de demostración únicamente para fines académicos.</label></div><button class="primary" type="submit">${I('plus')} Solicitar vínculo</button></form><div class="note">En este prototipo la comprobación del vínculo es manual, mediante el perfil SOME. No reemplaza el procedimiento presencial real.</div>`)}
 ${panel('Estado de solicitudes','Las solicitudes pendientes no permiten reservar.',state.links.length?`<div class="table-scroll"><table><thead><tr><th>Paciente</th><th>RUT</th><th>Sector</th><th>Estado</th></tr></thead><tbody>${state.links.map(l=>`<tr><td><strong>${esc(l.name)}</strong></td><td>${esc(l.rut)}</td><td>Sector ${l.sector}</td><td>${pill(l.status)}</td></tr>`).join('')}</tbody></table></div>`:empty('Aún no has solicitado vínculos.'))}`);}
const dayFilter=(key, label)=>`<div class="selection"><div class="field"><label for="day-${key}">${label}</label><input type="date" id="day-${key}" data-roster-date value="${esc(state.rosterDate)}" /></div><span class="pill">${esc(state.roster.length)} registros</span></div>`;
function rosterTable(professional=false){let bookings=state.roster;
 return bookings.length?`<div class="table-scroll"><table><thead><tr><th>Hora</th><th>Paciente</th><th>RUT / Ficha</th><th>Servicio</th><th>Box</th><th>Estado</th>${professional?'<th>Acción</th>':''}</tr></thead><tbody>${bookings.map(b=>`<tr><td><strong>${esc(b.starts_at.slice(11,16))}</strong></td><td>${esc(b.patient_name)}</td><td>${esc(b.patient_rut)}<br/><small>Ficha: ${esc(b.clinical_file||'—')}</small></td><td>${esc(serviceName(b.service))}<br/><small>${b.sector?`Sector ${b.sector}`:'SOME'}</small></td><td>${esc(b.box)}</td><td>${pill(b.status)}</td>${professional?`<td>${b.status==='reservada'?`<button class="danger tiny" data-noshow="${b.id}">Marcar No-Show</button>`:'—'}</td>`:''}</tr>`).join('')}</tbody></table></div>`:empty('No hay pacientes citados para la fecha seleccionada.');
}
function renderRoster(professional){return layout(`${heading(professional?'Mi agenda de pacientes':'Nómina de pacientes',professional?'Aquí aparecen únicamente las horas asignadas a tu perfil profesional.':'Consulta la nómina con número de ficha clínica física y estado de la atención.')}
 ${panel(professional?'Atenciones asignadas':'Nómina diaria','Selecciona una fecha para consultar.',dayFilter('roster','Fecha de atención')+rosterTable(professional))}
 ${professional?`<div class="note">Puedes marcar una inasistencia únicamente después de 20 minutos desde el comienzo de la hora. Esta restricción se verifica en el servidor.</div>`:`<div class="note">La nómina está disponible solamente para personal SOME autenticado. No es accesible desde el portal del paciente.</div>`}`);}
function renderRequests(){let r=state.linkRequests;
 return layout(`${heading('Validar tutorías','Revisa las solicitudes realizadas por tutores. La decisión queda registrada en auditoría.')}
 ${panel('Solicitudes de vinculación',`${r.filter(x=>x.status==='pendiente').length} por revisar`,r.length?`<div class="table-scroll"><table><thead><tr><th>Tutor</th><th>Paciente</th><th>Sector</th><th>Solicitud</th><th>Acción</th></tr></thead><tbody>${r.map(x=>`<tr><td><strong>${esc(x.tutor_name)}</strong><small>${esc(x.tutor_rut)}</small></td><td>${esc(x.patient_name)}<br/><small>${esc(x.patient_rut)}</small></td><td>${x.sector}</td><td>${pill(x.status)}</td><td>${x.status==='pendiente'?`<div class="td-action"><button class="secondary tiny" data-review="${x.id}" data-decision="aprobado">Aprobar</button><button class="danger tiny" data-review="${x.id}" data-decision="rechazado">Rechazar</button></div>`:'Revisada'}</td></tr>`).join('')}</tbody></table></div>`:empty('No hay solicitudes de tutoría.'))}`);}
function renderSlotsAdmin(){
 return layout(`${heading('Gestión de horarios','Publica bloques de atención asociados a un profesional, servicio y sector.')}
 ${panel('Nuevo bloque de atención','La base de datos impide que un profesional tenga dos bloques con la misma hora de inicio.',`<form id="slot-form"><div class="form-cols"><div class="field"><label>Tipo de atención</label><select name="service" required><option value="medicina_general">Medicina general</option><option value="programas">Programas de salud</option></select></div><div class="field"><label>Sector (solo programas)</label><select name="sector"><option value="2">Sector 2</option><option value="1">Sector 1</option><option value="3">Sector 3</option></select></div><div class="field"><label>Profesional</label><select name="professionalId" required>${state.professionals.map(p=>`<option value="${p.id}">${esc(p.name)}</option>`).join('')}</select></div><div class="field"><label>Fecha y hora</label><input name="startsAt" type="datetime-local" required /></div><div class="field"><label>Duración</label><select name="durationMinutes"><option value="15">15 minutos</option><option value="20">20 minutos</option><option value="30">30 minutos</option></select></div><div class="field"><label>Box</label><input name="box" value="Box 04" required maxlength="40" /></div><div class="full"><button class="primary" type="submit">${I('plus')} Publicar bloque</button></div></div></form>`)}
 ${panel('Control de disponibilidad','El profesional asignado verá sus citas una vez que se reserven.',`<div class="note">Los bloques nuevos se reflejan inmediatamente en la búsqueda de horas. El sistema rechaza horarios duplicados para un mismo profesional.</div>`)}`);
}
function renderAudits(){return layout(`${heading('Registro de acciones','Trazabilidad de operaciones de reserva, tutoría y acceso al sistema.')}
 ${panel('Actividad reciente','Últimas 40 operaciones registradas.',state.audits.length?`<div class="table-scroll"><table><thead><tr><th>Fecha</th><th>Responsable</th><th>Acción</th><th>Referencia</th></tr></thead><tbody>${state.audits.map(e=>`<tr><td>${esc(e.created_at.replace('T',' '))}</td><td>${esc(e.actor||'Sistema')}</td><td>${esc(e.action.replaceAll('_',' '))}</td><td>${esc(e.target)}</td></tr>`).join('')}</tbody></table></div>`:empty('Todavía no se registran operaciones.'))}`);}
function renderNotifications(){return layout(`${heading('Avisos','Confirmaciones y recordatorios dentro del prototipo. No se envían SMS ni correos reales.')}
 ${panel('Centro de avisos',`${state.notifications.length} mensajes recientes`,state.notifications.length?`<div class="card-list">${state.notifications.map(n=>`<div class="appt"><div class="appt-left">${I('bell',20)}<div><h3>${esc(n.message)}</h3><p>${esc(n.created_at.replace('T',' '))}</p></div></div></div>`).join('')}</div>`:empty('Aún no tienes avisos.'))}`);}
function renderProfile(){let u=state.user;
 return layout(`${heading('Mi perfil','Información de la cuenta de demostración.')}
 ${panel('Datos de usuario','La información de identidad y sector se establece desde el registro local del prototipo.',`<div class="profile-table"><div>Nombre</div><div>${esc(u.name)}</div><div>RUT</div><div>${esc(u.rut)}</div><div>Perfil</div><div>${esc(roleName(u.role))}</div><div>Sector</div><div>${u.sector?`Sector ${u.sector}`:'No aplica'}</div>${u.clinicalFile?`<div>Ficha física</div><div>${esc(u.clinicalFile)}</div>`:''}</div>`)}
 ${panel('Protección de información','Medidas contempladas en esta demostración.',`<p class="help">Las contraseñas están almacenadas con hash y sal; la sesión utiliza una cookie HttpOnly. Los datos se filtran según el rol en el servidor y se registran los cambios relevantes de las reservas.</p><div class="note">No usar datos de pacientes reales. Para producción faltan la integración con registros clínicos autorizados, los controles de infraestructura, HTTPS, respaldos y una evaluación formal de seguridad.</div>`)}`);
}
async function open(view){if(!state.user)return renderLogin();
 const allowed=menu().map(x=>x[0]);state.view=allowed.includes(view)?view:'inicio';
 try{
  switch(state.view){
   case 'inicio':state.dashboard=await api('/dashboard');break;
   case 'reservar':
   case 'mis-horas':
     if(state.user.role==='tutor'){
       state.links=(await api('/dependents')).dependents;
       let allowed=state.links.filter(x=>x.status==='aprobado');
       if(!allowed.some(x=>x.patient_id===Number(state.patientId)))state.patientId=allowed[0]?.patient_id||null;
     }else state.patientId=state.user.id;
     if(state.view==='reservar'){
       if(!state.date||!upcomingDays().includes(state.date))state.date=upcomingDays()[0];
       state.slots=state.patientId?(await api(`/slots?service=${state.service}&date=${state.date}&patientId=${state.patientId}`)).slots:[];
     }else state.bookings=state.patientId?(await api(`/bookings?patientId=${state.patientId}`)).bookings:[];
     break;
   case 'dependientes':state.links=(await api('/dependents')).dependents;break;
   case 'nomina':case 'agenda':
     if(!state.rosterDate)state.rosterDate=new Date().toLocaleDateString('sv-SE');
     state.roster=(await api(`${state.view==='nomina'?'/roster':'/professional/appointments'}?date=${state.rosterDate}`)).bookings;
     break;
   case 'solicitudes':state.linkRequests=(await api('/dependent-requests')).requests;break;
   case 'horarios':state.professionals=(await api('/professionals')).professionals;break;
   case 'auditoria':state.audits=(await api('/audit')).events;break;
   case 'avisos':state.notifications=(await api('/notifications')).notifications;break;
  }
  const viewFns={inicio:renderHome,reservar:renderBooking,'mis-horas':renderMyBookings,dependientes:renderDependents,nomina:()=>renderRoster(false),agenda:()=>renderRoster(true),solicitudes:renderRequests,horarios:renderSlotsAdmin,auditoria:renderAudits,avisos:renderNotifications,perfil:renderProfile};
  viewFns[state.view]();
 }catch(e){toast(e.message,true); if(state.user)layout(heading('No se pudo cargar la información','Intenta nuevamente.'));}
}
function modal(title,description,summary,submitText,onConfirm){
 const bg=document.createElement('div');bg.className='modal-backdrop';bg.innerHTML=`<section role="dialog" aria-modal="true" aria-label="${esc(title)}" class="modal"><h2>${esc(title)}</h2><p>${esc(description)}</p>${summary?`<div class="summary">${summary}</div>`:''}<div class="modal-buttons"><button class="secondary" data-modal-cancel>Volver</button><button class="primary" data-modal-confirm>${esc(submitText)}</button></div></section>`;
 bg.addEventListener('click',e=>{if(e.target===bg||e.target.closest('[data-modal-cancel]'))bg.remove();if(e.target.closest('[data-modal-confirm]')){const button=bg.querySelector('[data-modal-confirm]');button.disabled=true;Promise.resolve(onConfirm(bg)).then(()=>bg.remove()).catch(err=>{button.disabled=false;toast(err.message,true);});}});
 document.body.append(bg);bg.querySelector('[data-modal-cancel]').focus();
}
const pending=async(action)=>{try{await action();}catch(e){toast(e.message,true);}};
document.addEventListener('click',async e=>{
 const demo=e.target.closest('[data-demo-rut]');if(demo){$('#rut').value=demo.dataset.demoRut;$('#password').value='Galeno2026!';$('#password').focus();return;}
 const nav=e.target.closest('[data-view]');if(nav){await open(nav.dataset.view);return;}
 if(e.target.closest('[data-action="logout"]')){await pending(async()=>{await post('/logout');state.user=null;state.view='inicio';renderLogin();});return;}
 const service=e.target.closest('[data-service]');if(service){state.service=service.dataset.service;await open('reservar');return;}
 const date=e.target.closest('[data-date]');if(date){state.date=date.dataset.date;await open('reservar');return;}
 const slotButton=e.target.closest('[data-slot]');if(slotButton){
  const s=state.slots.find(x=>x.id===Number(slotButton.dataset.slot));if(!s||!s.available)return;
  modal('Confirma tu reserva','Revisa el horario antes de continuar.',`<div><b>Atención</b> · ${esc(serviceName(s.service))}</div><div><b>Fecha</b> · ${esc(showDate(s.starts_at))}</div><div><b>Profesional</b> · ${esc(s.professional)}</div><div><b>Lugar</b> · ${esc(s.box)}</div>`,'Confirmar hora',async()=>{
   const r=await post('/bookings',{slotId:s.id,patientId:state.patientId});toast(`Hora confirmada. Código ${r.code}`);await open('mis-horas');
  });return;
 }
 const cancel=e.target.closest('[data-cancel]');if(cancel){const b=state.bookings.find(x=>x.id===Number(cancel.dataset.cancel));if(!b)return;
  modal('Cancelar atención','Esta acción liberará el bloque para otro paciente.',`<div>${esc(serviceName(b.service))}</div><div>${esc(showDate(b.starts_at))}</div><div class="field"><label>Motivo de cancelación</label><textarea id="cancel-reason" maxlength="200" rows="3" placeholder="Explica brevemente el motivo"></textarea></div>`,'Cancelar reserva',async(bg)=>{
   const reason=bg.querySelector('#cancel-reason').value.trim();if(reason.length<3)throw Error('Escribe un motivo de al menos 3 caracteres.');
   await post(`/bookings/${b.id}/cancel`,{reason});toast('La hora fue cancelada.');await open('mis-horas');
  });return;
 }
 const review=e.target.closest('[data-review]');if(review){let id=review.dataset.review, decision=review.dataset.decision;
  modal('Revisión de tutoría',`¿Confirmas que quieres ${decision==='aprobado'?'aprobar':'rechazar'} el vínculo?`,'Esta decisión quedará en el registro de acciones.','Confirmar',async()=>{await post(`/dependent-requests/${id}/review`,{status:decision});toast('Solicitud revisada.');await open('solicitudes');});return;
 }
 const noshow=e.target.closest('[data-noshow]');if(noshow){let id=noshow.dataset.noshow;
  modal('Registrar inasistencia','Esta acción se permite solo 20 minutos después del inicio de la atención.','Revisa que el paciente no haya sido atendido.','Registrar No-Show',async()=>{await post(`/bookings/${id}/no-show`);toast('Inasistencia registrada.');await open('agenda');});return;
 }
});
document.addEventListener('change',async e=>{
 if(e.target.id==='patient-select'){state.patientId=Number(e.target.value);await open(state.view);}
 if(e.target.hasAttribute('data-roster-date')){state.rosterDate=e.target.value;await open(state.view);}
});
document.addEventListener('submit',async e=>{
 if(!['login-form','link-form','slot-form'].includes(e.target.id))return;
 e.preventDefault();const form=e.target;const submit=form.querySelector('button[type="submit"]');submit.disabled=true;
 try{
  if(form.id==='login-form'){
   const body=Object.fromEntries(new FormData(form));const {user}=await post('/login',body);state.user=user;state.view='inicio';toast(`Bienvenida/o, ${user.name.split(' ')[0]}.`);await open('inicio');
  }
  if(form.id==='link-form'){
   const data=new FormData(form);await post('/dependents',{rut:data.get('rut'),consent:data.has('consent')});toast('Solicitud enviada al SOME para su revisión.');await open('dependientes');
  }
  if(form.id==='slot-form'){
   const body=Object.fromEntries(new FormData(form));body.startsAt=body.startsAt.length===16?`${body.startsAt}:00`:body.startsAt;
   await post('/slots',body);toast('Nuevo bloque publicado.');await open('horarios');
  }
 }catch(err){toast(err.message,true);}finally{if(submit.isConnected)submit.disabled=false;}
});
load();
