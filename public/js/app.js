// app.js - 대학+학과 그룹화 및 전형 선택 시스템 탑재
(function() {
    'use strict';

    const state = {
        allRecords: [],
        groupedDepartments: [], // 대학+학과 단위 그룹 목록
        filteredGroups: [],
        currentPage: 1,
        pageSize: 24,
        schoolSize: 200,
        gradeSystem: '9grade',
        activeTab: 'search',
        filters: {
            univKeyword: '',
            majorKeyword: '',
            region: 'all',
            type: 'all',
            minGrade: 1.0,
            maxGrade: 9.0,
            sortBy: 'cut_asc'
        },
        selectedGroup: null,
        selectedProgramIndex: 0
    };

    const elements = {};

    function initElements() {
        elements.loadingOverlay = document.getElementById('loadingOverlay');
        elements.schoolSizeSlider = document.getElementById('schoolSizeSlider');
        elements.schoolSizeDisplay = document.getElementById('schoolSizeDisplay');
        elements.gradeSystemToggle = document.getElementById('gradeSystemToggle');

        elements.tabBtns = document.querySelectorAll('.nav-tab-btn');
        elements.tabContents = document.querySelectorAll('.tab-content');

        // Search inputs
        elements.univKeywordInput = document.getElementById('univKeywordInput');
        elements.majorKeywordInput = document.getElementById('majorKeywordInput');
        elements.regionSelect = document.getElementById('regionSelect');
        elements.typeSelect = document.getElementById('typeSelect');
        elements.sortSelect = document.getElementById('sortSelect');
        elements.resetFilterBtn = document.getElementById('resetFilterBtn');
        elements.resultCount = document.getElementById('resultCount');
        elements.cardsContainer = document.getElementById('cardsContainer');
        elements.pagination = document.getElementById('pagination');

        // Simulator Tab elements
        elements.simGradeInput = document.getElementById('simGradeInput');
        elements.simCalculateBtn = document.getElementById('simCalculateBtn');
        elements.simRegionSelect = document.getElementById('simRegionSelect');
        elements.simChallengeList = document.getElementById('simChallengeList');
        elements.simTargetList = document.getElementById('simTargetList');
        elements.simSafetyList = document.getElementById('simSafetyList');
        elements.simRealitySummary = document.getElementById('simRealitySummary');

        // Modal elements
        elements.detailModal = document.getElementById('detailModal');
        elements.closeModalBtn = document.getElementById('closeModalBtn');
        elements.modalTitle = document.getElementById('modalTitle');
        elements.modalContent = document.getElementById('modalContent');

        // Import elements
        elements.dropZone = document.getElementById('dropZone');
        elements.excelFileInput = document.getElementById('excelFileInput');
        elements.importStatus = document.getElementById('importStatus');
    }

    async function loadData() {
        try {
            let data = null;
            if (window.ADMISSION_DB && window.ADMISSION_DB.records) {
                data = window.ADMISSION_DB;
            } else {
                const response = await fetch('data/admission_db.json');
                if (!response.ok) throw new Error('데이터 파일을 불러올 수 없습니다. (' + response.status + ')');
                data = await response.json();
            }

            state.allRecords = Array.isArray(data.records) ? data.records : (data.records?.value || []);
            console.log('Successfully loaded raw admission records:', state.allRecords.length);

            // Build grouped departments
            buildGroupedDepartments();

            populateSelectOptions(data.regions || [], data.types || []);
            applyFilters();
        } catch (err) {
            console.error('loadData error:', err);
            alert('데이터 로딩 중 안내: ' + err.message);
        } finally {
            if (elements.loadingOverlay) {
                elements.loadingOverlay.classList.add('hidden');
            }
        }
    }

    // 대학 + 학과 단위로 레코드 그룹화
        // 전형별 대표성 가중치 점수 산출 함수 (특성화고, 사회배려 등 특별전형 배제)
    function getProgramScore(prog) {
        let score = 0;
        const evalName = prog.evalType || '';

        // 특성화고, 차상위, 농어촌 등 소수 특별전형은 대표 컷에서 강력 배제
        if (evalName.includes('특성화') || evalName.includes('마이스터') || 
            evalName.includes('사회배려') || evalName.includes('기초생활') || 
            evalName.includes('차상위') || evalName.includes('농어촌') || 
            evalName.includes('장애인') || evalName.includes('정원외') || 
            evalName.includes('서해5도') || evalName.includes('특기자')) {
            score -= 100;
        } else {
            score += 50;
        }

        // 일반계고 수험생 주력 지원 전형 가산점
        if (evalName.includes('일반') || evalName.includes('일반계고') || 
            evalName.includes('교과성적') || evalName.includes('지역인재') || 
            evalName.includes('지역균형') || evalName.includes('학교장추천') ||
            evalName.includes('학생부우수자')) {
            score += 40;
        }

        // 내신 컷 비교가 가장 직관적인 교과전형 우선
        if (prog.type === '교과') score += 20;
        else if (prog.type === '종합') score += 10;

        // 유효한 70% Cut 보유 시 높은 가산점
        if (prog.cut70 !== null && prog.cut70 !== undefined) score += 50;

        // 모집 인원이 많은 주력 전형일수록 가산점
        const recNum = parseInt(prog.recruit, 10);
        if (!isNaN(recNum) && recNum > 0) {
            score += Math.min(25, recNum);
        }

        return score;
    }

    function buildGroupedDepartments() {
        const groupMap = new Map();

        state.allRecords.forEach(item => {
            const key = item.univ + '____' + item.major;
            if (!groupMap.has(key)) {
                groupMap.set(key, {
                    groupKey: key,
                    univ: item.univ,
                    major: item.major,
                    region: item.region,
                    field: item.field,
                    programs: [],
                    primaryProgram: null,
                    primaryCut70: null,
                    primaryCut25: null,
                    primaryCompRate: null,
                    typesSet: new Set()
                });
            }

            const grp = groupMap.get(key);
            grp.programs.push(item);
            grp.typesSet.add(item.type);
        });

        // Convert Map to Array & determine the most representative mainstream program
        state.groupedDepartments = Array.from(groupMap.values()).map(grp => {
            grp.typesList = Array.from(grp.typesSet);

            // Sort programs by mainstream priority score descending
            grp.programs.sort((a, b) => getProgramScore(b) - getProgramScore(a));

            const bestProg = grp.programs[0];
            grp.primaryProgram = bestProg;
            grp.primaryCut70 = bestProg.cut70;
            grp.primaryCut25 = bestProg.cut25_70;
            grp.primaryCompRate = bestProg.compRate25 || bestProg.compRate;

            return grp;
        });

        console.log('Grouped into ' + state.groupedDepartments.length + ' unique university-department entries with mainstream priority.');
    }

    function populateSelectOptions(regions, types) {
        if (elements.regionSelect) {
            elements.regionSelect.innerHTML = '<option value="all">전국 (전체 지역)</option>' +
                regions.map(r => '<option value="' + r + '">' + r + '</option>').join('');
        }
        if (elements.simRegionSelect) {
            elements.simRegionSelect.innerHTML = '<option value="all">전국 (전체 지역)</option>' +
                regions.map(r => '<option value="' + r + '">' + r + '</option>').join('');
        }
        if (elements.typeSelect) {
            elements.typeSelect.innerHTML = '<option value="all">전체 전형 (교과/종합)</option>' +
                types.map(t => '<option value="' + t + '">' + t + '</option>').join('');
        }
    }

    // Filter with separate univKeyword and majorKeyword
    function applyFilters() {
        const univKw = (state.filters.univKeyword || '').trim().toLowerCase();
        const majorKw = (state.filters.majorKeyword || '').trim().toLowerCase();
        const reg = state.filters.region;
        const typ = state.filters.type;

        state.filteredGroups = state.groupedDepartments.filter(grp => {
            // Region filter
            if (reg !== 'all' && grp.region !== reg) return false;

            // Type filter (checks if this dept has any program of selected type)
            if (typ !== 'all' && !grp.typesList.includes(typ)) return false;

            // University keyword filter
            if (univKw && !grp.univ.toLowerCase().includes(univKw)) return false;

            // Major keyword filter
            if (majorKw && !grp.major.toLowerCase().includes(majorKw)) return false;

            return true;
        });

        // Sort
        const sort = state.filters.sortBy;
        state.filteredGroups.sort((a, b) => {
            const cutA = a.primaryCut70 || 99;
            const cutB = b.primaryCut70 || 99;
            if (sort === 'cut_asc') return cutA - cutB;
            if (sort === 'cut_desc') return (b.primaryCut70 || 0) - (a.primaryCut70 || 0);
            if (sort === 'comp_desc') return (parseFloat(b.primaryCompRate) || 0) - (parseFloat(a.primaryCompRate) || 0);
            if (sort === 'univ_asc') {
                const uComp = a.univ.localeCompare(b.univ, 'ko');
                return uComp !== 0 ? uComp : a.major.localeCompare(b.major, 'ko');
            }
            return 0;
        });

        state.currentPage = 1;
        renderSearchResults();
    }

    function renderSearchResults() {
        if (!elements.cardsContainer) return;

        const total = state.filteredGroups.length;
        if (elements.resultCount) {
            elements.resultCount.textContent = total.toLocaleString();
        }

        if (total === 0) {
            elements.cardsContainer.innerHTML = `
                <div class="col-span-full py-16 text-center text-slate-400 bg-white rounded-3xl border border-slate-200">
                    <i class="fa-solid fa-graduation-cap text-5xl mb-3 text-slate-300"></i>
                    <p class="text-lg font-bold text-slate-600">검색 조건에 맞는 학과가 없습니다.</p>
                    <p class="text-sm mt-1 text-slate-400">대학명 또는 학과명 철자를 확인해 보세요.</p>
                </div>
            `;
            if (elements.pagination) elements.pagination.innerHTML = '';
            return;
        }

        const startIdx = (state.currentPage - 1) * state.pageSize;
        const pageItems = state.filteredGroups.slice(startIdx, startIdx + state.pageSize);

        let html = '';
        pageItems.forEach((grp, idx) => {
            const cut70 = grp.primaryCut70;
            const cut25 = grp.primaryCut25;
            const rankObj = cut70 ? window.RealityCalc.calculateSchoolRank(cut70, state.schoolSize) : null;
            const grade5Obj = cut70 ? window.RealityCalc.convertTo2028Grade(cut70) : null;
            const progCount = grp.programs.length;

            html += `
                <div class="univ-card bg-white rounded-2xl sm:rounded-3xl p-4 sm:p-5 border border-slate-200 shadow-xs hover:border-indigo-400 hover:shadow-md transition flex flex-col justify-between cursor-pointer group"
                     onclick="window.App.openGroupDetail('${encodeURIComponent(grp.groupKey)}')">
                    <div>
                        <!-- Header: Region, Types Pills, Program Count -->
                        <div class="flex items-center justify-between gap-2 mb-2.5">
                            <span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold bg-slate-100 text-slate-700">
                                <i class="fa-solid fa-location-dot mr-1 text-[10px] text-indigo-500"></i>${grp.region}
                            </span>
                            <div class="flex items-center gap-1.5">
                                <span class="px-2.5 py-0.5 rounded-full text-xs font-black bg-indigo-50 text-indigo-700 border border-indigo-200/60 shadow-2xs">
                                    전형 ${progCount}개 보유 <i class="fa-solid fa-list-check ml-0.5 text-[10px]"></i>
                                </span>
                                <span class="px-2 py-0.5 rounded text-xs font-medium bg-slate-100 text-slate-600">
                                    ${grp.field}
                                </span>
                            </div>
                        </div>

                        <!-- University & Department -->
                        <h3 class="font-extrabold text-slate-900 text-base sm:text-lg leading-snug group-hover:text-indigo-600 transition">
                            ${grp.univ}
                        </h3>
                        <p class="text-slate-700 font-bold text-sm sm:text-base mt-0.5 line-clamp-1">
                            ${grp.major}
                        </p>

                        <!-- Available Programs Badges preview -->
                        <div class="flex items-center gap-1.5 mt-2 flex-wrap">
                            ${grp.programs.slice(0, 3).map(p => `
                                <span class="text-[11px] font-semibold px-2 py-0.5 rounded-md ${p.type === '교과' ? 'bg-blue-50 text-blue-700 border border-blue-100' : 'bg-purple-50 text-purple-700 border border-purple-100'}">
                                    ${p.type} ${p.evalType ? p.evalType.slice(0, 5) : ''}
                                </span>
                            `).join('')}
                            ${progCount > 3 ? `<span class="text-[10px] text-slate-400 font-bold">+${progCount - 3}</span>` : ''}
                        </div>

                        <!-- Cut Information Box (Dynamic for 9-grade vs 5-grade) -->
                        <div class="mt-3.5 p-3 rounded-2xl border flex items-center justify-between ${state.gradeSystem === '5grade' ? 'bg-purple-50/80 border-purple-200' : 'bg-slate-50 border-slate-100'}">
                            <div>
                                <div class="text-[11px] font-bold uppercase tracking-wide ${state.gradeSystem === '5grade' ? 'text-purple-700 font-extrabold' : 'text-slate-500'}">
                                    ${state.gradeSystem === '5grade' ? '2028 개편 5등급제 환산' : `대표 70% Cut (${grp.primaryProgram?.evalType || '일반'})`}
                                </div>
                                <div class="text-xl font-black ${state.gradeSystem === '5grade' ? 'text-purple-800' : 'text-slate-900'}">
                                    ${state.gradeSystem === '5grade' && grade5Obj ? 
                                        `<span class="text-2xl font-black text-purple-700">${grade5Obj.grade5Exact}등급</span> <span class="text-xs font-semibold text-slate-500">(${cut70}컷 기준)</span>` : 
                                        (cut70 ? `${cut70}<span class="text-xs font-normal ml-0.5 text-slate-500">등급</span>` : '<span class="text-xs font-normal text-slate-400">전형별확인</span>')
                                    }
                                </div>
                            </div>
                            <div class="text-right border-l pl-3 ${state.gradeSystem === '5grade' ? 'border-purple-200' : 'border-slate-200'}">
                                <div class="text-[11px] font-bold text-indigo-600 uppercase tracking-wide">2025 예상/최신</div>
                                <div class="text-xl font-black text-indigo-700">
                                    ${cut25 ? `${cut25}<span class="text-xs font-normal ml-0.5 text-indigo-400">등급</span>` : '-'}
                                </div>
                            </div>
                        </div>

                        <!-- General High School Reality Indicator -->
                        ${rankObj ? `
                            <div class="mt-3 p-2.5 rounded-2xl bg-indigo-50/70 border border-indigo-100">
                                <div class="flex items-center justify-between">
                                    <span class="text-xs font-extrabold text-indigo-900 flex items-center">
                                        <i class="fa-solid fa-school-flag mr-1.5 text-indigo-600"></i>일반고(${state.schoolSize}명 기준)
                                    </span>
                                    <span class="text-xs font-black text-red-600 bg-white px-2 py-0.5 rounded-full border border-red-200 shadow-2xs">
                                        전교 ${rankObj.rank}등 이내
                                    </span>
                                </div>
                                <div class="mt-1 flex items-center justify-between text-[11px] text-indigo-800 font-semibold">
                                    <span>상위 <strong class="text-indigo-950 font-black">${rankObj.percentile}%</strong></span>
                                    <span>반(25명) 약 <strong class="text-indigo-950 font-black">${rankObj.classRank}등</strong></span>
                                </div>
                            </div>
                        ` : ''}

                        <!-- 2028 5-Grade Dedicated Highlight Banner (when toggle is ON) -->
                        ${state.gradeSystem === '5grade' && grade5Obj ? `
                            <div class="mt-2.5 px-3 py-2 rounded-2xl bg-purple-100/90 border border-purple-300 text-xs flex items-center justify-between text-purple-950 font-extrabold shadow-2xs">
                                <span class="flex items-center">
                                    <i class="fa-solid fa-check-circle text-purple-600 mr-1.5"></i>2028 대입 등급:
                                </span>
                                <span class="bg-purple-700 text-white font-black px-2.5 py-0.5 rounded-full text-xs shadow-xs">
                                    ${grade5Obj.text}
                                </span>
                            </div>
                        ` : ''}
                    </div>

                    <!-- Footer: Action button -->
                    <div class="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-xs">
                        <span class="text-slate-500 font-medium">
                            전형 선택 및 비교
                        </span>
                        <span class="text-indigo-600 font-extrabold flex items-center group-hover:translate-x-0.5 transition">
                            전형별 입결 상세 <i class="fa-solid fa-arrow-right ml-1 text-[11px]"></i>
                        </span>
                    </div>
                </div>
            `;
        });

        elements.cardsContainer.innerHTML = html;
        renderPagination(total);
    }

    function renderPagination(total) {
        if (!elements.pagination) return;
        const totalPages = Math.ceil(total / state.pageSize);
        if (totalPages <= 1) {
            elements.pagination.innerHTML = '';
            return;
        }

        const curr = state.currentPage;
        let html = `
            <div class="flex items-center justify-center gap-1.5 mt-8">
                <button onclick="window.App.changePage(${Math.max(1, curr - 1)})" 
                        class="px-3.5 py-2 rounded-xl border border-slate-300 text-sm font-bold ${curr === 1 ? 'opacity-40 cursor-not-allowed' : 'hover:bg-slate-100'}">
                    <i class="fa-solid fa-chevron-left mr-1"></i> 이전
                </button>
        `;

        const startPage = Math.max(1, curr - 2);
        const endPage = Math.min(totalPages, startPage + 4);

        for (let p = startPage; p <= endPage; p++) {
            html += `
                <button onclick="window.App.changePage(${p})" 
                        class="w-10 h-10 rounded-xl font-extrabold text-sm ${p === curr ? 'bg-indigo-600 text-white shadow-md shadow-indigo-200' : 'border border-slate-300 hover:bg-slate-100 text-slate-700'}">
                    ${p}
                </button>
            `;
        }

        html += `
                <button onclick="window.App.changePage(${Math.min(totalPages, curr + 1)})" 
                        class="px-3.5 py-2 rounded-xl border border-slate-300 text-sm font-bold ${curr === totalPages ? 'opacity-40 cursor-not-allowed' : 'hover:bg-slate-100'}">
                    다음 <i class="fa-solid fa-chevron-right ml-1"></i>
                </button>
            </div>
        `;
        elements.pagination.innerHTML = html;
    }

    function changePage(page) {
        state.currentPage = page;
        renderSearchResults();
        window.scrollTo({ top: 380, behavior: 'smooth' });
    }

    // Modal with Program Selector Tabs
    function openGroupDetail(encodedKey, selectedProgIdx = 0) {
        const key = decodeURIComponent(encodedKey);
        const grp = state.groupedDepartments.find(g => g.groupKey === key);
        if (!grp || grp.programs.length === 0) return;

        state.selectedGroup = grp;
        state.selectedProgramIndex = selectedProgIdx;

        const currentProg = grp.programs[selectedProgIdx] || grp.programs[0];
        const cut70 = currentProg.cut70;
        const rankObj = cut70 ? window.RealityCalc.calculateSchoolRank(cut70, state.schoolSize) : null;
        const insight = cut70 ? window.RealityCalc.getRealityCheckInsight(cut70, rankObj?.rank, state.schoolSize) : null;
        const grade5Obj = cut70 ? window.RealityCalc.convertTo2028Grade(cut70) : null;

        if (elements.modalTitle) {
            elements.modalTitle.innerHTML = `
                <div class="flex items-center gap-1.5 sm:gap-2.5 flex-wrap">
                    <span class="px-2 py-0.5 rounded-full text-[10px] sm:text-xs font-black bg-indigo-100 text-indigo-800 shrink-0">${grp.region}</span>
                    <span class="text-base sm:text-xl font-black text-slate-900 truncate">${grp.univ}</span>
                    <span class="text-sm sm:text-lg font-bold text-slate-600 truncate">${grp.major}</span>
                </div>
            `;
        }

        if (elements.modalContent) {
            elements.modalContent.innerHTML = `
                <!-- Program Selector Tabs/Buttons inside Modal (Horizontal Scroll on Mobile) -->
                <div class="mb-4 sm:mb-5 pb-3 sm:pb-4 border-b border-slate-200">
                    <div class="text-[11px] sm:text-xs font-bold text-slate-500 uppercase tracking-wide mb-2 flex items-center justify-between">
                        <span><i class="fa-solid fa-layer-group text-indigo-600 mr-1.5"></i> 전형 선택 (총 ${grp.programs.length}개 전형)</span>
                        <span class="text-[10px] text-slate-400 sm:hidden">좌우로 넘겨보세요 👉</span>
                    </div>
                    <div class="flex items-center gap-1.5 sm:gap-2 overflow-x-auto pb-1.5 scrollbar-none -mx-1 px-1">
                        ${grp.programs.map((p, pIdx) => {
                            const isSelected = pIdx === selectedProgIdx;
                            return `
                                <button onclick="window.App.switchModalProgram(${pIdx})" 
                                        class="px-3.5 py-2 rounded-xl text-xs font-extrabold transition flex items-center gap-1.5 ${isSelected ? 'bg-indigo-600 text-white shadow-md shadow-indigo-200 scale-102' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'}">
                                    <span class="px-1.5 py-0.5 rounded text-[10px] font-bold ${isSelected ? 'bg-white/20 text-white' : (p.type === '교과' ? 'bg-blue-100 text-blue-700' : 'bg-purple-100 text-purple-700')}">${p.type}</span>
                                    <span>${p.evalType || '일반전형'}</span>
                                    <span class="font-black ml-1 text-yellow-300 ${isSelected ? 'text-yellow-300' : 'text-indigo-600'}">
                                        ${p.cut70 ? p.cut70 + '컷' : '-'}
                                    </span>
                                </button>
                            `;
                        }).join('')}
                    </div>
                </div>

                <!-- Reality Check Box for the SELECTED Program -->
                ${rankObj && insight ? `
                    <div class="mb-6 p-5 rounded-3xl bg-gradient-to-br from-indigo-50 via-white to-blue-50 border-2 ${insight.borderClass} shadow-sm">
                        <div class="flex items-center justify-between flex-wrap gap-2 mb-3">
                            <span class="px-3 py-1 rounded-full text-xs font-black uppercase tracking-wider ${insight.badgeColor}">
                                [${currentProg.type} ${currentProg.evalType || ''}] ${insight.tier}
                            </span>
                            <div class="text-sm font-extrabold text-slate-700">
                                일반고 (${state.schoolSize}명 기준) : <strong class="text-xl text-red-600 underline decoration-red-400 font-black">전교 ${rankObj.rank}등 이내</strong>
                                (상위 ${rankObj.percentile}%, 반 약 ${rankObj.classRank}등)
                            </div>
                        </div>

                        <div id="modalRankGaugeContainer"></div>

                        <div class="mt-4 p-4 rounded-2xl bg-white border border-slate-200 text-sm">
                            <div class="font-bold text-slate-900 flex items-center mb-1">
                                <i class="fa-solid fa-chalkboard-user mr-2 text-indigo-600 text-base"></i>
                                <strong>선생님의 고입 지도 한마디:</strong>
                            </div>
                            <p class="text-slate-700 font-semibold leading-relaxed">
                                ${insight.middleSchoolReality}
                            </p>
                            <p class="text-slate-500 text-xs mt-2 border-t border-slate-100 pt-2">
                                💡 <strong>해당 등급대 대표 진학 라인:</strong> ${insight.targetLine}
                            </p>
                        </div>
                    </div>
                ` : `
                    <div class="p-4 mb-4 bg-amber-50 text-amber-800 rounded-2xl text-sm font-semibold">
                        해당 전형은 등급 컷 자료가 미공개이거나 실기/면접 위주 전형입니다.
                    </div>
                `}

                <!-- Metrics Grid for Current Program (Compact on Mobile) -->
                <div class="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-3 mb-4 sm:mb-6">
                    <div class="p-2.5 sm:p-3.5 bg-slate-50 rounded-xl sm:rounded-2xl border border-slate-200">
                        <div class="text-[10px] sm:text-xs text-slate-500 font-bold">2022 70% Cut</div>
                        <div class="text-lg sm:text-xl font-black text-slate-900 mt-0.5">${cut70 || '-'} <span class="text-xs font-normal">등급</span></div>
                        <div class="text-[10px] sm:text-[11px] text-slate-400 font-semibold truncate">50% Cut: ${currentProg.cut50 || '-'}</div>
                    </div>
                    <div class="p-2.5 sm:p-3.5 bg-indigo-50/80 rounded-xl sm:rounded-2xl border border-indigo-200">
                        <div class="text-[10px] sm:text-xs text-indigo-700 font-bold">2025 최신/예상</div>
                        <div class="text-lg sm:text-xl font-black text-indigo-900 mt-0.5">${currentProg.cut25_70 || '-'} <span class="text-xs font-normal">등급</span></div>
                        <div class="text-[10px] sm:text-[11px] text-indigo-500 font-semibold truncate">최근 입결 추세</div>
                    </div>
                    <div class="p-2.5 sm:p-3.5 bg-slate-50 rounded-xl sm:rounded-2xl border border-slate-200">
                        <div class="text-[10px] sm:text-xs text-slate-500 font-bold">경쟁률</div>
                        <div class="text-lg sm:text-xl font-black text-slate-900 mt-0.5">${currentProg.compRate ? currentProg.compRate + ':1' : '-'}</div>
                        <div class="text-[10px] sm:text-[11px] text-slate-400 font-semibold truncate">지원: ${currentProg.apply || '-'}명</div>
                    </div>
                    <div class="p-2.5 sm:p-3.5 bg-slate-50 rounded-xl sm:rounded-2xl border border-slate-200">
                        <div class="text-[10px] sm:text-xs text-slate-500 font-bold">모집 인원</div>
                        <div class="text-lg sm:text-xl font-black text-slate-900 mt-0.5">${currentProg.recruit ? currentProg.recruit + '명' : '-'}</div>
                        <div class="text-[10px] sm:text-[11px] text-slate-400 font-semibold truncate">지원자: ${currentProg.apply ? currentProg.apply + '명' : '-'}</div>
                    </div>
                </div>

                <!-- Charts Section (Responsive Heights) -->
                <div class="grid grid-cols-1 md:grid-cols-2 gap-3 sm:gap-4">
                    <div class="bg-white p-3 sm:p-4 rounded-xl sm:rounded-2xl border border-slate-200 shadow-xs">
                        <h4 class="font-extrabold text-slate-800 text-xs sm:text-sm mb-2 sm:mb-3 flex items-center">
                            <i class="fa-solid fa-chart-line text-indigo-600 mr-2"></i> 연도별 70% Cut 내신 추이
                        </h4>
                        <div class="h-44 sm:h-56 relative">
                            <canvas id="modalTrendChart"></canvas>
                        </div>
                    </div>
                    <div class="bg-white p-3 sm:p-4 rounded-xl sm:rounded-2xl border border-slate-200 shadow-xs">
                        <h4 class="font-extrabold text-slate-800 text-xs sm:text-sm mb-2 sm:mb-3 flex items-center">
                            <i class="fa-solid fa-chart-simple text-blue-600 mr-2"></i> 연도별 경쟁률 추이
                        </h4>
                        <div class="h-44 sm:h-56 relative">
                            <canvas id="modalCompChart"></canvas>
                        </div>
                    </div>
                </div>

                <div class="mt-4 p-3 bg-slate-50 rounded-xl text-xs text-slate-600 flex justify-between flex-wrap gap-2 font-medium">
                    <div><strong>산출 반영교과:</strong> ${currentProg.subject || '국, 수, 영, 사/과 등 주요교과'}</div>
                    <div><strong>2028 개편(5등급):</strong> ${grade5Obj ? grade5Obj.text : '-'}</div>
                </div>
            `;
        }

        if (elements.detailModal) {
            elements.detailModal.classList.remove('hidden');
            elements.detailModal.classList.add('flex');
            document.body.classList.add('overflow-hidden');
        }

        setTimeout(() => {
            if (rankObj) {
                window.ChartsManager.renderSchoolRankGauge('modalRankGaugeContainer', rankObj);
            }
            window.ChartsManager.renderTrendChart('modalTrendChart', currentProg);
            window.ChartsManager.renderCompChart('modalCompChart', currentProg);
        }, 50);
    }

    function switchModalProgram(progIndex) {
        if (!state.selectedGroup) return;
        openGroupDetail(encodeURIComponent(state.selectedGroup.groupKey), progIndex);
    }

    function closeModal() {
        if (elements.detailModal) {
            elements.detailModal.classList.add('hidden');
            elements.detailModal.classList.remove('flex');
            document.body.classList.remove('overflow-hidden');
        }
        state.selectedGroup = null;
    }

    // Simulator
    function runSimulator() {
        const targetGrade = parseFloat(elements.simGradeInput?.value) || 2.5;
        const simRegion = elements.simRegionSelect?.value || 'all';

        const rankObj = window.RealityCalc.calculateSchoolRank(targetGrade, state.schoolSize);
        const insight = window.RealityCalc.getRealityCheckInsight(targetGrade, rankObj.rank, state.schoolSize);
        const grade5Obj = window.RealityCalc.convertTo2028Grade(targetGrade);

        if (elements.simRealitySummary) {
            elements.simRealitySummary.innerHTML = `
                <div class="p-5 bg-gradient-to-r from-indigo-600 to-blue-600 text-white rounded-3xl shadow-md">
                    <div class="flex items-center justify-between flex-wrap gap-2">
                        <div>
                            <span class="px-3 py-1 rounded-full bg-white/20 text-white text-xs font-black uppercase">
                                목표 내신 ${targetGrade.toFixed(2)}등급 현실 진단
                            </span>
                            <h3 class="text-2xl font-black mt-1">
                                일반고 ${state.schoolSize}명 중 <span class="text-yellow-300 underline font-black">전교 ${rankObj.rank}등 이내</span> (상위 ${rankObj.percentile}%)
                            </h3>
                            <div class="mt-1.5 inline-flex items-center px-2.5 py-0.5 rounded-full bg-purple-900/60 text-purple-100 text-xs font-bold border border-purple-300/40">
                                🎓 2028 개편 대입 환산: <strong class="text-white ml-1 font-black">${grade5Obj.text}</strong>
                            </div>
                        </div>
                        <div class="text-right">
                            <span class="text-xs text-indigo-100 font-semibold">학급(25명 기준)</span>
                            <div class="text-xl font-black">반 약 ${rankObj.classRank}등</div>
                        </div>
                    </div>
                    <p class="mt-3 text-indigo-100 text-sm font-medium border-t border-white/20 pt-2.5 leading-relaxed">
                        ${insight.middleSchoolReality}
                    </p>
                </div>
            `;
        }

        const eligible = state.groupedDepartments.filter(grp => {
            if (!grp.primaryCut70) return false;
            if (simRegion !== 'all' && grp.region !== simRegion) return false;
            return true;
        });

        const challengeList = eligible.filter(g => g.primaryCut70 < targetGrade && g.primaryCut70 >= targetGrade - 0.6)
            .sort((a, b) => (parseFloat(b.primaryCompRate) || 0) - (parseFloat(a.primaryCompRate) || 0))
            .slice(0, 12);

        const targetList = eligible.filter(g => g.primaryCut70 >= targetGrade - 0.1 && g.primaryCut70 <= targetGrade + 0.3)
            .sort((a, b) => a.primaryCut70 - b.primaryCut70)
            .slice(0, 12);

        const safetyList = eligible.filter(g => g.primaryCut70 > targetGrade + 0.3 && g.primaryCut70 <= targetGrade + 1.0)
            .sort((a, b) => a.primaryCut70 - b.primaryCut70)
            .slice(0, 12);

        renderSimList(elements.simChallengeList, challengeList, '소신/도전권');
        renderSimList(elements.simTargetList, targetList, '적정/합격권');
        renderSimList(elements.simSafetyList, safetyList, '안정/여유권');
    }

    function renderSimList(container, list, label) {
        if (!container) return;
        if (list.length === 0) {
            container.innerHTML = '<div class="p-6 text-center text-slate-400 text-sm font-semibold">해당 구간의 추천 대학이 없습니다.</div>';
            return;
        }

        let html = '';
        list.forEach(grp => {
            html += `
                <div class="p-3.5 bg-white rounded-2xl border border-slate-200 hover:border-indigo-300 hover:shadow-xs transition cursor-pointer flex items-center justify-between"
                     onclick="window.App.openGroupDetail('${encodeURIComponent(grp.groupKey)}')">
                    <div>
                        <div class="flex items-center gap-1.5 mb-1">
                            <span class="px-2 py-0.5 rounded text-[11px] font-bold bg-slate-100 text-slate-600">${grp.region}</span>
                            <span class="text-sm font-black text-slate-900">${grp.univ}</span>
                        </div>
                        <div class="text-xs font-bold text-slate-600">${grp.major}</div>
                    </div>
                    <div class="text-right">
                        <div class="text-base font-black text-slate-900">${grp.primaryCut70}<span class="text-xs font-normal text-slate-500">컷</span></div>
                        <div class="text-[11px] text-indigo-600 font-bold">전형 ${grp.programs.length}개</div>
                    </div>
                </div>
            `;
        });
        container.innerHTML = html;
    }

    function handleExcelFile(file) {
        if (!file) return;
        if (!window.XLSX) {
            alert('엑셀 파싱 라이브러리가 로드되지 않았습니다.');
            return;
        }

        if (elements.importStatus) {
            elements.importStatus.innerHTML = '<span class="text-indigo-600 font-bold"><i class="fa-solid fa-spinner fa-spin mr-1"></i> 파일 읽는 중... (' + file.name + ')</span>';
        }

        const reader = new FileReader();
        reader.onload = function(e) {
            try {
                const data = new Uint8Array(e.target.result);
                const workbook = window.XLSX.read(data, { type: 'array' });
                const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
                const rows = window.XLSX.utils.sheet_to_json(firstSheet, { header: 1 });

                let importedCount = 0;
                for (let r = 1; r < rows.length; r++) {
                    const row = rows[r];
                    if (!row || row.length < 3) continue;
                    const univ = String(row[1] || row[2] || '').trim();
                    const major = String(row[3] || row[4] || '').trim();
                    const cut = parseFloat(row[5] || row[6] || row[7]);

                    if (univ && major) {
                        state.allRecords.unshift({
                            id: Date.now() + r,
                            region: '신규등록',
                            univ: univ,
                            type: '신규수시',
                            evalType: '엑셀가져오기',
                            field: '통합',
                            major: major,
                            cut70: isNaN(cut) ? null : cut,
                            cut25_70: isNaN(cut) ? null : cut,
                            compRate: '신규',
                            fillRate: '-'
                        });
                        importedCount++;
                    }
                }

                buildGroupedDepartments();
                applyFilters();

                if (elements.importStatus) {
                    elements.importStatus.innerHTML = `
                        <div class="p-4 bg-emerald-50 text-emerald-800 rounded-2xl font-bold">
                            <i class="fa-solid fa-circle-check mr-2 text-emerald-600"></i>
                            성공! 총 ${importedCount}건의 데이터가 성공적으로 반영되었습니다.
                        </div>
                    `;
                }

                alert('총 ' + importedCount + '건의 엑셀 데이터가 성공적으로 반영되었습니다!');
            } catch (err) {
                console.error(err);
                if (elements.importStatus) {
                    elements.importStatus.innerHTML = '<span class="text-red-600 font-bold">오류 발생: ' + err.message + '</span>';
                }
            }
        };
        reader.readAsArrayBuffer(file);
    }

    function bindEvents() {
        if (elements.schoolSizeSlider) {
            elements.schoolSizeSlider.addEventListener('input', e => {
                const val = parseInt(e.target.value, 10);
                state.schoolSize = val;
                if (elements.schoolSizeDisplay) {
                    elements.schoolSizeDisplay.textContent = val + '명';
                }
                if (state.activeTab === 'search') renderSearchResults();
                else if (state.activeTab === 'simulator') runSimulator();
            });
        }

        if (elements.gradeSystemToggle) {
            elements.gradeSystemToggle.addEventListener('change', e => {
                state.gradeSystem = e.target.checked ? '5grade' : '9grade';
                renderSearchResults();
            });
        }

        elements.tabBtns.forEach(btn => {
            btn.addEventListener('click', () => {
                const tab = btn.getAttribute('data-tab');
                state.activeTab = tab;

                elements.tabBtns.forEach(b => {
                    b.classList.remove('bg-indigo-600', 'text-white', 'shadow-sm');
                    b.classList.add('text-slate-600', 'hover:bg-slate-100');
                });
                btn.classList.add('bg-indigo-600', 'text-white', 'shadow-sm');
                btn.classList.remove('text-slate-600', 'hover:bg-slate-100');

                elements.tabContents.forEach(content => {
                    if (content.id === 'tab-' + tab) {
                        content.classList.remove('hidden');
                    } else {
                        content.classList.add('hidden');
                    }
                });

                if (tab === 'simulator') {
                    runSimulator();
                }
            });
        });

        // Dual Search Inputs: University & Department
        let searchDebounce = null;
        function triggerDebouncedSearch() {
            clearTimeout(searchDebounce);
            searchDebounce = setTimeout(() => {
                state.filters.univKeyword = elements.univKeywordInput ? elements.univKeywordInput.value : '';
                state.filters.majorKeyword = elements.majorKeywordInput ? elements.majorKeywordInput.value : '';
                applyFilters();
            }, 120);
        }

        if (elements.univKeywordInput) {
            elements.univKeywordInput.addEventListener('input', triggerDebouncedSearch);
        }
        if (elements.majorKeywordInput) {
            elements.majorKeywordInput.addEventListener('input', triggerDebouncedSearch);
        }

        if (elements.regionSelect) {
            elements.regionSelect.addEventListener('change', e => {
                state.filters.region = e.target.value;
                applyFilters();
            });
        }
        if (elements.typeSelect) {
            elements.typeSelect.addEventListener('change', e => {
                state.filters.type = e.target.value;
                applyFilters();
            });
        }
        if (elements.sortSelect) {
            elements.sortSelect.addEventListener('change', e => {
                state.filters.sortBy = e.target.value;
                applyFilters();
            });
        }

        if (elements.resetFilterBtn) {
            elements.resetFilterBtn.addEventListener('click', () => {
                state.filters = {
                    univKeyword: '',
                    majorKeyword: '',
                    region: 'all',
                    type: 'all',
                    sortBy: 'cut_asc'
                };
                if (elements.univKeywordInput) elements.univKeywordInput.value = '';
                if (elements.majorKeywordInput) elements.majorKeywordInput.value = '';
                if (elements.regionSelect) elements.regionSelect.value = 'all';
                if (elements.typeSelect) elements.typeSelect.value = 'all';
                if (elements.sortSelect) elements.sortSelect.value = 'cut_asc';
                applyFilters();
            });
        }

        if (elements.simCalculateBtn) {
            elements.simCalculateBtn.addEventListener('click', runSimulator);
        }
        if (elements.simGradeInput) {
            elements.simGradeInput.addEventListener('keypress', e => {
                if (e.key === 'Enter') runSimulator();
            });
        }
        if (elements.simRegionSelect) {
            elements.simRegionSelect.addEventListener('change', runSimulator);
        }

        if (elements.closeModalBtn) {
            elements.closeModalBtn.addEventListener('click', closeModal);
        }
        if (elements.detailModal) {
            elements.detailModal.addEventListener('click', e => {
                if (e.target === elements.detailModal) closeModal();
            });
            // Handle touch backdrop close
            elements.detailModal.addEventListener('touchend', e => {
                if (e.target === elements.detailModal) {
                    e.preventDefault();
                    closeModal();
                }
            });
        }
        document.addEventListener('keydown', e => {
            if (e.key === 'Escape') closeModal();
        });

        if (elements.dropZone) {
            elements.dropZone.addEventListener('dragover', e => {
                e.preventDefault();
                elements.dropZone.classList.add('border-indigo-500', 'bg-indigo-50/50');
            });
            elements.dropZone.addEventListener('dragleave', e => {
                e.preventDefault();
                elements.dropZone.classList.remove('border-indigo-500', 'bg-indigo-50/50');
            });
            elements.dropZone.addEventListener('drop', e => {
                e.preventDefault();
                elements.dropZone.classList.remove('border-indigo-500', 'bg-indigo-50/50');
                if (e.dataTransfer.files.length > 0) {
                    handleExcelFile(e.dataTransfer.files[0]);
                }
            });
        }
        if (elements.excelFileInput) {
            elements.excelFileInput.addEventListener('change', e => {
                if (e.target.files.length > 0) {
                    handleExcelFile(e.target.files[0]);
                }
            });
        }
    }

    window.App = {
        init: function() {
            initElements();
            bindEvents();
            loadData();
        },
        openGroupDetail,
        switchModalProgram,
        closeModal,
        changePage,
        runSimulator
    };

    document.addEventListener('DOMContentLoaded', window.App.init);
})();
