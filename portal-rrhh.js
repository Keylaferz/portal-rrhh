// ══════════════════════════════════════════════════════
//  Portal RRHH — Lean Consulting S.A.
//  Google Apps Script — Base de datos + Correos
//
//  ⚠️  CONFIGURACIÓN SEGURA — Las credenciales NO van
//  en el código. Se configuran en:
//  GAS → Configuración del proyecto → Propiedades del script
//
//  Claves a agregar:
//  SHEET_ID    → ID de su Google Sheet
//  ADMIN_PASS  → contraseña del administrador
//  EMAIL_RRHH1 → kfernandez@leancr.com
//  EMAIL_RRHH2 → cfernandez@leancr.com
// ══════════════════════════════════════════════════════

function getConfig() {
  const p = PropertiesService.getScriptProperties();
  return {
    SHEET_ID:   p.getProperty('SHEET_ID')    || '',
    ADMIN_PASS: p.getProperty('ADMIN_PASS')  || '',
    EMAIL_1:    p.getProperty('EMAIL_RRHH1') || 'kfernandez@leancr.com',
    EMAIL_2:    p.getProperty('EMAIL_RRHH2') || 'cfernandez@leancr.com',
  };
}

const ADMIN_USER        = 'admin';
const SHEET_TICKETS     = 'tickets';
const SHEET_EXPEDIENTES = 'expedientes';
const SHEET_EMPLEADOS   = 'empleados';
const SHEET_LOG         = 'log';

// ══════════════════════════════════════════════════════
//  PUNTO DE ENTRADA
// ══════════════════════════════════════════════════════
function doGet(e) {
  const p      = e.parameter || {};
  const action = p.action    || '';
  try {
    let result;
    switch (action) {
      case 'getEmpleados':   result = getEmpleados();              break;
      case 'getTickets':     result = getTickets(p.cedula || '');  break;
      case 'saveTicket':     result = saveTicket(p);               break;
      case 'updateTicket':   result = updateTicket(p);             break;
      case 'getExpediente':  result = getExpediente(p.cedula||''); break;
      case 'saveExpediente': result = saveExpediente(p);           break;
      case 'sendEmail':      result = sendEmailAction(p);          break;
      case 'authAdmin':      result = authAdmin(p.user||'',p.pass||''); break;
      case 'addEmpleado':    result = addEmpleado(p);    break;
      case 'updateEmpleado': result = updateEmpleado(p); break;
      case 'deleteEmpleado': result = deleteEmpleado(p.cedula||''); break;
      default: result = { ok: false, error: 'Acción no reconocida: ' + action };
    }
    return jsonResponse(result);
  } catch (err) {
    logError(action, err.toString());
    return jsonResponse({ ok: false, error: err.toString() });
  }
}

// ══════════════════════════════════════════════════════
//  HELPERS
// ══════════════════════════════════════════════════════
function getSheet(name) {
  const cfg = getConfig();
  return SpreadsheetApp.openById(cfg.SHEET_ID).getSheetByName(name);
}

function jsonResponse(data) {
  return ContentService
    .createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
}

function sheetToObjects(sheet) {
  const data = sheet.getDataRange().getValues();
  if (data.length < 2) return [];
  const headers = data[0];
  return data.slice(1).map(row => {
    const obj = {};
    headers.forEach((h, i) => obj[h] = row[i] !== undefined ? row[i].toString() : '');
    return obj;
  });
}

function logEntry(usuario, accion, detalle) {
  try { getSheet(SHEET_LOG).appendRow([new Date().toISOString(), usuario, accion, detalle]); } catch(e) {}
}

function logError(accion, error) {
  try { getSheet(SHEET_LOG).appendRow([new Date().toISOString(), 'SISTEMA', 'ERROR:'+accion, error]); } catch(e) {}
}

// ══════════════════════════════════════════════════════
//  EMPLEADOS
// ══════════════════════════════════════════════════════
function getEmpleados() {
  return { ok: true, data: sheetToObjects(getSheet(SHEET_EMPLEADOS)) };
}

