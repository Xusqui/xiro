---
name: xiro
description: Diseña diapositivas libres para XiRo a partir de una descripción y las entrega como archivo .xiroslide (para «Importar archivo») y copiadas al portapapeles (para «Pegar»), con vista previa PNG comprobada. También revisa, previsualiza o modifica archivos .xiroslide exportados de XiRo. Úsala siempre que el usuario diga «dile a /xiro…», «/xiro …», pida una diapositiva, lámina o slide para XiRo o para un juego personalizado de XiRo, o mencione un .xiroslide, aunque no nombre la skill.
argument-hint: "[descripción de la diapositiva o diapositivas]"
---

# /xiro: diapositivas libres para XiRo

Petición: $ARGUMENTS

Hay que entregar una o varias diapositivas libres (`slide_type: canvas`) bien diseñadas, en un `.xiroslide` que XiRo importe **sin avisos**, y además en el portapapeles. Todo pasa por la herramienta de la skill, que normaliza, valida y pinta con los módulos reales de XiRo (copiados en `scripts/lib/xiro/`, formatVersion 7: estilo, formas libres, texto tipo Word, tablas, gráficos, roles y patrones), así que la vista previa es la de XiRo.

## Herramienta

```bash
node ~/.claude/skills/xiro/scripts/xiroslide.mjs build   <spec.json> [--out DIR|archivo.xiroslide] [--no-copy] [--no-preview]
node ~/.claude/skills/xiro/scripts/xiroslide.mjs check   <archivo.xiroslide> [--preview]   # qué haría XiRo al importarlo + vista previa
node ~/.claude/skills/xiro/scripts/xiroslide.mjs unpack  <archivo.xiroslide> [--dir DIR]   # .xiroslide → spec.json + assets/ para modificarlo
node ~/.claude/skills/xiro/scripts/xiroslide.mjs copy    <archivo.xiroslide>               # copiar un .xiroslide al portapapeles
node ~/.claude/skills/xiro/scripts/xiroslide.mjs preview <spec.json|archivo.xiroslide>     # solo vista previa
```

Si la skill está en otra carpeta, usa la ruta base que indica Claude Code al cargarla. Escribe la ruta completa en cada orden: las variables de shell no pasan de una llamada a otra.

Necesita Node 18 o superior y ninguna dependencia. `build`:
- escribe `<nombre>.xiroslide` en `~/Downloads` (o en `--out`). Solo sobrescribe archivos que generó la propia skill; si el nombre está cogido por otro, añade `-2`, `-3`…;
- lo copia al portapapeles (pbcopy, comprobado);
- deja la vista previa en `<carpeta del spec>/<nombre>-preview/`: `index.html` y `slide-N.png`;
- lista los AVISOS de diseño: letra reducida para caber, texto cortado, palabras partidas, palabras solas en la última línea, contraste medido sobre los píxeles reales, líneas que se montan, elementos fuera del lienzo, imágenes que no llenan su caja…

Si `build` da `ERROR`, no se genera nada. Lee el mensaje, corrige el spec y repite.

## Flujo

1. **Entender la petición.** Qué contenido lleva, cuántas diapositivas, para qué sirve (portada, reglas, ronda, pregunta, información, descanso, cierre…), qué estilo y colores, y qué imágenes ha dado el usuario (rutas o URL).
   - Los textos que dé el usuario van tal cual. Los que faltan, escríbelos tú: breves y en el idioma del usuario (español por defecto, bien acentuado).
   - No preguntes salvo que falte algo imprescindible que no se pueda inventar, como «mi logo» sin archivo. Lo demás (estilo, paleta, textos de apoyo, composición) lo decides tú y lo cuentas al final.
2. **Dirección de arte y diseño.** Lee entera la sección 0 de `references/diseno.md` (dirección de arte, tópicos de IA que no son punto de partida, revisión final) y es obligatoria. Decide una identidad visual que salga del tema, el público, el propósito y el tono, y apúntala en `_estilo`. Luego lee el resto de `diseno.md` (rejilla, métricas de las fuentes, paletas, SVG) y `references/formato.md` (sintaxis del spec). Los `examples/` enseñan técnicas, no son plantillas: no copies su aspecto. Elige la composición de cada diapositiva por su contenido, sin repetir la misma en toda la serie. Calcula el alto de cada caja de texto con la fórmula de la guía antes de escribirla.
3. **Escribir el spec.** Hazlo en una carpeta de trabajo: `$CLAUDE_JOB_DIR/tmp/xiro/<slug>/` si existe esa variable, si no `${TMPDIR:-/tmp}/xiro/<slug>/`. Las imágenes del usuario se referencian por su ruta absoluta, sin copiarlas. Los iconos, fondos y gráficos van como `svg` en línea. Varias diapositivas van en un mismo spec (`slides`), con la misma rejilla y la misma paleta.
4. **Construir:** `node ~/.claude/skills/xiro/scripts/xiroslide.mjs build <carpeta>/spec.json`. Usa `--out` si el usuario quiere el archivo en otra carpeta, y `--no-copy` si no quiere que se toque su portapapeles.
5. **Revisar.** Abre con Read **cada** `slide-N.png` y lee los AVISOS. Corrige lo que estorbe y vuelve a construir, hasta 3 vueltas:
   - todos los avisos de texto reducido, cortado o partido, de palabras solas y de contraste;
   - lo que se ve mal: desalineado, apretado, vacío descompensado, jerarquía floja, poco legible a ×0,2 (móvil).

   - la **revisión final de dirección de arte** (sección 0 de `diseno.md`): mira todos los PNG juntos y responde a sus siete preguntas. Si la serie parece una presentación genérica de IA, con tarjetas repetidas, paleta o letra previsibles, adornos que no aportan o la misma composición una y otra vez, rediséñala.

   Puede quedar un aviso solo si es intencionado, y entonces lo explicas.
