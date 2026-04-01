// ══════════════════════════════════════════════════════════════════
//  Portal RRHH — Lean Consulting S.A.
//  Google Apps Script — Backend completo
//
//  INSTRUCCIONES:
//  1. Abra script.google.com en su cuenta de Google.
//  2. Cree un proyecto nuevo (o abra el existente).
//  3. Pegue todo este archivo en el editor y guarde.
//  4. Edite las constantes de CONFIG (sección de abajo).
//  5. Despliegue como aplicación web:
//       Implementar → Nueva implementación → Tipo: Aplicación web
//       Ejecutar como: Yo (su cuenta)
//       Quién tiene acceso: Cualquier persona
//  6. Copie la URL de implementación y péguela en portal-rrhh.js:
//       const GAS_URL = 'https://script.google.com/macros/s/...';
// ══════════════════════════════════════════════════════════════════

// ── CONFIG — edite estos valores ──────────────────────────────────
const SS_ID         = '';          // Deje vacío para usar la hoja activa (vinculada al script)
                                   // O pegue el ID del spreadsheet: '1BxiM...'
const RRHH_EMAILS   = ['kfernandez@leancr.com', 'cfernandez@leancr.com'];
const RRHH_CC       = RRHH_EMAILS.join(',');
const SENDER_NAME   = 'Portal Lean Consulting - RRHH';
const REPLY_TO      = 'kfernandez@leancr.com';
const EMPRESA_NOMBRE = 'Lean Consulting S.A.';

// ── Nombres de hojas ───────────────────────────────────────────────
const SHEET = {
  empleados:    'Empleados',
  solicitudes:  'Solicitudes',
  expedientes:  'Expedientes',
  admins:       'Admins',
  comprobantes: 'Comprobantes',
};

// ══════════════════════════════════════════════════════════════════
//  HELPERS
// ══════════════════════════════════════════════════════════════════

function getSpreadsheet() {
  return SS_ID ? SpreadsheetApp.openById(SS_ID) : SpreadsheetApp.getActiveSpreadsheet();
}

function getSheet(name) {
  const ss = getSpreadsheet();
  let sh = ss.getSheetByName(name);
  if (!sh) sh = ss.insertSheet(name);
  return sh;
}

function sheetToObjects(sheetName) {
  const sh   = getSheet(sheetName);
  const data = sh.getDataRange().getValues();
  if (data.length < 2) return [];
  const headers = data[0].map(h => String(h).trim());
  return data.slice(1)
    .filter(row => row.some(c => c !== '' && c !== null && c !== undefined))
    .map(row => {
      const obj = {};
      headers.forEach((h, i) => { obj[h] = row[i] !== undefined ? String(row[i]) : ''; });
      return obj;
    });
}

function findRow(sheetName, keyCol, keyVal) {
  const sh   = getSheet(sheetName);
  const data = sh.getDataRange().getValues();
  if (data.length < 2) return { rowIdx: -1, headers: data[0] || [] };
  const headers = data[0];
  const col     = headers.indexOf(keyCol);
  if (col < 0) return { rowIdx: -1, headers };
  for (let i = 1; i < data.length; i++) {
    if (String(data[i][col]).trim() === String(keyVal).trim()) {
      return { rowIdx: i + 1, headers, row: data[i] }; // 1-indexed GAS row
    }
  }
  return { rowIdx: -1, headers };
}

function upsertRow(sheetName, keyCol, keyVal, dataObj) {
  const sh      = getSheet(sheetName);
  const allData = sh.getDataRange().getValues();
  const headers = allData[0] || [];
  const colIdx  = headers.indexOf(keyCol);

  // Buscar fila existente
  let targetRow = -1;
  for (let i = 1; i < allData.length; i++) {
    if (String(allData[i][colIdx]).trim() === String(keyVal).trim()) {
      targetRow = i + 1;
      break;
    }
  }

  const rowArr = headers.map(h => dataObj[h] !== undefined ? dataObj[h] : '');

  if (targetRow > 0) {
    sh.getRange(targetRow, 1, 1, headers.length).setValues([rowArr]);
  } else {
    sh.appendRow(rowArr);
  }
}

function updateRowField(sheetName, keyCol, keyVal, updates) {
  const sh      = getSheet(sheetName);
  const allData = sh.getDataRange().getValues();
  const headers = allData[0] || [];
  const colIdx  = headers.indexOf(keyCol);
  if (colIdx < 0) return false;

  for (let i = 1; i < allData.length; i++) {
    if (String(allData[i][colIdx]).trim() === String(keyVal).trim()) {
      const rowNum = i + 1;
      Object.keys(updates).forEach(key => {
        const hIdx = headers.indexOf(key);
        if (hIdx >= 0) sh.getRange(rowNum, hIdx + 1).setValue(updates[key]);
      });
      return true;
    }
  }
  return false;
}

