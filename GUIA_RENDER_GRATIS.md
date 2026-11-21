# Proyecto Galeno — publicación gratuita en Render

## Antes de comenzar
Este paquete mantiene SQLite en disco temporal. En Render gratis, las reservas y cambios **se pierden** cuando la instancia se reinicia, se suspende o se vuelve a desplegar. Solo usar datos ficticios. Esta es una versión para exposición, NO un sistema sanitario real.

## GitHub
1. Crear una cuenta en https://github.com y un repositorio privado `proyecto-galeno-demo`.
2. En el repositorio abrir **Add file → Upload files** y subir **el contenido de esta carpeta descomprimida**, no el ZIP. Deben verse `server.mjs`, `package.json`, `render.yaml`, `public/`, `src/` y `tests/` en la raíz.
3. Pulsar **Commit changes**. No subir archivos `.env`, claves privadas ni bases de datos `.sqlite`.

## Render
1. Crear cuenta en https://dashboard.render.com con GitHub.
2. Elegir **New → Blueprint** y autorizar el acceso al repositorio `proyecto-galeno-demo` (puede aparecer como **New → Web Service** según interfaz).
3. Seleccionar el repositorio y confirmar la configuración de `render.yaml`.
4. Al solicitar `GALENO_DEMO_PASSWORD`, ingresar una contraseña LARGA y diferente de las cuentas de prueba; nunca guardarla en el repositorio.
5. Verificar plan `Free` antes de confirmar. No elegir un plan de pago.
6. Esperar el estado **Live** y abrir la URL `https://proyecto-galeno-demo.onrender.com` o la que Render asigne.
7. El navegador solicita acceso privado: usuario `galeno` y la contraseña definida en Render.
8. Luego en la aplicación elegir el perfil ficticio y entrar con la contraseña de demostración `Galeno2026!`.

Si Render no permite la creación mediante Blueprint, seleccionar **New → Web Service → Build and deploy from Git repository**: runtime Node; rama main; build `echo listo`; start `npm start`; instancia Free. Configurar variables manualmente: `NODE_VERSION=22.13.1`, `NODE_ENV=production`, `GALENO_DB_FILE=/tmp/galeno.sqlite`, `GALENO_SECRET` cadena aleatoria de 64 caracteres o más, `GALENO_DEMO_USER=galeno`, `GALENO_DEMO_PASSWORD` contraseña de 12 caracteres o más.

## Diagnóstico
- Si figura “Build failed”, revisar **Logs** en Render.
- Si el servicio no inicia, comprobar `GALENO_SECRET`, `GALENO_DEMO_USER` y `GALENO_DEMO_PASSWORD`.
- Si demora en abrir, esperar el arranque: Render Free suspende instancias inactivas.
- Comprobar `/api/health`: debe responder un JSON con `ok: true`.
- Si se perdieron las reservas, recordar la limitación del disco temporal: se requiere migrar a PostgreSQL/Neon para persistencia.
