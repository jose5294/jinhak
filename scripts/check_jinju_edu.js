const fs = require('fs');
const path = require('path');

const DB_PATH = path.join(__dirname, '..', 'public', 'data', 'admission_db.json');
const db = JSON.parse(fs.readFileSync(DB_PATH, 'utf8'));

const jinjuList = db.records.filter(r => r.univ.includes('진주교대') || r.univ.includes('진주교육대'));
console.log(`진주교대 총 ${jinjuList.length}건:`);
jinjuList.forEach(r => {
    console.log(`[${r.univ}] ${r.type}(${r.evalType}) ${r.major} | 2022컷: ${r.cut70 || '-'} | 2025컷: ${r.cut25_70 || '-'} | 실반영: ${r.hasReal2025}`);
});
