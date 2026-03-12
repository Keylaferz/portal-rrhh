// ══════════════════════════════════════════════════════
//  Portal RRHH — Lean Consulting S.A.
//  Google Apps Script — Base de datos + Correos
//  
//  CONFIGURACIÓN: Cambie el ID del Sheet abajo
// ══════════════════════════════════════════════════════

const SHEET_ID    = 'PEGUE_AQUI_EL_ID_DE_SU_GOOGLE_SHEET';
const EMAIL_RRHH  = 'rrhh@leancr.com'; // ← cambie al correo real de RRHH
const ADMIN_USER  = 'admin';
const ADMIN_PASS  = 'rrhh2024';        // ← cambie la contraseña

// ── Nombres de hojas ──
const SHEET_TICKETS     = 'tickets';
const SHEET_EXPEDIENTES = 'expedientes';
const SHEET_EMPLEADOS   = 'empleados';
const SHEET_LOG         = 'log';

// ══════════════════════════════════════════════════════
//  PUNTO DE ENTRADA — Maneja todas las peticiones GET
// ══════════════════════════════════════════════════════
function doGet(e) {
  const p      = e.parameter || {};
  const action = p.action    || '';

  try {
    let result;

    switch (action) {

      // ── EMPLEADOS ──
      case 'getEmpleados':
        result = getEmpleados();
        break;

      // ── TICKETS ──
      case 'getTickets':
        result = getTickets(p.cedula || '');
        break;

      case 'saveTicket':
        result = saveTicket(p);
        break;

      case 'updateTicket':
        result = updateTicket(p);
        break;

      // ── EXPEDIENTES ──
      case 'getExpediente':
        result = getExpediente(p.cedula || '');
        break;

      case 'saveExpediente':
        result = saveExpediente(p);
        break;

      // ── CORREO ──
      case 'sendEmail':
        result = sendEmailAction(p);
        break;

      // ── AUTH ADMIN ──
      case 'authAdmin':
        result = authAdmin(p.user || '', p.pass || '');
        break;

      default:
        result = { ok: false, error: 'Acción no reconocida: ' + action };
    }

    return jsonResponse(result);

  } catch (err) {
    logError(action, err.toString());
    return jsonResponse({ ok: false, error: err.toString() });
  }
}

// ══════════════════════════════════════════════════════
//  HELPERS — Sheet y respuesta
// ══════════════════════════════════════════════════════
function getSheet(name) {
  const ss = SpreadsheetApp.openById(SHEET_ID);
  return ss.getSheetByName(name);
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
  try {
    const sheet = getSheet(SHEET_LOG);
    sheet.appendRow([new Date().toISOString(), usuario, accion, detalle]);
  } catch(e) {}
}

function logError(accion, error) {
  try {
    const sheet = getSheet(SHEET_LOG);
    sheet.appendRow([new Date().toISOString(), 'SISTEMA', 'ERROR: ' + accion, error]);
  } catch(e) {}
}

// ══════════════════════════════════════════════════════
//  EMPLEADOS
// ══════════════════════════════════════════════════════
function getEmpleados() {
  const sheet = getSheet(SHEET_EMPLEADOS);
  const data  = sheetToObjects(sheet);
  return { ok: true, data };
}

// ══════════════════════════════════════════════════════
//  TICKETS
// ══════════════════════════════════════════════════════
function getTickets(cedula) {
  const sheet = getSheet(SHEET_TICKETS);
  let data    = sheetToObjects(sheet);
  if (cedula) data = data.filter(t => t.cedula === cedula);
  return { ok: true, data };
}

