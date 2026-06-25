# Xiro Presentador - Extensión Chrome

Extensión que evita que PowerPoint abra pestañas duplicadas de `presentador.html`.

## Cómo instalar

1. Abre Chrome y ve a `chrome://extensions`
2. Activa **Modo desarrollador** (esquina superior derecha)
3. Haz clic en **"Cargar descomprimida"**
4. Selecciona esta carpeta (`xiro-chrome-extension/`)
5. Listo — la extensión aparecerá en la lista

## Cómo funciona

Cada vez que Chrome abre una pestaña con `/presentador.html` (por ejemplo, al hacer clic en un enlace de PowerPoint):

- Si **ya existe** una pestaña con `presentador.html` → la reutiliza y cierra la nueva
- Si **no existe** → deja que la nueva pestaña se cargue normalmente

## Recargar tras cambios

Si modificas `background.js`, ve a `chrome://extensions` y pulsa el icono de recarga de la extensión.
