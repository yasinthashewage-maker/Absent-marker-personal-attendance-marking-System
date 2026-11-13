/**
 * ABSENT MARKER — ITUM Student Portal
 * Main SPA Controller (Vanilla JS ES6+)
 * ========================================
 * All views are rendered as #id divs inside index.html.
 * API calls go to the Flask backend at the same origin via fetch().
 */

'use strict';

// ============================================================
// GLOBAL STATE
// ============================================================
const APP = {
  token: localStorage.getItem('absentMarkerToken'),
  user: null,
  currentView: 'landing',
  attendanceSummary: [],
  calendarData: {},
  currentYear: 2026,
  currentMonth: 11, // November
  darkMode: localStorage.getItem('darkMode') === 'true',
  modules: [],
  debounceTimer: null    // For search input debounce
};

// Time slots for today's schedule display
const TIME_SLOTS = [
  '08:00 – 09:30',
  '09:45 – 11:15',
  '11:30 – 13:00',
  '14:00 – 15:30',
  '15:45 – 17:15'
];

// Month names for display
const MONTH_NAMES = [
  '', 'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
];

const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const DAY_NAMES_SHORT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];


// ============================================================
// UTILS
// ============================================================

/**
 * Fetch wrapper — adds Authorization header, parses JSON, throws on error.
 * @param {string} endpoint  e.g. '/api/auth/me'
 * @param {string} [method='GET']
 * @param {object|null} [body=null]  Body will be JSON-stringified
 * @returns {Promise<any>} Parsed JSON response
 */
async function apiCall(endpoint, method = 'GET', body = null) {
  const headers = { 'Content-Type': 'application/json' };
  if (APP.token) headers['Authorization'] = `Bearer ${APP.token}`;

  const options = { method, headers };
  if (body) options.body = JSON.stringify(body);

  const res = await fetch(endpoint, options);
  const data = await res.json().catch(() => ({}));

  if (!res.ok) {
    const msg = data.error || data.message || `HTTP ${res.status}`;
    throw new Error(msg);
  }
  return data;
}

/**
 * Show a toast notification at the bottom-right corner.
 * @param {string} message
 * @param {'success'|'error'|'info'|'warning'} [type='info']
 */
function showToast(message, type = 'info') {
  let container = document.getElementById('toast-container');
  if (!container) {
    container = document.createElement('div');
    container.id = 'toast-container';
    container.style.cssText = `
      position:fixed; bottom:1.5rem; right:1.5rem; z-index:9999;
      display:flex; flex-direction:column; gap:0.5rem;
    `;
    document.body.appendChild(container);
  }

  const colorMap = {
    success: '#22c55e',
    error:   '#ef4444',
    warning: '#f59e0b',
    info:    '#3b82f6'
  };
  const iconMap = {
    success: '✓',
    error:   '✕',
    warning: '⚠',
    info:    'ℹ'
  };

  const toast = document.createElement('div');
  toast.style.cssText = `
    background:#1e293b; color:#f1f5f9;
    border-left:4px solid ${colorMap[type] || colorMap.info};
    padding:0.75rem 1.25rem; border-radius:0.5rem;
    display:flex; align-items:center; gap:0.75rem;
    box-shadow:0 4px 12px rgba(0,0,0,0.3);
    min-width:220px; max-width:380px;
    font-size:0.875rem; line-height:1.4;
    animation: slideInToast 0.3s ease;
  `;
  toast.innerHTML = `
    <span style="color:${colorMap[type] || colorMap.info}; font-weight:bold;">${iconMap[type] || 'ℹ'}</span>
    <span>${message}</span>
  `;

  // Inject keyframe once
  if (!document.getElementById('toast-style')) {
    const s = document.createElement('style');
    s.id = 'toast-style';
    s.textContent = `
      @keyframes slideInToast { from { opacity:0; transform:translateX(2rem); } to { opacity:1; transform:translateX(0); } }
      @keyframes fadeOutToast { from { opacity:1; } to { opacity:0; transform:translateX(2rem); } }
    `;
    document.head.appendChild(s);
  }

  container.appendChild(toast);
  setTimeout(() => {
    toast.style.animation = 'fadeOutToast 0.4s ease forwards';
    setTimeout(() => toast.remove(), 400);
  }, 3000);
}

/**
 * Format "2026-11-12" -> "Thursday, 12 November 2026"
 * @param {string} dateStr  YYYY-MM-DD
 * @returns {string}
 */
function formatDate(dateStr) {
  const [y, m, d] = dateStr.split('-').map(Number);
  const date = new Date(y, m - 1, d);
  return `${DAY_NAMES[date.getDay()]}, ${d} ${MONTH_NAMES[m]} ${y}`;
}

/**
 * Get today's date string as YYYY-MM-DD
 * @returns {string}
 */
