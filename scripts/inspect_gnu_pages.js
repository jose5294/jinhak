const fs = require('fs');
const { PDFParse } = require('pdf-parse');

async function inspectGNUPages() {
    const p = 'C:\\Users\\OWNER\\Desktop\\2025학년도 대입 전형 결과\\2025학년도 대입 전형결과(경남).pdf';
    const buf = fs.readFileSync(p);
    const parser = new PDFParse({ data: buf });
    const res = await parser.getText();
    const pages = res.text.split(/-- \d+ of \d+ --/);
    for (let i = 20; i <= 32; i++) {
        const txt = pages[i] || '';
        const first5Lines = txt.trim().split('\n').slice(0, 5).join(' | ');
        console.log(`Page ${i}: ${first5Lines}`);
    }
}

inspectGNUPages();