6. **Entregar.** Contesta en el idioma del usuario y en pocas líneas:
   - la ruta del `.xiroslide` y si quedó copiado en el portapapeles;
   - cómo meterlo en XiRo (abajo);
   - la ruta de la vista previa PNG;
   - las decisiones que tomaste: la dirección de arte y por qué encaja con el tema, la paleta, los textos que escribiste tú y las imágenes convertidas.

   Si el usuario sigue la sesión desde otro dispositivo y tienes `SendUserFile`, mándale el `.xiroslide` y los PNG.

### Cómo se importa en XiRo (para el mensaje final)

En el panel de administración, abre el juego personalizado y pulsa «Añadir diapositiva libre». Luego:
- **Pegar**: usa lo que hay en el portapapeles. Si el navegador no deja leerlo (XiRo por HTTP en la red local), XiRo abre un cuadro para pegarlo con ⌘V o Ctrl+V.
- **Importar archivo**: elige el `.xiroslide`.

Una sola diapositiva se abre en el editor: pulsa «Aplicar» y guarda el juego. Varias se añaden al final del juego tras confirmar. Para reutilizarlas en otros juegos, en ese mismo selector, Biblioteca → «Importar a la biblioteca».

## Modificar o revisar un .xiroslide existente

- «Cambia esta diapositiva» o «haz otra como esta»: primero `unpack <archivo> --dir <carpeta de trabajo>`; luego edita `spec.json` (las imágenes quedan en `assets/`); por último `build`. Las diapositivas exportadas de XiRo traen todas las props explícitas, así que no habrá avisos de valores por defecto.
- «¿Está bien este archivo?»: `check <archivo> --preview` dice qué haría XiRo (si lo rechaza, qué quitaría y por qué) y enseña la vista previa.

## Reglas

- Nunca escribas a mano el `.xiroslide`, el base64 ni los ids. Todo sale de `build`.
- No digas que está listo si `build` falló o si no has mirado los PNG.
- Imágenes: solo las que dé el usuario (archivo o URL suya) o SVG que dibujes tú. No busques ni descargues fotos de internet por tu cuenta. Nunca inventes datos, gráficos, fotos ni pruebas científicas o clínicas.
- Atajos: `layout` + `role` sin caja coloca el elemento en el hueco del patrón; tabla con `columns` + `rows` y alto automático; gráfico con `props.data` (crea la tabla oculta). Pautas de patrones, tablas, gráficos y temas: `references/diseno.md` sección 5b.
- Respeta los límites de XiRo: 50 elementos por diapositiva, 20 px mínimo por lado, las 8 fuentes de la lista, tablas de hasta 20 × 10 celdas, gráficos de hasta 24 categorías y 8 series (siempre vinculados por `id` a una tabla de la misma diapositiva). Si el diseño pide más, simplifícalo o reorganízalo.

## Mantenimiento

La skill no lleva una copia a mano de las reglas: usa los ficheros reales de XiRo copiados en `scripts/lib/xiro/`, con la misma estructura que en el repo (`origin.json` dice de qué versión y commit salieron). Son el modelo y sus módulos (`public/js/core/slide-canvas-*.js`, `slide-package.js`, `video-source.js`), el render y `css/slide-canvas.css`, los validadores Joi (`CanvasSlideValidator.js`, `CanvasTextSchema.js`, `CanvasTableSchema.js`, `SlidePackageValidator.js`), la importación (`services/slide-package/*`), las fuentes del lienzo y el build de navegador de joi. La lista está en `scripts/lib/vendor-files.mjs`.

Cuando XiRo cambie el formato:
1. `node ~/.claude/skills/xiro/scripts/sync-xiro.mjs <ruta a la carpeta app de XiRo>` vuelve a copiar esos ficheros. Si XiRo añade un módulo nuevo que cargan los que ya están, añádelo a `vendor-files.mjs`.
2. Si hay props nuevas, añádelas al spec en `scripts/lib/build-extras.mjs` (con mensajes claros) y a `references/formato.md`. Lo demás (normalizar, validar, pintar) ya sale de XiRo.
3. `node ~/.claude/skills/xiro/scripts/selftest.mjs --xiro <ruta a la carpeta app de XiRo>` comprueba:
   - que la copia es idéntica al repo;
   - que los ejemplos se construyen sin avisos, medidos en Chrome;
   - que la simulación de importación da lo mismo que el importador real del repo, en más de 60 paquetes buenos y malos.

   Copia los módulos a una carpeta temporal, así que no ejecuta nada dentro del repo.
