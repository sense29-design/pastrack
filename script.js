// --- Security PIN & Auth Protection ---
const CORRECT_PIN = "2026"; // Default PIN

function checkSession() {
    if (sessionStorage.getItem('yfc_authenticated') === 'true') {
        document.getElementById('pinModal').classList.add('hidden');
    } else {
        document.getElementById('pinModal').classList.remove('hidden');
    }
}

function verifyPin(e) {
    e.preventDefault();
    const input = document.getElementById('pinInput').value;
    if (input === CORRECT_PIN) {
        sessionStorage.setItem('yfc_authenticated', 'true');
        document.getElementById('pinModal').classList.add('hidden');
        document.getElementById('pinError').classList.add('hidden');
    } else {
        document.getElementById('pinError').classList.remove('hidden');
    }
}

function logoutSession() {
    sessionStorage.removeItem('yfc_authenticated');
    document.getElementById('pinInput').value = '';
    checkSession();
}

checkSession();

// --- Body scroll lock while any modal is open ---
// Every overlay in this app uses an id ending in "Modal" (pinModal,
// formationModal, addModal, confirmModal, formationMembersModal, etc.).
// Whenever ANY of them is visible (has the "flex" class the open/close
// functions toggle), the page behind it should stop scrolling — instead of
// only the modal panel itself scrolling. A MutationObserver watches every
// modal's class attribute so this works automatically for every current
// and future modal, without having to edit each individual open/close
// function.
function isAnyModalOpen() {
    // NOTE: pinModal has "flex" hard-coded in index.html and is only ever
    // hidden via the "hidden" class, so "flex" alone is NOT enough to say a
    // modal is open — it must also not be hidden.
    return Array.from(document.querySelectorAll('[id$="Modal"]')).some(el =>
        el.classList.contains('flex') && !el.classList.contains('hidden')
    );
}
function refreshBodyScrollLock() {
    document.body.classList.toggle('modal-open-lock', isAnyModalOpen());
}
document.querySelectorAll('[id$="Modal"]').forEach(el => {
    el.setAttribute('tabindex', '-1');
    new MutationObserver(() => {
        refreshBodyScrollLock();
        // Give the popup focus as soon as it opens, so arrow keys / Page Down /
        // wheel scroll it right away instead of needing a click first.
        // (Skipped if an input inside it already grabbed focus.)
        const isOpen = el.classList.contains('flex') && !el.classList.contains('hidden');
        if (isOpen && !el.contains(document.activeElement)) {
            el.focus({ preventScroll: true });
        }
    }).observe(el, { attributes: true, attributeFilter: ['class'] });
});
refreshBodyScrollLock();

// --- Smooth, gentle mouse-wheel scrolling (desktop) ---------------------------
// Instead of the page jumping ~100px per wheel notch, the scroll position glides
// toward its target. Tweak the two numbers below to taste:
//   WHEEL_SPEED : how far one wheel notch scrolls (lower = slower, e.g. 0.5)
//   GLIDE       : how soft the glide feels (lower = longer/softer, e.g. 0.06)
// Set SMOOTH_WHEEL to false to go back to the browser's normal scrolling.
// Touch screens, trackpads, keyboard, popups and inner scroll lists (like the
// history list) keep their normal native scrolling.
// [smooth-wheel:start]
(function initSmoothWheel() {
    const SMOOTH_WHEEL = true;
    const WHEEL_SPEED = 0.7;
    const GLIDE = 0.09;

    const root = document.documentElement;

    // Mark the page as "scrolling" so CSS can pause hover/color transitions.
    let idleTimer;
    window.addEventListener('scroll', () => {
        if (!root.classList.contains('is-scrolling')) root.classList.add('is-scrolling');
        clearTimeout(idleTimer);
        idleTimer = setTimeout(() => root.classList.remove('is-scrolling'), 140);
    }, { passive: true, capture: true });

    if (!SMOOTH_WHEEL) return;
    if (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    if (window.matchMedia && window.matchMedia('(pointer: coarse)').matches) return;

    // We drive the scrolling ourselves, so CSS smooth-scroll must not fight it.
    root.style.scrollBehavior = 'auto';

    let target = window.scrollY;
    let current = window.scrollY;
    let rafId = null;
    let lastTs = 0;

    const maxScroll = () => Math.max(0, root.scrollHeight - window.innerHeight);

    // True if something under the cursor (a popup list, the history list, a
    // textarea...) can scroll in this direction — let the browser handle those.
    function innerCanScroll(el, dy) {
        while (el && el !== document.body && el !== root) {
            if (el.nodeType === 1) {
                const oy = getComputedStyle(el).overflowY;
                if ((oy === 'auto' || oy === 'scroll') && el.scrollHeight > el.clientHeight + 1) {
                    if (dy < 0 && el.scrollTop > 0) return true;
                    if (dy > 0 && el.scrollTop + el.clientHeight < el.scrollHeight - 1) return true;
                }
            }
            el = el.parentElement;
        }
        return false;
    }

    function stop() {
        if (rafId) cancelAnimationFrame(rafId);
        rafId = null;
        lastTs = 0;
    }

    function tick(ts) {
        const dt = lastTs ? Math.min(64, ts - lastTs) : 16.67;
        lastTs = ts;
        // frame-rate independent easing, so it feels the same on 60Hz and 144Hz
        const k = 1 - Math.pow(1 - GLIDE, dt / 16.67);
        current += (target - current) * k;
        if (Math.abs(target - current) < 0.5) {
            current = target;
            window.scrollTo({ top: current, left: 0, behavior: 'instant' });
            stop();
            return;
        }
        window.scrollTo({ top: current, left: 0, behavior: 'instant' });
        rafId = requestAnimationFrame(tick);
    }

    window.addEventListener('wheel', (e) => {
        if (e.defaultPrevented || e.ctrlKey || e.shiftKey || e.altKey || e.metaKey) return;
        if (Math.abs(e.deltaX) > Math.abs(e.deltaY)) return;
        if (document.body.classList.contains('modal-open-lock')) return;

        let dy = e.deltaY;
        if (e.deltaMode === 1) dy *= 32;                    // Firefox: lines -> px
        else if (e.deltaMode === 2) dy *= window.innerHeight;
        else if (Math.abs(dy) < 50) return;                 // tiny deltas = trackpad; keep native
        if (!dy) return;

        if (innerCanScroll(e.target, dy)) return;

        const max = maxScroll();
        if (max <= 0) return;

        e.preventDefault();
        if (!rafId) { current = window.scrollY; target = current; }
        target = Math.min(max, Math.max(0, target + dy * WHEEL_SPEED));
        if (!rafId) rafId = requestAnimationFrame(tick);
    }, { passive: false });

    // If the user grabs the scrollbar, presses a key, or touches, stop gliding.
    ['mousedown', 'keydown', 'touchstart'].forEach(ev =>
        window.addEventListener(ev, stop, { passive: true }));
})();
// [smooth-wheel:end]

const firebaseConfig = {
    apiKey: "AIzaSyAf36moKYjsjKNGX23bVoI0k-caXYf0lMI",
    authDomain: "yfc-pastoral-tracker.firebaseapp.com",
    projectId: "yfc-pastoral-tracker",
    storageBucket: "yfc-pastoral-tracker.firebasestorage.app",
    messagingSenderId: "693014881382",
    appId: "1:693014881382:web:80180c17fc2d9e913ef9a7",
    measurementId: "G-7M6DM05TVK"
};

firebase.initializeApp(firebaseConfig);
const db = firebase.firestore();

const formationsData = [
    { code: "CO", label: "COVENANT ORIENTATION", talks: 4 },
    { code: "FC", label: "FAMILY CULTURE", talks: 3 },
    { code: "YP", label: "YOUTH POWER", talks: 2 },
    { code: "DC", label: "DISCOVERY CAMP", talks: 5 },
    { code: "100F", label: "100% FREE", talks: 3 },
    { code: "PH", label: "PARENTS HONORING NIGHT", talks: 1 },
    { code: "SFTN", label: "STAKE FOR THE NATION", talks: 3 },
    { code: "BW", label: "BEST WEEKEND", talks: 2 },
    { code: "CS", label: "CHURCH AND SACRAMENTS", talks: 4 },
    { code: "VR", label: "VOCATION RECOLLECTION", talks: 3 },
    { code: "YA", label: "YOUTH ADVOCATE", talks: 2 }
];

let members = [];
let financeTransactions = [];
let calendarEvents = [];
const HISTORY_KEY = 'yfc_simple_tracker_history_v15';
const BACKUPS_KEY = 'yfc_simple_tracker_backups_v15';
const MAX_BACKUPS = 15;
let activityHistory = JSON.parse(localStorage.getItem(HISTORY_KEY)) || [];
let backups = JSON.parse(localStorage.getItem(BACKUPS_KEY)) || [];
let currentActiveMemberId = null;

// --- Formation modal: unsaved-changes tracking ---
let formationPendingProgress = null;
let formationModalDirty = false;

let currentCalendarDate = new Date();

// --- Pagination state ---
const MEMBERS_PER_PAGE = 10;
const FINANCE_PER_PAGE = 10;
let memberPage = 1;
let financePage = 1;

// --- Add/Edit member modal: inline formation progress state ---
let addFormProgress = {};

// Dark Mode
if (localStorage.getItem('yfc_theme') === 'dark' || (!('yfc_theme' in localStorage) && window.matchMedia('(prefers-color-scheme: dark)').matches)) {
    document.documentElement.classList.add('dark');
} else {
    document.documentElement.classList.remove('dark');
}

function toggleDarkMode() {
    if (document.documentElement.classList.contains('dark')) {
        document.documentElement.classList.remove('dark');
        localStorage.setItem('yfc_theme', 'light');
    } else {
        document.documentElement.classList.add('dark');
        localStorage.setItem('yfc_theme', 'dark');
    }
}

// --- Color Theme Picker (background/accent color — independent of dark mode) ---
const COLOR_THEME_KEY = 'yfc_color_theme';
const colorThemes = {
    green:  { name: 'Forest Green', swatch: '#1A4530', vals: { p50:'243 247 241', p100:'227 236 223', p200:'196 217 188', p600:'46 107 69',  p700:'35 87 58',  p800:'26 69 48',  p900:'18 49 32',  p950:'12 36 23' } },
    pink:   { name: 'Pink',         swatch: '#db2777', vals: { p50:'253 242 248', p100:'252 231 243', p200:'251 207 232', p600:'219 39 119', p700:'190 24 93', p800:'157 23 77', p900:'131 24 67', p950:'80 7 36' } },
    rose:   { name: 'Rose',         swatch: '#e11d48', vals: { p50:'255 241 242', p100:'255 228 230', p200:'254 205 211', p600:'225 29 72',  p700:'190 18 60', p800:'159 18 57', p900:'136 19 55', p950:'76 5 25' } },
    blue:   { name: 'Ocean Blue',   swatch: '#2563eb', vals: { p50:'239 246 255', p100:'219 234 254', p200:'191 219 254', p600:'37 99 235',  p700:'29 78 216', p800:'30 64 175', p900:'30 58 138', p950:'23 37 84' } },
    purple: { name: 'Purple',       swatch: '#9333ea', vals: { p50:'250 245 255', p100:'243 232 255', p200:'233 213 255', p600:'147 51 234', p700:'126 34 206', p800:'107 33 168', p900:'88 28 135', p950:'59 7 100' } },
    teal:   { name: 'Teal',         swatch: '#0d9488', vals: { p50:'240 253 250', p100:'204 251 241', p200:'153 246 228', p600:'13 148 136', p700:'15 118 110', p800:'17 94 89',  p900:'19 78 74',  p950:'4 47 46' } },
    orange: { name: 'Sunset Orange',swatch: '#ea580c', vals: { p50:'255 247 237', p100:'255 237 213', p200:'254 215 170', p600:'234 88 12', p700:'194 65 12', p800:'154 52 18', p900:'124 45 18', p950:'67 20 7' } },
    indigo: { name: 'Indigo',       swatch: '#4f46e5', vals: { p50:'238 242 255', p100:'224 231 255', p200:'199 210 254', p600:'79 70 229', p700:'67 56 202', p800:'55 48 163', p900:'49 46 129', p950:'30 27 75' } },
    red:    { name: 'Red',          swatch: '#dc2626', vals: { p50:'254 242 242', p100:'254 226 226', p200:'254 202 202', p600:'220 38 38', p700:'185 28 28', p800:'153 27 27', p900:'127 29 29', p950:'69 10 10' } }
};

function applyColorTheme(key, save) {
    const theme = colorThemes[key] || colorThemes.green;
    const root = document.documentElement.style;
    Object.entries(theme.vals).forEach(([varName, val]) => root.setProperty(`--${varName}`, val));
    if (save) localStorage.setItem(COLOR_THEME_KEY, key);
    document.querySelectorAll('.swatch-btn').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.themeKey === key);
    });
    const previewLabel = document.getElementById('themePreviewLabel');
    if (previewLabel) previewLabel.textContent = theme.name;
}

