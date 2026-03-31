/* ══════════════════════════════════════════
   Portal RRHH — Lean Consulting S.A.
   JavaScript principal
   ══════════════════════════════════════════ */

// ── CONFIG — pegue aquí su URL del GAS ──
const GAS_URL = 'https://script.google.com/macros/s/AKfycbyjKE7f4DXlVxBOmZHK6vGSYWQhONQgJkzuB-JslWP_89v-xhyuP74AjDYt8QiKC94w/exec';

// ── CONFIG NOTIFICACIONES ──
// Para cambiar los correos mostrados en el modal de resolución,
// edite este valor (solo afecta el texto informativo visible al admin).
const RRHH_EMAILS_LABEL = 'kfernandez, cfernandez';

// ── CACHE CON TTL ──
const CACHE_TTL = 5 * 60 * 1000; // 5 minutos

function saveCache(key, data) {
  try {
    localStorage.setItem(key, JSON.stringify({ data, ts: Date.now() }));
  } catch(e) { /* quota excedida — ignorar */ }
}

function getCache(key) {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    const item = JSON.parse(raw);
    // Compatibilidad con formato antiguo (sin envelope TTL)
    if (!item || typeof item !== 'object' || !('ts' in item) || !('data' in item)) return null;
    if (Date.now() - item.ts > CACHE_TTL) { localStorage.removeItem(key); return null; }
    return item.data;
  } catch(e) { return null; }
}

function clearCache() {
  // Elimina todas las claves del portal (incluye claves por usuario)
  Object.keys(localStorage)
    .filter(k => k.startsWith('hr_'))
    .forEach(k => localStorage.removeItem(k));
}

