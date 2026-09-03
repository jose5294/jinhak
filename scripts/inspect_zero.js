const fs = require('fs');
const { PDFParse } = require('pdf-parse');

async function inspectZeroFiles() {
    const zeroFiles = [
        '2025학년도 대입 전형결과(서울_4).pdf',
        '2025학년도 대입 전형결과(경기_3).pdf',
        '2025학년도 대입 전형결과(제주).pdf'
    ];

    for (let f of zeroFiles) {
        const p = 'C:\\Users\\OWNER\\Desktop\\2025학년도 대입 전형 결과\\' + f;
        const buf = fs.readFileSync(p);
        const parser = new PDFParse({ data: buf });
        const res = await parser.getText({ first: 1, last: 6 });
        console.log(`=== ${f} (Total: ${res.total} pages) ===`);
        console.log(res.text.substring(0, 800));
    }
}

inspectZeroFiles();
