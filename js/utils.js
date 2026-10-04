/* ============================================================
 * utils.js
 * สูตรคณิตศาสตร์ & ฟังก์ชันคำนวณ/จัดรูปแบบ (ไม่แตะ DOM)
 * ============================================================ */

/* Mathematical Functions */
function calculateRetentionFraction(tHours, S) {
    if (S <= 0) return 0;
    const R = Math.exp(-tHours / S);
    return Math.min(1.0, Math.max(0.0, R));
}

function getMemoryState(R_fraction) {
    if (R_fraction >= 0.90) {
        return {
            code: 'FRESH',
            label: 'จำได้แม่น',
            badgeClass: 'bg-emerald-100 text-emerald-800 border-emerald-300',
            bgColor: 'bg-emerald-500',
            recommendation: 'ยังไม่ต้องทบทวน',
            desc: 'ยังจำได้แม่น ทบทวนตอนนี้ยังไม่ค่อยคุ้ม',
            urgent: false
        };
    } else if (R_fraction >= 0.85) {
        return {
            code: 'OPTIMAL',
            label: 'ถึงจุดทบทวนแนะนำ (R=0.85)',
            badgeClass: 'bg-teal-100 text-teal-800 border-teal-300 font-bold',
            bgColor: 'bg-teal-500',
            recommendation: 'แนะนำให้ทบทวนตอนนี้',
            desc: 'เริ่มนึกยากเล็กน้อย ทบทวนตอนนี้ช่วยเพิ่มค่า S ได้ดี',
            urgent: true
        };
    } else if (R_fraction >= 0.75) {
        return {
            code: 'RECOMMENDED',
            label: 'ควรทบทวน',
            badgeClass: 'bg-amber-100 text-amber-800 border-amber-300 font-semibold',
            bgColor: 'bg-amber-500',
            recommendation: 'ควรทบทวน',
            desc: 'ความจำเริ่มคลาย ควรทบทวนก่อนจะลืมมากขึ้น',
            urgent: true
        };
    } else if (R_fraction >= 0.50) {
        return {
            code: 'DECAYING',
            label: 'เริ่มลืม',
            badgeClass: 'bg-orange-100 text-orange-800 border-orange-300 font-bold',
            bgColor: 'bg-orange-500',
            recommendation: 'ต้องทบทวนด่วน',
            desc: 'เริ่มลืมรายละเอียด ลองนึกเองก่อนดูเฉลย',
            urgent: true
        };
    } else {
        return {
            code: 'LOST',
            label: 'ลืมเกินครึ่ง (<50%)',
            badgeClass: 'bg-rose-100 text-rose-800 border-rose-300 font-bold',
            bgColor: 'bg-rose-600',
            recommendation: 'ควรเรียนซ้ำ',
            desc: 'ลืมไปเกินครึ่ง เหมือนต้องเรียนใหม่',
            urgent: true
        };
    }
}

function getElapsedHours(lastReviewedAtISO) {
    const last = new Date(lastReviewedAtISO).getTime();
    const now = Date.now();
    return Math.max(0, (now - last) / (1000 * 3600));
}

function getHoursUntilThreshold(S, targetR = 0.85) {
    return -S * Math.log(targetR);
}

function formatDurationReadable(hoursFloat) {
    if (hoursFloat < 24) {
        return `${hoursFloat.toFixed(1)} ชม.`;
    } else if (hoursFloat < 720) {
        const days = (hoursFloat / 24).toFixed(1);
        return `${days} วัน`;
    } else if (hoursFloat < 8760) {
        const months = (hoursFloat / 720).toFixed(1);
        return `${months} เดือน`;
    } else {
        const years = (hoursFloat / 8760).toFixed(1);
        return `${years} ปี`;
    }
}

function getGradeLabel(grade) {
    switch(grade) {
        case 'again': return 'ซ้ำอีกครั้ง (รีเซ็ต)';
        case 'hard': return 'ยาก (1.2x)';
        case 'good': return 'ปานกลาง (2.5x)';
        case 'easy': return 'ง่าย (3.25x)';
        default: return 'ปานกลาง (2.5x)';
    }
}

function formatCountdown(ms) {
    const totalMin = Math.max(0, Math.round(ms / 60000));
    const d = Math.floor(totalMin / 1440);
    const hh = Math.floor((totalMin % 1440) / 60);
    const mm = totalMin % 60;
    if (d > 0) return `อีก ${d} วัน ${hh} ชม.`;
    return `อีก ${hh} ชม. ${mm} นาที`;
}

