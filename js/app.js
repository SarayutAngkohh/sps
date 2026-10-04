/* ============================================================
 * app.js
 * ควบคุม UI, Events, Navigation และการ render หน้าจอ
 * ============================================================ */

/* Selection and Confirmation Logic */
function selectGrade(subjectId, grade) {
    selectedGrades[subjectId] = grade;
    updateAllViews();
}

function confirmRecordStudySession(subjectId) {
    const grade = selectedGrades[subjectId] || 'good';
    // "ซ้ำอีกครั้ง" = จำไม่ได้ ระบบรีเซ็ต S เสมอ ไม่ว่าจะทบทวนด้วยวิธีไหน จึงไม่ต้องถามวิธีทบทวน
    if (grade === 'again') { recordStudySession(subjectId, 'again', null); return; }
    openMethodModal(subjectId, grade);
}

/* ===== หน้าถามวิธีทบทวน (อ่าน/จำ หรือ ทำข้อสอบ) ก่อนบันทึก ===== */
function methodFromChoice(main, extra) {
    if (main === 'test') return 'test';
    if (main === 'read' && extra === true) return 'read_test';
    if (main === 'read' && extra === false) return 'read';
    return null;   // ยังตอบไม่ครบ
}

function openMethodModal(subjectId, grade) {
    pendingReview = { subjectId, grade, main: null, extra: null };
    renderMethodModal();
    openModal('methodModal');
}

function chooseMethodMain(main) {
    if (!pendingReview) return;
    pendingReview.main = main;
    if (main === 'test') pendingReview.extra = null;
    renderMethodModal();
}

function chooseMethodExtra(extra) {
    if (!pendingReview) return;
    pendingReview.extra = extra;
    renderMethodModal();
}

function renderMethodModal() {
    const p = pendingReview;
    if (!p) return;
    const s = subjects.find(x => x.id === p.subjectId);
    if (!s) { closeModal('methodModal'); return; }
    document.getElementById('methodModalSub').innerHTML = `${escapeHtml(s.name)} • ระดับที่ประเมิน: ${getGradeLabel(p.grade)}`;

    const opt = (selected, onclick, title, desc) => `
        <button type="button" onclick="${onclick}" class="w-full text-left p-3 rounded-xl border-2 flex items-start gap-3 transition-all ${selected ? 'border-emerald-600 bg-emerald-50' : 'border-slate-200 bg-white hover:bg-slate-50'}">
            <span class="mt-0.5 w-5 h-5 rounded-md border-2 flex-shrink-0 flex items-center justify-center ${selected ? 'bg-emerald-600 border-emerald-600 text-white' : 'border-slate-300 bg-white'}">${selected ? '<i data-lucide="check" class="w-3.5 h-3.5"></i>' : ''}</span>
            <span>
                <span class="block font-bold text-slate-800 text-sm">${title}</span>
                <span class="block text-[11px] text-slate-500 leading-snug mt-0.5">${desc}</span>
            </span>
        </button>`;

    let html = `
        <div class="space-y-2">
            <p class="font-bold text-slate-800 text-sm">1. ครั้งนี้คุณทำอะไรเป็นหลัก?</p>
            <div class="bg-amber-50 border border-amber-200 text-amber-900 rounded-lg p-2.5 text-[11px] leading-relaxed">
                เลือกอย่างที่ทำ<strong>มากกว่า</strong>:<br>
                • อ่านเยอะกว่าทำข้อสอบ → เลือก <strong>อ่าน/จำ</strong><br>
                • ทำข้อสอบเยอะกว่าอ่าน → เลือก <strong>ทำข้อสอบ</strong><br>
                • ถ้าทำอย่างใดอย่างหนึ่งล้วนๆ ก็เลือกอย่างนั้น
            </div>
            ${opt(p.main === 'read', "chooseMethodMain('read')", 'อ่าน / จำ', 'อ่านสรุป อ่านโน้ต ดูสไลด์ หรือท่องจำเนื้อหา')}
            ${opt(p.main === 'test', "chooseMethodMain('test')", 'ทำข้อสอบ / ทดสอบตัวเอง', 'ทำโจทย์ ทำข้อสอบเก่า หรือปิดโน้ตแล้วลองนึก/เขียนเอง ก่อนดูเฉลย')}
        </div>`;

    if (p.main === 'read') {
        html += `
        <div class="space-y-2">
            <p class="font-bold text-slate-800 text-sm">2. หลังอ่าน/จำเสร็จ ได้ทำข้อสอบต่อด้วยไหม?</p>
            ${opt(p.extra === false, 'chooseMethodExtra(false)', 'ไม่ได้ทำ', 'อ่าน/จำอย่างเดียว')}
            ${opt(p.extra === true, 'chooseMethodExtra(true)', 'ทำต่อ', 'อ่านเสร็จแล้วลองทำข้อสอบหรือทดสอบตัวเองต่อด้วย')}
        </div>`;
    }

    const method = methodFromChoice(p.main, p.extra);
    if (method) {
        const g = GRADE_MULT[p.grade] || GRADE_MULT.good;
        const m = METHOD_MULT[method];
        const eff = effectiveMultiplier(p.grade, method);
        const newS = applyGrade(s.S, p.grade, method);
        const why = {
            read: 'อ่านอย่างเดียวมักลืมเร็วกว่าการลองนึกเอง ระบบจึงเพิ่มค่า S ให้น้อยกว่า ครั้งหน้าลองทำข้อสอบต่อด้วยจะลืมช้าลง',
            read_test: 'ได้ทดสอบตัวเองหลังอ่าน ช่วยให้จำได้นานกว่าอ่านอย่างเดียว',
            test: 'การลองนึกเอง/ทำข้อสอบช่วยให้จำระยะยาวได้ดีที่สุด จึงใช้ตัวคูณเต็ม'
        }[method];
        html += `
        <div class="p-3 rounded-xl bg-emerald-50 border border-emerald-200 space-y-1">
            <div class="font-bold text-emerald-900 text-sm">ค่า S: ${formatDurationReadable(s.S)} → ${formatDurationReadable(newS)} (× ${eff.toFixed(2)})</div>
            <div class="text-[11px] text-emerald-800">= ตามระดับ × ${g.toFixed(2)} คูณ ตามวิธีทบทวน × ${m.toFixed(2)} (${METHOD_LABEL[method]})${(g * m) < 1 ? ' → ไม่ต่ำกว่า × 1.00' : ''}</div>
            <div class="text-[11px] text-slate-600">${why}</div>
        </div>`;
    }

    document.getElementById('methodModalBody').innerHTML = html;
    document.getElementById('methodConfirmBtn').disabled = !method;
    lucide.createIcons();
}