// ══════════════════════════════════════════════════════
//  TICKETS
// ══════════════════════════════════════════════════════
function getTickets(cedula) {
  let data = sheetToObjects(getSheet(SHEET_TICKETS));
  if (cedula) data = data.filter(t => t.cedula === cedula);
  return { ok: true, data };
}

function saveTicket(p) {
  getSheet(SHEET_TICKETS).appendRow([
    p.id, p.cedula, p.empleado, p.puesto, p.tipo,
    'pending', new Date().toISOString(),
    p.inicio, p.fin, p.dias, p.turno||'', p.excluidos||'0',
    p.obs||'', '', '0', '', '', '', '', '', p.motivo||''
  ]);
  logEntry(p.empleado, 'Nueva solicitud', p.id + ' — ' + p.tipo);
  return { ok: true, id: p.id };
}

function updateTicket(p) {
  const sheet   = getSheet(SHEET_TICKETS);
  const data    = sheet.getDataRange().getValues();
  const headers = data[0];
  const idCol   = headers.indexOf('id');
  const colMap  = {};
  headers.forEach((h, i) => colMap[h] = i + 1);

  for (let i = 1; i < data.length; i++) {
    if (data[i][idCol] === p.id) {
      const campos = ['status','notaAdmin','resueltoFecha','fechaCancelacion',
                      'motivoCancelacion','editCount','ultimaEdicion','motivoEdicion',
                      'inicio','fin','dias','turno'];
      campos.forEach(c => { if (p[c]) sheet.getRange(i+1, colMap[c]).setValue(p[c]); });
      logEntry(p.empleado||'Admin', 'Actualiza ticket', p.id+' → '+(p.status||'editado'));
      return { ok: true };
    }
  }
  return { ok: false, error: 'Ticket no encontrado: ' + p.id };
}

// ══════════════════════════════════════════════════════
//  EXPEDIENTES
// ══════════════════════════════════════════════════════
function getExpediente(cedula) {
  const data = sheetToObjects(getSheet(SHEET_EXPEDIENTES));
  return { ok: true, data: data.find(e => e.cedula === cedula) || null };
}

function saveExpediente(p) {
  const sheet   = getSheet(SHEET_EXPEDIENTES);
  const data    = sheet.getDataRange().getValues();
  const headers = data[0];
  const ceduCol = headers.indexOf('cedula');

  // Encabezados hoja expedientes deben incluir 'salario'
  const row = [
    p.cedula, p.nombres, p.ap1, p.ap2, p.genero,
    p.fnac, p.nac, p.pais, p.civil, p.hijos,
    p.prov, p.canton, p.distrito, p.direccion,
    p.tel, p.emailpers, p.emergNom, p.emergTel,
    p.iban, p.profesion, p.estudios,
    p.salario || '',
    p.meds, p.alergias,
    new Date().toISOString()
  ];

  for (let i = 1; i < data.length; i++) {
    if (data[i][ceduCol] === p.cedula) {
      sheet.getRange(i+1, 1, 1, row.length).setValues([row]);
      logEntry('Admin', 'Actualiza expediente', p.cedula + ' — ' + p.nombres);
      syncEmpleadoFromExp(p);
      return { ok: true, action: 'updated' };
    }
  }
  sheet.appendRow(row);
  logEntry('Admin', 'Crea expediente', p.cedula + ' — ' + p.nombres);
  // Sync empleados sheet with key fields from expediente
  syncEmpleadoFromExp(p);
  return { ok: true, action: 'created' };
}

// When expediente is saved, update puesto/ingreso/email in empleados sheet
function syncEmpleadoFromExp(p) {
  try {
    const update = {};
    if (p.profesion) update.puesto   = p.profesion;
    if (p.ingreso)   update.ingreso  = p.ingreso;
    if (p.emailpers) update.email    = p.emailpers;
    if (Object.keys(update).length > 0) {
      update.cedula   = p.cedula;
      update.empleado = p.nombres || '';
      updateEmpleado(update);
    }
  } catch(e) {}
}

