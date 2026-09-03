const fs = require('fs');
const path = require('path');
const { PDFParse } = require('pdf-parse');

const PDF_DIR = 'C:\\Users\\OWNER\\Desktop\\2025학년도 대입 전형 결과';
const RAW_2022_PATH = path.join(__dirname, '..', 'public', 'data', 'raw_admission_2022.json');
const DB_JSON_PATH = path.join(__dirname, '..', 'public', 'data', 'admission_db.json');
const DB_JS_PATH = path.join(__dirname, '..', 'public', 'data', 'admission_db.js');

function normalizeUnivName(name) {
    if (!name) return '';
    let clean = name.replace(/\s+/g, '');
    clean = clean.replace(/대학교$/, '대').replace(/대학$/, '대');
    if (clean === '한국과학기술원') return 'KAIST';
    if (clean === '포항공과대') return '포항공대';
    return clean;
}

function cleanMajorName(name) {
    if (!name) return '';
    return name.replace(/\s+/g, '').replace(/\([^)]*\)/g, '');
}

function isJeongsiPage(text) {
    if (!text) return true;
    if (text.includes('수능위주') || text.includes('수학 선택') || text.includes('과목별 백분위') || 
        text.includes('확률과') || text.includes('미적분') || text.includes('기하') ||
        text.includes('총점\n(수능)') || text.includes('총점 (수능)') || text.includes('총점(수능)')) {
        return true;
    }
    if (text.includes('가군') || text.includes('나군') || text.includes('다군')) {
        return true;
    }
    return false;
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
        if (!pageText) continue;

        // University cover page detection
        if (pageText.includes('2025 대입 수시모집 입시결과')) {
            const lines = pageText.split('\n').map(l => l.trim()).filter(Boolean);
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

        // CRITICAL: Filter out all Jeongsi pages
        if (isJeongsiPage(pageText)) {
            continue;
        }

        const lines = pageText.split('\n').map(l => l.trim()).filter(Boolean);
        for (let l of lines) {
            if (l.startsWith('모집단위')) {
                const after = l.replace('모집단위', '').trim();
                if (after) currentEvalType = after;
            } else if (l.startsWith('학생부교과') || l.startsWith('학생부종합') || l.startsWith('일반전형') || l.startsWith('지역인재')) {
                currentEvalType = l;
            }
        }

        for (let l of lines) {
            if (l.includes('2025학년도') || l.includes('최종등록자') || l.includes('모집인원') || l.includes('모집단위') || l.includes('평가에')) continue;

            const tokens = l.split(/[\t\s]+/).filter(Boolean);
            if (tokens.length < 4) continue;

            // Find valid grade decimals (1.00 ~ 9.00)
            const gradeCandidates = [];
            for (let i = tokens.length - 1; i >= 1; i--) {
                const tok = tokens[i].replace(/,/g, '');
                if (/^[가-힣]+$/.test(tok)) continue;
                const val = parseFloat(tok);
                if (!isNaN(val) && val >= 1.0 && val <= 9.0 && tok.includes('.')) {
                    gradeCandidates.unshift({ idx: i, val: val });
                }
            }

            if (gradeCandidates.length === 0) continue;

            let cut50 = null;
            let cut70 = null;
            if (gradeCandidates.length >= 2) {
                cut50 = gradeCandidates[gradeCandidates.length - 2].val;
                cut70 = gradeCandidates[gradeCandidates.length - 1].val;
            } else {
                cut70 = gradeCandidates[0].val;
            }

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

            if (firstNumIdx === -1 || majorParts.length === 0) continue;
            const major = majorParts.join(' ').trim();
            if (major.length < 2 || major.includes('모집단위') || major.includes('전형')) continue;

            const recruit = tokens[firstNumIdx] || '';
            let compRate = '';
            if (firstNumIdx + 1 < tokens.length) {
                compRate = tokens[firstNumIdx + 1].replace(':1', '').replace(/,/g, '');
            }

            let type = '교과';
            if (currentEvalType.includes('종합') || currentEvalType.includes('서류')) {
                type = '종합';
            }

            records.push({
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
            });
        }
    }

    return records;
}