function ok(data)  { return JSON.stringify({ ok: true,  data: data  }); }
function err(msg)  { return JSON.stringify({ ok: false, error: msg  }); }

// ── Generador de códigos secuenciales ─────────────────────────────
// Formato con período:  PREFIX-YYYYMM-NNNN   (ej: COMP-202601-0001)
// Formato sin período:  PREFIX-NNNN           (ej: EMP-0001)
function autoId(prefix, sheetName, periodo) {
  const sh      = getSheet(sheetName);
  const lastRow = Math.max(0, sh.getLastRow() - 1); // -1 por la fila de encabezados
  const seq     = String(lastRow + 1).padStart(4, '0');
  if (periodo) {
    return prefix + '-' + periodo.replace('-', '') + '-' + seq;
  }
  const now    = new Date();
  const yyyymm = now.getFullYear() + String(now.getMonth() + 1).padStart(2, '0');
  return prefix + '-' + yyyymm + '-' + seq;
}

function jsonOut(payload) {
  return ContentService
    .createTextOutput(payload)
    .setMimeType(ContentService.MimeType.JSON);
}

// ══════════════════════════════════════════════════════════════════
//  ENTRY POINT
// ══════════════════════════════════════════════════════════════════

function doPost(e) {
  try {
    const body   = JSON.parse(e.postData.contents || '{}');
    const action = body.action || '';
    if (action === 'sendComprobantePDF') return jsonOut(sendComprobantePDF(body));
    return jsonOut(err('Acción POST no reconocida: ' + action));
  } catch(ex) {
    return jsonOut(err(ex.toString()));
  }
}

function doGet(e) {
  try {
    const p      = e.parameter || {};
    const action = p.action || '';

    switch (action) {

      // ── Autenticación ──────────────────────────────────────────
      case 'authAdmin':     return jsonOut(authAdmin(p));

      // ── Empleados ──────────────────────────────────────────────
      case 'getEmpleados':  return jsonOut(getEmpleados());
      case 'addEmpleado':   return jsonOut(addEmpleado(p));
      case 'updateEmpleado':return jsonOut(updateEmpleado(p));
      case 'deleteEmpleado':return jsonOut(deleteEmpleado(p));

      // ── Tickets ────────────────────────────────────────────────
      case 'getTickets':    return jsonOut(getTickets(p));
      case 'saveTicket':    return jsonOut(saveTicket(p));
      case 'updateTicket':  return jsonOut(updateTicket(p));

      // ── Email ──────────────────────────────────────────────────
      case 'sendEmail':     return jsonOut(sendEmailAction(p));

      // ── Expedientes ────────────────────────────────────────────
      case 'getExpediente': return jsonOut(getExpediente(p));
      case 'saveExpediente':return jsonOut(saveExpediente(p));

      // ── Comprobantes ───────────────────────────────────────────
      case 'saveComprobante':       return jsonOut(saveComprobante(p));
      case 'getComprobantes':       return jsonOut(getComprobantes(p));
      case 'getComprobantesAdmin':  return jsonOut(getComprobantesAdmin());

      default:
        return jsonOut(err('Acción no reconocida: ' + action));
    }
  } catch (ex) {
    return jsonOut(err('Error interno: ' + ex.toString()));
  }
}

// ══════════════════════════════════════════════════════════════════
//  AUTH
// ══════════════════════════════════════════════════════════════════

function authAdmin(p) {
  const admins = sheetToObjects(SHEET.admins);
  const found  = admins.find(a =>
    String(a.user).trim() === String(p.user || '').trim() &&
    String(a.pass).trim() === String(p.pass || '').trim()
  );
  return found ? ok(null) : err('Credenciales incorrectas');
}

// ══════════════════════════════════════════════════════════════════
//  EMPLEADOS
// ══════════════════════════════════════════════════════════════════

function getEmpleados() {
  return ok(sheetToObjects(SHEET.empleados));
}

function addEmpleado(p) {
  const sh = getSheet(SHEET.empleados);
  const headers = sh.getRange(1, 1, 1, sh.getLastColumn()).getValues()[0];

  // Verificar que no exista la cédula
  const existing = sheetToObjects(SHEET.empleados);
  if (existing.find(e => String(e.cedula).trim() === String(p.cedula).trim())) {
    return err('Ya existe un colaborador con esa cédula');
  }

  const row = headers.map(h => p[h] !== undefined ? p[h] : '');
  sh.appendRow(row);
  return ok(null);
}

