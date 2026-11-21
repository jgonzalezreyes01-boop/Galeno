# Registro preliminar de verificación técnica

**Fecha:** 20 de noviembre de 2026  
**Versión:** prototipo funcional local 0.1.0  
**Entorno comprobado:** Node.js 22.16.0, SQLite local, navegador Chromium en entorno de revisión.

Se ejecutó `npm test`: **8 grupos de pruebas aprobados, 0 fallidos**.

| Grupo | Resultado | Qué comprueba |
|---|---|---|
| 1. Rutas y autenticación | Aprobado | Acceso anónimo bloqueado, RUT inválido y contraseña incorrecta |
| 2. Sesiones y perfiles | Aprobado | Ingreso de paciente, tutor, SOME y profesional; restricciones por rol |
| 3. Sectorización | Aprobado | Horarios del sector correspondiente; bloqueo de otro sector y fechas fuera de rango |
| 4. Reservas | Aprobado | Confirmación con hora real, doble reserva impedida, cancelación y reprogramación |
| 5. Tutorías | Aprobado | Solicitud pendiente sin acceso, aprobación SOME y reserva por tutor |
| 6. Nómina SOME | Aprobado | Datos de agenda y ficha física; acceso restringido |
| 7. Inasistencias | Aprobado | Profesional asignado, otro rol bloqueado y tolerancia de 20 minutos |
| 8. Auditoría y salida | Aprobado | Registro de acciones, acceso restringido y revocación de sesión |

**Revisión de interfaz:** se comprobó en Chromium el flujo completo de acceso, cambio de sección, consulta de horarios y confirmación de una reserva; sin errores de JavaScript observados. La vista móvil de 390 píxeles no mostró desplazamiento horizontal.

**Alcance de la evidencia:** estas verificaciones son preliminares y se ejecutaron sobre un ambiente de demostración con pacientes ficticios. No representan certificación de seguridad, pruebas de carga, validación de accesibilidad ni aceptación del CESFAM. En particular no se realizaron los 38 casos formales diseñados en la Sumativa 3.
