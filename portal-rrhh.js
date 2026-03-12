/* ══════════════════════════════════════════
   Portal RRHH — Lean Consulting S.A.
   Lógica principal
   ══════════════════════════════════════════ */

// ── CONFIG ──
const GAS_URL = 'https://script.google.com/macros/s/AKfycbyjKE7f4DXlVxBOmZHK6vGSYWQhONQgJkzuB-JslWP_89v-xhyuP74AjDYt8QiKC94w/exec';
const GAS_EMAIL = [
  'kfernandez@leancr.com',
  'cfernandez@leancr.com'
];
const ADMIN_USER = 'admin';
const ADMIN_PASS = 'rrhh2024';

// ── FERIADOS COSTA RICA ──
function getCRHolidays(year) {
  const fixed = [
    `${year}-01-01`, // Año Nuevo
    `${year}-04-11`, // Batalla de Rivas
    `${year}-05-01`, // Día del Trabajo
    `${year}-07-25`, // Anexión de Guanacaste
    `${year}-08-02`, // Virgen de los Ángeles
    `${year}-08-15`, // Día de la Madre
    `${year}-09-15`, // Independencia
    `${year}-10-12`, // Encuentro de Culturas
    `${year}-12-25`, // Navidad
  ];
  // Jueves y Viernes Santos (algoritmo de Gauss)
  const a = year % 19, b = Math.floor(year / 100), c = year % 100;
  const d = Math.floor(b / 4), e = b % 4, f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3), h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4), k = c % 4, l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31);
  const day   = ((h + l - 7 * m + 114) % 31) + 1;
  const easter = new Date(year, month - 1, day);
  const thurs  = new Date(easter); thurs.setDate(easter.getDate() - 3);
  const fri    = new Date(easter); fri.setDate(easter.getDate() - 2);
  fixed.push(thurs.toISOString().split('T')[0]);
  fixed.push(fri.toISOString().split('T')[0]);
  return fixed;
}

function isHoliday(dateStr) {
  return getCRHolidays(parseInt(dateStr.split('-')[0])).includes(dateStr);
}

function isBirthday(dateStr, bdayDDMMYYYY) {
  if (!bdayDDMMYYYY) return false;
  const parts = bdayDDMMYYYY.split('/');
  if (parts.length !== 3) return false;
  const [dd, mm] = parts;
  const [, m, d] = dateStr.split('-');
  return m === mm && d === dd;
}

// Días hábiles entre dos fechas (excluye fines de semana, feriados, cumpleaños)
function countWorkdays(ini, fin, bdayStr) {
  if (!ini || !fin || fin < ini) return { days: 0, excluded: [] };
  let days = 0;
  const excluded = [];
  const start = new Date(ini + 'T12:00:00');
  const end   = new Date(fin + 'T12:00:00');
  for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
    const ds  = d.toISOString().split('T')[0];
    const dow = d.getDay();
    if (dow === 0 || dow === 6)   { excluded.push({ date: ds, reason: 'Fin de semana' }); continue; }
    if (isHoliday(ds))             { excluded.push({ date: ds, reason: 'Feriado' });       continue; }
    if (isBirthday(ds, bdayStr))   { excluded.push({ date: ds, reason: 'Cumpleaños' });    continue; }
    days++;
  }
  return { days, excluded };
}

// ── EMPLOYEES ──
const EMPLOYEES = [
  { cedula:'111840112', nombre:'Cristiana María Echandi Montero',  puesto:'Project Manager',             ingreso:'2019-10-01', consumidos:64,  email:'cechandi@leancr.com'   },
  { cedula:'116270838', nombre:'Alfonso Salomón Segura Salazar',   puesto:'Project Engineer',            ingreso:'2019-10-01', consumidos:57,  email:'asegura@leancr.com'    },
  { cedula:'111320139', nombre:'Cristián Fernández Cardos',        puesto:'Gerente General',             ingreso:'2019-10-01', consumidos:80,  email:'cfernandez@leancr.com' },
  { cedula:'305210209', nombre:'Sugey Elizabeth Mora Ureña',       puesto:'Project Engineer',            ingreso:'2022-09-15', consumidos:26,  email:'smora@leancr.com'      },
  { cedula:'115420183', nombre:'Edgard Allan Solís Chaverri',      puesto:'Project Manager',             ingreso:'2022-10-03', consumidos:21,  email:'asolis@leancr.com'     },
  { cedula:'114230764', nombre:'Carlos Andrés Gutiérrez Garbanzo', puesto:'Project Engineer',            ingreso:'2023-02-01', consumidos:23,  email:'cgutierrez@leancr.com' },
  { cedula:'117730278', nombre:'Maron Yanin Arrieta Hernández',    puesto:'Project Engineer',            ingreso:'2023-05-15', consumidos:24,  email:'marrieta@leancr.com'   },
  { cedula:'115780240', nombre:'Nicole Alexandra Cajina Cruz',     puesto:'Project Engineer',            ingreso:'2023-06-15', consumidos:25,  email:'ncajina@leancr.com'    },
  { cedula:'115570313', nombre:'Héctor Esteban Ureña Marín',       puesto:'Asistente Administrativo',    ingreso:'2024-02-26', consumidos:16,  email:'hurena@leancr.com'     },
  { cedula:'117870532', nombre:'María Fernanda Zeledón Barrios',   puesto:'Document Controller',         ingreso:'2024-03-18', consumidos:15,  email:'mzeledon@leancr.com'   },
  { cedula:'305130742', nombre:'Santiago Hernán Brenes Aguilar',   puesto:'Project Controller',          ingreso:'2024-04-01', consumidos:15,  email:'sbrenes@leancr.com'    },
  { cedula:'115840947', nombre:'Jesús Andrés Valverde Chaves',     puesto:'Site Construction Engineer',  ingreso:'2024-04-15', consumidos:12,  email:'avalverde@leancr.com'  },
  { cedula:'116700149', nombre:'Jorge Soto Badilla',               puesto:'MEP Engineer',                ingreso:'2024-09-09', consumidos:15,  email:'jsoto@leancr.com'      },
  { cedula:'117610198', nombre:'Keila Fernández Sandí',            puesto:'Coordinadora Administrativa', ingreso:'2025-03-03', consumidos:5.5, email:'kfernandez@leancr.com' },
  { cedula:'206160552', nombre:'Oscar Salazar Corrales',           puesto:'Ingeniero en Electrónica',    ingreso:'2025-06-09', consumidos:4,   email:'osalazar@leancr.com'   },
  { cedula:'303840620', nombre:'Humberto José Navarro Guzmán',     puesto:'Director de Proyectos',       ingreso:'2025-11-24', consumidos:6,   email:'hnavarro@leancr.com'   },
];

