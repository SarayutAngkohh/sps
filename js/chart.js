/* ============================================================
 * chart.js
 * การวาดกราฟ Chart.js & ตารางความจำ (Heatmap)
 * ============================================================ */

/* Line Chart Rendering Logic */
function initChart() {
    const canvas = document.getElementById('retentionChart');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    
    retentionChartInstance = new Chart(ctx, {
        type: 'line',
        data: { labels: [], datasets: [] },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            interaction: { mode: 'index', intersect: false },
            scales: {
                x: {
                    title: { display: true, text: 'เวลาที่จะผ่านไปจากนี้', font: { family: 'Kanit', size: 11 } },
                    grid: { color: '#f1f5f9' }
                },
                y: {
                    min: 0,
                    max: 100,
                    title: { display: true, text: 'ความจำที่เหลือ R (%)', font: { family: 'Kanit', size: 11 } },
                    ticks: { callback: function(value) { return `${value}%`; } },
                    grid: { color: '#f1f5f9' }
                }
            },
            plugins: {
                legend: { position: window.innerWidth < 640 ? 'bottom' : 'top', labels: { font: { family: 'Kanit', size: window.innerWidth < 640 ? 9 : 11 }, boxWidth: window.innerWidth < 640 ? 8 : 40, usePointStyle: true } },
                tooltip: {
                    callbacks: {
                        label: function(context) {
                            return `${context.dataset.label}: ${context.parsed.y.toFixed(1)}%`;
                        }
                    }
                }
            }
        }
    });

    updateChart();
}

function updateChart() {
    if (!retentionChartInstance) return;

    const maxHours = parseInt(document.getElementById('timeRangeSelect')?.value) || 72;
    let step = 2;
    let timeUnitFormatter = (h) => `+${h} ชม.`;

    if (maxHours <= 24) {
        step = 2;
        timeUnitFormatter = (h) => `+${h} ชม.`;
    } else if (maxHours <= 72) {
        step = 6;
        timeUnitFormatter = (h) => h < 24 ? `+${h} ชม.` : `+${(h/24).toFixed(1)} วัน`;
    } else if (maxHours <= 168) {
        step = 12;
        timeUnitFormatter = (h) => `+${(h/24).toFixed(1)} วัน`;
    } else if (maxHours <= 720) {
        step = 48;
        timeUnitFormatter = (h) => `+${Math.round(h/24)} วัน`;
    } else {
        step = 720;
        timeUnitFormatter = (h) => `+${Math.round(h/720)} เดือน`;
    }

    const timeLabels = [];
    for (let h = 0; h <= maxHours; h += step) {
        timeLabels.push(timeUnitFormatter(h));
    }

    const datasets = [
        {
            label: 'จุดแนะนำให้ทบทวน R=0.85 (85%)',
            data: Array(timeLabels.length).fill(85),
            borderColor: '#0d9488',
            borderWidth: 2,
            borderDash: [4, 4],
            pointRadius: 0,
            fill: false
        },
        {
            label: 'ควรทบทวน R=0.75 (75%)',
            data: Array(timeLabels.length).fill(75),
            borderColor: '#f59e0b',
            borderWidth: 1.5,
            borderDash: [5, 5],
            pointRadius: 0,
            fill: false
        },
        {
            label: 'ลืมเกินครึ่ง R=0.50 (50%)',
            data: Array(timeLabels.length).fill(50),
            borderColor: '#e11d48',
            borderWidth: 1.5,
            borderDash: [3, 3],
            pointRadius: 0,
            fill: false
        }
    ];

    subjects.forEach(sub => {
        const elapsedNow = getElapsedHours(sub.lastReviewedAt);
        const curveData = [];

        for (let h = 0; h <= maxHours; h += step) {
            const totalT = elapsedNow + h;
            const R_frac = calculateRetentionFraction(totalT, sub.S);
            curveData.push(parseFloat((R_frac * 100).toFixed(1)));
        }

        datasets.push({
            label: sub.name,
            data: curveData,
            borderColor: sub.color || '#166534',
            backgroundColor: 'transparent',
            borderWidth: 2,
            tension: 0.35,
            pointRadius: 2
        });
    });

    retentionChartInstance.data.labels = timeLabels;
    retentionChartInstance.data.datasets = datasets;
    retentionChartInstance.update('none');
}

