const fs = require('fs');
const path = require('path');
const { PDFParse } = require('pdf-parse');

function isJeongsiPage(text) {
    if (!text) return true;
    const lower = text.toLowerCase();
    if (text.includes('수능위주') || text.includes('수학 선택') || text.includes('과목별 백분위') || 
        text.includes('확률과') || text.includes('미적분') || text.includes('기하') ||
        text.includes('총점\n(수능)') || text.includes('총점 (수능)') || text.includes('총점(수능)')) {
        return true;
    }
    // 군 (가군, 나군, 다군)
    if (text.includes('가군') || text.includes('나군') || text.includes('다군')) {
        return true;
    }
    return false;
}

async function testCleanSusiParse() {
    const samplePath = 'C:\\Users\\OWNER\\Desktop\\2025학년도 대입 전형 결과\\2025학년도 대입 전형결과(경남).pdf';
    const dataBuffer = fs.readFileSync(samplePath);
    const parser = new PDFParse({ data: dataBuffer });
    const res = await parser.getText();
    const pages = res.text.split(/-- \d+ of \d+ --/);

    let currentUniv = '';
    let currentRegion = '경남';
    let currentEvalType = '';
    const records = [];

    for (let pIdx = 0; pIdx < pages.length; pIdx++) {
        const pageText = pages[pIdx];
        if (!pageText) continue;

        // Cover page check
        if (pageText.includes('2025 대입 수시모집 입시결과')) {
            const lines = pageText.split('\n').map(l => l.trim()).filter(Boolean);
            const coverLines = lines.filter(l => !l.includes('2025 대입 수시모집') && !l.includes('업로드'));
            if (coverLines.length >= 2) {
                currentRegion = coverLines[0].trim();
                currentUniv = coverLines.slice(1).join('').trim();
            } else if (coverLines.length === 1) {
                currentUniv = coverLines[0].trim();
            }
            currentUniv = currentUniv.replace(/\s+/g, '');
            currentEvalType = '';
            continue;
        }

        // CRITICAL: Skip all Jeongsi (CSAT) pages!
        if (isJeongsiPage(pageText)) {
            continue;
        }

        const lines = pageText.split('\n').map(l => l.trim()).filter(Boolean);
        for (let l of lines) {
            if (l.startsWith('모집단위')) {
                const after = l.replace('모집단위', '').trim();
                if (after) currentEvalType = after;
            } else if (l.startsWith('학생부교과') || l.startsWith('학생부종합') || l.startsWith('일반전형') || l.startsWith('지역인재')) {
                currentEvalType = l;
            }
        }

        for (let l of lines) {
            if (l.includes('2025학년도') || l.includes('최종등록자') || l.includes('모집인원') || l.includes('모집단위') || l.includes('평가에')) continue;

            const tokens = l.split(/[\t\s]+/).filter(Boolean);
            if (tokens.length < 4) continue;

            // Find valid grade decimals (1.00 ~ 9.00)
            const gradeCandidates = [];
            for (let i = tokens.length - 1; i >= 1; i--) {
                const tok = tokens[i].replace(/,/g, '');
                if (/^[가-힣]+$/.test(tok)) continue;
                const val = parseFloat(tok);
                if (!isNaN(val) && val >= 1.0 && val <= 9.0 && tok.includes('.')) {
                    gradeCandidates.unshift({ idx: i, val: val });
                }
            }

            if (gradeCandidates.length === 0) continue;

            let cut50 = null;
            let cut70 = null;
            if (gradeCandidates.length >= 2) {
                cut50 = gradeCandidates[gradeCandidates.length - 2].val;
                cut70 = gradeCandidates[gradeCandidates.length - 1].val;
            } else {
                cut70 = gradeCandidates[0].val;
            }

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

            if (firstNumIdx === -1 || majorParts.length === 0) continue;
            const major = majorParts.join(' ').trim();
            if (major.length < 2 || major.includes('모집단위') || major.includes('전형')) continue;

            const recruit = tokens[firstNumIdx] || '';
            let compRate = '';
            if (firstNumIdx + 1 < tokens.length) {
                compRate = tokens[firstNumIdx + 1].replace(':1', '').replace(/,/g, '');
            }

            let type = '교과';
            if (currentEvalType.includes('종합') || currentEvalType.includes('서류')) {
                type = '종합';
            }

            records.push({
                univ: currentUniv,
                evalType: currentEvalType,
                type: type,
                major: major,
                recruit: recruit,
                compRate: compRate,
                cut50: cut50,
                cut70: cut70
            });
        }
    }

    console.log(`Extracted ${records.length} pure SUSI records from Gyeongnam PDF.`);
    const gnuMeds = records.filter(r => r.univ.includes('경상국립') && (r.major.includes('의예') || r.major.includes('약학') || r.major.includes('간호')));
    console.log('--- GNU Medicine/Pharmacy/Nursing check ---');
    gnuMeds.forEach(r => console.log(r.type, '|', r.evalType, '|', r.major, '| 50%:', r.cut50, '| 70%:', r.cut70, '| comp:', r.compRate));
}

testCleanSusiParse();
