const fs = require('fs');
const path = require('path');
const { PDFParse } = require('pdf-parse');

const PDF_DIR = 'C:\\Users\\OWNER\\Desktop\\2025학년도 대입 전형 결과';

async function findKonyang() {
    const files = fs.readdirSync(PDF_DIR).filter(f => f.includes('충남') || f.includes('대전'));
    for (let file of files) {
        const p = path.join(PDF_DIR, file);
        const buf = fs.readFileSync(p);
        const parser = new PDFParse({ data: buf });
        const res = await parser.getText();
        if (res.text.includes('건양대') || res.text.includes('건양대학교')) {
            console.log(`Found Konyang in ${file}!`);
            const pages = res.text.split(/-- \d+ of \d+ --/);
            pages.forEach((txt, idx) => {
                if (txt.includes('의학과') && (txt.includes('건양') || idx < 30)) {
                    console.log(`\n=== File: ${file}, Page: ${idx} ===`);
                    const lines = txt.split('\n');
                    lines.forEach((l, lIdx) => {
                        if (l.includes('의학과') || l.includes('8.2')) {
                            console.log(`L${lIdx}: ${l}`);
                            console.log('Context:\n', lines.slice(Math.max(0, lIdx - 3), lIdx + 4).join('\n'));
                        }
                    });
                }
            });
        }
    }
}

findKonyang();
