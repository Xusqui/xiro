# Secretos generados al primer arranque

Xiro! no pide escribir contraseñas ni claves. La primera vez que arrancas el proyecto, el servicio
`secrets` las crea y las guarda; después no las toca nunca.

## Cómo funciona

1. `docker compose up -d` arranca antes el servicio `secrets` (`app/scripts/generate-secrets.js`).
   Los demás servicios esperan con `depends_on: secrets: condition: service_completed_successfully`.
2. Escribe cuatro ficheros de solo lectura (modo 0444, un valor cada uno, sin salto de línea) en el
   volumen `xiro_secrets`:

   | Fichero | Lo usa | Longitud |
   |---------|--------|----------|
   | `db_password` | Postgres (`POSTGRES_PASSWORD_FILE`), backend y backup (`DB_PASSWORD_FILE`) | 48 |
   | `redis_password` | Redis (`--requirepass`) y backend (`REDIS_PASSWORD_FILE`) | 48 |
   | `jwt_secret` | Backend (`JWT_SECRET_FILE`) | 64 |
   | `updater_token` | Backend (`UPDATER_TOKEN_FILE`) y `updater` | 64 |

3. Si un fichero ya existe, se conserva. **Nunca se rota ningún secreto.**
4. Si el `.env` ya traía `DB_PASSWORD`, `REDIS_PASSWORD`, `JWT_SECRET` o `UPDATER_TOKEN`, se copian
   tal cual a los ficheros (instalaciones anteriores siguen funcionando con sus mismas claves). Se
   ignoran los textos de relleno que empiezan por `CAMBIA` y los `JWT_SECRET`/`UPDATER_TOKEN` de
   menos de 32 caracteres.

## Reglas

- Una variable directa (`JWT_SECRET=…` en `.env`) gana siempre sobre su `*_FILE` en el backend
  (`app/config/env.js`). Postgres y Redis leen solo el volumen. Por eso: no cambies esos valores
  en `.env` después del primer arranque, o el backend y Redis dejarán de coincidir.
- `app/ecosystem.config.js` carga `config/env.js` al principio: PM2 copia los secretos a los
  workers al leerlo, así que tienen que estar resueltos antes.
- El registro del generador solo escribe nombres de fichero, nunca valores.
- El volumen `xiro_secrets` va en tus copias de seguridad. Con `docker compose down -v` se borra:
  la base de datos seguiría en disco, pero sin su contraseña no se puede abrir.

## Si se pierde el volumen

- Con `DB_PASSWORD` todavía en el `.env`: vuelve a arrancar; el generador lo adopta.
- Sin ese valor: la base de datos solo se recupera restaurando una copia de seguridad en una
  instalación nueva (`./restore.sh`).

## Fijar un valor a mano

Antes del primer arranque, pon la variable en `.env` (ver `.env.example`). Generar un valor:
`openssl rand -hex 32`.

## Tests

`app/scripts/__tests__/generate-secrets.test.js` y `app/config/__tests__/env.secret-files.test.js`.
