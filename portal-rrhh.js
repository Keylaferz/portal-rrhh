/* ══════════════════════════════════════════
   Portal RRHH — Lean Consulting S.A.
   JavaScript principal
   ══════════════════════════════════════════ */

// ── CONFIG — pegue aquí su URL del GAS ──
const GAS_URL = 'https://script.google.com/macros/s/AKfycbyjKE7f4DXlVxBOmZHK6vGSYWQhONQgJkzuB-JslWP_89v-xhyuP74AjDYt8QiKC94w/exec';

// ── FERIADOS COSTA RICA ──
function getCRHolidays(year) {
  const fixed = [
    `${year}-01-01`,`${year}-04-11`,`${year}-05-01`,
    `${year}-07-25`,`${year}-08-02`,`${year}-08-15`,
    `${year}-09-15`,`${year}-10-12`,`${year}-12-25`,
  ];
  const a=year%19,b=Math.floor(year/100),c=year%100;
  const d=Math.floor(b/4),e=b%4,f=Math.floor((b+8)/25);
  const g=Math.floor((b-f+1)/3),h=(19*a+b-d-g+15)%30;
  const i=Math.floor(c/4),k=c%4,l=(32+2*e+2*i-h-k)%7;
  const m=Math.floor((a+11*h+22*l)/451);
  const month=Math.floor((h+l-7*m+114)/31);
  const day=((h+l-7*m+114)%31)+1;
  const easter=new Date(year,month-1,day);
  const th=new Date(easter); th.setDate(easter.getDate()-3);
  const fr=new Date(easter); fr.setDate(easter.getDate()-2);
  fixed.push(th.toISOString().split('T')[0]);
  fixed.push(fr.toISOString().split('T')[0]);
  return fixed;
}
function isHoliday(ds){ return getCRHolidays(parseInt(ds.split('-')[0])).includes(ds); }
function isBirthday(ds,bday){
  if(!bday) return false;
  const p=bday.split('/'); if(p.length!==3) return false;
  const [dd,mm]=p; const[,m,d]=ds.split('-'); return m===mm&&d===dd;
}
function countWorkdays(ini,fin,bdayStr){
  if(!ini||!fin||fin<ini) return {days:0,excluded:[]};
  let days=0; const excluded=[];
  const start=new Date(ini+'T12:00:00'), end=new Date(fin+'T12:00:00');
  for(let d=new Date(start);d<=end;d.setDate(d.getDate()+1)){
    const ds=d.toISOString().split('T')[0], dow=d.getDay();
    if(dow===0||dow===6){excluded.push({date:ds,reason:'Fin de semana'});continue;}
    if(isHoliday(ds))   {excluded.push({date:ds,reason:'Feriado'});continue;}
    if(isBirthday(ds,bdayStr)){excluded.push({date:ds,reason:'Cumpleaños'});continue;}
    days++;
  }
  return {days,excluded};
}

// ── EMPLOYEES ──
// pdTotal   = Personal Days por año (3 para todos, no acumulables)
// pdUsados  = Días ya tomados en 2026 ANTES del portal (histórico real)
// pdAnio    = Año al que corresponde el histórico pdUsados
// Los PD se resetean automáticamente cada 1 de enero
// Si no se usan antes del 31/12 se pierden
const EMPLOYEES = [
  {cedula:'111840112',nombre:'Cristiana María Echandi Montero',   puesto:'Project Manager',            ingreso:'2019-10-01',consumidos:64,  email:'cechandi@leancr.com',  pdTotal:3, pdUsados:0,   pdAnio:2026},
  {cedula:'116270838',nombre:'Alfonso Salomón Segura Salazar',    puesto:'Project Engineer',            ingreso:'2019-10-01',consumidos:57,  email:'asegura@leancr.com',   pdTotal:3, pdUsados:0,   pdAnio:2026},
  {cedula:'111320139',nombre:'Cristián Fernández Cardos',         puesto:'Gerente General',             ingreso:'2019-10-01',consumidos:80,  email:'cfernandez@leancr.com',pdTotal:3, pdUsados:0,   pdAnio:2026},
  {cedula:'305210209',nombre:'Sugey Elizabeth Mora Ureña',        puesto:'Project Engineer',            ingreso:'2022-09-15',consumidos:26,  email:'smora@leancr.com',     pdTotal:3, pdUsados:0.5, pdAnio:2026},
  {cedula:'115420183',nombre:'Edgard Allan Solís Chaverri',       puesto:'Project Manager',             ingreso:'2022-10-03',consumidos:21,  email:'asolis@leancr.com',    pdTotal:3, pdUsados:0,   pdAnio:2026},
  {cedula:'114230764',nombre:'Carlos Andrés Gutiérrez Garbanzo',  puesto:'Project Engineer',            ingreso:'2023-02-01',consumidos:23,  email:'cgutierrez@leancr.com',pdTotal:3, pdUsados:3,   pdAnio:2026},
  {cedula:'117730278',nombre:'Maron Yanin Arrieta Hernández',     puesto:'Project Engineer',            ingreso:'2023-05-15',consumidos:24,  email:'marrieta@leancr.com',  pdTotal:3, pdUsados:2,   pdAnio:2026},
  {cedula:'115780240',nombre:'Nicole Alexandra Cajina Cruz',      puesto:'Project Engineer',            ingreso:'2023-06-15',consumidos:25,  email:'ncajina@leancr.com',   pdTotal:3, pdUsados:0,   pdAnio:2026},
  {cedula:'115570313',nombre:'Héctor Esteban Ureña Marín',        puesto:'Asistente Administrativo',    ingreso:'2024-02-26',consumidos:16,  email:'hurena@leancr.com',    pdTotal:3, pdUsados:0,   pdAnio:2026},
  {cedula:'117870532',nombre:'María Fernanda Zeledón Barrios',    puesto:'Document Controller',         ingreso:'2024-03-18',consumidos:15,  email:'mzeledon@leancr.com',  pdTotal:3, pdUsados:1,   pdAnio:2026},
  {cedula:'305130742',nombre:'Santiago Hernán Brenes Aguilar',    puesto:'Project Controller',          ingreso:'2024-04-01',consumidos:15,  email:'sbrenes@leancr.com',   pdTotal:3, pdUsados:0,   pdAnio:2026},
  {cedula:'115840947',nombre:'Jesús Andrés Valverde Chaves',      puesto:'Site Construction Engineer',  ingreso:'2024-04-15',consumidos:12,  email:'avalverde@leancr.com', pdTotal:3, pdUsados:1,   pdAnio:2026},
  {cedula:'116700149',nombre:'Jorge Soto Badilla',                puesto:'MEP Engineer',                ingreso:'2024-09-09',consumidos:15,  email:'jsoto@leancr.com',     pdTotal:3, pdUsados:0,   pdAnio:2026},
  {cedula:'117610198',nombre:'Keila Fernández Sandí',             puesto:'Coordinadora Administrativa', ingreso:'2025-03-03',consumidos:5.5, email:'kfernandez@leancr.com',pdTotal:3, pdUsados:1,   pdAnio:2026},
  {cedula:'206160552',nombre:'Oscar Salazar Corrales',            puesto:'Ingeniero en Electrónica',    ingreso:'2025-06-09',consumidos:4,   email:'osalazar@leancr.com',  pdTotal:3, pdUsados:0,   pdAnio:2026},
  {cedula:'303840620',nombre:'Humberto José Navarro Guzmán',      puesto:'Director de Proyectos',       ingreso:'2025-11-24',consumidos:6,   email:'hnavarro@leancr.com',  pdTotal:3, pdUsados:0,   pdAnio:2026},
];

// ── STATE ──
let currentUser   = null;
let isAdmin       = false;
let currentType   = null;
let pendingTicket = null;
let tickets       = [];        // se carga desde Google Sheets
let expedientes   = {};        // se carga desde Google Sheets
let resolveData   = {};
let editData      = {};
let cancelData    = {};
let selectedTickets = new Set();

