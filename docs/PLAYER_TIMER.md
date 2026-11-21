# Temporizador del jugador

Píldora informativa (no se toca) a la izquierda de la barra del apodo (la derecha es del logo personalizado del sitio) en las pantallas de pregunta del
móvil. Repite lo que enseña la cuenta atrás del presentador, que es la fuente de verdad. No decide
nada: la pregunta se sigue cerrando en el servidor (`TimerManager`) y el móvil lo sabe por
`blocked-answer`.

## Cómo se sincroniza

1. **Reloj del servidor.** Presentador y móvil miden su desfase con el servidor con varias idas y
   vueltas de `clock-sync` (con ack) y se quedan con la de menor latencia
   (`public/js/core/server-clock.js`). Se vuelve a medir en cada reconexión.
2. **Marca del presentador.** `presenter-question-timer.js` publica `presenter-timer-sync`
   `{ roomIdOrPin, questionIndex, value, total, at, paused }`: «enseño `value` desde `at`» en hora
   del servidor. Al empezar la cuenta, cada 5 segundos (corrige la deriva de `setInterval` y llega a
   quien se reconecte), al pausar y al reanudar. `at` es el compás real del `setInterval`, también
   en pausa, para que tras reanudar el segundo caiga en el mismo instante que en el presentador.
3. **Servidor.** `sockets/handlers/TimerSyncHandler.js`: solo del presentador de la sala, valida con
   Joi (`presenterTimerSync`), descarta marcas de otra pregunta o con la hora a más de 60 s, limita a
   20 eventos cada 10 s por socket y reenvía `timer-sync` a `<sala>:players`.
4. **Móvil.** `player-timer.js` (cableado) y `player-timer-view.js` (píldora). El valor sale de
   `core/countdown-anchor.js`; el anillo se vacía con una transición lineal hasta el siguiente
   segundo, sin pintar en cada fotograma.

## Dónde se ve

Solo en pantallas con `data-player-timer-slot` en la barra del apodo (las nueve pantallas de
pregunta). Desaparece al responder (decisión del usuario) y en diapositivas, espera y resultados. Los
cinco últimos segundos, en amarillo como el overlay del presentador; en pausa, el anillo se apaga.
Estilos en `css/player-timer.css`; nombre accesible `player.timer.label` en los 10 idiomas.

Sin marcas no hay píldora: Trivial y el modo individual no la usan (el individual tiene su propio
reloj).
