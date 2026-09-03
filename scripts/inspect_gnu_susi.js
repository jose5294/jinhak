const fs = require('fs');
const { PDFParse } = require('pdf-parse');

async function inspectGNUSusi() {
    const p = 'C:\\Users\\OWNER\\Desktop\\2025학년도 대입 전형 결과\\2025학년도 대입 전형결과(경남).pdf';
    const buf = fs.readFileSync(p);
    const parser = new PDFParse({ data: buf });
    const res = await parser.getText();
    const pages = res.text.split(/-- \d+ of \d+ --/);
    for (let i = 26; i <= 29; i++) {
        const txt = pages[i] || '';
        const lines = txt.split('\n');
        lines.forEach(l => {
            if (l.includes('의예과') || l.includes('수의예') || l.includes('약학')) {
                console.log(`Page ${i}: ${l}`);
            }
        });
    }
}

inspectGNUSusi();