// ── STATE ──
let currentUser  = null;
let isAdmin      = false;
let currentType  = null;
let pendingTicket = null;
let tickets      = JSON.parse(localStorage.getItem('hr_tickets')     || '[]');
let expedientes  = JSON.parse(localStorage.getItem('hr_expedientes') || '{}');
let resolveData  = {};
let editData     = {};
let cancelData   = {};

// ── HELPERS ──
const fmt = d => {
  if (!d) return '—';
  if (typeof d === 'string' && d.match(/^\d{4}-\d{2}-\d{2}$/)) {
    const [y, m, day] = d.split('-'); return `${day}/${m}/${y}`;
  }
  if (d instanceof Date) return d.toLocaleDateString('es-CR');
  return d;
};
const tid    = () => 'TKT-' + Date.now().toString().slice(-6);
const tlabel = t => ({ vacaciones:'🏖️ Vacaciones', incapacidad:'🏥 Incapacidad', cumpleanos:'🎂 Cumpleaños', personalday:'⭐ Personal Day', singoce:'📤 Día Sin Goce' }[t] || t);
const slabel = s => ({ pending:'⏳ En Proceso', inprogress:'🔄 En Gestión', approved:'✅ Aprobada', denied:'❌ Denegada', cancelled:'🚫 Cancelada' }[s] || s);
const sbadge = s => `<span class="sb ${s || 'pending'}">${slabel(s)}</span>`;
const save    = () => localStorage.setItem('hr_tickets',     JSON.stringify(tickets));
const saveExp = () => localStorage.setItem('hr_expedientes', JSON.stringify(expedientes));
const getField = (id, def = '') => { const el = document.getElementById(id); return el ? el.value : def; };

function getEmpBirthday(emp) {
  const exp = expedientes[emp.cedula];
  return exp ? (exp.fnac || '') : '';
}

function calcVac(emp) {
  const hoy = new Date(), ini = new Date(emp.ingreso);
  let m = (hoy.getFullYear() - ini.getFullYear()) * 12 + (hoy.getMonth() - ini.getMonth());
  if (hoy.getDate() < ini.getDate()) m--;
  if (m < 0) m = 0;
  const dm  = new Date(hoy.getFullYear(), hoy.getMonth() + 1, 0).getDate();
  const im  = new Date(hoy.getFullYear(), hoy.getMonth(), ini.getDate());
  const f   = hoy >= im ? Math.min((hoy - im) / (dm * 864e5), 1) : 0;
  const acum = Math.floor(m + f);
  const ep  = tickets
    .filter(t => t.cedula === emp.cedula && t.tipo === 'vacaciones' && ['approved','inprogress','pending'].includes(t.status))
    .reduce((s, t) => s + (t.details.dias || 0), 0);
  const u   = Math.round((emp.consumidos + ep) * 10) / 10;
  const d   = Math.floor(acum - u);
  const prox = new Date(hoy.getFullYear(), hoy.getMonth() + 1, ini.getDate());
  return { meses: m, acum, usados: u, disp: d, pct: Math.min(100, Math.round((u / Math.max(acum, 1)) * 100)), prox };
}

// ── DAYS COUNTER ──
const typeFields = {
  vacaciones:  { ini: 'vac-ini', fin: 'vac-fin' },
  incapacidad: { ini: 'inc-ini', fin: 'inc-fin' },
  cumpleanos:  { ini: 'cum-ini', fin: 'cum-fin' },
  personalday: { ini: 'per-ini', fin: 'per-fin' },
  singoce:     { ini: 'sg-ini',  fin: 'sg-fin'  },
};

function calcDays(tipo) {
  const f = typeFields[tipo]; if (!f) return;
  const ini = getField(f.ini), fin = getField(f.fin);
  const ctr = document.getElementById('days-counter-' + tipo);
  if (!ini || !fin || fin < ini) { if (ctr) ctr.style.display = 'none'; return; }
  const bday = currentUser ? getEmpBirthday(currentUser) : '';
  const { days, excluded } = countWorkdays(ini, fin, bday);
  document.getElementById('days-val-'   + tipo).textContent = days;
  document.getElementById('days-range-' + tipo).textContent = `${fmt(ini)} → ${fmt(fin)}`;
  const exclEl = document.getElementById('days-excl-' + tipo);
  if (excluded.length > 0) {
    const fines   = excluded.filter(e => e.reason === 'Fin de semana').length;
    const feries  = excluded.filter(e => e.reason === 'Feriado').length;
    const cumple  = excluded.filter(e => e.reason === 'Cumpleaños').length;
    const parts   = [];
    if (fines)  parts.push(`${fines} fin(es) de semana`);
    if (feries) parts.push(`${feries} feriado(s)`);
    if (cumple) parts.push(`${cumple} día de cumpleaños`);
    exclEl.textContent = `Excluidos: ${parts.join(', ')}`;
  } else { exclEl.textContent = ''; }
  if (ctr) ctr.style.display = 'flex';
}