function updateEmpleado(p) {
  const updates = {};
  const allowed = ['nombre','puesto','ingreso','consumidos','email','emailcorp',
                   'pdTotal','pdUsados','pdAnio','acceso'];
  allowed.forEach(f => { if (p[f] !== undefined) updates[f] = p[f]; });
  const done = updateRowField(SHEET.empleados, 'cedula', p.cedula, updates);
  return done ? ok(null) : err('Colaborador no encontrado');
}

function deleteEmpleado(p) {
  const sh      = getSheet(SHEET.empleados);
  const allData = sh.getDataRange().getValues();
  const headers = allData[0];
  const col     = headers.indexOf('cedula');
  for (let i = allData.length - 1; i >= 1; i--) {
    if (String(allData[i][col]).trim() === String(p.cedula).trim()) {
      sh.deleteRow(i + 1);
      return ok(null);
    }
  }
  return err('Colaborador no encontrado');
}

// ══════════════════════════════════════════════════════════════════
//  TICKETS / SOLICITUDES
// ══════════════════════════════════════════════════════════════════

function getTickets(p) {
  let rows = sheetToObjects(SHEET.solicitudes);
  if (p.cedula) {
    rows = rows.filter(r => String(r.cedula).trim() === String(p.cedula).trim());
  }
  return ok(rows);
}

function saveTicket(p) {
  const sh      = getSheet(SHEET.solicitudes);
  const headers = sh.getRange(1, 1, 1, sh.getLastColumn()).getValues()[0];
  // Generate sequential ID server-side (SOL-YYYYMM-NNNN)
  const id = autoId('SOL', SHEET.solicitudes, '');
  p.id = id;
  const row = headers.map(h => p[h] !== undefined ? p[h] : '');
  sh.appendRow(row);
  return ok({ id: id });
}

function updateTicket(p) {
  const allowed = [
    'status','notaAdmin','resueltoFecha',
    'motivoCancelacion','fechaCancelacion',
    'inicio','fin','dias','turno',
    'editCount','ultimaEdicion','motivoEdicion',
    'empleado',
  ];
  const updates = {};
  allowed.forEach(f => { if (p[f] !== undefined) updates[f] = p[f]; });
  const done = updateRowField(SHEET.solicitudes, 'id', p.id, updates);
  return done ? ok(null) : err('Ticket no encontrado: ' + p.id);
}

// ══════════════════════════════════════════════════════════════════
//  EMAIL
// ══════════════════════════════════════════════════════════════════

function sendEmailAction(p) {
  try {
    const to      = p.to || '';
    const asunto  = p.asunto || '[RRHH] Notificación de solicitud';
    const html    = buildTicketEmail(p);
    const targets = [to, ...RRHH_EMAILS].filter(e => e && e.includes('@'));
    const unique  = [...new Set(targets)];

    unique.forEach(addr => {
      GmailApp.sendEmail(addr, asunto, '', { htmlBody: html, name: SENDER_NAME, replyTo: REPLY_TO });
    });
    return ok(null);
  } catch (ex) {
    return err('Error enviando correo: ' + ex.toString());
  }
}

