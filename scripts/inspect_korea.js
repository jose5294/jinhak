const fs = require('fs');
const { PDFParse } = require('pdf-parse');

const samplePath = 'C:\\Users\\OWNER\\Desktop\\2025학년도 대입 전형 결과\\2025학년도 대입 전형결과(서울_1).pdf';
const dataBuffer = fs.readFileSync(samplePath);

const parser = new PDFParse({ data: dataBuffer });
parser.getText().then(res => {
    const pages = res.text.split(/-- \d+ of \d+ --/);
    console.log('--- Page 62 (고려대 1) ---');
    console.log(pages[62]?.substring(0, 1500));
}).catch(err => console.error(err));
