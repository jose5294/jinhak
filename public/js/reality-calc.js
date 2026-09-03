// reality-calc.js - 지방 평준화 일반고 내신 현실 체감 계산 모듈
(function(window) {
    'use strict';

    // 9등급제 기준 등급별 누적 경계 비율 (%)
    // 1등급: 4%, 2등급: 11%, 3등급: 23%, 4등급: 40%, 5등급: 60%, 6등급: 77%, 7등급: 89%, 8등급: 96%, 9등급: 100%
    const GRADE_9_THRESHOLDS = [
        { grade: 1.0, percentile: 1.0 },
        { grade: 1.5, percentile: 2.8 },
        { grade: 2.0, percentile: 7.5 },
        { grade: 2.5, percentile: 16.5 },
        { grade: 3.0, percentile: 23.0 },
        { grade: 3.5, percentile: 31.5 },
        { grade: 4.0, percentile: 40.0 },
        { grade: 4.5, percentile: 50.0 },
        { grade: 5.0, percentile: 60.0 },
        { grade: 6.0, percentile: 77.0 },
        { grade: 7.0, percentile: 89.0 },
        { grade: 8.0, percentile: 96.0 },
        { grade: 9.0, percentile: 100.0 }
    ];

    /**
     * 학생부 등급을 상위 누적 백분위(%)로 정밀 보간 계산
     * @param {number} grade - 학생부 등급 (예: 2.35)
     * @returns {number} 상위 누적 백분위 (예: 13.2)
     */
    function calculatePercentile(grade) {
        if (!grade || isNaN(grade)) return null;
        if (grade <= 1.0) return 1.0;
        if (grade >= 9.0) return 100.0;

        for (let i = 0; i < GRADE_9_THRESHOLDS.length - 1; i++) {
            const current = GRADE_9_THRESHOLDS[i];
            const next = GRADE_9_THRESHOLDS[i + 1];
            if (grade >= current.grade && grade <= next.grade) {
                const ratio = (grade - current.grade) / (next.grade - current.grade);
                const pct = current.percentile + ratio * (next.percentile - current.percentile);
                return Math.round(pct * 10) / 10;
            }
        }
        return 50.0;
    }

    /**
     * 일반고 학교 정원 기준 전교 등수 계산
     * @param {number} grade - 학생부 등급
     * @param {number} schoolSize - 전교생 수 (기본 200명)
     * @returns {object} { rank, percentile, schoolSize, classRank }
     */
    function calculateSchoolRank(grade, schoolSize = 200) {
        const percentile = calculatePercentile(grade);
        if (percentile === null) return null;

        const rank = Math.max(1, Math.round((schoolSize * percentile) / 100));
        return {
            grade: Number(grade.toFixed(2)),
            percentile: percentile,
            rank: rank,
            schoolSize: schoolSize,
            classRank: Math.max(1, Math.round((rank / schoolSize) * 25)) // 25명 학급 기준 반 등수
        };
    }

    /**
     * 중학교 성취도(A, B, C 등)와의 현실 비교 코멘트
     */
    function getRealityCheckInsight(grade, rank, schoolSize = 200) {
        if (!grade) return null;

        if (grade <= 1.5) {
            return {
                tier: '최상위권 (Top Tier)',
                badgeColor: 'bg-indigo-600 text-white',
                borderClass: 'border-indigo-500',
                title: `일반고 전교 1~${Math.round(schoolSize * 0.03)}등 이내 (상위 3% 이내)`,
                description: '의약학계열, 서울대·연세대·고려대 및 최상위권 학과 합격 안정권입니다.',
                middleSchoolReality: '중학교 시절 전교 1~3등 수준의 압도적인 학업 역량을 고교 3년간 전 과목에서 단 한 번의 실수 없이 유지해야 가능한 성적입니다.',
                targetLine: '의대·치대·한의대·약대, 서울대, 연세대, 고려대, 카이스트'
            };
        } else if (grade <= 2.2) {
            return {
                tier: '상위권 (Upper Tier)',
                badgeColor: 'bg-blue-600 text-white',
                borderClass: 'border-blue-500',
                title: `일반고 전교 ${Math.round(schoolSize * 0.03) + 1}~${Math.round(schoolSize * 0.1)}등 이내 (상위 10% 이내)`,
                description: '서성한·중경외시 등 서울 주요 상위권 대학 및 지거국 최상위 학과(사범대, 간호 등) 합격선입니다.',
                middleSchoolReality: '일반고 한 반(25명)에서 무조건 1~2등을 다투어야 합니다. 중학교 올A 학생들 중에서도 상위권만 살아남는 구간입니다.',
                targetLine: '서강대·성균관대·한양대·중앙대·경희대, 부산대·경북대 상위과, 경상국립대 간호/사범'
            };
        } else if (grade <= 3.2) {
            return {
                tier: '중상위권 (Solid Tier)',
                badgeColor: 'bg-emerald-600 text-white',
                borderClass: 'border-emerald-500',
                title: `일반고 전교 ${Math.round(schoolSize * 0.1) + 1}~${Math.round(schoolSize * 0.25)}등 이내 (상위 25% 이내)`,
                description: '건동홍·국숭세단 등 인서울 대학 및 지역 거점 국립대(경상국립대, 부산대, 충남대 등) 주력 학과 합격선입니다.',
                middleSchoolReality: '반에서 3~5등 이내를 유지해야 합니다. 중학교 때 90점 초반 A등급을 받던 학생들이 가장 치열하게 경쟁하는 실질적인 마지노선입니다.',
                targetLine: '건국대·동국대·홍익대·국민대, 경상국립대 주력학과, 부산대·경북대 일반과'
            };
        } else if (grade <= 4.2) {
            return {
                tier: '중위권 [중학 착각 경계선!]',
                badgeColor: 'bg-amber-600 text-white',
                borderClass: 'border-amber-500',
                title: `일반고 전교 ${Math.round(schoolSize * 0.25) + 1}~${Math.round(schoolSize * 0.45)}등 (상위 45% 이내)`,
                description: '수도권 외곽 대학, 충청/전라/경상권 국립대 및 지방 주요 4년제 사립대 합격선입니다.',
                middleSchoolReality: '⚠️ [가장 중요한 착각 해소 구간!] 중학교에서 전교생의 30~40%가 받는 올A(90점 이상) 학생이 고등학교 상대평가에 오면 바로 이 등급(3.5~4등급)으로 밀려납니다. 인서울은 어렵고 지방 거점 국립대도 비인기 학과에 머물게 됩니다.',
                targetLine: '경기권 대학, 지역 국립대 하위과, 지방 중심 사립대'
            };
        } else if (grade <= 5.5) {
            return {
                tier: '중하위권',
                badgeColor: 'bg-orange-600 text-white',
                borderClass: 'border-orange-500',
                title: `일반고 전교 ${Math.round(schoolSize * 0.45) + 1}~${Math.round(schoolSize * 0.65)}등 (상위 65% 이내)`,
                description: '지방 사립대학교 일반학과 및 전문대학 유망 보건/기술계열 합격선입니다.',
                middleSchoolReality: '중학교 B등급(80~89점) 수준의 학생들이 고교에서 받는 평균 등급입니다. 수시 교과 전형보다는 면접이나 전형 다변화가 필요합니다.',
                targetLine: '지방 사립대, 수도권 전문대, 지역 보건의료 전문대'
            };
        } else {
            return {
                tier: '하위권',
                badgeColor: 'bg-slate-600 text-white',
                borderClass: 'border-slate-500',
                title: `일반고 전교 ${Math.round(schoolSize * 0.65) + 1}등 이후`,
                description: '전문대학 및 지방 사립대 자율전공 합격선입니다.',
                middleSchoolReality: '기초 학력 보강과 실무 자격증 위주의 진로 전략 수립이 권장됩니다.',
                targetLine: '전문대 및 기술 직업 교육'
            };
        }
    }

    /**
     * 2028 대입 개편 5등급제 환산
     */
        /**
     * 2028 대입 개편 5등급제 환산 (소수점 둘째 자리 정밀 연속 보간)
     * 누적 백분율(pct)을 5등급제 구간에 매핑하여 소수점 둘째 자리까지 산출
     */
    function convertTo2028Grade(grade9) {
        const pct = calculatePercentile(grade9);
        if (pct === null || isNaN(pct)) return { grade5: '-', grade5Exact: '-', text: '-', range: '-' };

        let grade5Val = 1.0;
        let mainTier = 1;
        let rangeText = '0~10%';

        if (pct <= 10.0) {
            mainTier = 1;
            grade5Val = 1.00 + (pct / 10.0) * 0.99;
            rangeText = '상위 10% 이내';
        } else if (pct <= 34.0) {
            mainTier = 2;
            grade5Val = 2.00 + ((pct - 10.0) / 24.0) * 0.99;
            rangeText = '누적 10~34%';
        } else if (pct <= 66.0) {
            mainTier = 3;
            grade5Val = 3.00 + ((pct - 34.0) / 32.0) * 0.99;
            rangeText = '누적 34~66%';
        } else if (pct <= 90.0) {
            mainTier = 4;
            grade5Val = 4.00 + ((pct - 66.0) / 24.0) * 0.99;
            rangeText = '누적 66~90%';
        } else {
            mainTier = 5;
            grade5Val = Math.min(5.0, 5.00 + ((pct - 90.0) / 10.0) * 0.0);
            rangeText = '누적 90~100%';
        }

        const exact = Number(grade5Val.toFixed(2));
        return {
            grade5: exact,
            grade5Exact: exact.toFixed(2),
            mainTier: mainTier,
            text: exact.toFixed(2) + '등급 (' + mainTier + '등급권, ' + rangeText + ')',
            badgeText: exact.toFixed(2) + '등급',
            range: rangeText,
            percentile: pct
        };
    }

    // Export to global
    window.RealityCalc = {
        calculatePercentile,
        calculateSchoolRank,
        getRealityCheckInsight,
        convertTo2028Grade,
        GRADE_9_THRESHOLDS
    };
})(window);
