# Trazabilidad inicial: Proyecto Galeno

Correspondencia con los informes anteriores (HoraSalud). La ejecución de pruebas se realizará formalmente en la siguiente etapa del proyecto.

| Requisito | Implementación en esta versión | Verificación preliminar | Pendiente para uso real |
|---|---|---|---|
| RF-01 | `POST /api/login`, `validRut`, `users.sector`, perfiles de registro | Acceso válido/incorrecto, sector y rol | Integración segura con servicio de inscripción per cápita |
| RF-02 | `GET /api/slots`, `POST /api/bookings`, índices de unicidad, transacciones | Sector correcto; evitar dobles reservas, reprogramación y cancelación | Pruebas concurrentes bajo carga e integración con la agenda oficial |
| RF-03 | `dependent_links`, solicitud y aprobación por SOME | Tutela pendiente bloqueada; aprobada habilitada | Verificación real de parentesco o representación |
| RF-04 | `GET /api/roster` y ficha física ficticia en nómina SOME | Control de acceso y salida de nómina | Cruce con archivo clínico real autorizado |
| RF-05 | `POST /api/bookings/:id/no-show` + 20 min + dueño de agenda | Profesional correcto, otro perfil prohibido, cita futura bloqueada | Confirmar protocolo local de asistencia, reclamos y tolerancia |
| RF-06 | Excluido | No aplica en esta etapa | Lista de espera y automatización formal |
| RNF-01 | No implementado como objetivo verificable | Sin prueba de carga | 150 usuarios concurrentes, p95 < 2 s |
| RNF-SEC02 | JWT, scrypt, permisos en servidor, auditoría, CSP | Casos de control de acceso del prototipo | TLS real, cifrado en reposo, pentest, revisión de infraestructura |
| RNF-03 | Interfaz responsive y formularios con etiquetas | Revisión de pantalla escritorio/móvil | Auditoría de contraste WCAG AA y navegación por teclado/lector |
| RNF-04 | No implementado como SLA | Sin monitoreo | SLA y observabilidad en PaaS |

## Registro de diferencias frente a los informes

1. La arquitectura del despliegue **aún no es** React/Express/PostgreSQL; esta versión es un prototipo local sin dependencias.
2. La validación por RUT y el sector provienen de **datos ficticios precargados**, no de una API externa.
3. El tutor presenta la solicitud y la aprobación SOME se registra; se necesita **validación de identidad real**.
4. La confirmación de horas se genera desde el bloque seleccionado, para evitar el defecto DEF-01.
5. El paciente no tiene rutas a la nómina SOME y el servidor exige el perfil correspondiente, por DEF-02.
6. Las sesiones usan token firmado y credenciales, frente al pendiente DEF-03.
7. El No-Show se restringe al profesional asignado y a la tolerancia de 20 minutos, para atender DEF-04.
8. El día de la semana se calcula desde la fecha y no es texto fijo, para atender DEF-05.
9. Estos son cambios de código **pendientes de ser validados por el equipo en una ejecución formal**; no corresponden a correcciones homologadas en el CESFAM.

## Evidencia inicial disponible

Las pruebas automatizadas pueden ejecutarse con `npm test`. La revisión visual puede reproducirse con el recorrido propuesto en `README.md`. Para una entrega académica deben registrarse capturas, resultados, fecha, responsable y fallos detectados.
