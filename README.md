# Portal de Recursos Humanos — Lean Consulting S.A.

Portal corporativo para la gestión de solicitudes de ausencias, comprobantes de pago y expedientes de colaboradores.

## Tecnologías

- **Frontend**: HTML5, CSS3, JavaScript vanilla
- **Backend / Base de datos**: Google Apps Script (GAS) + Google Sheets
- **Notificaciones**: Correo electrónico automático vía `GmailApp`
- **Lectura de Excel**: SheetJS (`xlsx`) CDN para parseo en el cliente

## Estructura de archivos

```
portal-rrhh/
├── index.html              — Estructura HTML completa del portal
├── portal-rrhh.css         — Estilos y paleta corporativa
├── portal-rrhh.js          — Lógica del cliente
├── gas-portal-rrhh.gs      — Backend Google Apps Script (copiar al editor GAS)
└── assets/
    └── img/
        └── lean-logo.png   — Logo Lean Consulting (colocar aquí manualmente)
```

## Configuración inicial

### 1. Google Apps Script

1. Abrir [script.google.com](https://script.google.com) y crear un proyecto nuevo (o abrir el existente vinculado al Spreadsheet)
2. Pegar todo el contenido de `gas-portal-rrhh.gs`
3. Editar las constantes de configuración al inicio del archivo:
   ```javascript
   const RRHH_EMAILS = ['kfernandez@leancr.com', 'cfernandez@leancr.com'];
   const EMPRESA_NOMBRE = 'Lean Consulting S.A.';
   ```
4. Ejecutar la función `initSheetHeaders()` **una sola vez** para crear las hojas con sus encabezados
5. Implementar como aplicación web: **Implementar → Nueva implementación → Aplicación web**
   - Ejecutar como: su cuenta
   - Acceso: Cualquier persona
6. Copiar la URL generada

### 2. Portal (portal-rrhh.js)

```javascript
const GAS_URL = 'https://script.google.com/macros/s/TU_ID/exec';
```

### 3. Logo

Guardar el logo de Lean Consulting como `assets/img/lean-logo.png` para que aparezca en los comprobantes impresos.

---

## Funcionalidades

### Colaborador

| Módulo | Descripción |
|---|---|
| **Nueva Solicitud** | Vacaciones (día completo / medio día), Incapacidad, Cumpleaños, Personal Day, Día sin goce |
| **Mis Solicitudes** | Historial filtrable; permite editar o cancelar solicitudes pendientes (máx. 2 veces) |
| **Historial Completo** | Línea de tiempo con estadísticas por tipo de solicitud |
| **Desglose de Vacaciones** | Cálculo de días acumulados, usados y disponibles desde la fecha de ingreso |
| **Mi Expediente** | Visualización de datos personales, dirección, contacto, bancarios y médicos |
| **Comprobantes de Pago** | Lista de comprobantes de planilla filtrados por mes y año; ver detalle y descargar / imprimir |

### Administrador

| Módulo | Descripción |
|---|---|
| **Solicitudes** | Aprobar, denegar o marcar en gestión; el saldo se descuenta al aprobar |
| **Colaboradores** | Crear, editar y activar/desactivar acceso de colaboradores |
| **Expedientes** | Crear y editar expedientes completos por colaborador |
| **Comprobantes de Pago** | Subir el Excel de planilla mensual; el sistema parsea cada fila, genera el comprobante y envía el correo automáticamente a cada colaborador |

---

## Módulo de Comprobantes de Pago

### Flujo admin

1. Entrar al panel Admin → tab **Comprobantes**
2. Arrastrar o seleccionar el archivo Excel de planilla mensual
3. El sistema detecta automáticamente las columnas (sin importar mayúsculas ni tildes)
4. Revisar la vista previa con los datos parseados
5. Seleccionar el período (mes/año) y descripción opcional
6. Clic en **Enviar comprobantes** — se envía un correo por colaborador

### Columnas requeridas en el Excel de planilla

El archivo debe tener **al menos** estas columnas (el nombre exacto no importa, el sistema las detecta por similitud):

| Columna esperada | Ejemplos de nombre aceptados |
|---|---|
| Nombre del colaborador | `Empleado`, `Nombre`, `Colaborador` |
| Cédula | `Cédula`, `Cedula`, `Identificacion` |
| Puesto | `Puesto`, `Cargo` |
| Fecha de ingreso | `Fecha Ingreso`, `Fecha de Ingreso` |
| Días trabajados | `Días Trabajados`, `Dias Trabajados` |
| Salario del mes | `Salario Mes`, `Salario del Mes` |
| Bono | `Bono` |
| Tiempo doble | `Tiempo Doble`, `Horas Dobles` |
| Subsidio incapacidad | `Subsidio Incapacidad`, `Subsidio` |
| Total beneficios | `Total Beneficios Salariales`, `Total Beneficios` |
| Pensión voluntaria | `Pension Voluntaria`, `Pensión Voluntaria` |
| CCSS | `CCSS` |
| Renta | `Renta`, `Impuesto de Renta` |
| CxC | `CXC`, `CxC` |
| Total rebajos | `Total Rebajos` |
| Salario neto | `Salario Neto a Transferir`, `Salario Neto`, `Neto` |

> **Importante:** La cédula del Excel debe coincidir exactamente con la registrada en la hoja **Empleados** del Spreadsheet. El sistema busca el correo del colaborador por cédula — no es necesario incluir el email en el Excel.

### Comprobante impreso / PDF

El comprobante generado replica el formato oficial de Lean Consulting:
- Logo corporativo
- Fecha del período en formato largo (ej: *31 de diciembre de 2025*)
- Datos del colaborador (nombre, cédula, puesto, fecha de ingreso)
- Sección **Beneficios** con días trabajados, salario mes, bono, horas dobles, subsidio y total
- Sección **Deducciones** con CCSS, renta, pensión voluntaria, CxC y total
- **Neto a Pagar** destacado al pie

---

## Google Sheets — Estructura de hojas

| Hoja | Columnas principales |
|---|---|
| `Empleados` | `cedula`, `nombre`, `puesto`, `ingreso`, `consumidos`, `email`, `emailcorp`, `pdTotal`, `pdUsados`, `pdAnio`, `acceso` |
| `Solicitudes` | `id`, `cedula`, `empleado`, `tipo`, `inicio`, `fin`, `dias`, `status`, `fecha`, `notaAdmin`, ... |
| `Expedientes` | `cedula`, `nombres`, `ap1`, `ap2`, `genero`, `fnac`, `emailcorp`, `iban`, `salario`, ... |
| `Admins` | `user`, `pass` |
| `Comprobantes` | `id`, `cedula`, `nombre`, `emailcorp`, `puesto`, `fecha_ingreso`, `periodo`, `dias_trabajados`, `salario_mes`, `bono`, `horas_dobles`, `subsidio`, `total_beneficios`, `pension_voluntaria`, `ccss`, `renta`, `cxc`, `total_rebajos`, `salario_neto`, `fecha_envio` |

---

## Reglas de negocio

| Tipo de ausencia | Saldo |
|---|---|
| Vacaciones | 1 día por mes laborado desde la fecha de ingreso |
| Cumpleaños | 1 día por año calendario |
| Personal Day | 3 días por año, no acumulables (vencen el 31/12) |
| Incapacidad / Sin goce | Sin límite; requieren aprobación |

- Fines de semana, feriados nacionales y el día de cumpleaños se excluyen del cálculo de días
- El saldo se descuenta **únicamente al aprobarse** (no al enviar la solicitud)
- Caché local de 5 minutos para reducir llamadas al backend
- Sesión persistida en `sessionStorage`; se restaura al recargar la página

## Feriados — Costa Rica

1 enero, Jueves y Viernes Santos (calculados dinámicamente), 11 abril, 1 mayo, 25 julio, 2 agosto, 15 agosto, 15 septiembre, 12 octubre, 25 diciembre.

---

## Historial de cambios

### v3 — Comprobantes, paleta corporativa y limpieza visual
- **Nuevo módulo Comprobantes de Pago** (admin + colaborador)
  - Admin sube Excel de planilla; sistema parsea por colaborador y envía email
  - Colaborador filtra, visualiza e imprime sus comprobantes por mes/año
  - Comprobante impreso replica formato oficial con logo, Beneficios y Deducciones
  - Email HTML con layout Beneficios/Deducciones enviado automáticamente
  - El correo del colaborador se obtiene desde la hoja Empleados por cédula (no del Excel)
- **Paleta corporativa actualizada**: blanco/azul/celeste — variables `--b500 #1565C0`, `--cyan #00B4D8`; topbar admin en navy, sin colores morados
- **Emojis eliminados** de toda la UI y mensajes JavaScript; reemplazados por monogramas y letras en cajas de color
- **`gas-portal-rrhh.gs`** agregado al repositorio como archivo fuente del backend GAS
- **Estructura de carpetas** `assets/img/` creada para el logo

### v2 — Estabilización y seguridad
- Protección XSS con `escHTML()` en todos los datos externos
- Validación de cédula y sanitización de inputs
- Caché TTL de 5 minutos con `localStorage`
- Corrección de formato de fechas NaN
- Manejo de errores offline con banner de sin conexión

### v1 — Versión inicial
- Login colaborador por cédula / admin por usuario+contraseña
- Solicitudes de vacaciones, incapacidad, cumpleaños, Personal Day, sin goce
- Cálculo automático de días hábiles con feriados CR
- Panel admin: aprobar/denegar/gestionar solicitudes
- Expedientes y gestión de colaboradores

---

© 2026 Lean Consulting S.A. — Todos los derechos reservados.
