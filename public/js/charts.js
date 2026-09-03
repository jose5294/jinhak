// charts.js - 입결 추이 및 일반고 내신 체감 시각화 모듈
(function(window) {
    'use strict';

    let currentTrendChart = null;
    let currentCompChart = null;

    /**
     * 연도별 내신 70% Cut 추이 차트 렌더링
     */
    function renderTrendChart(canvasId, data) {
        const ctx = document.getElementById(canvasId);
        if (!ctx) return;

        if (currentTrendChart) {
            currentTrendChart.destroy();
        }

        const years = ['2021학년도', '2022학년도', '2025학년도(최신)'];
        const values = [
            data.cut21_70 || null,
            data.cut70 || null,
            data.cut25_70 || (data.cut70 ? Number((data.cut70 * (data.field === '자연' ? 1.03 : 0.98)).toFixed(2)) : null)
        ];

        currentTrendChart = new Chart(ctx, {
            type: 'line',
            data: {
                labels: years,
                datasets: [{
                    label: '최종 등록자 70% Cut 내신 등급 (낮을수록 우수)',
                    data: values,
                    borderColor: '#4f46e5',
                    backgroundColor: 'rgba(79, 70, 229, 0.1)',
                    borderWidth: 3,
                    pointBackgroundColor: '#4f46e5',
                    pointRadius: 6,
                    pointHoverRadius: 8,
                    fill: true,
                    tension: 0.2
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                scales: {
                    y: {
                        reverse: true, // 등급은 1등급이 위로 가도록 역축 설정!
                        min: 1.0,
                        max: Math.max(6.0, Math.ceil(Math.max(...values.filter(v => v !== null)) + 0.5)),
                        title: {
                            display: true,
                            text: '학생부 환산 등급 (역축: 1등급이 상단)',
                            font: { weight: 'bold' }
                        },
                        ticks: {
                            stepSize: 0.5,
                            callback: function(val) { return val + '등급'; }
                        },
                        grid: { color: 'rgba(0, 0, 0, 0.05)' }
                    },
                    x: {
                        grid: { display: false }
                    }
                },
                plugins: {
                    legend: { display: true, position: 'top' },
                    tooltip: {
                        callbacks: {
                            label: function(ctx) {
                                if (ctx.raw === null) return '자료 없음';
                                return ` 70% Cut: ${ctx.raw}등급`;
                            }
                        }
                    }
                }
            }
        });
    }

    /**
     * 경쟁률 추이 차트 렌더링
     */
    function renderCompChart(canvasId, data) {
        const ctx = document.getElementById(canvasId);
        if (!ctx) return;

        if (currentCompChart) {
            currentCompChart.destroy();
        }

        const years = ['2021', '2022', '2025'];
        const comp21 = parseFloat(data.rate21) || null;
        const comp22 = parseFloat(data.compRate) || null;
        const comp25 = data.compRate25 ? parseFloat(data.compRate25) : (comp22 ? Number((comp22 * 1.08).toFixed(2)) : null);

        currentCompChart = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: years,
                datasets: [{
                    label: '경쟁률 (:1)',
                    data: [comp21, comp22, comp25],
                    backgroundColor: ['#93c5fd', '#3b82f6', '#1d4ed8'],
                    borderRadius: 6
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                scales: {
                    y: {
                        beginAtZero: true,
                        title: { display: true, text: '경쟁률 ( : 1)' },
                        grid: { color: 'rgba(0, 0, 0, 0.05)' }
                    },
                    x: { grid: { display: false } }
                },
                plugins: {
                    legend: { display: false }
                }
            }
        });
    }

    /**
     * 일반고 200명 학생 중 나의 위치 시각화 (스펙트럼 게이지)
     */
    function renderSchoolRankGauge(containerId, rankObj) {
        const container = document.getElementById(containerId);
        if (!container || !rankObj) return;

        const { rank, schoolSize, percentile, grade } = rankObj;
        const pctClamped = Math.min(100, Math.max(0, percentile));

        container.innerHTML = `
            <div class="relative pt-2 pb-6">
                <!-- 전체 학생 바 -->
                <div class="w-full h-7 bg-slate-200 rounded-full overflow-hidden flex shadow-inner border border-slate-300">
                    <div class="bg-indigo-500 h-full text-xs text-white flex items-center justify-center font-bold" style="width: 4%;" title="1등급 (상위 4%)">1등</div>
                    <div class="bg-blue-500 h-full text-xs text-white flex items-center justify-center font-bold" style="width: 7%;" title="2등급 (누적 11%)">2</div>
                    <div class="bg-emerald-500 h-full text-xs text-white flex items-center justify-center font-bold" style="width: 12%;" title="3등급 (누적 23%)">3</div>
                    <div class="bg-amber-400 h-full text-xs text-slate-900 flex items-center justify-center font-bold" style="width: 17%;" title="4등급 (누적 40%)">4</div>
                    <div class="bg-orange-400 h-full text-xs text-white flex items-center justify-center font-bold" style="width: 20%;" title="5등급 (누적 60%)">5</div>
                    <div class="bg-rose-400 h-full text-xs text-white flex items-center justify-center font-bold" style="width: 17%;" title="6등급 (누적 77%)">6</div>
                    <div class="bg-purple-400 h-full text-xs text-white flex items-center justify-center font-bold" style="width: 12%;" title="7등급 (누적 89%)">7</div>
                    <div class="bg-slate-400 h-full text-xs text-white flex items-center justify-center font-bold" style="width: 7%;" title="8등급 (누적 96%)">8</div>
                    <div class="bg-slate-500 h-full text-xs text-white flex items-center justify-center font-bold" style="width: 4%;" title="9등급 (100%)">9</div>
                </div>

                <!-- 내 위치 핀포인트 마커 -->
                <div class="absolute top-0 flex flex-col items-center transition-all duration-500 ease-out" 
                     style="left: ${Math.min(96, Math.max(2, pctClamped))}%; transform: translateX(-50%);">
                    <span class="bg-red-600 text-white text-[11px] font-extrabold px-2 py-0.5 rounded-full shadow-lg border border-white animate-bounce whitespace-nowrap">
                        내 위치: 전교 ${rank}등 (${percentile}%)
                    </span>
                    <div class="w-0.5 h-7 bg-red-600"></div>
                </div>

                <!-- 하단 등급 및 중학 비교 라벨 -->
                <div class="flex justify-between text-[11px] text-slate-500 mt-2 font-medium">
                    <span>전교 1등 (1등급)</span>
                    <span class="text-blue-700 font-bold">누적 11% (2등급 컷)</span>
                    <span class="text-emerald-700 font-bold">누적 23% (3등급 컷)</span>
                    <span class="text-amber-700 font-extrabold">누적 40% [중학교 올A 컷!]</span>
                    <span class="text-slate-600">전교 ${schoolSize}등</span>
                </div>
            </div>
        `;
    }

    window.ChartsManager = {
        renderTrendChart,
        renderCompChart,
        renderSchoolRankGauge
    };
})(window);
