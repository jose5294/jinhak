const fs = require('fs');
const path = require('path');
const { PDFParse } = require('pdf-parse');

const PDF_DIR = 'C:\\Users\\OWNER\\Desktop\\2025학년도 대입 전형 결과';
const DB_JSON_PATH = path.join(__dirname, '..', 'public', 'data', 'admission_db.json');
const DB_JS_PATH = path.join(__dirname, '..', 'public', 'data', 'admission_db.js');

function normalizeUnivName(name) {
    if (!name) return '';
    let clean = name.replace(/\s+/g, '');
    clean = clean.replace(/대학교$/, '대').replace(/대학$/, '대');
    // Common aliases
    if (clean === '한국과학기술원') return 'KAIST';
    if (clean === '포항공과대') return '포항공대';
    return clean;
}

function cleanMajorName(name) {
    if (!name) return '';
    return name.replace(/\s+/g, '').replace(/\([^)]*\)/g, '');
}

function parseLine(line, currentUniv, currentRegion, currentEvalType) {
    line = line.trim();
    if (!line) return null;
    if (line.includes('2025학년도') || line.includes('2025 대입') || line.includes('최종등록자') || 
        line.includes('모집인원') || line.includes('모집단위') || line.includes('충원합격') || line.includes('평가에')) {
        return null;
    }

    let tokens = line.split(/[\t\s]+/).filter(Boolean);
    if (tokens.length < 3) return null;

    // Look for grade decimals (between 1.00 and 9.00 with decimal point)
    const gradeCandidates = [];
    for (let i = tokens.length - 1; i >= 1; i--) {
        const tok = tokens[i].replace(/,/g, '');
        if (/^[가-힣]+$/.test(tok)) continue; // ignore korean labels
        const val = parseFloat(tok);
        if (!isNaN(val) && val >= 1.0 && val <= 9.0 && tok.includes('.')) {
            gradeCandidates.unshift({ idx: i, val: val });
        }
    }

    if (gradeCandidates.length === 0) return null;

    let cut50 = null;
    let cut70 = null;
    if (gradeCandidates.length >= 2) {
        cut50 = gradeCandidates[gradeCandidates.length - 2].val;
        cut70 = gradeCandidates[gradeCandidates.length - 1].val;
    } else {
        cut70 = gradeCandidates[0].val;
    }

    // Major name ends before the first integer/number
    let majorParts = [];
    let firstNumIdx = -1;
    for (let i = 0; i < tokens.length; i++) {
        const val = parseFloat(tokens[i]);
        if (!isNaN(val) && /^\d+/.test(tokens[i])) {
            firstNumIdx = i;
            break;
        } else {
            majorParts.push(tokens[i]);
        }
    }

    if (firstNumIdx === -1 || majorParts.length === 0) return null;
    const major = majorParts.join(' ').trim();
    if (major.length < 2 || major.includes('모집단위') || major.includes('전형')) return null;

    const recruit = tokens[firstNumIdx] || '';
    let compRate = '';

    if (firstNumIdx + 1 < tokens.length) {
        let compToken = tokens[firstNumIdx + 1];
        compRate = compToken.replace(':1', '').replace(/,/g, '');
    }

    // Determine type (교과 vs 종합)
    let type = '교과';
    if (currentEvalType.includes('종합') || currentEvalType.includes('서류') || currentEvalType.includes('바람개비') || currentEvalType.includes('네오르네상스') || currentEvalType.includes('학업우수')) {
        type = '종합';
    }

    return {
        univ: currentUniv,
        normUniv: normalizeUnivName(currentUniv),
        region: currentRegion,
        evalType: currentEvalType || '수시일반',
        type: type,
        major: major,
        cleanMajor: cleanMajorName(major),
        recruit: recruit,
        compRate: compRate,
        cut50: cut50,
        cut70: cut70
    };
}

async function processPdfFile(filePath) {
    const fileName = path.basename(filePath);
    const dataBuffer = fs.readFileSync(filePath);
    const parser = new PDFParse({ data: dataBuffer });
    const res = await parser.getText();
    const pages = res.text.split(/-- \d+ of \d+ --/);

    let currentUniv = '';
    let currentRegion = fileName.split('_')[0].replace('2025학년도 대입 전형결과(', '').replace(').pdf', '');
    let currentEvalType = '';
    const records = [];

    for (let pIdx = 0; pIdx < pages.length; pIdx++) {
        const pageText = pages[pIdx];
        const lines = pageText.split('\n').map(l => l.trim()).filter(Boolean);

        // Detect university cover page
        if (pageText.includes('2025 대입 수시모집 입시결과')) {
            const coverLines = lines.filter(l => !l.includes('2025 대입 수시모집') && !l.includes('업로드'));
            if (coverLines.length >= 2) {
                currentRegion = coverLines[0].trim();
                currentUniv = coverLines.slice(1).join('').trim();
            } else if (coverLines.length === 1) {
                currentUniv = coverLines[0].trim();
            }
            currentUniv = currentUniv.replace(/\s+/g, '');
            currentEvalType = '';
            continue;
        }

        // Detect EvalType headers inside page
        for (let l of lines) {
            if (l.startsWith('모집단위')) {
                const after = l.replace('모집단위', '').trim();
                if (after) currentEvalType = after;
            } else if (l.startsWith('학생부교과') || l.startsWith('학생부종합') || l.startsWith('일반전형') || l.startsWith('지역인재')) {
                currentEvalType = l;
            }
        }

        for (let l of lines) {
            const parsed = parseLine(l, currentUniv, currentRegion, currentEvalType);
            if (parsed && parsed.cut70) {
                records.push(parsed);
            }
        }
    }

    return records;
}