// ── HELPERS ──
const fmt = d => {
  if(!d) return '—';
  if(typeof d==='string'&&d.match(/^\d{4}-\d{2}-\d{2}$/)){const[y,m,day]=d.split('-');return`${day}/${m}/${y}`;}
  if(d instanceof Date) return d.toLocaleDateString('es-CR');
  return d;
};
const tid    = () => 'TKT-'+Date.now().toString().slice(-6);
const tlabel = t => ({vacaciones:'🏖️ Vacaciones',incapacidad:'🏥 Incapacidad',cumpleanos:'🎂 Cumpleaños',personalday:'⭐ Personal Day',singoce:'📤 Día Sin Goce'}[t]||t);
const slabel = s => ({pending:'⏳ En Proceso',inprogress:'🔄 En Gestión',approved:'✅ Aprobada',denied:'❌ Denegada',cancelled:'🚫 Cancelada'}[s]||s);
const sbadge = s => `<span class="sb ${s||'pending'}">${slabel(s)}</span>`;
// Guarda en Google Sheets vía GAS (localStorage solo como caché offline)
const save    = () => localStorage.setItem('hr_tickets',JSON.stringify(tickets));
const saveExp = () => localStorage.setItem('hr_expedientes',JSON.stringify(expedientes));

// ── GAS API ──
async function gasGet(params) {
  if(!GAS_URL||GAS_URL==='PEGUE_SU_URL_GAS_AQUI') return null;
  try {
    const url = `${GAS_URL}?${new URLSearchParams(params)}`;
    const res  = await fetch(url);
    return await res.json();
  } catch(e) { return null; }
}
const getField = (id,def='') => { const el=document.getElementById(id); return el?el.value:def; };
const fmtMoney = v => v ? '₡ '+parseFloat(v).toLocaleString('es-CR') : '—';

function getEmpBirthday(emp){
  const exp=expedientes[emp.cedula]; return exp?(exp.fnac||''):'';
}

function calcVac(emp){
  const hoy=new Date(),ini=new Date(emp.ingreso);
  let m=(hoy.getFullYear()-ini.getFullYear())*12+(hoy.getMonth()-ini.getMonth());
  if(hoy.getDate()<ini.getDate()) m--;
  if(m<0) m=0;
  const dm=new Date(hoy.getFullYear(),hoy.getMonth()+1,0).getDate();
  const im=new Date(hoy.getFullYear(),hoy.getMonth(),ini.getDate());
  const f=hoy>=im?Math.min((hoy-im)/(dm*864e5),1):0;
  const acum=Math.floor(m+f); // días acumulados siempre enteros (1 por mes)
  // Solo se descuentan vacaciones APROBADAS (no pendientes ni en gestión)
  const ep=tickets.filter(t=>t.cedula===emp.cedula&&t.tipo==='vacaciones'&&t.status==='approved').reduce((s,t)=>s+(parseFloat(t.details.dias)||0),0);
  const u=Math.round((emp.consumidos+ep)*10)/10;
  // disp preserva medios días (.5) — no se aplica Math.floor
  const disp=Math.round((acum-u)*10)/10;
  const prox=new Date(hoy.getFullYear(),hoy.getMonth()+1,ini.getDate());
  return{meses:m,acum,usados:u,disp,pct:Math.min(100,Math.round((u/Math.max(acum,1))*100)),prox};
}

// ── PERSONAL DAYS ──
// 3 PD por año · No acumulables · Se resetean el 1 de enero automáticamente
// pdUsados = histórico real tomado ANTES del portal en el año pdAnio
// Si el año actual != pdAnio, el histórico se ignora (ya venció)
function calcPD(emp){
  const anio = new Date().getFullYear();
  // Histórico solo aplica si corresponde al año actual
  const historico = (emp.pdAnio === anio) ? (emp.pdUsados || 0) : 0;
  // PD aprobados desde el portal en el año actual
  const usadosPortal = tickets
    .filter(t => t.cedula === emp.cedula && t.tipo === 'personalday' && t.status === 'approved')
    .filter(t => t.fecha && t.fecha.startsWith(anio.toString()))
    .reduce((s,t) => s + (parseFloat(t.details.dias) || 0), 0);
  const usados = Math.round((historico + usadosPortal) * 10) / 10;
  const disp   = Math.max(0, Math.round((emp.pdTotal - usados) * 10) / 10);
  return { total: emp.pdTotal, usados, disp, anio };
}

// ══════════════════════════════
// CARGA DE DATOS DESDE SHEETS
// ══════════════════════════════
async function loadUserData(cedula) {
  showOverlay('Cargando sus datos...');
  // Cargar tickets del colaborador
  const resT = await gasGet({action:'getTickets', cedula});
  if(resT && resT.ok && resT.data) {
    tickets = resT.data.map(parseTicket);
    save(); // caché local
  } else {
    // Fallback a localStorage si no hay conexión
    tickets = JSON.parse(localStorage.getItem('hr_tickets')||'[]')
      .filter(t=>t.cedula===cedula);
  }
  // Cargar expediente
  const resE = await gasGet({action:'getExpediente', cedula});
  if(resE && resE.ok && resE.data) {
    expedientes[cedula] = resE.data;
    saveExp();
  } else {
    expedientes = JSON.parse(localStorage.getItem('hr_expedientes')||'{}');
  }
  hideOverlay();
}

async function loadAllTickets() {
  showOverlay('Cargando solicitudes...');
  const resT = await gasGet({action:'getTickets'});
  if(resT && resT.ok && resT.data) {
    tickets = resT.data.map(parseTicket);
    save();
  } else {
    tickets = JSON.parse(localStorage.getItem('hr_tickets')||'[]');
  }
  hideOverlay();
}

// Convierte fila plana del Sheet a objeto con details anidado
function parseTicket(t) {
  if(t.details) return t; // ya está parseado
  return {
    id:       t.id,
    cedula:   t.cedula,
    empleado: t.empleado,
    puesto:   t.puesto,
    tipo:     t.tipo,
    status:   t.status,
    fecha:    t.fecha,
    obs:      t.obs,
    notaAdmin:t.notaAdmin,
    editCount:parseInt(t.editCount)||0,
    resueltoFecha:    t.resueltoFecha,
    fechaCancelacion: t.fechaCancelacion,
    motivoCancelacion:t.motivoCancelacion,
    motivoEdicion:    t.motivoEdicion,
    ultimaEdicion:    t.ultimaEdicion,
    details: {
      inicio:   t.inicio,
      fin:      t.fin,
      dias:     parseFloat(t.dias)||0,
      turno:    t.turno,
      excluidos:parseInt(t.excluidos)||0,
      tipo:     t.tipo_inc||'',
      medico:   t.medico||'',
      motivo:   t.motivo||'',
    }
  };
}

function showOverlay(msg) {
  document.getElementById('sendingOverlay').classList.add('active');
  const box = document.querySelector('.sending-title');
  if(box) box.textContent = msg;
}
function hideOverlay() {
  document.getElementById('sendingOverlay').classList.remove('active');
}

// ── DAYS COUNTER ──
const typeFields={
  vacaciones: {ini:'vac-ini',fin:'vac-fin'},
  incapacidad:{ini:'inc-ini',fin:'inc-fin'},
  cumpleanos: {ini:'cum-ini',fin:'cum-fin'},
  personalday:{ini:'per-ini',fin:'per-fin'},
  singoce:    {ini:'sg-ini', fin:'sg-fin'},
};

function calcDays(tipo){
  const f=typeFields[tipo]; if(!f) return;
  const ini=getField(f.ini),fin=getField(f.fin);
  const ctr=document.getElementById('days-counter-'+tipo);
  if(!ini||!fin||fin<ini){if(ctr)ctr.style.display='none';return;}
  const bday=currentUser?getEmpBirthday(currentUser):'';
  const{days,excluded}=countWorkdays(ini,fin,bday);
  document.getElementById('days-val-'+tipo).textContent=days;
  document.getElementById('days-range-'+tipo).textContent=`${fmt(ini)} → ${fmt(fin)}`;
  const exclEl=document.getElementById('days-excl-'+tipo);
  const fines=excluded.filter(e=>e.reason==='Fin de semana').length;
  const feries=excluded.filter(e=>e.reason==='Feriado').length;
  const cumple=excluded.filter(e=>e.reason==='Cumpleaños').length;
  const parts=[]; if(fines)parts.push(`${fines} fin(es) de semana`);
  if(feries)parts.push(`${feries} feriado(s)`); if(cumple)parts.push(`${cumple} cumpleaños`);
  exclEl.textContent=parts.length?`Excluidos: ${parts.join(', ')}` :'';
  if(ctr)ctr.style.display='flex';
}

