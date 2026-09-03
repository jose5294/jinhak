const fs = require('fs');
const path = require('path');
const { PDFParse } = require('pdf-parse');

// Helper to normalize university name
function normalizeUniv(name) {
    if (!name) return '';
    return name.replace(/\s+/g, '').replace(/대학교$/, '대').replace(/대학$/, '대');
}

// Helper to parse a single page
function parsePageLines(lines, currentUniv, currentRegion, currentEvalType, results) {
    for (let i = 0; i < lines.length; i++) {
        const line = lines[i].trim();
        if (!line) continue;

        // Skip headers & footers
        if (line.includes('2025학년도 전형 결과') || line.includes('2025 대입 수시') || line.includes('최종등록자') || line.includes('모집인원') || line.includes('충원합격') || line.includes('평가에')) {
            continue;
        }

        // Check if this line is an evalType header like "학생부종합(일반전형)" or "학업우수"
        if (line.startsWith('학생부교과') || line.startsWith('학생부종합') || line.startsWith('일반전형') || line.startsWith('지역인재') || line.startsWith('학업우수') || line.startsWith('학교추천') || line.startsWith('고른기회')) {
            currentEvalType = line;
            continue;
        }

        // Tokenize line by tab or multiple spaces
        const tokens = line.split(/[\t]+/).map(t => t.trim()).filter(Boolean);
        // If line didn't split by tabs, try split by space
        let parts = tokens;
        if (tokens.length < 4) {
            parts = line.split(/\s+/).filter(Boolean);
        }

        if (parts.length < 4) continue;

        // Look for cut50 and cut70 (numbers between 1.00 and 9.00 with decimals)
        // Usually they are near the end of the line
        const decimalMatches = [];
        for (let j = 1; j < parts.length; j++) {
            const p = parts[j].replace(/,/g, '');
            const val = parseFloat(p);
            // Check if valid grade (1.00 ~ 9.00) with decimal point
            if (!isNaN(val) && val >= 1.0 && val <= 9.0 && p.includes('.')) {
                decimalMatches.push({ idx: j, val: val, raw: p });
            }
        }

        if (decimalMatches.length >= 1) {
            // Cut70 is typically the last or second to last decimal
            const lastMatch = decimalMatches[decimalMatches.length - 1];
            const cut70 = lastMatch.val;
            const cut50 = decimalMatches.length >= 2 ? decimalMatches[decimalMatches.length - 2].val : null;

            // Major name is at the start (tokens before numbers)
            let majorTokens = [];
            let k = 0;
            while (k < parts.length && isNaN(parseFloat(parts[k]))) {
                majorTokens.push(parts[k]);
                k++;
            }
            const major = majorTokens.join(' ').trim();

            // Recruit count & Competition rate
            let recruit = '';
            let compRate = '';
            if (k < parts.length && !isNaN(parseInt(parts[k]))) {
                recruit = parts[k];
                k++;
            }
            if (k < parts.length) {
                compRate = parts[k].replace(':1', '');
            }

            if (major && major.length >= 2 && !major.includes('모집단위') && !major.includes('전형')) {
                results.push({
                    univ: currentUniv,
                    region: currentRegion,
                    evalType: currentEvalType || '수시전형',
                    major: major,
                    recruit: recruit,
                    compRate: compRate,
                    cut50: cut50,
                    cut70: cut70,
                    rawLine: line
                });
            }
        }
    }
    return currentEvalType;
}

async function testParse() {
    const samplePath = 'C:\\Users\\OWNER\\Desktop\\2025학년도 대입 전형 결과\\2025학년도 대입 전형결과(경남).pdf';
    const dataBuffer = fs.readFileSync(samplePath);
    const parser = new PDFParse({ data: dataBuffer });
    const res = await parser.getText();
    const pages = res.text.split(/-- \d+ of \d+ --/);

    let currentUniv = '';
    let currentRegion = '경남';
    let currentEvalType = '';
    const results = [];

    for (let pIdx = 0; pIdx < pages.length; pIdx++) {
        const pageText = pages[pIdx];
        const lines = pageText.split('\n').map(l => l.trim()).filter(Boolean);

        // Detect Cover page
        if (pageText.includes('2025 대입 수시모집 입시결과')) {
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

        // Detect EvalType headers inside page
        for (let l of lines) {
            if (l.includes('[2025학년도]') || l.includes('『2025학년도 전형 결과』')) {
                // Header section
            }
            if (l.startsWith('모집단위')) {
                const after = l.replace('모집단위', '').trim();
                if (after) currentEvalType = after;
            }
        }

        currentEvalType = parsePageLines(lines, currentUniv, currentRegion, currentEvalType, results);
    }

    console.log(`Parsed ${results.length} records from Gyeongnam PDF!`);
    console.log('Sample parsed items:');
    results.slice(0, 10).forEach(r => console.log(JSON.stringify(r)));

    // Check specific Gyeongsang Nat'l Univ items
    const gnuItems = results.filter(r => r.univ.includes('경상국립'));
    console.log(`Found ${gnuItems.length} records for 경상국립대. Sample:`);
    gnuItems.slice(0, 5).forEach(r => console.log(r.evalType, '|', r.major, '| 70% Cut:', r.cut70, '| 경쟁률:', r.compRate));
}

testParse();