function buildTicketEmail(p) {
  const estado   = p.estado   || '';
  const esAprobada = estado.includes('APROBADA');
  const esDenegada = estado.includes('DENEGADA');
  const accentColor = esAprobada ? '#10B981' : esDenegada ? '#EF4444' : '#1565C0';

  return `<!DOCTYPE html>
<html><head><meta charset="UTF-8"/></head>
<body style="margin:0;padding:0;font-family:Arial,sans-serif;background:#F4F9FF">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#F4F9FF;padding:32px 0">
  <tr><td align="center">
    <table width="600" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 4px 16px rgba(21,101,192,.12)">
      <!-- Header -->
      <tr><td style="background:linear-gradient(135deg,#052960,#1565C0);padding:28px 32px">
        <div style="font-family:'Georgia',serif;font-size:22px;color:#ffffff;margin-bottom:4px">${EMPRESA_NOMBRE}</div>
        <div style="font-size:12px;color:#ADDCFF;letter-spacing:1px">PORTAL DE RECURSOS HUMANOS</div>
      </td></tr>
      <!-- Estado badge -->
      <tr><td style="padding:24px 32px 0">
        <div style="display:inline-block;background:${accentColor};color:#fff;padding:6px 16px;border-radius:20px;font-size:13px;font-weight:700">
          ${estado}
        </div>
      </td></tr>
      <!-- Cuerpo -->
      <tr><td style="padding:20px 32px 28px">
        <table width="100%" cellpadding="0" cellspacing="0">
          <tr><td style="padding:10px 0;border-bottom:1px solid #E2E8F0">
            <span style="font-size:11px;color:#94A3B8;text-transform:uppercase;letter-spacing:.5px">Ticket</span><br/>
            <span style="font-size:14px;font-weight:700;color:#052960">${p.ticket_id||'—'}</span>
            &nbsp;·&nbsp;
            <span style="font-size:13px;color:#475569">${p.fecha||''}</span>
          </td></tr>
          <tr><td style="padding:10px 0;border-bottom:1px solid #E2E8F0">
            <span style="font-size:11px;color:#94A3B8;text-transform:uppercase;letter-spacing:.5px">Colaborador</span><br/>
            <span style="font-size:14px;font-weight:600;color:#1E293B">${p.empleado||'—'}</span>
            &nbsp;·&nbsp; ${p.cedula||''} &nbsp;·&nbsp;
            <span style="color:#475569">${p.puesto||''}</span>
          </td></tr>
          <tr><td style="padding:10px 0;border-bottom:1px solid #E2E8F0">
            <span style="font-size:11px;color:#94A3B8;text-transform:uppercase;letter-spacing:.5px">Tipo de solicitud</span><br/>
            <span style="font-size:14px;font-weight:600;color:#1565C0">${p.tipo||'—'}</span>
          </td></tr>
          <tr><td style="padding:10px 0;border-bottom:1px solid #E2E8F0">
            <span style="font-size:11px;color:#94A3B8;text-transform:uppercase;letter-spacing:.5px">Detalle</span><br/>
            <span style="font-size:13px;color:#1E293B;line-height:1.6">${(p.detalles||'').replace(/\n/g,'<br/>')}</span>
          </td></tr>
          ${p.observaciones && p.observaciones !== 'Ninguna' ? `
          <tr><td style="padding:10px 0;border-bottom:1px solid #E2E8F0">
            <span style="font-size:11px;color:#94A3B8;text-transform:uppercase;letter-spacing:.5px">Observaciones</span><br/>
            <span style="font-size:13px;color:#475569">${p.observaciones}</span>
          </td></tr>` : ''}
          ${p.nota_admin ? `
          <tr><td style="padding:10px 0;border-bottom:1px solid #E2E8F0">
            <span style="font-size:11px;color:#94A3B8;text-transform:uppercase;letter-spacing:.5px">Nota de RRHH</span><br/>
            <span style="font-size:13px;color:#1565C0;font-weight:600">${p.nota_admin}</span>
          </td></tr>` : ''}
          ${p.msg_extra ? `
          <tr><td style="padding:14px 0 0">
            <div style="background:#EEF5FF;border-radius:8px;padding:12px 16px;font-size:13px;color:#052960">
              ${p.msg_extra}
            </div>
          </td></tr>` : ''}
        </table>
      </td></tr>
      <!-- Footer -->
      <tr><td style="background:#F8FAFC;padding:16px 32px;border-top:1px solid #E2E8F0;text-align:center">
        <span style="font-size:11px;color:#94A3B8">
          ${EMPRESA_NOMBRE} &nbsp;·&nbsp; Portal de Recursos Humanos<br/>
          Este es un mensaje automático — no responda a este correo
        </span>
      </td></tr>
    </table>
  </td></tr>
</table>
</body></html>`;
}

// ══════════════════════════════════════════════════════════════════
//  EXPEDIENTES
// ══════════════════════════════════════════════════════════════════

function getExpediente(p) {
  const rows = sheetToObjects(SHEET.expedientes);
  const row  = rows.find(r => String(r.cedula).trim() === String(p.cedula).trim());
  return row ? ok(row) : ok(null);
}

function saveExpediente(p) {
  const sh      = getSheet(SHEET.expedientes);
  const headers = sh.getRange(1, 1, 1, sh.getLastColumn()).getValues()[0];

  // Construir objeto con todos los campos del sheet
  const dataObj = {};
  headers.forEach(h => { dataObj[h] = p[h] !== undefined ? p[h] : ''; });
  dataObj.cedula    = p.cedula;
  dataObj.updatedAt = p.updatedAt || new Date().toISOString();
  dataObj.updatedBy = p.updatedBy || 'admin';

  upsertRow(SHEET.expedientes, 'cedula', p.cedula, dataObj);
  return ok(null);
}

// ══════════════════════════════════════════════════════════════════
//  COMPROBANTES DE PAGO
// ══════════════════════════════════════════════════════════════════