// ══════════════════════════════════════════════════════
//  AUTH ADMIN
// ══════════════════════════════════════════════════════
function authAdmin(user, pass) {
  const cfg = getConfig();
  // Si ADMIN_PASS no está en Script Properties, usa 'rrhh2024' por defecto
  const validPass = cfg.ADMIN_PASS || 'rrhh2024';
  return (user === ADMIN_USER && pass === validPass)
    ? { ok: true }
    : { ok: false, error: 'Credenciales incorrectas' };
}

// ══════════════════════════════════════════════════════
//  CORREOS — envía siempre a los DOS correos de RRHH
//  + al colaborador si se indica en p.to
// ══════════════════════════════════════════════════════
function sendEmailAction(p) {
  const cfg    = getConfig();
  const asunto = p.asunto || 'Notificación Portal RRHH';
  const estado = p.estado || '';

  const esAprobado  = estado.includes('APROBADA');
  const esDenegado  = estado.includes('DENEGADA');
  const esCancelado = estado.includes('CANCELADA');
  const esEditado   = estado.includes('EDITADA');

  const colorEstado = esAprobado  ? '#065F46' :
                      esDenegado  ? '#991B1B' :
                      esCancelado ? '#64748B' :
                      esEditado   ? '#92400E' : '#1D4ED8';
  const bgEstado    = esAprobado  ? '#D1FAE5' :
                      esDenegado  ? '#FEE2E2' :
                      esCancelado ? '#F1F5F9' :
                      esEditado   ? '#FEF3C7' : '#DBEAFE';

  const html = `<!DOCTYPE html>
<html><head><meta charset="UTF-8"/></head>
<body style="margin:0;padding:0;background:#F1F5F9;font-family:'Segoe UI',Arial,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#F1F5F9;padding:32px 0;">
<tr><td align="center">
<table width="580" cellpadding="0" cellspacing="0" style="background:#fff;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,.08);">
  <tr><td style="background:linear-gradient(135deg,#1D4ED8,#3B82F6);padding:28px 32px;">
    <table width="100%"><tr>
      <td><div style="font-size:11px;color:#BFDBFE;letter-spacing:1px;text-transform:uppercase;margin-bottom:4px;">Lean Consulting S.A.</div>
          <div style="font-size:22px;font-weight:700;color:#fff;">Portal de Recursos Humanos</div></td>
      <td align="right"><div style="font-size:32px;">🏢</div></td>
    </tr></table>
  </td></tr>
  <tr><td style="padding:0 32px;">
    <div style="background:${bgEstado};color:${colorEstado};padding:10px 18px;border-radius:0 0 10px 10px;font-size:13px;font-weight:700;display:inline-block;">${estado}</div>
  </td></tr>
  <tr><td style="padding:24px 32px 0;">
    <table width="100%" style="background:#F8FAFC;border-radius:10px;padding:16px;" cellpadding="8">
      <tr><td style="font-size:11px;color:#94A3B8;font-weight:700;text-transform:uppercase;width:140px;">Ticket</td><td style="font-size:14px;color:#1E293B;font-weight:600;">${p.ticket_id||'—'}</td></tr>
      <tr><td style="font-size:11px;color:#94A3B8;font-weight:700;text-transform:uppercase;">Colaborador</td><td style="font-size:14px;color:#1E293B;">${p.empleado||'—'}</td></tr>
      <tr><td style="font-size:11px;color:#94A3B8;font-weight:700;text-transform:uppercase;">Cédula</td><td style="font-size:14px;color:#1E293B;">${p.cedula||'—'}</td></tr>
      <tr><td style="font-size:11px;color:#94A3B8;font-weight:700;text-transform:uppercase;">Puesto</td><td style="font-size:14px;color:#1E293B;">${p.puesto||'—'}</td></tr>
      <tr><td style="font-size:11px;color:#94A3B8;font-weight:700;text-transform:uppercase;">Tipo</td><td style="font-size:14px;color:#1E293B;font-weight:600;">${p.tipo||'—'}</td></tr>
      <tr><td style="font-size:11px;color:#94A3B8;font-weight:700;text-transform:uppercase;">Fecha</td><td style="font-size:14px;color:#1E293B;">${p.fecha||'—'}</td></tr>
    </table>
  </td></tr>
  <tr><td style="padding:16px 32px 0;">
    <div style="font-size:11px;color:#94A3B8;font-weight:700;text-transform:uppercase;margin-bottom:8px;">Detalle de la solicitud</div>
    <div style="background:#EFF6FF;border-left:4px solid #3B82F6;border-radius:0 8px 8px 0;padding:14px 16px;font-size:13px;color:#1E293B;line-height:1.8;white-space:pre-line;">${p.detalles||'—'}</div>
  </td></tr>
  ${p.observaciones && p.observaciones !== 'Ninguna' ? `
  <tr><td style="padding:16px 32px 0;">
    <div style="font-size:11px;color:#94A3B8;font-weight:700;text-transform:uppercase;margin-bottom:8px;">Observaciones</div>
    <div style="background:#F8FAFC;border-radius:8px;padding:12px 14px;font-size:13px;color:#475569;font-style:italic;">${p.observaciones}</div>
  </td></tr>` : ''}
  ${p.nota_admin ? `
  <tr><td style="padding:16px 32px 0;">
    <div style="font-size:11px;color:#94A3B8;font-weight:700;text-transform:uppercase;margin-bottom:8px;">Nota de RRHH</div>
    <div style="background:#EDE9FE;border-left:4px solid #7C3AED;border-radius:0 8px 8px 0;padding:14px 16px;font-size:13px;color:#5B21B6;font-weight:500;">${p.nota_admin}</div>
  </td></tr>` : ''}
  ${p.msg_extra ? `<tr><td style="padding:16px 32px 0;"><div style="font-size:13px;color:#475569;">${p.msg_extra}</div></td></tr>` : ''}
  <tr><td style="padding:28px 32px;">
    <hr style="border:none;border-top:1px solid #E2E8F0;margin-bottom:20px;"/>
    <div style="font-size:11px;color:#94A3B8;text-align:center;line-height:1.8;">
      © 2026 <strong style="color:#1D4ED8;">Lean Consulting S.A.</strong> — Portal de Recursos Humanos<br/>
      Correo automático generado por el portal · No responder directamente.
    </div>
  </td></tr>
</table></td></tr></table>
</body></html>`;

  // Un solo correo compartido — todos ven el mismo hilo
  // El colaborador va en "to", RRHH va en "cc"
  const toAddr = p.to && p.to !== cfg.EMAIL_1 && p.to !== cfg.EMAIL_2
    ? p.to
    : cfg.EMAIL_1;

  const ccSet = new Set();
  ccSet.add(cfg.EMAIL_1); // kfernandez@leancr.com
  ccSet.add(cfg.EMAIL_2); // cfernandez@leancr.com
  if (p.to) ccSet.add(p.to);
  ccSet.delete(toAddr); // evitar duplicado entre to y cc
  const ccAddr = [...ccSet].join(',');

  try {
    GmailApp.sendEmail(toAddr, asunto, '', {
      htmlBody: html,
      cc: ccAddr,
      replyTo: Session.getActiveUser().getEmail(),
      name: 'Portal RRHH — Lean Consulting S.A.'
    });
    logEntry('Sistema', 'Correo enviado', 'Para: ' + toAddr + ' | CC: ' + ccAddr + ' | ' + asunto);
    return { ok: true, to: toAddr, cc: ccAddr };
  } catch(err) {
    logError('sendEmail', err.toString());
    return { ok: false, error: err.toString() };
  }
}