function calcEditDays(){
  const ini=getField('edit-ini'),fin=getField('edit-fin');
  const ctr=document.getElementById('edit-days-counter');
  if(!ini||!fin||fin<ini){ctr.style.display='none';return;}
  const bday=currentUser?getEmpBirthday(currentUser):'';
  const{days,excluded}=countWorkdays(ini,fin,bday);
  document.getElementById('edit-days-val').textContent=days;
  document.getElementById('edit-days-range').textContent=`${fmt(ini)} → ${fmt(fin)}`;
  const fines=excluded.filter(e=>e.reason==='Fin de semana').length;
  const feries=excluded.filter(e=>e.reason==='Feriado').length;
  const cumple=excluded.filter(e=>e.reason==='Cumpleaños').length;
  const parts=[]; if(fines)parts.push(`${fines} fin(es) de semana`);
  if(feries)parts.push(`${feries} feriado(s)`); if(cumple)parts.push(`${cumple} cumpleaños`);
  document.getElementById('edit-days-excl').textContent=parts.length?`Excluidos: ${parts.join(', ')}`:'';
  ctr.style.display='flex';
}

// ══════════════════════════════
// AUTH
// ══════════════════════════════
function switchLoginTab(t,btn){
  document.querySelectorAll('.login-tab').forEach(b=>b.classList.remove('active'));
  btn.classList.add('active');
  document.getElementById('empLogin').style.display   =t==='emp'  ?'block':'none';
  document.getElementById('adminLogin').style.display =t==='admin'?'block':'none';
  document.getElementById('loginError').style.display='none';
}

async function doLogin(){
  const v=document.getElementById('cedulaInput').value.trim().replace(/[-.\s]/g,'');
  const emp=EMPLOYEES.find(e=>e.cedula===v);
  const err=document.getElementById('loginError');
  if(!emp){err.style.display='block';err.textContent='⚠️ Cédula no encontrada.';return;}
  err.style.display='none';
  currentUser=emp; isAdmin=false;
  show('appScreen');
  document.getElementById('userName').textContent  =emp.nombre.split(' ').slice(0,2).join(' ');
  document.getElementById('userCedula').textContent='Cédula: '+emp.cedula;
  document.getElementById('userAvatar').textContent=emp.nombre[0];
  // Cargar datos desde Sheets
  await loadUserData(emp.cedula);
  updateStats(); renderTickets(); updateVacTab(); renderExpView();
}

function doAdminLogin(){
  const u=document.getElementById('adminUser').value.trim();
  const p=document.getElementById('adminPass').value;
  const err=document.getElementById('loginError');
  // Valida contra GAS si hay URL, sino local
  if(GAS_URL && GAS_URL !== 'PEGUE_SU_URL_GAS_AQUI'){
    fetch(`${GAS_URL}?action=authAdmin&user=${encodeURIComponent(u)}&pass=${encodeURIComponent(p)}`)
      .then(r=>r.json()).then(res=>{
        if(res.ok) initAdmin();
        else { err.style.display='block'; err.textContent='⚠️ Credenciales incorrectas.'; }
      }).catch(()=>{ err.style.display='block'; err.textContent='⚠️ Error de conexión con el servidor.'; });
  } else {
    if(u==='admin'&&p==='rrhh2024') initAdmin();
    else { err.style.display='block'; err.textContent='⚠️ Credenciales incorrectas.'; }
  }
}

async function initAdmin(){
  document.getElementById('loginError').style.display='none';
  isAdmin=true;
  show('adminScreen');
  document.getElementById('adminList').innerHTML='<div class="empty-state"><div class="empty-icon">⏳</div><div>Cargando solicitudes...</div></div>';
  // Cargar todos los tickets desde Sheets
  await loadAllTickets();
  populateEmpFilter(); renderAdmin();
  const sel=document.getElementById('expEmpSelect');
  sel.innerHTML='<option value="">— Seleccione un colaborador —</option>'+
    EMPLOYEES.map(e=>`<option value="${e.cedula}">${e.nombre}</option>`).join('');
}

function doLogout(){
  currentUser=null; isAdmin=false; currentType=null;
  show('loginScreen');
  document.getElementById('cedulaInput').value='';
  document.getElementById('adminUser').value='';
  document.getElementById('adminPass').value='';
  clearForm();
}

function show(id){
  document.querySelectorAll('.screen').forEach(s=>s.classList.remove('active'));
  document.getElementById(id).classList.add('active');
}

// ══════════════════════════════
// TABS
// ══════════════════════════════
function showTab(id,btn){
  document.querySelectorAll('#appScreen .tab-panel').forEach(p=>p.classList.remove('active'));
  document.querySelectorAll('#appScreen .tab-btn').forEach(b=>b.classList.remove('active'));
  document.getElementById('tab-'+id).classList.add('active');
  if(btn) btn.classList.add('active');
  if(id==='historial') { loadUserData(currentUser.cedula).then(()=>{renderTickets();}); }
  if(id==='desglose')  { updateVacTab(); }
  if(id==='expediente'){ loadUserData(currentUser.cedula).then(()=>{renderExpView();}); }
  if(id==='historial_completo'){ loadUserData(currentUser.cedula).then(()=>{renderFullHistory();}); }
}

function showAdminTab(id,btn){
  document.querySelectorAll('#adminScreen .tab-panel').forEach(p=>p.classList.remove('active'));
  document.querySelectorAll('#adminScreen .tab-btn').forEach(b=>b.classList.remove('active'));
  document.getElementById('admin-tab-'+id).classList.add('active');
  if(btn) btn.classList.add('active');
}

// ══════════════════════════════
// FORM
// ══════════════════════════════
function selType(t){
  currentType=t;
  document.querySelectorAll('.req-type').forEach(b=>b.classList.remove('sel'));
  document.getElementById('type-'+t).classList.add('sel');
  document.querySelectorAll('.fg-group').forEach(g=>g.style.display='none');
  document.querySelectorAll('[id^="days-counter-"]').forEach(d=>d.style.display='none');
  document.getElementById('fields-'+t).style.display='block';
  document.getElementById('formFields').style.display='block';
}

function clearForm(){
  currentType=null;
  document.querySelectorAll('.req-type').forEach(b=>b.classList.remove('sel'));
  document.querySelectorAll('.fg-group').forEach(g=>g.style.display='none');
  document.querySelectorAll('[id^="days-counter-"]').forEach(d=>d.style.display='none');
  document.getElementById('formFields').style.display='none';
  document.getElementById('obs').value='';
}

function submitRequest(){
  if(!currentType){alert('Seleccione un tipo de solicitud');return;}
  const obs=getField('obs');
  const bday=getEmpBirthday(currentUser);
  const f=typeFields[currentType];
  const ini=getField(f.ini),fin=getField(f.fin);
  if(!ini||!fin){alert('Complete las fechas de inicio y fin');return;}
  if(fin<ini){alert('La fecha fin no puede ser anterior al inicio');return;}
  const{days,excluded}=countWorkdays(ini,fin,bday);
  if(days===0){alert('El rango no contiene días hábiles.');return;}

  let details={};
  if(currentType==='vacaciones'){
    const vac=calcVac(currentUser);
    // Advertir si no hay saldo suficiente pero aun permite enviar (admin decide)
    if(days>vac.disp){
      const ok=confirm(`⚠️ Atención: tiene ${vac.disp} día(s) disponibles aprobados y solicita ${days}.\n\nPuede enviar la solicitud y RRHH la revisará.\n\n¿Desea continuar?`);
      if(!ok) return;
    }
    details={inicio:ini,fin,dias:days,turno:getField('vac-mod'),excluidos:excluded.length};
  } else if(currentType==='incapacidad'){
    details={inicio:ini,fin,dias:days,tipo:getField('inc-tipo'),medico:getField('inc-med'),turno:getField('inc-turno'),excluidos:excluded.length};
  } else if(currentType==='cumpleanos'){
    details={inicio:ini,fin,dias:days,turno:getField('cum-turno'),excluidos:excluded.length};
  } else if(currentType==='personalday'){
    const pd=calcPD(currentUser);
    const turno=getField('per-turno');
    // Media mañana o media tarde = 0.5 días, día completo = días hábiles normales
    const diasPD = (turno==='Media mañana'||turno==='Media tarde') ? 0.5 : days;
    if(pd.disp<=0){
      alert(`⚠️ Ya no tiene Personal Days disponibles este año.\nUsados: ${pd.usados} / ${pd.total}`);
      return;
    }
    if(diasPD>pd.disp){
      const ok=confirm(`⚠️ Tiene ${pd.disp} Personal Day(s) disponible(s) y solicita ${diasPD}.\n\n¿Desea continuar de todas formas?`);
      if(!ok) return;
    }
    details={inicio:ini,fin,dias:diasPD,turno,motivo:getField('per-mot'),excluidos:excluded.length};
  } else if(currentType==='singoce'){
    details={inicio:ini,fin,dias:days,turno:getField('sg-turno'),motivo:getField('sg-mot'),excluidos:excluded.length};
  }

  pendingTicket={
    id:tid(),tipo:currentType,status:'pending',
    fecha:new Date().toISOString().split('T')[0],
    cedula:currentUser.cedula,empleado:currentUser.nombre,puesto:currentUser.puesto,
    details,obs,editCount:0
  };
  showPreview(pendingTicket);
}