function saveComprobante(p) {
  ensureComprobantesSheet();

  // Buscar email del colaborador en la hoja Empleados por cédula
  const cedula = String(p.cedula || '').trim();
  let emailTo  = '';
  if (cedula) {
    const empRows = sheetToObjects(SHEET.empleados);
    const emp     = empRows.find(r => String(r.cedula).trim() === cedula);
    if (emp) {
      emailTo = emp.emailcorp || emp.email || '';
    }
  }

  const sh      = getSheet(SHEET.comprobantes);
  const headers = sh.getRange(1, 1, 1, sh.getLastColumn()).getValues()[0];

  const id         = autoId('COMP', SHEET.comprobantes, p.periodo || '');
  const fecha_envio = new Date().toLocaleDateString('es-CR');

  const dataObj = {
    id,
    cedula,
    nombre:             p.nombre           || '',
    emailcorp:          emailTo,
    puesto:             p.puesto           || '',
    fecha_ingreso:      p.fechaIngreso     || '',
    periodo:            p.periodo          || '',
    periodo_label:      p.periodoLabel     || '',
    descripcion:        p.descripcion      || '',
    dias_trabajados:    parseFloat(p.diasTrabajados)  || 0,
    salario_mes:        parseFloat(p.salarioMes)      || 0,
    bono:               parseFloat(p.bono)             || 0,
    horas_dobles:       parseFloat(p.horasDobles)      || 0,
    subsidio:           parseFloat(p.subsidio)         || 0,
    total_beneficios:   parseFloat(p.totalBeneficios)  || 0,
    pension_voluntaria: parseFloat(p.pension)          || 0,
    ccss:               parseFloat(p.ccss)             || 0,
    renta:              parseFloat(p.renta)            || 0,
    cxc:                parseFloat(p.cxc)              || 0,
    total_rebajos:      parseFloat(p.totalRebajos)     || 0,
    salario_neto:       parseFloat(p.salarioNeto)      || 0,
    fecha_envio,
  };

  const row = headers.map(h => dataObj[h] !== undefined ? dataObj[h] : '');
  sh.appendRow(row);

  // Enviar correo al colaborador
  if (emailTo && emailTo.includes('@')) {
    try {
      const asunto = `[RRHH] Comprobante de pago — ${p.periodoLabel || p.periodo} — ${EMPRESA_NOMBRE}`;
      const html   = buildComprobanteEmail(dataObj);
      GmailApp.sendEmail(emailTo, asunto, '', { htmlBody: html, name: SENDER_NAME, replyTo: REPLY_TO });
      if (RRHH_EMAILS.length > 0) {
        RRHH_EMAILS.forEach(addr => {
          if (addr && addr.includes('@'))
            GmailApp.sendEmail(addr, '[CC] ' + asunto, '', { htmlBody: html, name: SENDER_NAME, replyTo: REPLY_TO });
        });
      }
    } catch (ex) {
      Logger.log('Error enviando comprobante a ' + emailTo + ': ' + ex.toString());
    }
  }

  return ok({ id, emailTo });
}