// ── PROTECCIÓN XSS — escapa caracteres HTML en datos externos ──
function escHTML(s) {
  return String(s == null ? '' : s)
    .replace(/&/g,'&amp;')
    .replace(/</g,'&lt;')
    .replace(/>/g,'&gt;')
    .replace(/"/g,'&quot;')
    .replace(/'/g,'&#39;');
}

// ── VALIDACIÓN DE INPUTS ──
function validateCedula(v) {
  const clean = String(v).replace(/[-.\s]/g,'');
  return /^\d{8,12}$/.test(clean);
}

function sanitizeText(v) {
  return String(v).replace(/<[^>]*>/g,'').trim();
}

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

// ── EMPLOYEES — cargado dinámicamente desde Google Sheets ──
let EMPLOYEES = []; // se llena al iniciar el portal

function _mapEmployees(data) {
  return data.map(e => ({
    cedula:    String(e.cedula),
    nombre:    e.nombre,
    puesto:    e.puesto    || '',
    ingreso:   e.ingreso   || '',
    consumidos:parseFloat(e.consumidos)||0,
    email:     e.email     || '',
    emailcorp: e.emailcorp || e.email || '',
    pdTotal:   parseFloat(e.pdTotal)||3,
    pdUsados:  parseFloat(e.pdUsados)||0,
    pdAnio:    parseInt(e.pdAnio)||new Date().getFullYear(),
    acceso:    e.acceso    || 'activo',
  }));
}

async function loadEmployees() {
  const cached = getCache('hr_employees');
  if (cached && cached.length > 0) {
    EMPLOYEES = cached;
    // Actualizar desde GAS en segundo plano sin bloquear
    gasGet({action:'getEmpleados'}).then(res => {
      if (res && res.ok && res.data && res.data.length > 0) {
        EMPLOYEES = _mapEmployees(res.data);
        saveCache('hr_employees', EMPLOYEES);
      }
    });
    return;
  }
  // Sin caché — esperar respuesta de GAS
  const res = await gasGet({action:'getEmpleados'});
  if (res && res.ok && res.data && res.data.length > 0) {
    EMPLOYEES = _mapEmployees(res.data);
    saveCache('hr_employees', EMPLOYEES);
  }
}

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
const tlabel     = t => ({vacaciones:'Vacaciones',incapacidad:'Incapacidad',cumpleanos:'Cumpleaños',personalday:'Personal Day',singoce:'Día Sin Goce'}[t]||t);
const tlabelText = t => ({vacaciones:'Vacaciones',incapacidad:'Incapacidad',cumpleanos:'Cumpleanos',personalday:'Personal Day',singoce:'Sin Goce'}[t]||t);
const slabel = s => ({pending:'En Proceso',inprogress:'En Gestión',approved:'Aprobada',denied:'Denegada',cancelled:'Cancelada'}[s]||s);
const sbadge = s => `<span class="sb ${s||'pending'}">${slabel(s)}</span>`;
// Guarda en caché local — clave por usuario para evitar colisiones en PC compartidas
const save    = () => {
  const key = currentUser ? `hr_tickets_${currentUser.cedula}` : 'hr_tickets_all';
  saveCache(key, tickets);
};
const saveExp = () => {
  // No se cachean campos sensibles (IBAN, salario, datos médicos)
  if(!currentUser) return;
  const exp = expedientes[currentUser.cedula];
  if(!exp) return;
  const safe = Object.assign({}, exp);
  ['iban','salario','meds','alergias'].forEach(f => delete safe[f]);
  saveCache(`hr_expedientes_${currentUser.cedula}`, safe);
};

// ── GAS API ──
// gasGet: lectura silenciosa (sin overlay) — delega a callGAS
async function gasGet(params) {
  return callGAS(params, true);
}
const getField = (id,def='') => { const el=document.getElementById(id); return el?el.value:def; };
const fmtMoney = v => v ? '₡ '+parseFloat(v).toLocaleString('es-CR') : '—';

function getEmpBirthday(emp){
  const exp=expedientes[emp.cedula]; return exp?(exp.fnac||''):'';
}

function calcVac(emp){
  const hoy=new Date(),ini=parseDate(emp.ingreso)||new Date();
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

// ── PARSER DE FECHAS — soporta YYYY-MM-DD y DD/MM/YYYY (formato del Sheet) ──
function parseDate(dateStr) {
  if (!dateStr) return null;
  if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) return new Date(dateStr + 'T12:00:00');
  if (/^\d{2}\/\d{2}\/\d{4}$/.test(dateStr)) {
    const [day, month, year] = dateStr.split('/');
    return new Date(`${year}-${month}-${day}T12:00:00`);
  }
  const d = new Date(dateStr);
  return isNaN(d.getTime()) ? null : d;
}

// ── FECHA LARGA EN ESPAÑOL ──
function fmtLong(dateStr) {
  if (!dateStr) return '—';
  const d = parseDate(dateStr);
  if (!d || isNaN(d.getTime())) return dateStr || '—';
  const dias   = ['Domingo','Lunes','Martes','Miércoles','Jueves','Viernes','Sábado'];
  const meses  = ['enero','febrero','marzo','abril','mayo','junio','julio','agosto','septiembre','octubre','noviembre','diciembre'];
  return `${dias[d.getDay()]} ${d.getDate()} de ${meses[d.getMonth()]} del ${d.getFullYear()}`;
}

// ── DÍA DE CUMPLEAÑOS ──
// 1 día por año · Se descuenta al aprobar solicitud de tipo 'cumpleanos'
function calcBirthday(emp) {
  const anio = new Date().getFullYear();
  const used = tickets
    .filter(t => t.cedula === emp.cedula && t.tipo === 'cumpleanos' && t.status === 'approved')
    // Usar la fecha del día tomado (details.inicio), no la fecha de envío de la solicitud
    .filter(t => t.details && t.details.inicio && t.details.inicio.startsWith(String(anio)))
    .reduce((s, t) => s + (parseFloat(t.details.dias) || 1), 0);
  const disp = Math.max(0, 1 - used);
  return { total: 1, used, disp };
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
    saveCache(`hr_tickets_${cedula}`, tickets);
  } else {
    tickets = (getCache(`hr_tickets_${cedula}`) || []).filter(t=>t.cedula===cedula);
  }
  // Cargar expediente — no se cachean campos sensibles (IBAN, salario, médico)
  const resE = await gasGet({action:'getExpediente', cedula});
  if(resE && resE.ok && resE.data) {
    expedientes[cedula] = resE.data;
    const safe = Object.assign({}, resE.data);
    ['iban','salario','meds','alergias'].forEach(f => delete safe[f]);
    saveCache(`hr_expedientes_${cedula}`, safe);
  } else {
    const cached = getCache(`hr_expedientes_${cedula}`);
    if(cached) expedientes[cedula] = cached;
  }
  hideOverlay();
}

async function loadAllTickets() {
  showOverlay('Cargando solicitudes...');
  const resT = await gasGet({action:'getTickets'});
  if(resT && resT.ok && resT.data) {
    tickets = resT.data.map(parseTicket);
    saveCache('hr_tickets_all', tickets);
  } else {
    tickets = getCache('hr_tickets_all') || [];
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
  if(EMPLOYEES.length===0) await loadEmployees();
  const raw=document.getElementById('cedulaInput').value.trim();
  const v=raw.replace(/[-.\s]/g,'');
  const err=document.getElementById('loginError');
  if(!validateCedula(v)){err.style.display='block';err.textContent='Ingrese una cédula válida (8–12 dígitos).';return;}
  const emp=EMPLOYEES.find(e=>e.cedula===v);
  if(!emp){err.style.display='block';err.textContent='Cédula no encontrada. Verifique el número ingresado.';return;}
  if(emp.acceso==='inactivo'){err.style.display='block';err.textContent='Su acceso al portal ha sido deshabilitado. Contacte a RRHH.';return;}
  err.style.display='none';
  currentUser=emp; isAdmin=false;
  sessionStorage.setItem('hr_session', JSON.stringify({cedula: emp.cedula}));
  show('appScreen');
  document.getElementById('userName').textContent  =emp.nombre.split(' ').slice(0,2).join(' ');
  document.getElementById('userCedula').textContent='Cédula: '+emp.cedula;
  document.getElementById('userAvatar').textContent=emp.nombre[0];
  // Si hay caché del usuario, mostrar pantalla de inmediato
  const cachedTickets = getCache(`hr_tickets_${emp.cedula}`);
  if (cachedTickets) {
    tickets = cachedTickets;
    const cachedExp = getCache(`hr_expedientes_${emp.cedula}`);
    if (cachedExp) expedientes[emp.cedula] = cachedExp;
    updateStats(); renderTickets(); updateVacTab(); renderExpView();
    // Actualizar desde GAS en segundo plano sin bloquear la UI
    loadUserData(emp.cedula).then(() => {
      updateStats(); renderTickets(); updateVacTab(); renderExpView();
    });
  } else {
    // Primera vez o caché expirado — esperar GAS
    await loadUserData(emp.cedula);
    updateStats(); renderTickets(); updateVacTab(); renderExpView();
  }
}

async function doAdminLogin(){
  const u   = document.getElementById('adminUser').value.trim();
  const p   = document.getElementById('adminPass').value;
  const err = document.getElementById('loginError');
  err.style.display = 'none';

  // Validar contra GAS — única fuente de verdad
  if(GAS_URL){
    const res = await callGAS({action:'authAdmin', user:u, pass:p}, true);
    if(res && res.ok){ initAdmin(); return; }
    if(!res){
      // GAS no respondió (timeout, red caída)
      err.style.display='block';
      err.textContent='No se pudo conectar al servidor. Verifique su conexión.';
      return;
    }
  }
  err.style.display='block';
  err.textContent='Credenciales incorrectas.';
}

async function initAdmin(){
  document.getElementById('loginError').style.display='none';
  isAdmin=true;
  // La sesión admin expira en 8 horas
  sessionStorage.setItem('hr_session', JSON.stringify({isAdmin: true, exp: Date.now() + 8*60*60*1000}));
  show('adminScreen');
  document.getElementById('adminList').innerHTML='<div class="empty-state"><div class="empty-icon">...</div><div>Cargando datos...</div></div>';
  // Cargar empleados y tickets desde Sheets
  await loadEmployees();
  await loadAllTickets();
  populateEmpFilter(); renderAdmin();
  refreshEmpSelect();
}

function refreshEmpSelect(){
  const sel=document.getElementById('expEmpSelect');
  sel.innerHTML='<option value="">— Seleccione un colaborador —</option>'+
    EMPLOYEES.sort((a,b)=>a.nombre.localeCompare(b.nombre))
      .map(e=>`<option value="${e.cedula}">${e.nombre}</option>`).join('');
}

async function doLogout(){
  if(currentType) {
    const ok = await showConfirm(
      'Cerrar sesión',
      'Tiene una solicitud en progreso. Si sale ahora, <strong>perderá los datos ingresados</strong>.<br><br>¿Desea salir de todas formas?',
      'Salir', true
    );
    if(!ok) return;
  }
  currentUser=null; isAdmin=false; currentType=null;
  sessionStorage.removeItem('hr_session');
  clearCache();
  show('loginScreen');
  document.getElementById('cedulaInput').value='';
  document.getElementById('adminUser').value='';
  document.getElementById('adminPass').value='';
  clearForm();
}

function show(id){
  document.querySelectorAll('.screen').forEach(s=>s.classList.remove('active'));
  document.getElementById(id).classList.add('active');
  const ft = document.querySelector('footer');
  if(ft) ft.style.display = (id==='loginScreen') ? 'none' : 'block';
}

// ══════════════════════════════
// TABS
// ══════════════════════════════
function showTab(id,btn){
  // Advertir si hay un formulario activo que se perdería
  if(currentType && id !== 'nueva') {
    if(!confirm('Tiene una solicitud en progreso. ¿Desea cambiar de pestaña y perder los datos ingresados?')) return;
    clearForm();
  }
  document.querySelectorAll('#appScreen .tab-panel').forEach(p=>p.classList.remove('active'));
  document.querySelectorAll('#appScreen .tab-btn').forEach(b=>b.classList.remove('active'));
  document.getElementById('tab-'+id).classList.add('active');
  if(btn && !btn.dataset.orig) btn.dataset.orig = btn.textContent;
  if(btn) btn.classList.add('active');

  // Solo recarga desde GAS si el caché del usuario expiró
  const cacheOk = currentUser && getCache(`hr_tickets_${currentUser.cedula}`) !== null;

  function withLoad(renderFn) {
    if(cacheOk) { renderFn(); return; }
    if(btn) { btn.textContent='...'; btn.disabled=true; }
    loadUserData(currentUser.cedula).then(() => {
      renderFn(); updateStats();
      if(btn) { btn.disabled=false; btn.textContent=btn.dataset.orig||btn.textContent; }
    });
  }

  if(id==='historial')          { withLoad(renderTickets); }
  if(id==='desglose')           { updateVacTab(); }
  if(id==='expediente')         { withLoad(renderExpView); }
  if(id==='historial_completo') { withLoad(renderFullHistory); }
  if(id==='comprobantes')       { loadMisComprobantes(); }
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
  // Establecer fecha mínima = hoy en todos los inputs de fecha del tipo seleccionado
  const today = new Date().toISOString().split('T')[0];
  const f = typeFields[t];
  if(f) {
    const iniEl = document.getElementById(f.ini);
    const finEl = document.getElementById(f.fin);
    if(iniEl) iniEl.min = today;
    if(finEl) finEl.min = today;
  }
}

function clearForm(){
  currentType=null;
  document.querySelectorAll('.req-type').forEach(b=>b.classList.remove('sel'));
  document.querySelectorAll('.fg-group').forEach(g=>g.style.display='none');
  document.querySelectorAll('[id^="days-counter-"]').forEach(d=>d.style.display='none');
  document.getElementById('formFields').style.display='none';
  document.getElementById('obs').value='';
}

// Detecta solapamiento con solicitudes existentes (pendiente, en gestión o aprobada)
function hasOverlap(cedula, ini, fin, excludeId=null) {
  return tickets.some(t =>
    t.cedula === cedula &&
    (excludeId ? t.id !== excludeId : true) &&
    ['pending','inprogress','approved'].includes(t.status) &&
    t.details && t.details.inicio && t.details.fin &&
    t.details.inicio <= fin && t.details.fin >= ini
  );
}

async function submitRequest(){
  if(!currentType){toast('Acción requerida','Seleccione un tipo de solicitud','warning');return;}
  const obs=sanitizeText(getField('obs'));
  const bday=getEmpBirthday(currentUser);
  const f=typeFields[currentType];
  const ini=getField(f.ini),fin=getField(f.fin);
  if(!ini||!fin){toast('Fechas requeridas','Complete las fechas de inicio y fin','warning');return;}
  if(fin<ini){toast('Fecha inválida','La fecha fin no puede ser anterior al inicio','warning');return;}
  const{days,excluded}=countWorkdays(ini,fin,bday);
  if(days===0){toast('Sin días hábiles','El rango seleccionado no contiene días hábiles','warning');return;}
  // Verificar solapamiento con solicitudes existentes
  if(hasOverlap(currentUser.cedula, ini, fin)){
    const ok = await showConfirm(
      'Período solapado',
      'Ya tiene una solicitud <strong>pendiente, en gestión o aprobada</strong> que incluye fechas de este período.<br><br>¿Desea enviarla de todas formas?',
      'Enviar de todas formas', true
    );
    if(!ok) return;
  }

  let details={};
  function ajustarDias(d, turno) {
    return (turno==='Media mañana'||turno==='Media tarde') ? 0.5 : d;
  }

  if(currentType==='vacaciones'){
    const turnoVac = getField('vac-mod');
    const diasVac  = ajustarDias(days, turnoVac);
    const vac=calcVac(currentUser);
    if(diasVac>vac.disp){
      const ok=await showConfirm(
        'Días insuficientes',
        `Tiene <strong>${vac.disp}</strong> día(s) disponibles y solicita <strong>${diasVac}</strong>.<br><br>Puede enviar la solicitud y RRHH la revisará.`,
        'Continuar de todas formas', true
      );
      if(!ok) return;
    }
    details={inicio:ini,fin,dias:diasVac,turno:turnoVac,excluidos:excluded.length};
  } else if(currentType==='incapacidad'){
    const turnoInc = getField('inc-turno');
    details={inicio:ini,fin,dias:ajustarDias(days,turnoInc),tipo:getField('inc-tipo'),medico:sanitizeText(getField('inc-med')),turno:turnoInc,excluidos:excluded.length};
  } else if(currentType==='cumpleanos'){
    const turnoCum = getField('cum-turno');
    details={inicio:ini,fin,dias:ajustarDias(days,turnoCum),turno:turnoCum,excluidos:excluded.length};
  } else if(currentType==='personalday'){
    const pd=calcPD(currentUser);
    const turno=getField('per-turno');
    const diasPD = (turno==='Media mañana'||turno==='Media tarde') ? 0.5 : days;
    if(pd.disp<=0){
      toast('Sin Personal Days',`No tiene Personal Days disponibles este año. Usados: ${pd.usados} / ${pd.total}`,'warning');
      return;
    }
    if(diasPD>pd.disp){
      const ok=await showConfirm(
        'Personal Days insuficientes',
        `Tiene <strong>${pd.disp}</strong> Personal Day(s) disponible(s) y solicita <strong>${diasPD}</strong>.<br><br>¿Desea continuar de todas formas?`,
        'Continuar de todas formas', true
      );
      if(!ok) return;
    }
    details={inicio:ini,fin,dias:diasPD,turno,motivo:getField('per-mot'),excluidos:excluded.length};
  } else if(currentType==='singoce'){
    details={inicio:ini,fin,dias:days,turno:getField('sg-turno'),motivo:sanitizeText(getField('sg-mot')),excluidos:excluded.length};
  }

  pendingTicket={
    tipo:currentType,status:'pending',
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
  let s=`Período: ${fmt(d.inicio)} al ${fmt(d.fin)}\nDías solicitados: ${d.dias}`;
  if(d.excluidos>0) s+=` (${d.excluidos} excluido(s))`;
  if(d.turno)       s+=`\nTurno: ${d.turno}`;
  if(t.tipo==='incapacidad') s+=`\nTipo: ${d.tipo||''}\nMédico: ${d.medico||'No indicado'}`;
  if(t.tipo==='personalday') s+=`\nMotivo: ${d.motivo||''}`;
  if(t.tipo==='singoce')     s+=`\nMotivo: ${d.motivo||''}\nNota: No descuenta vacaciones, sí descuenta salario.`;
  return s;
}

function showPreview(t){
  document.getElementById('emailPreview').innerHTML=`
    <span class="ef">Asunto:</span> [RRHH] Nueva solicitud — ${tlabel(t.tipo)} — ${t.empleado}<br>
    <hr>
    <span class="ef">Ticket:</span> ${t.id} &nbsp;|&nbsp; <span class="ef">Fecha:</span> ${fmt(t.fecha)}<br>
    <hr>
    <span class="ef">Colaborador:</span> ${t.empleado} · ${t.cedula} · ${t.puesto}<br>
    <hr>
    <span class="ef">${tlabel(t.tipo)}</span><br><br>
    ${buildDet(t).replace(/\n/g,'<br>')}<br><br>
    <span class="ef">Observaciones:</span> ${t.obs||'Sin observaciones'}`;
  openModal('emailModal');
}

async function confirmSend(){
  closeModal('emailModal');
  const t=pendingTicket;
  showOverlay('Guardando solicitud...');
  // Guardar en Google Sheets — el ID lo genera el servidor
  const res = await callGAS({
    action:'saveTicket',
    cedula:t.cedula, empleado:t.empleado, puesto:t.puesto,
    tipo:t.tipo, inicio:t.details.inicio, fin:t.details.fin,
    dias:t.details.dias, turno:t.details.turno||'',
    excluidos:t.details.excluidos||0, obs:t.obs||'', motivo:t.details.motivo||''
  });
  // Usar el ID devuelto por el servidor
  const ticketId = (res && res.ok && res.data && res.data.id) ? res.data.id : t.id;
  // Recargar tickets desde Sheets
  await loadUserData(currentUser.cedula);
  // Enviar correo
  await callGAS({
    action:'sendEmail',
    to: currentUser.emailcorp || currentUser.email || '',
    asunto:`[RRHH] Nueva solicitud - ${tlabelText(t.tipo)} - ${t.empleado}`,
    ticket_id:ticketId,empleado:t.empleado,cedula:t.cedula,puesto:t.puesto,
    tipo:tlabel(t.tipo),fecha:fmt(t.fecha),detalles:buildDet(t),
    observaciones:t.obs||'Ninguna',estado:'⏳ Pendiente de revisión',
    nota_admin:'Nueva solicitud recibida.',msg_extra:''
  });
  toast('✅ Solicitud enviada',`Ticket ${ticketId} · Guardada en Sheets`);
  clearForm(); updateStats(); renderTickets(); pendingTicket=null;
}

async function callGAS(params, silent=false){
  if(!GAS_URL||GAS_URL==='PEGUE_SU_URL_GAS_AQUI') return null;
  if(!silent) document.getElementById('sendingOverlay').classList.add('active');
  const hide = () => { if(!silent) document.getElementById('sendingOverlay').classList.remove('active'); };
  try{
    const controller = new AbortController();
    const timeoutId  = setTimeout(() => controller.abort(), 12000);
    const url=`${GAS_URL}?${new URLSearchParams(params)}`;
    const res=await fetch(url, { signal: controller.signal });
    clearTimeout(timeoutId);
    // Verificar código HTTP antes de parsear
    if(!res.ok){
      hide();
      if(!silent) toast('⚠️ Error del servidor',`El servidor respondió con error ${res.status}. Intente de nuevo.`,'warning');
      return null;
    }
    let data;
    try { data = await res.json(); }
    catch(je){
      hide();
      if(!silent) toast('⚠️ Respuesta inválida','El servidor devolvió una respuesta inesperada.','warning');
      return null;
    }
    hide();
    return data;
  }catch(e){
    hide();
    if(e.name==='AbortError') toast('⚠️ Tiempo de espera','El servidor tardó demasiado. Intente de nuevo.','warning');
    else if(!silent) toast('⚠️ Error de red','Verifique su conexión e intente de nuevo.','warning');
    return null;
  }
}

// ── POST para envío de PDF (sin límite de URL) ──
async function callGASPost(body) {
  if (!GAS_URL || GAS_URL === 'PEGUE_SU_URL_GAS_AQUI') return null;
  document.getElementById('sendingOverlay').classList.add('active');
  try {
    const res  = await fetch(GAS_URL, { method: 'POST', body: JSON.stringify(body) });
    const text = await res.text();
    try { return JSON.parse(text); } catch { return null; }
  } catch { return null; }
  finally { document.getElementById('sendingOverlay').classList.remove('active'); }
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
  if(!ini||!fin||fin<ini){toast('⚠️ Fechas inválidas','Verifique las fechas de inicio y fin','warning');return;}
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
    action:'sendEmail', to:currentUser.emailcorp || currentUser.email || '',
    asunto:`[RRHH] Solicitud EDITADA - ${tlabelText(t.tipo)} - ${t.empleado}`,
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
    action:'sendEmail', to:currentUser.emailcorp || currentUser.email || '',
    asunto:`[RRHH] Solicitud CANCELADA - ${tlabelText(t.tipo)} - ${t.empleado}`,
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
          <div class="at-name">${escHTML(t.empleado)}</div>
          <div class="at-meta">${escHTML(t.puesto)} · <strong>${escHTML(t.id)}</strong> · ${fmt(t.fecha)}${emp?` · 📧 ${escHTML(emp.email)}`:''}</div>
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
          ${t.obs?`<br><em style="color:var(--g400)">💬 ${escHTML(t.obs)}</em>`:''}
          ${t.notaAdmin?`<br><span style="color:var(--b700);font-weight:600">📝 RRHH: ${escHTML(t.notaAdmin)}</span>`:''}
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
  const noteEl=document.getElementById('resolveEmailNote');
  if(noteEl) noteEl.textContent=`⚡ Se enviarán correos a ${RRHH_EMAILS_LABEL} y al colaborador.`;
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
    action:'sendEmail', to:emp?(emp.emailcorp||emp.email):'',
    asunto:`[RRHH] ${ia?'APROBADA':'DENEGADA'} - ${tlabelText(t.tipo)} - ${t.empleado}`,
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
  const cedula=getField('expEmpSelect'); if(!cedula){toast('⚠️ Acción requerida','Seleccione un colaborador','warning');return;}
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
  set('exp-emailcorp',exp.emailcorp||'');
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
  // Validar campos requeridos
  const nombres=getField('exp-nombres').trim();
  const ap1    =getField('exp-ap1').trim();
  if(!nombres||!ap1){
    toast('⚠️ Campos requeridos','Nombre(s) y Primer Apellido son obligatorios.','warning'); return;
  }
  // Validar formato de fecha de nacimiento si fue ingresada
  const fnacVal=getField('exp-fnac').trim();
  if(fnacVal && !/^\d{2}\/\d{2}\/\d{4}$/.test(fnacVal)){
    toast('⚠️ Fecha inválida','La fecha de nacimiento debe ser DD/MM/YYYY — ejemplo: 30/01/1990','warning'); return;
  }
  // Validar email corporativo si fue ingresado
  const emailcorpVal=getField('exp-emailcorp').trim();
  if(emailcorpVal && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailcorpVal)){
    toast('⚠️ Correo inválido','El correo corporativo no tiene un formato válido.','warning'); return;
  }
  expedientes[cedula]={
    nombres:   getField('exp-nombres'),  ap1:      getField('exp-ap1'),
    ap2:       getField('exp-ap2'),      genero:   getField('exp-genero'),
    fnac:      getField('exp-fnac'),     nac:      getField('exp-nac'),
    pais:      getField('exp-pais'),     civil:    getField('exp-civil'),
    hijos:     getField('exp-hijos'),    prov:     getField('exp-prov'),
    canton:    getField('exp-canton'),   distrito: getField('exp-distrito'),
    direccion: getField('exp-direccion'),tel:      getField('exp-tel'),
    emailcorp: getField('exp-emailcorp'),emailpers: getField('exp-emailpers'),emergNom: getField('exp-emerg-nom'),
    emergTel:  getField('exp-emerg-tel'),iban:     getField('exp-iban'),
    salario:   getField('exp-salario'),
    profesion: getField('exp-profesion'),estudios: getField('exp-estudios'),
    meds:      getField('exp-meds'),     alergias: getField('exp-alergias'),
    updatedAt: new Date().toISOString(),
    updatedBy: 'admin'
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
  const field=(label,val)=>`<div class="exp-field"><div class="exp-field-label">${label}</div><div class="exp-field-val ${!val?'empty':''}">${escHTML(val||'No registrado')}</div></div>`;
  const maskIBAN = v => v ? v.slice(0,4)+' •••• •••• •••• '+v.slice(-4) : null;
  const maskSal  = v => v ? '₡ ••••••' : null;
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
      ${field('Correo Corporativo',exp.emailcorp)}${field('Correo Personal',exp.emailpers)}${field('Teléfono',exp.tel)}
      ${field('Contacto Emergencia',exp.emergNom)}${field('Tel. Emergencia',exp.emergTel)}
    </div>
    <div class="section-header"><div class="sh-icon">🏦</div><h3>Bancario y Laboral</h3></div>
    <div class="exp-grid">
      ${field('IBAN',maskIBAN(exp.iban))}${field('Salario',maskSal(exp.salario))}${field('Profesión',exp.profesion)}${field('Otros Estudios',exp.estudios)}
    </div>
    <div class="section-header"><div class="sh-icon">🏥</div><h3>Médico</h3></div>
    <div class="exp-grid">${field('Medicamentos',exp.meds)}${field('Alergias',exp.alergias)}</div>
    <p style="font-size:11px;color:var(--g400);margin-top:14px;text-align:right">
      Última actualización: ${exp.updatedAt?fmt(exp.updatedAt.split('T')[0]):'—'}
      ${exp.updatedBy?' · por '+escHTML(exp.updatedBy):''}
    </p>`;
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
  if(!sel.length){toast('⚠️ Sin datos','No hay solicitudes para descargar','warning');return;}
  downloadTicketsPDF(sel,`Mis Solicitudes — ${currentUser.nombre}`);
}

function downloadSelectedCSV(){
  const ids=selectedTickets.size>0?[...selectedTickets]:tickets.filter(t=>t.cedula===currentUser.cedula).map(t=>t.id);
  const sel=tickets.filter(t=>ids.includes(t.id));
  if(!sel.length){toast('⚠️ Sin datos','No hay solicitudes para descargar','warning');return;}
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
              📅 ${fmt(t.details.inicio)} → ${fmt(t.details.fin)} · <strong>${t.details.dias} días solicitados</strong>
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

  const w = window.open('','_blank');
  if(!w || w.closed || typeof w.closed === 'undefined') {
    toast('⚠️ Ventana bloqueada','Active las ventanas emergentes (popups) en su navegador para descargar el PDF.','warning');
    return;
  }
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
  const bday=calcBirthday(currentUser);
  const dEl=document.getElementById('statVac');
  dEl.textContent=vac.disp<0?vac.disp+' ⚠️':vac.disp;
  dEl.style.color=vac.disp<0?'var(--red)':vac.disp<=3?'var(--orange)':'var(--g800)';
  document.getElementById('statApro').textContent=mine.filter(t=>t.status==='approved').length;
  document.getElementById('statPend').textContent=mine.filter(t=>['pending','inprogress'].includes(t.status)).length;
  // Día cumpleaños
  const bdayEl=document.getElementById('statBday');
  if(bdayEl){
    bdayEl.textContent=bday.disp<=0?'0 ✓':bday.disp;
    bdayEl.style.color=bday.disp<=0?'var(--green)':'var(--g800)';
  }
  // Personal Days
  const pdEl=document.getElementById('statPD');
  if(pdEl){
    pdEl.textContent=pd.disp<=0?'0 ⚠️':pd.disp;
    pdEl.style.color=pd.disp<=0?'var(--red)':pd.disp===1?'var(--orange)':'var(--g800)';
  }
}

function updateVacTab(){
  if(!currentUser) return;
  const v    = calcVac(currentUser);
  const pd   = calcPD(currentUser);
  const bday = calcBirthday(currentUser);

  // Vacaciones
  document.getElementById('vacIngreso').textContent = fmtLong(currentUser.ingreso);
  document.getElementById('vacMeses').textContent   = v.meses;
  document.getElementById('vacAcum').textContent    = v.acum;
  document.getElementById('vacCons').textContent    = v.usados;
  const dEl = document.getElementById('vacDisp');
  dEl.textContent  = v.disp < 0 ? v.disp+' ⚠️' : v.disp;
  dEl.style.color  = v.disp < 0 ? 'var(--red)' : v.disp <= 3 ? 'var(--orange)' : 'var(--green)';
  const prog = document.getElementById('vacProg');
  prog.style.width      = v.pct+'%';
  prog.style.background = v.pct>=100 ? 'linear-gradient(90deg,var(--orange),var(--red))' :
    v.pct>=80 ? 'linear-gradient(90deg,var(--orange),#F59E0B)' : 'linear-gradient(90deg,var(--b400),var(--b600))';
  document.getElementById('vacProx').textContent = fmt(v.prox);

  // Cumpleaños
  const bdayTotalEl = document.getElementById('bdayTotal');
  const bdayUsadoEl = document.getElementById('bdayUsado');
  const bdayDispEl  = document.getElementById('bdayDisp');
  if(bdayTotalEl) bdayTotalEl.textContent = bday.total;
  if(bdayUsadoEl) bdayUsadoEl.textContent = bday.used;
  if(bdayDispEl) {
    bdayDispEl.textContent = bday.disp <= 0 ? '0 ✓' : bday.disp;
    bdayDispEl.style.color = bday.disp <= 0 ? 'var(--green)' : 'var(--g800)';
  }

  // Personal Days
  const pdTotalEl  = document.getElementById('pdTotal');
  const pdUsadosEl = document.getElementById('pdUsados');
  const pdDispEl   = document.getElementById('pdDisp');
  if(pdTotalEl)  pdTotalEl.textContent  = pd.total;
  if(pdUsadosEl) pdUsadosEl.textContent = pd.usados;
  if(pdDispEl) {
    pdDispEl.textContent = pd.disp <= 0 ? '0 ⚠️' : pd.disp;
    pdDispEl.style.color = pd.disp <= 0 ? 'var(--red)' : pd.disp===1 ? 'var(--orange)' : 'var(--green)';
  }
  // Aviso vencimiento PD
  const venceMsg = document.getElementById('pdVenceMsg');
  if(venceMsg) {
    venceMsg.style.display = 'block';
    const dispTxt = pd.disp <= 0
      ? `Ya utilizó todos sus Personal Days de ${pd.anio}.`
      : `Tiene <strong>${pd.disp}</strong> Personal Day(s) disponible(s). Vencen el <strong>31/12/${pd.anio}</strong> — no son acumulables.`;
    venceMsg.innerHTML = `⚠️ ${dispTxt}`;
  }

  // Lista de vacaciones aprobadas
  const vacListEl = document.getElementById('vacListAprobadas');
  if(vacListEl) {
    const aprobadas = tickets
      .filter(t => t.cedula === currentUser.cedula && t.tipo === 'vacaciones' && t.status === 'approved')
      .sort((a,b) => (b.details.inicio||'').localeCompare(a.details.inicio||''));
    if(!aprobadas.length) {
      vacListEl.innerHTML = '<p class="vac-list-empty">No hay vacaciones aprobadas registradas.</p>';
    } else {
      vacListEl.innerHTML = aprobadas.map(t => `
        <div class="vac-list-row">
          <div>
            <div class="vac-list-dates">${fmt(t.details.inicio)} → ${fmt(t.details.fin)}</div>
            <div class="vac-list-meta">${escHTML(t.details.turno||'Día completo')} · ${escHTML(t.id)}</div>
          </div>
          <div class="vac-list-days">−${t.details.dias} día(s)</div>
        </div>`).join('');
    }
  }
}

// ══════════════════════════════
// MODALS & TOAST
// ══════════════════════════════
function openModal(id) {document.getElementById(id).classList.add('active');}
function closeModal(id){document.getElementById(id).classList.remove('active');}

// type: 'success' | 'error' | 'warning' | 'info'
function toast(title, msg, type='success'){
  document.getElementById('toastTitle').textContent=title;
  document.getElementById('toastMsg').textContent=msg;
  const el=document.getElementById('toast');
  el.className=''; // limpiar tipo anterior
  el.classList.add('toast-'+type);
  el.style.display='block';
  el.setAttribute('aria-live','polite');
  clearTimeout(window._toastTimer);
  window._toastTimer=setTimeout(()=>el.style.display='none',5500);
}

// ── CONFIRM MODAL (reemplaza confirm() nativo) ──
let _confirmResolve = null;

function showConfirm(title, msg, confirmText='Confirmar', isDanger=false){
  return new Promise(resolve => {
    _confirmResolve = resolve;
    document.getElementById('confirmModalTitle').textContent = title;
    document.getElementById('confirmModalMsg').innerHTML    = msg;
    const btn = document.getElementById('confirmModalBtn');
    btn.textContent = confirmText;
    btn.className   = isDanger ? 'btn-danger' : 'btn-submit';
    openModal('confirmModal');
  });
}

function _resolveConfirm(val){
  closeModal('confirmModal');
  if(_confirmResolve){ _confirmResolve(val); _confirmResolve=null; }
}

// ══════════════════════════════
// ADMIN — Gestión de Colaboradores
// ══════════════════════════════
let colabToDelete = null;
let _colabSearchTimer = null;
function debounceColabSearch() {
  clearTimeout(_colabSearchTimer);
  _colabSearchTimer = setTimeout(renderColabList, 220);
}

async function loadColabTab() {
  const el = document.getElementById('colabList');
  el.innerHTML = '<div class="empty-state"><div class="empty-icon">⏳</div><div>Cargando colaboradores...</div></div>';
  await loadEmployees();
  renderColabList();
}

function renderColabList() {
  const el = document.getElementById('colabList');
  const q  = (document.getElementById('colabSearch')?.value||'').toLowerCase();
  let list = [...EMPLOYEES].sort((a,b)=>a.nombre.localeCompare(b.nombre));
  if(q) list = list.filter(e=>e.nombre.toLowerCase().includes(q)||e.cedula.includes(q));

  if (!list.length) {
    el.innerHTML = '<div class="empty-state"><div class="empty-icon">👥</div><div>No se encontraron colaboradores</div></div>';
    return;
  }
  el.innerHTML = `
    <div style="margin-bottom:10px;font-size:12px;color:var(--g400)">${list.length} de ${EMPLOYEES.length} colaborador(es)</div>
    ${list.map(e => {
      const acceso = e.acceso !== 'inactivo';
      const vac    = e.ingreso ? calcVac(e) : null;
      const pd     = calcPD(e);
      const ns     = e.nombre.replace(/['"]/g,' ');
      return `<div class="admin-ticket">
        <div class="at-head">
          <div style="flex:1">
            <div class="at-name" style="display:flex;align-items:center;gap:8px;flex-wrap:wrap">
              ${escHTML(e.nombre)}
              <span style="font-size:11px;padding:2px 8px;border-radius:20px;font-weight:600;
                background:${acceso?'#D1FAE5':'#FEE2E2'};color:${acceso?'#065F46':'#991B1B'}">
                ${acceso?'✅ Activo':'🚫 Sin acceso'}
              </span>
            </div>
            <div class="at-meta">Cédula: <strong>${escHTML(e.cedula)}</strong>${e.puesto?' &nbsp;·&nbsp; '+escHTML(e.puesto):' &nbsp;·&nbsp; <em style="color:var(--g400)">Sin puesto — completar en Expedientes</em>'}</div>
            ${e.email?`<div class="at-meta">📧 ${escHTML(e.email)}</div>`:''}
            ${e.ingreso&&vac?`<div class="at-meta">📅 Ingreso: ${fmt(e.ingreso)} &nbsp;·&nbsp;
              🏖️ <strong style="color:${vac.disp<0?'var(--red)':vac.disp<=3?'var(--orange)':'var(--green)'}">${vac.disp} días vac.</strong> &nbsp;·&nbsp;
              ⭐ <strong style="color:${pd.disp<=0?'var(--red)':pd.disp===1?'var(--orange)':'var(--green)'}">${pd.disp} PD</strong>
            </div>`:'<div class="at-meta" style="color:var(--g400);font-style:italic">Datos laborales pendientes en Expedientes</div>'}
          </div>
          <div style="display:flex;flex-direction:column;gap:6px;align-items:flex-end;min-width:120px">
            <button class="btn-edit" style="width:100%;font-size:12px" onclick="openAccesoModal('${e.cedula}','${ns}','${e.acceso||'activo'}')">🔑 Acceso</button>
            <button class="btn-cancel-req" style="width:100%;font-size:12px" onclick="openDeleteColab('${e.cedula}','${ns}')">🗑️ Eliminar</button>
          </div>
        </div>
      </div>`;
    }).join('')}`;
}

function openNuevoColab() {
  document.getElementById('colabModalTitle').textContent = '➕ Nuevo Ingreso';
  document.getElementById('colab-mode').value = 'new';
  ['colab-nombres','colab-ap1','colab-ap2','colab-cedula'].forEach(id=>{
    const el=document.getElementById(id); if(el) el.value='';
  });
  document.getElementById('colab-acceso').value = 'activo';
  document.getElementById('colab-cedula').readOnly = false;
  openModal('colabModal');
}

async function saveColab() {
  const cedula  = document.getElementById('colab-cedula').value.trim().replace(/[-.\s]/g,'');
  const nombres = document.getElementById('colab-nombres').value.trim();
  const ap1     = document.getElementById('colab-ap1').value.trim();
  const ap2     = document.getElementById('colab-ap2').value.trim();
  const acceso  = document.getElementById('colab-acceso').value;

  if (!cedula||!nombres||!ap1) {
    toast('⚠️ Campos requeridos','Complete al menos nombre(s), primer apellido y cédula','warning'); return;
  }
  if (!validateCedula(cedula)) {
    toast('⚠️ Cédula inválida','Ingrese una cédula válida (8–12 dígitos)','warning'); return;
  }
  if (EMPLOYEES.find(e=>e.cedula===cedula)) {
    toast('⚠️ Cédula duplicada','Ya existe un colaborador con esa cédula','warning'); return;
  }

  const nombre = [nombres, ap1, ap2].filter(Boolean).join(' ');
  showOverlay('Registrando colaborador...');
  const res = await callGAS({
    action:'addEmpleado', cedula, nombre,
    puesto:'', ingreso:'', consumidos:0,
    email:'', pdTotal:3, pdUsados:0,
    pdAnio: new Date().getFullYear(), acceso
  });
  closeModal('colabModal');

  if (res && res.ok) {
    await loadEmployees();
    renderColabList();
    refreshEmpSelect();
    toast('✅ Colaborador registrado', nombre + ' ya puede ingresar con cédula ' + cedula);
  } else {
    hideOverlay();
    toast('❌ Error', (res&&res.error)||'No se pudo guardar en Sheets');
  }
}

// ── Gestión de acceso ──
function openAccesoModal(cedula, nombre, accesoActual) {
  document.getElementById('accesoModalTitle').textContent = '🔑 Acceso — ' + nombre.split(' ')[0];
  document.getElementById('accesoColabName').textContent  = nombre;
  document.getElementById('accesoCedula').value           = cedula;
  document.getElementById('accesoSelect').value           = accesoActual || 'activo';
  openModal('accesoModal');
}

async function confirmAcceso() {
  const cedula = document.getElementById('accesoCedula').value;
  const acceso = document.getElementById('accesoSelect').value;
  showOverlay('Actualizando acceso...');
  const res = await callGAS({action:'updateEmpleado', cedula, acceso});
  closeModal('accesoModal');
  if (res && res.ok) {
    await loadEmployees();
    renderColabList();
    toast(
      acceso==='activo' ? 'Acceso habilitado' : 'Acceso deshabilitado',
      acceso==='activo' ? 'El colaborador puede ingresar al portal' : 'El colaborador no puede ingresar al portal'
    );
  } else {
    toast('Error', 'No se pudo actualizar el acceso','error');
  }
}

// ── Eliminar — doble confirmación ──
function openDeleteColab(cedula, nombre) {
  colabToDelete = cedula;
  document.getElementById('deleteColabName').textContent = nombre;
  openModal('deleteColabModal');
}

function openDeleteColab2() {
  const nombre = document.getElementById('deleteColabName').textContent;
  document.getElementById('deleteColabName2').textContent = nombre;
  closeModal('deleteColabModal');
  openModal('deleteColabModal2');
}

async function confirmDeleteColab() {
  if (!colabToDelete) return;
  closeModal('deleteColabModal2');
  showOverlay('Eliminando colaborador...');
  const res = await callGAS({action:'deleteEmpleado', cedula:colabToDelete});
  if (res && res.ok) {
    await loadEmployees();
    renderColabList();
    refreshEmpSelect();
    toast('Colaborador eliminado', 'Removido del sistema','success');
  } else {
    toast('Error', 'No se pudo eliminar del Sheet','error');
  }
  colabToDelete = null;
}

// ══════════════════════════════
// SESIÓN PERSISTENTE — restaurar al recargar
// ══════════════════════════════
async function restoreSession() {
  const saved = sessionStorage.getItem('hr_session');
  if (!saved) return;
  try {
    const s = JSON.parse(saved);
    if (s.isAdmin) {
      // Verificar que la sesión admin no haya expirado (8 horas)
      if (!s.exp || Date.now() > s.exp) {
        sessionStorage.removeItem('hr_session');
        return;
      }
      isAdmin = true;
      show('adminScreen');
      await loadEmployees();
      await loadAllTickets();
      populateEmpFilter(); renderAdmin(); refreshEmpSelect();
    } else if (s.cedula) {
      if (EMPLOYEES.length === 0) await loadEmployees();
      const emp = EMPLOYEES.find(e => e.cedula === s.cedula);
      if (!emp || emp.acceso === 'inactivo') { sessionStorage.removeItem('hr_session'); return; }
      currentUser = emp; isAdmin = false;
      show('appScreen');
      document.getElementById('userName').textContent   = emp.nombre.split(' ').slice(0,2).join(' ');
      document.getElementById('userCedula').textContent = 'Cédula: '+emp.cedula;
      document.getElementById('userAvatar').textContent = emp.nombre[0];
      await loadUserData(emp.cedula);
      updateStats(); renderTickets(); updateVacTab(); renderExpView();
    }
  } catch(e) { sessionStorage.removeItem('hr_session'); }
}

// ══════════════════════════════
// DETECCIÓN OFFLINE
// ══════════════════════════════
function _updateOfflineBanner() {
  const banner = document.getElementById('offlineBanner');
  if (!banner) return;
  banner.classList.toggle('visible', !navigator.onLine);
}

window.addEventListener('online',  () => {
  _updateOfflineBanner();
  toast('Conexión restaurada', 'Sincronizando datos en tiempo real', 'success');
});
window.addEventListener('offline', () => {
  _updateOfflineBanner();
  toast('Sin conexión', 'Mostrando datos en caché local', 'warning');
});

document.addEventListener('DOMContentLoaded', () => {
  _updateOfflineBanner();
  restoreSession();
});

// ══════════════════════════════════════════════════════
// COMPROBANTES DE PAGO
// ══════════════════════════════════════════════════════

// ── Estado local ──
let compPDFFile        = null; // PDF seleccionado por el admin
let misComprobantes    = [];   // comprobantes del colaborador actual
let currentComprobante = null; // para modal de detalle

// ── Período automático: mes anterior al envío ──
function getAutoPeriodo() {
  const now  = new Date();
  const prev = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const meses = ['enero','febrero','marzo','abril','mayo','junio',
                 'julio','agosto','septiembre','octubre','noviembre','diciembre'];
  return {
    label: meses[prev.getMonth()] + ' ' + prev.getFullYear(),
    value: `${prev.getFullYear()}-${String(prev.getMonth()+1).padStart(2,'0')}`,
  };
}

// ── Cargar selector de colaboradores ──
function loadCompColabSelector() {
  const sel = document.getElementById('compColabSelect');
  if (!sel) return;
  const lista = (empleados || []).filter(e => e.acceso !== 'inactivo');
  sel.innerHTML = '<option value="">Seleccione un colaborador...</option>' +
    lista.map(e => `<option value="${escHTML(e.cedula)}">${escHTML(e.nombre)}</option>`).join('');
  const periodo = getAutoPeriodo();
  const lbl = document.getElementById('compPeriodoLabel');
  if (lbl) lbl.value = periodo.label.charAt(0).toUpperCase() + periodo.label.slice(1);
}

// ── Drag & Drop PDF ──
function handleCompPDFDrop(event) {
  event.preventDefault();
  document.getElementById('compPDFZone').classList.remove('drag-over');
  const file = event.dataTransfer.files[0];
  if (file) selectCompPDF(file);
}

function selectCompPDF(file) {
  if (!file || file.type !== 'application/pdf') {
    toast('Formato inválido', 'Solo se aceptan archivos .pdf', 'error');
    return;
  }
  compPDFFile = file;
  document.getElementById('compPDFName').textContent = file.name;
  const zone = document.getElementById('compPDFZone');
  zone.style.borderColor = 'var(--b500)';
  zone.style.background  = 'var(--cyan-l)';
}

function resetCompPDF() {
  compPDFFile = null;
  const inp = document.getElementById('compPDFInput');
  if (inp) inp.value = '';
  document.getElementById('compPDFName').textContent = 'Arrastrá el comprobante PDF aquí o hacé clic para seleccionar';
  const zone = document.getElementById('compPDFZone');
  zone.style.borderColor = '';
  zone.style.background  = '';
  const cb = document.getElementById('compMsgCheck');
  if (cb) { cb.checked = false; toggleCompMsg(cb); }
}

// ── Enviar comprobante PDF ──
async function sendComprobantePDF() {
  const cedula = document.getElementById('compColabSelect')?.value;
  if (!cedula)      { toast('Colaborador requerido', 'Seleccione un colaborador', 'warning'); return; }
  if (!compPDFFile) { toast('PDF requerido', 'Seleccione el PDF del comprobante', 'warning'); return; }

  const periodo = getAutoPeriodo();

  const pdfBase64 = await new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload  = e => resolve(e.target.result.split(',')[1]);
    reader.onerror = reject;
    reader.readAsDataURL(compPDFFile);
  });

  const emp = (empleados || []).find(e => e.cedula === cedula);
  showOverlay('Enviando comprobante...');

  const msgCheck = document.getElementById('compMsgCheck');
  const mensajeExtra = (msgCheck?.checked && document.getElementById('compMsgText')?.value.trim())
    ? document.getElementById('compMsgText').value.trim()
    : '';

  const res = await callGASPost({
    action:       'sendComprobantePDF',
    cedula,
    nombre:       emp?.nombre || '',
    periodo:      periodo.value,
    periodoLabel: periodo.label,
    pdfBase64,
    pdfName:      compPDFFile.name,
    mensajeExtra,
  });

  hideOverlay();

  if (res && res.ok) {
    toast('Comprobante enviado', `Correo enviado a ${escHTML(res.emailTo || emp?.nombre || cedula)}`, 'success');
    resetCompPDF();
    document.getElementById('compColabSelect').value = '';
    loadCompAdminHistory();
  } else {
    toast('Error al enviar', res?.error || 'Verifique que el colaborador tenga correo en su expediente', 'error');
  }
}

// ── Mensaje extra toggle ──
function toggleCompMsg(cb) {
  document.getElementById('compMsgExtra').style.display = cb.checked ? 'block' : 'none';
  if (!cb.checked) document.getElementById('compMsgText').value = '';
}

// ── Historial admin ──
let _compAdminData = [];

async function loadCompAdminHistory() {
  const res = await gasGet({ action: 'getComprobantesAdmin' });
  const list = document.getElementById('compAdminHistoryList');
  if (!res || !res.ok || !res.data || res.data.length === 0) {
    list.innerHTML = '<div class="empty-state"><div class="empty-icon">—</div><div>No hay comprobantes enviados aún</div></div>';
    return;
  }
  _compAdminData = res.data;

  // Poblar filtros de colaborador y año
  const colabs = [...new Map(_compAdminData.map(c => [c.cedula, c.nombre])).entries()];
  const years  = [...new Set(_compAdminData.map(c => (c.periodo||'').split('-')[0]).filter(Boolean))].sort().reverse();

  const fColab = document.getElementById('histFiltColab');
  if (fColab) {
    fColab.innerHTML = '<option value="">Todos</option>' +
      colabs.map(([ced, nom]) => `<option value="${escHTML(ced)}">${escHTML(nom||ced)}</option>`).join('');
  }
  const fYear = document.getElementById('histFiltYear');
  if (fYear) {
    fYear.innerHTML = '<option value="">Todos</option>' + years.map(y => `<option value="${y}">${y}</option>`).join('');
  }

  filterCompAdminHistory();
}

function filterCompAdminHistory() {
  const list  = document.getElementById('compAdminHistoryList');
  const fCol  = document.getElementById('histFiltColab')?.value  || '';
  const fYear = document.getElementById('histFiltYear')?.value   || '';
  const fMo   = document.getElementById('histFiltMonth')?.value  || '';
  const meses = ['enero','febrero','marzo','abril','mayo','junio','julio','agosto','septiembre','octubre','noviembre','diciembre'];

  const filtered = _compAdminData.filter(c => {
    const [cy, cm] = (c.periodo||'').split('-');
    if (fCol  && c.cedula !== fCol)  return false;
    if (fYear && cy !== fYear)       return false;
    if (fMo   && cm !== fMo)         return false;
    return true;
  }).sort((a,b) => (b.periodo||'').localeCompare(a.periodo||''));

  if (filtered.length === 0) {
    list.innerHTML = '<div class="empty-state"><div class="empty-icon">—</div><div>No hay comprobantes para los filtros seleccionados</div></div>';
    return;
  }

  list.innerHTML = filtered.map(c => {
    const [cy, cm] = (c.periodo||'').split('-');
    const label = cm ? `${meses[parseInt(cm)-1]} ${cy}` : (c.periodo||'—');
    const driveUrl = c.drive_url || '';
    return `<div class="comp-card">
      <div class="comp-card-left">
        <div class="comp-card-badge" style="font-size:9px">${(c.periodo||'').replace('-','/')}</div>
        <div>
          <div class="comp-card-period">${escHTML(c.nombre||'—')}</div>
          <div class="comp-card-meta">${label} · Enviado el ${escHTML(c.fecha_envio||'—')}</div>
        </div>
      </div>
      <div class="comp-card-right" style="gap:6px">
        ${driveUrl ? `<a href="${escHTML(driveUrl)}" target="_blank" class="btn-sec" style="font-size:11px;padding:4px 10px;text-decoration:none">Ver PDF</a>` : ''}
      </div>
    </div>`;
  }).join('');
}

// ── Comprobantes colaborador ──
async function loadMisComprobantes() {
  if (!currentUser) return;
  const el = document.getElementById('misComprobantes');
  el.innerHTML = '<div class="empty-state"><div class="empty-icon">...</div><div>Cargando...</div></div>';

  const res = await gasGet({ action: 'getComprobantes', cedula: currentUser.cedula });
  if (!res || !res.ok || !res.data) {
    el.innerHTML = '<div class="empty-state"><div class="empty-icon">—</div><div>No se pudieron cargar los comprobantes</div></div>';
    return;
  }
  misComprobantes = res.data;

  // Poblar filtro de años
  const years = [...new Set(misComprobantes.map(c => (c.periodo||'').split('-')[0]).filter(Boolean))].sort().reverse();
  const yrSel = document.getElementById('comp-filt-year');
  yrSel.innerHTML = '<option value="">Todos los años</option>' + years.map(y => `<option value="${y}">${y}</option>`).join('');

  renderMisComprobantes();
}

function renderMisComprobantes() {
  const el   = document.getElementById('misComprobantes');
  const yr   = document.getElementById('comp-filt-year')?.value  || '';
  const mo   = document.getElementById('comp-filt-month')?.value || '';
  const meses = ['enero','febrero','marzo','abril','mayo','junio','julio','agosto','septiembre','octubre','noviembre','diciembre'];

  const filtered = misComprobantes.filter(c => {
    const [cy, cm] = (c.periodo || '').split('-');
    if (yr && cy !== yr) return false;
    if (mo && cm !== mo) return false;
    return true;
  }).sort((a,b) => (b.periodo||'').localeCompare(a.periodo||''));

  if (filtered.length === 0) {
    el.innerHTML = '<div class="empty-state"><div class="empty-icon">—</div><div>No hay comprobantes para el período seleccionado</div></div>';
    return;
  }

  el.innerHTML = filtered.map((c, i) => {
    const [cy, cm] = (c.periodo || '').split('-');
    const label    = cm ? `${meses[parseInt(cm)-1]} ${cy}` : c.periodo;
    const driveUrl = c.drive_url || '';
    return `<div class="comp-card">
      <div class="comp-card-left" style="cursor:pointer;flex:1" onclick="openCompModal(${i})">
        <div class="comp-card-badge">${(c.periodo||'').replace('-','/')}</div>
        <div>
          <div class="comp-card-period">${label}</div>
          <div class="comp-card-meta">${escHTML(c.descripcion || 'Comprobante de pago')} · ${escHTML(c.fecha_envio||'')}</div>
        </div>
      </div>
      <div class="comp-card-right" style="gap:6px;align-items:center">
        ${driveUrl
          ? `<a href="${escHTML(driveUrl)}" target="_blank" rel="noopener"
               class="btn-cyan" style="font-size:11px;padding:5px 12px;text-decoration:none;white-space:nowrap">
               Descargar PDF
             </a>`
          : `<span style="font-size:11px;color:var(--g300)">Enviado por correo</span>`
        }
      </div>
    </div>`;
  }).join('');

  // Guardar referencia para el modal
  window._filteredComprobantes = filtered;
}

function openCompModal(idx) {
  const c = window._filteredComprobantes[idx];
  if (!c) return;
  currentComprobante = c;

  const [cy, cm] = (c.periodo || '').split('-');
  const meses = ['enero','febrero','marzo','abril','mayo','junio','julio','agosto','septiembre','octubre','noviembre','diciembre'];
  const label = cm ? `${meses[parseInt(cm)-1]} ${cy}` : c.periodo;

  document.getElementById('compModalTitle').textContent = `Comprobante — ${label}`;

  const fmt = n => (parseFloat(n)||0).toLocaleString('es-CR');
  const v   = k => parseFloat(c[k]) || 0;

  const diasTrab      = v('dias_trabajados');
  const salarioMes    = v('salario_mes');
  const bono          = v('bono');
  const horasDobles   = v('horas_dobles');
  const subsidio      = v('subsidio');
  const totalBenef    = v('total_beneficios') || (salarioMes + bono + horasDobles + subsidio);
  const pension       = v('pension_voluntaria');
  const ccss          = v('ccss');
  const renta         = v('renta');
  const cxc           = v('cxc');
  const totalRebaj    = v('total_rebajos') || (pension + ccss + renta + cxc);
  const neto          = v('salario_neto');

  const detRow = (label, val, accent) => val ? `
    <div class="comp-detail-row">
      <span class="comp-detail-label">${label}</span>
      <span class="comp-detail-val" ${accent?`style="color:var(--orange)"`:''}>${accent?'- ':''}₡ ${fmt(val)}</span>
    </div>` : '';

  document.getElementById('compModalBody').innerHTML = `
    <div style="background:var(--b50);border-radius:8px;padding:10px 14px;margin-bottom:14px;font-size:12px;color:var(--b700)">
      <strong>Puesto:</strong> ${escHTML(c.puesto||'—')} &nbsp;·&nbsp;
      <strong>Ingreso:</strong> ${escHTML(c.fecha_ingreso||'—')} &nbsp;·&nbsp;
      ${escHTML(c.descripcion||'Planilla ordinaria')}
    </div>
    <div style="font-size:11px;font-weight:700;color:var(--b600);letter-spacing:.5px;text-transform:uppercase;margin-bottom:6px;padding-bottom:4px;border-bottom:1px solid var(--b100)">Beneficios</div>
    <div class="comp-detail-row" style="font-size:11px;color:var(--g400)">
      <span class="comp-detail-label"></span><span class="comp-detail-val" style="font-size:10px;color:var(--g300)">Días trabajados: ${diasTrab||'—'}</span>
    </div>
    ${detRow('Salario Mes', salarioMes, false)}
    ${detRow('Bono', bono, false)}
    ${detRow('Horas Dobles / Tiempo Doble', horasDobles, false)}
    ${detRow('Subsidio Incapacidad', subsidio, false)}
    <div class="comp-detail-row" style="font-weight:700;border-top:1px solid var(--b100);padding-top:6px;margin-top:2px">
      <span class="comp-detail-label">Total Beneficios</span>
      <span class="comp-detail-val" style="color:var(--b600)">₡ ${fmt(totalBenef)}</span>
    </div>
    <div style="font-size:11px;font-weight:700;color:var(--b600);letter-spacing:.5px;text-transform:uppercase;margin:14px 0 6px;padding-bottom:4px;border-bottom:1px solid var(--b100)">Deducciones</div>
    ${detRow('CCSS 10.67%', ccss, true)}
    ${detRow('Impuesto de Renta', renta, true)}
    ${detRow('Pensión Voluntaria', pension, true)}
    ${detRow('CxC', cxc, true)}
    <div class="comp-detail-row" style="font-weight:700;border-top:1px solid var(--b100);padding-top:6px;margin-top:2px">
      <span class="comp-detail-label">Total Deducciones</span>
      <span class="comp-detail-val" style="color:var(--red)">- ₡ ${fmt(totalRebaj)}</span>
    </div>
    <div class="comp-detail-row total-row" style="margin-top:10px;padding-top:12px;border-top:2px solid var(--b500)">
      <span class="comp-detail-label">Neto a Pagar</span>
      <span class="comp-detail-val">₡ ${fmt(neto)}</span>
    </div>
  `;
  openModal('compModal');
}

function printComprobante() {
  if (!currentComprobante) return;
  const c    = currentComprobante;
  const pv   = k => parseFloat(c[k]) || 0;
  const fmt  = n => (parseFloat(n)||0).toLocaleString('es-CR');

  const [cy, cm] = (c.periodo || '').split('-');
  const meses = ['enero','febrero','marzo','abril','mayo','junio','julio','agosto','septiembre','octubre','noviembre','diciembre'];
  const label = cm ? `${meses[parseInt(cm)-1]} ${cy}` : c.periodo;
  // Fecha larga ej: "31 de diciembre de 2025"
  const dateLabel = (() => {
    if (!cy || !cm) return label;
    const lastDay = new Date(parseInt(cy), parseInt(cm), 0).getDate();
    return `${lastDay} de ${meses[parseInt(cm)-1]} de ${cy}`;
  })();

  const diasTrab      = pv('dias_trabajados');
  const salarioMes    = pv('salario_mes');
  const bono          = pv('bono');
  const horasDobles   = pv('horas_dobles');
  const subsidio      = pv('subsidio');
  const totalBenef    = pv('total_beneficios') || (salarioMes + bono + horasDobles + subsidio);
  const pension       = pv('pension_voluntaria');
  const ccss          = pv('ccss');
  const renta         = pv('renta');
  const cxc           = pv('cxc');
  const totalRebaj    = pv('total_rebajos') || (pension + ccss + renta + cxc);
  const neto          = pv('salario_neto');

  const logoUrl = location.href.replace(/\/[^\/]*$/, '/') + 'assets/img/lean-logo.png';

  const tr = (label, dias, monto, bold, red) =>
    `<tr style="${bold?'font-weight:bold;':''}${red?'color:#CC0000;':''}">
       <td style="padding:5px 8px;border-bottom:1px solid #ddd;font-size:12px">${label}</td>
       <td style="padding:5px 8px;border-bottom:1px solid #ddd;font-size:12px;text-align:center">${dias||''}</td>
       <td style="padding:5px 8px;border-bottom:1px solid #ddd;font-size:12px;text-align:right">${monto?fmt(monto):''}</td>
     </tr>`;

  const w = window.open('', '_blank', 'width=680,height=780');
  w.document.write(`<!DOCTYPE html><html><head><meta charset="UTF-8"/>
  <title>Comprobante ${label}</title>
  <style>
    *{box-sizing:border-box}
    body{font-family:Arial,sans-serif;color:#1a1a1a;margin:0;padding:32px;max-width:620px;margin:auto}
    .logo-row{display:flex;align-items:flex-start;gap:18px;margin-bottom:6px}
    .logo-img{height:56px;width:auto}
    .logo-text{font-size:28px;font-weight:900;letter-spacing:-1px;line-height:1.1}
    .logo-text span{color:#00B4D8}
    .logo-sub{font-size:9px;letter-spacing:1.5px;color:#444;margin-top:2px}
    .logo-line{border:none;border-top:1.5px solid #00B4D8;margin:0 0 10px}
    h2{text-align:center;font-size:16px;font-weight:700;margin:10px 0 2px}
    .fecha-center{text-align:center;font-size:12px;color:#555;margin-bottom:16px}
    .info-table{width:100%;border-collapse:collapse;margin-bottom:16px}
    .info-table td{font-size:12px;padding:4px 8px}
    .info-table td:first-child{color:#1565C0;font-weight:600;width:140px}
    .section-title{font-style:italic;font-weight:bold;font-size:13px;margin:8px 0 4px}
    .detail-table{width:100%;border-collapse:collapse;margin-bottom:8px}
    .detail-table th{font-size:11px;text-align:left;padding:5px 8px;background:#f0f0f0;border-bottom:1px solid #ccc}
    .detail-table th:not(:first-child){text-align:right}
    .neto-row td{font-weight:bold;font-size:14px;color:#052960;border-top:2px solid #1565C0;padding:8px}
    .neto-row td:last-child{text-align:right}
    footer{margin-top:24px;font-size:10px;color:#999;text-align:center}
    @media print{body{padding:16px}}
  </style></head><body>
  <div class="logo-row">
    <img class="logo-img" src="${logoUrl}" onerror="this.style.display='none';document.getElementById('logo-fallback').style.display='block'" alt="Lean Consulting"/>
    <div id="logo-fallback" style="display:none">
      <div class="logo-text">LE<span>A</span>N</div>
      <div style="font-weight:900;font-size:14px;letter-spacing:1px">CONSULTING</div>
      <div class="logo-sub">PROJECT MANAGEMENT</div>
    </div>
  </div>
  <hr class="logo-line"/>
  <h2>Comprobante de pago de planilla</h2>
  <div class="fecha-center">${dateLabel}</div>

  <table class="info-table">
    <tr><td>Nombre:</td><td>${escHTML(c.nombre||currentUser?.nombre||'')}</td></tr>
    <tr><td>Identificacion</td><td>${escHTML(c.cedula||currentUser?.cedula||'')}</td></tr>
    <tr><td>Puesto</td><td>${escHTML(c.puesto||'')}</td></tr>
    <tr><td>Fecha de Ingreso</td><td>${escHTML(c.fecha_ingreso||'')}</td></tr>
    <tr><td>Salario Bruto</td><td style="text-align:right;font-weight:600">${fmt(totalBenef)}</td></tr>
  </table>

  <div style="border:1px solid #ccc;border-radius:4px;overflow:hidden">
    <div style="background:#f7f7f7;padding:6px 8px;font-weight:bold;font-size:13px;border-bottom:1px solid #ccc">Detalle de Salario</div>
    <div style="padding:8px">
      <div class="section-title">Beneficios</div>
      <table class="detail-table">
        <thead><tr>
          <th></th><th style="text-align:center">Dias trabajados</th><th style="text-align:right"></th>
        </tr></thead>
        <tbody>
          ${tr('Salario Mes', diasTrab, salarioMes, false, false)}
          ${bono         ? tr('Bono',                  '', bono,        false, false) : ''}
          ${horasDobles  ? tr('Horas Extras',           '', horasDobles, false, false) : ''}
          ${subsidio     ? tr('Subsidio Incapacidad',   '', subsidio,    false, false) : ''}
          ${tr('Total Beneficios', '', totalBenef, true, false)}
        </tbody>
      </table>

      <div class="section-title">Deducciones</div>
      <table class="detail-table">
        <tbody>
          ${ccss    ? tr('CCSS 10,67%',         '', ccss,    false, true) : ''}
          ${renta   ? tr('Impuesto de renta',   '', renta,   false, true) : ''}
          ${pension ? tr('Pensión Voluntaria',  '', pension, false, true) : ''}
          ${cxc     ? tr('CxC',                 '', cxc,     false, true) : ''}
          ${tr('Total Deducciones', '', totalRebaj, true, true)}
        </tbody>
      </table>
    </div>
  </div>

  <table class="detail-table" style="margin-top:8px">
    <tr class="neto-row">
      <td>Neto a Pagar</td><td></td><td style="text-align:right">₡ ${fmt(neto)}</td>
    </tr>
  </table>

  <footer>Lean Consulting S.A. &nbsp;·&nbsp; Portal de Recursos Humanos &nbsp;·&nbsp; Generado el ${new Date().toLocaleDateString('es-CR')}</footer>
  <script>window.onload=()=>window.print()<\/script>
  </body></html>`);
  w.document.close();
}