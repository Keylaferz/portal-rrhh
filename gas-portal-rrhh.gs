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

function jsonOut(payload) {
  return ContentService
    .createTextOutput(payload)
    .setMimeType(ContentService.MimeType.JSON);
}

// ══════════════════════════════════════════════════════════════════
//  ENTRY POINT
// ══════════════════════════════════════════════════════════════════

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
  const row     = headers.map(h => p[h] !== undefined ? p[h] : '');
  sh.appendRow(row);
  return ok(null);
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
      GmailApp.sendEmail(addr, asunto, '', { htmlBody: html });
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
  // 1. Asegurar que la hoja Comprobantes existe con sus headers
  ensureComprobantesSheet();

  const sh      = getSheet(SHEET.comprobantes);
  const headers = sh.getRange(1, 1, 1, sh.getLastColumn()).getValues()[0];

  const id         = 'COMP-' + Date.now().toString(36).toUpperCase().slice(-6);
  const fecha_envio = new Date().toLocaleDateString('es-CR');

  const dataObj = {
    id,
    cedula:           p.cedula          || '',
    nombre:           p.nombre          || '',
    emailcorp:        p.email           || '',
    periodo:          p.periodo         || '',
    periodoLabel:     p.periodoLabel    || '',
    descripcion:      p.descripcion     || '',
    salario_bruto:    p.salarioBruto    || 0,
    ccss_empleado:    p.ccssEmpleado    || 0,
    renta:            p.renta           || 0,
    otras_deduc:      p.otrasDeduc      || 0,
    salario_neto:     p.salarioNeto     || 0,
    observaciones:    p.observaciones   || '',
    fecha_envio,
  };

  const row = headers.map(h => dataObj[h] !== undefined ? dataObj[h] : '');
  sh.appendRow(row);

  // 2. Enviar correo al colaborador
  const emailTo = p.email || '';
  if (emailTo && emailTo.includes('@')) {
    try {
      const asunto = `[RRHH] Comprobante de pago — ${p.periodoLabel || p.periodo} — ${EMPRESA_NOMBRE}`;
      const html   = buildComprobanteEmail(dataObj, p);
      GmailApp.sendEmail(emailTo, asunto, '', { htmlBody: html });

      // CC a RRHH si está configurado
      if (RRHH_EMAILS.length > 0) {
        RRHH_EMAILS.forEach(addr => {
          if (addr && addr.includes('@')) {
            GmailApp.sendEmail(addr, '[CC] ' + asunto, '', { htmlBody: html });
          }
        });
      }
    } catch (ex) {
      Logger.log('Error enviando comprobante a ' + emailTo + ': ' + ex.toString());
    }
  }

  return ok({ id });
}

function ensureComprobantesSheet() {
  const sh = getSheet(SHEET.comprobantes);
  if (sh.getLastRow() === 0) {
    sh.appendRow([
      'id','cedula','nombre','emailcorp','periodo','periodoLabel',
      'descripcion','salario_bruto','ccss_empleado','renta',
      'otras_deduc','salario_neto','observaciones','fecha_envio'
    ]);
  }
}

