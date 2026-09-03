const fs = require('fs');
const path = require('path');
const { PDFParse } = require('pdf-parse');

function parseLineAccurate(line, currentUniv, currentRegion, currentEvalType) {
    line = line.trim();
    if (!line) return null;
    if (line.includes('2025학년도') || line.includes('2025 대입') || line.includes('최종등록자') || line.includes('모집인원') || line.includes('모집단위') || line.includes('충원합격')) {
        return null;
    }

    // Split line by tab or multiple spaces
    let tokens = line.split(/[\t\s]+/).filter(Boolean);
    if (tokens.length < 4) return null;

    // Find cut50 and cut70
    // Grades in Korean admissions are between 1.00 and 9.00 (with decimal point)
    // Sometimes there are converted scores (like 950.5, 642.5), so grade must be <= 9.0
    const gradeCandidates = [];
    for (let i = tokens.length - 1; i >= 1; i--) {
        const tok = tokens[i].replace(/,/g, '');
        // Exclude subject words like '전과목', '국수영과'
        if (/^[가-힣]+$/.test(tok)) continue;
        const val = parseFloat(tok);
        if (!isNaN(val) && val >= 1.0 && val <= 9.0 && tok.includes('.')) {
            gradeCandidates.unshift({ idx: i, val: val });
        }
    }

    if (gradeCandidates.length === 0) return null;

    let cut50 = null;
    let cut70 = null;
    if (gradeCandidates.length >= 2) {
        cut50 = gradeCandidates[gradeCandidates.length - 2].val;
        cut70 = gradeCandidates[gradeCandidates.length - 1].val;
    } else {
        cut70 = gradeCandidates[0].val;
    }

    // Extract recruit and compRate
    // Major name ends before the first integer/number
    let majorParts = [];
    let firstNumIdx = -1;
    for (let i = 0; i < tokens.length; i++) {
        const val = parseFloat(tokens[i]);
        if (!isNaN(val) && /^\d+/.test(tokens[i])) {
            firstNumIdx = i;
            break;
        } else {
            majorParts.push(tokens[i]);
        }
    }

    if (firstNumIdx === -1 || majorParts.length === 0) return null;
    const major = majorParts.join(' ').trim();
    if (major.length < 2 || major.includes('모집단위') || major.includes('전형')) return null;

    const recruit = tokens[firstNumIdx] || '';
    let compRate = '';

    // Next token is usually compRate
    if (firstNumIdx + 1 < tokens.length) {
        let compToken = tokens[firstNumIdx + 1];
        compRate = compToken.replace(':1', '').replace(/,/g, '');
    }

    return {
        univ: currentUniv,
        region: currentRegion,
        evalType: currentEvalType || '수시전형',
        major: major,
        recruit: recruit,
        compRate: compRate,
        cut50: cut50,
        cut70: cut70
    };
}

// Test with GNU samples
const sampleLines = [
    "국어국문학과 \t15 4.80:1 25 \t4.46 \t4.96 전과목",
    "영어영문학부 영어영문학전공 \t9 5.67:1 \t9 \t4.89 \t4.63",
    "수의예과 \t5 36.80:1 \t1 \t1.11 \t1.27",
    "의예과 \t4 15.00:1 \t2 \t1.33 \t1.26",
    "간호학과 \t18 11.06:1 10 \t3.47 \t2.91",
    "디지털공연영상학과 \t20 2.60 16 947.62 940.96 1,000 4.10 \t4.30"
];

sampleLines.forEach(l => {
    const res = parseLineAccurate(l, '경상국립대', '경남', '학생부종합(일반)');
    console.log(res.major, '| 모집:', res.recruit, '| 경쟁률:', res.compRate, '| 50%:', res.cut50, '| 70%:', res.cut70);
});