function sendComprobantePDF(p) {
  ensureComprobantesSheet();

  const cedula = String(p.cedula || '').trim();
  if (!cedula) return err('Cédula requerida');

  // Buscar colaborador en Empleados
  const empRows = sheetToObjects(SHEET.empleados);
  const emp     = empRows.find(r => String(r.cedula).trim() === cedula);
  if (!emp) return err('Colaborador no encontrado: ' + cedula);

  const emailTo = emp.emailcorp || emp.email || '';
  if (!emailTo || !emailTo.includes('@')) return err('El colaborador no tiene correo registrado en su expediente');

  const nombre = emp.nombre || p.nombre || '';
  const primerNombre = nombre.split(' ')[0] || nombre;

  // Período: se usa el enviado desde el cliente (ya calculado como mes anterior)
  const meses = ['enero','febrero','marzo','abril','mayo','junio',
                 'julio','agosto','septiembre','octubre','noviembre','diciembre'];
  let periodoLabel = p.periodoLabel || '';
  let periodo      = p.periodo      || '';
  if (!periodoLabel) {
    const now  = new Date();
    const prev = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    periodoLabel = meses[prev.getMonth()] + ' ' + prev.getFullYear();
    periodo      = prev.getFullYear() + '-' + String(prev.getMonth() + 1).padStart(2, '0');
  }

  // Decodificar PDF
  const pdfBytes = Utilities.base64Decode(p.pdfBase64);
  const pdfBlob  = Utilities.newBlob(pdfBytes, 'application/pdf',
                     p.pdfName || ('Comprobante_' + periodo + '.pdf'));

  // Guardar PDF en Google Drive y obtener link de descarga
  let driveUrl = '';
  try {
    const folders   = DriveApp.getFoldersByName('RRHH - Comprobantes');
    const folder    = folders.hasNext() ? folders.next() : DriveApp.createFolder('RRHH - Comprobantes');
    const driveFile = folder.createFile(pdfBlob);
    driveFile.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
    driveUrl = 'https://drive.google.com/file/d/' + driveFile.getId() + '/view';
  } catch (driveEx) {
    Logger.log('Advertencia: no se pudo guardar en Drive: ' + driveEx.toString());
  }

  // Cuerpo del correo
  const mensajeExtra = String(p.mensajeExtra || '').trim();
  const bodyText =
    'Estimado/a ' + primerNombre + ',\n\n' +
    'Esperamos que se encuentre bien.\n\n' +
    'Adjunto encontrará el comprobante de pago correspondiente al periodo de ' + periodoLabel + ', ' +
    'el cual ya ha sido procesado. Les recordamos que cualquier consulta sobre el detalle de su pago ' +
    'puede hacerla llegar a mi persona o bien a Cristián.\n\n' +
    'Si requiere alguna actualización en su información o tienen dudas sobre deducciones, horas extras ' +
    'o cualquier otro concepto, por favor no duden en contactarnos.\n\n' +
    (mensajeExtra ? mensajeExtra + '\n\n' : '') +
    'Saludos,\n' +
    'RRHH — ' + EMPRESA_NOMBRE + '\n\n' +
    '---\n' +
    '⚠️ NOTA IMPORTANTE: Este comprobante es enviado desde un correo de generación automática. ' +
    'NO RESPONDER A ESTE CORREO. Si necesita comunicarse con administración o tiene alguna duda ' +
    'respecto a su pago, comuníquese al correo de Keyla Fernández: kfernandez@leancr.com';

  const asunto = '[RRHH] Comprobante de pago — ' + periodoLabel + ' — ' + EMPRESA_NOMBRE;

  try {
    GmailApp.sendEmail(emailTo, asunto, bodyText, {
      attachments: [pdfBlob],
      name: SENDER_NAME,
      replyTo: REPLY_TO,
    });
    // CC a RRHH (solo si dirección diferente al colaborador)
    RRHH_EMAILS.forEach(addr => {
      if (addr && addr.includes('@') && addr !== emailTo) {
        GmailApp.sendEmail(addr, '[CC] ' + asunto, bodyText, {
          attachments: [pdfBlob],
          name: SENDER_NAME,
          replyTo: REPLY_TO,
        });
      }
    });
  } catch (ex) {
    Logger.log('Error enviando PDF a ' + emailTo + ': ' + ex.toString());
    return err('Error al enviar correo: ' + ex.toString());
  }

  // Guardar registro en Comprobantes
  const sh      = getSheet(SHEET.comprobantes);
  const headers = sh.getRange(1, 1, 1, sh.getLastColumn()).getValues()[0];
  const id      = autoId('COMP', SHEET.comprobantes, periodo);
  const fechaEnv = new Date().toLocaleDateString('es-CR');

  const dataObj = {
    id, cedula, nombre, emailcorp: emailTo,
    puesto:        emp.puesto || '',
    periodo,
    periodo_label: periodoLabel,
    descripcion:   'Comprobante PDF',
    drive_url:     driveUrl,
    fecha_envio:   fechaEnv,
  };
  sh.appendRow(headers.map(h => (dataObj[h] !== undefined ? dataObj[h] : '')));

  return ok({ id, emailTo, driveUrl });
}

function ensureComprobantesSheet() {
  const sh = getSheet(SHEET.comprobantes);
  if (sh.getLastRow() === 0) {
    sh.appendRow([
      'id','cedula','nombre','emailcorp','puesto','fecha_ingreso',
      'periodo','periodo_label','descripcion',
      'dias_trabajados','salario_mes','bono','horas_dobles','subsidio',
      'total_beneficios','pension_voluntaria','ccss','renta','cxc',
      'total_rebajos','salario_neto','drive_url','fecha_envio'
    ]);
  }
}

