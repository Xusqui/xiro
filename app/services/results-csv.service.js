/**
 * @fileoverview Construcción del CSV de resultados de una partida (separador ';').
 */

const { escapeCsv, formatDateTime, formatDuration, formatGameType } = require('./results-format');

function appendMetadataLines(lines, session) {
    lines.push('XIRO! - Resultados de partida');
    lines.push(`PIN;${escapeCsv(session.pin)}`);
    lines.push(`Tipo;${formatGameType(session.game_type)}`);
    lines.push(`Fecha;${formatDateTime(session.played_at)}`);
    lines.push(`Duración;${formatDuration(session.duration_ms)}`);
    lines.push(`Jugadores;${session.player_count}`);
    lines.push(`Preguntas;${session.question_count}`);
    lines.push(`Resultado;${session.reason === 'completed' ? 'Completada' : 'Abandonada'}`);
    lines.push('');
}

function appendRankingLines(lines, ranking) {
    lines.push('RANKING FINAL');
    if (ranking[0]?.isTeam) {
        lines.push('Posición;Equipo;Puntuación');
    } else {
        lines.push('Posición;Jugador;Puntuación');
    }

    ranking.forEach((player, i) => {
        const score = player.scoreLabel || `${player.pts ?? player.score ?? 0}`;
        lines.push(`${i + 1};${escapeCsv(player.name)};${escapeCsv(score)}`);
    });
    lines.push('');
}

function resolveQuestionsContext(session) {
    const questions = session.questions_snapshot || [];
    const trivialMeta = questions?.isTrivialMeta ? questions : null;
    // Un snapshot que no es lista ni resumen de Trivial se trata como 'sin preguntas'
    const questionsArray = trivialMeta || !Array.isArray(questions) ? [] : questions;
    return { trivialMeta, questionsArray };
}

function appendQuestionsLines(lines, questionsArray) {
    if (questionsArray.length === 0) {
        return;
    }

    lines.push('PREGUNTAS');
    lines.push('Nº;Tipo;Pregunta;Respuesta correcta');
    questionsArray.forEach((question, i) => {
        lines.push(
            `${i + 1};${escapeCsv(question.question_type)};${escapeCsv(question.question_text)};${escapeCsv(question.correct_answer)}`
        );
    });
    lines.push('');
}

function appendTrivialWedgesLines(lines, ranking, trivialMeta) {
    if (!trivialMeta) {
        return;
    }

    const label = ranking[0]?.isTeam ? 'Equipo' : 'Jugador';
    lines.push('CATEGORÍAS OBTENIDAS');
    lines.push(`${label};Categorías conseguidas;Total`);
    for (const entry of ranking) {
        const wedges = trivialMeta.playerWedges?.[entry.name] || [];
        lines.push(`${escapeCsv(entry.name)};${escapeCsv(wedges.join(', '))};${wedges.length}`);
    }
    lines.push('');
}

function buildDetailHeaders(lines, isTrivial) {
    lines.push('DETALLE POR PREGUNTA');
    if (isTrivial) {
        lines.push('Nº ronda;Categoría;Pregunta;Jugador;Respuesta dada;¿Correcto?;¡Cuña!;Puntos;Tiempo (ms)');
        return;
    }

    lines.push('Nº pregunta;Pregunta;Jugador;Respuesta dada;¿Correcto?;Puntos;Tiempo (ms)');
}

function buildQuestionLabel(qInfo, firstPlayerData, qIdx) {
    if (qInfo) {
        return escapeCsv(qInfo.question_text);
    }

    if (firstPlayerData?.questionText) {
        return escapeCsv(firstPlayerData.questionText);
    }

    return `Pregunta ${qIdx + 1}`;
}

function appendTrivialDetailLine(lines, payload) {
    const {
        qIdx,
        categoryName,
        questionText,
        nick,
        data,
        correct
    } = payload;

    const wedge = data.wedgeEarned ? escapeCsv(data.wedgeEarned) : '';
    lines.push(`${qIdx};${categoryName};${questionText};${escapeCsv(nick)};${escapeCsv(data.answer)};${correct};${wedge};${data.pointsEarned ?? 0};${data.responseTimeMs ?? ''}`);
}

function appendClassicDetailLine(lines, payload) {
    const { qIdx, questionText, nick, data, correct } = payload;
    lines.push(`${qIdx + 1};${questionText};${escapeCsv(nick)};${escapeCsv(data.answer)};${correct};${data.pointsEarned ?? 0};${data.responseTimeMs ?? ''}`);
}

function appendQuestionDetails(lines, session, questionsArray, trivialMeta) {
    const playerAnswers = session.player_answers || {};
    const questionIndices = Object.keys(playerAnswers).map(Number).sort((a, b) => a - b);
    const isTrivial = !!trivialMeta;

    if (questionIndices.length === 0) {
        return;
    }

    buildDetailHeaders(lines, isTrivial);

    for (const qIdx of questionIndices) {
        const qInfo = questionsArray[qIdx];
        const firstPlayerData = Object.values(playerAnswers[qIdx] || {})[0];
        const questionText = buildQuestionLabel(qInfo, firstPlayerData, qIdx);
        const playersAtQuestion = playerAnswers[qIdx] || {};
        const sorted = Object.entries(playersAtQuestion).sort((a, b) => (b[1].pointsEarned ?? 0) - (a[1].pointsEarned ?? 0));

        for (const [nick, data] of sorted) {
            const correct = data.isCorrect === null ? 'Encuesta' : data.isCorrect ? 'Sí' : 'No';
            if (isTrivial) {
                const categoryName = escapeCsv(data.categoryName || firstPlayerData?.categoryName || '');
                appendTrivialDetailLine(lines, {
                    qIdx,
                    categoryName,
                    questionText,
                    nick,
                    data,
                    correct
                });
            } else {
                appendClassicDetailLine(lines, { qIdx, questionText, nick, data, correct });
            }
        }
    }
}

/**
 * Construye el contenido CSV a partir de una fila de game_sessions.
 * Separador: punto y coma (compatible con Excel español/catalán).
 * BOM UTF-8 añadido por el llamador.
 */
function buildCsv(session) {
    const lines = [];
    const ranking = session.final_ranking || [];
    const { trivialMeta, questionsArray } = resolveQuestionsContext(session);

    appendMetadataLines(lines, session);
    appendRankingLines(lines, ranking);
    appendQuestionsLines(lines, questionsArray);
    appendTrivialWedgesLines(lines, ranking, trivialMeta);
    appendQuestionDetails(lines, session, questionsArray, trivialMeta);

    return lines.join('\r\n');
}

module.exports = { buildCsv };