async function run() {
    console.log('=== 2025학년도 대입 수시 전형결과 PDF 일괄 파싱 시작 ===');
    const files = fs.readdirSync(PDF_DIR).filter(f => f.endsWith('.pdf'));
    console.log(`총 ${files.length}개의 PDF 파일을 발견하였습니다.`);

    const all2025Records = [];
    for (let i = 0; i < files.length; i++) {
        const file = files[i];
        const filePath = path.join(PDF_DIR, file);
        process.stdout.write(`[${i + 1}/${files.length}] 파싱 중: ${file} ... `);
        try {
            const recs = await processPdfFile(filePath);
            console.log(`${recs.length}건 완료`);
            all2025Records.push(...recs);
        } catch (err) {
            console.log(`오류 발생: ${err.message}`);
        }
    }

    console.log(`\n총 ${all2025Records.length}개의 2025학년도 실제 수시 입결 레코드를 성공적으로 추출하였습니다!`);

    // Load existing DB
    console.log('\n기존 데이터베이스 로딩 중...');
    const rawDb = JSON.parse(fs.readFileSync(DB_JSON_PATH, 'utf8'));
    const existingRecords = rawDb.records || [];
    console.log(`기존 레코드 수: ${existingRecords.length}건`);

    // Build lookup map for existing records
    // Map key: normUniv + '___' + cleanMajor
    const lookupMap = new Map();
    existingRecords.forEach(r => {
        const normU = normalizeUnivName(r.univ);
        const cleanM = cleanMajorName(r.major);
        const key = normU + '___' + cleanM;
        if (!lookupMap.has(key)) lookupMap.set(key, []);
        lookupMap.get(key).push(r);
    });

    let matchedCount = 0;
    let addedCount = 0;

    // Update existing records with actual 2025 data
    all2025Records.forEach(rec => {
        const key = rec.normUniv + '___' + rec.cleanMajor;
        const matches = lookupMap.get(key);

        if (matches && matches.length > 0) {
            // Find best match by evalType or type
            let best = matches.find(m => m.type === rec.type);
            if (!best) best = matches[0];

            best.cut25_70 = rec.cut70;
            best.cut25_50 = rec.cut50;
            if (rec.compRate) best.compRate25 = rec.compRate;
            best.hasReal2025 = true;
            matchedCount++;
        } else {
            // New record for 2025
            existingRecords.push({
                id: Date.now() + Math.floor(Math.random() * 100000),
                region: rec.region,
                univ: rec.univ.replace(/대학교$/, '대'),
                type: rec.type,
                evalType: rec.evalType,
                field: '통합',
                major: rec.major,
                recruit: rec.recruit,
                apply: '-',
                compRate: rec.compRate,
                compRate25: rec.compRate,
                fillRate: '-',
                cut50: rec.cut50,
                cut70: rec.cut70,
                cut25_70: rec.cut70,
                cut25_50: rec.cut50,
                hasReal2025: true,
                subject: '전과목 또는 주요교과'
            });
            addedCount++;
        }
    });

    console.log(`\n데이터베이스 병합 완료!`);
    console.log(`- 기존 레코드에 2025 실제 입결 매칭 업데이트: ${matchedCount}건`);
    console.log(`- 신규 2025 모집단위 추가: ${addedCount}건`);
    console.log(`- 최종 총 레코드 수: ${existingRecords.length}건`);

    const updatedDb = {
        totalCount: existingRecords.length,
        updatedAt: '2026-09-03 (2025 실제 수시 입결 완벽 반영)',
        regions: Array.from(new Set(existingRecords.map(r => r.region).filter(Boolean))).sort(),
        types: Array.from(new Set(existingRecords.map(r => r.type).filter(Boolean))).sort(),
        records: existingRecords
    };

    // Save JSON
    fs.writeFileSync(DB_JSON_PATH, JSON.stringify(updatedDb), 'utf8');
    console.log(`저장 완료: ${DB_JSON_PATH}`);

    // Save JS (for file:// protocol support)
    const jsContent = 'window.ADMISSION_DB = ' + JSON.stringify(updatedDb) + ';\n';
    fs.writeFileSync(DB_JS_PATH, jsContent, 'utf8');
    console.log(`저장 완료: ${DB_JS_PATH} (${(jsContent.length / 1024 / 1024).toFixed(2)} MB)`);

    console.log('\n=== 모든 업데이트가 완벽하게 완료되었습니다! ===');
}

run();
