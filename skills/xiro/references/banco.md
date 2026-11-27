# Bancos de preguntas para XiRo

Un banco es un único JSON con la estructura de `banco-schema.json` (copia de `app/public/data/schema.json` de XiRo; el selftest avisa si se desfasa). Lo importa el panel de bancos de XiRo. Las reglas de abajo son las del prompt que XiRo da a una IA externa (`admin.tools.upload_ai_prompt`) más los límites del validador del servidor (`app/validation/questions.js`): `scripts/lib/bank.mjs` las comprueba, y si cambian en XiRo hay que cambiarlas en los dos sitios.

## Cabecera

```json
{ "name": "…", "type": "quiz", "language": "es", "format_version": 2, "image_url": null, "media": {}, "questions": [] }
```

- `name`: nombre del banco, que da o inventa quien pide. `language`: código del idioma de las preguntas (`es`, `ca`, `en`…).
- `format_version` siempre 2. `media` siempre `{}`, e `image_url` siempre `null`.
- Máximo 500 preguntas por banco.
- **Imágenes y audios**: `url_recurso`, `question_image_url` y `option_image_url` van en `null` y `tipo_contenido` en `"texto"` (salvo `hotspot`). Nunca inventes rutas, URLs ni `media:…`, ni rellenes `media`: el usuario los añade después en XiRo!. Si pide una pregunta con imagen, escríbela como pregunta de texto y dile al final cuáles pueden llevarla.
- No añadas campos que no estén en el esquema ni omitas los de cada tipo.

## Campos comunes de cada pregunta

`question_text` (hasta 2000 caracteres), `type`, `tipo_contenido`, `url_recurso`, `question_image_url`, `time_limit` (segundos, entero de 5 a 120: 20–30 en preguntas cortas, 40–60 si hay que pensar u ordenar, 90 en sopa de letras).

Cada `option_text` hasta 500 caracteres. Enunciados y respuestas se leen en un móvil y en una pantalla: recórtalos sin cambiar el sentido ni cuál es la correcta.

## Tipos

Todos los tipos con `options` llevan de 2 a 6.

| `type` | Qué lleva |
|---|---|
| `quiz` | 4 `options`, exactamente una con `is_correct: true`. `justification` en la correcta y `null` en el resto. Es el tipo por defecto si el usuario no dice otro. |
| `survey` | Opinión, sin respuesta correcta: `options` todas `is_correct: false`, con `order_index: null`. |
| `survey_multiple` | Igual que `survey`, pero cada jugador marca varias. |
| `multiple_choice` | Varias correctas: al menos una `is_correct: true`. Obligatorios `mc_points_per_correct` (1–100, normalmente 10), `mc_penalty_per_incorrect` (0–100, normalmente 10) y `mc_perfect_bonus` (0–100, normalmente 20), enteros. |
| `order` | Ordenar: `options` con `order_index` 0, 1, 2… sin huecos (el orden correcto). Escríbelas desordenadas en la lista. `justification` por opción, o `null`. |
| `matching` | Emparejar: cada opción lleva `option_text` y `match_value`, `order_index` 0, 1, 2… e `is_correct: false`. |
| `numeric_approximation` | `correctAnswer` ENTERO (sin decimales: cambia de unidad o redondea y dilo en el enunciado), `maxPoints` 100, `toleranceMode` (`absolute`, `percentage` o `hybrid`), `toleranceValue` y `toleranceCap` mayores que 0 y acordes con la magnitud, `hint` opcional. Sin `options`. |
| `word_scramble` | `correctWord`: UNA palabra en MAYÚSCULAS de 7 a 10 letras, solo letras. El enunciado es una definición o pista que no contiene la palabra. Sin `options`. |
| `fill_blanks` | `question_text` es la frase completa con 1–3 palabras entre corchetes: `La capital de Francia es [París]`. Cada palabra: UNA sola, 4–14 letras, solo letras. Sin `options`. |
| `word_search` | `question_text` es la consigna (sin las palabras ocultas); 2–6 `options`, cada `option_text` en MAYÚSCULAS, 3–10 letras, solo letras, sin repetir, `is_correct: true` y `order_index` 0, 1, 2… |
| `hotspot` | «Toca la imagen»: consigna que pide tocar un lugar de una imagen. `tipo_contenido: "imagen"`, `url_recurso`, `hotspot_area` y `hotspot_tolerance` en `null`, sin `options`. La imagen y el área las pone el usuario en XiRo!. |

Las claves se escriben exactamente como en `banco-schema.json` (mezcla de `snake_case` y `camelCase`: `correctAnswer`, `correctWord`, `toleranceMode`…). Partir de un ejemplo del esquema para cada tipo evita errores.

## Contenido

- Lo que pida el usuario va tal cual (preguntas, respuestas, orden, tipos). Lo que falte, lo escribes tú en el idioma del usuario y bien acentuado.
- Si da un tema y un número, reparte los tipos con sentido (no 20 `quiz` idénticas si el tema permite ordenar, emparejar o aproximar), salvo que pida un tipo concreto.
- Hechos verificables: no inventes datos. Si no estás seguro de una cifra o un dato, no lo uses o dile al usuario que lo revise. Respuestas incorrectas plausibles, de longitud y estilo parecidos a la correcta, y la correcta repartida entre las posiciones.

## Salida

1. Escribe el banco en la carpeta de trabajo (`$CLAUDE_JOB_DIR/tmp/xiro/<slug>/banco.json` o `${TMPDIR:-/tmp}/xiro/<slug>/banco.json`).
2. `node ~/.claude/skills/xiro/scripts/xiroslide.mjs bank <banco.json> [--out DIR|archivo.json]` valida y deja el JSON en `~/Downloads/<nombre>.json`. Con errores no escribe nada: corrige y repite. `--no-write` solo valida.
3. Se importa en XiRo desde el panel de bancos de preguntas con «Importar» (sube el `.json`).