function submitMethodModal() {
    const p = pendingReview;
    if (!p) return;
    const method = methodFromChoice(p.main, p.extra);
    if (!method) return;
    pendingReview = null;
    closeModal('methodModal');
    recordStudySession(p.subjectId, p.grade, method);
}
/* Navigator to Quick Log Section Function */
function navigateToQuickLog() {
    switchTab('dashboard');
    setTimeout(() => {
        const el = document.getElementById('logCardSection');
        if (el) {
            el.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
    }, 100);
}

function renderPlanner() {
    const body = document.getElementById('plannerBody');
    const sel = document.getElementById('plannerSubject');
    if (!body || !sel) return;
    if (subjects.length === 0) {
        sel.innerHTML = '';
        body.innerHTML = '<p class="text-xs text-slate-400 py-4 text-center">ยังไม่ได้เพิ่มวิชาในระบบ</p>';
        return;
    }
    if (!plannerSubjectId || !subjects.find(s => s.id === plannerSubjectId)) plannerSubjectId = (subjects.find(s => s.goal) || subjects[0]).id;
    sel.innerHTML = subjects.map(s => `<option value="${s.id}" ${s.id === plannerSubjectId ? 'selected' : ''}>${escapeHtml(s.name)}${s.goal ? ' 🎯' : ''}</option>`).join('');
    document.getElementById('plannerGrade').value = plannerGrade;
    document.getElementById('plannerMethod').value = plannerMethod;
    const s = subjects.find(x => x.id === plannerSubjectId);
    if (!s.goal) {
        body.innerHTML = `<div class="p-6 text-center bg-slate-50 rounded-xl border border-dashed border-slate-300 space-y-2">
            <p class="text-sm font-bold text-slate-700">ยังไม่ได้ตั้งเป้าหมายสำหรับวิชานี้</p>
            <p class="text-xs text-slate-500">เช่น "สอบปลายภาคอีก 3 เดือน" หรือ "อยากจำให้ได้ 1 ปี"</p>
            <button onclick="openGoalModal('${s.id}')" class="px-4 py-2 bg-amber-500 hover:bg-amber-600 text-white rounded-lg text-xs font-medium">ตั้งเป้าหมาย</button></div>`;
        return;
    }
    const plan = buildReviewPlan(s, s.goal.at, plannerGrade, plannerMethod);
    if (plan.goalH <= 0) {
        body.innerHTML = `<div class="p-4 bg-slate-50 rounded-xl text-xs text-slate-600">เป้าหมาย "${escapeHtml(s.goal.name)}" ถึงกำหนดแล้ว <button onclick="openGoalModal('${s.id}')" class="text-amber-700 font-bold underline ml-1">ตั้งเป้าหมายใหม่</button></div>`;
        return;
    }
    const now = Date.now();
    const first = plan.reviews[0];
    const refGap = cepedaRatio(plan.goalH) * plan.goalH;
    const elapsed = getElapsedHours(s.lastReviewedAt);
    const dangerH = -elapsed + Math.LN2 * s.S;
    const idleLine = dangerH <= 0
        ? 'ความจำของวิชานี้ต่ำกว่า 50% แล้ว (อยู่ในเขตอันตราย) ควรทบทวนทันที'
        : `ถ้าไม่ทบทวนเลย ความจำจะต่ำกว่า 50% ในวันที่ <strong>${fmtDate(now + dangerH * 3600000, dangerH < 48)}</strong> (อีก ${formatDurationReadable(dangerH)}) หลังจากนั้นถือว่าอันตราย`;
    const cards = [
        ['เป้าหมาย', escapeHtml(s.goal.name), fmtDate(s.goal.at) + ' • อีก ' + formatDurationReadable(plan.goalH)],
        ['ต้องทบทวนทั้งหมด', plan.reviews.length + (plan.capped ? '+' : '') + ' ครั้ง', plan.reviews.length ? 'ก่อนถึงวันเป้าหมาย' : 'ตามแบบจำลอง ยังไม่ต้องทบทวนเพิ่ม'],
        ['ครั้งต่อไป', first ? (first.atH <= 0.05 ? 'ตอนนี้' : fmtDate(now + first.atH * 3600000, first.atH < 48)) : '-', first ? (first.atH <= 0.05 ? 'ถึงเวลาแล้ว' : 'อีก ' + formatDurationReadable(first.atH)) : ''],
        ['ความจำ ณ วันเป้าหมาย', Math.round(plan.Rgoal * 100) + '%', 'คาดการณ์ถ้าทำตามแผน']
    ].map(c => `<div class="p-3 rounded-xl border border-slate-200 bg-slate-50"><div class="text-[10px] text-slate-500">${c[0]}</div><div class="text-base font-bold text-slate-800 truncate">${c[1]}</div><div class="text-[11px] text-slate-500">${c[2]}</div></div>`).join('');

    const dot = (label, cls) => `<span class="absolute -left-[11px] top-0 w-5 h-5 rounded-full ${cls} text-white text-[10px] flex items-center justify-center font-bold">${label}</span>`;
    const chain = `
        <div class="relative pl-6 pb-4 border-l-2 border-slate-200 ml-2">${dot('✓', 'bg-slate-500')}
            <div class="text-xs text-slate-800"><span class="font-bold">ทบทวนล่าสุด:</span> ${fmtDate(new Date(s.lastReviewedAt).getTime(), true)}</div>
            <div class="text-[11px] text-slate-500">เริ่มนับแผนจากตรงนี้ (ค่า S = ${formatDurationReadable(s.S)})</div></div>` +
        plan.reviews.map(r => {
            const rec = r.atH <= 0.05 ? 'ตอนนี้' : fmtDate(now + r.atH * 3600000, r.atH < 48);
            const dl = r.dangerAtH <= 0 ? 'เลยกำหนดแล้ว' : fmtDate(now + r.dangerAtH * 3600000, r.dangerAtH < 48);
            const why = r.limitedBy === 'research' ? 'ระยะเว้นตามงานวิจัย' : 'ระยะเว้นตามความจำ (R ≈ 85%)';
            return `<div class="relative pl-6 pb-4 border-l-2 border-emerald-200 ml-2">${dot(r.n, 'bg-emerald-600')}
                <div class="text-xs text-slate-800"><span class="font-bold">ครั้งที่ ${r.n}:</span> แนะนำวันที่ <strong class="text-emerald-700">${rec}</strong> • <span class="text-rose-600">ไม่ควรเกินวันที่ <strong>${dl}</strong></span></div>
                <div class="text-[11px] text-slate-500">เว้นจากครั้งก่อน ${formatDurationReadable(r.gapH)} • ความจำก่อนทบทวนราว ${Math.round(r.Rbefore * 100)}% • ${why}</div></div>`;
        }).join('') +
        `<div class="relative pl-6 ml-2 border-l-2 border-transparent">${dot('🎯', 'bg-amber-500')}
            <div class="text-xs text-slate-800"><span class="font-bold">วันเป้าหมาย: ${escapeHtml(s.goal.name)}</span> ${fmtDate(s.goal.at)}</div>
            <div class="text-[11px] text-slate-500">คาดว่าจำได้ ${Math.round(plan.Rgoal * 100)}%</div></div>`;

    body.innerHTML = `
        <div class="grid grid-cols-2 lg:grid-cols-4 gap-3">${cards}</div>
        <div class="p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-xs text-emerald-900 leading-relaxed">
            <strong>งานวิจัย (Cepeda และคณะ, 2008):</strong> ถ้าอยากจำให้ได้นาน ${formatDurationReadable(plan.goalH)} ระยะเว้นครั้งแรกที่เหมาะสมคือราว <strong>${formatDurationReadable(refGap)}</strong> (${(cepedaRatio(plan.goalH) * 100).toFixed(1)}% ของเวลาทั้งหมด) แต่ระบบจะไม่ให้เว้นนานเกินกว่าที่ความจำของคุณ (ค่า S) รับไหว จึงอาจแนะนำให้ทบทวนถี่กว่านี้
        </div>
        <div class="p-3 rounded-xl bg-rose-50 border border-rose-200 text-xs text-rose-900">⚠ ${idleLine}</div>
        <div>
            <h4 class="text-sm font-bold text-slate-800 mb-1">ลำดับการทบทวนจนถึงเป้าหมาย</h4>
            <p class="text-[11px] text-slate-500 mb-3">นับต่อกันไปเรื่อยๆ: ถ้าทบทวนตามวันที่แนะนำทุกครั้ง ครั้งถัดไปจะเป็นวันที่ระบุ "ไม่ควรเกินวันที่" คือวันที่ความจำคาดว่าจะต่ำกว่า 50% เมื่อนับจากการทบทวนครั้งก่อน แผนจะคำนวณใหม่ทุกครั้งที่คุณกดบันทึก</p>
            ${chain}
        </div>
        ${plan.capped ? '<p class="text-[11px] text-amber-700">แผนยาวมาก แสดงสูงสุด 60 ครั้ง</p>' : ''}
        <details class="text-xs text-slate-600 bg-slate-50 border border-slate-200 rounded-xl p-3">
            <summary class="font-bold cursor-pointer text-slate-700">วิธีคำนวณแผนนี้ และข้อจำกัด</summary>
            <div class="mt-2 space-y-1 leading-relaxed">
                <p>1. สมมติว่าทบทวนทุกครั้งแล้วรู้สึก "${{hard: 'ยาก', good: 'ปานกลาง', easy: 'ง่าย'}[plannerGrade]}" และทบทวนด้วยวิธี "${METHOD_LABEL[plannerMethod]}" ค่า S จึงคูณ ${plan.mult.toFixed(2)} ทุกครั้ง (= ตัวคูณตามระดับ × ตัวคูณตามวิธีทบทวน ${METHOD_MULT[plannerMethod].toFixed(2)})</p>
                <p>2. ระยะเว้นแต่ละรอบ = ค่าที่น้อยกว่าระหว่าง (ก) เวลาที่ความจำลดถึง 85% คือ 0.1625 × S และ (ข) สัดส่วนจากงานวิจัยของเวลาที่เหลือถึงเป้าหมาย</p>
                <p>3. สัดส่วน (ข) อิง Cepeda และคณะ (2008) ที่พบว่าระยะเว้นที่ดีที่สุดอยู่ราว 20-40% ของเวลาที่อยากจำ (กรณี 1 สัปดาห์) และลดเหลือ 5-10% (กรณี 1 ปี) ระบบใช้ค่ากลาง 30% และ 7.5% แล้วเชื่อมกันแบบ log-interpolation (เป็นการประมาณ)</p>
                <p>4. หยุดวางแผนเมื่อคาดว่าความจำ ณ วันเป้าหมายยังเหลือ 85% ขึ้นไป</p>
                <p>5. "ไม่ควรเกินวันที่" และ "อันตราย" ใช้เกณฑ์ความจำต่ำกว่า 50% ซึ่งเป็นเกณฑ์ของแอปนี้</p>
                <p class="text-amber-800">ข้อจำกัด: งานของ Cepeda ศึกษาการเรียนข้อเท็จจริงและคำศัพท์ที่ทบทวน 2 รอบ ทดสอบสูงสุดประมาณ 1 ปี แผนหลายรอบและเป้าหมายที่เกิน 1 ปีหรือสั้นกว่า 1 สัปดาห์เป็นการต่อยอด/ประมาณ ไม่ใช่ผลทดลองโดยตรง ใช้เป็นแนวทางเท่านั้น</p>
            </div>
        </details>`;
}

function renderHomeGoals() {
    const c = document.getElementById('homeGoalsContainer');
    if (!c) return;
    const withGoal = subjects.filter(s => s.goal);
    if (withGoal.length === 0) {
        c.innerHTML = '<div class="col-span-full p-6 text-center text-xs text-slate-500 bg-slate-50 rounded-xl border border-dashed border-slate-300">ยังไม่มีเป้าหมาย กด "ตั้งเป้าหมาย" เพื่อให้ระบบวางแผนทบทวนให้</div>';
        return;
    }
    const now = Date.now();
    c.innerHTML = withGoal.map(s => {
        const plan = buildReviewPlan(s, s.goal.at, plannerGrade, plannerMethod);
        if (plan.goalH <= 0) return `<div class="p-4 rounded-xl border border-slate-200 text-xs"><div class="font-bold">${escapeHtml(s.name)}</div><div class="text-slate-500">เป้าหมาย "${escapeHtml(s.goal.name)}" ถึงกำหนดแล้ว</div><button onclick="openGoalModal('${s.id}')" class="mt-2 text-amber-700 font-bold underline">ตั้งใหม่</button></div>`;
        const f = plan.reviews[0];
        let next = 'ยังไม่ต้องทบทวนเพิ่ม';
        if (f) {
            const dl = f.dangerAtH <= 0 ? 'เลยกำหนดแล้ว' : fmtDate(now + f.dangerAtH * 3600000, f.dangerAtH < 48);
            next = (f.atH <= 0.05 ? '<span class="text-rose-600 font-bold">ถึงเวลาทบทวนแล้ว</span>' : 'แนะนำ ' + fmtDate(now + f.atH * 3600000, f.atH < 48)) + `<br><span class="text-rose-600">ไม่ควรเกิน ${dl}</span>`;
        }
        return `<div class="p-4 rounded-xl border border-amber-200 bg-amber-50/30 space-y-2 text-xs">
            <div class="text-[10px] text-slate-400">${escapeHtml(s.name)}</div>
            <div class="font-bold text-slate-800 text-sm">🎯 ${escapeHtml(s.goal.name)}</div>
            <div class="text-slate-600">วันที่ ${fmtDate(s.goal.at)} • อีก ${formatDurationReadable(plan.goalH)}</div>
            <div class="text-slate-700">ต้องทบทวน <strong>${plan.reviews.length}${plan.capped ? '+' : ''} ครั้ง</strong></div>
            <div class="text-slate-700">ครั้งต่อไป: ${next}</div>
            <button onclick="openPlanner('${s.id}')" class="w-full py-1.5 bg-emerald-700 hover:bg-emerald-800 text-white rounded-lg font-bold">ดูแผนทั้งหมดจนถึงเป้าหมาย</button></div>`;
    }).join('');
}

/* ===== Review log calendar (home only) ===== */
function updateClock() {
    const el = document.getElementById('liveClock');
    if (el) el.innerText = new Date().toLocaleString('th-TH', { dateStyle: 'full', timeStyle: 'medium' });
}

function tallyHtml(n) {
    if (!n) return '';
    const bars = Array.from({ length: Math.min(n, 8) }, () => '<span class="inline-block w-[2px] h-3 bg-emerald-700 mx-[1px] rounded-sm"></span>').join('');
    return bars + (n > 8 ? `<span class="text-[9px] text-emerald-800 ml-0.5">×${n}</span>` : '');
}

function calNav(delta) {
    const now = new Date();
    const next = new Date(calMonth.getFullYear(), calMonth.getMonth() + delta, 1);
    if (next > new Date(now.getFullYear(), now.getMonth(), 1)) return;
    calMonth = next;
    calSelected = null;
    renderReviewCalendar();
}

function calSelect(key) { calSelected = key; renderReviewCalendar(); }

function renderReviewCalendar() {
    const c = document.getElementById('reviewCalendar');
    if (!c) return;
    const now = new Date();
    if (!calMonth) calMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const y = calMonth.getFullYear(), m = calMonth.getMonth();
    const isCurrent = y === now.getFullYear() && m === now.getMonth();
    const todayKey = dayKey(now.getTime());
    if (!calSelected) calSelected = isCurrent ? todayKey : null;
    const counts = {};
    reviewLogs.forEach(l => { const k = dayKey(l.at); counts[k] = (counts[k] || 0) + 1; });
    const daysInMonth = new Date(y, m + 1, 0).getDate();
    const lead = new Date(y, m, 1).getDay();
    let cells = '';
    for (let b = 0; b < lead; b++) cells += '<div></div>';
    for (let d = 1; d <= daysInMonth; d++) {
        const date = new Date(y, m, d);
        const k = dayKey(date.getTime());
        const future = date.getTime() > now.getTime() && k !== todayKey;
        const isToday = k === todayKey;
        const sel = k === calSelected;
        cells += `<button ${future ? 'disabled' : `onclick="calSelect('${k}')"`} class="h-12 sm:h-14 rounded-lg border flex flex-col items-center justify-start pt-1 text-xs transition-colors ${future ? 'bg-slate-50 text-slate-300 border-slate-100 cursor-default' : 'bg-white hover:bg-emerald-50 border-slate-200 text-slate-700'} ${isToday ? 'ring-2 ring-sky-500' : ''} ${sel ? 'bg-emerald-50 border-emerald-400' : ''}">
            <span class="font-bold ${isToday ? 'text-sky-600' : ''}">${d}</span><span class="h-3 flex items-center">${tallyHtml(counts[k])}</span></button>`;
    }
    const wd = ['อา', 'จ', 'อ', 'พ', 'พฤ', 'ศ', 'ส'];
    let detail = '';
    if (calSelected) {
        const entries = reviewLogs.filter(l => dayKey(l.at) === calSelected).sort((a, b) => a.at - b.at);
        const canDelete = calSelected === todayKey;
        const gl = { again: 'ซ้ำอีกครั้ง', hard: 'ยาก', good: 'ปานกลาง', easy: 'ง่าย' };
        detail = `<div class="mt-3 p-3 rounded-xl bg-slate-50 border border-slate-200 text-xs space-y-1.5">
            <div class="font-bold text-slate-700">${calSelected === todayKey ? 'วันนี้' : 'รายการของวันที่เลือก'} • ${entries.length} ขีด</div>
            ${entries.length === 0 ? '<div class="text-slate-400">ยังไม่มีบันทึก</div>' : entries.map(l => `
                <div class="flex items-center justify-between gap-2 bg-white border border-slate-200 rounded-lg px-2.5 py-1.5">
                    <span><span class="font-mono text-slate-500">${new Date(l.at).toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' })}</span> • ${escapeHtml(l.subjectName)} • ${gl[l.grade] || l.grade}</span>
                    ${canDelete ? `<button onclick="deleteLog('${l.id}')" class="text-rose-500 hover:text-rose-700 font-bold flex items-center gap-1"><i data-lucide="trash-2" class="w-3.5 h-3.5"></i>ลบขีด</button>` : ''}
                </div>`).join('')}
            ${canDelete ? '<div class="text-[11px] text-slate-400">ลบได้เฉพาะรายการของวันนี้ การลบจะย้อนค่า S ของวิชานั้นกลับด้วย</div>' : '<div class="text-[11px] text-slate-400">รายการของวันที่ผ่านมาแก้ไขไม่ได้</div>'}
        </div>`;
    }
    c.innerHTML = `
        <div class="flex items-center justify-between mb-2">
            <button onclick="calNav(-1)" class="px-2 py-1 rounded-lg border border-slate-200 hover:bg-slate-50 text-xs">‹ ก่อนหน้า</button>
            <div class="font-bold text-sm text-slate-800">${calMonth.toLocaleDateString('th-TH', { month: 'long', year: 'numeric' })}</div>
            <button onclick="calNav(1)" ${isCurrent ? 'disabled' : ''} class="px-2 py-1 rounded-lg border border-slate-200 text-xs ${isCurrent ? 'text-slate-300 cursor-default' : 'hover:bg-slate-50'}">ถัดไป ›</button>
        </div>
        <div class="grid grid-cols-7 gap-1 text-center text-[10px] text-slate-400 mb-1">${wd.map(w => `<div>${w}</div>`).join('')}</div>
        <div class="grid grid-cols-7 gap-1">${cells}</div>${detail}`;
}

function openPlanner(id) { plannerSubjectId = id; switchTab('forecast'); renderPlanner(); }

function openGoalModal(subjectId) {
    if (subjects.length === 0) { showToast('เพิ่มวิชาก่อนจึงจะตั้งเป้าหมายได้', 'info'); return; }
    const sel = document.getElementById('goalSubject');
    sel.innerHTML = subjects.map(s => `<option value="${s.id}">${escapeHtml(s.name)}</option>`).join('');
    sel.value = subjectId || plannerSubjectId || subjects[0].id;
    if (!subjects.find(s => s.id === sel.value)) sel.value = subjects[0].id;
    const s = subjects.find(x => x.id === sel.value);
    document.getElementById('goalName').value = s.goal ? s.goal.name : '';
    const dEl = document.getElementById('goalDate');
    const today = new Date(); today.setHours(0, 0, 0, 0);
    const iso = d => d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
    dEl.min = iso(new Date(today.getTime() + 86400000));
    dEl.value = s.goal ? iso(new Date(s.goal.at)) : iso(new Date(today.getTime() + 30 * 86400000));
    document.getElementById('goalMode').value = 'date';
    toggleGoalMode();
    document.getElementById('goalDeleteBtn').classList.toggle('hidden', !s.goal);
    openModal('goalModal');
}
function toggleGoalMode() {
    const m = document.getElementById('goalMode').value;
    document.getElementById('goalDateWrap').classList.toggle('hidden', m !== 'date');
    document.getElementById('goalDurWrap').classList.toggle('hidden', m !== 'duration');
}
function handleGoalSubmit(e) {
    e.preventDefault();
    const s = subjects.find(x => x.id === document.getElementById('goalSubject').value);
    if (!s) return;
    let at;
    if (document.getElementById('goalMode').value === 'date') {
        const v = document.getElementById('goalDate').value;
        if (!v) return;
        at = new Date(v + 'T09:00:00').getTime();
    } else {
        const n = parseFloat(document.getElementById('goalDurN').value);
        if (!(n > 0)) return;
        at = Date.now() + n * parseFloat(document.getElementById('goalDurUnit').value) * 86400000;
    }
    if (at <= Date.now() + 3600000) { showToast('เป้าหมายต้องอยู่ในอนาคตอย่างน้อย 1 ชั่วโมง', 'info'); return; }
    s.goal = { name: document.getElementById('goalName').value.trim() || 'เป้าหมาย', at };
    plannerSubjectId = s.id;
    saveData(); updateAllViews(); closeModal('goalModal');
    showToast('บันทึกเป้าหมายแล้ว', 'success');
}
function deleteGoal() {
    const s = subjects.find(x => x.id === document.getElementById('goalSubject').value);
    if (!s || !confirm('ต้องการลบเป้าหมายนี้ใช่หรือไม่?')) return;
    delete s.goal;
    saveData(); updateAllViews(); closeModal('goalModal');
}

/* Master View Update Orchestrator */
function updateAllViews() {
    renderHomeTab();
    renderMetrics();
    renderSubjectCards();
    renderSubjectsTable();
    renderForecastList();
    renderMemoryHeatmap();
    renderMemoryHeatmap('homeHeatmapContainer');
    renderPlanner();
    renderHomeGoals();
    renderReviewCalendar();
    updateChart();
    lucide.createIcons();
}

/* Render Simple Mode Home Tab */
function renderHomeTab() {
    document.getElementById('simpleStatTotal').innerText = subjects.length;

    let urgentCount = 0;
    let totalS = 0;
    let earliestOptimalMs = Infinity;
    let earliestSubName = '--';

    const now = Date.now();

    if (subjects.length === 0) {
        document.getElementById('simpleHomeNextSubName').innerText = 'ยังไม่ได้เพิ่มวิชาในระบบ';
        document.getElementById('simpleHomeNextSubTime').innerText = '--:--';
        document.getElementById('simpleStatUrgent').innerText = '0';
        document.getElementById('simpleStatAvgS').innerText = '0 ชม.';

        return;
    }

    subjects.forEach(s => {
        const elapsed = getElapsedHours(s.lastReviewedAt);
        const R_frac = calculateRetentionFraction(elapsed, s.S);
        if (R_frac < 0.85) urgentCount++;

        totalS += s.S;

        const targetHoursTotal = getHoursUntilThreshold(s.S, 0.85);
        const remainingHours = targetHoursTotal - elapsed;
        const reviewTimeMs = now + (remainingHours * 3600 * 1000);

        if (reviewTimeMs < earliestOptimalMs) {
            earliestOptimalMs = reviewTimeMs;
            earliestSubName = s.name;
        }
    });

    document.getElementById('simpleStatUrgent').innerText = urgentCount;
    const avgS = subjects.length > 0 ? (totalS / subjects.length) : 0;
    document.getElementById('simpleStatAvgS').innerText = formatDurationReadable(avgS);

    document.getElementById('simpleHomeNextSubName').innerText = earliestSubName;
    if (earliestOptimalMs <= now) {
        document.getElementById('simpleHomeNextSubTime').innerText = 'ถึงเวลาทบทวนแล้ว!';
    } else {
        document.getElementById('simpleHomeNextSubTime').innerText = formatCountdown(earliestOptimalMs - now);
    }

}

function renderMetrics() {
    document.getElementById('statTotalSubjects').innerText = subjects.length;

    let criticalCount = 0;
    let totalS = 0;
    let earliestOptimalMs = Infinity;
    let earliestSubName = '--';

    const now = Date.now();

    subjects.forEach(s => {
        const elapsed = getElapsedHours(s.lastReviewedAt);
        const R_frac = calculateRetentionFraction(elapsed, s.S);
        if (R_frac < 0.50) criticalCount++;

        totalS += s.S;

        const targetHoursTotal = getHoursUntilThreshold(s.S, 0.85);
        const remainingHours = targetHoursTotal - elapsed;
        const reviewTimeMs = now + (remainingHours * 3600 * 1000);

        if (reviewTimeMs < earliestOptimalMs) {
            earliestOptimalMs = reviewTimeMs;
            earliestSubName = s.name;
        }
    });

    document.getElementById('statCriticalSubjects').innerText = criticalCount;
    
    const avgS = subjects.length > 0 ? (totalS / subjects.length) : 0;
    document.getElementById('statAvgStrength').innerText = formatDurationReadable(avgS);

    const subElem = document.getElementById('statNextReviewSub');
    const timeElem = document.getElementById('statNextReviewTime');

    if (subjects.length === 0) {
        subElem.innerText = 'ยังไม่ได้เพิ่มวิชาในระบบ';
        timeElem.innerText = '--:--';
    } else {
        subElem.innerText = earliestSubName;
        if (earliestOptimalMs <= now) {
            timeElem.innerText = 'ถึงเวลาทบทวนแล้ว';
        } else {
            timeElem.innerText = formatCountdown(earliestOptimalMs - now);
        }
    }
}

function renderSubjectCards() {
    const container = document.getElementById('subjectCardsGrid');
    if (subjects.length === 0) {
        container.innerHTML = `
            <div class="col-span-full py-8 text-center text-slate-400 text-xs bg-white rounded-xl border border-dashed border-slate-300 space-y-2">
                <p class="font-medium text-slate-600">ยังไม่ได้เพิ่มวิชาในระบบ</p>
                <button onclick="openModal('addSubjectModal')" class="px-3 py-1.5 bg-emerald-700 text-white text-xs font-medium rounded-lg inline-flex items-center gap-1">
                    <i data-lucide="plus" class="w-3.5 h-3.5"></i>
                    <span>เพิ่มวิชาแรกของคุณ</span>
                </button>
            </div>`;
        lucide.createIcons();
        return;
    }

    container.innerHTML = subjects.map(s => {
        const elapsed = getElapsedHours(s.lastReviewedAt);
        const R_frac = calculateRetentionFraction(elapsed, s.S);
        const R_percent = (R_frac * 100).toFixed(1);
        const stateObj = getMemoryState(R_frac);
        const currentGrade = selectedGrades[s.id] || 'good';

        let cardBorder = 'border-slate-200/80';
        if (stateObj.code === 'DECAYING') cardBorder = 'border-orange-200 bg-orange-50/10';
        if (stateObj.code === 'LOST') cardBorder = 'border-rose-200 bg-rose-50/20';
        if (stateObj.code === 'OPTIMAL') cardBorder = 'border-teal-300 bg-teal-50/20';

        return `
            <div class="bg-white p-4 rounded-xl border ${cardBorder} shadow-sm space-y-3 relative overflow-hidden">
                <div class="flex items-start justify-between gap-2">
                    <div>
                        <span class="text-[10px] font-medium text-slate-400 uppercase tracking-wider">${escapeHtml(s.category || 'วิชาทั่วไป')}</span>
                        <h3 class="font-bold text-slate-800 text-sm leading-snug mt-0.5">${escapeHtml(s.name)}</h3>
                    </div>
                    <span class="px-2 py-0.5 text-[10px] rounded border ${stateObj.badgeClass}">${stateObj.label}</span>
                </div>

                <!-- Retention gauge bar -->
                <div class="space-y-1">
                    <div class="flex justify-between text-xs">
                        <span class="text-slate-500 font-medium">ความจำที่เหลือ (ค่า R)</span>
                        <span class="font-mono font-bold ${R_frac < 0.50 ? 'text-rose-600 font-extrabold' : R_frac < 0.75 ? 'text-amber-600' : 'text-slate-800'}">R = ${R_frac.toFixed(2)} (${R_percent}%)</span>
                    </div>
                    <div class="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
                        <div class="h-full ${R_frac < 0.50 ? 'bg-rose-600' : R_frac < 0.75 ? 'bg-amber-500' : R_frac < 0.85 ? 'bg-teal-500' : 'bg-emerald-500'} transition-all duration-500" style="width: ${R_percent}%"></div>
                    </div>
                </div>

                <div class="bg-slate-50 p-2 rounded-lg text-[11px] text-slate-600 space-y-0.5 border border-slate-100">
                    <div class="font-semibold text-slate-700">คำแนะนำ: <span class="text-emerald-700">${stateObj.recommendation}</span></div>
                    <div class="text-[10px] text-slate-400">${stateObj.desc}</div>
                </div>

                <div class="flex items-center justify-between text-[11px] text-slate-500 pt-1 border-t border-slate-100">
                    <span>ความแข็งแรงความจำ (ค่า S): <strong class="text-emerald-700 font-bold">${formatDurationReadable(s.S)}</strong></span>
                    <span class="text-[10px] text-slate-400">ยิ่งสูงยิ่งลืมช้า</span>
                </div>

                <!-- Quick Log / Assessment Box with Honesty Notice & Confirmation Button -->
                <div class="pt-2 border-t border-slate-100 space-y-2">
                    <div class="bg-amber-50 border border-amber-200 text-amber-800 rounded-lg p-2 text-[11px] flex items-center gap-1.5 font-medium">
                        <i data-lucide="shield-alert" class="w-3.5 h-3.5 text-amber-600 flex-shrink-0"></i>
                        <span>โปรดประเมินตามความรู้สึกจริง เพื่อให้ผลแม่นยำขึ้น</span>
                    </div>

                    <div class="flex items-center justify-between">
                        <p class="text-[10px] font-bold text-slate-700">ประเมินการทบทวน:</p>
                        <span class="text-[9px] text-emerald-700 font-medium">ระดับ: ${getGradeLabel(currentGrade)}</span>
                    </div>

                    <div class="grid grid-cols-2 min-[420px]:grid-cols-4 gap-1.5 text-[11px]">
                        <button onclick="selectGrade('${s.id}', 'again')" title="จำไม่ได้ / ตอบผิด (รีเซ็ต S เหลือ 1 ชม.)" class="py-2.5 min-[420px]:py-1.5 px-1 rounded border text-center transition-all ${currentGrade === 'again' ? 'bg-rose-600 text-white border-rose-700 shadow-sm' : 'bg-rose-50 text-rose-700 hover:bg-rose-100 border-rose-200'}">
                            <div class="font-bold text-[10px]">ซ้ำอีกครั้ง</div>
                            <div class="text-[9px] font-mono opacity-90">รีเซ็ต</div>
                        </button>
                        <button onclick="selectGrade('${s.id}', 'hard')" title="จำได้แต่ยากมาก (คูณ 1.2x)" class="py-2.5 min-[420px]:py-1.5 px-1 rounded border text-center transition-all ${currentGrade === 'hard' ? 'bg-amber-500 text-white border-amber-600 shadow-sm' : 'bg-amber-50 text-amber-700 hover:bg-amber-100 border-amber-200'}">
                            <div class="font-bold text-[10px]">ยาก</div>
                            <div class="text-[9px] font-mono opacity-90">1.2x</div>
                        </button>
                        <button onclick="selectGrade('${s.id}', 'good')" title="จำได้ดีปกติ (คูณ 2.5x)" class="py-2.5 min-[420px]:py-1.5 px-1 rounded border text-center transition-all ${currentGrade === 'good' ? 'bg-blue-600 text-white border-blue-700 shadow-sm' : 'bg-blue-50 text-blue-700 hover:bg-blue-100 border-blue-200'}">
                            <div class="font-bold text-[10px]">ปานกลาง</div>
                            <div class="text-[9px] font-mono opacity-90">2.5x</div>
                        </button>
                        <button onclick="selectGrade('${s.id}', 'easy')" title="จำได้แม่นยำมาก (คูณ 3.25x)" class="py-2.5 min-[420px]:py-1.5 px-1 rounded border text-center transition-all ${currentGrade === 'easy' ? 'bg-emerald-600 text-white border-emerald-700 shadow-sm' : 'bg-emerald-50 text-emerald-800 hover:bg-emerald-100 border-emerald-200'}">
                            <div class="font-bold text-[10px]">ง่าย</div>
                            <div class="text-[9px] font-mono opacity-90">3.25x</div>
                        </button>
                    </div>

                    <p class="text-[10px] text-slate-400 text-center">กดยืนยันแล้วระบบจะถามต่ออีก 1-2 ข้อ: ทบทวนด้วยวิธีไหน (อ่าน / ทำข้อสอบ)</p>
                    <button onclick="confirmRecordStudySession('${s.id}')" class="w-full py-2.5 sm:py-2 bg-emerald-700 hover:bg-emerald-800 active:bg-emerald-900 text-white font-bold text-xs rounded-lg transition-all flex items-center justify-center space-x-1.5 shadow-sm cursor-pointer">
                        <i data-lucide="check-circle" class="w-4 h-4"></i>
                        <span>ยืนยันการบันทึก</span>
                    </button>
                </div>
            </div>
        `;
    }).join('');
    
    lucide.createIcons();
}

function renderSubjectsTable() {
    const tbody = document.getElementById('subjectsTableBody');
    if (!tbody) return;
    if (subjects.length === 0) {
        tbody.innerHTML = `<tr><td colspan="6" class="p-6 text-center text-slate-400">ยังไม่ได้เพิ่มรายวิชาในระบบ</td></tr>`;
        return;
    }

    tbody.innerHTML = subjects.map(s => {
        const elapsed = getElapsedHours(s.lastReviewedAt);
        const R_frac = calculateRetentionFraction(elapsed, s.S);
        const R_percent = (R_frac * 100).toFixed(1);
        const stateObj = getMemoryState(R_frac);
        const lastDate = new Date(s.lastReviewedAt).toLocaleString('th-TH', { dateStyle: 'short', timeStyle: 'short' });

        return `
            <tr class="hover:bg-slate-50/80">
                <td class="p-3 font-medium text-slate-800">${escapeHtml(s.name)}</td>
                <td class="p-3 text-slate-500">${escapeHtml(s.category || '-')}</td>
                <td class="p-3 font-mono font-semibold text-emerald-700">${formatDurationReadable(s.S)}</td>
                <td class="p-3 text-slate-500">${lastDate}</td>
                <td class="p-3">
                    <span class="font-mono font-bold text-xs ${R_frac < 0.50 ? 'text-rose-600 font-extrabold' : 'text-slate-800'}">R=${R_frac.toFixed(2)} (${R_percent}%)</span>
                    <span class="ml-2 px-1.5 py-0.5 text-[9px] rounded border ${stateObj.badgeClass}">${stateObj.label}</span>
                </td>
                <td class="p-3 text-right">
                    <button onclick="deleteSubject('${s.id}')" class="text-rose-500 hover:text-rose-700 p-1 rounded">
                        <i data-lucide="trash-2" class="w-4 h-4"></i>
                    </button>
                </td>
            </tr>
        `;
    }).join('');
    
    lucide.createIcons();
}

function renderForecastList() {
    const container = document.getElementById('forecastListContainer');
    if (!container) return;
    
    const sorted = [...subjects].sort((a, b) => {
        const Ra = calculateRetentionFraction(getElapsedHours(a.lastReviewedAt), a.S);
        const Rb = calculateRetentionFraction(getElapsedHours(b.lastReviewedAt), b.S);
        return Ra - Rb;
    });

    if (sorted.length === 0) {
        container.innerHTML = `<p class="text-xs text-slate-400 py-4 text-center">ยังไม่ได้เพิ่มรายวิชาในระบบ</p>`;
        return;
    }

    container.innerHTML = sorted.map((s, index) => {
        const elapsed = getElapsedHours(s.lastReviewedAt);
        const R_frac = calculateRetentionFraction(elapsed, s.S);
        const R_percent = (R_frac * 100).toFixed(1);
        const stateObj = getMemoryState(R_frac);

        return `
            <div class="p-3.5 rounded-xl border border-slate-200 bg-white flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
                <div class="flex items-center space-x-3">
                    <div class="w-7 h-7 rounded-full bg-slate-100 font-bold text-slate-600 flex items-center justify-center text-xs flex-shrink-0">
                        ${index + 1}
                    </div>
                    <div>
                        <div class="flex items-center space-x-2">
                            <h4 class="font-bold text-slate-800">${escapeHtml(s.name)}</h4>
                            <span class="px-2 py-0.5 text-[10px] rounded border ${stateObj.badgeClass}">${stateObj.label}</span>
                        </div>
                        <p class="text-[11px] text-slate-500 mt-0.5">ผ่านไป: ${formatDurationReadable(elapsed)} | ความแข็งแรงความจำ (ค่า S): <strong class="text-emerald-700">${formatDurationReadable(s.S)}</strong></p>
                    </div>
                </div>

                <div class="flex items-center justify-between sm:justify-end space-x-4">
                    <div class="text-right">
                        <span class="block text-[10px] text-slate-400">ความจำที่เหลือ</span>
                        <span class="font-mono font-bold text-sm ${R_frac < 0.50 ? 'text-rose-600 font-extrabold' : 'text-slate-800'}">R = ${R_frac.toFixed(2)} (${R_percent}%)</span>
                    </div>
                    <button onclick="confirmRecordStudySession('${s.id}')" class="px-3 py-1.5 bg-emerald-700 text-white rounded-lg hover:bg-emerald-800 font-medium text-xs flex items-center space-x-1 cursor-pointer">
                        <i data-lucide="check-circle-2" class="w-3.5 h-3.5"></i>
                        <span>ยืนยันบันทึก</span>
                    </button>
                </div>
            </div>
        `;
    }).join('');

    lucide.createIcons();
}

/* Event Handlers & LocalStorage */
function handleAddSubject(e) {
    e.preventDefault();
    const name = document.getElementById('subjectNameInput').value.trim();
    const category = document.getElementById('subjectCategoryInput').value.trim();

    if (!name) return;

    const colors = ['#2563eb', '#16a34a', '#9333ea', '#ea580c', '#0891b2', '#d97706'];
    const randomColor = colors[Math.floor(Math.random() * colors.length)];

    const newSub = {
        id: 'sub-' + Date.now(),
        name: name,
        category: category || 'วิชาทั่วไป',
        S: INITIAL_S,   // ระบบกำหนดให้อัตโนมัติ (ดู config.js)
        lastReviewedAt: new Date().toISOString(),
        color: randomColor
    };

    subjects.unshift(newSub);
    saveData();
    updateAllViews();
    closeModal('addSubjectModal');
    document.getElementById('addSubjectForm').reset();
    showToast(`เพิ่มวิชา "${name}" เรียบร้อยแล้ว`, 'success');
}

function switchTab(tabId) {
    const tabs = ['home', 'dashboard', 'subjects', 'forecast', 'formula'];
    tabs.forEach(t => {
        const el = document.getElementById(`tab-${t}`);
        const nav = document.getElementById(`nav-${t}`);
        if (el) el.classList.add('hidden');
        if (nav) {
            nav.classList.remove('text-emerald-800', 'bg-emerald-50');
            nav.classList.add('text-slate-600');
        }
    });

    const activeTab = document.getElementById(`tab-${tabId}`);
    const activeNav = document.getElementById(`nav-${tabId}`);
    if (activeTab) activeTab.classList.remove('hidden');
    if (activeNav) {
        activeNav.classList.add('text-emerald-800', 'bg-emerald-50');
        activeNav.classList.remove('text-slate-600');
    }

    const titles = {
        'home': 'หน้าแรก - สรุปแผนการทบทวนอย่างง่าย',
        'dashboard': 'ภาพรวมความจำเชิงลึก',
        'subjects': 'รายการวิชาทั้งหมดในระบบ',
        'forecast': 'ตารางคาดการณ์ความจำในอนาคต',
        'formula': 'คู่มือ: ตัวแปรและวิธีคำนวณ'
    };
    document.getElementById('pageTitle').innerText = titles[tabId] || 'SproutS Dashboard';
    if (window.innerWidth < 768) setMobileSidebar(false);

    if (tabId === 'forecast') {
        renderMemoryHeatmap();
    }
}

function openModal(modalId) {
    document.getElementById(modalId).classList.remove('hidden');
}

function closeModal(modalId) {
    document.getElementById(modalId).classList.add('hidden');
}

function toggleAuthMode() {
    isAuthSignUp = !isAuthSignUp;
    document.getElementById('authModalTitle').innerText = isAuthSignUp ? 'สมัครสมาชิกใหม่' : 'เข้าสู่ระบบใช้งาน';
    document.getElementById('authSubmitBtn').innerText = isAuthSignUp ? 'ลงทะเบียน' : 'เข้าสู่ระบบ';
    document.getElementById('authToggleText').innerText = isAuthSignUp ? 'มีบัญชีอยู่แล้ว?' : 'ยังไม่มีบัญชี?';
    document.getElementById('authToggleBtn').innerText = isAuthSignUp ? 'เข้าสู่ระบบที่นี่' : 'สมัครสมาชิกที่นี่';
}

function handleAuthSubmit(e) {
    e.preventDefault();
    const email = document.getElementById('authEmail').value;
    currentUser = { email: email };
    document.getElementById('authButtonText').innerText = email.split('@')[0];
    closeModal('authModal');
    showToast(`แสดงชื่อ ${email} แล้ว (เดโม: ข้อมูลเก็บในเครื่องนี้เท่านั้น)`, 'info');
}

function showToast(message, type = 'info') {
    const container = document.getElementById('toastContainer');
    const toast = document.createElement('div');
    const bgClass = type === 'success' ? 'bg-emerald-800 text-white' : 'bg-slate-800 text-white';

    toast.className = `p-3 rounded-xl shadow-lg text-xs font-medium ${bgClass} transition-all transform translate-y-2 pointer-events-auto flex items-center space-x-2`;
    toast.innerHTML = `<span>${escapeHtml(message)}</span>`;

    container.appendChild(toast);
    setTimeout(() => {
        toast.classList.add('opacity-0', 'translate-y-4');
        setTimeout(() => toast.remove(), 300);
    }, 3000);
}

function startRealtimeTimer() {
    setInterval(() => {
        countdownSec--;
        if (countdownSec <= 0) {
            countdownSec = 30;
            updateAllViews();
        }
        const el = document.getElementById('countdownTimer');
        if (el) el.innerText = countdownSec;
    }, 1000);
}

// Sidebar Handlers (เดสก์ท็อป = ย่อ/ขยาย, มือถือ = เปิด/ปิดเป็นลิ้นชัก)
function setMobileSidebar(open) {
    const sidebar = document.getElementById('sidebar');
    const backdrop = document.getElementById('sidebarBackdrop');
    if (open && sidebar.classList.contains('w-16')) {
        // ถ้าเคยย่อไว้ตอนใช้เดสก์ท็อป ให้กลับเป็นแบบเต็มบนมือถือ
        sidebar.classList.remove('w-16'); sidebar.classList.add('w-64');
        document.querySelectorAll('.sidebar-text').forEach(el => el.classList.remove('hidden'));
    }
    sidebar.classList.toggle('-translate-x-full', !open);
    if (backdrop) backdrop.classList.toggle('hidden', !open);
}

document.getElementById('toggleSidebar').addEventListener('click', () => {
    if (window.innerWidth < 768) { setMobileSidebar(false); return; }
    const sidebar = document.getElementById('sidebar');
    sidebar.classList.toggle('w-64');
    sidebar.classList.toggle('w-16');
    document.querySelectorAll('.sidebar-text').forEach(el => el.classList.toggle('hidden'));
});

document.getElementById('mobileSidebarToggle').addEventListener('click', () => {
    const sidebar = document.getElementById('sidebar');
    setMobileSidebar(sidebar.classList.contains('-translate-x-full'));
});

document.getElementById('sidebarBackdrop').addEventListener('click', () => setMobileSidebar(false));

/* ===== คำนวณย้อนหลังตอนปิดเว็บ (offline) + สรุป "ยินดีต้อนรับกลับ" ===== */
function showOfflineReport(prevSeenAt) {
    if (!prevSeenAt || subjects.length === 0) return;
    const now = Date.now();
    if (now - prevSeenAt < OFFLINE_MIN_GAP_MIN * 60000) return;
    renderOfflineModal(buildOfflineReport(prevSeenAt, now), prevSeenAt);
    openModal('offlineModal');
}

function renderOfflineModal(report, prevSeenAt) {
    document.getElementById('offlineSummary').innerHTML =
        `คุณไม่ได้เปิดแอปมา <strong>${formatAwayTime(report.gapMs)}</strong> (ตั้งแต่ ${fmtDate(prevSeenAt, true)}) ` +
        `ระบบหักเวลาที่ผ่านไปออกจากความจำของแต่ละวิชาให้แล้ว นี่คือสิ่งที่เปลี่ยนไป:`;

    document.getElementById('offlineList').innerHTML = report.items.map(it => {
        const st = getMemoryState(it.Rnow);
        const before = Math.round(it.Rbefore * 100), now = Math.round(it.Rnow * 100);
        const drop = before - now;
        const due = it.dueInH <= 0
            ? `<span class="text-rose-600 font-bold">ถึงเวลาทบทวนแล้ว (เลยมา ${formatDurationReadable(-it.dueInH)})</span>`
            : `<span class="text-slate-600">ถึงจุดทบทวนในอีก ${formatDurationReadable(it.dueInH)}</span>`;
        return `
            <div class="p-3 rounded-xl border border-slate-200 bg-white space-y-1.5">
                <div class="flex items-start justify-between gap-2">
                    <div class="font-bold text-slate-800 text-sm leading-snug">${escapeHtml(it.name)}</div>
                    <span class="px-2 py-0.5 text-[10px] rounded border flex-shrink-0 ${st.badgeClass}">${st.label}</span>
                </div>
                <div class="flex items-center gap-2 text-xs">
                    <span class="font-mono text-slate-500">${before}%</span>
                    <span class="text-slate-400">→</span>
                    <span class="font-mono font-bold ${it.Rnow < 0.5 ? 'text-rose-600' : 'text-slate-800'}">${now}%</span>
                    <span class="text-[11px] text-slate-400">${drop > 0 ? '(ลดลง ' + drop + ' จุด)' : '(เท่าเดิม)'}</span>
                </div>
                <div class="text-[11px]">${due}</div>
            </div>`;
    }).join('');
    lucide.createIcons();
}

function initOfflineTracking() {
    saveLastSeen();
    // เก็บเวลา "ล่าสุดที่เปิดดูแอป" ทุก 5 วินาทีเฉพาะตอนที่หน้าจอแสดงอยู่
    setInterval(() => { if (document.visibilityState === 'visible') saveLastSeen(); }, 5000);

    document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'hidden') {
            saveLastSeen();                       // สลับแอป/ปิดจอ/สลับแท็บ
        } else {
            const prev = loadLastSeen();          // กลับมาเปิดอีกครั้ง: ตัวจับเวลาอาจหยุดไปตอนอยู่เบื้องหลัง
            updateAllViews();
            showOfflineReport(prev);
            saveLastSeen();
        }
    });
    window.addEventListener('pagehide', () => { if (document.visibilityState === 'visible') saveLastSeen(); });
}

/* Window Initialization */
window.onload = function() {
    lucide.createIcons();
    loadData();
    const prevSeenAt = loadLastSeen();   // อ่านก่อนที่จะถูกเขียนทับด้วยเวลาปัจจุบัน
    const initLabel = document.getElementById('initialSLabel');
    if (initLabel) initLabel.innerText = formatDurationReadable(INITIAL_S);
    initChart();
    switchTab('home');
    updateAllViews();
    startRealtimeTimer();
    updateClock();
    setInterval(updateClock, 1000);
    showOfflineReport(prevSeenAt);       // สรุปการลืมช่วงที่ปิดเว็บ (ถ้าห่างเกินกำหนด)
    initOfflineTracking();
};