// ══════════════════════════════
// EMAIL
// ══════════════════════════════
function buildDet(t){
  const d=t.details||{};
  let s=`Período: ${fmt(d.inicio)} al ${fmt(d.fin)}\nDías hábiles: ${d.dias}`;
  if(d.excluidos>0) s+=` (${d.excluidos} excluido(s))`;
  if(d.turno)       s+=`\nTurno: ${d.turno}`;
  if(t.tipo==='incapacidad') s+=`\nTipo: ${d.tipo||''}\nMédico: ${d.medico||'No indicado'}`;
  if(t.tipo==='personalday') s+=`\nMotivo: ${d.motivo||''}`;
  if(t.tipo==='singoce')     s+=`\nMotivo: ${d.motivo||''}\n⚠️ No descuenta vacaciones, sí descuenta salario.`;
  return s;
}

function showPreview(t){
  document.getElementById('emailPreview').innerHTML=`
    <span class="ef">Asunto:</span> [RRHH] Nueva solicitud — ${tlabel(t.tipo)} — ${t.empleado}<br>
    <hr>
    <span class="ef">Ticket:</span> ${t.id} &nbsp;|&nbsp; <span class="ef">Fecha:</span> ${fmt(t.fecha)}<br>
    <hr>
    <span class="ef">👤</span> ${t.empleado} · ${t.cedula} · ${t.puesto}<br>
    <hr>
    <span class="ef">📋 ${tlabel(t.tipo)}</span><br><br>
    ${buildDet(t).replace(/\n/g,'<br>')}<br><br>
    <span class="ef">💬</span> ${t.obs||'Sin observaciones'}`;
  openModal('emailModal');
}

async function confirmSend(){
  closeModal('emailModal');
  const t=pendingTicket;
  showOverlay('Guardando solicitud...');
  // Guardar en Google Sheets
  const res = await callGAS({
    action:'saveTicket',
    id:t.id, cedula:t.cedula, empleado:t.empleado, puesto:t.puesto,
    tipo:t.tipo, inicio:t.details.inicio, fin:t.details.fin,
    dias:t.details.dias, turno:t.details.turno||'',
    excluidos:t.details.excluidos||0, obs:t.obs||'', motivo:t.details.motivo||''
  });
  // Recargar tickets desde Sheets
  await loadUserData(currentUser.cedula);
  // Enviar correo
  await callGAS({
    action:'sendEmail',
    to: currentUser.email,
    asunto:`[RRHH] Nueva solicitud — ${tlabel(t.tipo)} — ${t.empleado}`,
    ticket_id:t.id,empleado:t.empleado,cedula:t.cedula,puesto:t.puesto,
    tipo:tlabel(t.tipo),fecha:fmt(t.fecha),detalles:buildDet(t),
    observaciones:t.obs||'Ninguna',estado:'⏳ Pendiente de revisión',
    nota_admin:'Nueva solicitud recibida.',msg_extra:''
  });
  toast('✅ Solicitud enviada',`Ticket ${t.id} · Guardada en Sheets`);
  clearForm(); updateStats(); renderTickets(); pendingTicket=null;
}

async function callGAS(params){
  if(!GAS_URL||GAS_URL==='PEGUE_SU_URL_GAS_AQUI') return null;
  document.getElementById('sendingOverlay').classList.add('active');
  try{
    const url=`${GAS_URL}?${new URLSearchParams(params)}`;
    const res=await fetch(url);
    const data=await res.json();
    document.getElementById('sendingOverlay').classList.remove('active');
    return data;
  }catch(e){
    document.getElementById('sendingOverlay').classList.remove('active');
    return null;
  }
}

// ══════════════════════════════
// EDITAR / CANCELAR
// ══════════════════════════════
function openEdit(ticketId){
  const t=tickets.find(t=>t.id===ticketId); if(!t) return;
  editData={ticketId};
  const rem=2-(t.editCount||0);
  document.getElementById('editSubtitle').textContent=`${t.id} · ${tlabel(t.tipo)}`;
  document.getElementById('editWarning').textContent=`⚠️ Le quedan ${rem} edición(es) disponibles.`;
  document.getElementById('edit-ini').value  =t.details.inicio||'';
  document.getElementById('edit-fin').value  =t.details.fin   ||'';
  document.getElementById('edit-turno').value=t.details.turno ||'Día completo';
  document.getElementById('edit-reason').value='';
  document.getElementById('edit-days-counter').style.display='none';
  calcEditDays();
  openModal('editModal');
}

async function confirmEdit(){
  const t=tickets.find(t=>t.id===editData.ticketId); if(!t) return;
  const ini=getField('edit-ini'),fin=getField('edit-fin');
  const turno=getField('edit-turno'),reason=getField('edit-reason');
  if(!ini||!fin||fin<ini){alert('Verifique las fechas');return;}
  const bday=getEmpBirthday(currentUser);
  const{days}=countWorkdays(ini,fin,bday);
  t.details.inicio=ini; t.details.fin=fin; t.details.dias=days; t.details.turno=turno;
  t.editCount=(t.editCount||0)+1;
  t.ultimaEdicion=new Date().toISOString();
  t.motivoEdicion=reason;
  closeModal('editModal');
  // Actualizar en Google Sheets
  await callGAS({
    action:'updateTicket', id:t.id, empleado:t.empleado,
    inicio:ini, fin, dias:days, turno,
    editCount:t.editCount, ultimaEdicion:t.ultimaEdicion, motivoEdicion:reason
  });
  await loadUserData(currentUser.cedula);
  await callGAS({
    action:'sendEmail', to:currentUser.email,
    asunto:`[RRHH] Solicitud EDITADA — ${tlabel(t.tipo)} — ${t.empleado}`,
    ticket_id:t.id,empleado:t.empleado,cedula:t.cedula,puesto:t.puesto,
    tipo:tlabel(t.tipo),fecha:fmt(t.ultimaEdicion.split('T')[0]),
    detalles:buildDet(t),observaciones:t.obs||'Ninguna',
    estado:'✏️ EDITADA',nota_admin:`Motivo: ${reason||'No indicado'}`,
    msg_extra:`Edición ${t.editCount} de 2.`
  });
  toast('✏️ Editada',`${t.id} · Edición ${t.editCount}/2`);
  renderTickets(); updateStats();
}

function openCancelReq(ticketId){
  const t=tickets.find(t=>t.id===ticketId); if(!t) return;
  cancelData={ticketId};
  document.getElementById('cancelSubtitle').textContent=`${t.id} · ${tlabel(t.tipo)} · ${fmt(t.details.inicio)} → ${fmt(t.details.fin)}`;
  document.getElementById('cancelWarning').textContent='⚠️ Esta acción no se puede deshacer.';
  document.getElementById('cancel-reason').value='';
  openModal('cancelModal');
}

async function confirmCancel(){
  const t=tickets.find(t=>t.id===cancelData.ticketId); if(!t) return;
  const reason=getField('cancel-reason');
  t.status='cancelled'; t.motivoCancelacion=reason; t.fechaCancelacion=new Date().toISOString();
  closeModal('cancelModal');
  // Actualizar en Google Sheets
  await callGAS({
    action:'updateTicket', id:t.id, empleado:t.empleado,
    status:'cancelled', motivoCancelacion:reason,
    fechaCancelacion:t.fechaCancelacion
  });
  await loadUserData(currentUser.cedula);
  await callGAS({
    action:'sendEmail', to:currentUser.email,
    asunto:`[RRHH] Solicitud CANCELADA — ${tlabel(t.tipo)} — ${t.empleado}`,
    ticket_id:t.id,empleado:t.empleado,cedula:t.cedula,puesto:t.puesto,
    tipo:tlabel(t.tipo),fecha:fmt(t.fechaCancelacion.split('T')[0]),
    detalles:buildDet(t),observaciones:t.obs||'Ninguna',
    estado:'🚫 CANCELADA por el colaborador',
    nota_admin:`Motivo: ${reason||'No indicado'}`,
    msg_extra:'El colaborador canceló esta solicitud.'
  });
  toast('🚫 Cancelada',`${t.id} · Notificaciones enviadas`);
  renderTickets(); updateStats();
}

