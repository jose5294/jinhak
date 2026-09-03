const fs = require('fs');
const path = require('path');

const DB_PATH = path.join(__dirname, '..', 'public', 'data', 'admission_db.json');
const db = JSON.parse(fs.readFileSync(DB_PATH, 'utf8'));

const targetKeywords = ['간호', '초등교육', '약학', '수의예', '컴퓨터공학', '경영학'];
const keyUnivs = ['서울대', '연세대', '고려대', '성균관대', '부산대', '경상국립대', '경북대'];

console.log('=== 대표 학과 주요 대학 데이터 정밀 검증 표 ===\n');

targetKeywords.forEach(kw => {
    console.log(`\n=================== [ ${kw} ] ===================`);
    keyUnivs.forEach(u => {
        const matches = db.records.filter(r => r.univ.includes(u) && r.major.includes(kw));
        matches.slice(0, 3).forEach(r => {
            console.log(`[${r.univ}] ${r.type}(${r.evalType}) ${r.major} | 2022: ${r.cut70 || '-'} | 2025: ${r.cut25_70 || '-'} | 실반영: ${r.hasReal2025}`);
        });
    });
});
