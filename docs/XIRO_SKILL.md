# Skill `/xiro` de Claude Code

Skill de Claude Code que diseña diapositivas libres (`canvas`) para XiRo a partir de una descripción y las entrega como archivo `.xiroslide`, con vista previa PNG comprobada. También revisa, previsualiza o modifica `.xiroslide` exportados de XiRo.

El código vive en `skills/xiro/` (copia canónica, versionada con el repo). Claude Code la lee desde `~/.claude/skills/xiro/`, así que hay que instalarla ahí.

## Instalar

Requisitos: Node 18 o superior, `rsync`, Chrome o Chromium (solo para la vista previa) y Claude Code.

```bash
cd /Volumes/docker/xiro        # raíz del repo, en el Mac
skills/install.sh              # copia skills/xiro/ a ~/.claude/skills/xiro/
skills/install.sh --link       # alternativa: enlace simbólico, los cambios del repo se ven al instante
skills/install.sh --check      # compara lo instalado con el repo, sin tocar nada
```

Para otro destino: `CLAUDE_SKILLS_DIR=/ruta skills/install.sh`. Abre una sesión nueva de Claude Code para que la lista de skills incluya `/xiro`.

Comprobar la instalación:

```bash
node ~/.claude/skills/xiro/scripts/selftest.mjs --fast    # sin Chrome
node ~/.claude/skills/xiro/scripts/selftest.mjs           # con Chrome: mide avisos de diseño
```

## Usar

En Claude Code, en cualquier carpeta:

```
/xiro portada oscura para el concurso de geografía, con el título «Ronda final»
```

También funciona en lenguaje natural («dile a /xiro que haga una diapositiva de reglas…») o pasando un `.xiroslide` para revisarlo.

Salida de `build`:
- `~/Downloads/<nombre>.xiroslide`, para «Importar archivo» en el editor de diapositivas de XiRo.
- El mismo contenido en el portapapeles (`pbcopy`), para «Pegar».
- Vista previa en `<carpeta del spec>/<nombre>-preview/` (`index.html` y `slide-N.png`) y lista de avisos de diseño.

Herramienta directa (la usa la skill, pero sirve a mano):

```bash
node ~/.claude/skills/xiro/scripts/xiroslide.mjs build   spec.json [--out DIR] [--no-copy] [--no-preview]
node ~/.claude/skills/xiro/scripts/xiroslide.mjs check   archivo.xiroslide [--preview]
node ~/.claude/skills/xiro/scripts/xiroslide.mjs unpack  archivo.xiroslide [--dir DIR]
node ~/.claude/skills/xiro/scripts/xiroslide.mjs copy    archivo.xiroslide
node ~/.claude/skills/xiro/scripts/xiroslide.mjs preview spec.json|archivo.xiroslide
```

Formato del spec: `skills/xiro/references/formato.md`. Reglas de diseño: `skills/xiro/references/diseno.md`. Ejemplos: `skills/xiro/examples/`.

## Bancos de preguntas

Si se lo pides («/xiro 10 preguntas de geografía de España, tipos variados»), la skill genera un banco JSON (formato 2) con la estructura de `skills/xiro/references/banco-schema.json`, copia de `app/public/data/schema.json`. Las reglas de cada tipo están en `references/banco.md` y las comprueba `scripts/lib/bank.mjs` (las del prompt de IA externa más los límites de `app/validation/questions.js`: 2-6 opciones, `time_limit` 5-120, hasta 500 preguntas).

```bash
node ~/.claude/skills/xiro/scripts/xiroslide.mjs bank banco.json [--out DIR|archivo.json] [--no-write]
```

Valida y deja `~/Downloads/<nombre>.json`; con errores no escribe nada. Se importa desde el panel de bancos de preguntas con «Importar». Imágenes, audios y el área de `hotspot` quedan en `null`: se añaden después en XiRo!.

Si cambia `schema.json`, el prompt de IA o `validation/questions.js`: `node skills/xiro/scripts/sync-xiro.mjs app` (recopia el esquema), ajustar `bank.mjs` y `banco.md`, y `selftest --xiro app` (falla si el esquema copiado se desfasa o deja de pasar el validador).

## Mantener la copia al día

La skill lleva copiados los módulos reales de XiRo (`skills/xiro/scripts/lib/xiro/`, lista en `scripts/lib/vendor-files.mjs`) para validar y pintar igual que la app. Si cambian el formato de diapositivas libres, sus límites o sus estilos, la copia queda desfasada:

```bash
cd /Volumes/docker/xiro
node skills/xiro/scripts/sync-xiro.mjs app                     # recopia los módulos desde app/
# añadir props nuevas en scripts/lib/build-extras.mjs y references/formato.md
node skills/xiro/scripts/selftest.mjs --xiro app               # compara con el importador real
skills/install.sh                                              # reinstala la copia global
```

`origin.json` (en `scripts/lib/xiro/`) guarda la versión y el commit de XiRo del que salió la copia. El selftest falla si la copia no coincide con el repo.

Si editas la skill instalada en `~/.claude/skills/xiro/` en vez de en el repo, tráela de vuelta antes de commitear:

```bash
rsync -a --delete --exclude='.DS_Store' --exclude='._*' --exclude='*-preview/' ~/.claude/skills/xiro/ skills/xiro/
```

Con `--link` no hace falta: ambos sitios son el mismo directorio.

## Notas

- `skills/xiro/scripts/lib/xiro/node_modules/joi` es el build de navegador de joi (un fichero). `.gitignore` tiene una excepción a `node_modules/` para esa ruta.
- Las rutas de la skill son del Mac. No la uses desde el NAS: no hay Chrome ni `pbcopy`.