function calcEditDays() {
  const ini = getField('edit-ini'), fin = getField('edit-fin');
  const ctr = document.getElementById('edit-days-counter');
  if (!ini || !fin || fin < ini) { ctr.style.display = 'none'; return; }
  const bday = currentUser ? getEmpBirthday(currentUser) : '';
  const { days, excluded } = countWorkdays(ini, fin, bday);
  document.getElementById('edit-days-val').textContent   = days;
  document.getElementById('edit-days-range').textContent = `${fmt(ini)} → ${fmt(fin)}`;
  const exclEl = document.getElementById('edit-days-excl');
  const fines  = excluded.filter(e => e.reason === 'Fin de semana').length;
  const feries = excluded.filter(e => e.reason === 'Feriado').length;
  const cumple = excluded.filter(e => e.reason === 'Cumpleaños').length;
  const parts  = [];
  if (fines)  parts.push(`${fines} fin(es) de semana`);
  if (feries) parts.push(`${feries} feriado(s)`);
  if (cumple) parts.push(`${cumple} cumpleaños`);
  exclEl.textContent = parts.length ? `Excluidos: ${parts.join(', ')}` : '';
  ctr.style.display = 'flex';
}

// ══════════════════════════════
// AUTH
// ══════════════════════════════
function switchLoginTab(t, btn) {
  document.querySelectorAll('.login-tab').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  document.getElementById('empLogin').style.display   = t === 'emp'   ? 'block' : 'none';
  document.getElementById('adminLogin').style.display = t === 'admin' ? 'block' : 'none';
  document.getElementById('loginError').style.display = 'none';
}

function doLogin() {
  const v   = document.getElementById('cedulaInput').value.trim().replace(/[-.\s]/g, '');
  const emp = EMPLOYEES.find(e => e.cedula === v);
  const err = document.getElementById('loginError');
  if (!emp) { err.style.display = 'block'; err.textContent = '⚠️ Cédula no encontrada. Verifique e intente nuevamente.'; return; }
  err.style.display = 'none';
  currentUser = emp; isAdmin = false;
  tickets     = JSON.parse(localStorage.getItem('hr_tickets')     || '[]');
  expedientes = JSON.parse(localStorage.getItem('hr_expedientes') || '{}');
  show('appScreen');
  document.getElementById('userName').textContent  = emp.nombre.split(' ').slice(0, 2).join(' ');
  document.getElementById('userCedula').textContent = 'Cédula: ' + emp.cedula;
  document.getElementById('userAvatar').textContent = emp.nombre[0];
  updateStats(); renderTickets(); updateVacTab(); renderExpView();
}

function doAdminLogin() {
  const u   = document.getElementById('adminUser').value.trim();
  const p   = document.getElementById('adminPass').value;
  const err = document.getElementById('loginError');
  if (u !== ADMIN_USER || p !== ADMIN_PASS) {
    err.style.display = 'block'; err.textContent = '⚠️ Usuario o contraseña incorrectos.'; return;
  }
  err.style.display = 'none'; isAdmin = true;
  tickets     = JSON.parse(localStorage.getItem('hr_tickets')     || '[]');
  expedientes = JSON.parse(localStorage.getItem('hr_expedientes') || '{}');
  show('adminScreen');
  populateEmpFilter(); renderAdmin();
  const sel = document.getElementById('expEmpSelect');
  sel.innerHTML = '<option value="">— Seleccione un colaborador —</option>' +
    EMPLOYEES.map(e => `<option value="${e.cedula}">${e.nombre}</option>`).join('');
}

function doLogout() {
  currentUser = null; isAdmin = false; currentType = null;
  show('loginScreen');
  document.getElementById('cedulaInput').value = '';
  document.getElementById('adminUser').value   = '';
  document.getElementById('adminPass').value   = '';
  clearForm();
}

function show(id) {
  document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
  document.getElementById(id).classList.add('active');
}

// ══════════════════════════════
// TABS
// ══════════════════════════════
function showTab(id, btn) {
  document.querySelectorAll('#appScreen .tab-panel').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('#appScreen .tab-btn').forEach(b => b.classList.remove('active'));
  document.getElementById('tab-' + id).classList.add('active');
  if (btn) btn.classList.add('active');
  if (id === 'historial')   { tickets = JSON.parse(localStorage.getItem('hr_tickets') || '[]'); renderTickets(); }
  if (id === 'desglose')    { tickets = JSON.parse(localStorage.getItem('hr_tickets') || '[]'); updateVacTab(); }
  if (id === 'expediente')  { expedientes = JSON.parse(localStorage.getItem('hr_expedientes') || '{}'); renderExpView(); }
}

function showAdminTab(id, btn) {
  document.querySelectorAll('#adminScreen .tab-panel').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('#adminScreen .tab-btn').forEach(b => b.classList.remove('active'));
  document.getElementById('admin-tab-' + id).classList.add('active');
  if (btn) btn.classList.add('active');
}

// ══════════════════════════════
// FORM — Nueva Solicitud
// ══════════════════════════════
function selType(t) {
  currentType = t;
  document.querySelectorAll('.req-type').forEach(b => b.classList.remove('sel'));
  document.getElementById('type-' + t).classList.add('sel');
  document.querySelectorAll('.fg-group').forEach(g => g.style.display = 'none');
  document.querySelectorAll('[id^="days-counter-"]').forEach(d => d.style.display = 'none');
  document.getElementById('fields-' + t).style.display = 'block';
  document.getElementById('formFields').style.display  = 'block';
}

function clearForm() {
  currentType = null;
  document.querySelectorAll('.req-type').forEach(b => b.classList.remove('sel'));
  document.querySelectorAll('.fg-group').forEach(g => g.style.display = 'none');
  document.querySelectorAll('[id^="days-counter-"]').forEach(d => d.style.display = 'none');
  document.getElementById('formFields').style.display = 'none';
  document.getElementById('obs').value = '';
}

