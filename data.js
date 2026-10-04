/* ============================================================
 * data.js
 * การจัดการข้อมูล: State, ข้อมูลตั้งต้น, CRUD, LocalStorage
 * ============================================================ */

/* State & Initial Data */
let subjects = [
    {
        id: 'sub-1',
        name: 'ฟิสิกส์ - บทที่ 3 คลื่นกล',
        category: 'วิทยาศาสตร์',
        S: 28,
        lastReviewedAt: new Date(Date.now() - 10 * 3600 * 1000).toISOString(),
        color: '#2563eb'
    },
    {
        id: 'sub-2',
        name: 'ชีววิทยา - ระบบประสาท',
        category: 'วิทยาศาสตร์',
        S: 18,
        lastReviewedAt: new Date(Date.now() - 14 * 3600 * 1000).toISOString(),
        color: '#16a34a'
    },
    {
        id: 'sub-3',
        name: 'คำศัพท์ภาษาอังกฤษ TOEFL Set 1',
        category: 'ภาษาต่างประเทศ',
        S: 48,
        lastReviewedAt: new Date(Date.now() - 22 * 3600 * 1000).toISOString(),
        color: '#9333ea'
    },
    {
        id: 'sub-4',
        name: 'คณิตศาสตร์ - แคลคูลัส อนุพันธ์',
        category: 'คณิตศาสตร์',
        S: 12,
        lastReviewedAt: new Date(Date.now() - 11 * 3600 * 1000).toISOString(),
        color: '#ea580c'
    }
];

let selectedGrades = {}; // Stores temporary grade selections before confirmation
let currentUser = null;
let isAuthSignUp = false;
let retentionChartInstance = null;
let countdownSec = 30;

/* Record Study & Dynamic S Scaling */
function recordStudySession(subjectId, grade, method) {
    const subject = subjects.find(s => s.id === subjectId);
    if (!subject) return;

    const at = Date.now();
    const prevS = subject.S, prevLast = subject.lastReviewedAt;
    const m = grade === 'again' ? null : (method || 'test');
    const newS = applyGrade(prevS, grade, m);
    subject.S = newS;
    subject.lastReviewedAt = new Date(at).toISOString();
    reviewLogs.push({ id: 'log-' + at + '-' + Math.random().toString(36).slice(2, 6), subjectId, subjectName: subject.name, at, grade, method: m, prevS, prevLast, newS });
    delete selectedGrades[subjectId];

    saveData();
    updateAllViews();
    showToast(`บันทึกการทบทวน "${subject.name}" สำเร็จ (ความแข็งแรงความจำ S ใหม่: ${formatDurationReadable(subject.S)})`, 'success');
}
let plannerSubjectId = null, plannerGrade = 'good', plannerMethod = 'read_test';
let pendingReview = null;   // ข้อมูลชั่วคราวระหว่างตอบคำถามวิธีทบทวน { subjectId, grade, main, extra }
const LAST_SEEN_KEY = 'unforgetting_lastSeen';
let reviewLogs = [];
let calMonth = null, calSelected = null;

function deleteLog(id) {
    const e = reviewLogs.find(l => l.id === id);
    if (!e) return;
    if (dayKey(e.at) !== dayKey(Date.now())) { showToast('ลบได้เฉพาะรายการของวันนี้', 'info'); return; }
    if (!confirm('ลบขีดนี้ และย้อนค่า S ของวิชานี้กลับ ใช่หรือไม่?')) return;
    reviewLogs = reviewLogs.filter(l => l.id !== id);
    const s = subjects.find(x => x.id === e.subjectId);
    if (s) {
        let S = e.prevS, last = e.prevLast;
        reviewLogs.filter(l => l.subjectId === e.subjectId && l.at > e.at).sort((a, b) => a.at - b.at).forEach(l => {
            l.prevS = S; l.prevLast = last;
            S = applyGrade(S, l.grade, l.method); l.newS = S;
            last = new Date(l.at).toISOString();
        });
        s.S = S; s.lastReviewedAt = last;
    }
    saveData(); updateAllViews();
    showToast('ลบขีดและย้อนค่า S แล้ว', 'info');
}

function deleteSubject(id) {
    if (!confirm('ต้องการลบวิชานี้ (รวมขีดบันทึกของวิชานี้) ใช่หรือไม่?')) return;
    delete selectedGrades[id];
    subjects = subjects.filter(s => s.id !== id);
    reviewLogs = reviewLogs.filter(l => l.subjectId !== id);
    saveData();
    updateAllViews();
    showToast('ลบวิชาเรียบร้อยแล้ว', 'info');
}

function saveData() {
    try {
        localStorage.setItem('unforgetting_subjects', JSON.stringify(subjects));
        localStorage.setItem('unforgetting_logs', JSON.stringify(reviewLogs));
    } catch (err) {
        console.error('LocalStorage write error', err);
    }
}

function loadData() {
    try {
        try {
            const L = JSON.parse(localStorage.getItem('unforgetting_logs') || '[]');
            if (Array.isArray(L)) reviewLogs = L.filter(l => l && l.id && l.subjectId && l.at > 0);
        } catch (e2) { reviewLogs = []; }
        const stored = localStorage.getItem('unforgetting_subjects');
        if (stored) {
            const parsed = JSON.parse(stored);
            if (Array.isArray(parsed)) subjects = parsed.filter(s => s && s.id && s.name && Number(s.S) > 0 && s.lastReviewedAt).map(s => { if (s.goal && !(s.goal.at > 0)) delete s.goal; return s; });
        } else {
            // เปิดครั้งแรก: เก็บวิชาตัวอย่างพร้อมเวลาจริงไว้เลย เพื่อให้การนับเวลาตอนปิดเว็บแม่นยำ
            saveData();
        }
    } catch (err) {
        console.error('LocalStorage read error', err);
    }
}

/* ===== เวลาที่เปิดแอปล่าสุด (ใช้คำนวณย้อนหลังตอนปิดเว็บ) ===== */
function saveLastSeen() {
    try { localStorage.setItem(LAST_SEEN_KEY, String(Date.now())); } catch (err) { /* ignore */ }
}

function loadLastSeen() {
    try {
        const v = Number(localStorage.getItem(LAST_SEEN_KEY));
        return v > 0 && v <= Date.now() ? v : null;
    } catch (err) { return null; }
}
