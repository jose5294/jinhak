const fs = require('fs');
const path = require('path');

const DB_PATH = path.join(__dirname, '..', 'public', 'data', 'admission_db.json');
const db = JSON.parse(fs.readFileSync(DB_PATH, 'utf8'));
const records = db.records;

console.log(`=== 전체 데이터베이스 전수 점검 시작 (총 ${records.length}건) ===`);

const issues = {
    outOfRange: [],           // < 1.00 or > 9.00
    rankInversion: [],        // cut50 > cut70 (since cut50 should be better or equal, i.e., lower number)
    extremeJumps: [],         // |cut25_70 - cut70| >= 1.5
    medicalAnomalies: [],     // Med school with cut > 2.5 (교과) or > 3.5 (종합)
    topUnivGyogwaSpikes: []   // Top Seoul univs Gyogwa cut > 3.0
};

records.forEach(r => {
    // 1. Range check
    if (r.cut70 !== null && (r.cut70 < 1.0 || r.cut70 > 9.0)) {
        issues.outOfRange.push({ field: 'cut70', record: r });
    }
    if (r.cut25_70 !== null && (r.cut25_70 < 1.0 || r.cut25_70 > 9.0)) {
        issues.outOfRange.push({ field: 'cut25_70', record: r });
    }

    // 2. Rank inversion check (cut50 number should be <= cut70 number)
    if (r.cut25_50 !== null && r.cut25_70 !== null) {
        if (r.cut25_50 > r.cut25_70 + 0.3) { // allow tiny rounding margin of 0.3
            issues.rankInversion.push(r);
        }
    }

    // 3. Extreme jump check
    if (r.cut70 !== null && r.cut25_70 !== null) {
        const diff = Math.abs(r.cut25_70 - r.cut70);
        if (diff >= 1.5) {
            issues.extremeJumps.push({ diff: diff, record: r });
        }
    }

    // 4. Medical anomalies
    const isPureMed = r.major === '의예과' || r.major === '의학과' || r.major === '치의예과' || 
                      r.major === '한의예과' || r.major === '약학과' || r.major === '수의예과';
    if (isPureMed && r.cut25_70 !== null) {
        if (r.type === '교과' && r.cut25_70 > 2.5) {
            issues.medicalAnomalies.push(r);
        } else if (r.type === '종합' && r.cut25_70 > 3.5) {
            issues.medicalAnomalies.push(r);
        }
    }

    // 5. Top Univ Gyogwa spikes
    const topUnivs = ['서울대', '연세대', '고려대', '서강대', '성균관대', '한양대', '중앙대', '경희대', '한국외대', '서울시립대'];
    const isTopUniv = topUnivs.some(u => r.univ.includes(u));
    if (isTopUniv && r.type === '교과' && r.cut25_70 !== null && r.cut25_70 > 3.0) {
        issues.topUnivGyogwaSpikes.push(r);
    }
});

console.log(`\n--- 점검 결과 요약 ---`);
console.log(`1. 범위 벗어남 (<1.0 또는 >9.0): ${issues.outOfRange.length}건`);
console.log(`2. 50%컷 > 70%컷 역전: ${issues.rankInversion.length}건`);
console.log(`3. 1.5등급 이상 극단적 변동: ${issues.extremeJumps.length}건`);
console.log(`4. 의약학계열 비정상 컷: ${issues.medicalAnomalies.length}건`);
console.log(`5. 서울 주요대 교과 3.0초과: ${issues.topUnivGyogwaSpikes.length}건`);

if (issues.extremeJumps.length > 0) {
    console.log(`\n--- 극단적 변동 상위 20건 상세 ---`);
    issues.extremeJumps.sort((a, b) => b.diff - a.diff).slice(0, 20).forEach(({ diff, record }) => {
        console.log(`[${record.univ}] ${record.type}(${record.evalType}) ${record.major} | 2022: ${record.cut70} -> 2025: ${record.cut25_70} (차이: ${diff.toFixed(2)})`);
    });
}

if (issues.rankInversion.length > 0) {
    console.log(`\n--- 50%컷과 70%컷 역전 상위 10건 ---`);
    issues.rankInversion.slice(0, 10).forEach(r => {
        console.log(`[${r.univ}] ${r.major} | 50%컷: ${r.cut25_50} vs 70%컷: ${r.cut25_70}`);
    });
}

if (issues.topUnivGyogwaSpikes.length > 0) {
    console.log(`\n--- 서울 주요대 교과 3.0 초과 목록 ---`);
    issues.topUnivGyogwaSpikes.forEach(r => {
        console.log(`[${r.univ}] ${r.evalType} ${r.major} | 2022: ${r.cut70} -> 2025: ${r.cut25_70}`);
    });
}