function submitRequest() {
  if (!currentType) { alert('Seleccione un tipo de solicitud'); return; }
  const obs  = getField('obs');
  const bday = getEmpBirthday(currentUser);
  const f    = typeFields[currentType];
  const ini  = getField(f.ini), fin = getField(f.fin);
  if (!ini || !fin) { alert('Complete las fechas de inicio y fin'); return; }
  if (fin < ini)    { alert('La fecha fin no puede ser anterior al inicio'); return; }
  const { days, excluded } = countWorkdays(ini, fin, bday);
  if (days === 0)   { alert('El rango no contiene días hábiles. Verifique las fechas.'); return; }

  let details = {};
  if (currentType === 'vacaciones') {
    const vac = calcVac(currentUser);
    if (days > vac.disp) { alert(`Solo tiene ${vac.disp} días disponibles. Está solicitando ${days}.`); return; }
    details = { inicio: ini, fin, dias: days, turno: getField('vac-mod'), excluidos: excluded.length };
  } else if (currentType === 'incapacidad') {
    details = { inicio: ini, fin, dias: days, tipo: getField('inc-tipo'), medico: getField('inc-med'), turno: getField('inc-turno'), excluidos: excluded.length };
  } else if (currentType === 'cumpleanos') {
    details = { inicio: ini, fin, dias: days, turno: getField('cum-turno'), excluidos: excluded.length };
  } else if (currentType === 'personalday') {
    details = { inicio: ini, fin, dias: days, turno: getField('per-turno'), motivo: getField('per-mot'), excluidos: excluded.length };
  } else if (currentType === 'singoce') {
    details = { inicio: ini, fin, dias: days, turno: getField('sg-turno'), motivo: getField('sg-mot'), excluidos: excluded.length };
  }

  pendingTicket = {
    id: tid(), tipo: currentType, status: 'pending',
    fecha: new Date().toISOString().split('T')[0],
    cedula: currentUser.cedula, empleado: currentUser.nombre, puesto: currentUser.puesto,
    details, obs, editCount: 0
  };
  showPreview(pendingTicket);
}

// ══════════════════════════════
// EMAIL
// ══════════════════════════════
function buildDet(t) {
  const d = t.details || {};
  let s = `Período: ${fmt(d.inicio)} al ${fmt(d.fin)}\nDías hábiles: ${d.dias}`;
  if (d.excluidos > 0) s += ` (${d.excluidos} excluido(s): fines de semana / feriados / cumpleaños)`;
  if (d.turno)         s += `\nTurno: ${d.turno}`;
  if (t.tipo === 'incapacidad')  s += `\nTipo: ${d.tipo || ''}\nMédico: ${d.medico || 'No indicado'}`;
  if (t.tipo === 'personalday')  s += `\nMotivo: ${d.motivo || ''}`;
  if (t.tipo === 'singoce')      s += `\nMotivo: ${d.motivo || ''}\n⚠️ No descuenta vacaciones, sí descuenta salario.`;
  return s;
}

function showPreview(t) {
  document.getElementById('emailPreview').innerHTML = `
    <span class="ef">Para:</span> ${GAS_EMAIL}<br>
    <span class="ef">Asunto:</span> [RRHH] Nueva solicitud — ${tlabel(t.tipo)} — ${t.empleado}<br>
    <hr>
    <span class="ef">Ticket:</span> ${t.id} &nbsp;|&nbsp; <span class="ef">Fecha:</span> ${fmt(t.fecha)}<br>
    <hr>
    <span class="ef">👤</span> ${t.empleado} · ${t.cedula} · ${t.puesto}<br>
    <hr>
    <span class="ef">📋 ${tlabel(t.tipo)}</span><br><br>
    ${buildDet(t).replace(/\n/g, '<br>')}<br><br>
    <span class="ef">💬</span> ${t.obs || 'Sin observaciones'}`;
  openModal('emailModal');
}

async function confirmSend() {
  closeModal('emailModal');
  tickets.push(pendingTicket); save();
  const t = pendingTicket;
  await sendEmail({
    to: GAS_EMAIL,
    asunto: `[RRHH] Nueva solicitud — ${tlabel(t.tipo)} — ${t.empleado}`,
    ticket_id: t.id, empleado: t.empleado, cedula: t.cedula, puesto: t.puesto,
    tipo: tlabel(t.tipo), fecha: fmt(t.fecha), detalles: buildDet(t),
    observaciones: t.obs || 'Ninguna', estado: '⏳ Pendiente de revisión',
    nota_admin: 'Nueva solicitud recibida.', msg_extra: ''
  }, null);
  toast('✅ Solicitud enviada', `Ticket ${t.id} registrado · Notificación enviada a RRHH`);
  clearForm(); updateStats(); renderTickets(); pendingTicket = null;
}

async function sendEmail(params, successMsg) {
  if (!GAS_URL) { if (successMsg) toast('⚠️ Sin GAS', 'Configure la URL del Google Apps Script'); return; }
  document.getElementById('sendingOverlay').classList.add('active');
  try {
    await fetch(`${GAS_URL}?${new URLSearchParams(params)}`, { method: 'GET', mode: 'no-cors' });
  } catch (e) { /* silencioso en no-cors */ }
  document.getElementById('sendingOverlay').classList.remove('active');
  if (successMsg) toast('📧', successMsg);
}

// ══════════════════════════════
// EDITAR / CANCELAR
// ══════════════════════════════
function openEdit(ticketId) {
  const t = tickets.find(t => t.id === ticketId); if (!t) return;
  editData = { ticketId };
  const rem = 2 - (t.editCount || 0);
  document.getElementById('editSubtitle').textContent = `${t.id} · ${tlabel(t.tipo)}`;
  document.getElementById('editWarning').textContent  = `⚠️ Le quedan ${rem} edición(es) disponibles para esta solicitud.`;
  document.getElementById('edit-ini').value   = t.details.inicio || '';
  document.getElementById('edit-fin').value   = t.details.fin    || '';
  document.getElementById('edit-turno').value = t.details.turno  || 'Día completo';
  document.getElementById('edit-reason').value = '';
  document.getElementById('edit-days-counter').style.display = 'none';
  calcEditDays();
  openModal('editModal');
}

