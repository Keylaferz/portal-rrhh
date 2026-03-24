# Portal de Recursos Humanos — Lean Consulting S.A.

Portal corporativo para la gestión de solicitudes de vacaciones, incapacidades, días de cumpleaños y Personal Days.

## Tecnologías

- **Frontend**: HTML5, CSS3, JavaScript (vanilla)
- **Backend / Base de datos**: Google Apps Script (GAS) + Google Sheets
- **Notificaciones**: Correo electrónico automático vía GAS

## Estructura de archivos

| Archivo | Descripción |
|---|---|
| `index.html` | Estructura principal del portal |
| `portal-rrhh.css` | Estilos y diseño visual |
| `portal-rrhh.js` | Lógica del cliente (auth, solicitudes, cálculos) |

## Configuración inicial

1. Despliegue el script de Google Apps Script en su cuenta de Google.
2. Copie la URL del deployment y péguela en `portal-rrhh.js`:
   ```js
   const GAS_URL = 'https://script.google.com/macros/s/...';
   ```
3. Actualice `RRHH_EMAILS_LABEL` con los correos del equipo de RRHH.

## Funcionalidades principales

### Colaborador
- **Nueva solicitud**: Vacaciones (día completo / medio día), Incapacidad, Cumpleaños, Personal Day, Día sin goce.
- **Saldos en tiempo real**: Días disponibles de vacaciones, cumpleaños y Personal Days se actualizan al aprobarse cada solicitud.
- **Mi Expediente**: Visualización de datos personales registrados por RRHH.
- **Mis Solicitudes**: Historial filtrable con descarga en PDF y CSV. Permite editar o cancelar solicitudes pendientes (máx. 2 veces).
- **Historial Completo**: Línea de tiempo con estadísticas por tipo de solicitud.
- **Desglose de Vacaciones**: Cálculo de días acumulados, usados y disponibles desde la fecha de ingreso.

### Administrador
- **Panel de solicitudes**: Aprobar, denegar o marcar en gestión. Al aprobar, el saldo correspondiente se descuenta automáticamente.
- **Expedientes**: Crear y editar el expediente de cada colaborador.
- **Colaboradores**: Gestión de acceso (activo / inactivo) y datos base.

## Reglas de negocio

| Tipo | Saldo |
|---|---|
| Vacaciones | 1 día por mes laborado desde la fecha de ingreso |
| Cumpleaños | 1 día por año calendario |
| Personal Day | 3 días por año, no acumulables (vencen el 31/12) |
| Incapacidad / Sin goce | Sin límite de saldo; requieren aprobación |

- Fines de semana, feriados nacionales y el día de cumpleaños se excluyen automáticamente del cálculo.
- El saldo se descuenta **únicamente al aprobarse** la solicitud (no al enviarla).
- Los datos se almacenan en caché local (5 min) para reducir llamadas al servidor.

## Feriados incluidos

Costa Rica: 1 ene, Jueves y Viernes Santos, 11 abr, 1 may, 25 jul, 2 ago, 15 ago, 15 sep, 12 oct, 25 dic.

---

© 2026 Lean Consulting S.A. — Todos los derechos reservados.
