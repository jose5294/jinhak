const fs = require('fs');
const { PDFParse } = require('pdf-parse');

const samplePath = 'C:\\Users\\OWNER\\Desktop\\2025학년도 대입 전형 결과\\2025학년도 대입 전형결과(경남).pdf';
const dataBuffer = fs.readFileSync(samplePath);

const parser = new PDFParse({ data: dataBuffer });
parser.getText().then(res => {
    const pages = res.text.split(/-- \d+ of \d+ --/);
    console.log('--- Page 22 (경상국립대 수시 1) ---');
    console.log(pages[22]?.substring(0, 1500));
    console.log('--- Page 23 (경상국립대 수시 2) ---');
    console.log(pages[23]?.substring(0, 1500));
}).catch(err => console.error(err));
