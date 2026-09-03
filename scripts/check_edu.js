const fs = require('fs');
const path = require('path');

const DB_PATH = path.join(__dirname, '..', 'public', 'data', 'admission_db.json');
const db = JSON.parse(fs.readFileSync(DB_PATH, 'utf8'));

const eduList = db.records.filter(r => r.major.includes('초등교육') || r.univ.includes('교육대') || r.univ.includes('교대'));
console.log(`교육대/초등교육과 총 ${eduList.length}건 검색:\n`);

eduList.slice(0, 20).forEach(r => {
    console.log(`[${r.univ}] ${r.type}(${r.evalType}) ${r.major} | 2022컷: ${r.cut70 || '-'} | 2025컷: ${r.cut25_70 || '-'} | 실반영: ${r.hasReal2025}`);
});