// ══════════════════════════════════════════════════════
//  GESTIÓN DE EMPLEADOS
// ══════════════════════════════════════════════════════
function addEmpleado(p) {
  const sheet   = getSheet(SHEET_EMPLEADOS);
  const data    = sheet.getDataRange().getValues();
  const headers = data[0];
  const ceduCol = headers.indexOf('cedula');

  // Verificar si ya existe
  for (let i = 1; i < data.length; i++) {
    if (String(data[i][ceduCol]) === String(p.cedula)) {
      return { ok: false, error: 'Ya existe un colaborador con esa cédula' };
    }
  }

  // Agregar columna 'acceso' si no existe
  if (!headers.includes('acceso')) {
    sheet.getRange(1, headers.length + 1).setValue('acceso');
  }

  sheet.appendRow([
    p.cedula, p.nombre, p.puesto||'', p.ingreso||'',
    parseFloat(p.consumidos)||0, p.email||'',
    parseFloat(p.pdTotal)||3,
    parseFloat(p.pdUsados)||0,
    parseInt(p.pdAnio)||new Date().getFullYear(),
    p.acceso||'activo'
  ]);
  logEntry('Admin', 'Agrega empleado', p.cedula + ' — ' + p.nombre);
  return { ok: true, action: 'created' };
}

