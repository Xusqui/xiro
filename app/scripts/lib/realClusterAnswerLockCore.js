'use strict';

const fs = require('fs');
const path = require('path');
const {
    nowIso,
    sleep,
    fetchJson,
    joinClient,
    waitForEvent,
    buildSubmitPayload,
    emitSubmitWithAck,
    summarizeAcks,
    hasDistributedLockMetrics,
    getLockMetrics,
    triggerTrivialQuestionRound
} = require('./realClusterAnswerLockUtils');

async function runRealClusterAnswerLock(cfg) {
    const metricsUrl = `${cfg.target.replace(/\/$/, '')}/api/metrics`;
    const roomMetricsUrl = roomId => `${metricsUrl}?roomId=${encodeURIComponent(roomId)}`;

    const clients = [];
    const samples = [];
    let roomId = cfg.pin;
    let baselineMetrics = null;
    let distributedMetricsAvailable = true;

    try {
        baselineMetrics = await fetchJson(roomMetricsUrl(roomId));
        if (!hasDistributedLockMetrics(baselineMetrics)) {
            distributedMetricsAvailable = false;
            console.log(`[${nowIso()}] warning: answer_lock_distributed not available in target /api/metrics`);
        }

        const baselineRoom = getLockMetrics(baselineMetrics);
        console.log(`[${nowIso()}] baseline lock metrics room=${roomId} lock_miss=${baselineRoom.lock_miss} attempts=${baselineRoom.attempts}`);

        for (let i = 0; i < cfg.clients; i++) {
            const client = await joinClient(cfg.target, cfg.pin, i + 1);
            clients.push(client);
            roomId = client.roomId || roomId;
            if ((i + 1) % 10 === 0 || i === cfg.clients - 1) {
                console.log(`[${nowIso()}] joined ${i + 1}/${cfg.clients}`);
            }
        }

        baselineMetrics = await fetchJson(roomMetricsUrl(roomId));
        if (!hasDistributedLockMetrics(baselineMetrics)) distributedMetricsAvailable = false;

        const baselineRoomResolved = getLockMetrics(baselineMetrics);
        console.log(`[${nowIso()}] baseline (resolved room) room=${roomId} lock_miss=${baselineRoomResolved.lock_miss} attempts=${baselineRoomResolved.attempts}`);

        const questionPromises = clients.map(c =>
            waitForEvent(c.socket, 'new-question', 20000)
                .then(data => ({ ok: true, client: c, data }))
                .catch(() => ({ ok: false, client: c, data: null }))
        );

        await triggerTrivialQuestionRound(clients, roomId);

        const questions = await Promise.all(questionPromises);
        const ready = questions.filter(q => q.ok && q.data?.question);
        if (ready.length === 0) throw new Error('No clients received new-question; cannot execute submit-answer load burst');

        console.log(`[${nowIso()}] clients with new-question=${ready.length}/${clients.length}`);

        const burstTasks = [];
        ready.forEach(item => {
            const payload = buildSubmitPayload(item.client, roomId);
            burstTasks.push(emitSubmitWithAck(item.client.socket, payload));
            burstTasks.push(emitSubmitWithAck(item.client.socket, payload));
        });

        const acks = await Promise.all(burstTasks);
        const ackSummary = summarizeAcks(acks);
        console.log(`[${nowIso()}] submit burst completed totalAcks=${ackSummary.totalAcks} ok=${ackSummary.okTrue} dup=${ackSummary.duplicates}`);

        const loops = Math.max(1, Math.floor(cfg.soakSeconds / cfg.pollSeconds));
        for (let i = 0; i < loops; i++) {
            await sleep(cfg.pollSeconds * 1000);
            const snap = await fetchJson(roomMetricsUrl(roomId));
            if (!hasDistributedLockMetrics(snap)) distributedMetricsAvailable = false;
            const lock = getLockMetrics(snap);
            samples.push({ timestamp: nowIso(), lock });
            console.log(`[${nowIso()}] soak sample ${i + 1}/${loops} attempts=${lock.attempts} lock_miss=${lock.lock_miss} miss_rate=${lock.miss_rate}%`);
        }

        const finalMetrics = await fetchJson(roomMetricsUrl(roomId));
        if (!hasDistributedLockMetrics(finalMetrics)) distributedMetricsAvailable = false;

        const baselineRoomFinal = getLockMetrics(baselineMetrics);
        const finalRoom = getLockMetrics(finalMetrics);
        const result = {
            startedAt: nowIso(),
            target: cfg.target,
            pin: cfg.pin,
            roomId,
            clients: cfg.clients,
            soakSeconds: cfg.soakSeconds,
            pollSeconds: cfg.pollSeconds,
            distributedMetricsAvailable,
            ackSummary,
            baselineRoom: baselineRoomFinal,
            finalRoom,
            delta: {
                attempts: finalRoom.attempts - baselineRoomFinal.attempts,
                acquired: finalRoom.acquired - baselineRoomFinal.acquired,
                lock_miss: finalRoom.lock_miss - baselineRoomFinal.lock_miss,
                degraded_fallback: finalRoom.degraded_fallback - baselineRoomFinal.degraded_fallback
            },
            samples
        };

        const rootDir = path.resolve(__dirname, '../../..');
        const outDir = path.join(rootDir, 'load-test-results');
        fs.mkdirSync(outDir, { recursive: true });
        const outPath = path.join(outDir, `real_cluster_answer_lock_${Date.now()}.json`);
        fs.writeFileSync(outPath, JSON.stringify(result, null, 2));

        return { result, outPath };
    } finally {
        clients.forEach(client => {
            try {
                client.socket.disconnect();
            } catch (_) {
                // noop
            }
        });
    }
}

module.exports = {
    runRealClusterAnswerLock
};
