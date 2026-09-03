const fs = require('fs');
const path = require('path');
const { PDFParse } = require('pdf-parse');

const PDF_DIR = 'C:\\Users\\OWNER\\Desktop\\2025학년도 대입 전형 결과';

async function findGachon() {
    const p = path.join(PDF_DIR, '2025학년도 대입 전형결과(경기_1).pdf');
    const buf = fs.readFileSync(p);
    const parser = new PDFParse({ data: buf });
    const res = await parser.getText();
    const pages = res.text.split(/-- \d+ of \d+ --/);
    pages.forEach((txt, idx) => {
        if (txt.includes('의예과') && idx < 30) {
            console.log(`\n=== Gachon Page ${idx} ===`);
            txt.split('\n').forEach(l => {
                if (l.includes('의예과') || l.includes('의예') || l.includes('지역균형') || l.includes('바람개비') || l.includes('학생부교과')) {
                    console.log(l);
                }
            });
        }
    });
}

findGachon();
