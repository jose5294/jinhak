const fs = require('fs');
const path = require('path');
const { PDFParse } = require('pdf-parse');

const samplePath = 'C:\\Users\\OWNER\\Desktop\\2025학년도 대입 전형 결과\\2025학년도 대입 전형결과(경남).pdf';
const dataBuffer = fs.readFileSync(samplePath);

const parser = new PDFParse({ data: dataBuffer });
parser.getText().then(res => {
    console.log('Total pages:', res.total);
    const pages = res.text.split(/-- \d+ of \d+ --/);
    console.log('Split pages count:', pages.length);
    pages.forEach((p, idx) => {
        if (p.includes('수시모집') || p.includes('정시모집')) {
            const lines = p.trim().split('\n').filter(l => l.trim().length > 0).slice(0, 4);
            console.log('Page ' + idx + ': ' + lines.join(' | '));
        }
    });
}).catch(err => console.error(err));