function todayStr() {
  const t = new Date();
  const y = t.getFullYear();
  const m = String(t.getMonth() + 1).padStart(2, '0');
  const d = String(t.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/**
 * Returns a CSS colour string based on attendance percentage.
 * @param {number} pct
 * @returns {string}
 */
function getStatusColor(pct) {
  if (pct >= 85) return '#22c55e';   // green
  if (pct >= 80) return '#f59e0b';   // yellow/amber
  return '#ef4444';                   // red
}

/**
 * Returns formatted percentage string e.g. "86.5%"
 * @param {number} n
 * @returns {string}
 */
function formatPct(n) {
  return `${Number(n).toFixed(1)}%`;
}

/**
 * Returns the ISO week number for a given Date.
 * @param {Date} date
 * @returns {number}
 */
function getWeekNumber(date) {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  d.setUTCDate(d.getUTCDate() + 4 - (d.getUTCDay() || 7));
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  return Math.ceil((((d - yearStart) / 86400000) + 1) / 7);
}


// ============================================================
// INIT & DARK MODE
// ============================================================

/**
 * Apply dark mode from localStorage on page load.
 */
function initDarkMode() {
  if (APP.darkMode) {
    document.body.classList.add('dark-mode');
  } else {
    document.body.classList.remove('dark-mode');
  }
  document.querySelectorAll('.dark-mode-toggle').forEach(btn => {
    btn.textContent = APP.darkMode ? '☀️' : '🌙';
    btn.title = APP.darkMode ? 'Switch to Light Mode' : 'Switch to Dark Mode';
  });
}

/**
 * Toggle dark mode on/off, save to localStorage.
 */
function toggleDarkMode() {
  APP.darkMode = !APP.darkMode;
  localStorage.setItem('darkMode', APP.darkMode);
  initDarkMode();
}

/**
 * Show a named view, hide all others, update active nav links.
 * @param {string} viewId  e.g. 'dashboard', 'calendar'
 */
function showView(viewId) {
  APP.currentView = viewId;

  const landing = document.getElementById('landing-view');
  const shell = document.getElementById('app-shell');

  if (viewId === 'landing') {
    if (landing) {
      landing.style.display = '';
      landing.classList.add('active');
    }
    if (shell) {
      shell.classList.add('hidden');
      shell.style.display = 'none';
    }
  } else {
    if (landing) {
      landing.style.display = 'none';
      landing.classList.remove('active');
    }
    if (shell) {
      shell.classList.remove('hidden');
      shell.style.display = '';
    }

    // Toggle subviews
    document.querySelectorAll('.sub-view-section, .view-section').forEach(el => {
      if (el.id !== 'landing-view') {
        el.classList.add('hidden');
        el.style.display = 'none';
      }
    });

    const target = document.getElementById(`view-${viewId}`) || document.getElementById(`${viewId}-view`) || document.getElementById(viewId);
    if (target) {
      target.classList.remove('hidden');
      target.style.display = '';
      target.classList.add('active');
    }
  }

  // Update nav active state
  document.querySelectorAll('[data-nav]').forEach(link => {
    link.classList.toggle('active', link.dataset.nav === viewId);
  });
}

/**
 * Application entry point. Always starts on the landing view so users can
 * choose to sign in or register before entering the dashboard.
 */
function initApp() {
  initDarkMode();
  showView('landing');
}


// ============================================================
// AUTH FUNCTIONS
// ============================================================

/**
 * Show the sign-in/register modal and activate the correct tab.
 * @param {'signin'|'register'} [tab='signin']
 */
function showSignInModal(tab = 'signin') {
  const modal = document.getElementById('signin-modal');
  if (!modal) return;
  modal.style.display = 'flex';
  modal.classList.add('open');
  modal.classList.remove('hidden');

  document.querySelectorAll('#signin-modal .modal-tab').forEach(t => {
    t.classList.toggle('active', t.dataset.tab === tab);
  });
  document.querySelectorAll('#signin-modal .tab-panel').forEach(p => {
    p.style.display = p.id === `tab-${tab}` ? '' : 'none';
  });
}

/**
 * Close a modal by its ID.
 * @param {string} modalId
 */
function closeModal(modalId) {
  const modal = document.getElementById(modalId);
  if (!modal) return;
  modal.style.display = 'none';
  modal.classList.remove('open');
  modal.classList.add('hidden');
  modal.setAttribute('aria-hidden', 'true');
}

/**
 * Handle sign-in form submission.
 * @param {Event} e
 */
async function handleSignIn(e) {
  e.preventDefault();
  const form = e.target;
  const email    = form.querySelector('#signin-email')?.value.trim();
  const password = form.querySelector('#signin-password')?.value;

  if (!email || !password) {
    showToast('Please fill in all fields.', 'warning');
    return;
  }

  try {
    const data = await apiCall('/api/auth/login', 'POST', { email, password });
    APP.token = data.token;
    APP.user  = data.student || data.user;
    localStorage.setItem('absentMarkerToken', APP.token);
    closeModal('signin-modal');
    await loadDashboard();
    showToast(`Welcome back, ${APP.user.full_name || 'Student'}!`, 'success');
  } catch (err) {
    showToast(err.message || 'Sign in failed. Check your credentials.', 'error');
  }
}

/**
 * Handle registration form submission.
 * @param {Event} e
 */
async function handleRegister(e) {
  e.preventDefault();
  const form = e.target;
  const full_name  = form.querySelector('#reg-name')?.value.trim();
  const email      = form.querySelector('#reg-email')?.value.trim();
  const password   = form.querySelector('#reg-password')?.value;
  const reg_number = form.querySelector('#reg-number')?.value.trim();

  if (!full_name || !email || !password) {
    showToast('Please fill in all required fields.', 'warning');
    return;
  }

  try {
    const data = await apiCall('/api/auth/register', 'POST', { full_name, email, password, reg_number });
    APP.token = data.token;
    APP.user  = data.student || data.user;
    localStorage.setItem('absentMarkerToken', APP.token);
    closeModal('signin-modal');
    await loadDashboard();
    showToast(`Account created! Welcome, ${APP.user.full_name}!`, 'success');
  } catch (err) {
    showToast(err.message || 'Registration failed. Try again.', 'error');
  }
}

/**
 * Handle logout — clears token and app state, returns to landing view.
 */
function handleLogout() {
  localStorage.removeItem('absentMarkerToken');
  APP.token = null;
  APP.user  = null;
  APP.attendanceSummary = [];
  APP.calendarData = {};
  showView('landing');
  showToast('You have been signed out.', 'info');
}


// ============================================================
// DASHBOARD
// ============================================================

/**
 * Load all data for the dashboard and render all dashboard widgets.
 */
async function loadDashboard() {
  showView('dashboard');

  try {
    const [meData, summaryData, configData] = await Promise.all([
      apiCall('/api/auth/me'),
      apiCall('/api/attendance/summary'),
      apiCall('/api/semester/config')
    ]);

    APP.user = meData.student || meData;
    APP.attendanceSummary = summaryData.modules || summaryData || [];
    APP.semesterConfig = configData;
    APP.modules = APP.attendanceSummary;

    updateStatusBanner(configData);
    renderTodaySchedule();
    renderAttendanceChart();
  } catch (err) {
    showToast(`Dashboard error: ${err.message}`, 'error');
  }
}

/**
 * Update the dashboard status banner with greeting, date, week, and eligibility.
 * @param {object} [config]  Semester config from API
 */
function updateStatusBanner(config) {
  const user = APP.user;
  if (!user) return;

  const today = new Date();
  const dateFormatted = today.toLocaleDateString('en', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric'
  });
  const weekNum = config?.current_week || getWeekNumber(today);
  const threshold = Number(config?.threshold) || 80;
  const eligibleCount = APP.attendanceSummary.filter(m => (m.attendance_pct || 0) >= threshold).length;
  const firstName = (user.full_name || 'Student').split(' ')[0];
  const suffix = weekNum % 100 >= 11 && weekNum % 100 <= 13
    ? 'th'
    : ({ 1: 'st', 2: 'nd', 3: 'rd' }[weekNum % 10] || 'th');

  const greetingEl = document.getElementById('dashboard-greeting-text');
  if (greetingEl) {
    greetingEl.textContent = `Hi ${firstName}! Today is ${dateFormatted} — This is the ${weekNum}${suffix} week`;
  }

  const statusEl = document.getElementById('dashboard-status-text');
  if (statusEl) {
    statusEl.textContent = `Your attendance meets the ${threshold}% exam threshold in ${eligibleCount} of ${APP.attendanceSummary.length} modules. Check borderline warnings below.`;
  }

  const dayName = today.toLocaleDateString('en', { weekday: 'long' });
  const timetableTitle = document.getElementById('today-timetable-title');
  if (timetableTitle) timetableTitle.textContent = `${dayName} Timetable & Day Status`;

  const timetableSubtitle = document.getElementById('today-timetable-subtitle');
  if (timetableSubtitle) timetableSubtitle.textContent = `Scheduled ITUM lectures for today (${dateFormatted})`;

  const logDate = today.toLocaleDateString('en', { month: 'short', day: 'numeric' });
  document.querySelectorAll('#dashboard-log-attendance, #timetable-log-attendance').forEach(button => {
    button.textContent = `▣  Log Today's Attendance (${logDate})`;
  });

  const userNameEl = document.getElementById('nav-user-name');
  if (userNameEl) userNameEl.textContent = firstName;
  const sidebarNameEl = document.getElementById('sidebar-user-fullname');
  if (sidebarNameEl) sidebarNameEl.textContent = user.full_name || 'Student';
  const sidebarAvatar = document.querySelector('.sidebar-avatar-large');
  if (sidebarAvatar) {
    sidebarAvatar.textContent = (user.full_name || 'S').split(/\s+/).slice(0, 2).map(name => name[0]).join('').toUpperCase();
  }
}

/**
 * Render today's module schedule widget with time slots and attendance badges.
 */
function renderTodaySchedule() {
  const container = document.getElementById('today-schedule');
  if (!container) return;

  const summary = APP.attendanceSummary;
  container.replaceChildren();
  if (!summary.length) {
    const empty = document.createElement('p');
    empty.className = 'schedule-empty-state';
    empty.textContent = 'No modules scheduled today.';
    container.appendChild(empty);
    return;
  }

  const todayModules = summary.slice(0, Math.min(3, summary.length));
  todayModules.forEach((mod, i) => {
    const pct = Number(mod.attendance_pct) || 0;
    const status = pct >= 85 ? 'Safe' : pct >= 80 ? 'Warning' : 'Critical';
    const slot = TIME_SLOTS[i] || `${8 + i * 2}:00 – ${9 + i * 2}:30`;
    const card = document.createElement('article');
    card.className = 'schedule-card';

    const meta = document.createElement('div');
    meta.className = 'schedule-card-meta';
    const code = document.createElement('span');
    code.className = 'schedule-code';
    code.textContent = mod.code || '';
    const time = document.createElement('span');
    time.className = 'schedule-time';
    time.textContent = slot;
    meta.append(code, time);

    const name = document.createElement('h3');
    name.className = 'schedule-name';
    name.textContent = mod.name || 'Module';

    const attendance = document.createElement('div');
    attendance.className = 'schedule-attendance';
    const attendanceText = document.createElement('span');
    attendanceText.append('Current Attendance: ');
    const percentage = document.createElement('strong');
    percentage.textContent = formatPct(pct);
    attendanceText.appendChild(percentage);
    const badge = document.createElement('span');
    badge.className = `schedule-status schedule-status-${status.toLowerCase()}`;
    badge.textContent = status;
    attendance.append(attendanceText, badge);

    card.append(meta, name, attendance);
    container.appendChild(card);
  });
}

/**
 * Render attendance bars and module labels for the dashboard chart.
 */
function renderAttendanceChart() {
  const barsContainer = document.getElementById('chart-bars-container');
  const labelsContainer = document.getElementById('chart-labels-container');
  if (!barsContainer || !labelsContainer) return;

  barsContainer.replaceChildren();
  labelsContainer.replaceChildren();

  APP.attendanceSummary.forEach(module => {
    const pct = Math.max(0, Math.min(100, Number(module.attendance_pct) || 0));
    const column = document.createElement('div');
    column.className = 'attendance-bar-column';
    column.setAttribute('role', 'listitem');
    column.setAttribute('aria-label', `${module.name || module.code || 'Module'}: ${formatPct(pct)}`);

    const bar = document.createElement('div');
    bar.className = 'attendance-bar-fill';
    bar.style.height = `${pct}%`;
    bar.style.backgroundColor = getStatusColor(pct);
    bar.dataset.value = formatPct(pct);
    column.appendChild(bar);
    barsContainer.appendChild(column);

    const label = document.createElement('div');
    label.className = 'chart-module-label';
    const moduleName = document.createElement('span');
    moduleName.textContent = module.name || module.code || 'Module';
    const moduleCode = document.createElement('small');
    moduleCode.textContent = module.code || '';
    label.append(moduleName, moduleCode);
    labelsContainer.appendChild(label);
  });
}


// ============================================================
// CALENDAR
// ============================================================

/**
 * Fetch calendar data for a given year/month and render the calendar.
 * @param {number} year
 * @param {number} month  1-indexed
 */
async function loadCalendar(year, month) {
  APP.currentYear  = year;
  APP.currentMonth = month;

  const label = document.getElementById('calendar-month-label');
  if (label) label.textContent = `${MONTH_NAMES[month]} ${year}`;

  try {
    const data = await apiCall(`/api/attendance/calendar/${year}/${month}`);
    APP.calendarData      = data.dates    || {};
    APP.calendarHolidays  = data.holidays || [];
    renderCalendar();
    renderCalendarFooter();
  } catch (err) {
    showToast(`Calendar error: ${err.message}`, 'error');
  }
}

/**
 * Build the Monday-first monthly calendar grid and its attendance status labels.
 */
function renderCalendar() {
  const grid = document.getElementById('calendar-grid');
  if (!grid) return;

  const year  = APP.currentYear;
  const month = APP.currentMonth;
  const today = todayStr();

  const holidayMap = {};
  (APP.calendarHolidays || []).forEach(h => { holidayMap[h.date] = h.name; });

  const firstDay  = (new Date(year, month - 1, 1).getDay() + 6) % 7;
  const totalDays = new Date(year, month, 0).getDate();
  const calendarDays = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

  const dayHeader = calendarDays.map(d =>
    `<div class="cal-header-cell">${d}</div>`
  ).join('');

  let cells = '';
  for (let i = 0; i < firstDay; i++) {
    cells += `<div class="cal-cell cal-empty"></div>`;
  }

  for (let day = 1; day <= totalDays; day++) {
    const dateStr   = `${year}-${String(month).padStart(2,'0')}-${String(day).padStart(2,'0')}`;
    const dayOfWeek = new Date(year, month - 1, day).getDay();
    const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
    const isToday   = dateStr === today;
    const isHoliday = !!holidayMap[dateStr];
    const isFuture  = dateStr > today;

    const dayInfo = APP.calendarData[dateStr];
    const status  = dayInfo?.day_status || (isWeekend ? 'weekend' : '');

    let classes = 'cal-cell';
    if (isToday)   classes += ' day-today';
    if (isWeekend) classes += ' day-weekend';
    if (isHoliday) classes += ' day-holiday';
    if (isFuture)  classes += ' day-future';
    if (!isWeekend && !isHoliday && !isFuture) {
      if (status === 'all_present')  classes += ' day-present';
      else if (status === 'safe_mc') classes += ' day-safe-mc';
      else if (status === 'absent')  classes += ' day-absent';
      else if (status === 'no_class') classes += ' day-no-class';
    }

    const clickable = !isFuture && !isWeekend && !isHoliday;
    const clickAttr = clickable
      ? `onclick="openDayModal('${dateStr}')" role="button" tabindex="0"`
      : '';

    let statusText = '';
    let statusClass = '';
    if (isHoliday) {
      statusText = holidayMap[dateStr];
      statusClass = 'cal-status-holiday';
    } else if (isWeekend) {
      statusText = 'Weekend';
      statusClass = 'cal-status-weekend';
    } else if (status === 'all_present') {
      statusText = '✓ All Present';
      statusClass = 'cal-status-present';
    } else if (status === 'safe_mc') {
      statusText = 'Safe Absent';
      statusClass = 'cal-status-safe';
    } else if (status === 'absent') {
      statusText = 'Absent';
      statusClass = 'cal-status-absent';
    }

    const statusMarkup = statusText
      ? `<span class="cal-status-chip ${statusClass}">${statusText}</span>`
      : '';
    const todayMarkup = isToday ? '<span class="cal-today-chip">Today</span>' : '';

    cells += `
      <div class="${classes}" ${clickAttr} data-date="${dateStr}" aria-label="${dateStr}${statusText ? `, ${statusText}` : ''}">
        <div class="cal-cell-header">
          <span class="cal-day-num">${day}</span>
          ${todayMarkup}
        </div>
        ${statusMarkup}
      </div>
    `;
  }

  grid.innerHTML = `
    <div class="cal-header-row" style="display:grid; grid-template-columns:repeat(7,1fr); gap:4px; margin-bottom:4px;">
      ${dayHeader}
    </div>
    <div class="cal-days-grid" style="display:grid; grid-template-columns:repeat(7,1fr); gap:4px;">
      ${cells}
    </div>
  `;
}

/**
 * Navigate to the previous month.
 */
function prevMonth() {
  let m = APP.currentMonth - 1;
  let y = APP.currentYear;
  if (m < 1) { m = 12; y--; }
  loadCalendar(y, m);
}

/**
 * Navigate to the next month.
 */
function nextMonth() {
  let m = APP.currentMonth + 1;
  let y = APP.currentYear;
  if (m > 12) { m = 1; y++; }
  loadCalendar(y, m);
}

/**
 * Render the calendar footer with conducted weekday, weekend, and holiday counts.
 */
function renderCalendarFooter() {
  const footer = document.getElementById('calendar-footer');
  if (!footer) return;

  const year      = APP.currentYear;
  const month     = APP.currentMonth;
  const totalDays = new Date(year, month, 0).getDate();
  const today     = todayStr();
  const holidaySet = new Set((APP.calendarHolidays || []).map(h => h.date));

  let weekends = 0, holidays = 0, conducted = 0;

  for (let d = 1; d <= totalDays; d++) {
    const dateStr = `${year}-${String(month).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
    const dow = new Date(year, month - 1, d).getDay();
    if (dow === 0 || dow === 6) {
      weekends++;
    } else if (holidaySet.has(dateStr)) {
      holidays++;
    } else {
      if (dateStr <= today && APP.calendarData[dateStr]?.day_status !== 'no_class') {
        conducted++;
      }
    }
  }

  footer.innerHTML = `
    <div class="cal-stat-item"><span class="cal-stat-dot dot-green"></span><span>Conducted Weekdays: <strong>${conducted} Days</strong></span></div>
    <div class="cal-stat-item"><span class="cal-stat-dot dot-gray"></span><span>Weekends (Auto-Skipped): <strong>${weekends} Days</strong></span></div>
    <div class="cal-stat-item"><span class="cal-stat-dot dot-purple"></span><span>Public Holidays: <strong>${holidays} Days</strong></span></div>
  `;
}


// ============================================================
// DAY MODAL
// ============================================================

/**
 * Open the day modal for a specific date.
 * @param {string} dateStr  YYYY-MM-DD
 */
function openDayModal(dateStr) {
  const modal = document.getElementById('day-modal');
  if (!modal) return;

  const titleEl = document.getElementById('day-modal-title');
  if (titleEl) titleEl.textContent = formatDate(dateStr);

  const dateInput = document.getElementById('day-modal-date');
  if (dateInput) dateInput.value = dateStr;

  const rowsContainer = document.getElementById('day-modal-rows');
  if (!rowsContainer) return;

  const dayInfo = APP.calendarData[dateStr];
  const existingRecords = dayInfo?.modules || [];

  const recordMap = {};
  existingRecords.forEach(r => { recordMap[r.module_id] = r; });

  const modules = APP.attendanceSummary;
  if (!modules.length) {
    rowsContainer.innerHTML = '<p class="empty-state">No modules configured.</p>';
  } else {
    rowsContainer.innerHTML = modules.map(mod => {
      const rec    = recordMap[mod.module_id] || {};
      const status = rec.status || 'no_class';
      return initModuleRow(mod, status, rec);
    }).join('');
  }

  modal.style.display = 'flex';
  modal.classList.add('open');
  modal.classList.remove('hidden');
  modal.setAttribute('aria-hidden', 'false');
}

/**
 * Build HTML for one module row in the day modal.
 * @param {object} module       Module summary object
 * @param {string} currentStatus  'present'|'absent'|'no_class'
 * @param {object} [record={}]  Existing attendance record
 * @returns {string} HTML string
 */
function initModuleRow(module, currentStatus, record = {}) {
  const isMC   = record.is_medical ? 'checked' : '';
  const mcRef  = record.mc_reference || '';
  const showMC = currentStatus === 'absent' ? '' : 'display:none;';

  const statusBtn = (val, label, icon) => {
    const isActive = currentStatus === val ? 'btn-status-active' : '';
    return `<button type="button"
      class="btn-status ${isActive}"
      data-status="${val}"
      data-module-id="${module.module_id}"
      onclick="selectModuleStatus(this, '${module.module_id}')">
      ${icon} ${label}
    </button>`;
  };

  return `
    <div class="day-modal-row" id="row-mod-${module.module_id}" data-module-id="${module.module_id}">
      <div class="day-modal-row-header">
        <span class="mod-code">${module.code}</span>
        <span class="mod-name">${module.name}</span>
      </div>
      <div class="btn-status-group">
        ${statusBtn('present',  'Present',  '✓')}
        ${statusBtn('absent',   'Absent',   '✗')}
        ${statusBtn('no_class', 'No Class', '—')}
      </div>
      <div class="mc-section" id="mc-${module.module_id}" style="${showMC}">
        <label class="mc-label">
          <input type="checkbox" class="mc-toggle" data-module-id="${module.module_id}" ${isMC}>
          Mark as Medical Certificate (MC)
        </label>
        <input type="text" class="mc-ref-input"
          placeholder="MC Reference e.g. MC-ITUM-2026-001"
          data-module-id="${module.module_id}"
          value="${mcRef}">
      </div>
    </div>
  `;
}

/**
 * Handle status button selection within a module row.
 * @param {HTMLElement} btn
 * @param {string|number} moduleId
 */
function selectModuleStatus(btn, moduleId) {
  const row = document.getElementById(`row-mod-${moduleId}`);
  if (!row) return;

  row.querySelectorAll('.btn-status').forEach(b => b.classList.remove('btn-status-active'));
  btn.classList.add('btn-status-active');

  const mcSection = document.getElementById(`mc-${moduleId}`);
  if (mcSection) {
    const isAbsent = btn.dataset.status === 'absent';
    mcSection.style.display = isAbsent ? '' : 'none';
    if (!isAbsent) {
      const toggle = mcSection.querySelector('.mc-toggle');
      if (toggle) toggle.checked = false;
    }
  }
}

/**
 * Collect all module statuses from the day modal and POST to backend.
 */
async function saveDayAttendance() {
  const dateInput = document.getElementById('day-modal-date');
  if (!dateInput) return;
  const date = dateInput.value;

  const records = [];
  document.querySelectorAll('.day-modal-row').forEach(row => {
    const moduleId  = parseInt(row.dataset.moduleId, 10);
    const activeBtn = row.querySelector('.btn-status-active');
    if (!activeBtn) return;

    const status      = activeBtn.dataset.status;
    const mcToggle    = row.querySelector('.mc-toggle');
    const mcRefInput  = row.querySelector('.mc-ref-input');
    const isMedical   = mcToggle?.checked ? 1 : 0;
    const mcRef       = mcRefInput?.value.trim() || '';

    records.push({ module_id: moduleId, status, is_medical: isMedical, mc_reference: mcRef });
  });

  try {
    await apiCall('/api/attendance/log', 'POST', { date, records });
    closeModal('day-modal');
    showToast('Attendance saved!', 'success');

    // Refresh summary and affected views
    const summaryData = await apiCall('/api/attendance/summary');
    APP.attendanceSummary = summaryData.modules || summaryData || [];
    APP.modules = APP.attendanceSummary;

    await loadCalendar(APP.currentYear, APP.currentMonth);
    if (APP.currentView === 'modules') renderModulesTable(APP.attendanceSummary);
    if (APP.currentView === 'risk')    renderRiskCards(APP.attendanceSummary, currentRiskFilter());
    if (APP.currentView === 'dashboard') {
      updateStatusBanner(APP.semesterConfig);
      renderAttendanceChart();
    }
  } catch (err) {
    showToast(`Save failed: ${err.message}`, 'error');
  }
}

/**
 * Set all module status buttons in the day modal to "Present".
 */
function markAllPresent() {
  document.querySelectorAll('.day-modal-row').forEach(row => {
    const presentBtn = row.querySelector('.btn-status[data-status="present"]');
    if (presentBtn) selectModuleStatus(presentBtn, row.dataset.moduleId);
  });
}

/** Returns the currently active risk filter value. */
function currentRiskFilter() {
  const active = document.querySelector('.tab-chip.active[data-risk-filter]');
  const filter = active?.dataset.riskFilter || 'all';
  return filter === 'warning' ? 'borderline' : filter;
}


// ============================================================
// MODULES TABLE
// ============================================================

/**
 * Load attendance summary and render the modules table view.
 */
async function loadModules() {
  showView('modules');
  try {
    const data = await apiCall('/api/attendance/summary');
    APP.attendanceSummary = data.modules || data || [];
    APP.modules = APP.attendanceSummary;
    renderModulesTable(APP.attendanceSummary);
  } catch (err) {
    showToast(`Modules error: ${err.message}`, 'error');
  }
}

/**
 * Render the full modules attendance table.
 * @param {Array} data  Module summary objects
 */
function renderModulesTable(data) {
  const tbody = document.getElementById('modules-tbody');
  if (!tbody) return;

  if (!data.length) {
    tbody.innerHTML = '<tr><td colspan="11" class="empty-state">No modules found.</td></tr>';
    return;
  }

  const shortNameByCode = {
    IT2101: 'Maths',
    IT2102: 'Web Tech',
    IT2103: 'OOAD',
    IT2104: 'Network',
    IT2105: 'SE',
    IT2106: 'Digital Electronics',
    IT2107: 'OOP',
    IT2108: 'Digital Forensic',
    CM2101: 'English',
    CM2102: 'Aesthetic'
  };

  tbody.innerHTML = data.map(mod => {
    const pct    = mod.attendance_pct || 0;
    const color  = getStatusColor(pct);
    const status = mod.status || (pct >= 85 ? 'Eligible' : pct >= 80 ? 'Warning' : 'Critical');
    const shortName = shortNameByCode[mod.code] || mod.name;
    const statusClass = status.toLowerCase();
    const allowedLeft = Number(mod.allowed_left) || 0;
    const allowedClass = allowedLeft > 1 ? 'safe' : allowedLeft === 1 ? 'warning' : 'critical';
    const percent = Number.isInteger(Number(pct)) ? Number(pct).toFixed(0) : Number(pct).toFixed(1);

    return `
      <tr data-module-id="${mod.module_id}"
          data-search="${(mod.code + ' ' + shortName + ' ' + mod.name).toLowerCase()}">
        <td class="module-name-cell">
          <strong class="module-name-title">${shortName}</strong>
          <span class="module-name-description">${mod.name}</span>
          <small class="module-name-code">${mod.code}</small>
        </td>
        <td class="module-value">${mod.credits}</td>
        <td class="module-value">${mod.conducted || 0}</td>
        <td class="module-value module-value--present">${mod.present || 0}</td>
        <td class="module-value module-value--unexcused">${mod.absent_unexcused || 0}</td>
        <td class="module-value module-value--medical">${mod.absent_mc || 0}</td>
        <td class="module-value">${mod.effective_total || mod.conducted || 0}</td>
        <td class="module-value module-attendance" style="--attendance-color:${color};">${percent}%</td>
        <td class="module-value">
          <span class="module-allowed-pill module-allowed-pill--${allowedClass}">${allowedLeft} left</span>
        </td>
        <td class="module-value">
          <span class="module-status module-status--${statusClass}">${status}</span>
        </td>
        <td class="module-value">
          <button class="module-log-button" onclick="openDayModal('${todayStr()}')">Log</button>
        </td>
      </tr>
    `;
  }).join('');
}

/**
 * Filter visible module rows by search query (debounced from input).
 * @param {string} query
 */
function filterModules(query) {
  const q = query.toLowerCase().trim();
  document.querySelectorAll('#modules-tbody tr[data-search]').forEach(row => {
    row.style.display = (!q || row.dataset.search.includes(q)) ? '' : 'none';
  });
}

/**
 * Export attendance data as a CSV file and trigger browser download.
 */
function exportReport() {
  const data = APP.attendanceSummary;
  if (!data.length) {
    showToast('No data to export.', 'warning');
    return;
  }

  const header = [
    'Code', 'Name', 'Credits', 'Conducted', 'Present',
    'Absent (Unexcused)', 'Absent (MC)', 'Effective Total', 'Attendance %', 'Status'
  ];
  const rows = data.map(m => [
    m.code,
    `"${m.name}"`,
    m.credits,
    m.conducted,
    m.present,
    m.absent_unexcused,
    m.absent_mc,
    m.effective_total || m.conducted,
    formatPct(m.attendance_pct || 0),
    m.status
  ]);

  const csv  = [header.join(','), ...rows.map(r => r.join(','))].join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url  = URL.createObjectURL(blob);

  const a = document.createElement('a');
  a.href = url;
  a.download = `absent-marker-report-${todayStr()}.csv`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
  showToast('Report exported as CSV!', 'success');
}


// ============================================================
// RISK VIEW
// ============================================================

/**
 * Load the risk view — reloads summary if needed, renders cards + simulator.
 */
async function loadRiskView() {
  showView('risk');

  if (!APP.attendanceSummary.length) {
    try {
      const data = await apiCall('/api/attendance/summary');
      APP.attendanceSummary = data.modules || data || [];
      APP.modules = APP.attendanceSummary;
    } catch (err) {
      showToast(`Risk view error: ${err.message}`, 'error');
      return;
    }
  }

  renderRiskCards(APP.attendanceSummary, 'all');
  initSimulator();
}

/**
 * Render risk cards for modules below 85% attendance.
 * @param {Array} modules
 * @param {'all'|'borderline'|'critical'} [filter='all']
 */
function renderRiskCards(modules, filter = 'all') {
  const container = document.getElementById('risk-cards-container');
  if (!container) return;

  const borderlineCount = modules.filter(m => {
    const pct = m.attendance_pct || 0;
    return pct >= 80 && pct < 85;
  }).length;
  const borderlineCountLabel = document.getElementById('risk-borderline-count');
  if (borderlineCountLabel) {
    borderlineCountLabel.textContent = `${borderlineCount} subject${borderlineCount === 1 ? '' : 's'}`;
  }

  let atRisk = modules.filter(m => (m.attendance_pct || 0) < 85);

  if (filter === 'borderline') {
    atRisk = atRisk.filter(m => (m.attendance_pct || 0) >= 80);
  } else if (filter === 'critical') {
    atRisk = atRisk.filter(m => (m.attendance_pct || 0) < 80);
  }

  if (!atRisk.length) {
    container.innerHTML = `<div class="empty-state risk-empty-state">
      🎉 No modules at risk${filter !== 'all' ? ` in this category` : ''}.
    </div>`;
    return;
  }

  container.innerHTML = atRisk.map(mod => {
    const pct         = mod.attendance_pct || 0;
    const buffer      = calculateBuffer(mod);
    const isCritical  = pct < 80;
    const cardClass   = isCritical ? 'risk-card-critical' : 'risk-card-borderline';
    const bufferText  = isCritical
      ? 'This module is already below the 80% exam eligibility threshold.'
      : buffer > 0
        ? `Only ${buffer} more unexcused absence${buffer === 1 ? '' : 's'} allowed before dropping below 80%.`
        : 'No more unexcused absences allowed before dropping below 80%.';

    return `
      <article class="risk-card ${cardClass}">
        <header class="risk-card-header">
          <div class="risk-card-heading">
            <h3 class="risk-card-title">${mod.name}</h3>
            <div class="risk-card-meta">${mod.code} · ${mod.credits} Credits</div>
          </div>
          <span class="risk-card-percentage">${formatPct(pct)}</span>
        </header>
        <div class="risk-card-stats">
          <div class="risk-stat">
            <strong>${mod.present || 0}</strong>
            <span>Attended</span>
          </div>
          <div class="risk-stat">
            <strong>${mod.absent_unexcused || 0}</strong>
            <span>Unexcused</span>
          </div>
          <div class="risk-stat">
            <strong>${mod.absent_mc || 0}</strong>
            <span>Safe (MC)</span>
          </div>
        </div>
        <div class="risk-buffer ${isCritical ? 'risk-buffer-critical' : ''}">
          <span aria-hidden="true">${isCritical ? '🚨' : '⚠️'}</span>
          <span>Buffer: ${bufferText}</span>
        </div>
        <footer class="risk-card-footer">
          <span>Conducted: ${mod.conducted || 0}</span>
          <button type="button" class="risk-log-button" onclick="openDayModal('${todayStr()}')">Log Attendance</button>
        </footer>
      </article>
    `;
  }).join('');
}

/**
 * Calculate how many more unexcused absences are allowed before dropping below 80%.
 * @param {object} module  Module summary object
 * @returns {number}
 */
function calculateBuffer(module) {
  const effectiveTotal  = module.effective_total || module.conducted || 0;
  const present         = module.present || 0;
  const minPresent      = Math.ceil(effectiveTotal * 0.80);
  return Math.max(0, present - minPresent);
}

/**
 * Populate the risk simulator dropdown with at-risk modules and attach events.
 */
function initSimulator() {
  const select = document.getElementById('simulator-module-select');
  if (!select) return;

  const atRisk = APP.attendanceSummary.filter(m => (m.attendance_pct || 0) < 85);

  if (atRisk.length) {
    select.innerHTML = atRisk.map(m =>
      `<option value="${m.module_id}">${m.code} — ${m.name}</option>`
    ).join('');
  } else {
    select.innerHTML = '<option value="">No at-risk modules</option>';
  }

  updateSimulator();
}

/**
 * Recalculate and display the simulator preview.
 * Formula: if MC toggle on, additional absences are MC (subtracted from effective total);
 *          else they are unexcused (added to denominator, not MC-adjusted).
 */
function updateSimulator() {
  const select   = document.getElementById('simulator-module-select');
  const stepper  = document.getElementById('sim-unexcused-display');
  const mcToggle = document.getElementById('simulator-mc-toggle');

  if (!select || !stepper) return;

  const moduleId = parseInt(select.value, 10);
  const extraAbs = parseInt(stepper.textContent, 10) || 0;
  const asMC     = mcToggle?.checked || false;

  const mod = APP.attendanceSummary.find(m => m.module_id === moduleId);
  const rawPctElement = document.getElementById('sim-raw-pct');
  const rawStatusElement = document.getElementById('sim-raw-status');
  const effectivePctElement = document.getElementById('sim-effective-pct');
  const effectiveStatusElement = document.getElementById('sim-effective-status');
  if (!rawPctElement || !rawStatusElement || !effectivePctElement || !effectiveStatusElement) return;

  if (!mod) {
    rawPctElement.textContent = '--';
    effectivePctElement.textContent = '--';
    rawStatusElement.textContent = 'Select a module';
    effectiveStatusElement.textContent = 'Select a module';
    rawStatusElement.className = 'sim-status-tag';
    effectiveStatusElement.className = 'sim-status-tag';
    return;
  }

  const conducted  = mod.conducted || 0;
  const present    = mod.present   || 0;
  const currentMC  = mod.absent_mc || 0;

  const newMC          = asMC ? currentMC + extraAbs : currentMC;
  const newEffTotal    = conducted - newMC;
  const rawPct         = conducted > 0 ? (present / conducted) * 100 : 0;
  const effectivePct   = newEffTotal > 0 ? (present / newEffTotal) * 100 : 0;
  const updateStatus = (element, pct) => {
    const eligible = pct >= 80;
    element.textContent = eligible ? 'Exam Eligible ✓' : 'Exam Ineligible';
    element.className = `sim-status-tag ${eligible ? 'tag-success' : 'tag-danger'}`;
  };

  rawPctElement.textContent = formatPct(rawPct);
  effectivePctElement.textContent = formatPct(effectivePct);
  updateStatus(rawStatusElement, rawPct);
  updateStatus(effectiveStatusElement, effectivePct);
}


// ============================================================
// SETTINGS
// ============================================================

/**
 * Load settings view and populate the form with current user data.
 */
function loadSettings() {
  showView('settings');
  if (!APP.user) return;

  const nameInput  = document.getElementById('settings-name');
  const emailInput = document.getElementById('settings-email');
  const regInput   = document.getElementById('settings-reg');
  const deptInput  = document.getElementById('settings-dept');
  const weekInput  = document.getElementById('settings-current-week');
  const totalWeeks = document.getElementById('settings-total-weeks');
  const threshold  = document.getElementById('settings-threshold');

  if (nameInput)  nameInput.value  = APP.user.full_name  || '';
  if (emailInput) emailInput.value = APP.user.email      || '';
  if (regInput)   regInput.value   = APP.user.reg_number || '';
  if (deptInput)  deptInput.value  = APP.user.department || 'Division of Information Technology';
  if (weekInput && APP.semesterConfig) weekInput.value = APP.semesterConfig.current_week;
  if (totalWeeks && APP.semesterConfig) totalWeeks.textContent = APP.semesterConfig.total_weeks;
  if (threshold && APP.semesterConfig) threshold.value = APP.semesterConfig.threshold;
}

/**
 * Handle settings profile form submission.
 * @param {Event} e
 */
async function saveProfile(e) {
  e.preventDefault();
  const form       = e.target;
  const full_name  = form.querySelector('#settings-name')?.value.trim();
  const email      = form.querySelector('#settings-email')?.value.trim();
  const reg_number = form.querySelector('#settings-reg')?.value.trim();

  try {
    await apiCall('/api/profile', 'PUT', { full_name, email, reg_number });
    APP.user = { ...APP.user, full_name, email, reg_number };
    showToast('Profile updated successfully!', 'success');
  } catch (err) {
    showToast(`Update failed: ${err.message}`, 'error');
  }
}


// ============================================================
// HELPER: load calendar view (initialises current month if first time)
// ============================================================
function loadCalendarView() {
  showView('calendar');
  loadCalendar(APP.currentYear, APP.currentMonth);
}


// ============================================================
// EVENT LISTENERS — wired at DOMContentLoaded
// ============================================================
document.addEventListener('DOMContentLoaded', () => {

  // ── Dark mode toggles ────────────────────────────────────
  document.querySelectorAll('.dark-mode-toggle').forEach(btn => {
    btn.addEventListener('click', toggleDarkMode);
  });

  // ── Auth: landing + nav buttons ───────────────────────────
  document.getElementById('nav-signin-btn')?.addEventListener('click', () => showSignInModal('signin'));
  document.getElementById('nav-register-btn')?.addEventListener('click', () => showSignInModal('register'));
  document.getElementById('landing-signin-btn')?.addEventListener('click', () => showSignInModal('signin'));
  document.getElementById('landing-register-btn')?.addEventListener('click', () => showSignInModal('register'));
  const openTodayAttendance = () => openDayModal(todayStr());
  document.getElementById('dashboard-log-attendance')?.addEventListener('click', openTodayAttendance);
  document.getElementById('timetable-log-attendance')?.addEventListener('click', openTodayAttendance);

  const userProfileTrigger = document.getElementById('user-profile-trigger');
  const userDropdownMenu = document.getElementById('user-dropdown-menu');
  userProfileTrigger?.addEventListener('click', e => {
    e.stopPropagation();
    userDropdownMenu?.classList.toggle('hidden');
  });
  document.getElementById('btn-notifications')?.addEventListener('click', e => {
    e.stopPropagation();
    document.getElementById('notification-dropdown')?.classList.toggle('hidden');
  });
  document.addEventListener('click', e => {
    if (!userProfileTrigger?.contains(e.target)) userDropdownMenu?.classList.add('hidden');
    if (!e.target.closest('.notification-wrapper')) {
      document.getElementById('notification-dropdown')?.classList.add('hidden');
    }
  });

  // ── Modal: backdrop click closes modal ───────────────────
  document.querySelectorAll('.modal-backdrop').forEach(el => {
    el.addEventListener('click', e => { if (e.target === el) closeModal(el.id); });
  });

  // ── Modal: [data-close-modal] buttons ────────────────────
  document.querySelectorAll('[data-close-modal]').forEach(btn => {
    btn.addEventListener('click', () => closeModal(btn.dataset.closeModal));
  });

  // ── Modal: tab switcher ───────────────────────────────────
  document.querySelectorAll('#signin-modal .modal-tab').forEach(tab => {
    tab.addEventListener('click', () => {
      const target = tab.dataset.tab;
      document.querySelectorAll('#signin-modal .modal-tab').forEach(t =>
        t.classList.toggle('active', t === tab));
      document.querySelectorAll('#signin-modal .tab-panel').forEach(p => {
        p.style.display = p.id === `tab-${target}` ? '' : 'none';
      });
    });
  });

  // ── Auth: form submits ────────────────────────────────────
  document.getElementById('signin-form')?.addEventListener('submit', handleSignIn);
  document.getElementById('register-form')?.addEventListener('submit', handleRegister);

  // ── Logout ────────────────────────────────────────────────
  document.getElementById('logout-btn')?.addEventListener('click', handleLogout);

  // ── Main navigation links ─────────────────────────────────
  document.querySelectorAll('[data-nav]').forEach(link => {
    link.addEventListener('click', e => {
      e.preventDefault();
      const view = link.dataset.nav;
      userDropdownMenu?.classList.add('hidden');
      switch (view) {
        case 'dashboard': loadDashboard();    break;
        case 'calendar':  loadCalendarView(); break;
        case 'modules':   loadModules();      break;
        case 'risk':      loadRiskView();     break;
        case 'settings':  loadSettings();     break;
        default:          showView(view);
      }
    });
  });

  // ── Calendar navigation ───────────────────────────────────
  document.getElementById('cal-prev-btn')?.addEventListener('click', prevMonth);
  document.getElementById('cal-next-btn')?.addEventListener('click', nextMonth);
  document.getElementById('cal-today-btn')?.addEventListener('click', () => {
    const t = new Date();
    loadCalendar(t.getFullYear(), t.getMonth() + 1);
  });

  // ── Day modal controls ────────────────────────────────────
  document.getElementById('day-modal-save-btn')?.addEventListener('click', saveDayAttendance);
  document.getElementById('day-modal-close-btn')?.addEventListener('click', () => closeModal('day-modal'));
  document.getElementById('mark-all-present-btn')?.addEventListener('click', markAllPresent);

  // ── Modules search (debounced 300ms) ──────────────────────
  document.getElementById('modules-search')?.addEventListener('input', e => {
    clearTimeout(APP.debounceTimer);
    APP.debounceTimer = setTimeout(() => filterModules(e.target.value), 300);
  });

  // ── Modules export ────────────────────────────────────────
  document.getElementById('modules-export-btn')?.addEventListener('click', exportReport);

  // ── Risk filter tabs ──────────────────────────────────────
  document.querySelectorAll('.tab-chip[data-risk-filter]').forEach(tab => {
    tab.addEventListener('click', () => {
      document.querySelectorAll('.tab-chip[data-risk-filter]').forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      renderRiskCards(APP.attendanceSummary, tab.dataset.riskFilter === 'warning' ? 'borderline' : tab.dataset.riskFilter || 'all');
    });
  });

  // ── Risk simulator controls ───────────────────────────────
  document.getElementById('simulator-module-select')?.addEventListener('change', updateSimulator);
  document.getElementById('simulator-mc-toggle')?.addEventListener('change', updateSimulator);
  document.getElementById('simulator-abs-inc')?.addEventListener('click', () => {
    const display = document.getElementById('sim-unexcused-display');
    if (display) { display.textContent = String((parseInt(display.textContent, 10) || 0) + 1); updateSimulator(); }
  });
  document.getElementById('simulator-abs-dec')?.addEventListener('click', () => {
    const display = document.getElementById('sim-unexcused-display');
    if (display) { display.textContent = String(Math.max(0, (parseInt(display.textContent, 10) || 0) - 1)); updateSimulator(); }
  });

  // ── Settings save ─────────────────────────────────────────
  document.getElementById('settings-form')?.addEventListener('submit', saveProfile);

  // ── Boot ──────────────────────────────────────────────────
  initApp();
});
