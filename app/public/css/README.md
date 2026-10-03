# CSS

Todos los ficheros de esta carpeta se escriben a mano y se sirven tal cual: no
hay compilación ni ficheros generados.

- `common.css`: reset y clases utilitarias compartidas. Las clases nuevas van
  en la sección final "Mantenido a mano".
- `output-*.css`: estilos propios de cada sección (admin, jugador, presentador,
  inicio, solitario). El prefijo es histórico.
- `tokens.css`: variables de diseño (paleta `plum`/`aubergine`/`camaleon`,
  tipografía, radios, espaciado).
- El resto: estilos de componente por página.

Qué carga cada página, cómo añadir una clase utilitaria (con variantes `hover:`,
`/20`, `md:`…) y la paleta: [docs/CSS_GUIDE.md](../../../docs/CSS_GUIDE.md).