// ══════════════════════════════
// ADMIN — Solicitudes
// ══════════════════════════════
function populateEmpFilter(){
  const sel=document.getElementById('filt-emp');
  const names=[...new Set(tickets.map(t=>t.empleado))].sort();
  sel.innerHTML='<option value="">Todos los empleados</option>'+
    names.map(n=>`<option value="${n}">${n}</option>`).join('');
}

function resetFilters(){
  ['filt-status','filt-tipo','filt-emp'].forEach(id=>document.getElementById(id).value='');
  renderAdmin();
}

function renderAdmin(){
  // tickets ya cargados desde Sheets en loadAllTickets()
  const fs=document.getElementById('filt-status').value;
  const ft=document.getElementById('filt-tipo').value;
  const fe=document.getElementById('filt-emp').value;
  let list=[...tickets].reverse();
  if(fs) list=list.filter(t=>t.status===fs);
  if(ft) list=list.filter(t=>t.tipo===ft);
  if(fe) list=list.filter(t=>t.empleado===fe);

  document.getElementById('adm-pend').textContent =tickets.filter(t=>t.status==='pending').length;
  document.getElementById('adm-proc').textContent =tickets.filter(t=>t.status==='inprogress').length;
  document.getElementById('adm-apro').textContent =tickets.filter(t=>t.status==='approved').length;
  document.getElementById('adm-deny').textContent =tickets.filter(t=>t.status==='denied').length;
  document.getElementById('adm-total').textContent=tickets.length;

  const el=document.getElementById('adminList');
  if(!list.length){el.innerHTML='<div class="empty-state"><div class="empty-icon">📋</div><div>No hay solicitudes con esos filtros</div></div>';return;}
  el.innerHTML=list.map(t=>{
    const resolved=['approved','denied','cancelled'].includes(t.status);
    const emp=EMPLOYEES.find(e=>e.cedula===t.cedula);
    const vac=emp?calcVac(emp):null;
    const vi=(vac&&t.tipo==='vacaciones')
      ?`<div class="at-meta" style="color:${vac.disp<0?'var(--red)':vac.disp<=3?'var(--orange)':'var(--green)'}">💰 Saldo vacaciones: <strong>${vac.disp} días</strong></div>`:'';
    return`<div class="admin-ticket">
      <div class="at-head">
        <div>
          <div class="at-name">${t.empleado}</div>
          <div class="at-meta">${t.puesto} · <strong>${t.id}</strong> · ${fmt(t.fecha)}${emp?` · 📧 ${emp.email}`:''}</div>
          ${vi}
          ${t.tipo==='singoce'?`<div class="at-meta" style="color:var(--orange)">⚠️ Sin goce: no descuenta vacaciones, sí descuenta salario</div>`:''}
          ${t.editCount?`<div class="at-meta">✏️ Editada ${t.editCount}x</div>`:''}
          ${t.resueltoFecha?`<div class="at-meta">✔️ Resuelto: ${fmt(t.resueltoFecha.split('T')[0])}</div>`:''}
        </div>
        <div>${sbadge(t.status)}</div>
      </div>
      <div class="at-body">
        <div class="at-detail">
          <strong>${tlabel(t.tipo)}</strong><br>
          ${buildDet(t).replace(/\n/g,'<br>')}
          ${t.obs?`<br><em style="color:var(--g400)">💬 ${t.obs}</em>`:''}
          ${t.notaAdmin?`<br><span style="color:var(--b700);font-weight:600">📝 RRHH: ${t.notaAdmin}</span>`:''}
        </div>
        <div class="at-btns">
          ${!resolved?`
            <button class="btn-process" onclick="changeStatus('${t.id}','inprogress')">🔄 En Gestión</button>
            <button class="btn-approve" onclick="openResolve('${t.id}','approved')">✅ Aprobar</button>
            <button class="btn-deny"    onclick="openResolve('${t.id}','denied')">❌ Denegar</button>
          `:`<span class="resolved-stamp ${t.status==='approved'?'rs-approved':t.status==='cancelled'?'rs-cancelled':'rs-denied'}">${slabel(t.status)}</span>`}
        </div>
      </div>
    </div>`;
  }).join('');
}

async function changeStatus(ticketId,ns){
  const t=tickets.find(t=>t.id===ticketId); if(!t) return;
  await callGAS({action:'updateTicket', id:t.id, empleado:'Admin', status:ns});
  await loadAllTickets();
  renderAdmin();
  toast('🔄 Actualizado',`${t.id} → ${slabel(ns)}`);
}

function openResolve(ticketId,action){
  resolveData={ticketId,action};
  const t=tickets.find(t=>t.id===ticketId);
  const emp=EMPLOYEES.find(e=>e.cedula===t.cedula);
  const ia=action==='approved';
  document.getElementById('resolveTitle').textContent   =ia?'✅ Aprobar solicitud':'❌ Denegar solicitud';
  document.getElementById('resolveSubtitle').textContent=`${t.empleado} · ${tlabel(t.tipo)} · ${t.id}${emp?` · → ${emp.email}`:''}`;
  document.getElementById('resolveNote').value='';
  const btn=document.getElementById('resolveBtn');
  btn.textContent=ia?'✅ Confirmar aprobación':'❌ Confirmar denegación';
  btn.style.background=ia?'linear-gradient(135deg,#10B981,#059669)':'linear-gradient(135deg,#EF4444,#DC2626)';
  openModal('resolveModal');
}

async function confirmResolve(){
  const{ticketId,action}=resolveData;
  const nota=getField('resolveNote');
  const t=tickets.find(t=>t.id===ticketId); if(!t) return;
  t.status=action; t.notaAdmin=nota; t.resueltoFecha=new Date().toISOString();
  closeModal('resolveModal');
  // Actualizar en Google Sheets
  await callGAS({
    action:'updateTicket', id:t.id, empleado:'Admin',
    status:action, notaAdmin:nota, resueltoFecha:t.resueltoFecha
  });
  await loadAllTickets();
  const ia=action==='approved';
  const emp=EMPLOYEES.find(e=>e.cedula===t.cedula);
  await callGAS({
    action:'sendEmail', to:emp?emp.email:'',
    asunto:`[RRHH] ${ia?'APROBADA':'DENEGADA'} — ${tlabel(t.tipo)} — ${t.empleado}`,
    ticket_id:t.id,empleado:t.empleado,cedula:t.cedula,puesto:t.puesto,
    tipo:tlabel(t.tipo),fecha:fmt(t.resueltoFecha.split('T')[0]),
    detalles:buildDet(t),observaciones:t.obs||'Ninguna',
    estado:ia?'✅ APROBADA':'❌ DENEGADA',
    nota_admin:nota||(ia?'Solicitud aprobada.':'Solicitud denegada.'),
    msg_extra:ia?'Su solicitud fue aprobada.':'Su solicitud fue denegada. Contacte a RRHH.'
  });
  toast(ia?'✅ Aprobada':'❌ Denegada',`${t.id} · Notificaciones enviadas`);
  renderAdmin();
}

