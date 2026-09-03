const fs = require('fs');
const path = require('path');
const { PDFParse } = require('pdf-parse');

function isJeongsiPageStrict(text) {
    if (!text) return true;
    if (text.includes('수능위주') || text.includes('수학 선택') || text.includes('과목별 백분위') || 
        text.includes('확률과') || text.includes('미적분') || text.includes('기하') ||
        text.includes('총점\n(수능)') || text.includes('총점 (수능)') || text.includes('총점(수능)') ||
        text.includes('수능백분위') || text.includes('수능 100%') || text.includes('[수능]') ||
        text.includes('이월반영') || text.includes('등록인원') || text.includes('지원율')) {
        return true;
    }
    if (text.includes('가군') || text.includes('나군') || text.includes('다군')) {
        return true;
    }
    return false;
}

// Test Konyang parsing with strict check
async function testKonyangStrict() {
    const p = 'C:\\Users\\OWNER\\Desktop\\2025학년도 대입 전형 결과\\2025학년도 대입 전형결과(대전_1).pdf';
    const buf = fs.readFileSync(p);
    const parser = new PDFParse({ data: buf });
    const res = await parser.getText();
    const pages = res.text.split(/-- \d+ of \d+ --/);

    console.log('Testing Daejeon 1 PDF pages for Konyang:');
    for (let i = 0; i < pages.length; i++) {
        const txt = pages[i];
        if (!txt || !txt.includes('건양')) continue;
        const isJ = isJeongsiPageStrict(txt);
        console.log(`Page ${i}: isJeongsi = ${isJ}`);
        if (!isJ && txt.includes('의학과')) {
            console.log(`--- Pure Susi Medicine page ${i} ---`);
            txt.split('\n').forEach(l => {
                if (l.includes('의학과') || l.includes('최저') || l.includes('면접')) {
                    console.log(l);
                }
            });
        }
    }
}

testKonyangStrict();