function buildThemeSwatchGrid() {
    const grid = document.getElementById('themeSwatchGrid');
    if (!grid) return;
    grid.innerHTML = '';
    const savedKey = localStorage.getItem(COLOR_THEME_KEY) || 'green';
    Object.entries(colorThemes).forEach(([key, theme]) => {
        const wrap = document.createElement('div');
        wrap.className = 'swatch-btn-labeled';
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'swatch-btn' + (key === savedKey ? ' active' : '');
        btn.style.backgroundColor = theme.swatch;
        btn.setAttribute('aria-label', theme.name);
        btn.dataset.themeKey = key;
        btn.onclick = () => applyColorTheme(key, true);
        const label = document.createElement('span');
        label.textContent = theme.name;
        wrap.appendChild(btn);
        wrap.appendChild(label);
        grid.appendChild(wrap);
    });
}

function toggleThemePicker() {
    const dropdown = document.getElementById('themePickerDropdown');
    const btn = document.getElementById('themePickerBtn');
    const nowHidden = !dropdown.classList.contains('hidden');
    dropdown.classList.toggle('hidden');
    if (btn) btn.setAttribute('aria-expanded', String(!nowHidden));
}

document.addEventListener('click', function (e) {
    const dropdown = document.getElementById('themePickerDropdown');
    const btn = document.getElementById('themePickerBtn');
    if (!dropdown || dropdown.classList.contains('hidden')) return;
    if (!dropdown.contains(e.target) && !btn.contains(e.target)) {
        dropdown.classList.add('hidden');
        btn.setAttribute('aria-expanded', 'false');
    }
});

document.addEventListener('keydown', function (e) {
    if (e.key !== 'Escape') return;
    const dropdown = document.getElementById('themePickerDropdown');
    const btn = document.getElementById('themePickerBtn');
    if (dropdown && !dropdown.classList.contains('hidden')) {
        dropdown.classList.add('hidden');
        if (btn) { btn.setAttribute('aria-expanded', 'false'); btn.focus(); }
    }
});

// Apply saved (or default) color theme immediately on load
applyColorTheme(localStorage.getItem(COLOR_THEME_KEY) || 'green', false);
buildThemeSwatchGrid();

// --- Confirm Action Modal ---
let _confirmDeleteCallback = null;

function showConfirmModal(message, callback, options = {}) {
    const {
        title = 'Confirm Deletion',
        confirmLabel = 'Yes, delete',
        variant = 'danger',
        icon = '⚠️'
    } = options;

    document.getElementById('confirmModalTitle').innerText = title;
    document.getElementById('confirmModalMessage').innerText = message;

    const iconWrap = document.getElementById('confirmModalIconWrap');
    iconWrap.innerText = icon;
    iconWrap.className = "mx-auto w-12 h-12 rounded-full flex items-center justify-center text-xl font-bold mb-3 " +
        (variant === 'danger'
            ? "bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400"
            : "bg-pastoral-100 dark:bg-slate-700 text-pastoral-800 dark:text-emerald-400");

    const actionBtn = document.getElementById('confirmModalActionBtn');
    actionBtn.innerText = confirmLabel;
    actionBtn.className = "flex-1 py-2.5 rounded-lg font-semibold transition min-h-[42px] " +
        (variant === 'danger'
            ? "bg-red-600 hover:bg-red-700 text-white"
            : "bg-pastoral-700 hover:bg-pastoral-800 text-white");

    _confirmDeleteCallback = callback;
    document.getElementById('confirmModal').classList.remove('hidden');
    document.getElementById('confirmModal').classList.add('flex');
}
function closeConfirmModal() {
    document.getElementById('confirmModal').classList.add('hidden');
    document.getElementById('confirmModal').classList.remove('flex');
    _confirmDeleteCallback = null;
}
document.getElementById('confirmModalActionBtn').addEventListener('click', function () {
    if (_confirmDeleteCallback) _confirmDeleteCallback();
    closeConfirmModal();
});

