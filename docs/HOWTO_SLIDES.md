# Instruction slides (`howto`)

Hardcoded, voiced animation slides for custom games. Unlike a free `canvas` slide, the content is **code**, not data: the database only stores which topic to play, so no user-supplied HTML, text or media ever reaches the page.

## Data

- `slide_type = 'howto'` in `custom_game_questions`, column `slide_howto VARCHAR(32)` (migration `20261101000001_add_howto_slide_type.sql`, also added in `config/database.js`).
- `application/validators/HowToSlideValidator.js`: `slide_howto` is required for `howto` slides and must be one of `HOWTO_TOPICS` (closed list, currently `['word_search', 'quiz']`). Anything else is rejected by Joi (`validation.js`).
- The player sanitizer (`services/payload.sanitizer.js`) never copies `slide_howto`: players only receive `slide_type`.
- Scoring/timer treat `howto` as a slide (`QuestionScoringPolicy`, `GameUtils`); PDF export prints an info page (`pdf.service.js`).

## Client

- Core: `public/js/core/howto-core.js` (ES5; `tv.html` loads it too). A topic registers itself with `XiroHowTo.register(topic, { createStage, timeline })`; its texts live in `XiroHowToTexts[topic][lang]`. `mount(host, topic, { audio, language })` picks the language, builds the stage (1280x720 logical, scaled with `transform`), runs the timeline and plays the clips; `stop()` cancels timers and audio.
- Topic `quiz`: same three-file layout (`howto-quiz-ui.js`, `howto-quiz.js`, generated `howto-quiz-text.js`). Order of scenes: points at stake (a flip-style number that rolls for **random points**, then switches to **fixed points**; the creator's choice), the question with two to six colored answers (the demo shows four), tap (only the first counts), answer sent, an example of base + time bonus (fast / slow / wrong) and the result screen (green / red) with a streak bonus. The numbers on screen are illustrative (base 20, bonus up to 20, streak +50 %, the game defaults); the narration never says amounts, because the real base, bonus and streak depend on the game's configuration. Extra CSS: `.howto-tile*`, `.howto-points*`, `.howto-meter`, `.howto-result` in `css/howto.css` (no `gap`/CSS variables: the TV browser is old).
- Topic `word_search`: `howto-word-search-ui.js` (the phone + steps stage), `howto-word-search.js` (timeline: gestures start at a fraction of each clip's duration, so they follow the voice in every language), `howto-word-search-text.js` (**generated**: texts and clip durations in the 10 languages). Styles: `css/howto.css`.
- **Language**: the presenter uses the interface language (`XiroI18n.getLanguage()`); it restarts the animation on `xiro:language-changed`. The TV has no i18n (`i18n-stubs.js`), so it shows Spanish. A language without texts falls back to Spanish.
- **Look**: brand colors only (jungle background, plum phone, white cards with plum bottom edge, answer-tile hues), game voice (system sans 900), no emoji (mascot SVG instead). Each topic opens with a silent ~3 s intro card (`introName` + `introLabel` in its texts, e.g. "Sopa de letras / Instrucciones"); the timeline is shifted by `INTRO_MS` and the stage starts with class `howto-intro-on`.
- Presenter (`presenter/presenter-slide-howto.js`) mounts it in `#lobby-main` **with** narration. TV (`tv/tv-render-howto.js`) mounts the same animation **without** sound. Players (`player/player-slide-howto-ui.js`) and standalone mode only show «Mira la pantalla del presentador». Game music is muted on the slide (`presenter-music.js`, `hasAudio`).
- `XiroHowTo.stop()` runs on every slide change (`renderSlideOrQuestion`, TV `new-question`).
- Editor: `admin/modules/slides-howto.js`. The «Instrucciones» button opens a picker with one entry per question type; topics without animation yet (`ready: false`) are disabled with «Próximamente». The card edit modal changes the topic and footer.

## Narration

- Clips `public/audio/howto/<topic>/<lang>/c0..c7.mp3` (`word_search` and `quiz`) (es, ca, de, en, eu, fr, gl, ja, pt, zh), generated with VoiceStudio using the single cloned VoiceStudio voice "XiRo!" for every language (parameters in the `xiro-voz` skill, `.claude/skills/xiro-voz/voices.json`). After regenerating clips, bump `AUDIO_VERSION` in `howto-core.js` and rebuild the `dur` arrays. The 8 sentences per language are the `caps` of `howto-*-text.js` with the HTML tags stripped.
- Translations were written by Claude, not by a native speaker: have them reviewed (especially eu, gl, ca, ja, zh) before relying on them. Voices were approved by ear by the author; ca, gl and eu use the profile voice without `instruct`.
- **If a clip is regenerated, update its duration in `howto-<topic>-text.js`** (the timeline adapts to it).

## Adding a topic (one per question type)

1. Add the key (the `question_type`) to `HOWTO_TOPICS` (validator) and set `ready: true` in `_HOWTO_TOPICS` (`slides-howto.js`).
2. Create `howto-<topic>-ui.js` (stage), `howto-<topic>.js` (timeline + `register`), `howto-<topic>-text.js` (texts in 10 languages with `dur`) and the clips in `audio/howto/<topic>/<lang>/`.
3. Load the four files in `presentador.html` and `tv.html`, and extend `__tests__/howto-slide.test.js` and `public/js/core/__tests__/howto-core.test.js`.