function buildComprobanteEmail(data) {
  function fmtCRC(n) {
    return '&#8353; ' + (parseFloat(n)||0).toLocaleString('es-CR', { minimumFractionDigits: 0, maximumFractionDigits: 0 });
  }
  function erow(label, dias, monto, bold, red) {
    var style = 'padding:7px 12px;font-size:12px;border-bottom:1px solid #E2E8F0;' + (red ? 'color:#CC0000;' : '');
    var wt    = bold ? 'font-weight:700;' : '';
    return '<tr>' +
      '<td style="' + style + wt + '">' + label + '</td>' +
      '<td style="' + style + 'text-align:center">' + (dias || '') + '</td>' +
      '<td style="' + style + wt + 'text-align:right">' + (monto ? fmtCRC(monto) : '') + '</td>' +
      '</tr>';
  }

  var diasTrab    = parseFloat(data.dias_trabajados)   || 0;
  var salarioMes  = parseFloat(data.salario_mes)        || 0;
  var bono        = parseFloat(data.bono)               || 0;
  var horasDobles = parseFloat(data.horas_dobles)       || 0;
  var subsidio    = parseFloat(data.subsidio)           || 0;
  var totalBenef  = parseFloat(data.total_beneficios)   || (salarioMes + bono + horasDobles + subsidio);
  var pension     = parseFloat(data.pension_voluntaria) || 0;
  var ccss        = parseFloat(data.ccss)               || 0;
  var renta       = parseFloat(data.renta)              || 0;
  var cxc         = parseFloat(data.cxc)                || 0;
  var totalRebaj  = parseFloat(data.total_rebajos)      || (pension + ccss + renta + cxc);
  var neto        = parseFloat(data.salario_neto)       || 0;
  var periodoLabel = data.periodo_label || data.periodo || '';

  return '<!DOCTYPE html><html><head><meta charset="UTF-8"/></head>' +
'<body style="margin:0;padding:0;font-family:Arial,sans-serif;background:#F4F9FF">' +
'<table width="100%" cellpadding="0" cellspacing="0" style="background:#F4F9FF;padding:28px 0">' +
'<tr><td align="center">' +
'<table width="560" cellpadding="0" cellspacing="0" style="background:#fff;border-radius:10px;overflow:hidden;box-shadow:0 4px 16px rgba(21,101,192,.12)">' +

'<!-- Header -->' +
'<tr><td style="background:linear-gradient(135deg,#052960,#1565C0);padding:22px 28px">' +
'<div style="font-size:24px;font-weight:900;color:#fff;letter-spacing:-1px;line-height:1.1">LEAN</div>' +
'<div style="font-size:13px;font-weight:900;color:#fff;letter-spacing:1px">CONSULTING</div>' +
'<div style="font-size:9px;color:#ADDCFF;letter-spacing:2px;margin-top:1px">PROJECT MANAGEMENT</div>' +
'<div style="border-top:1px solid rgba(255,255,255,.3);margin:10px 0 8px"></div>' +
'<div style="font-size:14px;color:#ADDCFF;letter-spacing:.5px">COMPROBANTE DE PAGO DE PLANILLA</div>' +
'</td></tr>' +

'<!-- Período -->' +
'<tr><td style="padding:18px 28px 0">' +
'<div style="display:inline-block;background:#E0F7FA;color:#0096C7;border:1px solid #B3E5F5;padding:5px 14px;border-radius:20px;font-size:12px;font-weight:700">' + periodoLabel + '</div>' +
'</td></tr>' +

'<!-- Info colaborador -->' +
'<tr><td style="padding:14px 28px 0">' +
'<table width="100%" cellpadding="0" cellspacing="0">' +
'<tr><td style="font-size:12px;color:#1565C0;font-weight:600;padding:3px 0;width:130px">Nombre:</td><td style="font-size:12px;padding:3px 0">' + data.nombre + '</td></tr>' +
'<tr><td style="font-size:12px;color:#1565C0;font-weight:600;padding:3px 0">Identificacion</td><td style="font-size:12px;padding:3px 0">' + data.cedula + '</td></tr>' +
(data.puesto ? '<tr><td style="font-size:12px;color:#1565C0;font-weight:600;padding:3px 0">Puesto</td><td style="font-size:12px;padding:3px 0">' + data.puesto + '</td></tr>' : '') +
(data.fecha_ingreso ? '<tr><td style="font-size:12px;color:#1565C0;font-weight:600;padding:3px 0">Fecha de Ingreso</td><td style="font-size:12px;padding:3px 0">' + data.fecha_ingreso + '</td></tr>' : '') +
'</table>' +
'</td></tr>' +

'<!-- Detalle -->' +
'<tr><td style="padding:16px 28px 24px">' +
'<div style="border:1px solid #E2E8F0;border-radius:8px;overflow:hidden">' +
'<div style="background:#F8FAFC;padding:8px 12px;font-weight:700;font-size:13px;border-bottom:1px solid #E2E8F0">Detalle de Salario</div>' +
'<div style="padding:12px">' +

'<div style="font-style:italic;font-weight:700;font-size:12px;margin-bottom:4px">Beneficios</div>' +
'<table width="100%" cellpadding="0" cellspacing="0">' +
'<tr><th style="font-size:10px;text-align:left;padding:4px 12px;background:#f0f0f0;border-bottom:1px solid #ddd"></th>' +
'<th style="font-size:10px;text-align:center;padding:4px 12px;background:#f0f0f0;border-bottom:1px solid #ddd">Dias trabajados</th>' +
'<th style="font-size:10px;text-align:right;padding:4px 12px;background:#f0f0f0;border-bottom:1px solid #ddd"></th></tr>' +
erow('Salario Mes', diasTrab, salarioMes, false, false) +
(bono        ? erow('Bono',               '', bono,        false, false) : '') +
(horasDobles ? erow('Horas Extras',       '', horasDobles, false, false) : '') +
(subsidio    ? erow('Subsidio Incapacidad','',subsidio,    false, false) : '') +
erow('Total Beneficios', '', totalBenef, true, false) +
'</table>' +

'<div style="font-style:italic;font-weight:700;font-size:12px;margin:10px 0 4px">Deducciones</div>' +
'<table width="100%" cellpadding="0" cellspacing="0">' +
(ccss    ? erow('CCSS 10,67%',       '', ccss,    false, true) : '') +
(renta   ? erow('Impuesto de renta', '', renta,   false, true) : '') +
(pension ? erow('Pension Voluntaria','', pension, false, true) : '') +
(cxc     ? erow('CxC',              '', cxc,     false, true) : '') +
erow('Total Deducciones', '', totalRebaj, true, true) +
'</table>' +

'</div></div>' +

'<!-- Neto -->' +
'<table width="100%" cellpadding="0" cellspacing="0" style="margin-top:10px">' +
'<tr style="background:linear-gradient(135deg,#052960,#1565C0)">' +
'<td style="padding:12px 16px;font-size:14px;font-weight:700;color:#fff">Neto a Pagar</td>' +
'<td></td>' +
'<td style="padding:12px 16px;font-size:18px;font-weight:700;color:#fff;text-align:right">' + fmtCRC(neto) + '</td>' +
'</tr></table>' +

'</td></tr>' +

'<!-- Footer -->' +
'<tr><td style="background:#F8FAFC;padding:12px 28px;border-top:1px solid #E2E8F0;text-align:center">' +
'<span style="font-size:10px;color:#94A3B8">' + EMPRESA_NOMBRE + ' &nbsp;·&nbsp; Portal de Recursos Humanos</span><br/>' +
'<div style="margin-top:8px;padding:10px 14px;background:#FFF8E1;border:1px solid #FFE082;border-radius:6px;text-align:left">' +
'<span style="font-size:11px;font-weight:700;color:#B45309">⚠️ NOTA IMPORTANTE:</span> ' +
'<span style="font-size:11px;color:#78350F">Este comprobante es enviado desde un correo de generación automática. <strong>NO RESPONDER A ESTE CORREO.</strong> ' +
'Si necesita comunicarse con administración o tiene alguna duda respecto a su pago, comuníquese al correo de Keyla Fernández: ' +
'<a href="mailto:kfernandez@leancr.com" style="color:#1565C0">kfernandez@leancr.com</a></span>' +
'</div>' +
'</td></tr>' +

'</table></td></tr></table></body></html>';
}

