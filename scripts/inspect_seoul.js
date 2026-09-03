const fs = require('fs');
const { PDFParse } = require('pdf-parse');

const samplePath = 'C:\\Users\\OWNER\\Desktop\\2025학년도 대입 전형 결과\\2025학년도 대입 전형결과(서울_1).pdf';
const dataBuffer = fs.readFileSync(samplePath);

const parser = new PDFParse({ data: dataBuffer });
parser.getText().then(res => {
    console.log('Total pages in 서울_1:', res.total);
    const pages = res.text.split(/-- \d+ of \d+ --/);
    pages.forEach((p, idx) => {
        if (p.includes('수시모집') && p.includes('서울')) {
            const lines = p.trim().split('\n').filter(l => l.trim().length > 0).slice(0, 4);
            console.log('Page ' + idx + ': ' + lines.join(' | '));
        }
    });
}).catch(err => console.error(err));