function saveTicket(p) {
  const sheet = getSheet(SHEET_TICKETS);
  sheet.appendRow([
    p.id, p.cedula, p.empleado, p.puesto, p.tipo,
    'pending',                     // status inicial
    new Date().toISOString(),      // fecha
    p.inicio, p.fin, p.dias,
    p.turno   || '',
    p.excluidos || '0',
    p.obs     || '',
    '',                            // notaAdmin
    '0',                           // editCount
    '', '', '',                    // resueltoFecha, fechaCancelacion, motivoCancelacion
    '', '',                        // motivoEdicion, ultimaEdicion
    p.motivo  || ''
  ]);
  logEntry(p.empleado, 'Nueva solicitud', `${p.id} — ${p.tipo}`);
  return { ok: true, id: p.id };
}

function updateTicket(p) {
  const sheet  = getSheet(SHEET_TICKETS);
  const data   = sheet.getDataRange().getValues();
  const headers = data[0];
  const idCol  = headers.indexOf('id');

  for (let i = 1; i < data.length; i++) {
    if (data[i][idCol] === p.id) {
      // Actualiza solo los campos enviados
      const colMap = {};
      headers.forEach((h, idx) => colMap[h] = idx + 1);

      if (p.status)            sheet.getRange(i+1, colMap['status']).setValue(p.status);
      if (p.notaAdmin)         sheet.getRange(i+1, colMap['notaAdmin']).setValue(p.notaAdmin);
      if (p.resueltoFecha)     sheet.getRange(i+1, colMap['resueltoFecha']).setValue(p.resueltoFecha);
      if (p.fechaCancelacion)  sheet.getRange(i+1, colMap['fechaCancelacion']).setValue(p.fechaCancelacion);
      if (p.motivoCancelacion) sheet.getRange(i+1, colMap['motivoCancelacion']).setValue(p.motivoCancelacion);
      if (p.editCount)         sheet.getRange(i+1, colMap['editCount']).setValue(p.editCount);
      if (p.ultimaEdicion)     sheet.getRange(i+1, colMap['ultimaEdicion']).setValue(p.ultimaEdicion);
      if (p.motivoEdicion)     sheet.getRange(i+1, colMap['motivoEdicion']).setValue(p.motivoEdicion);
      if (p.inicio)            sheet.getRange(i+1, colMap['inicio']).setValue(p.inicio);
      if (p.fin)               sheet.getRange(i+1, colMap['fin']).setValue(p.fin);
      if (p.dias)              sheet.getRange(i+1, colMap['dias']).setValue(p.dias);
      if (p.turno)             sheet.getRange(i+1, colMap['turno']).setValue(p.turno);

      logEntry(p.empleado || 'Admin', 'Actualiza ticket', `${p.id} → ${p.status || 'editado'}`);
      return { ok: true };
    }
  }
  return { ok: false, error: 'Ticket no encontrado: ' + p.id };
}

// ══════════════════════════════════════════════════════
//  EXPEDIENTES
// ══════════════════════════════════════════════════════
function getExpediente(cedula) {
  const sheet = getSheet(SHEET_EXPEDIENTES);
  const data  = sheetToObjects(sheet);
  const exp   = data.find(e => e.cedula === cedula);
  return { ok: true, data: exp || null };
}

function saveExpediente(p) {
  const sheet   = getSheet(SHEET_EXPEDIENTES);
  const data    = sheet.getDataRange().getValues();
  const headers = data[0];
  const ceduCol = headers.indexOf('cedula');

  const row = [
    p.cedula, p.nombres, p.ap1, p.ap2, p.genero,
    p.fnac, p.nac, p.pais, p.civil, p.hijos,
    p.prov, p.canton, p.distrito, p.direccion,
    p.tel, p.emailpers, p.emergNom, p.emergTel,
    p.iban, p.profesion, p.estudios, p.meds, p.alergias,
    new Date().toISOString()
  ];

  // Buscar si ya existe para actualizar
  for (let i = 1; i < data.length; i++) {
    if (data[i][ceduCol] === p.cedula) {
      sheet.getRange(i+1, 1, 1, row.length).setValues([row]);
      logEntry('Admin', 'Actualiza expediente', p.cedula + ' — ' + p.nombres);
      return { ok: true, action: 'updated' };
    }
  }

  // Si no existe, agregar fila nueva
  sheet.appendRow(row);
  logEntry('Admin', 'Crea expediente', p.cedula + ' — ' + p.nombres);
  return { ok: true, action: 'created' };
}