function getComprobantes(p) {
  ensureComprobantesSheet();
  const rows    = sheetToObjects(SHEET.comprobantes);
  const cedula  = String(p.cedula || '').trim();
  if (!cedula) return ok([]);
  return ok(rows.filter(r => String(r.cedula).trim() === cedula));
}

function getComprobantesAdmin() {
  ensureComprobantesSheet();
  return ok(sheetToObjects(SHEET.comprobantes));
}

// ══════════════════════════════════════════════════════════════════
//  UTILIDAD — Inicializar headers de todas las hojas
//  Ejecute esta función UNA VEZ manualmente desde el editor de GAS
//  (Menú Ejecutar → initSheetHeaders) para crear los encabezados.
// ══════════════════════════════════════════════════════════════════

function initSheetHeaders() {
  // Empleados
  const empSh = getSheet(SHEET.empleados);
  if (empSh.getLastRow() === 0) {
    empSh.appendRow(['cedula','nombre','puesto','ingreso','consumidos',
                     'email','emailcorp','pdTotal','pdUsados','pdAnio','acceso']);
  }

  // Solicitudes
  const solSh = getSheet(SHEET.solicitudes);
  if (solSh.getLastRow() === 0) {
    solSh.appendRow([
      'id','cedula','empleado','puesto','tipo','inicio','fin','dias','turno',
      'excluidos','obs','motivo','status','fecha','notaAdmin','editCount',
      'resueltoFecha','fechaCancelacion','motivoCancelacion','motivoEdicion',
      'ultimaEdicion','tipo_inc','medico'
    ]);
  }

  // Expedientes
  const expSh = getSheet(SHEET.expedientes);
  if (expSh.getLastRow() === 0) {
    expSh.appendRow([
      'cedula','nombres','ap1','ap2','genero','fnac','nac','pais','civil','hijos',
      'prov','canton','distrito','direccion','emailcorp','emailpers','tel',
      'emergNom','emergTel','iban','salario','profesion','estudios',
      'meds','alergias','updatedAt','updatedBy'
    ]);
  }

  // Admins
  const admSh = getSheet(SHEET.admins);
  if (admSh.getLastRow() === 0) {
    admSh.appendRow(['user','pass']);
    admSh.appendRow(['admin','lean2026']); // Cambie esta contraseña
  }

  // Comprobantes
  ensureComprobantesSheet();

  SpreadsheetApp.getUi().alert('Hojas creadas correctamente. Revise el spreadsheet.');
}