async function confirmEdit() {
  const t   = tickets.find(t => t.id === editData.ticketId); if (!t) return;
  const ini = getField('edit-ini'), fin = getField('edit-fin');
  const turno  = getField('edit-turno');
  const reason = getField('edit-reason');
  if (!ini || !fin || fin < ini) { alert('Verifique las fechas'); return; }
  const bday = getEmpBirthday(currentUser);
  const { days } = countWorkdays(ini, fin, bday);
  t.details.inicio = ini; t.details.fin = fin; t.details.dias = days; t.details.turno = turno;
  t.editCount = (t.editCount || 0) + 1;
  t.ultimaEdicion = new Date().toISOString();
  t.motivoEdicion = reason;
  save(); closeModal('editModal');
  const emp = EMPLOYEES.find(e => e.cedula === t.cedula);
  const p = {
    ticket_id: t.id, empleado: t.empleado, cedula: t.cedula, puesto: t.puesto,
    tipo: tlabel(t.tipo), fecha: fmt(t.ultimaEdicion.split('T')[0]),
    detalles: buildDet(t), observaciones: t.obs || 'Ninguna',
    estado: '✏️ EDITADA (pendiente de revisión)',
    nota_admin: `Motivo de edición: ${reason || 'No indicado'}`,
    msg_extra: `Edición ${t.editCount} de 2.`
  };
  await sendEmail({ ...p, to: GAS_EMAIL, asunto: `[RRHH] Solicitud EDITADA — ${tlabel(t.tipo)} — ${t.empleado}` }, null);
  if (emp) await sendEmail({ ...p, to: emp.email, asunto: `Tu solicitud fue editada — ${tlabel(t.tipo)}` }, null);
  toast('✏️ Editada', `${t.id} · Edición ${t.editCount}/2 · Notificaciones enviadas`);
  renderTickets(); updateStats();
}

function openCancelReq(ticketId) {
  const t = tickets.find(t => t.id === ticketId); if (!t) return;
  cancelData = { ticketId };
  document.getElementById('cancelSubtitle').textContent = `${t.id} · ${tlabel(t.tipo)} · ${fmt(t.details.inicio)} → ${fmt(t.details.fin)}`;
  document.getElementById('cancelWarning').textContent  = '⚠️ Esta acción no se puede deshacer.';
  document.getElementById('cancel-reason').value = '';
  openModal('cancelModal');
}

async function confirmCancel() {
  const t      = tickets.find(t => t.id === cancelData.ticketId); if (!t) return;
  const reason = getField('cancel-reason');
  t.status   = 'cancelled';
  t.motivoCancelacion = reason;
  t.fechaCancelacion  = new Date().toISOString();
  save(); closeModal('cancelModal');
  const emp = EMPLOYEES.find(e => e.cedula === t.cedula);
  const p = {
    ticket_id: t.id, empleado: t.empleado, cedula: t.cedula, puesto: t.puesto,
    tipo: tlabel(t.tipo), fecha: fmt(t.fechaCancelacion.split('T')[0]),
    detalles: buildDet(t), observaciones: t.obs || 'Ninguna',
    estado: '🚫 CANCELADA por el colaborador',
    nota_admin: `Motivo: ${reason || 'No indicado'}`,
    msg_extra: 'El colaborador canceló esta solicitud.'
  };
  await sendEmail({ ...p, to: GAS_EMAIL, asunto: `[RRHH] Solicitud CANCELADA — ${tlabel(t.tipo)} — ${t.empleado}` }, null);
  if (emp) await sendEmail({ ...p, to: emp.email, asunto: `Tu solicitud fue cancelada — ${tlabel(t.tipo)}` }, null);
  toast('🚫 Cancelada', `${t.id} · Notificaciones enviadas`);
  renderTickets(); updateStats();
}

// ══════════════════════════════
// ADMIN — Solicitudes
// ══════════════════════════════
function populateEmpFilter() {
  const sel   = document.getElementById('filt-emp');
  const names = [...new Set(tickets.map(t => t.empleado))].sort();
  sel.innerHTML = '<option value="">Todos los empleados</option>' +
    names.map(n => `<option value="${n}">${n}</option>`).join('');
}

function resetFilters() {
  ['filt-status', 'filt-tipo', 'filt-emp'].forEach(id => document.getElementById(id).value = '');
  renderAdmin();
}

