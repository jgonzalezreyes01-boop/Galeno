# Proyecto Galeno — primera versión funcional

Prototipo académico del sistema de reserva de horas médicas para atención primaria. Continúa el trabajo anteriormente denominado **HoraSalud**. Equipo actual: **Jorge González y Oscar Pacheco**.

La interfaz combina azul, blanco y degradados suaves. Incluye cuatro perfiles con distintas funciones y una base de datos local que conserva los cambios aunque se cierre el navegador.

> **Solo demostración:** todos los pacientes, profesionales y RUT del ejemplo son ficticios. No cargar datos clínicos reales ni publicar este servidor directamente en Internet.

## 1. Ejecutarlo en tu computador

**Requisito:** Node.js **22.13 o superior**. Puedes comprobarlo con `node -v`.

1. Extrae el ZIP completo en una carpeta.
2. Abre una terminal o PowerShell dentro de la carpeta `Proyecto_Galeno_Codigo`.
3. Ejecuta `npm start`.
4. En el navegador, visita **http://localhost:3000**.
5. En la página de acceso, selecciona una de las cuentas de demostración para completar automáticamente el RUT y la contraseña.

**No es necesario ejecutar `npm install` ni conectar una base de datos externa.** El servidor funciona con las herramientas incorporadas en Node.js 22. Esto facilita las demostraciones en clases.

En Windows, si aparece una advertencia del firewall, permite únicamente conexiones de redes privadas para la prueba local. No necesitas instalar PostgreSQL para esta primera versión.

## 2. Cuentas de demostración

En la pantalla de ingreso hay botones para autocompletar los datos. La contraseña común es **`Galeno2026!`**.

| Perfil | Nombre ficticio | RUT de prueba | Qué puede hacer |
|---|---|---|---|
| Paciente (sector 2) | Camila Rojas | 12.345.678-5 | Ver horas, reservar, cancelar, consultar su perfil |
| Paciente (sector 1) | Tomás Muñoz | 87.654.321-4 | Reservar solo programas de sector 1 |
| Paciente (sector 2) | Elena Vega | 11.111.111-1 | Ver una hora previamente asignada |
| Tutor | Patricia Fuentes | 22.222.222-2 | Gestionar el vínculo aprobado con Elena y solicitar otros |
| SOME | Daniela Herrera | 33.333.333-3 | Consultar nómina y fichas, revisar tutorías, publicar horarios y auditoría |
| Profesional | Dr. Nicolás Araya | 44.444.444-4 | Revisar citas asignadas y registrar inasistencias |
| Profesional | Dra. Paula Rivera | 55.555.555-5 | Revisar su propia agenda |

Hay otra paciente ficticia para ensayar el registro de inasistencias en fechas anteriores.

## 3. Prueba recomendada en clase

1. Ingresa como **Camila Rojas** y entra a **Reservar hora**. Selecciona **Programas de salud**, elige una fecha posterior y confirma un bloque. El sistema generará un código `GAL-000xx` y conservará la hora elegida.
2. En **Mis reservas**, revisa la reserva recién creada y usa **Cancelar** indicando el motivo (si está con más de dos horas de anticipación). Al volver a la agenda, el bloque debe estar disponible.
3. Ingresa como **Patricia Fuentes**. Verás el vínculo ya aprobado con Elena Vega. Solicita también un vínculo con Tomás Muñoz usando `87.654.321-4`.
4. Entra como **Daniela Herrera (SOME)**, abre **Validar tutorías** y aprueba la solicitud.
5. Vuelve a entrar como Patricia. El sistema permitirá consultar las horas de Tomás, filtradas por **sector 1**.
6. Para comprobar el **No-Show**, entra como **Dr. Nicolás Araya**, abre **Mi agenda** y selecciona la fecha de dos días antes del primer inicio de la aplicación. Hay una reserva pasada de demostración. El botón debe permitir marcarla como inasistencia. Una cita futura no lo permite.

La nómina del SOME se consulta en la fecha de la reserva; allí aparece el número de ficha clínica física simulado.

## 4. Ejecutar pruebas automáticas

En otra terminal, desde la carpeta del proyecto:

```bash
npm test
```

Las pruebas crean una base temporal propia. No modifican la información que hayas usado durante la demostración. Se revisan: autenticación, autorización por perfil, sector, duplicación de horas, cancelaciones, reprogramación, tutorías, nómina, No-Show y auditoría.

Además de las pruebas automáticas, realiza un recorrido manual en Chrome, Edge o Firefox para registrar las capturas de la evaluación.

## 5. Estructura del código

