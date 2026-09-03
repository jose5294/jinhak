const fs = require('fs');
const path = require('path');
const { PDFParse } = require('pdf-parse');

async function inspectJinjuInPdf() {
    const p = 'C:\\Users\\OWNER\\Desktop\\2025학년도 대입 전형 결과\\2025학년도 대입 전형결과(경남).pdf';
    const buf = fs.readFileSync(p);
    const parser = new PDFParse({ data: buf });
    const res = await parser.getText();
    const pages = res.text.split(/-- \d+ of \d+ --/);
    for (let i = 72; i <= 75; i++) {
        console.log(`\n=== Jinju Page ${i} ===`);
        console.log(pages[i]?.substring(0, 1000));
    }
}

inspectJinjuInPdf();