function renderAdmin() {
  tickets = JSON.parse(localStorage.getItem('hr_tickets') || '[]');
  const fs = document.getElementById('filt-status').value;
  const ft = document.getElementById('filt-tipo').value;
  const fe = document.getElementById('filt-emp').value;
  let list = [...tickets].reverse();
  if (fs) list = list.filter(t => t.status   === fs);
  if (ft) list = list.filter(t => t.tipo     === ft);
  if (fe) list = list.filter(t => t.empleado === fe);

  document.getElementById('adm-pend').textContent  = tickets.filter(t => t.status === 'pending').length;
  document.getElementById('adm-proc').textContent  = tickets.filter(t => t.status === 'inprogress').length;
  document.getElementById('adm-apro').textContent  = tickets.filter(t => t.status === 'approved').length;
  document.getElementById('adm-deny').textContent  = tickets.filter(t => t.status === 'denied').length;
  document.getElementById('adm-total').textContent = tickets.length;

  const el = document.getElementById('adminList');
  if (!list.length) {
    el.innerHTML = '<div class="empty-state"><div class="empty-icon">📋</div><div>No hay solicitudes con esos filtros</div></div>';
    return;
  }
  el.innerHTML = list.map(t => {
    const resolved = ['approved', 'denied', 'cancelled'].includes(t.status);
    const emp  = EMPLOYEES.find(e => e.cedula === t.cedula);
    const vac  = emp ? calcVac(emp) : null;
    const vi   = (vac && t.tipo === 'vacaciones')
      ? `<div class="at-meta" style="color:${vac.disp < 0 ? 'var(--red)' : vac.disp <= 3 ? 'var(--orange)' : 'var(--green)'}">💰 Saldo vacaciones: <strong>${vac.disp} días</strong></div>`
      : '';
    const sgNote = t.tipo === 'singoce'
      ? `<div class="at-meta" style="color:var(--orange)">⚠️ Sin goce: no descuenta vacaciones, sí descuenta salario</div>`
      : '';
    return `
    <div class="admin-ticket">
      <div class="at-head">
        <div>
          <div class="at-name">${t.empleado}</div>
          <div class="at-meta">${t.puesto} · <strong>${t.id}</strong> · ${fmt(t.fecha)}${emp ? ` · 📧 ${emp.email}` : ''}</div>
          ${vi}${sgNote}
          ${t.editCount ? `<div class="at-meta">✏️ Editada ${t.editCount}x · ${fmt((t.ultimaEdicion || '').split('T')[0])}</div>` : ''}
          ${t.resueltoFecha    ? `<div class="at-meta">✔️ Resuelto: ${fmt(t.resueltoFecha.split('T')[0])}</div>` : ''}
          ${t.fechaCancelacion ? `<div class="at-meta">🚫 Cancelado: ${fmt(t.fechaCancelacion.split('T')[0])}${t.motivoCancelacion ? ' · ' + t.motivoCancelacion : ''}</div>` : ''}
        </div>
        <div>${sbadge(t.status)}</div>
      </div>
      <div class="at-body">
        <div class="at-detail">
          <strong>${tlabel(t.tipo)}</strong><br>
          ${buildDet(t).replace(/\n/g, '<br>')}
          ${t.obs       ? `<br><em style="color:var(--g400)">💬 ${t.obs}</em>` : ''}
          ${t.notaAdmin ? `<br><span style="color:var(--b700);font-weight:600">📝 RRHH: ${t.notaAdmin}</span>` : ''}
        </div>
        <div class="at-btns">
          ${!resolved ? `
            <button class="btn-process" onclick="changeStatus('${t.id}','inprogress')">🔄 En Gestión</button>
            <button class="btn-approve" onclick="openResolve('${t.id}','approved')">✅ Aprobar</button>
            <button class="btn-deny"    onclick="openResolve('${t.id}','denied')">❌ Denegar</button>
          ` : `<span class="resolved-stamp ${t.status === 'approved' ? 'rs-approved' : t.status === 'cancelled' ? 'rs-cancelled' : 'rs-denied'}">${slabel(t.status)}</span>`}
        </div>
      </div>
    </div>`;
  }).join('');
}

function changeStatus(ticketId, ns) {
  const t = tickets.find(t => t.id === ticketId); if (!t) return;
  t.status = ns; save(); renderAdmin();
  toast('🔄 Actualizado', `${t.id} → ${slabel(ns)}`);
}

function openResolve(ticketId, action) {
  resolveData = { ticketId, action };
  const t   = tickets.find(t => t.id === ticketId);
  const emp = EMPLOYEES.find(e => e.cedula === t.cedula);
  const ia  = action === 'approved';
  document.getElementById('resolveTitle').textContent    = ia ? '✅ Aprobar solicitud' : '❌ Denegar solicitud';
  document.getElementById('resolveSubtitle').textContent = `${t.empleado} · ${tlabel(t.tipo)} · ${t.id}${emp ? ` · → ${emp.email}` : ''}`;
  document.getElementById('resolveNote').value = '';
  const btn = document.getElementById('resolveBtn');
  btn.textContent    = ia ? '✅ Confirmar aprobación' : '❌ Confirmar denegación';
  btn.style.background = ia
    ? 'linear-gradient(135deg,#10B981,#059669)'
    : 'linear-gradient(135deg,#EF4444,#DC2626)';
  openModal('resolveModal');
}

async function confirmResolve() {
  const { ticketId, action } = resolveData;
  const nota = getField('resolveNote');
  const t    = tickets.find(t => t.id === ticketId); if (!t) return;
  t.status       = action;
  t.notaAdmin    = nota;
  t.resueltoFecha = new Date().toISOString();
  save(); closeModal('resolveModal');
  const ia  = action === 'approved';
  const emp = EMPLOYEES.find(e => e.cedula === t.cedula);
  const p   = {
    ticket_id: t.id, empleado: t.empleado, cedula: t.cedula, puesto: t.puesto,
    tipo: tlabel(t.tipo), fecha: fmt(t.resueltoFecha.split('T')[0]),
    detalles: buildDet(t), observaciones: t.obs || 'Ninguna',
    estado: ia ? '✅ APROBADA' : '❌ DENEGADA',
    nota_admin: nota || (ia ? 'Solicitud aprobada.' : 'Solicitud denegada.'),
    msg_extra:  ia ? 'Su solicitud fue aprobada. Los días serán registrados.' : 'Su solicitud fue denegada. Contacte a RRHH.'
  };
  await sendEmail({ ...p, to: GAS_EMAIL, asunto: `[RRHH] ${ia ? 'APROBADA' : 'DENEGADA'} — ${tlabel(t.tipo)} — ${t.empleado}` }, null);
  if (emp) await sendEmail({ ...p, to: emp.email, asunto: `Tu solicitud fue ${ia ? 'aprobada ✅' : 'denegada ❌'} — ${tlabel(t.tipo)}` }, null);
  toast(ia ? '✅ Aprobada' : '❌ Denegada', `${t.id} · Notificaciones enviadas${emp ? ' a ' + emp.email : ''}`);
  renderAdmin();
}

