const fs = require('fs');
const { PDFParse } = require('pdf-parse');

async function checkJeju() {
    const p = 'C:\\Users\\OWNER\\Desktop\\2025학년도 대입 전형 결과\\2025학년도 대입 전형결과(제주).pdf';
    const buf = fs.readFileSync(p);
    const parser = new PDFParse({ data: buf });
    const res = await parser.getText();
    const pages = res.text.split(/-- \d+ of \d+ --/);
    console.log('Total pages in 제주:', res.total);
    pages.forEach((txt, idx) => {
        const clean = txt.trim();
        if (clean.length > 5) {
            console.log(`Page ${idx} length: ${clean.length}, snippet: ${clean.substring(0, 80)}`);
        }
    });
}

checkJeju();