// ══════════════════════════════
// ADMIN — Expedientes
// ══════════════════════════════
async function loadExpAdmin(){
  const cedula=getField('expEmpSelect'); if(!cedula){alert('Seleccione un colaborador');return;}
  const emp=EMPLOYEES.find(e=>e.cedula===cedula); if(!emp) return;
  showOverlay('Cargando expediente...');
  const resE = await gasGet({action:'getExpediente', cedula});
  if(resE && resE.ok && resE.data) { expedientes[cedula] = resE.data; saveExp(); }
  hideOverlay();
  const exp=expedientes[cedula]||{};
  document.getElementById('expAdminForm').style.display='block';
  document.getElementById('expAdminName').textContent=`✏️ Editando: ${emp.nombre}`;
  const set=(id,val)=>{const el=document.getElementById(id);if(el)el.value=val||'';};
  set('exp-cedula',cedula);
  set('exp-nombres',  exp.nombres  ||emp.nombre.split(' ').slice(0,2).join(' '));
  set('exp-ap1',      exp.ap1      ||emp.nombre.split(' ').slice(2,3).join(''));
  set('exp-ap2',      exp.ap2      ||emp.nombre.split(' ').slice(3,4).join(''));
  set('exp-genero',   exp.genero   ||'');
  set('exp-fnac',     exp.fnac     ||'');
  set('exp-nac',      exp.nac      ||'Costarricense');
  set('exp-pais',     exp.pais     ||'Costa Rica');
  set('exp-civil',    exp.civil    ||'');
  set('exp-hijos',    exp.hijos    ||'');
  set('exp-prov',     exp.prov     ||'');
  set('exp-canton',   exp.canton   ||'');
  set('exp-distrito', exp.distrito ||'');
  set('exp-direccion',exp.direccion||'');
  set('exp-tel',      exp.tel      ||'');
  set('exp-emailpers',exp.emailpers||'');
  set('exp-emerg-nom',exp.emergNom ||'');
  set('exp-emerg-tel',exp.emergTel ||'');
  set('exp-iban',     exp.iban     ||'');
  set('exp-salario',  exp.salario  ||'');
  set('exp-profesion',exp.profesion||emp.puesto);
  set('exp-estudios', exp.estudios ||'');
  set('exp-meds',     exp.meds     ||'');
  set('exp-alergias', exp.alergias ||'');
  document.getElementById('expAdminForm').scrollIntoView({behavior:'smooth',block:'start'});
}

async function saveExpAdmin(){
  const cedula=getField('exp-cedula'); if(!cedula) return;
  expedientes[cedula]={
    nombres:   getField('exp-nombres'),  ap1:      getField('exp-ap1'),
    ap2:       getField('exp-ap2'),      genero:   getField('exp-genero'),
    fnac:      getField('exp-fnac'),     nac:      getField('exp-nac'),
    pais:      getField('exp-pais'),     civil:    getField('exp-civil'),
    hijos:     getField('exp-hijos'),    prov:     getField('exp-prov'),
    canton:    getField('exp-canton'),   distrito: getField('exp-distrito'),
    direccion: getField('exp-direccion'),tel:      getField('exp-tel'),
    emailpers: getField('exp-emailpers'),emergNom: getField('exp-emerg-nom'),
    emergTel:  getField('exp-emerg-tel'),iban:     getField('exp-iban'),
    salario:   getField('exp-salario'),
    profesion: getField('exp-profesion'),estudios: getField('exp-estudios'),
    meds:      getField('exp-meds'),     alergias: getField('exp-alergias'),
    updatedAt: new Date().toISOString()
  };
  saveExp();
  // Guardar en Google Sheets y confirmar
  showOverlay('Guardando expediente...');
  await callGAS({action:'saveExpediente',...expedientes[cedula],cedula});
  hideOverlay();
  toast('💾 Expediente guardado',`${EMPLOYEES.find(e=>e.cedula===cedula)?.nombre||cedula}`);
  document.getElementById('expAdminForm').style.display='none';
  document.getElementById('expEmpSelect').value='';
}

// ══════════════════════════════
// EMPLOYEE — Expediente view
// ══════════════════════════════
function renderExpView(){
  if(!currentUser) return;
  const exp=expedientes[currentUser.cedula];
  const el=document.getElementById('expView');
  if(!exp||Object.keys(exp).length===0){
    el.innerHTML=`<div class="exp-empty"><div class="exp-icon">📋</div><p>Su expediente aún no ha sido completado por RRHH.<br>Contacte a su administrador.</p></div>`;
    return;
  }
  const field=(label,val)=>`<div class="exp-field"><div class="exp-field-label">${label}</div><div class="exp-field-val ${!val?'empty':''}">${val||'No registrado'}</div></div>`;
  el.innerHTML=`
    <div class="section-header"><div class="sh-icon">👤</div><h3>Datos Personales</h3></div>
    <div class="exp-grid">
      ${field('Nombre(s)',exp.nombres)}${field('Primer Apellido',exp.ap1)}
      ${field('Segundo Apellido',exp.ap2)}${field('Género',exp.genero)}
      ${field('Cédula',currentUser.cedula)}${field('Fecha Nacimiento',exp.fnac)}
      ${field('Nacionalidad',exp.nac)}${field('País de Nacimiento',exp.pais)}
      ${field('Estado Civil',exp.civil)}${field('Número de Hijos',exp.hijos)}
    </div>
    <div class="section-header"><div class="sh-icon">📍</div><h3>Dirección</h3></div>
    <div class="exp-grid">
      ${field('Provincia',exp.prov)}${field('Cantón',exp.canton)}${field('Distrito',exp.distrito)}
    </div>
    <div class="exp-field" style="margin-top:12px"><div class="exp-field-label">Dirección Exacta</div><div class="exp-field-val ${!exp.direccion?'empty':''}">${exp.direccion||'No registrado'}</div></div>
    <div class="section-header"><div class="sh-icon">📞</div><h3>Contacto</h3></div>
    <div class="exp-grid">
      ${field('Teléfono',exp.tel)}${field('Correo Personal',exp.emailpers)}
      ${field('Contacto Emergencia',exp.emergNom)}${field('Tel. Emergencia',exp.emergTel)}
    </div>
    <div class="section-header"><div class="sh-icon">🏦</div><h3>Bancario y Laboral</h3></div>
    <div class="exp-grid">
      ${field('IBAN',exp.iban)}${field('Profesión',exp.profesion)}${field('Otros Estudios',exp.estudios)}
    </div>
    <div class="section-header"><div class="sh-icon">🏥</div><h3>Médico</h3></div>
    <div class="exp-grid">${field('Medicamentos',exp.meds)}${field('Alergias',exp.alergias)}</div>
    <p style="font-size:11px;color:var(--g400);margin-top:14px;text-align:right">Última actualización: ${exp.updatedAt?fmt(exp.updatedAt.split('T')[0]):'—'}</p>`;
}

// ══════════════════════════════
// MIS SOLICITUDES — con filtro año y descarga
// ══════════════════════════════
function renderTickets(){
  if(!currentUser) return;
  // tickets ya cargados desde Sheets
  const mine=tickets.filter(t=>t.cedula===currentUser.cedula);

  // Poblar filtro de años
  const years=[...new Set(mine.map(t=>t.fecha.split('-')[0]))].sort().reverse();
  const yearSel=document.getElementById('filt-year');
  if(yearSel){
    const cur=yearSel.value;
    yearSel.innerHTML='<option value="">Todos los años</option>'+years.map(y=>`<option value="${y}" ${y===cur?'selected':''}>${y}</option>`).join('');
  }

  // Aplicar filtros
  const fy=yearSel?yearSel.value:'';
  const ft=document.getElementById('filt-tipo-emp')?document.getElementById('filt-tipo-emp').value:'';
  let filtered=[...mine].reverse();
  if(fy) filtered=filtered.filter(t=>t.fecha.startsWith(fy));
  if(ft) filtered=filtered.filter(t=>t.tipo===ft);

  const el=document.getElementById('ticketsList');
  if(!filtered.length){
    el.innerHTML='<div class="empty-state"><div class="empty-icon">📋</div><div>No hay solicitudes con esos filtros</div></div>';
    return;
  }

  el.innerHTML=filtered.map(t=>{
    const canEdit  =['pending','inprogress'].includes(t.status)&&(t.editCount||0)<2;
    const canCancel=['pending','inprogress'].includes(t.status);
    const edits=t.editCount||0;
    return`<div class="ticket">
      <div class="ticket-top">
        <div>
          <div class="ticket-header">
            <input type="checkbox" class="ticket-check" value="${t.id}" onchange="toggleTicketSelect('${t.id}',this.checked)" style="margin-right:4px;cursor:pointer;">
            <span class="tid">${t.id}</span>
            <span class="ttype">${tlabel(t.tipo)}</span>
            ${edits>0?`<span class="edit-counter">✏️ ${edits}/2</span>`:''}
          </div>
          <div class="tdesc">
            📅 ${fmt(t.details.inicio)} → ${fmt(t.details.fin)}
            &nbsp;·&nbsp; <strong>${t.details.dias} día(s)</strong>
            &nbsp;·&nbsp; ${t.details.turno||'Día completo'}
            ${t.details.excluidos>0?`<span style="color:var(--orange);font-size:10px"> · ${t.details.excluidos} excluido(s)</span>`:''}
          </div>
          ${t.notaAdmin?`<div class="tdesc" style="color:var(--b700)">📝 RRHH: <em>${t.notaAdmin}</em></div>`:''}
          ${t.obs?`<div class="tdesc" style="font-style:italic;color:var(--g400)">💬 ${t.obs}</div>`:''}
          ${t.motivoCancelacion?`<div class="tdesc" style="color:var(--red)">🚫 ${t.motivoCancelacion}</div>`:''}
        </div>
        <div style="display:flex;flex-direction:column;align-items:flex-end;gap:4px">
          ${sbadge(t.status)}
          <div style="font-size:10px;color:var(--g400)">${fmt(t.fecha)}</div>
          ${t.resueltoFecha?`<div style="font-size:10px;color:var(--green)">✔ ${fmt(t.resueltoFecha.split('T')[0])}</div>`:''}
        </div>
      </div>
      ${(canEdit||canCancel)?`<div class="ticket-actions">
        ${canEdit  ?`<button class="btn-edit"       onclick="openEdit('${t.id}')">✏️ Editar (${2-edits} restante${2-edits===1?'':'s'})</button>`:''}
        ${canCancel?`<button class="btn-cancel-req" onclick="openCancelReq('${t.id}')">🚫 Cancelar</button>`:''}
      </div>`:''}
    </div>`;
  }).join('');
}

