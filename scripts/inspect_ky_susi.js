const fs = require('fs');
const path = require('path');
const { PDFParse } = require('pdf-parse');

async function inspectKonyangSusi() {
    const p = 'C:\\Users\\OWNER\\Desktop\\2025학년도 대입 전형 결과\\2025학년도 대입 전형결과(대전_1).pdf';
    const buf = fs.readFileSync(p);
    const parser = new PDFParse({ data: buf });
    const res = await parser.getText();
    const pages = res.text.split(/-- \d+ of \d+ --/);
    for (let i = 0; i < 12; i++) {
        const txt = pages[i] || '';
        if (txt.includes('건양') || txt.includes('의학과')) {
            console.log(`\n=== Page ${i} ===`);
            txt.split('\n').forEach(l => {
                if (l.includes('전형') || l.includes('의학과') || l.includes('교과') || l.includes('수시') || l.includes('정시')) {
                    console.log(l);
                }
            });
        }
    }
}

inspectKonyangSusi();