function buildComprobanteEmail(data, p) {
  const bruto  = parseFloat(data.salario_bruto)  || 0;
  const ccss   = parseFloat(data.ccss_empleado)  || 0;
  const renta  = parseFloat(data.renta)          || 0;
  const otras  = parseFloat(data.otras_deduc)    || 0;
  const neto   = parseFloat(data.salario_neto)   || 0;
  const total_deduc = ccss + renta + otras;

  function fmtCRC(n) {
    return '₡ ' + parseFloat(n).toLocaleString('es-CR', { minimumFractionDigits: 0, maximumFractionDigits: 0 });
  }

  return `<!DOCTYPE html>
<html><head><meta charset="UTF-8"/></head>
<body style="margin:0;padding:0;font-family:Arial,sans-serif;background:#F4F9FF">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#F4F9FF;padding:32px 0">
  <tr><td align="center">
    <table width="560" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 4px 16px rgba(21,101,192,.12)">
      <!-- Header -->
      <tr><td style="background:linear-gradient(135deg,#052960,#1565C0);padding:28px 32px">
        <div style="font-family:'Georgia',serif;font-size:22px;color:#ffffff;margin-bottom:4px">${EMPRESA_NOMBRE}</div>
        <div style="font-size:12px;color:#ADDCFF;letter-spacing:1px">COMPROBANTE DE PAGO</div>
      </td></tr>
      <!-- Período badge -->
      <tr><td style="padding:24px 32px 0">
        <div style="display:inline-block;background:#E0F7FA;color:#0096C7;border:1px solid #B3E5F5;padding:6px 16px;border-radius:20px;font-size:13px;font-weight:700">
          ${data.periodoLabel || data.periodo}
        </div>
      </td></tr>
      <!-- Colaborador -->
      <tr><td style="padding:16px 32px 0">
        <div style="font-size:16px;font-weight:700;color:#052960">${data.nombre}</div>
        <div style="font-size:12px;color:#94A3B8;margin-top:2px">Cédula: ${data.cedula} &nbsp;·&nbsp; ${data.descripcion || 'Planilla ordinaria'}</div>
      </td></tr>
      <!-- Tabla de montos -->
      <tr><td style="padding:20px 32px 28px">
        <table width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #E2E8F0;border-radius:8px;overflow:hidden">
          <tr style="background:#EEF5FF">
            <td style="padding:10px 16px;font-size:11px;font-weight:700;color:#1565C0;text-transform:uppercase;letter-spacing:.5px">Concepto</td>
            <td style="padding:10px 16px;font-size:11px;font-weight:700;color:#1565C0;text-transform:uppercase;letter-spacing:.5px;text-align:right">Monto</td>
          </tr>
          <tr style="border-top:1px solid #E2E8F0">
            <td style="padding:11px 16px;font-size:13px;color:#1E293B">Salario Bruto</td>
            <td style="padding:11px 16px;font-size:13px;font-weight:600;color:#1E293B;text-align:right">${fmtCRC(bruto)}</td>
          </tr>
          <tr style="background:#FFF8F5;border-top:1px solid #E2E8F0">
            <td style="padding:11px 16px;font-size:13px;color:#F97316">Deducción CCSS (empleado)</td>
            <td style="padding:11px 16px;font-size:13px;font-weight:600;color:#F97316;text-align:right">- ${fmtCRC(ccss)}</td>
          </tr>
          <tr style="background:#FFF8F5;border-top:1px solid #E2E8F0">
            <td style="padding:11px 16px;font-size:13px;color:#F97316">Deducción Renta</td>
            <td style="padding:11px 16px;font-size:13px;font-weight:600;color:#F97316;text-align:right">- ${fmtCRC(renta)}</td>
          </tr>
          ${otras > 0 ? `
          <tr style="background:#FFF8F5;border-top:1px solid #E2E8F0">
            <td style="padding:11px 16px;font-size:13px;color:#F97316">Otras Deducciones</td>
            <td style="padding:11px 16px;font-size:13px;font-weight:600;color:#F97316;text-align:right">- ${fmtCRC(otras)}</td>
          </tr>` : ''}
          <tr style="border-top:1px solid #E2E8F0">
            <td style="padding:11px 16px;font-size:13px;color:#1E293B">Total Deducciones</td>
            <td style="padding:11px 16px;font-size:13px;font-weight:600;color:#EF4444;text-align:right">- ${fmtCRC(total_deduc)}</td>
          </tr>
          <!-- Neto -->
          <tr style="background:linear-gradient(135deg,#052960,#1565C0);border-top:2px solid #1565C0">
            <td style="padding:14px 16px;font-size:15px;font-weight:700;color:#ffffff">Salario Neto a Depositar</td>
            <td style="padding:14px 16px;font-size:19px;font-weight:700;color:#ffffff;text-align:right;font-family:'Georgia',serif">${fmtCRC(neto)}</td>
          </tr>
        </table>
        ${data.observaciones ? `
        <div style="margin-top:14px;font-size:12px;color:#475569;background:#F8FAFC;border-radius:8px;padding:10px 14px">
          <strong>Observaciones:</strong> ${data.observaciones}
        </div>` : ''}
      </td></tr>
      <!-- Footer -->
      <tr><td style="background:#F8FAFC;padding:14px 32px;border-top:1px solid #E2E8F0;text-align:center">
        <span style="font-size:11px;color:#94A3B8">
          ${EMPRESA_NOMBRE} &nbsp;·&nbsp; Portal de Recursos Humanos<br/>
          Este comprobante es generado automáticamente. Para consultas contacte a RRHH.
        </span>
      </td></tr>
    </table>
  </td></tr>
</table>
</body></html>`;
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