```text
Proyecto_Galeno_Codigo/
├── server.mjs                # API HTTP y controles de acceso
├── src/
│   ├── store.mjs            # Tablas SQLite, índices, datos de demostración
│   └── domain.mjs           # RUT, contraseñas, JWT y reglas compartidas
├── public/
│   ├── index.html           # Entrada de la aplicación web
│   ├── app.js               # Interfaz y navegación de pacientes/personal
│   └── styles.css           # Diseño azul y blanco adaptable a celulares
├── tests/
│   ├── galeno.test.mjs      # Pruebas automáticas de API y reglas de negocio
├── docs/
│   └── TRAZABILIDAD.md      # Requisitos, evidencias y pendientes
├── Iniciar_Galeno_Windows.bat # Inicio sencillo desde Windows
└── data/                    # Base local autogenerada, no incluida en ZIP
```

## 6. Alcance y decisiones técnicas

Esta versión conserva el alcance prioritario del proyecto anterior:

- **RF-01:** ingreso con credenciales, verificación de dígito del RUT y asignación de sector a través del registro local simulado.
- **RF-02:** agendas separadas para Medicina general y Programas, exclusión de otros sectores, reserva transaccional y bloqueo de doble reserva.
- **RF-03:** vínculos de tutor con consentimiento declarado, solicitud pendiente, aprobación/rechazo por SOME y reservas en nombre de pacientes autorizados.
- **RF-04:** nómina para SOME con hora, profesional, RUT, número ficticio de ficha y estado.
- **RF-05:** registro de inasistencias únicamente por el profesional correspondiente, tras 20 minutos.
- **RNF-SEC02 (parte de aplicación):** contraseñas con scrypt y sal, cookies HttpOnly, JWT firmado, controles de rol en el servidor y registro de acciones.

También incorpora cancelación con límite de dos horas, reprogramación en API, avisos internos y creación de bloques por SOME.

### Qué todavía NO hace

**No está listo para operar con pacientes reales.** La validación de inscripción per cápita está simulada, no hay conexión al sistema clínico, ni envío real de SMS/correos, ni pasarela externa de datos. La relación tutor-paciente se aprueba manualmente desde el perfil SOME, pero no constituye validación oficial de identidad o representación. Los datos clínicos son inventados.

La **reasignación automática RF-06** está fuera de esta versión según el alcance heredado. No se han verificado los objetivos de 150 usuarios concurrentes, p95 bajo 2 segundos, disponibilidad 99%, accesibilidad WCAG AA ni seguridad integral de producción.

### Diferencia respecto de la arquitectura originalmente propuesta

Los informes de HoraSalud planteaban **React (PWA) + Node.js/Express + PostgreSQL en PaaS**. Para que la primera entrega pueda **ejecutarse de inmediato sin depender de Internet ni instalar servicios externos**, esta demo utiliza:

- **JavaScript estándar**, HTML y CSS para la interfaz (en vez de React);
- **Node.js 22** con servidor HTTP incorporado (en vez de Express);
- **SQLite** mediante `node:sqlite` (en vez de PostgreSQL).

La API mantiene rutas y reglas separadas de la interfaz, facilitando el paso posterior a React/Express/PostgreSQL. Esa migración, el despliegue y la homologación son **trabajos pendientes**, no características ya implementadas.

## 7. Datos y configuración

La base local se crea automáticamente en `data/galeno.sqlite`. Para reiniciar la demostración desde cero, **detén el servidor** y elimina `data/galeno.sqlite` (y cualquier archivo `-wal` o `-shm`). En el siguiente arranque se recuperarán las cuentas, horarios y datos iniciales.

Para una demostración privada se usa la clave JWT incorporada; **antes de cualquier despliegue externo** define `GALENO_SECRET` en una variable de entorno con un valor aleatorio fuerte, usa HTTPS, cambia todas las credenciales, elimina el listado de cuentas de demo, aplica un control de acceso por infraestructura, respaldo y auditorías de seguridad. No uses este prototipo como un servicio sanitario real.

## 8. Próxima etapa: pruebas con evidencia

Con los archivos disponibles, el equipo puede crear una matriz de pruebas con: código de caso, precondición, datos usados, pasos, resultado esperado, resultado obtenido, fecha, ejecutor y captura. El resultado de las pruebas automáticas es una evidencia útil, pero **no sustituye** la ejecución y documentación formal de los 38 casos definidos en la Sumativa 3.


## Publicación gratuita
Esta variante incluye `render.yaml` y `GUIA_RENDER_GRATIS.md`. En Render gratis los datos SQLite no son persistentes. Usa exclusivamente datos simulados.