function effectiveMultiplier(grade, method) {
    // ตัวคูณจริง = ตัวคูณตามระดับ x ตัวคูณตามวิธีทบทวน (ไม่ต่ำกว่า 1 เพราะจำได้ ค่า S ไม่ควรลดลง)
    if (grade === 'again') return null;
    const g = GRADE_MULT[grade] || GRADE_MULT.good;
    const m = METHOD_MULT[method] !== undefined ? METHOD_MULT[method] : METHOD_MULT.test;
    return Math.max(1, g * m);
}

function applyGrade(S, grade, method) {
    let n = S;
    if (grade === 'again') n = Math.min(S, S_MIN);
    else if (GRADE_MULT[grade]) n = S * effectiveMultiplier(grade, method);
    return parseFloat(n.toFixed(1));
}
/* ===== Goal planner ===== */
// สัดส่วนระยะเว้นต่อเวลาที่อยากจำ: Cepeda et al. (2008) ~20-40% ของ 1 สัปดาห์ ลดเหลือ ~5-10% ของ 1 ปี
// ใช้ค่ากลาง 30% และ 7.5% เชื่อมด้วย log-interpolation (ประมาณการ)
function cepedaRatio(riHours) {
    const d = riHours / 24;
    if (d <= 7) return 0.30;
    if (d >= 365) return 0.075;
    return 0.30 * Math.pow(0.075 / 0.30, Math.log(d / 7) / Math.log(365 / 7));
}

function buildReviewPlan(subject, goalMs, grade, method) {
    const goalH = (goalMs - Date.now()) / 3600000;
    const mult = effectiveMultiplier(grade, method) || effectiveMultiplier('good', method);
    const plan = { goalH, mult, reviews: [], capped: false, Rgoal: null };
    if (goalH <= 0) return plan;
    let t = 0, S = subject.S, el = getElapsedHours(subject.lastReviewedAt);
    for (let i = 0; i < 60; i++) {
        if (Math.exp(-(goalH - t + el) / S) >= TARGET_R) break;
        const modelTotal = K_TARGET * S;
        const RI = goalH - t + el;
        const researchTotal = cepedaRatio(RI) * RI;
        const total = Math.min(modelTotal, researchTotal);
        const atH = t + Math.max(0, total - el);
        if (atH >= goalH) break;
        const gapH = el + (atH - t);
        plan.reviews.push({
            n: i + 1, atH, gapH,
            Rbefore: Math.exp(-gapH / S),
            dangerAtH: (t - el) + Math.LN2 * S,
            limitedBy: researchTotal < modelTotal ? 'research' : 'memory'
        });
        S *= mult; t = atH; el = 0;
        if (i === 59) plan.capped = true;
    }
    plan.Rgoal = Math.exp(-(goalH - (t - el)) / S);
    return plan;
}

function fmtDate(ms, withTime) {
    return new Date(ms).toLocaleString('th-TH', withTime
        ? { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }
        : { day: 'numeric', month: 'short', year: '2-digit' });
}
function dayKey(ms) { const d = new Date(ms); return d.getFullYear() + '-' + d.getMonth() + '-' + d.getDate(); }

function escapeHtml(str) {
    return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

/* ===== คำนวณย้อนหลังช่วงที่ปิดเว็บ (offline) =====
 * ใช้เวลาจริงจากนาฬิกา เทียบ "ครั้งล่าสุดที่เปิดแอป" กับ "ตอนนี้"
 * R ก่อนปิด = e^(-(เวลาที่ปิด - เวลาทบทวนล่าสุด) / S), R ตอนนี้ = e^(-(ตอนนี้ - เวลาทบทวนล่าสุด) / S) */
function buildOfflineReport(lastSeenMs, nowMs) {
    const gapMs = Math.max(0, nowMs - lastSeenMs);
    const items = subjects.map(s => {
        const reviewedMs = new Date(s.lastReviewedAt).getTime();
        const elapsedBefore = Math.max(0, (lastSeenMs - reviewedMs) / 3600000);
        const elapsedNow = getElapsedHours(s.lastReviewedAt);
        return {
            id: s.id, name: s.name, color: s.color,
            Rbefore: calculateRetentionFraction(elapsedBefore, s.S),
            Rnow: calculateRetentionFraction(elapsedNow, s.S),
            dueInH: getHoursUntilThreshold(s.S, TARGET_R) - elapsedNow   // ติดลบ = เลยจุดทบทวนแล้ว
        };
    });
    items.sort((a, b) => a.Rnow - b.Rnow);
    return { gapMs, items };
}

function formatAwayTime(ms) {
    const min = Math.round(ms / 60000);
    if (min < 60) return `${min} นาที`;
    return formatDurationReadable(ms / 3600000);
}