function toggleTicketSelect(id,checked){
  checked?selectedTickets.add(id):selectedTickets.delete(id);
  document.getElementById('selCount').textContent=selectedTickets.size>0?`${selectedTickets.size} seleccionada(s)`:'';
}

function selectAllTickets(){
  document.querySelectorAll('.ticket-check').forEach(cb=>{cb.checked=true;selectedTickets.add(cb.value);});
  document.getElementById('selCount').textContent=`${selectedTickets.size} seleccionada(s)`;
}

function downloadSelectedPDF(){
  const ids=selectedTickets.size>0?[...selectedTickets]:tickets.filter(t=>t.cedula===currentUser.cedula).map(t=>t.id);
  const sel=tickets.filter(t=>ids.includes(t.id));
  if(!sel.length){alert('No hay solicitudes para descargar');return;}
  downloadTicketsPDF(sel,`Mis Solicitudes — ${currentUser.nombre}`);
}

function downloadSelectedCSV(){
  const ids=selectedTickets.size>0?[...selectedTickets]:tickets.filter(t=>t.cedula===currentUser.cedula).map(t=>t.id);
  const sel=tickets.filter(t=>ids.includes(t.id));
  if(!sel.length){alert('No hay solicitudes para descargar');return;}
  downloadTicketsCSV(sel,`solicitudes_${currentUser.cedula}`);
}

// ══════════════════════════════
// HISTORIAL COMPLETO (nueva pestaña)
// ══════════════════════════════
function renderFullHistory(){
  if(!currentUser) return;
  // tickets ya cargados desde Sheets
  const mine=tickets.filter(t=>t.cedula===currentUser.cedula);

  const total     =mine.length;
  const aprobadas =mine.filter(t=>t.status==='approved').length;
  const denegadas =mine.filter(t=>t.status==='denied').length;
  const canceladas=mine.filter(t=>t.status==='cancelled').length;
  const editadas  =mine.filter(t=>(t.editCount||0)>0).length;
  const pendientes=mine.filter(t=>['pending','inprogress'].includes(t.status)).length;
  const diasUsados=mine.filter(t=>t.status==='approved'&&t.tipo==='vacaciones').reduce((s,t)=>s+(t.details.dias||0),0);

  const el=document.getElementById('historialCompleto');
  el.innerHTML=`
    <!-- Resumen estadístico -->
    <div class="stats-grid" style="margin-bottom:20px">
      <div class="stat-card"><div class="stat-icon si-blue">📋</div><div><div class="stat-val">${total}</div><div class="stat-lbl">Total solicitudes</div></div></div>
      <div class="stat-card"><div class="stat-icon si-green">✅</div><div><div class="stat-val">${aprobadas}</div><div class="stat-lbl">Aprobadas</div></div></div>
      <div class="stat-card"><div class="stat-icon si-red">❌</div><div><div class="stat-val">${denegadas}</div><div class="stat-lbl">Denegadas</div></div></div>
      <div class="stat-card"><div class="stat-icon si-yellow">🚫</div><div><div class="stat-val">${canceladas}</div><div class="stat-lbl">Canceladas</div></div></div>
      <div class="stat-card"><div class="stat-icon si-orange">✏️</div><div><div class="stat-val">${editadas}</div><div class="stat-lbl">Con ediciones</div></div></div>
      <div class="stat-card"><div class="stat-icon si-blue">🏖️</div><div><div class="stat-val">${diasUsados}</div><div class="stat-lbl">Días vacaciones aprobados</div></div></div>
    </div>

    <!-- Desglose por tipo -->
    <div class="card" style="margin-bottom:14px">
      <h3 class="card-title" style="font-size:16px">📊 Desglose por tipo</h3>
      <table style="width:100%;border-collapse:collapse;font-size:13px;margin-top:10px">
        <thead><tr style="background:var(--b50)">
          <th style="padding:8px 12px;text-align:left;border-bottom:2px solid var(--b200)">Tipo</th>
          <th style="padding:8px 12px;text-align:center;border-bottom:2px solid var(--b200)">Total</th>
          <th style="padding:8px 12px;text-align:center;border-bottom:2px solid var(--b200)">Aprobadas</th>
          <th style="padding:8px 12px;text-align:center;border-bottom:2px solid var(--b200)">Denegadas</th>
          <th style="padding:8px 12px;text-align:center;border-bottom:2px solid var(--b200)">Canceladas</th>
          <th style="padding:8px 12px;text-align:center;border-bottom:2px solid var(--b200)">Días</th>
        </tr></thead>
        <tbody>
          ${['vacaciones','incapacidad','cumpleanos','personalday','singoce'].map(tipo=>{
            const sub=mine.filter(t=>t.tipo===tipo);
            if(!sub.length) return '';
            const dias=sub.filter(t=>t.status==='approved').reduce((s,t)=>s+(t.details.dias||0),0);
            return`<tr style="border-bottom:1px solid var(--b100)">
              <td style="padding:8px 12px">${tlabel(tipo)}</td>
              <td style="padding:8px 12px;text-align:center;font-weight:600">${sub.length}</td>
              <td style="padding:8px 12px;text-align:center;color:var(--green)">${sub.filter(t=>t.status==='approved').length}</td>
              <td style="padding:8px 12px;text-align:center;color:var(--red)">${sub.filter(t=>t.status==='denied').length}</td>
              <td style="padding:8px 12px;text-align:center;color:var(--g400)">${sub.filter(t=>t.status==='cancelled').length}</td>
              <td style="padding:8px 12px;text-align:center;color:var(--b700)">${dias>0?dias:'—'}</td>
            </tr>`;
          }).join('')}
        </tbody>
      </table>
    </div>

    <!-- Línea de tiempo -->
    <div class="card">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:14px;flex-wrap:wrap;gap:8px">
        <h3 class="card-title" style="font-size:16px;margin:0">🕐 Línea de tiempo completa</h3>
        <div style="display:flex;gap:8px">
          <button class="btn-submit" onclick="downloadHistoryPDF()" style="font-size:12px;padding:8px 14px">📄 Descargar PDF</button>
          <button class="btn-sec"    onclick="downloadHistoryCSV()" style="font-size:12px;padding:8px 14px">📊 Descargar CSV</button>
        </div>
      </div>
      <div style="position:relative;padding-left:24px;border-left:3px solid var(--b200)">
        ${[...mine].reverse().map(t=>`
          <div style="position:relative;margin-bottom:20px;padding-left:16px">
            <div style="position:absolute;left:-28px;top:2px;width:12px;height:12px;border-radius:50%;
              background:${t.status==='approved'?'var(--green)':t.status==='denied'?'var(--red)':t.status==='cancelled'?'var(--g400)':'var(--b500)'};
              border:2px solid white;box-shadow:0 0 0 2px ${t.status==='approved'?'var(--green)':t.status==='denied'?'var(--red)':t.status==='cancelled'?'var(--g400)':'var(--b500)'}"></div>
            <div style="font-size:11px;color:var(--g400);margin-bottom:3px">${fmt(t.fecha)} ${t.resueltoFecha?'→ Resuelto: '+fmt(t.resueltoFecha.split('T')[0]):''}</div>
            <div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap">
              <span style="font-weight:600;font-size:13px">${tlabel(t.tipo)}</span>
              <span style="font-size:10px;color:var(--b500);font-weight:700">${t.id}</span>
              ${sbadge(t.status)}
              ${t.editCount>0?`<span class="edit-counter">✏️ editada ${t.editCount}x</span>`:''}
            </div>
            <div style="font-size:12px;color:var(--g600);margin-top:3px">
              📅 ${fmt(t.details.inicio)} → ${fmt(t.details.fin)} · <strong>${t.details.dias} días hábiles</strong>
              ${t.details.turno?` · ${t.details.turno}`:''}
            </div>
            ${t.notaAdmin?`<div style="font-size:11px;color:var(--b700);margin-top:2px">📝 RRHH: ${t.notaAdmin}</div>`:''}
            ${t.motivoCancelacion?`<div style="font-size:11px;color:var(--red);margin-top:2px">🚫 ${t.motivoCancelacion}</div>`:''}
            ${t.motivoEdicion?`<div style="font-size:11px;color:var(--orange);margin-top:2px">✏️ Motivo edición: ${t.motivoEdicion}</div>`:''}
          </div>`).join('')}
      </div>
    </div>`;
}