// ══════════════════════════════════════════════════════
//  AUTH ADMIN
// ══════════════════════════════════════════════════════
function authAdmin(user, pass) {
  if (user === ADMIN_USER && pass === ADMIN_PASS) {
    return { ok: true };
  }
  return { ok: false, error: 'Credenciales incorrectas' };
}

// ══════════════════════════════════════════════════════
//  ENVÍO DE CORREOS
// ══════════════════════════════════════════════════════
function sendEmailAction(p) {
  const to      = p.to      || EMAIL_RRHH;
  const asunto  = p.asunto  || 'Notificación Portal RRHH';
  const estado  = p.estado  || '';
  const esAprobado = estado.includes('APROBADA');
  const esDenegado = estado.includes('DENEGADA');
  const esCancelado= estado.includes('CANCELADA');
  const esEditado  = estado.includes('EDITADA');

  // Color según estado
  const colorEstado = esAprobado  ? '#065F46' :
                      esDenegado  ? '#991B1B' :
                      esCancelado ? '#64748B' :
                      esEditado   ? '#92400E' : '#1D4ED8';
  const bgEstado    = esAprobado  ? '#D1FAE5' :
                      esDenegado  ? '#FEE2E2' :
                      esCancelado ? '#F1F5F9' :
                      esEditado   ? '#FEF3C7' : '#DBEAFE';

  const html = `
  <!DOCTYPE html>
  <html>
  <head><meta charset="UTF-8"/></head>
  <body style="margin:0;padding:0;background:#F1F5F9;font-family:'Segoe UI',Arial,sans-serif;">
    <table width="100%" cellpadding="0" cellspacing="0" style="background:#F1F5F9;padding:32px 0;">
      <tr><td align="center">
        <table width="580" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,.08);">
          
          <!-- Header -->
          <tr>
            <td style="background:linear-gradient(135deg,#1D4ED8,#3B82F6);padding:28px 32px;">
              <table width="100%"><tr>
                <td>
                  <div style="font-size:11px;color:#BFDBFE;letter-spacing:1px;text-transform:uppercase;margin-bottom:4px;">Lean Consulting S.A.</div>
                  <div style="font-size:22px;font-weight:700;color:#ffffff;">Portal de Recursos Humanos</div>
                </td>
                <td align="right">
                  <div style="background:rgba(255,255,255,.15);border-radius:50%;width:48px;height:48px;display:inline-flex;align-items:center;justify-content:center;font-size:24px;">🏢</div>
                </td>
              </tr></table>
            </td>
          </tr>

          <!-- Estado badge -->
          <tr>
            <td style="padding:0 32px;">
              <div style="background:${bgEstado};color:${colorEstado};padding:10px 18px;border-radius:0 0 10px 10px;font-size:13px;font-weight:700;display:inline-block;">
                ${estado}
              </div>
            </td>
          </tr>

          <!-- Ticket info -->
          <tr>
            <td style="padding:24px 32px 0;">
              <table width="100%" style="background:#F8FAFC;border-radius:10px;padding:16px;" cellpadding="8">
                <tr>
                  <td style="font-size:11px;color:#94A3B8;font-weight:700;text-transform:uppercase;width:140px;">Ticket</td>
                  <td style="font-size:14px;color:#1E293B;font-weight:600;">${p.ticket_id || '—'}</td>
                </tr>
                <tr>
                  <td style="font-size:11px;color:#94A3B8;font-weight:700;text-transform:uppercase;">Colaborador</td>
                  <td style="font-size:14px;color:#1E293B;">${p.empleado || '—'}</td>
                </tr>
                <tr>
                  <td style="font-size:11px;color:#94A3B8;font-weight:700;text-transform:uppercase;">Cédula</td>
                  <td style="font-size:14px;color:#1E293B;">${p.cedula || '—'}</td>
                </tr>
                <tr>
                  <td style="font-size:11px;color:#94A3B8;font-weight:700;text-transform:uppercase;">Puesto</td>
                  <td style="font-size:14px;color:#1E293B;">${p.puesto || '—'}</td>
                </tr>
                <tr>
                  <td style="font-size:11px;color:#94A3B8;font-weight:700;text-transform:uppercase;">Tipo</td>
                  <td style="font-size:14px;color:#1E293B;font-weight:600;">${p.tipo || '—'}</td>
                </tr>
                <tr>
                  <td style="font-size:11px;color:#94A3B8;font-weight:700;text-transform:uppercase;">Fecha</td>
                  <td style="font-size:14px;color:#1E293B;">${p.fecha || '—'}</td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Detalle -->
          <tr>
            <td style="padding:16px 32px 0;">
              <div style="font-size:11px;color:#94A3B8;font-weight:700;text-transform:uppercase;margin-bottom:8px;">Detalle de la solicitud</div>
              <div style="background:#EFF6FF;border-left:4px solid #3B82F6;border-radius:0 8px 8px 0;padding:14px 16px;font-size:13px;color:#1E293B;line-height:1.8;white-space:pre-line;">${p.detalles || '—'}</div>
            </td>
          </tr>

          <!-- Observaciones -->
          ${p.observaciones && p.observaciones !== 'Ninguna' ? `
          <tr>
            <td style="padding:16px 32px 0;">
              <div style="font-size:11px;color:#94A3B8;font-weight:700;text-transform:uppercase;margin-bottom:8px;">Observaciones del colaborador</div>
              <div style="background:#F8FAFC;border-radius:8px;padding:12px 14px;font-size:13px;color:#475569;font-style:italic;">${p.observaciones}</div>
            </td>
          </tr>` : ''}

          <!-- Nota RRHH -->
          ${p.nota_admin ? `
          <tr>
            <td style="padding:16px 32px 0;">
              <div style="font-size:11px;color:#94A3B8;font-weight:700;text-transform:uppercase;margin-bottom:8px;">Nota de RRHH</div>
              <div style="background:#EDE9FE;border-left:4px solid #7C3AED;border-radius:0 8px 8px 0;padding:14px 16px;font-size:13px;color:#5B21B6;font-weight:500;">${p.nota_admin}</div>
            </td>
          </tr>` : ''}

          <!-- Mensaje extra -->
          ${p.msg_extra ? `
          <tr>
            <td style="padding:16px 32px 0;">
              <div style="font-size:13px;color:#475569;">${p.msg_extra}</div>
            </td>
          </tr>` : ''}

          <!-- Footer -->
          <tr>
            <td style="padding:28px 32px;margin-top:8px;">
              <hr style="border:none;border-top:1px solid #E2E8F0;margin-bottom:20px;"/>
              <div style="font-size:11px;color:#94A3B8;text-align:center;line-height:1.8;">
                © 2026 <strong style="color:#1D4ED8;">Lean Consulting S.A.</strong> — Portal de Recursos Humanos<br/>
                Este es un correo automático, por favor no responda directamente.<br/>
                Para consultas contacte a <a href="mailto:${EMAIL_RRHH}" style="color:#3B82F6;">${EMAIL_RRHH}</a>
              </div>
            </td>
          </tr>

        </table>
      </td></tr>
    </table>
  </body>
  </html>`;

  try {
    GmailApp.sendEmail(to, asunto, '', { htmlBody: html });
    logEntry('Sistema', 'Correo enviado', `Para: ${to} | ${asunto}`);
    return { ok: true };
  } catch(err) {
    logError('sendEmail', err.toString());
    return { ok: false, error: err.toString() };
  }
}
