const cov = require('../coverage/coverage-final.json');
const results = [];
for (const [file, data] of Object.entries(cov)) {
    const b = data.b;
    let miss = 0;
    const missItems = [];
    for (const [id, counts] of Object.entries(b)) {
        counts.forEach((c, arm) => {
            if (c === 0) {
                miss++;
                const loc = data.branchMap[id];
                missItems.push(`B${id} arm${arm} line${loc && loc.loc ? loc.loc.start.line : '?'}`);
            }
        });
    }
    if (miss > 0) {
        const shortFile = file.replace('/Volumes/docker/xiro/app/', '');
        results.push({ file: shortFile, miss, items: missItems });
    }
}
results.sort((a, b) => b.miss - a.miss);
results.slice(0, 12).forEach(r => {
    console.log(r.miss + '\t' + r.file);
    console.log('    ' + r.items.join(', '));
});