// ══════════════════════════════
// ADMIN — Expedientes
// ══════════════════════════════
function loadExpAdmin() {
  const cedula = getField('expEmpSelect');
  if (!cedula) { alert('Seleccione un colaborador'); return; }
  const emp = EMPLOYEES.find(e => e.cedula === cedula);
  if (!emp) return;
  const exp = expedientes[cedula] || {};
  document.getElementById('expAdminForm').style.display = 'block';
  document.getElementById('expAdminName').textContent   = `✏️ Editando expediente de: ${emp.nombre}`;

  const set = (id, val) => { const el = document.getElementById(id); if (el) el.value = val || ''; };
  set('exp-cedula',    cedula);
  set('exp-nombres',   exp.nombres   || emp.nombre.split(' ').slice(0,2).join(' '));
  set('exp-ap1',       exp.ap1       || emp.nombre.split(' ').slice(2,3).join(''));
  set('exp-ap2',       exp.ap2       || emp.nombre.split(' ').slice(3,4).join(''));
  set('exp-genero',    exp.genero    || '');
  set('exp-fnac',      exp.fnac      || '');
  set('exp-nac',       exp.nac       || 'Costarricense');
  set('exp-pais',      exp.pais      || 'Costa Rica');
  set('exp-civil',     exp.civil     || '');
  set('exp-hijos',     exp.hijos     || '');
  set('exp-prov',      exp.prov      || '');
  set('exp-canton',    exp.canton    || '');
  set('exp-distrito',  exp.distrito  || '');
  set('exp-direccion', exp.direccion || '');
  set('exp-tel',       exp.tel       || '');
  set('exp-emailpers', exp.emailpers || '');
  set('exp-emerg-nom', exp.emergNom  || '');
  set('exp-emerg-tel', exp.emergTel  || '');
  set('exp-iban',      exp.iban      || '');
  set('exp-profesion', exp.profesion || emp.puesto);
  set('exp-estudios',  exp.estudios  || '');
  set('exp-meds',      exp.meds      || '');
  set('exp-alergias',  exp.alergias  || '');
  document.getElementById('expAdminForm').scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function saveExpAdmin() {
  const cedula = getField('exp-cedula'); if (!cedula) return;
  expedientes[cedula] = {
    nombres:   getField('exp-nombres'),  ap1:      getField('exp-ap1'),
    ap2:       getField('exp-ap2'),      genero:   getField('exp-genero'),
    fnac:      getField('exp-fnac'),     nac:      getField('exp-nac'),
    pais:      getField('exp-pais'),     civil:    getField('exp-civil'),
    hijos:     getField('exp-hijos'),    prov:     getField('exp-prov'),
    canton:    getField('exp-canton'),   distrito: getField('exp-distrito'),
    direccion: getField('exp-direccion'),tel:      getField('exp-tel'),
    emailpers: getField('exp-emailpers'),emergNom: getField('exp-emerg-nom'),
    emergTel:  getField('exp-emerg-tel'),iban:     getField('exp-iban'),
    profesion: getField('exp-profesion'),estudios: getField('exp-estudios'),
    meds:      getField('exp-meds'),     alergias: getField('exp-alergias'),
    updatedAt: new Date().toISOString()
  };
  saveExp();
  toast('💾 Expediente guardado', `Expediente de ${EMPLOYEES.find(e => e.cedula === cedula)?.nombre || cedula} actualizado`);
  document.getElementById('expAdminForm').style.display = 'none';
  document.getElementById('expEmpSelect').value = '';
}

// ══════════════════════════════
// EMPLOYEE — Vistas
// ══════════════════════════════
function renderExpView() {
  if (!currentUser) return;
  const exp = expedientes[currentUser.cedula];
  const el  = document.getElementById('expView');
  if (!exp || Object.keys(exp).length === 0) {
    el.innerHTML = `
      <div class="exp-empty">
        <div class="exp-icon">📋</div>
        <p>Su expediente aún no ha sido completado por RRHH.<br>Contacte a su administrador para solicitarlo.</p>
      </div>`;
    return;
  }
  const field = (label, val) => `
    <div class="exp-field">
      <div class="exp-field-label">${label}</div>
      <div class="exp-field-val ${!val ? 'empty' : ''}">${val || 'No registrado'}</div>
    </div>`;

  el.innerHTML = `
    <div class="section-header"><div class="sh-icon">👤</div><h3>Datos Personales</h3></div>
    <div class="exp-grid">
      ${field('Nombre(s)',        exp.nombres)}
      ${field('Primer Apellido',  exp.ap1)}
      ${field('Segundo Apellido', exp.ap2)}
      ${field('Género',           exp.genero)}
      ${field('Cédula',           currentUser.cedula)}
      ${field('Fecha Nacimiento', exp.fnac)}
      ${field('Nacionalidad',     exp.nac)}
      ${field('País de Nacimiento', exp.pais)}
      ${field('Estado Civil',     exp.civil)}
      ${field('Número de Hijos',  exp.hijos)}
    </div>
    <div class="section-header"><div class="sh-icon">📍</div><h3>Dirección Actual</h3></div>
    <div class="exp-grid">
      ${field('Provincia',        exp.prov)}
      ${field('Cantón',           exp.canton)}
      ${field('Distrito',         exp.distrito)}
    </div>
    <div class="exp-field" style="margin-top:12px">
      <div class="exp-field-label">Dirección Exacta</div>
      <div class="exp-field-val ${!exp.direccion ? 'empty' : ''}">${exp.direccion || 'No registrado'}</div>
    </div>
    <div class="section-header"><div class="sh-icon">📞</div><h3>Contacto</h3></div>
    <div class="exp-grid">
      ${field('Teléfono Personal',        exp.tel)}
      ${field('Correo Personal',          exp.emailpers)}
      ${field('Contacto de Emergencia',   exp.emergNom)}
      ${field('Teléfono de Emergencia',   exp.emergTel)}
    </div>
    <div class="section-header"><div class="sh-icon">🏦</div><h3>Información Bancaria y Laboral</h3></div>
    <div class="exp-grid">
      ${field('IBAN (Tarjeta de Planilla)', exp.iban)}
      ${field('Profesión',                  exp.profesion)}
      ${field('Otros Estudios',             exp.estudios)}
    </div>
    <div class="section-header"><div class="sh-icon">🏥</div><h3>Información Médica</h3></div>
    <div class="exp-grid">
      ${field('Medicamentos', exp.meds)}
      ${field('Alergias',     exp.alergias)}
    </div>
    <p style="font-size:11px;color:var(--g400);margin-top:14px;text-align:right">
      Última actualización: ${exp.updatedAt ? fmt(exp.updatedAt.split('T')[0]) : '—'}
    </p>`;
}

function renderTickets() {
  if (!currentUser) return;
  tickets = JSON.parse(localStorage.getItem('hr_tickets') || '[]');
  const mine = tickets.filter(t => t.cedula === currentUser.cedula).reverse();
  const el   = document.getElementById('ticketsList');
  if (!mine.length) {
    el.innerHTML = '<div class="empty-state"><div class="empty-icon">📋</div><div>No tiene solicitudes registradas aún</div></div>';
    return;
  }
  el.innerHTML = mine.map(t => {
    const canEdit   = ['pending', 'inprogress'].includes(t.status) && (t.editCount || 0) < 2;
    const canCancel = ['pending', 'inprogress'].includes(t.status);
    const edits     = t.editCount || 0;
    return `
    <div class="ticket">
      <div class="ticket-top">
        <div>
          <div class="ticket-header">
            <span class="tid">${t.id}</span>
            <span class="ttype">${tlabel(t.tipo)}</span>
            ${edits > 0 ? `<span class="edit-counter">✏️ editada ${edits}/2</span>` : ''}
          </div>
          <div class="tdesc">
            📅 ${fmt(t.details.inicio)} → ${fmt(t.details.fin)}
            &nbsp;·&nbsp; <strong>${t.details.dias} día(s) hábil(es)</strong>
            &nbsp;·&nbsp; ${t.details.turno || 'Día completo'}
            ${t.details.excluidos > 0 ? `<span style="color:var(--orange);font-size:10px"> · ${t.details.excluidos} excluido(s)</span>` : ''}
            ${t.tipo === 'incapacidad' ? ` · ${t.details.tipo}` : ''}
            ${t.tipo === 'personalday' ? ` · ${t.details.motivo}` : ''}
            ${t.tipo === 'singoce'     ? ` · ${t.details.motivo || 'Sin goce de salario'}` : ''}
          </div>
          ${t.notaAdmin       ? `<div class="tdesc" style="color:var(--b700);margin-top:3px">📝 RRHH: <em>${t.notaAdmin}</em></div>` : ''}
          ${t.obs             ? `<div class="tdesc" style="font-style:italic;color:var(--g400)">💬 ${t.obs}</div>` : ''}
          ${t.motivoCancelacion ? `<div class="tdesc" style="color:var(--red);margin-top:3px">🚫 Cancelada: ${t.motivoCancelacion}</div>` : ''}
        </div>
        <div style="display:flex;flex-direction:column;align-items:flex-end;gap:4px">
          ${sbadge(t.status)}
          <div style="font-size:10px;color:var(--g400)">${fmt(t.fecha)}</div>
          ${t.resueltoFecha ? `<div style="font-size:10px;color:var(--green)">✔ ${fmt(t.resueltoFecha.split('T')[0])}</div>` : ''}
        </div>
      </div>
      ${(canEdit || canCancel) ? `
      <div class="ticket-actions">
        ${canEdit   ? `<button class="btn-edit"       onclick="openEdit('${t.id}')">✏️ Editar (${2 - edits} restante${2 - edits === 1 ? '' : 's'})</button>` : ''}
        ${canCancel ? `<button class="btn-cancel-req" onclick="openCancelReq('${t.id}')">🚫 Cancelar</button>` : ''}
      </div>` : ''}
    </div>`;
  }).join('');
}

function updateStats() {
  if (!currentUser) return;
  tickets = JSON.parse(localStorage.getItem('hr_tickets') || '[]');
  const mine = tickets.filter(t => t.cedula === currentUser.cedula);
  const vac  = calcVac(currentUser);
  const dEl  = document.getElementById('statVac');
  dEl.textContent = vac.disp < 0 ? vac.disp + ' ⚠️' : vac.disp;
  dEl.style.color = vac.disp < 0 ? 'var(--red)' : vac.disp <= 3 ? 'var(--orange)' : 'var(--g800)';
  document.getElementById('statApro').textContent = mine.filter(t => t.status === 'approved').length;
  document.getElementById('statPend').textContent = mine.filter(t => ['pending','inprogress'].includes(t.status)).length;
}

function updateVacTab() {
  if (!currentUser) return;
  const v    = calcVac(currentUser);
  document.getElementById('vacIngreso').textContent = fmt(currentUser.ingreso);
  document.getElementById('vacMeses').textContent   = v.meses;
  document.getElementById('vacAcum').textContent    = v.acum;
  document.getElementById('vacCons').textContent    = v.usados;
  const dEl  = document.getElementById('vacDisp');
  dEl.textContent = v.disp < 0 ? v.disp + ' ⚠️' : v.disp;
  dEl.style.color = v.disp < 0 ? 'var(--red)' : v.disp <= 3 ? 'var(--orange)' : 'var(--green)';
  const prog = document.getElementById('vacProg');
  prog.style.width      = v.pct + '%';
  prog.style.background = v.pct >= 100
    ? 'linear-gradient(90deg,var(--orange),var(--red))'
    : v.pct >= 80
      ? 'linear-gradient(90deg,var(--orange),#F59E0B)'
      : 'linear-gradient(90deg,var(--b400),var(--b600))';
  document.getElementById('vacProx').textContent = fmt(v.prox);
}

// ══════════════════════════════
// MODALS & TOAST
// ══════════════════════════════
function openModal(id)  { document.getElementById(id).classList.add('active'); }
function closeModal(id) { document.getElementById(id).classList.remove('active'); }

function toast(title, msg) {
  document.getElementById('toastTitle').textContent = title;
  document.getElementById('toastMsg').textContent   = msg;
  const el = document.getElementById('toast');
  el.style.display = 'block';
  clearTimeout(window._toastTimer);
  window._toastTimer = setTimeout(() => el.style.display = 'none', 5500);
}
