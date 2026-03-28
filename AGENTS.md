# Instrucciones del Proyecto

## Comandos en lenguaje natural

Cuando el usuario diga `levantar server local` o una variante equivalente:

1. Ejecutar `npm start` en la raiz del proyecto.
2. Confirmar que el servidor responde en `http://localhost:3001`.
3. Informar al usuario la URL local.
4. Si falla por falta de dependencias, ejecutar `npm install` y reintentar.
5. Si falta `DATABASE_URL`, avisar que debe existir en `.env`.

Cuando el usuario diga `enviar a vercel` o una variante equivalente:

1. Verificar que el proyecto compila o arranca localmente.
2. Verificar que existe `DATABASE_URL` en `.env` o en variables de entorno del sistema.
3. En Windows PowerShell, usar `cmd /c npx vercel deploy --prod --yes` en lugar de `npx vercel ...` directo, porque `npx.ps1` puede estar bloqueado por la politica de ejecucion.
4. Si el proyecto aun no tiene la variable remota configurada, agregarla con `cmd /c npx vercel env add DATABASE_URL production`.
5. Desplegar a produccion y devolver al usuario la URL final de Vercel.

## Contexto del proyecto

- El frontend estatico vive en `public/`.
- La API para Vercel vive en `api/data.js`.
- El servidor local vive en `server.js`.
- El proyecto usa `DATABASE_URL` para persistencia PostgreSQL.
