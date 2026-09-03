const fs = require('fs');
const path = require('path');
const { PDFParse } = require('pdf-parse');

const samplePath = 'C:\\Users\\OWNER\\Desktop\\2025학년도 대입 전형 결과\\2025학년도 대입 전형결과(경남).pdf';
const buf = fs.readFileSync(samplePath);
const parser = new PDFParse({ data: buf });

parser.getText().then(res => {
    const pages = res.text.split(/-- \d+ of \d+ --/);
    console.log('Total pages:', pages.length);
    for (let idx = 0; idx < pages.length; idx++) {
        const p = pages[idx];
        if (p.includes('의예과')) {
            console.log('\n================ PAGE ' + idx + ' ================');
            const lines = p.split('\n');
            for (let lIdx = 0; lIdx < lines.length; lIdx++) {
                if (lines[lIdx].includes('의예과')) {
                    console.log('LINE ' + lIdx + ': ' + lines[lIdx]);
                    console.log('--- CONTEXT ---');
                    console.log(lines.slice(Math.max(0, lIdx - 4), lIdx + 5).join('\n'));
                }
            }
        }
    }
}).catch(err => console.error(err));