function updateLiveClock() {
    const now = new Date();
    const options = { weekday: 'short', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit', second: '2-digit' };
    const clockEl = document.getElementById('clockText');
    if (clockEl) clockEl.innerText = now.toLocaleDateString('en-US', options);
}
setInterval(updateLiveClock, 1000);
updateLiveClock();

// --- Real-time Sync Listeners (Members, Finance, Calendar) ---
function initRealtimeSync() {
    db.collection("members").onSnapshot((snapshot) => {
        members = [];
        snapshot.forEach((doc) => {
            members.push({ firebaseId: doc.id, ...doc.data() });
        });
        renderTable();
        renderFormationSummary();
        updateLastModifiedTime();
    }, (error) => {
        console.error("Error getting members: ", error);
        document.getElementById('lastUpdated').innerText = "Cloud sync error!";
    });

    db.collection("finance").onSnapshot((snapshot) => {
        financeTransactions = [];
        snapshot.forEach((doc) => {
            financeTransactions.push({ firebaseId: doc.id, ...doc.data() });
        });
        renderFinanceTracker();
    }, (error) => {
        console.error("Error getting finance: ", error);
    });

    db.collection("calendar").onSnapshot((snapshot) => {
        calendarEvents = [];
        snapshot.forEach((doc) => {
            calendarEvents.push({ firebaseId: doc.id, ...doc.data() });
        });
        renderCalendar();
    }, (error) => {
        console.error("Error getting calendar: ", error);
    });
}

async function saveMemberToCloud(memberData) {
    try {
        if (memberData.firebaseId) {
            const id = memberData.firebaseId;
            delete memberData.firebaseId;
            await db.collection("members").doc(id).set(memberData);
        } else {
            await db.collection("members").add(memberData);
        }
    } catch (e) {
        console.error("Error writing member: ", e);
        alert("Error saving to cloud database.");
    }
}

async function deleteMemberFromCloud(firebaseId) {
    try {
        await db.collection("members").doc(firebaseId).delete();
    } catch (e) {
        console.error("Error removing member: ", e);
    }
}

function logActivity(description) {
    const now = new Date();
    const timestamp = `${now.toLocaleDateString()} ${now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}`;
    activityHistory.unshift({ time: timestamp, desc: description, ts: now.getTime() });
    if (activityHistory.length > 50) activityHistory.pop();
    localStorage.setItem(HISTORY_KEY, JSON.stringify(activityHistory));
    renderHistoryLogs();
}

function getActivityMeta(desc) {
    const d = (desc || '').toLowerCase();
    if (d.startsWith('deleted')) {
        return { icon: '🗑️', badge: 'bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400' };
    }
    if (d.startsWith('completed formation')) {
        return { icon: '🎓', badge: 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400' };
    }
    if (d.startsWith('reset formations')) {
        return { icon: '↺', badge: 'bg-amber-100 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400' };
    }
    if (d.startsWith('added new member') || d.startsWith('added finance') || d.startsWith('added calendar')) {
        return { icon: '➕', badge: 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400' };
    }
    if (d.startsWith('updated info') || d.startsWith('edited calendar')) {
        return { icon: '✎', badge: 'bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400' };
    }
    if (d.startsWith('created a manual backup') || d.startsWith('restored backup')) {
        return { icon: '📸', badge: 'bg-purple-100 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400' };
    }
    if (d.startsWith('exported') || d.startsWith('imported')) {
        return { icon: '💾', badge: 'bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-slate-400' };
    }
    return { icon: '🔹', badge: 'bg-pastoral-100 dark:bg-slate-700 text-pastoral-700 dark:text-slate-300' };
}

function formatHistoryDateHeader(ts) {
    if (!ts) return 'Earlier';
    const d = new Date(ts);
    const now = new Date();
    const yesterday = new Date(now);
    yesterday.setDate(now.getDate() - 1);
    if (d.toDateString() === now.toDateString()) return 'Today';
    if (d.toDateString() === yesterday.toDateString()) return 'Yesterday';
    return d.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
}

function groupHistoryByDay(list) {
    const groups = [];
    let currentKey = null;
    list.forEach(log => {
        const key = log.ts ? new Date(log.ts).toDateString() : 'Earlier';
        if (key !== currentKey) {
            groups.push({ key, items: [] });
            currentKey = key;
        }
        groups[groups.length - 1].items.push(log);
    });
    return groups;
}

function updateLastModifiedTime() {
    const now = new Date();
    const timeString = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    const dateString = now.toLocaleDateString();
    const el = document.getElementById('lastUpdated');
    if (el) el.innerText = `Cloud synced: ${dateString} at ${timeString}`;
}

function renderHistoryLogs() {
    const container = document.getElementById('historyLogContainer');
    if (!container) return;
    container.innerHTML = '';
    if (activityHistory.length === 0) {
        container.innerHTML = `
            <div class="flex flex-col items-center justify-center py-12 text-center text-slate-400">
                <span class="text-2xl mb-2">🗂️</span>
                <p class="italic text-[11px]">No recent activity recorded yet.</p>
            </div>`;
        return;
    }

    const groups = groupHistoryByDay(activityHistory);
    groups.forEach(group => {
        const headerLabel = formatHistoryDateHeader(group.items[0].ts);
        const headerEl = document.createElement('div');
        headerEl.className = "sticky top-0 z-10 bg-white/95 dark:bg-slate-800/95 backdrop-blur-sm px-3 pt-2.5 pb-1.5 text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500 border-b border-pastoral-100/70 dark:border-slate-700/70";
        headerEl.innerText = headerLabel;
        container.appendChild(headerEl);

        const listWrap = document.createElement('div');
        listWrap.className = "px-2 py-1";

        group.items.forEach(log => {
            const meta = getActivityMeta(log.desc);
            const timeOnly = log.ts
                ? new Date(log.ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                : (log.time || '');
            const row = document.createElement('div');
            row.className = "flex items-start gap-2.5 px-2 py-2 rounded-xl hover:bg-pastoral-50/70 dark:hover:bg-slate-900/50 transition-colors";
            row.innerHTML = `
                <span class="shrink-0 w-7 h-7 rounded-full flex items-center justify-center text-[12px] ${meta.badge}">${meta.icon}</span>
                <div class="min-w-0 flex-1 pt-0.5">
                    <p class="text-slate-700 dark:text-slate-300 leading-snug break-words">${log.desc}</p>
                    <span class="text-[10px] text-slate-400 font-mono">${timeOnly}</span>
                </div>
            `;
            listWrap.appendChild(row);
        });

        container.appendChild(listWrap);
    });
}

// --- Backup snapshot helpers ---
function buildFullSnapshot() {
    return {
        members: JSON.parse(JSON.stringify(members)),
        finance: JSON.parse(JSON.stringify(financeTransactions)),
        calendar: JSON.parse(JSON.stringify(calendarEvents))
    };
}

function getBackupCounts(backup) {
    if (Array.isArray(backup.data)) {
        return { members: backup.data.length, finance: 0, calendar: 0 };
    }
    const d = backup.data || {};
    return {
        members: (d.members || []).length,
        finance: (d.finance || []).length,
        calendar: (d.calendar || []).length
    };
}

function normalizeBackupData(backup) {
    if (Array.isArray(backup.data)) {
        return { members: backup.data, finance: [], calendar: [] };
    }
    return {
        members: backup.data.members || [],
        finance: backup.data.finance || [],
        calendar: backup.data.calendar || []
    };
}

function createManualBackup() {
    const now = new Date();
    const snapshot = buildFullSnapshot();
    backups.unshift({
        label: 'Manual backup',
        time: `${now.toLocaleDateString()} ${now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`,
        ts: now.getTime(),
        data: snapshot
    });
    if (backups.length > MAX_BACKUPS) backups = backups.slice(0, MAX_BACKUPS);
    localStorage.setItem(BACKUPS_KEY, JSON.stringify(backups));
    logActivity(`Created a manual backup (${snapshot.members.length} members, ${snapshot.finance.length} transactions, ${snapshot.calendar.length} events).`);
    renderBackupList();
}

function renderBackupList() {
    const container = document.getElementById('backupListContainer');
    if (!container) return;
    container.innerHTML = '';
    if (backups.length === 0) {
        container.innerHTML = `
            <div class="flex flex-col items-center justify-center py-10 text-center text-slate-400">
                <span class="text-2xl mb-2">📦</span>
                <p class="italic text-[11px]">No backups saved yet. Tap "Back up now" to create one.</p>
            </div>`;
        return;
    }
    backups.forEach((b, index) => {
        const counts = getBackupCounts(b);
        const div = document.createElement('div');
        div.className = "backup-card flex items-center justify-between gap-2 bg-pastoral-50/60 dark:bg-slate-900/50 px-3 py-2.5 rounded-lg border border-pastoral-100 dark:border-slate-700 text-[11px]";
        div.innerHTML = `
            <div class="min-w-0">
                <span class="block font-semibold text-slate-700 dark:text-slate-200 truncate">📸 ${b.label}</span>
                <span class="block text-[10px] text-slate-400 font-mono mb-1.5">${b.time}</span>
                <div class="flex flex-wrap gap-1">
                    <span class="bg-white dark:bg-slate-800 border border-pastoral-100 dark:border-slate-700 text-slate-500 dark:text-slate-400 px-1.5 py-0.5 rounded text-[9px] font-semibold whitespace-nowrap">🧑‍🤝‍🧑 ${counts.members}</span>
                    <span class="bg-white dark:bg-slate-800 border border-pastoral-100 dark:border-slate-700 text-slate-500 dark:text-slate-400 px-1.5 py-0.5 rounded text-[9px] font-semibold whitespace-nowrap">💰 ${counts.finance}</span>
                    <span class="bg-white dark:bg-slate-800 border border-pastoral-100 dark:border-slate-700 text-slate-500 dark:text-slate-400 px-1.5 py-0.5 rounded text-[9px] font-semibold whitespace-nowrap">📅 ${counts.calendar}</span>
                </div>
            </div>
            <div class="flex items-center gap-1 shrink-0">
                <button onclick="restoreBackup(${index})" class="nav-action-btn bg-pastoral-700 hover:bg-pastoral-800 text-white px-2.5 py-1.5 rounded-lg text-[10px] font-semibold" title="Restore this backup">Restore</button>
                <button onclick="deleteBackup(${index})" class="nav-action-btn text-red-500 hover:text-red-700 font-bold w-7 h-7 flex items-center justify-center shrink-0" title="Delete this backup">✕</button>
            </div>
        `;
        container.appendChild(div);
    });
}

function deleteBackup(index) {
    const b = backups[index];
    if (!b) return;
    showConfirmModal(
        `Delete the backup "${b.label}" from ${b.time}? This cannot be undone.`,
        () => {
            backups.splice(index, 1);
            localStorage.setItem(BACKUPS_KEY, JSON.stringify(backups));
            logActivity(`Deleted saved backup: ${b.label} (${b.time})`);
            renderBackupList();
        },
        { title: 'Delete Backup?', confirmLabel: 'Yes, delete', variant: 'danger', icon: '🗑️' }
    );
}

async function replaceCollection(collectionName, newDocs) {
    const snapshot = await db.collection(collectionName).get();
    await Promise.all(snapshot.docs.map(doc => doc.ref.delete()));
    await Promise.all(newDocs.map(docData => {
        const clean = { ...docData };
        delete clean.firebaseId;
        return db.collection(collectionName).add(clean);
    }));
}

function restoreBackup(index) {
    const b = backups[index];
    if (!b) return;
    const counts = getBackupCounts(b);
    showConfirmModal(
        `Restore "${b.label}" from ${b.time}? This will REPLACE all current members, finance records, and calendar events with this backup's data (${counts.members} members, ${counts.finance} transactions, ${counts.calendar} events).`,
        async () => {
            const restoreData = normalizeBackupData(b);
            try {
                await Promise.all([
                    replaceCollection('members', restoreData.members),
                    replaceCollection('finance', restoreData.finance),
                    replaceCollection('calendar', restoreData.calendar)
                ]);
                logActivity(`Restored backup: ${b.label} (${b.time})`);
                alert('Backup restored successfully.');
            } catch (err) {
                console.error('Error restoring backup:', err);
                alert('Error restoring backup. Please try again.');
            }
        },
        { title: 'Confirm Restore', confirmLabel: 'Yes, restore', variant: 'primary', icon: '🔄' }
    );
}

function clearHistoryLogs() {
    if (confirm("Clear activity history logs?")) {
        activityHistory = [];
        localStorage.setItem(HISTORY_KEY, JSON.stringify(activityHistory));
        renderHistoryLogs();
    }
}

function calculateAge(birthdayStr) {
    if (!birthdayStr) return 'N/A';
    const birthDate = new Date(birthdayStr);
    const today = new Date();
    let age = today.getFullYear() - birthDate.getFullYear();
    const m = today.getMonth() - birthDate.getMonth();
    if (m < 0 || (m === 0 && today.getDate() < birthDate.getDate())) age--;
    return `${age} yrs old`;
}

// Sets a sidebar tab button's active/inactive visual state. The base
// "sidebar-tab" class (icon + label layout, mobile pill / desktop list item)
// is already on the button in the HTML — this only toggles the active
// highlight modifier class, so the same markup works at every breakpoint.
function setTabButtonState(btn, active) {
    btn.classList.toggle('sidebar-tab-active', active);
    btn.setAttribute('aria-selected', active ? 'true' : 'false');
}

function runTabRenderers(tab) {
    if (tab === 'members') renderTable();
    if (tab === 'formations') renderFormationSummary();
    if (tab === 'finance') renderFinanceTracker();
    if (tab === 'calendar') renderCalendar();
    if (tab === 'history') { renderHistoryLogs(); renderBackupList(); }
}

function switchTab(tab) {
    const btns = {
        members: document.getElementById('tabBtnMembers'),
        formations: document.getElementById('tabBtnFormations'),
        finance: document.getElementById('tabBtnFinance'),
        calendar: document.getElementById('tabBtnCalendar'),
        history: document.getElementById('tabBtnHistory')
    };
    const contents = {
        members: document.getElementById('tabContentMembers'),
        formations: document.getElementById('tabContentFormations'),
        finance: document.getElementById('tabContentFinance'),
        calendar: document.getElementById('tabContentCalendar'),
        history: document.getElementById('tabContentHistory')
    };

    Object.keys(btns).forEach(key => setTabButtonState(btns[key], key === tab));

    const currentKey = Object.keys(contents).find(key => !contents[key].classList.contains('hidden'));
    const nextEl = contents[tab];
    const currentEl = currentKey ? contents[currentKey] : null;

    if (currentEl && currentEl !== nextEl) {
        currentEl.classList.add('tab-transition-out');
        setTimeout(() => {
            currentEl.classList.add('hidden');
            currentEl.classList.remove('tab-transition-out');

            // Render first, THEN reveal — otherwise the new tab briefly shows
            // empty (short) and then pops to full height, making the page jump.
            runTabRenderers(tab);
            nextEl.classList.remove('hidden');
            nextEl.classList.add('tab-transition-in');
            void nextEl.offsetWidth;
            nextEl.classList.add('tab-transition-in-active');
            setTimeout(() => {
                nextEl.classList.remove('tab-transition-in', 'tab-transition-in-active');
            }, 360);
        }, 160);
    } else {
        runTabRenderers(tab);
        nextEl.classList.remove('hidden');
    }
}

// --- Generic pagination bar builder ---
function buildPaginationControls(containerId, totalItems, perPage, currentPage, onPageChange) {
    const container = document.getElementById(containerId);
    if (!container) return;
    container.innerHTML = '';
    if (totalItems === 0) return;

    const totalPages = Math.max(1, Math.ceil(totalItems / perPage));
    const startItem = (currentPage - 1) * perPage + 1;
    const endItem = Math.min(currentPage * perPage, totalItems);

    const wrap = document.createElement('div');
    wrap.className = "inline-flex items-center gap-1 bg-pastoral-50 dark:bg-slate-900/60 border border-pastoral-100 dark:border-slate-700 rounded-full p-1";

    const navBtnClass = "flex items-center justify-center w-8 h-8 rounded-full text-sm font-bold text-slate-600 dark:text-slate-300 disabled:opacity-30 disabled:cursor-not-allowed hover:bg-white dark:hover:bg-slate-700 hover:shadow-xs transition shrink-0";

    const prevBtn = document.createElement('button');
    prevBtn.type = 'button';
    prevBtn.innerHTML = '‹';
    prevBtn.title = 'Previous page';
    prevBtn.disabled = currentPage <= 1;
    prevBtn.className = navBtnClass;
    prevBtn.onclick = () => onPageChange(currentPage - 1);
    wrap.appendChild(prevBtn);

    const pageLabel = document.createElement('span');
    pageLabel.className = "px-3 min-w-[12.5rem] text-center text-[11px] font-semibold text-slate-600 dark:text-slate-300 whitespace-nowrap";
    pageLabel.innerHTML = `Page ${currentPage} of ${totalPages} <span class="text-slate-400 font-normal">(${startItem}–${endItem} of ${totalItems})</span>`;
    wrap.appendChild(pageLabel);

    const nextBtn = document.createElement('button');
    nextBtn.type = 'button';
    nextBtn.innerHTML = '›';
    nextBtn.title = 'Next page';
    nextBtn.disabled = currentPage >= totalPages;
    nextBtn.className = navBtnClass;
    nextBtn.onclick = () => onPageChange(currentPage + 1);
    wrap.appendChild(nextBtn);

    container.appendChild(wrap);
}

// --- Finance Tracker Functions (Cloud Synced) ---
function openAddTransactionModal() {
    document.getElementById('addTransactionModal').classList.remove('hidden');
    document.getElementById('addTransactionModal').classList.add('flex');
    document.getElementById('transDate').value = new Date().toISOString().slice(0, 10);
}

function closeAddTransactionModal() {
    document.getElementById('addTransactionModal').classList.add('hidden');
    document.getElementById('addTransactionModal').classList.remove('flex');
}

async function saveTransaction(e) {
    e.preventDefault();
    const desc = document.getElementById('transDesc').value;
    const type = document.getElementById('transType').value;
    const amount = parseFloat(document.getElementById('transAmount').value);
    const date = document.getElementById('transDate').value;

    const newTrans = { desc, type, amount, date };

    try {
        await db.collection("finance").add(newTrans);
        logActivity(`Added finance transaction: ${desc} (₱${amount})`);
        financePage = 1;
        closeAddTransactionModal();
    } catch (err) {
        console.error("Error saving transaction: ", err);
        alert("Error saving transaction to cloud.");
    }
}

function deleteTransaction(firebaseId) {
    const t = financeTransactions.find(x => x.firebaseId === firebaseId);
    const label = t ? `"${t.desc}" (₱${t.amount.toFixed(2)})` : 'this transaction';
    showConfirmModal(`Are you sure you want to delete ${label}? This cannot be undone.`, async () => {
        try {
            await db.collection("finance").doc(firebaseId).delete();
            logActivity(`Deleted finance transaction: ${t ? t.desc : firebaseId}`);
        } catch (err) {
            console.error("Error deleting transaction: ", err);
        }
    });
}

function goToFinancePage(page) {
    financePage = page;
    renderFinanceTracker();
}

function renderFinanceTracker() {
    const tbody = document.getElementById('financeTableBody');
    if (!tbody) return;
    tbody.innerHTML = '';

    let totalIn = 0;
    let totalOut = 0;
    financeTransactions.forEach(t => {
        if (t.type === 'In') totalIn += t.amount; else totalOut += t.amount;
    });

    const sorted = [...financeTransactions].sort((a, b) => new Date(b.date) - new Date(a.date));
    const totalPages = Math.max(1, Math.ceil(sorted.length / FINANCE_PER_PAGE));
    if (financePage > totalPages) financePage = totalPages;
    if (financePage < 1) financePage = 1;

    const pageItems = sorted.slice((financePage - 1) * FINANCE_PER_PAGE, financePage * FINANCE_PER_PAGE);

    if (sorted.length === 0) {
        tbody.innerHTML = `<tr><td colspan="6" class="p-6 text-center text-slate-400 italic">No financial transactions recorded.</td></tr>`;
    }

    pageItems.forEach((t, idx) => {
        const rowNum = (financePage - 1) * FINANCE_PER_PAGE + idx + 1;
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td data-label="#" class="py-3.5 px-4 text-center text-slate-400 font-mono">${rowNum}</td>
            <td data-label="Date" class="py-3.5 px-4">${t.date}</td>
            <td data-label="Description" class="py-3.5 px-4 font-semibold">${t.desc}</td>
            <td data-label="Type" class="py-3.5 px-4"><span class="px-2 py-0.5 rounded text-[10px] font-bold ${t.type === 'In' ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'}">${t.type === 'In' ? 'Funds In' : 'Expense'}</span></td>
            <td data-label="Amount" class="py-3.5 px-4 text-right font-mono font-bold ${t.type === 'In' ? 'text-emerald-600' : 'text-red-500'}">₱${t.amount.toFixed(2)}</td>
            <td data-label="Action" class="py-3.5 px-4 text-center whitespace-nowrap"><button onclick="deleteTransaction('${t.firebaseId}')" class="text-red-500 hover:text-red-700 font-bold w-6 h-6 inline-flex items-center justify-center transition">✕</button></td>
        `;
        tbody.appendChild(tr);
    });

    document.getElementById('financeTotalIn').innerText = `₱${totalIn.toFixed(2)}`;
    document.getElementById('financeTotalOut').innerText = `₱${totalOut.toFixed(2)}`;
    document.getElementById('financeBalance').innerText = `₱${(totalIn - totalOut).toFixed(2)}`;

    buildPaginationControls('financePagination', sorted.length, FINANCE_PER_PAGE, financePage, goToFinancePage);
}

// --- Calendar Functions (Cloud Synced) ---
const eventCategories = {
    general:   { label: 'General',   dot: 'bg-slate-400',   pill: 'bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-200' },
    meeting:   { label: 'Meeting',    dot: 'bg-blue-500',    pill: 'bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300' },
    formation: { label: 'Formation',  dot: 'bg-emerald-500', pill: 'bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300' },
    birthday:  { label: 'Birthday',   dot: 'bg-pink-500',    pill: 'bg-pink-100 dark:bg-pink-900/40 text-pink-700 dark:text-pink-300' },
    deadline:  { label: 'Deadline',   dot: 'bg-red-500',     pill: 'bg-red-100 dark:bg-red-900/40 text-red-700 dark:text-red-300' }
};
let _dayDetailDateStr = null;

const officialHolidays = {
    "2025-01-01": "New Year's Day",
    "2025-01-29": "Chinese New Year",
    "2025-02-25": "EDSA People Power Anniversary",
    "2025-04-09": "Araw ng Kagitingan",
    "2025-04-17": "Maundy Thursday",
    "2025-04-18": "Good Friday",
    "2025-04-19": "Black Saturday",
    "2025-05-01": "Labor Day",
    "2025-06-12": "Independence Day",
    "2025-07-27": "Iglesia ni Cristo Founding Anniversary",
    "2025-08-21": "Ninoy Aquino Day",
    "2025-08-25": "National Heroes Day",
    "2025-10-31": "All Saints' Day Eve",
    "2025-11-01": "All Saints' Day",
    "2025-11-30": "Bonifacio Day",
    "2025-12-08": "Feast of the Immaculate Conception",
    "2025-12-24": "Christmas Eve",
    "2025-12-25": "Christmas Day",
    "2025-12-30": "Rizal Day",
    "2025-12-31": "Last Day of the Year",

    "2026-01-01": "New Year's Day",
    "2026-02-17": "Chinese New Year",
    "2026-02-25": "EDSA People Power Anniversary",
    "2026-03-20": "Eid'l Fitr",
    "2026-04-02": "Maundy Thursday",
    "2026-04-03": "Good Friday",
    "2026-04-04": "Black Saturday",
    "2026-04-09": "Araw ng Kagitingan",
    "2026-05-01": "Labor Day",
    "2026-06-12": "Independence Day",
    "2026-08-21": "Ninoy Aquino Day",
    "2026-08-31": "National Heroes Day",
    "2026-11-01": "All Saints' Day",
    "2026-11-02": "All Souls' Day",
    "2026-11-30": "Bonifacio Day",
    "2026-12-08": "Feast of the Immaculate Conception",
    "2026-12-24": "Christmas Eve",
    "2026-12-25": "Christmas Day",
    "2026-12-30": "Rizal Day",
    "2026-12-31": "Last Day of the Year"
};

function getHolidayName(dateStr) {
    return officialHolidays[dateStr] || null;
}

function todayDateStr() {
    const n = new Date();
    return `${n.getFullYear()}-${String(n.getMonth() + 1).padStart(2, '0')}-${String(n.getDate()).padStart(2, '0')}`;
}

function changeMonth(direction) {
    currentCalendarDate.setMonth(currentCalendarDate.getMonth() + direction);
    renderCalendar();
}

function goToToday() {
    currentCalendarDate = new Date();
    renderCalendar();
}

function openAddEventModal(prefillDate) {
    document.getElementById('editEventId').value = '';
    document.getElementById('addEventModalTitle').innerText = 'Add Calendar Event';
    document.getElementById('addEventSubmitBtn').innerText = 'Add Event';
    document.getElementById('addEventModal').classList.remove('hidden');
    document.getElementById('addEventModal').classList.add('flex');
    document.getElementById('eventDate').value = prefillDate || new Date().toISOString().slice(0, 10);
    document.getElementById('eventCategory').value = 'general';
    document.getElementById('eventTitle').value = '';
    document.getElementById('eventTitle').focus();
}

function openAddEventModalForDay() {
    closeDayDetailModal();
    openAddEventModal(_dayDetailDateStr);
}

function openEditEventModal(firebaseId) {
    const ev = calendarEvents.find(x => x.firebaseId === firebaseId);
    if (!ev) return;
    closeDayDetailModal();
    document.getElementById('editEventId').value = firebaseId;
    document.getElementById('addEventModalTitle').innerText = 'Edit Calendar Event';
    document.getElementById('addEventSubmitBtn').innerText = 'Save Changes';
    document.getElementById('eventTitle').value = ev.title || '';
    document.getElementById('eventDate').value = ev.date || new Date().toISOString().slice(0, 10);
    document.getElementById('eventCategory').value = ev.category || 'general';
    document.getElementById('addEventModal').classList.remove('hidden');
    document.getElementById('addEventModal').classList.add('flex');
    document.getElementById('eventTitle').focus();
}

function closeAddEventModal() {
    document.getElementById('addEventModal').classList.add('hidden');
    document.getElementById('addEventModal').classList.remove('flex');
    document.getElementById('editEventId').value = '';
}

async function saveCalendarEvent(e) {
    e.preventDefault();
    const editId = document.getElementById('editEventId').value;
    const title = document.getElementById('eventTitle').value;
    const date = document.getElementById('eventDate').value;
    const category = document.getElementById('eventCategory').value;

    const eventData = { title, date, category };

    try {
        if (editId) {
            await db.collection("calendar").doc(editId).update(eventData);
            logActivity(`Edited calendar event: ${title} — now on ${date}`);
        } else {
            await db.collection("calendar").add(eventData);
            logActivity(`Added calendar event: ${title} on ${date}`);
        }
        closeAddEventModal();
        if (document.getElementById('dayDetailModal').classList.contains('flex') && _dayDetailDateStr === date) {
            renderDayDetailList(date);
        }
    } catch (err) {
        console.error("Error saving event: ", err);
        alert("Error saving event to cloud.");
    }
}

function deleteCalendarEvent(firebaseId) {
    const ev = calendarEvents.find(x => x.firebaseId === firebaseId);
    const label = ev ? `"${ev.title}"` : 'this event';
    showConfirmModal(`Are you sure you want to delete ${label}? This cannot be undone.`, async () => {
        try {
            await db.collection("calendar").doc(firebaseId).delete();
            logActivity(`Deleted calendar event: ${ev ? ev.title : firebaseId}`);
            if (document.getElementById('dayDetailModal').classList.contains('flex') && _dayDetailDateStr) {
                renderDayDetailList(_dayDetailDateStr);
            }
        } catch (err) {
            console.error("Error deleting event: ", err);
        }
    });
}

function renderCalendarLegend() {
    const legend = document.getElementById('calendarLegend');
    if (!legend) return;
    const categoryLegend = Object.values(eventCategories).map(c =>
        `<span class="inline-flex items-center gap-1.5"><span class="w-2 h-2 rounded-full ${c.dot} inline-block"></span>${c.label}</span>`
    ).join('');
    const holidayLegend = `<span class="inline-flex items-center gap-1.5 font-semibold text-red-500 dark:text-red-400"><span class="w-2 h-2 rounded-full bg-red-500 inline-block"></span>Sunday / Holiday</span>`;
    legend.innerHTML = categoryLegend + holidayLegend;
}

function renderCalendar() {
    const grid = document.getElementById('calendarGrid');
    const titleEl = document.getElementById('calendarMonthTitle');
    if (!grid || !titleEl) return;
    grid.className = "grid grid-cols-7 text-xs compact-mobile border-t border-l border-pastoral-100 dark:border-slate-700";
    grid.innerHTML = '';
    renderCalendarLegend();

    const year = currentCalendarDate.getFullYear();
    const month = currentCalendarDate.getMonth();
    const todayStr = todayDateStr();

    const monthNames = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
    titleEl.innerText = `${monthNames[month]} ${year}`;

    const firstDayIndex = new Date(year, month, 1).getDay();
    const totalDays = new Date(year, month + 1, 0).getDate();

    const fillerCellClass = "border-r border-b border-pastoral-100 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/30 min-h-[90px] opacity-40";

    for (let i = 0; i < firstDayIndex; i++) {
        const cell = document.createElement('div');
        cell.className = fillerCellClass;
        grid.appendChild(cell);
    }

    for (let day = 1; day <= totalDays; day++) {
        const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
        const isToday = dateStr === todayStr;
        const dayOfWeek = new Date(year, month, day).getDay();
        const holidayName = getHolidayName(dateStr);
        const isRedDate = dayOfWeek === 0 || !!holidayName;
        const dayEvents = calendarEvents.filter(ev => ev.date === dateStr);

        const cell = document.createElement('div');
        cell.className = "day-cell border-r border-b border-pastoral-100 dark:border-slate-700 p-2 bg-white dark:bg-slate-800 min-h-[90px] flex flex-col overflow-hidden" + (isToday ? " is-today" : "");
        cell.title = holidayName || '';
        cell.onclick = () => openDayDetailModal(dateStr);

        const dayNumberClass = "day-number-badge inline-flex items-center justify-center w-5 h-5 rounded-full font-bold" +
            (isToday ? "" : (isRedDate ? " text-red-500 dark:text-red-400" : " text-slate-500 dark:text-slate-400"));
        const dayHeader = `<div class="${dayNumberClass}">${day}</div>`;
        const holidayLabelHtml = holidayName
            ? `<div class="holiday-label text-[8px] sm:text-[9px] font-semibold text-red-500 dark:text-red-400 truncate leading-tight" title="${holidayName}">${holidayName}</div>`
            : '';

        let pillsHtml = '<div class="event-pill-list space-y-1 mt-1 overflow-hidden">';
        dayEvents.slice(0, 2).forEach(ev => {
            const cat = eventCategories[ev.category] || eventCategories.general;
            pillsHtml += `<div class="${cat.pill} px-1.5 py-0.5 rounded text-[10px] truncate font-medium">${ev.title}</div>`;
        });
        if (dayEvents.length > 2) {
            pillsHtml += `<div class="text-[9px] text-slate-400 font-semibold px-1">+${dayEvents.length - 2} more</div>`;
        }
        pillsHtml += '</div>';

        let dotsHtml = '<div class="event-dots hidden gap-1 mt-1 flex-wrap">';
        dayEvents.slice(0, 4).forEach(ev => {
            const cat = eventCategories[ev.category] || eventCategories.general;
            dotsHtml += `<span class="w-1.5 h-1.5 rounded-full ${cat.dot} inline-block"></span>`;
        });
        dotsHtml += '</div>';

        cell.innerHTML = dayHeader + holidayLabelHtml + pillsHtml + dotsHtml;
        grid.appendChild(cell);
    }

    const totalCellsSoFar = firstDayIndex + totalDays;
    const trailingCells = (7 - (totalCellsSoFar % 7)) % 7;
    for (let i = 0; i < trailingCells; i++) {
        const cell = document.createElement('div');
        cell.className = fillerCellClass;
        grid.appendChild(cell);
    }
}

function openDayDetailModal(dateStr) {
    _dayDetailDateStr = dateStr;
    const d = new Date(dateStr + 'T00:00:00');
    const label = d.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });
    document.getElementById('dayDetailTitle').innerText = label;
    renderDayDetailList(dateStr);
    document.getElementById('dayDetailModal').classList.remove('hidden');
    document.getElementById('dayDetailModal').classList.add('flex');
}

function renderDayDetailList(dateStr) {
    const container = document.getElementById('dayDetailList');
    const dayEvents = calendarEvents.filter(ev => ev.date === dateStr);
    if (dayEvents.length === 0) {
        container.innerHTML = `<p class="text-slate-400 italic text-center py-4">No events on this day yet.</p>`;
        return;
    }
    container.innerHTML = dayEvents.map(ev => {
        const cat = eventCategories[ev.category] || eventCategories.general;
        return `<div class="flex items-center justify-between gap-2 p-3 rounded-lg border border-pastoral-100 dark:border-slate-700 bg-pastoral-50/50 dark:bg-slate-900/50">
            <div class="min-w-0">
                <span class="inline-flex items-center gap-1.5 ${cat.pill} px-2 py-0.5 rounded-full text-[10px] font-bold mb-1">${cat.label}</span>
                <p class="font-semibold text-slate-800 dark:text-slate-100 truncate">${ev.title}</p>
            </div>
            <div class="flex items-center gap-1 shrink-0">
                <button onclick="openEditEventModal('${ev.firebaseId}')" class="text-pastoral-700 dark:text-emerald-400 hover:text-pastoral-900 dark:hover:text-emerald-300 font-bold px-2 py-1" title="Edit event">✎</button>
                <button onclick="deleteCalendarEvent('${ev.firebaseId}')" class="text-red-500 hover:text-red-700 font-bold px-2 py-1" title="Delete event">✕</button>
            </div>
        </div>`;
    }).join('');
}

function closeDayDetailModal() {
    document.getElementById('dayDetailModal').classList.add('hidden');
    document.getElementById('dayDetailModal').classList.remove('flex');
}

function getCompletedFormationsCount(member) {
    if (!member.progress) return 0;
    let count = 0;
    formationsData.forEach(f => {
        const talksAttended = member.progress[f.code];
        if (Array.isArray(talksAttended)) {
            const attendedCount = talksAttended.filter(Boolean).length;
            if (attendedCount === f.talks) count++;
        }
    });
    return count;
}

// Whether a given member has fully completed a given formation code.
function memberCompletedFormation(member, formation) {
    if (!member.progress) return false;
    const talksAttended = member.progress[formation.code];
    if (!Array.isArray(talksAttended)) return false;
    return talksAttended.filter(Boolean).length === formation.talks;
}

function handleSearchInput() {
    const searchInput = document.getElementById('searchInput');
    const clearBtn = document.getElementById('clearSearchBtn');
    clearBtn.style.display = searchInput.value.trim().length > 0 ? 'flex' : 'none';
    memberPage = 1;
    renderTable();
}

function clearSearch() {
    document.getElementById('searchInput').value = '';
    document.getElementById('clearSearchBtn').style.display = 'none';
    memberPage = 1;
    renderTable();
}

function handleChapterFilterChange() {
    memberPage = 1;
    renderTable();
}

function goToMemberPage(page) {
    memberPage = page;
    renderTable();
}

function renderTable() {
    const tbody = document.getElementById('memberTableBody');
    if (!tbody) return;
    const searchVal = document.getElementById('searchInput').value.toLowerCase().trim();
    const chapterVal = document.getElementById('chapterFilter').value;
    tbody.innerHTML = '';

    const filtered = members.filter(m => {
        const fullName = `${m.lastName}, ${m.firstName}`.toLowerCase();
        const nickname = (m.nickname || '').toLowerCase();
        const matchName = fullName.includes(searchVal) || nickname.includes(searchVal);
        const matchChapter = chapterVal === "" || m.chapter === chapterVal;
        return matchName && matchChapter;
    }).sort((a, b) => a.lastName.localeCompare(b.lastName));

    document.getElementById('statTotalMembers').innerText = members.length;
    document.getElementById('statChapter1').innerText = members.filter(m => m.chapter === "Chapter 1").length;
    document.getElementById('statChapter2').innerText = members.filter(m => m.chapter === "Chapter 2").length;

    const totalPages = Math.max(1, Math.ceil(filtered.length / MEMBERS_PER_PAGE));
    if (memberPage > totalPages) memberPage = totalPages;
    if (memberPage < 1) memberPage = 1;

    const pageItems = filtered.slice((memberPage - 1) * MEMBERS_PER_PAGE, memberPage * MEMBERS_PER_PAGE);

    if (filtered.length === 0) {
        tbody.innerHTML = `<tr><td colspan="6" class="p-6 text-center text-slate-400 italic">No members found.</td></tr>`;
        buildPaginationControls('memberPagination', 0, MEMBERS_PER_PAGE, memberPage, goToMemberPage);
        return;
    }

    pageItems.forEach((m, idx) => {
        const rowNum = (memberPage - 1) * MEMBERS_PER_PAGE + idx + 1;
        const completedCount = getCompletedFormationsCount(m);
        const formattedName = `${m.lastName}, ${m.firstName}`;
        const nicknameDisplay = m.nickname ? ` <span class="text-slate-400 font-normal">("${m.nickname}")</span>` : '';
        const genderBadge = m.gender === 'Female'
            ? `<span class="bg-pink-100 dark:bg-pink-900/40 text-pink-700 dark:text-pink-300 font-bold px-2.5 py-0.5 rounded-full text-[10px]">Female</span>`
            : `<span class="bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300 font-bold px-2.5 py-0.5 rounded-full text-[10px]">Male</span>`;
        const ageText = calculateAge(m.birthday);

        const tr = document.createElement('tr');
        tr.className = "hover:bg-pastoral-50/60 dark:hover:bg-slate-800/80 transition-colors border-b border-slate-100 dark:border-slate-700/50";
        tr.innerHTML = `
            <td data-label="#" class="py-3.5 px-4 text-center text-slate-400 font-mono">${rowNum}</td>
            <td data-label="Member name" class="py-3.5 px-4 font-bold text-slate-900 dark:text-white">${formattedName}${nicknameDisplay}</td>
            <td data-label="Gender / age" class="py-3.5 px-4"><span class="inline-flex items-center gap-1.5">${genderBadge}<span class="text-[10px] text-slate-400 whitespace-nowrap">${ageText}</span></span></td>
            <td data-label="Area / chapter" class="py-3.5 px-4"><span class="bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-300 font-semibold px-2.5 py-1 rounded-full text-[10px]">${m.chapter}</span></td>
            <td data-label="Formations done" class="py-3.5 px-4 text-center"><span class="bg-emerald-100 dark:bg-emerald-900/40 text-emerald-800 dark:text-emerald-300 font-bold px-2.5 py-1 rounded-full text-[10px] whitespace-nowrap">${completedCount} / 11 Done</span></td>
            <td data-label="Actions" class="py-3.5 px-4 text-center whitespace-nowrap">
                <div class="flex flex-nowrap justify-center items-center gap-1.5">
                    <button onclick="openFormationModal('${m.firebaseId}')" class="shrink-0 bg-pastoral-700 hover:bg-pastoral-800 text-white px-2.5 py-1.5 rounded-lg text-[11px] font-semibold shadow-sm transition active:scale-95">Formation</button>
                    <button onclick="openEditModal('${m.firebaseId}')" class="shrink-0 bg-slate-200 dark:bg-slate-700 hover:bg-slate-300 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-200 px-2.5 py-1.5 rounded-lg text-[11px] font-semibold transition">Edit</button>
                    <button onclick="deleteMember('${m.firebaseId}')" class="shrink-0 text-slate-400 hover:text-red-600 font-bold w-6 h-6 flex items-center justify-center transition text-sm" title="Delete">✕</button>
                </div>
            </td>
        `;
        tbody.appendChild(tr);
    });

    buildPaginationControls('memberPagination', filtered.length, MEMBERS_PER_PAGE, memberPage, goToMemberPage);
}

// --- Formation tracks tab: summary rows + a "who's done this" member
// roster. Clicking the member-count badge opens a dedicated modal (like the
// Edit Member modal) listing everyone who completed that track. Using a
// modal instead of expanding the row in place keeps the Formation tracks
// page compact and readable no matter how many members are on the roster.
function renderFormationSummary() {
    const tbody = document.getElementById('formationSummaryBody');
    if (!tbody) return;
    tbody.innerHTML = '';

    formationsData.forEach(f => {
        const completedMembers = members
            .filter(m => memberCompletedFormation(m, f))
            .sort((a, b) => a.lastName.localeCompare(b.lastName));
        const count = completedMembers.length;

        const tr = document.createElement('tr');
        tr.className = "hover:bg-pastoral-50/60 dark:hover:bg-slate-700/50 transition-colors align-middle";
        tr.innerHTML = `
            <td data-label="Code" class="py-3 px-4 font-extrabold text-pastoral-700 dark:text-emerald-400 font-mono">${f.code}</td>
            <td data-label="Formation track" class="py-3 px-4 font-semibold text-slate-800 dark:text-slate-200">${f.label}</td>
            <td data-label="# talks" class="py-3 px-4 text-center font-mono text-slate-600 dark:text-slate-400">${f.talks}</td>
            <td data-label="Completed count" class="py-3 px-4 text-center">
                <button type="button" onclick="openFormationMembersModal('${f.code}')" class="formation-count-btn" title="Click to view members">
                    <span class="formation-count-label">${count} member${count === 1 ? '' : 's'}</span>
                    <i class="fi fi-rr-eye formation-count-chevron" aria-hidden="true"></i>
                </button>
            </td>
        `;
        tbody.appendChild(tr);
    });
}

// Opens the formation-members modal for a given track code and fills it
// with the sorted roster of members who have completed it.
function openFormationMembersModal(code) {
    const f = formationsData.find(x => x.code === code);
    if (!f) return;
    const completedMembers = members
        .filter(m => memberCompletedFormation(m, f))
        .sort((a, b) => a.lastName.localeCompare(b.lastName));
    const count = completedMembers.length;

    document.getElementById('formationMembersModalTitle').innerText = `${f.code} — ${f.label}`;
    document.getElementById('formationMembersModalSubtitle').innerText =
        count === 0 ? 'No members have completed this track yet.' : `${count} member${count === 1 ? '' : 's'} completed this track`;

    const listEl = document.getElementById('formationMembersModalList');
    listEl.innerHTML = count === 0
        ? `<p class="text-[11px] text-slate-400 italic text-center py-6">No members have completed this track yet.</p>`
        : `<div class="formation-members-grid">${completedMembers.map(m => `
                <div class="formation-member-item">
                    <div class="fm-info">
                        <span class="fm-name">${m.lastName}, ${m.firstName}</span>
                        ${m.nickname ? `<span class="fm-nick">"${m.nickname}"</span>` : ''}
                    </div>
                    <span class="fm-chapter">${m.chapter}</span>
                </div>
            `).join('')}</div>`;

    document.getElementById('formationMembersModal').classList.remove('hidden');
    document.getElementById('formationMembersModal').classList.add('flex');
}

function closeFormationMembersModal() {
    document.getElementById('formationMembersModal').classList.add('hidden');
    document.getElementById('formationMembersModal').classList.remove('flex');
}

function openFormationModal(firebaseId) {
    currentActiveMemberId = firebaseId;
    const member = members.find(m => m.firebaseId === firebaseId);
    if (!member) return;
    document.getElementById('modalMemberName').innerText = `Formations: ${member.lastName}, ${member.firstName}`;

    document.getElementById('modalMemberInfo').innerHTML = `
        <div><span class="text-slate-400 block font-bold text-[9px] uppercase">Nickname</span><span class="font-semibold text-slate-800 dark:text-slate-200">${member.nickname || 'N/A'}</span></div>
        <div><span class="text-slate-400 block font-bold text-[9px] uppercase">Gender</span><span class="font-semibold text-slate-800 dark:text-slate-200">${member.gender || 'N/A'}</span></div>
        <div><span class="text-slate-400 block font-bold text-[9px] uppercase">Birthday</span><span class="font-semibold text-slate-800 dark:text-slate-200">${member.birthday || 'N/A'}</span></div>
        <div><span class="text-slate-400 block font-bold text-[9px] uppercase">Chapter</span><span class="font-semibold text-slate-800 dark:text-slate-200">${member.chapter}</span></div>
    `;

    if (!member.progress) member.progress = {};
    formationsData.forEach(f => {
        if (!Array.isArray(member.progress[f.code]) || member.progress[f.code].length !== f.talks) {
            member.progress[f.code] = new Array(f.talks).fill(false);
        }
    });
    formationPendingProgress = JSON.parse(JSON.stringify(member.progress));
    formationModalDirty = false;

    renderModalFormations();
    document.getElementById('formationModal').classList.remove('hidden');
    document.getElementById('formationModal').classList.add('flex');
}

function renderModalFormations() {
    const member = members.find(m => m.firebaseId === currentActiveMemberId);
    if (!member || !formationPendingProgress) return;
    const container = document.getElementById('modalFormationList');
    container.innerHTML = '';

    formationsData.forEach((f, index) => {
        const talksStatus = formationPendingProgress[f.code] || new Array(f.talks).fill(false);
        const attendedCount = talksStatus.filter(Boolean).length;
        const isComplete = attendedCount === f.talks;

        const itemDiv = document.createElement('div');
        itemDiv.className = "p-3 border border-pastoral-100 dark:border-slate-700 rounded-lg bg-pastoral-50/50 dark:bg-slate-900 flex items-center justify-between transition-colors";
        itemDiv.innerHTML = `
            <div>
                <span class="font-extrabold text-pastoral-700 dark:text-emerald-400">${f.code}</span> - <span class="font-semibold text-slate-800 dark:text-slate-200">${f.label}</span>
                <span class="block text-[10px] text-slate-400">${attendedCount} of ${f.talks} talks completed</span>
            </div>
            <div>
                <button onclick="toggleCompleteFormation(${index})" class="px-3 py-1.5 rounded-lg text-[11px] font-bold transition shadow-xs ${isComplete ? 'bg-emerald-600 hover:bg-emerald-700 text-white' : 'bg-slate-200 dark:bg-slate-700 hover:bg-slate-300 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-200'}">
                    ${isComplete ? '✓ Completed' : 'Mark complete'}
                </button>
            </div>
        `;
        container.appendChild(itemDiv);
    });

    updateFormationModalDirtyBadge();
}

function toggleCompleteFormation(formationIndex) {
    const f = formationsData[formationIndex];
    if (!formationPendingProgress) return;

    const talksStatus = formationPendingProgress[f.code] || new Array(f.talks).fill(false);
    const attendedCount = talksStatus.filter(Boolean).length;
    const isComplete = attendedCount === f.talks;

    formationPendingProgress[f.code] = new Array(f.talks).fill(!isComplete);
    formationModalDirty = true;
    renderModalFormations();
}

function updateFormationModalDirtyBadge() {
    const badge = document.getElementById('formationDirtyBadge');
    if (!badge) return;
    badge.classList.toggle('hidden', !formationModalDirty);
}

function persistFormationChanges() {
    const member = members.find(m => m.firebaseId === currentActiveMemberId);
    if (!member || !formationPendingProgress) return;

    const changes = [];
    formationsData.forEach(f => {
        const before = Array.isArray(member.progress && member.progress[f.code]) ? member.progress[f.code] : new Array(f.talks).fill(false);
        const after = formationPendingProgress[f.code] || new Array(f.talks).fill(false);
        const wasComplete = before.filter(Boolean).length === f.talks;
        const isComplete = after.filter(Boolean).length === f.talks;
        if (wasComplete !== isComplete) changes.push({ code: f.code, isComplete });
    });

    member.progress = JSON.parse(JSON.stringify(formationPendingProgress));
    saveMemberToCloud({ ...member });

    changes.forEach(c => {
        if (c.isComplete) {
            logActivity(`Completed formation ${c.code} for ${member.firstName} ${member.lastName}`);
        } else {
            logActivity(`Reset formations for ${member.firstName} ${member.lastName} (${c.code})`);
        }
    });

    formationModalDirty = false;
}

function hideFormationModalEl() {
    document.getElementById('formationModal').classList.add('hidden');
    document.getElementById('formationModal').classList.remove('flex');
    formationPendingProgress = null;
    formationModalDirty = false;
}

function saveAndCloseFormationModal() {
    if (formationModalDirty) persistFormationChanges();
    hideFormationModalEl();
    renderTable();
}

function requestCloseFormationModal() {
    if (formationModalDirty) {
        document.getElementById('formationUnsavedModal').classList.remove('hidden');
        document.getElementById('formationUnsavedModal').classList.add('flex');
    } else {
        hideFormationModalEl();
        renderTable();
    }
}

function cancelFormationUnsavedPrompt() {
    document.getElementById('formationUnsavedModal').classList.add('hidden');
    document.getElementById('formationUnsavedModal').classList.remove('flex');
}

function discardFormationChangesAndClose() {
    cancelFormationUnsavedPrompt();
    hideFormationModalEl();
    renderTable();
}

function saveFormationChangesFromPrompt() {
    persistFormationChanges();
    cancelFormationUnsavedPrompt();
    hideFormationModalEl();
    renderTable();
}

// --- Inline formation progress editor inside the Add/Edit Member modal ---
function toggleAddFormFormationSection() {
    const section = document.getElementById('addFormFormationSection');
    const chevron = document.getElementById('addFormFormationChevron');
    const isHidden = section.classList.contains('hidden');
    section.classList.toggle('hidden');
    chevron.style.transform = isHidden ? 'rotate(180deg)' : 'rotate(0deg)';
}

function updateAddFormFormationCountLabel() {
    const label = document.getElementById('addFormFormationCountLabel');
    if (!label) return;
    let completed = 0;
    formationsData.forEach(f => {
        const arr = addFormProgress[f.code];
        if (Array.isArray(arr) && arr.filter(Boolean).length === f.talks) completed++;
    });
    label.innerText = completed > 0
        ? `${completed} of ${formationsData.length} formations completed`
        : 'Optional — set now to skip a step';
}

function renderAddFormFormationList() {
    const container = document.getElementById('addFormFormationSection');
    if (!container) return;
    container.innerHTML = '';
    updateAddFormFormationCountLabel();

    formationsData.forEach((f, index) => {
        if (!addFormProgress[f.code] || !Array.isArray(addFormProgress[f.code]) || addFormProgress[f.code].length !== f.talks) {
            addFormProgress[f.code] = new Array(f.talks).fill(false);
        }
        const talksStatus = addFormProgress[f.code];
        const attendedCount = talksStatus.filter(Boolean).length;
        const isComplete = attendedCount === f.talks;

        const row = document.createElement('div');
        row.className = "flex items-center justify-between gap-2 p-2.5 border border-pastoral-100 dark:border-slate-700 rounded-lg bg-pastoral-50/50 dark:bg-slate-900";
        row.innerHTML = `
            <div class="min-w-0">
                <span class="font-extrabold text-pastoral-700 dark:text-emerald-400">${f.code}</span>
                <span class="text-slate-600 dark:text-slate-300"> - ${f.label}</span>
                <span class="block text-[10px] text-slate-400">${attendedCount} of ${f.talks} talks</span>
            </div>
            <button type="button" onclick="toggleAddFormFormation(${index})" class="shrink-0 px-3 py-1.5 rounded-lg text-[11px] font-bold transition shadow-xs ${isComplete ? 'bg-emerald-600 hover:bg-emerald-700 text-white' : 'bg-slate-200 dark:bg-slate-700 hover:bg-slate-300 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-200'}">
                ${isComplete ? '✓ Completed' : 'Mark complete'}
            </button>
        `;
        container.appendChild(row);
    });
}

function toggleAddFormFormation(formationIndex) {
    const f = formationsData[formationIndex];
    const talksStatus = addFormProgress[f.code] || new Array(f.talks).fill(false);
    const attendedCount = talksStatus.filter(Boolean).length;
    const isComplete = attendedCount === f.talks;
    addFormProgress[f.code] = new Array(f.talks).fill(!isComplete);
    renderAddFormFormationList();
}

function resetAddFormFormationSection() {
    addFormProgress = {};
    document.getElementById('addFormFormationSection').classList.add('hidden');
    document.getElementById('addFormFormationChevron').style.transform = 'rotate(0deg)';
    renderAddFormFormationList();
}

function openAddModal() {
    document.getElementById('editMemberId').value = '';
    document.getElementById('addModalTitle').innerText = 'Add New Member';
    document.querySelector('#addModal form').reset();
    resetAddFormFormationSection();
    document.getElementById('addModal').classList.remove('hidden');
    document.getElementById('addModal').classList.add('flex');
}

function openEditModal(firebaseId) {
    const member = members.find(m => m.firebaseId === firebaseId);
    document.getElementById('editMemberId').value = member.firebaseId;
    document.getElementById('addModalTitle').innerText = 'Edit Member Information';
    document.getElementById('addLastName').value = member.lastName;
    document.getElementById('addFirstName').value = member.firstName;
    document.getElementById('addNickname').value = member.nickname || '';
    document.getElementById('addGender').value = member.gender || 'Male';
    document.getElementById('addBirthday').value = member.birthday || '';
    document.getElementById('addChapter').value = member.chapter;

    addFormProgress = JSON.parse(JSON.stringify(member.progress || {}));
    document.getElementById('addFormFormationSection').classList.add('hidden');
    document.getElementById('addFormFormationChevron').style.transform = 'rotate(0deg)';
    renderAddFormFormationList();

    document.getElementById('addModal').classList.remove('hidden');
    document.getElementById('addModal').classList.add('flex');
}

function closeAddModal() {
    document.getElementById('addModal').classList.add('hidden');
    document.getElementById('addModal').classList.remove('flex');
}

function handleSaveMember(e) {
    e.preventDefault();
    const editFirebaseId = document.getElementById('editMemberId').value;
    const lastName = document.getElementById('addLastName').value.trim();
    const firstName = document.getElementById('addFirstName').value.trim();
    const nickname = document.getElementById('addNickname').value.trim();
    const gender = document.getElementById('addGender').value;
    const birthday = document.getElementById('addBirthday').value;
    const chapter = document.getElementById('addChapter').value;

    const progressToSave = {};
    formationsData.forEach(f => {
        const existing = addFormProgress[f.code];
        progressToSave[f.code] = (Array.isArray(existing) && existing.length === f.talks)
            ? existing
            : new Array(f.talks).fill(false);
    });

    if (editFirebaseId) {
        const member = members.find(m => m.firebaseId === editFirebaseId);
        if (member) {
            member.lastName = lastName;
            member.firstName = firstName;
            member.nickname = nickname;
            member.gender = gender;
            member.birthday = birthday;
            member.chapter = chapter;
            member.progress = progressToSave;
            logActivity(`Updated info for member: ${lastName}, ${firstName}`);
            saveMemberToCloud({ ...member });
        }
    } else {
        const newMember = {
            lastName: lastName,
            firstName: firstName,
            nickname: nickname,
            gender: gender,
            birthday: birthday,
            chapter: chapter,
            progress: progressToSave
        };
        logActivity(`Added new member: ${lastName}, ${firstName}`);
        saveMemberToCloud(newMember);
        memberPage = 1;
    }

    closeAddModal();
}

function deleteMember(firebaseId) {
    const member = members.find(m => m.firebaseId === firebaseId);
    if (!member) return;
    showConfirmModal(`Are you sure you want to remove ${member.lastName}, ${member.firstName}? This cannot be undone.`, () => {
        logActivity(`Deleted member: ${member.lastName}, ${member.firstName}`);
        deleteMemberFromCloud(firebaseId);
    });
}

// --- Export / Import (full tracker backup) ---
function exportData() {
    const payload = {
        type: 'yfc-pastoral-tracker-backup',
        version: 2,
        exportedAt: new Date().toISOString(),
        members: members,
        finance: financeTransactions,
        calendar: calendarEvents
    };
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(payload, null, 2));
    const tempLink = document.createElement('a');
    tempLink.href = dataStr;
    tempLink.download = `yfc_cluster_backup_${new Date().toISOString().slice(0, 10)}.json`;
    tempLink.click();
    logActivity(`Exported a full data backup (${members.length} members, ${financeTransactions.length} transactions, ${calendarEvents.length} events) to a JSON file.`);
}

function importData(event) {
    const file = event.target.files[0];
    if (!file) return;

    const fileReader = new FileReader();
    fileReader.readAsText(file, "UTF-8");
    fileReader.onload = function (e) {
        let parsed;
        try {
            parsed = JSON.parse(e.target.result);
        } catch (err) {
            alert("Error reading JSON file. Make sure it's a valid backup file.");
            event.target.value = '';
            return;
        }

        let membersToImport = [];
        let financeToImport = [];
        let calendarToImport = [];

        if (Array.isArray(parsed)) {
            membersToImport = parsed;
        } else if (parsed && typeof parsed === 'object') {
            membersToImport = Array.isArray(parsed.members) ? parsed.members : [];
            financeToImport = Array.isArray(parsed.finance) ? parsed.finance : [];
            calendarToImport = Array.isArray(parsed.calendar) ? parsed.calendar : [];
        }

        const totalItems = membersToImport.length + financeToImport.length + calendarToImport.length;
        if (totalItems === 0) {
            alert("This file doesn't contain any recognizable backup data.");
            event.target.value = '';
            return;
        }

        showConfirmModal(`Import ${membersToImport.length} member(s), ${financeToImport.length} transaction(s), and ${calendarToImport.length} event(s) from this file? These will be ADDED to your current data — existing records are kept.`, async () => {
            try {
                const adds = [];
                membersToImport.forEach(m => { const clean = { ...m }; delete clean.firebaseId; adds.push(db.collection("members").add(clean)); });
                financeToImport.forEach(t => { const clean = { ...t }; delete clean.firebaseId; adds.push(db.collection("finance").add(clean)); });
                calendarToImport.forEach(c => { const clean = { ...c }; delete clean.firebaseId; adds.push(db.collection("calendar").add(clean)); });
                await Promise.all(adds);
                logActivity(`Imported ${membersToImport.length} member(s), ${financeToImport.length} transaction(s), ${calendarToImport.length} event(s) from a backup file.`);
                alert("Data successfully imported to cloud!");
            } catch (err) {
                console.error("Error importing data: ", err);
                alert("Error importing data to cloud.");
            }
            event.target.value = '';
        }, { title: 'Confirm Import', confirmLabel: 'Yes, import', variant: 'primary', icon: '📂' });

        event.target.value = '';
    };
}

// Initialize All Realtime Syncs on load
initRealtimeSync();
switchTab('members');
renderHistoryLogs();
renderBackupList();
