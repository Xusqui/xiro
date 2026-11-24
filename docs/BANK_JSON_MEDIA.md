# Imágenes y audios en el JSON de bancos (formato 2)

Un banco exportado lleva todas sus imágenes y audios dentro del propio JSON, cada recurso una sola vez.

## Formato

```json
{
  "format_version": 2,
  "image_url": "media:m1",
  "media": {
    "m1": { "mime": "image/png", "data": "<base64>" },
    "m2": { "mime": "audio/mpeg", "data": "<base64>" }
  },
  "questions": [
    { "url_recurso": "media:m2", "question_image_url": "media:m1", "options": [{ "option_image_url": "media:m1" }] }
  ]
}
```

- Cuatro sitios admiten recurso: portada del banco (`image_url`), imagen o audio principal (`url_recurso`), imagen del enunciado (`question_image_url`) e imagen de cada opción (`option_image_url`).
- Una referencia es `media:<clave>` y la clave existe en `media`. La misma clave se puede usar en cualquier número de sitios: 50 preguntas con el mismo mapa llevan una sola copia.
- Solo se incluyen los ficheros de `/uploads/`. Una URL de otra web se deja tal cual.

## Código

- `public/js/admin/modules/bank-media.js`: `bundleBankMedia` (exportar) y `restoreBankMedia` (importar). Dependencias inyectables (`readMedia`, `upload`) para los tests.
- `services/bank-media-store.js` + `routes/bank-media.routes.js`: `POST /api/upload/bank-media`, multipart binario (campo `file`, sin base64). Tipo y tamaño salen de los bytes: imagen hasta 5 MB, audio hasta 10 MB, SVG nunca. El nombre es el hash del contenido, así que un recurso repetido no se duplica en disco.
- `public/data/schema.json` y el prompt `admin.tools.upload_ai_prompt` (10 idiomas, más el de reserva de `tools.js`): si cambia el formato, cambian los dos. `__tests__/bank-json-schema.test.js` lo comprueba.

## Reglas

- Al importar, un recurso que falla (clave que falta o subida rechazada) deja `null` en todos sus sitios y se avisa; nunca llega una referencia `media:` al servidor.
- Al exportar, un recurso que no se puede leer conserva su ruta y se avisa.
- Una IA externa deja los recursos en `null` y `"media": {}`: los añade después el usuario en XiRo!.
- Una pregunta `hotspot` («Toca la imagen») lleva su imagen en `url_recurso` con `tipo_contenido: "imagen"`, más `hotspot_area` y `hotspot_tolerance` (reglas del área en `docs/QUESTION_TYPES.md`). Sin `options`. Una IA externa las deja las tres en `null` (`schema.json` trae un ejemplo y el prompt lo explica en la regla 12): el banco se abre en el editor para subir la imagen y dibujar el área antes de guardarlo (`hotspot-json.js`).
- No se admite el formato antiguo con `image_data` por pregunta.