/* Heatmap Render Function */
function renderMemoryHeatmap(containerId = 'memoryHeatmapContainer') {
    const container = document.getElementById(containerId);
    if (!container) return;

    if (subjects.length === 0) {
        container.innerHTML = `
            <div class="py-8 text-center text-slate-400 text-xs bg-slate-50 rounded-xl border border-dashed border-slate-200">
                ยังไม่ได้เพิ่มวิชาในระบบ กดปุ่ม "เพิ่มวิชาใหม่" เพื่อเริ่มติดตาม
            </div>`;
        return;
    }

    const intervals = [
        { label: 'ตอนนี้', h: 0 },
        { label: '+12 ชม.', h: 12 },
        { label: '+1 วัน', h: 24 },
        { label: '+3 วัน', h: 72 },
        { label: '+7 วัน (1 สัปดาห์)', h: 168 },
        { label: '+30 วัน (1 เดือน)', h: 720 },
        { label: '+180 วัน (6 เดือน)', h: 4320 },
        { label: '+365 วัน (1 ปี)', h: 8760 }
    ];

    let html = `
        <table class="w-full text-left border-collapse text-xs">
            <thead>
                <tr class="bg-slate-50 border-b border-slate-200 text-slate-600 font-semibold">
                    <th class="p-2.5 min-w-[130px] sm:min-w-[180px] sticky left-0 z-10 bg-slate-50">รายวิชา / หัวข้อ</th>
                    ${intervals.map(inv => `<th class="p-2 text-center min-w-[84px] sm:min-w-[100px] text-[11px]">${inv.label}</th>`).join('')}
                </tr>
            </thead>
            <tbody class="divide-y divide-slate-100">
    `;

    subjects.forEach(s => {
        const elapsed = getElapsedHours(s.lastReviewedAt);
        html += `<tr>`;
        html += `<td class="p-2.5 font-bold text-slate-800 sticky left-0 z-10 bg-white">${escapeHtml(s.name)}</td>`;

        intervals.forEach(inv => {
            const totalT = elapsed + inv.h;
            const R_frac = calculateRetentionFraction(totalT, s.S);
            const R_pct = Math.round(R_frac * 100);
            
            let blockColorClass = '';
            let textColorClass = 'text-white';

            if (R_frac >= 0.90) {
                blockColorClass = 'bg-emerald-500 hover:bg-emerald-600';
            } else if (R_frac >= 0.85) {
                blockColorClass = 'bg-teal-500 hover:bg-teal-600';
            } else if (R_frac >= 0.75) {
                blockColorClass = 'bg-amber-400 text-amber-950 hover:bg-amber-500';
                textColorClass = 'text-amber-950';
            } else if (R_frac >= 0.50) {
                blockColorClass = 'bg-orange-500 hover:bg-orange-600';
            } else {
                blockColorClass = 'bg-rose-600 hover:bg-rose-700';
            }

            html += `
                <td class="p-1.5 text-center">
                    <div class="py-2 px-1 rounded-lg ${blockColorClass} ${textColorClass} font-mono font-bold text-[11px] shadow-sm transition-transform hover:scale-105 cursor-pointer"
                         title="${escapeHtml(s.name)} (${inv.label}): คาดว่าความจำจะเหลือ ${R_pct}%">
                        ${R_pct}%
                    </div>
                </td>
            `;
        });

        html += `</tr>`;
    });

    html += `</tbody></table>`;
    container.innerHTML = html;
}