// ══════════════════════════════
// DESCARGAS — PDF y CSV
// ══════════════════════════════
function downloadTicketsPDF(list, titulo){
  const rows=list.map(t=>`
    <tr style="border-bottom:1px solid #e2e8f0">
      <td style="padding:8px;font-size:12px">${t.id}</td>
      <td style="padding:8px;font-size:12px">${tlabel(t.tipo)}</td>
      <td style="padding:8px;font-size:12px">${fmt(t.details.inicio)} → ${fmt(t.details.fin)}</td>
      <td style="padding:8px;font-size:12px;text-align:center">${t.details.dias}</td>
      <td style="padding:8px;font-size:12px">${slabel(t.status)}</td>
      <td style="padding:8px;font-size:12px">${fmt(t.fecha)}</td>
      <td style="padding:8px;font-size:12px">${t.notaAdmin||'—'}</td>
    </tr>`).join('');

  const html=`<!DOCTYPE html><html><head><meta charset="UTF-8"/>
  <style>body{font-family:Arial,sans-serif;padding:32px;color:#1e293b}
  h1{color:#1D4ED8;font-size:20px} h2{color:#475569;font-size:14px;font-weight:400;margin-top:4px}
  table{width:100%;border-collapse:collapse;margin-top:20px}
  th{background:#1D4ED8;color:white;padding:10px 8px;font-size:12px;text-align:left}
  tr:nth-child(even){background:#f8fafc}
  .footer{margin-top:32px;font-size:10px;color:#94a3b8;text-align:center}
  </style></head><body>
  <h1>🏢 Lean Consulting S.A. — Portal RRHH</h1>
  <h2>${titulo}</h2>
  <div style="font-size:12px;color:#94a3b8">Generado: ${new Date().toLocaleDateString('es-CR')} · Total: ${list.length} solicitud(es)</div>
  <table><thead><tr>
    <th>Ticket</th><th>Tipo</th><th>Período</th><th>Días</th><th>Estado</th><th>Fecha solicitud</th><th>Nota RRHH</th>
  </tr></thead><tbody>${rows}</tbody></table>
  <div class="footer">© 2026 Lean Consulting S.A. — Portal de Recursos Humanos — Documento generado automáticamente</div>
  </body></html>`;

  const w=window.open('','_blank');
  w.document.write(html);
  w.document.close();
  w.print();
}

function downloadTicketsCSV(list, filename){
  const header='Ticket,Tipo,Empleado,Puesto,Inicio,Fin,Días,Turno,Estado,Fecha solicitud,Nota RRHH,Observaciones\n';
  const rows=list.map(t=>[
    t.id, tlabel(t.tipo), t.empleado, t.puesto,
    t.details.inicio, t.details.fin, t.details.dias, t.details.turno||'',
    slabel(t.status), t.fecha, t.notaAdmin||'', t.obs||''
  ].map(v=>`"${String(v).replace(/"/g,'""')}"`).join(',')).join('\n');
  const blob=new Blob(['\uFEFF'+header+rows],{type:'text/csv;charset=utf-8'});
  const a=document.createElement('a'); a.href=URL.createObjectURL(blob);
  a.download=`${filename}_${new Date().toISOString().split('T')[0]}.csv`;
  a.click();
}

function downloadHistoryPDF(){
  const mine=tickets.filter(t=>t.cedula===currentUser.cedula);
  downloadTicketsPDF(mine,`Historial completo — ${currentUser.nombre}`);
}

function downloadHistoryCSV(){
  const mine=tickets.filter(t=>t.cedula===currentUser.cedula);
  downloadTicketsCSV(mine,`historial_${currentUser.cedula}`);
}

// ══════════════════════════════
// DESGLOSE VACACIONES
// ══════════════════════════════
function updateStats(){
  if(!currentUser) return;
  // tickets ya cargados desde Sheets
  const mine=tickets.filter(t=>t.cedula===currentUser.cedula);
  const vac=calcVac(currentUser);
  const pd =calcPD(currentUser);
  const dEl=document.getElementById('statVac');
  dEl.textContent=vac.disp<0?vac.disp+' ⚠️':vac.disp;
  dEl.style.color=vac.disp<0?'var(--red)':vac.disp<=3?'var(--orange)':'var(--g800)';
  document.getElementById('statApro').textContent=mine.filter(t=>t.status==='approved').length;
  document.getElementById('statPend').textContent=mine.filter(t=>['pending','inprogress'].includes(t.status)).length;
  // Personal Days
  const pdEl=document.getElementById('statPD');
  if(pdEl){
    pdEl.textContent=pd.disp<=0?'0 ⚠️':pd.disp;
    pdEl.style.color=pd.disp<=0?'var(--red)':pd.disp===1?'var(--orange)':'var(--g800)';
  }
}

function updateVacTab(){
  if(!currentUser) return;
  const v=calcVac(currentUser);
  const pd=calcPD(currentUser);

  // Vacaciones
  document.getElementById('vacIngreso').textContent=fmt(currentUser.ingreso);
  document.getElementById('vacMeses').textContent=v.meses;
  document.getElementById('vacAcum').textContent=v.acum;
  document.getElementById('vacCons').textContent=v.usados;
  const dEl=document.getElementById('vacDisp');
  dEl.textContent=v.disp<0?v.disp+' ⚠️':v.disp;
  dEl.style.color=v.disp<0?'var(--red)':v.disp<=3?'var(--orange)':'var(--green)';
  const prog=document.getElementById('vacProg');
  prog.style.width=v.pct+'%';
  prog.style.background=v.pct>=100?'linear-gradient(90deg,var(--orange),var(--red))':
    v.pct>=80?'linear-gradient(90deg,var(--orange),#F59E0B)':'linear-gradient(90deg,var(--b400),var(--b600))';
  document.getElementById('vacProx').textContent=fmt(v.prox);

  // Personal Days
  const pdTotalEl =document.getElementById('pdTotal');
  const pdUsadosEl=document.getElementById('pdUsados');
  const pdDispEl  =document.getElementById('pdDisp');
  if(pdTotalEl)  pdTotalEl.textContent=pd.total;
  if(pdUsadosEl) pdUsadosEl.textContent=pd.usados;
  if(pdDispEl){
    pdDispEl.textContent=pd.disp<=0?'0 ⚠️':pd.disp;
    pdDispEl.style.color=pd.disp<=0?'var(--red)':pd.disp===1?'var(--orange)':'var(--green)';
  }
  // Aviso vencimiento — aplica para todos (PD no acumulables, vencen 31/12)
  const venceMsg=document.getElementById('pdVenceMsg');
  if(venceMsg){
    venceMsg.style.display='block';
    const dispTxt = pd.disp <= 0
      ? `Ya utilizó todos sus Personal Days de ${pd.anio}.`
      : `Tiene <strong>${pd.disp}</strong> Personal Day(s) disponible(s). Vencen el <strong>31/12/${pd.anio}</strong> — no son acumulables.`;
    venceMsg.innerHTML = `⚠️ ${dispTxt}`;
  }
}

// ══════════════════════════════
// MODALS & TOAST
// ══════════════════════════════
function openModal(id) {document.getElementById(id).classList.add('active');}
function closeModal(id){document.getElementById(id).classList.remove('active');}

function toast(title,msg){
  document.getElementById('toastTitle').textContent=title;
  document.getElementById('toastMsg').textContent=msg;
  const el=document.getElementById('toast');
  el.style.display='block';
  clearTimeout(window._toastTimer);
  window._toastTimer=setTimeout(()=>el.style.display='none',5500);
}