async function rebuildDatabase() {
    console.log('=== 순수 2025학년도 대입 수시 입결 정밀 재구축 시작 ===');

    // 1. Read Raw 2022 dataset (19,778 records)
    console.log('2022 수시 원본 데이터(raw_admission_2022.json) 로드 중...');
    const rawContent = fs.readFileSync(RAW_2022_PATH, 'utf8');
    const raw2022 = JSON.parse(rawContent.charCodeAt(0) === 0xFEFF ? rawContent.slice(1) : rawContent);
    const baseRecords = Array.isArray(raw2022) ? raw2022 : (raw2022.records || []);
    console.log(`기본 원본 수시 레코드: ${baseRecords.length}건`);

    // Reset 2025 projected cuts initially
    baseRecords.forEach(r => {
        if (r.cut70 !== null && r.cut70 !== undefined) {
            let adj = 0;
            if (r.cut70 <= 2.0) adj = (Math.round((r.cut70 * 0.015) * 100) / 100);
            else if (r.cut70 <= 4.0) adj = 0.05;
            else adj = 0.10;
            r.cut25_70 = Math.round((r.cut70 + adj) * 100) / 100;
        } else {
            r.cut25_70 = null;
        }
        r.cut25_50 = r.cut50;
        r.compRate25 = r.compRate;
        r.hasReal2025 = false;
    });

    // 2. Parse all 34 PDFs with Jeongsi filtered out
    const files = fs.readdirSync(PDF_DIR).filter(f => f.endsWith('.pdf'));
    const all2025PureSusi = [];

    for (let i = 0; i < files.length; i++) {
        const file = files[i];
        const filePath = path.join(PDF_DIR, file);
        process.stdout.write(`[${i + 1}/${files.length}] 순수 수시 파싱: ${file} ... `);
        try {
            const recs = await processPdfFile(filePath);
            console.log(`${recs.length}건`);
            all2025PureSusi.push(...recs);
        } catch (err) {
            console.log(`오류: ${err.message}`);
        }
    }

    console.log(`\n총 ${all2025PureSusi.length}건의 순수 2025 수시 입결 레코드 추출 완료!`);

    // 3. Match with baseRecords
    // Key: normUniv + '___' + cleanMajor
    const lookupMap = new Map();
    baseRecords.forEach(r => {
        const key = normalizeUnivName(r.univ) + '___' + cleanMajorName(r.major);
        if (!lookupMap.has(key)) lookupMap.set(key, []);
        lookupMap.get(key).push(r);
    });

    let matchedCount = 0;
    all2025PureSusi.forEach(rec => {
        const key = rec.normUniv + '___' + rec.cleanMajor;
        const matches = lookupMap.get(key);
        if (!matches || matches.length === 0) return;

        // Strict matching: type (교과/종합) and evalType (지역인재 vs 일반)
        let target = null;
        const isRegionRec = rec.evalType.includes('지역');

        // First attempt: exact match on type AND region qualification
        for (let m of matches) {
            const isRegionM = (m.evalType || '').includes('지역');
            if (m.type === rec.type && isRegionRec === isRegionM) {
                target = m;
                break;
            }
        }

        // Second attempt: match on type only if no region mismatch
        if (!target) {
            for (let m of matches) {
                if (m.type === rec.type) {
                    target = m;
                    break;
                }
            }
        }

        if (target) {
            target.cut25_70 = rec.cut70;
            target.cut25_50 = rec.cut50;
            if (rec.compRate) target.compRate25 = rec.compRate;
            target.hasReal2025 = true;
            matchedCount++;
        }
    });

    console.log(`\n정밀 1:1 매칭 완료: 총 ${matchedCount}건에 2025 실제 수시 입결 반영!`);

    // Verification check for GNU Medicine
    const gnuMeds = baseRecords.filter(r => r.univ.includes('경상국립') && r.major.includes('의예과'));
    console.log('\n--- 검증: 경상국립대학교 의예과 최종 데이터 ---');
    gnuMeds.forEach(r => {
        console.log(`[${r.type} / ${r.evalType}] ${r.major} | 2022컷: ${r.cut70} | 2025컷: ${r.cut25_70} | 실제반영: ${r.hasReal2025}`);
    });

    // 4. Save clean database
    const regions = Array.from(new Set(baseRecords.map(r => r.region).filter(Boolean))).sort();
    const types = Array.from(new Set(baseRecords.map(r => r.type).filter(Boolean))).sort();

    const finalDb = {
        totalCount: baseRecords.length,
        updatedAt: '2026-09-03 (순수 수시 2025 실제 입결 정밀 반영)',
        regions: regions,
        types: types,
        records: baseRecords
    };

    fs.writeFileSync(DB_JSON_PATH, JSON.stringify(finalDb), 'utf8');
    console.log(`\n저장 완료: ${DB_JSON_PATH}`);

    const jsContent = 'window.ADMISSION_DB = ' + JSON.stringify(finalDb) + ';\n';
    fs.writeFileSync(DB_JS_PATH, jsContent, 'utf8');
    console.log(`저장 완료: ${DB_JS_PATH} (${(jsContent.length / 1024 / 1024).toFixed(2)} MB)`);
}

rebuildDatabase();