function updateEmpleado(p) {
  const sheet   = getSheet(SHEET_EMPLEADOS);
  const data    = sheet.getDataRange().getValues();
  const headers = data[0];
  const ceduCol = headers.indexOf('cedula');
  const colMap  = {};
  headers.forEach((h, i) => colMap[h] = i + 1);

  for (let i = 1; i < data.length; i++) {
    if (String(data[i][ceduCol]) === String(p.cedula)) {
      const campos = {};
      if (p.nombre    !== undefined) campos.nombre     = p.nombre;
      if (p.puesto    !== undefined) campos.puesto     = p.puesto;
      if (p.ingreso   !== undefined) campos.ingreso    = p.ingreso;
      if (p.consumidos!== undefined) campos.consumidos = parseFloat(p.consumidos)||0;
      if (p.email     !== undefined) campos.email      = p.email;
      if (p.pdTotal   !== undefined) campos.pdTotal    = parseFloat(p.pdTotal)||3;
      if (p.pdUsados  !== undefined) campos.pdUsados   = parseFloat(p.pdUsados)||0;
      if (p.pdAnio    !== undefined) campos.pdAnio     = parseInt(p.pdAnio)||new Date().getFullYear();
      if (p.acceso    !== undefined) campos.acceso     = p.acceso;
      Object.entries(campos).forEach(([col, val]) => {
        if (colMap[col]) sheet.getRange(i+1, colMap[col]).setValue(val);
      });
      logEntry('Admin', 'Actualiza empleado', p.cedula + ' — ' + p.nombre);
      return { ok: true, action: 'updated' };
    }
  }
  return { ok: false, error: 'Empleado no encontrado: ' + p.cedula };
}

function deleteEmpleado(cedula) {
  const sheet   = getSheet(SHEET_EMPLEADOS);
  const data    = sheet.getDataRange().getValues();
  const headers = data[0];
  const ceduCol = headers.indexOf('cedula');

  for (let i = 1; i < data.length; i++) {
    if (String(data[i][ceduCol]) === String(cedula)) {
      const nombre = data[i][headers.indexOf('nombre')] || cedula;
      sheet.deleteRow(i + 1);
      logEntry('Admin', 'Elimina empleado', cedula + ' — ' + nombre);
      return { ok: true, deleted: cedula };
    }
  }
  return { ok: false, error: 'Empleado no encontrado: ' + cedula };
}

// ══════════════════════════════════════════════════════
//  FUNCIÓN DE PRUEBA — Ejecutar manualmente desde el editor
//  Seleccione "testCorreo" en el dropdown y presione ▶
// ══════════════════════════════════════════════════════
function testCorreo() {
  const resultado = sendEmailAction({
    to: 'kfernandez@leancr.com',
    asunto: 'Prueba Portal RRHH',
    estado: '✅ APROBADA',
    ticket_id: 'TKT-TEST',
    empleado: 'Prueba Manual',
    cedula: '000000000',
    puesto: 'Test',
    tipo: '🏖️ Vacaciones',
    fecha: '12/03/2026',
    detalles: 'Período: 01/04/2026 al 05/04/2026\nDías hábiles: 5',
    observaciones: 'Prueba directa desde GAS',
    nota_admin: 'Test exitoso',
    msg_extra: 'Este es un correo de prueba.'
  });
  Logger.log('Resultado: ' + JSON.stringify(resultado));
}