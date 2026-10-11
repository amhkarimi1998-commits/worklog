const KEY_USER = 'worklog:user';
const KEY_SESSION = 'worklog:session';
const KEY_ATTEND = 'worklog:attendance';
const KEY_LEAVE = 'worklog:leave';
const KEY_HOLIDAYS = 'worklog:holidays';
const KEY_THEME = 'worklog:theme';
const DAILY_BREAK_MIN = 40;
const LEAVE_YEAR_TOTAL_HOURS = 240;
const HOURS_PER_DAY = 8;
const BACKUP_VERSION = 1;

const PAGE_TITLES = {
  attendance: 'حضور و غیاب',
  bulk: 'ورود دستی',
  leave: 'مرخصی',
  holidays: 'تعطیلات',
  reports: 'گزارش',
  settings: 'تنظیمات'
};

const PERSIAN_MONTHS = [
  'فروردین','اردیبهشت','خرداد','تیر','مرداد','شهریور',
  'مهر','آبان','آذر','دی','بهمن','اسفند'
];

function $(id) { return document.getElementById(id); }
function save(key, val) { localStorage.setItem(key, JSON.stringify(val)); }
function load(key) {
  const v = localStorage.getItem(key);
  return v ? JSON.parse(v) : null;
}

async function sha256(text) {
  const buf = new TextEncoder().encode(text);
  const hash = await crypto.subtle.digest('SHA-256', buf);
  const bytes = new Uint8Array(hash);
  let hex = '';
  for (let i = 0; i < bytes.length; i++) {
    hex += bytes[i].toString(16).padStart(2, '0');
  }
  return hex;
}

function toFaDigits(s) {
  const fa = ['۰','۱','۲','۳','۴','۵','۶','۷','۸','۹'];
  return String(s).replace(/[0-9]/g, function (d) { return fa[+d]; });
}

function pad2(n) { return n < 10 ? '0' + n : '' + n; }

function applyTheme(theme) {
  document.documentElement.setAttribute('data-theme', theme);
}

function setTheme(theme) {
  save(KEY_THEME, theme);
  applyTheme(theme);
  document.querySelectorAll('.theme-btn').forEach(function (b) {
    b.classList.toggle('active', b.dataset.theme === theme);
  });
}

function initTheme() {
  const saved = load(KEY_THEME) || 'dark';
  applyTheme(saved);
  document.querySelectorAll('.theme-btn').forEach(function (b) {
    b.classList.toggle('active', b.dataset.theme === saved);
  });
}

document.querySelectorAll('.rep-tab').forEach(function (btn) {
  btn.addEventListener('click', function () {
    document.querySelectorAll('.rep-tab').forEach(function (b) {
      b.classList.remove('active');
    });
    document.querySelectorAll('.rep-tab-content').forEach(function (c) {
      c.classList.add('hidden');
    });
    btn.classList.add('active');
    const tab = document.getElementById('rep-tab-' + btn.dataset.repTab);
    if (tab) tab.classList.remove('hidden');
  });
});

function localDateKey(d) {
  return d.getFullYear() + '-' + pad2(d.getMonth() + 1) + '-' + pad2(d.getDate());
}

function parseLocalDateKey(key) {
  const parts = key.split('-');
  return new Date(+parts[0], +parts[1] - 1, +parts[2]);
}

function escapeHtml(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function jdiv(a, b) { return ~~(a / b); }
function jmod(a, b) { return a - jdiv(a, b) * b; }

function jalCal(jy) {
  const breaks = [-61, 9, 38, 199, 426, 686, 756, 818, 1111, 1181, 1210, 1635, 2060, 2097, 2192, 2262, 2324, 2394, 2456, 3178];
  const bl = breaks.length;
  const gy = jy + 621;
  let leapJ = -14;
  let jp = breaks[0];
  let jm, jump, leap, leapG, march, n, i;
  if (jy < jp || jy >= breaks[bl - 1]) throw new Error('Invalid Jalaali year ' + jy);
  for (i = 1; i < bl; i += 1) {
    jm = breaks[i];
    jump = jm - jp;
    if (jy < jm) break;
    leapJ = leapJ + jdiv(jump, 33) * 8 + jdiv(jmod(jump, 33), 4);
    jp = jm;
  }
  n = jy - jp;
  leapJ = leapJ + jdiv(n, 33) * 8 + jdiv(jmod(n, 33) + 3, 4);
  if (jmod(jump, 33) === 4 && jump - n === 4) leapJ += 1;
  leapG = jdiv(gy, 4) - jdiv((jdiv(gy, 100) + 1) * 3, 4) - 150;
  march = 20 + leapJ - leapG;
  if (jump - n < 6) n = n - jump + jdiv(jump + 4, 33) * 33;
  leap = jmod(jmod(n + 1, 33) - 1, 4);
  if (leap === -1) leap = 4;
  return { leap: leap, gy: gy, march: march };
}

function g2d(gy, gm, gd) {
  let d = jdiv((gy + jdiv(gm - 8, 6) + 100100) * 1461, 4) + jdiv(153 * jmod(gm + 9, 12) + 2, 5) + gd - 34840408;
  d = d - jdiv(jdiv(gy + 100100 + jdiv(gm - 8, 6), 100) * 3, 4) + 752;
  return d;
}

function d2g(jdn) {
  let j = 4 * jdn + 139361631;
  j = j + jdiv(jdiv(4 * jdn + 183187720, 146097) * 3, 4) * 4 - 3908;
  const i = jdiv(jmod(j, 1461), 4) * 5 + 308;
  const gd = jdiv(jmod(i, 153), 5) + 1;
  const gm = jmod(jdiv(i, 153), 12) + 1;
  const gy = jdiv(j, 1461) - 100100 + jdiv(8 - gm, 6);
  return { gy: gy, gm: gm, gd: gd };
}

function j2d(jy, jm, jd) {
  const r = jalCal(jy);
  return g2d(r.gy, 3, r.march) + (jm - 1) * 31 - jdiv(jm, 7) * (jm - 7) + jd - 1;
}

function d2j(jdn) {
  const gy = d2g(jdn).gy;
  let jy = gy - 621;
  const r = jalCal(jy);
  const jdn1f = g2d(gy, 3, r.march);
  let jd, jm, k;
  k = jdn - jdn1f;
  if (k >= 0) {
    if (k <= 185) {
      jm = 1 + jdiv(k, 31);
      jd = jmod(k, 31) + 1;
      return { jy: jy, jm: jm, jd: jd };
    } else {
      k -= 186;
    }
  } else {
    jy -= 1;
    k += 179;
    if (r.leap === 1) k += 1;
  }
  jm = 7 + jdiv(k, 30);
  jd = jmod(k, 30) + 1;
  return { jy: jy, jm: jm, jd: jd };
}

function jalaaliToDate(jy, jm, jd) {
  const g = d2g(j2d(jy, jm, jd));
  return new Date(g.gy, g.gm - 1, g.gd);
}

function dateToJalaali(date) {
  return d2j(g2d(date.getFullYear(), date.getMonth() + 1, date.getDate()));
}

function isLeapJalaali(jy) { return jalCal(jy).leap === 0; }

function jalaaliMonthLength(jy, jm) {
  if (jm <= 6) return 31;
  if (jm <= 11) return 30;
  if (isLeapJalaali(jy)) return 30;
  return 29;
}

function faDateString(d) {
  const j = dateToJalaali(d);
  const jsDay = d.getDay();
  const persianDayIdx = (jsDay + 1) % 7;
  const weekdays = ['شنبه','یکشنبه','دوشنبه','سه‌شنبه','چهارشنبه','پنجشنبه','جمعه'];
  return weekdays[persianDayIdx] + ' ' + toFaDigits(j.jd) + ' ' + PERSIAN_MONTHS[j.jm - 1] + ' ' + toFaDigits(j.jy);
}

function faWeekday(d) {
  const jsDay = d.getDay();
  const persianDayIdx = (jsDay + 1) % 7;
  const weekdays = ['شنبه','یکشنبه','دوشنبه','سه‌شنبه','چهارشنبه','پنجشنبه','جمعه'];
  return weekdays[persianDayIdx];
}

function faDateShort(d) {
  const j = dateToJalaali(d);
  return toFaDigits(j.jd) + ' ' + PERSIAN_MONTHS[j.jm - 1] + ' ' + toFaDigits(j.jy);
}

function faDateShortNoYear(d) {
  const j = dateToJalaali(d);
  return toFaDigits(j.jd) + ' ' + PERSIAN_MONTHS[j.jm - 1];
}

function faTimeString(d) {
  return toFaDigits(pad2(d.getHours()) + ':' + pad2(d.getMinutes()));
}

function faTimeWithSeconds(d) {
  return toFaDigits(pad2(d.getHours()) + ':' + pad2(d.getMinutes()) + ':' + pad2(d.getSeconds()));
}

function faDuration(ms) {
  if (ms < 0) ms = 0;
  const totalMin = Math.floor(ms / 60000);
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  return toFaDigits(h) + ':' + toFaDigits(pad2(m));
}

function formatHoursAsDays(hours) {
  if (hours === 0) return '۰ روز';
  const wholeDays = Math.floor(hours / HOURS_PER_DAY);
  const remHours = Math.round((hours - wholeDays * HOURS_PER_DAY) * 100) / 100;
  if (remHours === 0) return toFaDigits(wholeDays) + ' روز';
  if (wholeDays === 0) return toFaDigits(remHours) + ' ساعت';
  return toFaDigits(wholeDays) + ' روز و ' + toFaDigits(remHours) + ' ساعت';
}

function startOfPersianWeek(d) {
  const day = d.getDay();
  const daysSinceSat = (day + 1) % 7;
  const s = new Date(d);
  s.setHours(0, 0, 0, 0);
  s.setDate(s.getDate() - daysSinceSat);
  return s;
}

function faYearMonthKey(d) {
  const j = dateToJalaali(d);
  return j.jy + '-' + j.jm;
}

function currentLeaveYear() {
  const today = new Date();
  const j = dateToJalaali(today);
  if (j.jm >= 8) {
    return { startKey: j.jy * 12 + 8, endKey: (j.jy + 1) * 12 + 7, startJY: j.jy, startJM: 8, endJY: j.jy + 1, endJM: 7 };
  } else {
    return { startKey: (j.jy - 1) * 12 + 8, endKey: j.jy * 12 + 7, startJY: j.jy - 1, startJM: 8, endJY: j.jy, endJM: 7 };
  }
}

function isInLeaveYear(date) {
  const j = dateToJalaali(date);
  const key = j.jy * 12 + j.jm;
  const range = currentLeaveYear();
  return key >= range.startKey && key <= range.endKey;
}

function getLeaveYearMonths() {
  const r = currentLeaveYear();
  const months = [];
  for (let i = 0; i < 12; i++) {
    let jm = r.startJM + i;
    let jy = r.startJY;
    while (jm > 12) { jm -= 12; jy++; }
    months.push({ jy: jy, jm: jm });
  }
  return months;
}

function getHolidays() { return load(KEY_HOLIDAYS) || []; }
function saveHolidays(list) {
  save(KEY_HOLIDAYS, list);
  if (typeof sbSaveHolidays === 'function') {
    sbSaveHolidays(list).catch(function () {});
  }
}

function isFriday(date) {
  return date.getDay() === 5;
}

function holidayForDate(date) {
  const key = localDateKey(date);
  const list = getHolidays();
  for (let i = 0; i < list.length; i++) {
    if (localDateKey(new Date(list[i].date)) === key) return list[i];
  }
  return null;
}

function isHoliday(date) {
  return isFriday(date) || !!holidayForDate(date);
}

function countWorkingDays(from, to) {
  let count = 0;
  const d = new Date(from);
  d.setHours(0, 0, 0, 0);
  const end = new Date(to);
  end.setHours(0, 0, 0, 0);
  while (d <= end) {
    if (!isHoliday(d)) count++;
    d.setDate(d.getDate() + 1);
  }
  return count;
}

function dayTotalMs(sessions) {
  let ms = 0;
  let hasClosed = false;
  for (let i = 0; i < sessions.length; i++) {
    const s = sessions[i];
    if (s.out) {
      ms += new Date(s.out) - new Date(s.in);
      hasClosed = true;
    }
  }
  if (hasClosed) ms -= DAILY_BREAK_MIN * 60000;
  if (ms < 0) ms = 0;
  return ms;
}

function groupByLocalDay(sessions) {
  const map = {};
  for (let i = 0; i < sessions.length; i++) {
    const key = localDateKey(new Date(sessions[i].in));
    if (!map[key]) map[key] = [];
    map[key].push(sessions[i]);
  }
  return map;
}

function weekTotalMs(list) {
  const weekStart = startOfPersianWeek(new Date());
  const days = groupByLocalDay(list);
  let total = 0;
  for (const key in days) {
    const dayDate = parseLocalDateKey(key);
    if (dayDate >= weekStart) total += dayTotalMs(days[key]);
  }
  return total;
}

function monthTotalMs(list) {
  const currentKey = faYearMonthKey(new Date());
  const days = groupByLocalDay(list);
  let total = 0;
  for (const key in days) {
    const dayDate = parseLocalDateKey(key);
    if (faYearMonthKey(dayDate) === currentKey) total += dayTotalMs(days[key]);
  }
  return total;
}

const pageLogin     = $('page-login');
const pageDashboard = $('page-dashboard');
const inpPersonnel  = $('inp-personnel');
const inpPassword   = $('inp-password');
const btnLogin      = $('btn-login');
const btnLogout     = $('btn-logout');
const loginError    = $('login-error');
const todayEl       = $('today');
const statusEl      = $('status');
const clockDateEl   = $('clock-date');
const clockTimeEl   = $('clock-time');
const btnIn         = $('btn-in');
const btnOut        = $('btn-out');
const todaySessions = $('today-sessions');
const todayTotalEl  = $('today-total');
const weekTotalEl   = $('week-total');
const monthTotalEl  = $('month-total');
const pageTitleEl   = $('page-title');
const btnAddManual  = $('btn-add-manual');

const leaveUsedEl    = $('leave-used');
const leaveRemEl     = $('leave-remaining');
const leaveListEl    = $('leave-list');

const btnPickRange   = $('btn-pick-range');
const rangeDisplay   = $('range-display');
const dailyPreview   = $('daily-preview');
const dailyNoteInp   = $('daily-note');
const btnAddDaily    = $('btn-add-daily');
const dailyError     = $('daily-error');

const btnPickDate    = $('btn-pick-date');
const dateDisplay    = $('date-display');
const hourlyPreview  = $('hourly-preview');
const hourlyNoteInp  = $('hourly-note');
const btnAddHourly   = $('btn-add-hourly');
const hourlyError    = $('hourly-error');

const settingsPersonnelEl = $('settings-personnel');
const pwdCurrentInp  = $('pwd-current');
const pwdNewInp      = $('pwd-new');
const pwdConfirmInp  = $('pwd-confirm');
const btnChangePwd   = $('btn-change-pwd');
const pwdError       = $('pwd-error');
const pwdSuccess     = $('pwd-success');

const btnBackup   = $('btn-backup');
const inpRestore  = $('inp-restore');
const backupMsg   = $('backup-msg');
const backupErr   = $('backup-err');
const btnClearAll = $('btn-clear-all');

const holidaysCountEl = $('holidays-count');
const holidayTitleInp = $('holiday-title');
const holCalTitleEl   = $('hol-cal-title');
const holCalGridEl    = $('hol-cal-grid');
const holCalPrev      = $('hol-cal-prev');
const holCalNext      = $('hol-cal-next');
const holidayListEl   = $('holiday-list');

const repPickFrom     = $('rep-pick-from');
const repPickTo       = $('rep-pick-to');
const repFromDisplay  = $('rep-from-display');
const repToDisplay    = $('rep-to-display');
const repClear        = $('rep-clear');
const repSearchInp    = $('rep-search');
const repExportBtn    = $('rep-export');
const repPrintBtn     = $('rep-print');
const repProgressBar  = $('rep-progress-bar');
const repTotalEl      = $('rep-total');
const repDaysEl       = $('rep-days');
const repRequiredEl   = $('rep-required');
const repAvgEl        = $('rep-avg');
const repDiffEl       = $('rep-diff');
const repAvgWeekEl    = $('rep-avg-week');
const repChartEl      = $('rep-chart');
const repMonthChartEl = $('rep-month-chart');
const repYearSumEl    = $('rep-year-summary');
const repListEl       = $('rep-list');

const smModal     = $('session-modal');
const smBackdrop  = $('sm-backdrop');
const smTitle     = $('sm-title');
const smDateBtn   = $('sm-date-btn');
const smDateDisp  = $('sm-date-display');
const smError     = $('sm-error');
const smCancel    = $('sm-cancel');
const smSave      = $('sm-save');

const calModal    = $('calendar-modal');
const calBackdrop = $('cal-backdrop');
const calSlots    = $('cal-slots');
const calSlotFrom = $('cal-slot-from');
const calSlotTo   = $('cal-slot-to');
const calFromVal  = $('cal-from-val');
const calToVal    = $('cal-to-val');
const calTitle    = $('cal-title');
const calGrid     = $('cal-grid');
const calPrev     = $('cal-prev');
const calNext     = $('cal-next');
const calCancel   = $('cal-cancel');

function fillTimeOptions(sel, count) {
  sel.innerHTML = '';
  for (let i = 0; i < count; i++) {
    const opt = document.createElement('option');
    opt.value = pad2(i);
    opt.textContent = toFaDigits(pad2(i));
    sel.appendChild(opt);
  }
}

function setTimePicker(prefix, h, m) {
  $(prefix + '-h').value = pad2(h);
  $(prefix + '-m').value = pad2(m);
}

function getTimePicker(prefix) {
  return $(prefix + '-h').value + ':' + $(prefix + '-m').value;
}

function initTimePickers() {
  fillTimeOptions($('hourly-start-h'), 24);
  fillTimeOptions($('hourly-end-h'), 24);
  fillTimeOptions($('hourly-start-m'), 60);
  fillTimeOptions($('hourly-end-m'), 60);
  setTimePicker('hourly-start', 8, 0);
  setTimePicker('hourly-end', 10, 0);

  fillTimeOptions($('sm-in-h'), 24);
  fillTimeOptions($('sm-out-h'), 24);
  fillTimeOptions($('sm-in-m'), 60);
  fillTimeOptions($('sm-out-m'), 60);
  setTimePicker('sm-in', 8, 0);
  setTimePicker('sm-out', 16, 40);
}

let dailyFrom = null;
let dailyTo = null;
let hourlyDate = null;
let reportFrom = null;
let reportTo = null;
let reportChip = 'all';
let reportSearch = '';

const calState = {
  mode: 'range',
  activeSlot: 'from',
  from: null,
  to: null,
  viewYear: 0,
  viewMonth: 0,
  callback: null
};

const holCalState = { viewYear: 0, viewMonth: 0 };

const smState = { mode: 'add', editingId: null, date: null };

const bulkState = { jy: 0, jm: 0, dirty: false };

function initBulkState() {
  const j = dateToJalaali(new Date());
  bulkState.jy = j.jy;
  bulkState.jm = j.jm;
  bulkState.dirty = false;
}

function bulkHoursOptions(selected) {
  let s = '<option value=""></option>';
  for (let i = 0; i < 24; i++) {
    const v = pad2(i);
    s += '<option value="' + v + '"' + (v === selected ? ' selected' : '') + '>' + toFaDigits(v) + '</option>';
  }
  return s;
}

function bulkMinutesOptions(selected) {
  let s = '<option value=""></option>';
  for (let i = 0; i < 60; i++) {
    const v = pad2(i);
    s += '<option value="' + v + '"' + (v === selected ? ' selected' : '') + '>' + toFaDigits(v) + '</option>';
  }
  return s;
}

function bulkDayStatus(date) {
  const dayLeaves = leavesOnDay(date);
  let dailyLeave = null;
  let hourlyLeaveHours = 0;
  for (let k = 0; k < dayLeaves.length; k++) {
    if (dayLeaves[k].type === 'daily') dailyLeave = dayLeaves[k];
    else hourlyLeaveHours += dayLeaves[k].hours;
  }
  return {
    dailyLeave: dailyLeave,
    hourlyLeaveHours: hourlyLeaveHours,
    hasHourly: hourlyLeaveHours > 0
  };
}

function bulkSessionHtml(inH, inM, outH, outM, disabled, showRemove) {
  const dis = disabled ? ' disabled' : '';
  const removeBtn = showRemove
    ? '<button type="button" class="bulk-clear-btn" data-action="remove-session" title="حذف این بازه">×</button>'
    : '<span class="bulk-session-spacer"></span>';

  return '<div class="bulk-session">' +
    '<div class="time-picker">' +
      '<select class="time-select" data-field="in-h"' + dis + '>' + bulkHoursOptions(inH) + '</select>' +
      '<span class="time-sep">:</span>' +
      '<select class="time-select" data-field="in-m"' + dis + '>' + bulkMinutesOptions(inM) + '</select>' +
    '</div>' +
    '<span class="bulk-session-arrow">→</span>' +
    '<div class="time-picker">' +
      '<select class="time-select" data-field="out-h"' + dis + '>' + bulkHoursOptions(outH) + '</select>' +
      '<span class="time-sep">:</span>' +
      '<select class="time-select" data-field="out-m"' + dis + '>' + bulkMinutesOptions(outM) + '</select>' +
    '</div>' +
    removeBtn +
  '</div>';
}

function bulkSessionFromRecord(s, disabled, showRemove) {
  const dIn = new Date(s.in);
  const inH = pad2(dIn.getHours());
  const inM = pad2(dIn.getMinutes());
  let outH = '', outM = '';
  if (s.out) {
    const dOut = new Date(s.out);
    outH = pad2(dOut.getHours());
    outM = pad2(dOut.getMinutes());
  }
  return bulkSessionHtml(inH, inM, outH, outM, disabled, showRemove);
}

function renderBulkMonth() {
  const jy = bulkState.jy;
  const jm = bulkState.jm;

  $('bulk-month-title').textContent = PERSIAN_MONTHS[jm - 1] + ' ' + toFaDigits(jy);

  const monthLen = jalaaliMonthLength(jy, jm);
  const byDay = groupByLocalDay(getAttendance());

  let html = '';
  for (let d = 1; d <= monthLen; d++) {
    const date = jalaaliToDate(jy, jm, d);
    const key = localDateKey(date);
    const sessions = (byDay[key] || []).slice().sort(function (a, b) {
      return new Date(a.in) - new Date(b.in);
    });
    const friday = isFriday(date);
    const holiday = isHoliday(date);
    const leaveInfo = bulkDayStatus(date);
    const isDailyLeave = !!leaveInfo.dailyLeave;
    const weekday = faWeekday(date);
    const dayNumFa = toFaDigits(d);

    let cls = 'bulk-row';
    if (holiday) cls += ' is-holiday';
    if (isDailyLeave) cls += ' is-leave';
    if (sessions.length > 0 && !isDailyLeave) cls += ' is-filled';

    let subLine = '';
    if (isDailyLeave) {
      const noteText = leaveInfo.dailyLeave.note
        ? ' — ' + escapeHtml(leaveInfo.dailyLeave.note)
        : '';
      subLine = '<div class="bulk-note">مرخصی روزانه' + noteText + '</div>';
    } else if (friday) {
      subLine = '<div class="muted small">جمعه</div>';
    } else if (holiday) {
      const h = holidayForDate(date);
      subLine = '<div class="muted small">' + escapeHtml((h && h.title) || 'تعطیل') + '</div>';
    }

    if (!isDailyLeave && leaveInfo.hasHourly) {
      const total = Math.round(leaveInfo.hourlyLeaveHours * 100) / 100;
      subLine += '<div class="bulk-note info">' + toFaDigits(total) + ' ساعت مرخصی ساعتی</div>';
    }

    let sessionsHtml = '';
    if (isDailyLeave) {
      if (sessions.length === 0) {
        sessionsHtml = '<div class="bulk-leave-msg">مرخصی روزانه — نیازی به ثبت ساعت نیست</div>';
      } else {
        for (let i = 0; i < sessions.length; i++) {
          sessionsHtml += bulkSessionFromRecord(sessions[i], true, false);
        }
      }
    } else if (sessions.length === 0) {
      sessionsHtml = bulkSessionHtml('', '', '', '', false, false);
    } else {
      const showRemove = true;
      for (let i = 0; i < sessions.length; i++) {
        sessionsHtml += bulkSessionFromRecord(sessions[i], false, showRemove);
      }
    }

    const addBtn = isDailyLeave
      ? ''
      : '<button type="button" class="bulk-add-btn" data-action="add-session">+ افزودن بازه</button>';

    html += '<div class="' + cls + '" data-key="' + key + '">' +
              '<div class="bulk-date">' +
                '<div>' + weekday + ' ' + dayNumFa + '</div>' +
                subLine +
              '</div>' +
              '<div class="bulk-sessions">' + sessionsHtml + '</div>' +
              '<div class="bulk-action">' + addBtn + '</div>' +
            '</div>';
  }

  $('bulk-list').innerHTML = html;
  bulkState.dirty = false;
  $('bulk-msg').textContent = '';
  $('bulk-err').textContent = '';
}

function handleBulkPrev() {
  if (bulkState.dirty) {
    if (!confirm('تغییرات ذخیره‌نشده از بین می‌رود. ادامه؟')) return;
  }
  bulkState.jm--;
  if (bulkState.jm < 1) { bulkState.jm = 12; bulkState.jy--; }
  renderBulkMonth();
}

function handleBulkNext() {
  if (bulkState.dirty) {
    if (!confirm('تغییرات ذخیره‌نشده از بین می‌رود. ادامه؟')) return;
  }
  bulkState.jm++;
  if (bulkState.jm > 12) { bulkState.jm = 1; bulkState.jy++; }
  renderBulkMonth();
}

function handleBulkFill() {
  const rows = document.querySelectorAll('#bulk-list .bulk-row');
  rows.forEach(function (row) {
    const key = row.dataset.key;
    const date = parseLocalDateKey(key);
    if (isHoliday(date)) return;
    const leaveInfo = bulkDayStatus(date);
    if (leaveInfo.dailyLeave) return;

    const sessionEls = row.querySelectorAll('.bulk-session');
    if (sessionEls.length !== 1) return;

    const sessEl = sessionEls[0];
    const inH = sessEl.querySelector('[data-field="in-h"]');
    const inM = sessEl.querySelector('[data-field="in-m"]');
    const outH = sessEl.querySelector('[data-field="out-h"]');
    const outM = sessEl.querySelector('[data-field="out-m"]');

    if (inH.disabled) return;

    if (!inH.value && !inM.value && !outH.value && !outM.value) {
      inH.value = '08';
      inM.value = '00';
      outH.value = '16';
      outM.value = '40';
    }
  });
  bulkState.dirty = true;
}

function handleBulkClearForm() {
  const rows = document.querySelectorAll('#bulk-list .bulk-row');
  rows.forEach(function (row) {
    const sessionEls = row.querySelectorAll('.bulk-session');
    sessionEls.forEach(function (sessEl) {
      const selects = sessEl.querySelectorAll('.time-select');
      selects.forEach(function (sel) {
        if (sel.disabled) return;
        sel.value = '';
      });
    });
  });
  bulkState.dirty = true;
  $('bulk-msg').textContent = '';
  $('bulk-err').textContent = '';
}

function handleBulkAddSession(btn) {
  const row = btn.closest('.bulk-row');
  if (!row) return;
  const container = row.querySelector('.bulk-sessions');

  container.querySelectorAll('.bulk-session').forEach(function (el) {
    const rm = el.querySelector('[data-action="remove-session"]');
    if (!rm) {
      const spacer = el.querySelector('.bulk-session-spacer');
      if (spacer) {
        spacer.outerHTML = '<button type="button" class="bulk-clear-btn" data-action="remove-session" title="حذف این بازه">×</button>';
      }
    }
  });

  container.insertAdjacentHTML('beforeend', bulkSessionHtml('', '', '', '', false, true));
  bulkState.dirty = true;
}

function handleBulkRemoveSession(btn) {
  const sessEl = btn.closest('.bulk-session');
  if (!sessEl) return;
  const container = sessEl.parentElement;
  sessEl.remove();

  const remaining = container.querySelectorAll('.bulk-session').length;
  if (remaining === 0) {
    container.insertAdjacentHTML('beforeend', bulkSessionHtml('', '', '', '', false, false));
  } else if (remaining === 1) {
    const onlySession = container.querySelector('.bulk-session');
    const rm = onlySession.querySelector('[data-action="remove-session"]');
    if (rm) {
      rm.outerHTML = '<span class="bulk-session-spacer"></span>';
    }
  }
  bulkState.dirty = true;
}

function handleBulkSave() {
  $('bulk-msg').textContent = '';
  $('bulk-err').textContent = '';

  const rows = document.querySelectorAll('#bulk-list .bulk-row');
  let list = getAttendance();
  const errors = [];
  const conflicts = [];
  let changedDays = 0;
  let addedSessions = 0;
  let deletedSessions = 0;

  rows.forEach(function (row, idx) {
    const key = row.dataset.key;
    const date = parseLocalDateKey(key);
    const leaveInfo = bulkDayStatus(date);

    const existingForDay = list.filter(function (x) {
      return localDateKey(new Date(x.in)) === key;
    });

    if (leaveInfo.dailyLeave) {
      if (existingForDay.length > 0) {
        list = list.filter(function (x) {
          return localDateKey(new Date(x.in)) !== key;
        });
        deletedSessions += existingForDay.length;
        changedDays++;
        conflicts.push(faDateShort(date));
      }
      return;
    }

    const sessionEls = row.querySelectorAll('.bulk-session');
    const newSessions = [];
    let hasError = false;

    sessionEls.forEach(function (sessEl) {
      const inH = sessEl.querySelector('[data-field="in-h"]').value;
      const inM = sessEl.querySelector('[data-field="in-m"]').value;
      const outH = sessEl.querySelector('[data-field="out-h"]').value;
      const outM = sessEl.querySelector('[data-field="out-m"]').value;

      const hasIn = inH !== '' && inM !== '';
      const hasOut = outH !== '' && outM !== '';

      if (!hasIn && !hasOut) return;

      if (!hasIn || !hasOut) {
        errors.push(faDateShort(date) + ' (ناقص)');
        hasError = true;
        return;
      }

      const inVal = inH + ':' + inM;
      const outVal = outH + ':' + outM;

      if (outVal <= inVal) {
        errors.push(faDateShort(date) + ' (خروج قبل از ورود)');
        hasError = true;
        return;
      }

      const dIn = new Date(date);
      dIn.setHours(+inH, +inM, 0, 0);
      const dOut = new Date(date);
      dOut.setHours(+outH, +outM, 0, 0);

      newSessions.push({ in: dIn.toISOString(), out: dOut.toISOString() });
    });

    if (hasError) return;

    const sorted = newSessions.slice().sort(function (a, b) {
      return new Date(a.in) - new Date(b.in);
    });
    for (let i = 1; i < sorted.length; i++) {
      if (new Date(sorted[i].in) < new Date(sorted[i - 1].out)) {
        errors.push(faDateShort(date) + ' (بازه‌ها تداخل دارند)');
        hasError = true;
        break;
      }
    }
    if (hasError) return;

    if (newSessions.length === 0 && existingForDay.length === 0) return;

    list = list.filter(function (x) {
      return localDateKey(new Date(x.in)) !== key;
    });
    deletedSessions += existingForDay.length;

    for (let i = 0; i < newSessions.length; i++) {
      list.push({
        id: 'local-' + Date.now() + '-' + idx + '-' + i,
        in: newSessions[i].in,
        out: newSessions[i].out
      });
      addedSessions++;
    }

    changedDays++;
  });

  if (changedDays > 0) {
    saveAttendance(list);
    const parts = [];
    parts.push(toFaDigits(changedDays) + ' روز تغییر یافت');
    const sub = [];
    if (addedSessions > 0) sub.push(toFaDigits(addedSessions) + ' بازه ثبت');
    if (deletedSessions > 0) sub.push(toFaDigits(deletedSessions) + ' بازه حذف');
    if (sub.length > 0) parts.push('(' + sub.join('، ') + ')');
    $('bulk-msg').textContent = parts.join(' ');

    renderBulkMonth();
    renderAttendance();
    renderReports();
  } else if (errors.length === 0 && conflicts.length === 0) {
    $('bulk-msg').textContent = 'تغییری ثبت نشد.';
  }

  const messages = [];
  if (errors.length > 0) messages.push('خطا در: ' + errors.join('، '));
  if (conflicts.length > 0) messages.push('رکورد روی مرخصی روزانه حذف شد: ' + conflicts.join('، '));
  if (messages.length > 0) $('bulk-err').textContent = messages.join(' | ');
}

async function handleLogin() {
  const personnel = inpPersonnel.value.trim();
  const password  = inpPassword.value;

  loginError.textContent = '';

  if (!personnel || !password) {
    loginError.textContent = 'کد پرسنلی و رمز را وارد کنید.';
    return;
  }

  const email = personnel + '@worklog.app';

  const signIn = await sb.auth.signInWithPassword({
    email: email,
    password: password
  });

  if (!signIn.error) {
    save(KEY_USER, { personnel: personnel });
    save(KEY_SESSION, true);
    inpPassword.value = '';
    showDashboard();
    return;
  }

  if (/^\d{10}$/.test(password)) {
    const signUp = await sb.auth.signUp({
      email: email,
      password: password,
      options: {
        data: {
          personnel_code: personnel,
          national_code: password
        }
      }
    });

    if (!signUp.error && signUp.data && signUp.data.user) {
      save(KEY_USER, { personnel: personnel });
      save(KEY_SESSION, true);
      inpPassword.value = '';
      showDashboard();
      return;
    }
  }

  loginError.textContent = 'کد پرسنلی یا رمز درست نیست.';
}

async function handleLogout() {
  try {
    await sb.auth.signOut();
  } catch (e) {}
  localStorage.removeItem(KEY_SESSION);
  inpPersonnel.value = '';
  inpPassword.value = '';
  loginError.textContent = '';
  showLogin();
}

function showLogin() {
  pageLogin.classList.remove('hidden');
  pageDashboard.classList.add('hidden');
}

async function showDashboard() {
  pageLogin.classList.add('hidden');
  pageDashboard.classList.remove('hidden');

  try {
    if (typeof sbSyncAll === 'function') {
      await sbSyncAll();
    }
  } catch (e) {
    console.warn('sync failed', e);
  }

  updateToday();
  updateClock();
  renderAttendance();
  renderLeave();
  renderSettings();
  updateDailyPreview();
  updateHourlyPreview();
  initHolidayCalendar();
  renderHolidayList();
  updateHolidaysCount();
  renderReports();
}

function switchView(viewName) {
  if (!pageDashboard.classList.contains('hidden') &&
      !document.getElementById('view-bulk').classList.contains('hidden') &&
      viewName !== 'bulk' && bulkState.dirty) {
    if (!confirm('تغییرات ذخیره‌نشده‌ی ورود دستی از بین می‌رود. ادامه؟')) return;
  }

  document.querySelectorAll('.view').forEach(function (el) {
    el.classList.add('hidden');
  });
  document.querySelectorAll('.nav-item').forEach(function (el) {
    el.classList.remove('active');
  });
  const view = document.getElementById('view-' + viewName);
  const btn  = document.querySelector('.nav-item[data-view="' + viewName + '"]');
  if (view) view.classList.remove('hidden');
  if (btn)  btn.classList.add('active');
  if (pageTitleEl && PAGE_TITLES[viewName]) {
    pageTitleEl.textContent = PAGE_TITLES[viewName];
  }
  if (viewName === 'reports') renderReports();
  if (viewName === 'bulk') {
    initBulkState();
    renderBulkMonth();
  }
  if (viewName === 'settings') {
    backupMsg.textContent = '';
    backupErr.textContent = '';
  }
}

function updateToday() {
  if (!todayEl) return;
  let text = 'امروز: ' + faDateString(new Date());
  if (isHoliday(new Date())) text += ' — تعطیل';
  todayEl.textContent = text;
}

function updateClock() {
  const now = new Date();
  if (clockDateEl) clockDateEl.textContent = faDateString(now);
  if (clockTimeEl) clockTimeEl.textContent = faTimeWithSeconds(now);
}

function renderSettings() {
  const saved = load(KEY_USER);
  if (saved && settingsPersonnelEl) {
    settingsPersonnelEl.textContent = toFaDigits(saved.personnel);
  }
}

async function handleChangePassword() {
  pwdError.textContent = '';
  pwdSuccess.textContent = '';

  const current = pwdCurrentInp.value;
  const newPwd  = pwdNewInp.value;
  const confirm = pwdConfirmInp.value;

  if (!current || !newPwd || !confirm) {
    pwdError.textContent = 'همه فیلدها را پر کنید.';
    return;
  }

  if (newPwd.length < 6) {
    pwdError.textContent = 'رمز جدید حداقل ۶ کاراکتر باشد.';
    return;
  }

  if (newPwd !== confirm) {
    pwdError.textContent = 'رمز جدید و تکرارش یکسان نیستند.';
    return;
  }

  const user = await sbCurrentUser();
  if (!user) {
    pwdError.textContent = 'کاربر یافت نشد.';
    return;
  }

  const verify = await sb.auth.signInWithPassword({
    email: user.email,
    password: current
  });

  if (verify.error) {
    pwdError.textContent = 'رمز فعلی درست نیست.';
    return;
  }

  const upd = await sb.auth.updateUser({ password: newPwd });
  if (upd.error) {
    pwdError.textContent = 'خطا در تغییر رمز: ' + upd.error.message;
    return;
  }

  pwdCurrentInp.value = '';
  pwdNewInp.value = '';
  pwdConfirmInp.value = '';
  pwdSuccess.textContent = 'رمز با موفقیت تغییر کرد.';
}

function handleBackup() {
  backupMsg.textContent = '';
  backupErr.textContent = '';

  const data = {
    app: 'worklog',
    version: BACKUP_VERSION,
    exportedAt: new Date().toISOString(),
    user: load(KEY_USER),
    attendance: getAttendance(),
    leaves: getLeaves(),
    holidays: getHolidays()
  };

  const json = JSON.stringify(data, null, 2);
  const blob = new Blob([json], { type: 'application/json' });

  const now = new Date();
  const j = dateToJalaali(now);
  const fname = 'worklog-backup-' + j.jy + '-' + pad2(j.jm) + '-' + pad2(j.jd) + '-' +
                pad2(now.getHours()) + pad2(now.getMinutes()) + '.json';

  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = fname;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(function () { URL.revokeObjectURL(url); }, 1000);

  backupMsg.textContent = 'پشتیبان دانلود شد: ' + fname;
}

async function handleRestoreFile(ev) {
  backupMsg.textContent = '';
  backupErr.textContent = '';

  const file = ev.target.files && ev.target.files[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = async function () {
    let data;
    try {
      data = JSON.parse(reader.result);
    } catch (err) {
      backupErr.textContent = 'فایل معتبر نیست (JSON خراب).';
      inpRestore.value = '';
      return;
    }

    if (!data || data.app !== 'worklog') {
      backupErr.textContent = 'این فایل مربوط به این برنامه نیست.';
      inpRestore.value = '';
      return;
    }

    const confirmMsg =
      'همه‌ی داده‌های فعلی با داده‌های این فایل جایگزین می‌شوند.\n\n' +
      'خروجی گرفته‌شده در: ' + (data.exportedAt || 'نامعلوم') + '\n\n' +
      'ادامه می‌دهید؟';

    if (!confirm(confirmMsg)) {
      inpRestore.value = '';
      return;
    }

    try {
      if (Array.isArray(data.attendance)) save(KEY_ATTEND, data.attendance);
      else localStorage.removeItem(KEY_ATTEND);

      if (Array.isArray(data.leaves)) save(KEY_LEAVE, data.leaves);
      else localStorage.removeItem(KEY_LEAVE);

      if (Array.isArray(data.holidays)) save(KEY_HOLIDAYS, data.holidays);
      else localStorage.removeItem(KEY_HOLIDAYS);

      try { await sbSaveAttendance(getAttendance()); } catch (e) {}
      try { await sbSaveLeaves(getLeaves()); } catch (e) {}
      try { await sbSaveHolidays(getHolidays()); } catch (e) {}

      backupMsg.textContent = 'بازیابی با موفقیت انجام شد.';

      renderAttendance();
      renderLeave();
      renderSettings();
      initHolidayCalendar();
      renderHolidayList();
      updateHolidaysCount();
      renderReports();
      updateToday();
    } catch (err) {
      backupErr.textContent = 'خطا در بازیابی: ' + err.message;
    }

    inpRestore.value = '';
  };

  reader.onerror = function () {
    backupErr.textContent = 'خطا در خواندن فایل.';
    inpRestore.value = '';
  };

  reader.readAsText(file);
}

async function handleClearAll() {
  backupMsg.textContent = '';
  backupErr.textContent = '';

  if (!confirm('همه‌ی داده‌ها پاک می‌شوند. مطمئنید؟')) return;
  if (!confirm('آخرین تأیید: این عمل قابل بازگشت نیست. ادامه؟')) return;

  try { await sbSaveAttendance([]); } catch (e) {}
  try { await sbSaveLeaves([]); } catch (e) {}
  try { await sbSaveHolidays([]); } catch (e) {}

  localStorage.removeItem(KEY_ATTEND);
  localStorage.removeItem(KEY_LEAVE);
  localStorage.removeItem(KEY_HOLIDAYS);

  renderAttendance();
  renderLeave();
  renderHolidayList();
  updateHolidaysCount();
  renderReports();
}

function getAttendance() { return load(KEY_ATTEND) || []; }
function saveAttendance(list) {
  save(KEY_ATTEND, list);
  if (typeof sbSaveAttendance === 'function') {
    sbSaveAttendance(list).catch(function () {});
  }
}

function todaySessionsFrom(list) {
  const todayKey = localDateKey(new Date());
  return list.filter(function (s) {
    return localDateKey(new Date(s.in)) === todayKey;
  });
}

function openSession(list) {
  for (let i = list.length - 1; i >= 0; i--) {
    if (!list[i].out) return list[i];
  }
  return null;
}

function handleCheckIn() {
  const list = getAttendance();
  if (openSession(list)) {
    alert('قبلاً ورود زده‌اید. اول خروج بزنید.');
    return;
  }
  list.push({ id: 'local-' + Date.now(), in: new Date().toISOString(), out: null });
  saveAttendance(list);
  renderAttendance();
  renderReports();
}

function handleCheckOut() {
  const list = getAttendance();
  const open = openSession(list);
  if (!open) {
    alert('اول باید ورود بزنید.');
    return;
  }
  open.out = new Date().toISOString();
  saveAttendance(list);
  renderAttendance();
  renderReports();
}

function sessionRowHtml(s, showDate, dateStr) {
  const inTime = faTimeString(new Date(s.in));
  let outTime, dur, cls;
  if (s.out) {
    outTime = faTimeString(new Date(s.out));
    dur = faDuration(new Date(s.out) - new Date(s.in));
    cls = 'session-row';
  } else {
    outTime = '—';
    dur = 'در حال کار';
    cls = 'session-row open';
  }

  const leftHtml = showDate
    ? '<div class="session-main">' +
        '<div class="session-date">' + dateStr + '</div>' +
        '<div class="session-note">' + inTime + ' → ' + outTime + '</div>' +
      '</div>'
    : '<span class="times">' + inTime + ' → ' + outTime + '</span>';

  const actionsHtml = s.out
    ? '<div class="session-actions">' +
        '<button class="session-btn" data-act="edit" data-id="' + s.id + '">ویرایش</button>' +
        '<button class="session-btn danger" data-act="del" data-id="' + s.id + '">حذف</button>' +
      '</div>'
    : '';

  return '<div class="' + cls + '">' +
            leftHtml +
            '<span class="duration">' + dur + '</span>' +
            actionsHtml +
          '</div>';
}

function renderAttendance() {
  const list = getAttendance();
  const open = openSession(list);
  const todays = todaySessionsFrom(list);

  if (open) {
    statusEl.textContent = 'در محل کار — ورود ' + faTimeString(new Date(open.in));
    statusEl.style.color = 'var(--yellow)';
  } else {
    statusEl.textContent = 'خارج از محل کار';
    statusEl.style.color = '';
  }

  btnIn.disabled = !!open;
  btnOut.disabled = !open;

  if (todays.length === 0) {
    todaySessions.innerHTML = '<div class="session-empty">امروز رکوردی ثبت نشده است.</div>';
  } else {
    let html = '';
    for (let i = 0; i < todays.length; i++) {
      html += sessionRowHtml(todays[i], false, '');
    }
    todaySessions.innerHTML = html;
  }

  todayTotalEl.textContent = faDuration(dayTotalMs(todays));
  weekTotalEl.textContent  = faDuration(weekTotalMs(list));
  monthTotalEl.textContent = faDuration(monthTotalMs(list));

  todaySessions.querySelectorAll('.session-btn').forEach(function (btn) {
    btn.addEventListener('click', function () {
      const id = btn.dataset.id;
      if (btn.dataset.act === 'edit') openSessionModal('edit', id);
      else handleDeleteSession(id);
    });
  });
}

function handleDeleteSession(id) {
  if (!confirm('این رکورد حذف شود؟')) return;
  const list = getAttendance().filter(function (x) { return x.id !== id; });
  saveAttendance(list);
  renderAttendance();
  renderReports();
}

function openSessionModal(mode, editingId) {
  smState.mode = mode;
  smState.editingId = editingId || null;

  if (mode === 'edit' && editingId) {
    const s = getAttendance().find(function (x) { return x.id === editingId; });
    if (!s) return;
    const dIn = new Date(s.in);
    smState.date = new Date(dIn.getFullYear(), dIn.getMonth(), dIn.getDate());
    setTimePicker('sm-in', dIn.getHours(), dIn.getMinutes());
    if (s.out) {
      const dOut = new Date(s.out);
      setTimePicker('sm-out', dOut.getHours(), dOut.getMinutes());
    } else {
      setTimePicker('sm-out', 16, 40);
    }
    smTitle.textContent = 'ویرایش رکورد';
  } else {
    const now = new Date();
    smState.date = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    setTimePicker('sm-in', 8, 0);
    setTimePicker('sm-out', 16, 40);
    smTitle.textContent = 'افزودن رکورد دستی';
  }

  smDateDisp.textContent = faDateShort(smState.date);
  smError.textContent = '';
  smModal.classList.remove('hidden');
}

function closeSessionModal() {
  smModal.classList.add('hidden');
}

function handleSessionSave() {
  smError.textContent = '';

  if (!smState.date) {
    smError.textContent = 'لطفاً تاریخ را انتخاب کنید.';
    return;
  }

  const inStr = getTimePicker('sm-in');
  const outStr = getTimePicker('sm-out');

  const inParts = inStr.split(':');
  const outParts = outStr.split(':');
  const inMin = (+inParts[0]) * 60 + (+inParts[1]);
  const outMin = (+outParts[0]) * 60 + (+outParts[1]);

  if (outMin <= inMin) {
    smError.textContent = 'ساعت خروج باید بعد از ورود باشد.';
    return;
  }

  const inDate = new Date(smState.date);
  inDate.setHours(+inParts[0], +inParts[1], 0, 0);
  const outDate = new Date(smState.date);
  outDate.setHours(+outParts[0], +outParts[1], 0, 0);

  const list = getAttendance();

  if (smState.mode === 'edit' && smState.editingId) {
    let found = null;
    for (let i = 0; i < list.length; i++) {
      if (list[i].id === smState.editingId) { found = list[i]; break; }
    }
    if (!found) {
      smError.textContent = 'رکورد یافت نشد.';
      return;
    }
    found.in = inDate.toISOString();
    found.out = outDate.toISOString();
  } else {
    list.push({
      id: 'local-' + Date.now(),
      in: inDate.toISOString(),
      out: outDate.toISOString()
    });
  }

  saveAttendance(list);
  closeSessionModal();
  renderAttendance();
  renderReports();
}

function getLeaves() { return load(KEY_LEAVE) || []; }
function saveLeaves(list) {
  save(KEY_LEAVE, list);
  if (typeof sbSaveLeaves === 'function') {
    sbSaveLeaves(list).catch(function () {});
  }
}

function leaveHoursInYear(list) {
  let hours = 0;
  for (let i = 0; i < list.length; i++) {
    const rec = list[i];
    let refDate;
    if (rec.type === 'daily') refDate = new Date(rec.from);
    else refDate = new Date(rec.date);
    if (isInLeaveYear(refDate)) hours += rec.hours;
  }
  return hours;
}

function leavesOnDay(date) {
  const list = getLeaves();
  const key = localDateKey(date);
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  const result = [];

  for (let i = 0; i < list.length; i++) {
    const rec = list[i];
    if (rec.type === 'daily') {
      const from = new Date(rec.from);
      from.setHours(0, 0, 0, 0);
      const to = new Date(rec.to);
      to.setHours(0, 0, 0, 0);
      if (d >= from && d <= to) result.push(rec);
    } else {
      if (localDateKey(new Date(rec.date)) === key) result.push(rec);
    }
  }
  return result;
}

function updateDailyPreview() {
  if (!dailyFrom || !dailyTo) {
    dailyPreview.textContent = 'برای انتخاب بازه کلیک کنید.';
    return;
  }
  const days = countWorkingDays(dailyFrom, dailyTo);
  dailyPreview.textContent =
    'تعداد روزهای کاری: ' + toFaDigits(days) + ' روز — معادل ' +
    toFaDigits(days * HOURS_PER_DAY) + ' ساعت';
}

function updateHourlyPreview() {
  const s = getTimePicker('hourly-start');
  const e = getTimePicker('hourly-end');
  const sp = s.split(':');
  const ep = e.split(':');
  const startMin = (+sp[0]) * 60 + (+sp[1]);
  const endMin = (+ep[0]) * 60 + (+ep[1]);
  const diff = endMin - startMin;
  if (diff <= 0) {
    hourlyPreview.textContent = 'ساعت پایان باید بعد از شروع باشد.';
    return;
  }
  const hours = diff / 60;
  hourlyPreview.textContent = 'مدت: ' + toFaDigits(hours) + ' ساعت';
}

function handleAddDaily() {
  dailyError.textContent = '';
  if (!dailyFrom || !dailyTo) {
    dailyError.textContent = 'لطفاً بازه تاریخ را انتخاب کنید.';
    return;
  }
  const days = countWorkingDays(dailyFrom, dailyTo);
  if (days === 0) {
    dailyError.textContent = 'این بازه شامل روز کاری نیست.';
    return;
  }
  const hours = days * HOURS_PER_DAY;
  const remaining = LEAVE_YEAR_TOTAL_HOURS - leaveHoursInYear(getLeaves());
  if (hours > remaining) {
    dailyError.textContent = 'بیشتر از مانده است. مانده فعلی: ' + formatHoursAsDays(remaining);
    return;
  }
  const list = getLeaves();
  list.push({
    id: 'local-' + Date.now(),
    type: 'daily',
    from: dailyFrom.toISOString(),
    to: dailyTo.toISOString(),
    days: days,
    hours: hours,
    note: dailyNoteInp.value.trim()
  });
  saveLeaves(list);

  dailyFrom = null;
  dailyTo = null;
  rangeDisplay.textContent = 'انتخاب بازه تاریخ';
  btnPickRange.classList.remove('filled');
  dailyNoteInp.value = '';
  updateDailyPreview();
  renderLeave();
  renderReports();
}

function handleAddHourly() {
  hourlyError.textContent = '';
  if (!hourlyDate) {
    hourlyError.textContent = 'لطفاً تاریخ را انتخاب کنید.';
    return;
  }
  const s = getTimePicker('hourly-start');
  const e = getTimePicker('hourly-end');
  const sp = s.split(':');
  const ep = e.split(':');
  const startMin = (+sp[0]) * 60 + (+sp[1]);
  const endMin = (+ep[0]) * 60 + (+ep[1]);
  const diff = endMin - startMin;
  if (diff <= 0) {
    hourlyError.textContent = 'ساعت پایان باید بعد از شروع باشد.';
    return;
  }
  const hours = diff / 60;
  const remaining = LEAVE_YEAR_TOTAL_HOURS - leaveHoursInYear(getLeaves());
  if (hours > remaining) {
    hourlyError.textContent = 'بیشتر از مانده است. مانده فعلی: ' + formatHoursAsDays(remaining);
    return;
  }
  const list = getLeaves();
  list.push({
    id: 'local-' + Date.now(),
    type: 'hourly',
    date: hourlyDate.toISOString(),
    start: s,
    end: e,
    hours: hours,
    note: hourlyNoteInp.value.trim()
  });
  saveLeaves(list);

  hourlyDate = null;
  dateDisplay.textContent = 'انتخاب تاریخ';
  btnPickDate.classList.remove('filled');
  setTimePicker('hourly-start', 8, 0);
  setTimePicker('hourly-end', 10, 0);
  hourlyNoteInp.value = '';
  updateHourlyPreview();
  renderLeave();
  renderReports();
}

function handleDeleteLeave(id) {
  if (!confirm('این رکورد حذف شود؟')) return;
  const list = getLeaves().filter(function (x) { return x.id !== id; });
  saveLeaves(list);
  renderLeave();
  renderReports();
}

function renderLeave() {
  const list = getLeaves();
  const yearList = list.filter(function (rec) {
    let refDate;
    if (rec.type === 'daily') refDate = new Date(rec.from);
    else refDate = new Date(rec.date);
    return isInLeaveYear(refDate);
  });

  yearList.sort(function (a, b) {
    const da = a.type === 'daily' ? new Date(a.from) : new Date(a.date);
    const db = b.type === 'daily' ? new Date(b.from) : new Date(b.date);
    return db - da;
  });

  const usedHours = leaveHoursInYear(list);
  const remainingHours = Math.max(0, LEAVE_YEAR_TOTAL_HOURS - usedHours);
  leaveUsedEl.textContent = formatHoursAsDays(usedHours);
  leaveRemEl.textContent  = formatHoursAsDays(remainingHours);

  if (yearList.length === 0) {
    leaveListEl.innerHTML = '<div class="session-empty">هنوز مرخصی‌ای در این سال ثبت نشده است.</div>';
    return;
  }

  let html = '';
  for (let i = 0; i < yearList.length; i++) {
    const rec = yearList[i];
    let mainLine = '';
    let amount = '';

    if (rec.type === 'daily') {
      const from = new Date(rec.from);
      const to = new Date(rec.to);
      const fromStr = faDateShortNoYear(from);
      const toStr = faDateShortNoYear(to);
      if (fromStr === toStr) mainLine = faDateShort(from);
      else mainLine = fromStr + ' تا ' + toStr;
      amount = toFaDigits(rec.days) + ' روز';
    } else {
      const d = new Date(rec.date);
      mainLine = faDateShort(d) + ' — ' + toFaDigits(rec.start) + ' تا ' + toFaDigits(rec.end);
      amount = toFaDigits(rec.hours) + ' ساعت';
    }

    let noteHtml = '';
    if (rec.note) {
      noteHtml = '<div class="session-note">' + escapeHtml(rec.note) + '</div>';
    }

    html += '<div class="session-row">' +
              '<div class="session-main">' +
                '<div class="session-date">' + mainLine + '</div>' +
                noteHtml +
              '</div>' +
              '<span class="duration">' + amount + '</span>' +
              '<button class="session-btn danger" data-id="' + rec.id + '">حذف</button>' +
            '</div>';
  }
  leaveListEl.innerHTML = html;

  leaveListEl.querySelectorAll('.session-btn').forEach(function (btn) {
    btn.addEventListener('click', function () {
      handleDeleteLeave(btn.dataset.id);
    });
  });
}

function initHolidayCalendar() {
  const j = dateToJalaali(new Date());
  holCalState.viewYear = j.jy;
  holCalState.viewMonth = j.jm;
  renderHolidayCalendar();
}

function renderHolidayCalendar() {
  const jy = holCalState.viewYear;
  const jm = holCalState.viewMonth;

  holCalTitleEl.textContent = PERSIAN_MONTHS[jm - 1] + ' ' + toFaDigits(jy);

  const firstDay = jalaaliToDate(jy, jm, 1);
  const jsDay = firstDay.getDay();
  const persianStartCol = (jsDay + 1) % 7;

  const monthLen = jalaaliMonthLength(jy, jm);
  const prevMonthLen = jm === 1 ? jalaaliMonthLength(jy - 1, 12) : jalaaliMonthLength(jy, jm - 1);

  const todayKey = localDateKey(new Date());

  let html = '';
  for (let i = 0; i < persianStartCol; i++) {
    const dayNum = prevMonthLen - persianStartCol + i + 1;
    html += '<button type="button" class="cal-day other-month" disabled>' + toFaDigits(dayNum) + '</button>';
  }

  for (let d = 1; d <= monthLen; d++) {
    const date = jalaaliToDate(jy, jm, d);
    const dayKey = localDateKey(date);

    let cls = 'cal-day';
    if (dayKey === todayKey) cls += ' today';
    if (isFriday(date)) cls += ' cal-friday';
    if (holidayForDate(date)) cls += ' cal-holiday';

    html += '<button type="button" class="' + cls + '" data-date="' + dayKey + '">' + toFaDigits(d) + '</button>';
  }

  const totalCells = persianStartCol + monthLen;
  const remaining = (7 - (totalCells % 7)) % 7;
  for (let i = 1; i <= remaining; i++) {
    html += '<button type="button" class="cal-day other-month" disabled>' + toFaDigits(i) + '</button>';
  }

  holCalGridEl.innerHTML = html;

  holCalGridEl.querySelectorAll('.cal-day:not(.other-month)').forEach(function (btn) {
    btn.addEventListener('click', function () {
      toggleHoliday(parseLocalDateKey(btn.dataset.date));
    });
  });
}

function toggleHoliday(date) {
  if (isFriday(date)) {
    alert('جمعه‌ها به‌صورت خودکار تعطیل هستند و نیازی به ثبت ندارند.');
    return;
  }

  const key = localDateKey(date);
  const list = getHolidays();
  let idx = -1;
  for (let i = 0; i < list.length; i++) {
    if (localDateKey(new Date(list[i].date)) === key) { idx = i; break; }
  }

  if (idx >= 0) {
    if (!confirm(faDateShort(date) + ' از تعطیلات حذف شود؟')) return;
    list.splice(idx, 1);
  } else {
    const title = holidayTitleInp.value.trim();
    list.push({ id: 'local-' + Date.now(), date: date.toISOString(), title: title });
    holidayTitleInp.value = '';
  }
  saveHolidays(list);
  renderHolidayCalendar();
  renderHolidayList();
  updateHolidaysCount();
  updateDailyPreview();
  updateToday();
  renderReports();
}

function renderHolidayList() {
  const list = getHolidays().slice();
  list.sort(function (a, b) { return new Date(b.date) - new Date(a.date); });

  if (list.length === 0) {
    holidayListEl.innerHTML = '<div class="session-empty">هنوز تعطیلی دستی ثبت نشده است.</div>';
    return;
  }

  let html = '';
  for (let i = 0; i < list.length; i++) {
    const h = list[i];
    const date = new Date(h.date);
    let line = faDateShort(date);
    if (h.title) line += ' — ' + escapeHtml(h.title);

    html += '<div class="session-row">' +
              '<div class="session-main">' +
                '<div class="session-date">' + line + '</div>' +
              '</div>' +
              '<button class="session-btn danger" data-id="' + h.id + '">حذف</button>' +
            '</div>';
  }
  holidayListEl.innerHTML = html;

  holidayListEl.querySelectorAll('.session-btn').forEach(function (btn) {
    btn.addEventListener('click', function () {
      const id = btn.dataset.id;
      if (!confirm('این تعطیلی حذف شود؟')) return;
      const list = getHolidays().filter(function (x) { return x.id !== id; });
      saveHolidays(list);
      renderHolidayCalendar();
      renderHolidayList();
      updateHolidaysCount();
      updateDailyPreview();
      updateToday();
      renderReports();
    });
  });
}

function updateHolidaysCount() {
  const list = getHolidays();
  let count = 0;
  for (let i = 0; i < list.length; i++) {
    if (isInLeaveYear(new Date(list[i].date))) count++;
  }
  holidaysCountEl.textContent = toFaDigits(count) + ' روز';
}

function computeReportRange() {
  if (reportFrom || reportTo) {
    const f = reportFrom ? new Date(reportFrom) : null;
    const t = reportTo ? new Date(reportTo) : null;
    if (f) f.setHours(0, 0, 0, 0);
    if (t) t.setHours(23, 59, 59, 999);
    return { from: f, to: t };
  }

  const list = getAttendance();
  const leaves = getLeaves();
  if (list.length === 0 && leaves.length === 0) return null;

  let min = null, max = null;

  for (let i = 0; i < list.length; i++) {
    const d = new Date(list[i].in);
    d.setHours(0, 0, 0, 0);
    if (!min || d < min) min = new Date(d);
    if (!max || d > max) max = new Date(d);
  }

  for (let i = 0; i < leaves.length; i++) {
    const rec = leaves[i];
    let startD, endD;
    if (rec.type === 'daily') {
      startD = new Date(rec.from);
      endD = new Date(rec.to);
    } else {
      startD = new Date(rec.date);
      endD = new Date(rec.date);
    }
    startD.setHours(0, 0, 0, 0);
    endD.setHours(0, 0, 0, 0);
    if (!min || startD < min) min = new Date(startD);
    if (!max || endD > max) max = new Date(endD);
  }

  if (!min) return null;
  return { from: min, to: max };
}

function buildReportDays(range) {
  const list = getAttendance();
  const days = groupByLocalDay(list);
  const result = [];
  const from = range.from ? new Date(range.from) : null;
  const to = range.to ? new Date(range.to) : null;
  if (!from || !to) return result;

  from.setHours(0, 0, 0, 0);
  to.setHours(0, 0, 0, 0);

  const d = new Date(from);
  while (d <= to) {
    const key = localDateKey(d);
    const sessions = (days[key] || []).slice();
    sessions.sort(function (a, b) { return new Date(a.in) - new Date(b.in); });

    const dayLeaves = leavesOnDay(d);
    let dailyLeaveHours = 0;
    let hourlyLeaveHours = 0;
    for (let k = 0; k < dayLeaves.length; k++) {
      if (dayLeaves[k].type === 'daily') dailyLeaveHours += dayLeaves[k].hours;
      else hourlyLeaveHours += dayLeaves[k].hours;
    }

    result.push({
      date: new Date(d),
      key: key,
      sessions: sessions,
      ms: dayTotalMs(sessions),
      holiday: isHoliday(d),
      friday: isFriday(d),
      leaves: dayLeaves,
      dailyLeaveHours: dailyLeaveHours,
      hourlyLeaveHours: hourlyLeaveHours
    });
    d.setDate(d.getDate() + 1);
  }
  return result;
}

function updateReportChips() {
  document.querySelectorAll('.chip[data-range]').forEach(function (c) {
    c.classList.toggle('active', c.dataset.range === reportChip);
  });
}

function setReportRangeFromChip(chip) {
  reportChip = chip;
  reportFrom = null;
  reportTo = null;

  const now = new Date();
  now.setHours(0, 0, 0, 0);

  if (chip === 'week') {
    reportFrom = startOfPersianWeek(now);
    reportTo = now;
  } else if (chip === 'month') {
    const j = dateToJalaali(now);
    reportFrom = jalaaliToDate(j.jy, j.jm, 1);
    reportTo = now;
  } else if (chip === 'leaveyear') {
    const r = currentLeaveYear();
    reportFrom = jalaaliToDate(r.startJY, r.startJM, 1);
    const endLen = jalaaliMonthLength(r.endJY, r.endJM);
    reportTo = jalaaliToDate(r.endJY, r.endJM, endLen);
  }
  updateReportChips();
  renderReports();
}

function dayMatchesSearch(day, searchTerm) {
  if (!searchTerm) return true;
  const s = searchTerm.toLowerCase();

  const dateStr = faWeekday(day.date) + ' ' + faDateShortNoYear(day.date) + ' ' + faDateShort(day.date);
  if (dateStr.toLowerCase().indexOf(s) >= 0) return true;

  for (let i = 0; i < day.sessions.length; i++) {
    const sess = day.sessions[i];
    const inTime = faTimeString(new Date(sess.in));
    const outTime = sess.out ? faTimeString(new Date(sess.out)) : '—';
    if ((inTime + ' ' + outTime + ' حضور کارکرد').toLowerCase().indexOf(s) >= 0) return true;
  }

  for (let i = 0; i < day.leaves.length; i++) {
    const lv = day.leaves[i];
    let text = 'مرخصی ';
    if (lv.type === 'daily') text += 'روزانه ';
    else text += 'ساعتی ' + lv.start + ' ' + lv.end + ' ';
    if (lv.note) text += lv.note;
    if (text.toLowerCase().indexOf(s) >= 0) return true;
  }

  if (day.holiday) {
    let title = day.friday ? 'جمعه تعطیل' : 'تعطیل';
    const h = holidayForDate(day.date);
    if (h && h.title) title += ' ' + h.title;
    if (title.toLowerCase().indexOf(s) >= 0) return true;
  }

  return false;
}

function renderReports() {
  if (!repTotalEl) return;

  repFromDisplay.textContent = reportFrom ? faDateShort(reportFrom) : 'همه';
  repToDisplay.textContent   = reportTo ? faDateShort(reportTo) : 'همه';
  repPickFrom.classList.toggle('filled', !!reportFrom);
  repPickTo.classList.toggle('filled', !!reportTo);

  const range = computeReportRange();

  if (!range || (!range.from && !range.to)) {
    repTotalEl.textContent = '۰:۰۰';
    repDaysEl.textContent = '۰';
    repRequiredEl.textContent = '۰:۰۰';
    repAvgEl.textContent = '۰:۰۰';
    repDiffEl.textContent = '';
    repDiffEl.className = 'report-diff';
    repAvgWeekEl.textContent = '';
    if (repProgressBar) {
      repProgressBar.style.width = '0%';
      repProgressBar.classList.remove('over', 'under');
    }
    repChartEl.innerHTML = '<div class="chart-empty">هنوز رکوردی ثبت نشده است.</div>';
    repMonthChartEl.innerHTML = '<div class="chart-empty">داده‌ای نیست.</div>';
    repYearSumEl.innerHTML = '<div class="chart-empty">داده‌ای نیست.</div>';
    repListEl.innerHTML = '<div class="session-empty">هنوز رکوردی ثبت نشده است.</div>';
    return;
  }

  const days = buildReportDays(range);

  let totalMs = 0;
  let workedDays = 0;
  let requiredMs = 0;
  let dailyLeaveDays = 0;
  let totalHourlyLeaveHours = 0;

  for (let i = 0; i < days.length; i++) {
    const day = days[i];
    totalMs += day.ms;
    if (day.ms > 0) workedDays++;

    const hasDailyLeave = day.dailyLeaveHours > 0;
    if (hasDailyLeave) dailyLeaveDays++;

    totalHourlyLeaveHours += day.hourlyLeaveHours;

    if (day.holiday || hasDailyLeave) continue;

    const dayRequiredHours = Math.max(0, HOURS_PER_DAY - day.hourlyLeaveHours);
    requiredMs += dayRequiredHours * 3600000;
  }

  const diffMs = totalMs - requiredMs;

  repTotalEl.textContent = faDuration(totalMs);
  repDaysEl.textContent = toFaDigits(workedDays);
  repRequiredEl.textContent = faDuration(requiredMs);

  const avgMs = workedDays > 0 ? totalMs / workedDays : 0;
  repAvgEl.textContent = faDuration(avgMs);

  if (repProgressBar) {
    let pct = requiredMs > 0 ? (totalMs / requiredMs) * 100 : 0;
    if (pct > 100) pct = 100;
    repProgressBar.style.width = pct.toFixed(1) + '%';
    repProgressBar.classList.remove('over', 'under');
    if (totalMs > requiredMs) repProgressBar.classList.add('over');
    else if (totalMs < requiredMs) repProgressBar.classList.add('under');
  }

  if (diffMs === 0) {
    repDiffEl.textContent = 'دقیقاً معادل موظفی';
    repDiffEl.className = 'report-diff';
  } else if (diffMs > 0) {
    repDiffEl.textContent = faDuration(diffMs) + ' بیشتر از موظفی کار کرده‌اید';
    repDiffEl.className = 'report-diff positive';
  } else {
    repDiffEl.textContent = faDuration(-diffMs) + ' کمتر از موظفی کار کرده‌اید';
    repDiffEl.className = 'report-diff negative';
  }

  const extras = [];
  if (dailyLeaveDays > 0) extras.push(toFaDigits(dailyLeaveDays) + ' روز مرخصی روزانه');
  if (totalHourlyLeaveHours > 0) extras.push(toFaDigits(Math.round(totalHourlyLeaveHours * 100) / 100) + ' ساعت مرخصی ساعتی');
  if (extras.length > 0) repDiffEl.textContent += ' — ' + extras.join('، ');

  if (days.length > 0) {
    const weeks = days.length / 7;
    const avgWeekMs = weeks > 0 ? totalMs / weeks : 0;
    repAvgWeekEl.textContent = 'میانگین هفتگی: ' + faDuration(avgWeekMs);
  } else {
    repAvgWeekEl.textContent = '';
  }

  const filteredDays = reportSearch
    ? days.filter(function (d) { return dayMatchesSearch(d, reportSearch); })
    : days;

  renderReportChart(days);
  renderReportMonthChart();
  renderReportYearSummary();
  renderReportList(filteredDays, days.length);
}

function renderReportChart(days) {
  if (days.length === 0) {
    repChartEl.innerHTML = '<div class="chart-empty">داده‌ای نیست.</div>';
    return;
  }

  let maxMs = 0;
  for (let i = 0; i < days.length; i++) {
    if (days[i].ms > maxMs) maxMs = days[i].ms;
  }
  if (maxMs === 0) maxMs = HOURS_PER_DAY * 3600000;

  let html = '';
  for (let i = 0; i < days.length; i++) {
    const day = days[i];
    const j = dateToJalaali(day.date);
    const pct = maxMs > 0 ? (day.ms / maxMs) * 100 : 0;

    let barCls = 'chart-bar';
    if (day.ms === 0) barCls += ' is-zero';
    if (day.holiday) barCls += ' is-holiday';

    html += '<div class="chart-col">' +
              '<div class="chart-bar-area">' +
                '<div class="' + barCls + '" style="height:' + pct.toFixed(1) + '%"></div>' +
              '</div>' +
              '<div class="chart-label">' + toFaDigits(j.jd) + '</div>' +
            '</div>';
  }
  repChartEl.innerHTML = html;
}

function renderReportMonthChart() {
  const list = getAttendance();
  const days = groupByLocalDay(list);
  const months = getLeaveYearMonths();
  const totals = [];

  for (let i = 0; i < months.length; i++) {
    const m = months[i];
    const monthKey = m.jy + '-' + m.jm;
    let ms = 0;
    for (const key in days) {
      const dayDate = parseLocalDateKey(key);
      if (faYearMonthKey(dayDate) === monthKey) {
        ms += dayTotalMs(days[key]);
      }
    }
    totals.push({ jy: m.jy, jm: m.jm, ms: ms });
  }

  let maxMs = 0;
  for (let i = 0; i < totals.length; i++) if (totals[i].ms > maxMs) maxMs = totals[i].ms;
  if (maxMs === 0) maxMs = HOURS_PER_DAY * 3600000 * 20;

  let html = '';
  for (let i = 0; i < totals.length; i++) {
    const t = totals[i];
    const pct = maxMs > 0 ? (t.ms / maxMs) * 100 : 0;
    let barCls = 'chart-bar';
    if (t.ms === 0) barCls += ' is-zero';

    html += '<div class="chart-col chart-col-month">' +
              '<div class="chart-bar-area">' +
                '<div class="' + barCls + '" style="height:' + pct.toFixed(1) + '%"></div>' +
              '</div>' +
              '<div class="chart-label chart-label-month">' + PERSIAN_MONTHS[t.jm - 1] + '</div>' +
            '</div>';
  }
  repMonthChartEl.innerHTML = html;
}

function renderReportYearSummary() {
  const r = currentLeaveYear();
  const list = getAttendance();
  const leaves = getLeaves();

  const startDate = jalaaliToDate(r.startJY, r.startJM, 1);
  const endLen = jalaaliMonthLength(r.endJY, r.endJM);
  const endDate = jalaaliToDate(r.endJY, r.endJM, endLen);

  let totalMs = 0;
  let workedDays = 0;
  const days = groupByLocalDay(list);
  for (const key in days) {
    const dayDate = parseLocalDateKey(key);
    if (dayDate >= startDate && dayDate <= endDate) {
      const ms = dayTotalMs(days[key]);
      totalMs += ms;
      if (ms > 0) workedDays++;
    }
  }

  let dailyLeaveDays = 0;
  let hourlyLeaveHours = 0;
  for (let i = 0; i < leaves.length; i++) {
    const rec = leaves[i];
    const refDate = rec.type === 'daily' ? new Date(rec.from) : new Date(rec.date);
    if (refDate >= startDate && refDate <= endDate) {
      if (rec.type === 'daily') dailyLeaveDays += rec.days;
      else hourlyLeaveHours += rec.hours;
    }
  }

  const header = 'از ' + faDateShort(startDate) + ' تا ' + faDateShort(endDate);

  let html = '<div class="year-summary-head">' + header + '</div>';
  html += '<div class="year-summary-grid">';
  html += '<div class="ys-item"><span>جمع کارکرد</span><b>' + faDuration(totalMs) + '</b></div>';
  html += '<div class="ys-item"><span>روزهای کاری</span><b>' + toFaDigits(workedDays) + ' روز</b></div>';
  html += '<div class="ys-item"><span>مرخصی روزانه</span><b>' + toFaDigits(dailyLeaveDays) + ' روز</b></div>';
  html += '<div class="ys-item"><span>مرخصی ساعتی</span><b>' + toFaDigits(Math.round(hourlyLeaveHours * 100) / 100) + ' ساعت</b></div>';
  html += '<div class="ys-item"><span>مرخصی باقی‌مانده</span><b>' + formatHoursAsDays(Math.max(0, LEAVE_YEAR_TOTAL_HOURS - leaveHoursInYear(leaves))) + '</b></div>';
  const avgYearMs = workedDays > 0 ? totalMs / workedDays : 0;
  html += '<div class="ys-item"><span>میانگین روزانه</span><b>' + faDuration(avgYearMs) + '</b></div>';
  html += '</div>';

  repYearSumEl.innerHTML = html;
}

function groupDaysByPersianWeek(days) {
  const groups = {};
  const order = [];

  for (let i = 0; i < days.length; i++) {
    const day = days[i];
    const weekStart = startOfPersianWeek(day.date);
    const key = localDateKey(weekStart);
    if (!groups[key]) {
      groups[key] = { weekStart: weekStart, days: [] };
      order.push(key);
    }
    groups[key].days.push(day);
  }

  return order.map(function (k) { return groups[k]; });
}

function weekRangeLabel(weekStart) {
  const weekEnd = new Date(weekStart);
  weekEnd.setDate(weekEnd.getDate() + 6);
  const jS = dateToJalaali(weekStart);
  const jE = dateToJalaali(weekEnd);
  const sStr = toFaDigits(jS.jd) + ' ' + PERSIAN_MONTHS[jS.jm - 1];
  const eStr = toFaDigits(jE.jd) + ' ' + PERSIAN_MONTHS[jE.jm - 1] + ' ' + toFaDigits(jE.jy);
  return sStr + ' تا ' + eStr;
}

function renderReportList(days, totalCount) {
  if (totalCount === 0) {
    repListEl.innerHTML = '<div class="session-empty">داده‌ای نیست.</div>';
    return;
  }

  if (days.length === 0) {
    repListEl.innerHTML = '<div class="session-empty">هیچ رکوردی با این جستجو پیدا نشد.</div>';
    return;
  }

  const sorted = days.slice().sort(function (a, b) {
    return b.date - a.date;
  });

  const groups = groupDaysByPersianWeek(sorted);

  let html = '';
  for (let gi = 0; gi < groups.length; gi++) {
    const group = groups[gi];
    let weekMs = 0;
    let dayCount = 0;
    for (let i = 0; i < group.days.length; i++) {
      weekMs += group.days[i].ms;
      if (group.days[i].ms > 0 || group.days[i].sessions.length > 0 || group.days[i].leaves.length > 0) dayCount++;
    }

    const isOpen = gi === 0;
    const openCls = isOpen ? ' open' : '';

    let bodyHtml = '';
    const reversedDays = group.days.slice().reverse();
    for (let i = 0; i < reversedDays.length; i++) {
      const day = reversedDays[i];
      const dateStr = faWeekday(day.date) + ' ' + faDateShortNoYear(day.date);

      if (day.sessions.length === 0) {
        if (day.leaves.length > 0) {
          for (let k = 0; k < day.leaves.length; k++) {
            const lv = day.leaves[k];
            let lvText;
            if (lv.type === 'daily') {
              lvText = 'مرخصی روزانه';
              if (lv.note) lvText += ' — ' + escapeHtml(lv.note);
            } else {
              lvText = 'مرخصی ساعتی ' + toFaDigits(lv.start) + ' تا ' + toFaDigits(lv.end);
              if (lv.note) lvText += ' — ' + escapeHtml(lv.note);
            }
            bodyHtml += '<div class="session-row">' +
                          '<div class="session-main">' +
                            '<div class="session-date">' + dateStr + '</div>' +
                            '<div class="session-note">' + lvText + '</div>' +
                          '</div>' +
                        '</div>';
          }
        } else if (day.holiday) {
          let title = 'تعطیل';
          if (day.friday) {
            title = 'جمعه';
          } else {
            const h = holidayForDate(day.date);
            if (h && h.title) title = h.title;
          }
          bodyHtml += '<div class="session-row is-holiday">' +
                        '<div class="session-main">' +
                          '<div class="session-date">' + dateStr + '</div>' +
                          '<div class="session-note">' + escapeHtml(title) + '</div>' +
                        '</div>' +
                      '</div>';
        } else {
          bodyHtml += '<div class="session-row">' +
                        '<div class="session-main">' +
                          '<div class="session-date">' + dateStr + '</div>' +
                          '<div class="session-note">بدون رکورد</div>' +
                        '</div>' +
                      '</div>';
        }
        continue;
      }

      for (let s = 0; s < day.sessions.length; s++) {
        bodyHtml += sessionRowHtml(day.sessions[s], true, dateStr);
      }

      if (day.leaves.length > 0) {
        for (let k = 0; k < day.leaves.length; k++) {
          const lv = day.leaves[k];
          let lvText;
          if (lv.type === 'daily') {
            lvText = 'مرخصی روزانه';
            if (lv.note) lvText += ' — ' + escapeHtml(lv.note);
          } else {
            lvText = 'مرخصی ساعتی ' + toFaDigits(lv.start) + ' تا ' + toFaDigits(lv.end);
            if (lv.note) lvText += ' — ' + escapeHtml(lv.note);
          }
          bodyHtml += '<div class="session-row">' +
                        '<div class="session-main">' +
                          '<div class="session-date">' + dateStr + '</div>' +
                          '<div class="session-note">' + lvText + '</div>' +
                        '</div>' +
                      '</div>';
        }
      }
    }

    html += '<div class="rep-week' + openCls + '">' +
              '<button type="button" class="rep-week-head" data-week-toggle>' +
                '<span class="rep-week-arrow">▾</span>' +
                '<span class="rep-week-title">' + weekRangeLabel(group.weekStart) + '</span>' +
                '<span class="rep-week-meta">' + toFaDigits(dayCount) + ' روز</span>' +
                '<span class="rep-week-total">' + faDuration(weekMs) + '</span>' +
              '</button>' +
              '<div class="rep-week-body">' + bodyHtml + '</div>' +
            '</div>';
  }

  repListEl.innerHTML = html;

  repListEl.querySelectorAll('[data-week-toggle]').forEach(function (btn) {
    btn.addEventListener('click', function () {
      const week = btn.closest('.rep-week');
      if (week) week.classList.toggle('open');
    });
  });

  repListEl.querySelectorAll('.session-btn').forEach(function (btn) {
    btn.addEventListener('click', function () {
      const id = btn.dataset.id;
      if (btn.dataset.act === 'edit') openSessionModal('edit', id);
      else handleDeleteSession(id);
    });
  });
}

function exportReportCSV() {
  const range = computeReportRange();
  if (!range || !range.from) {
    alert('داده‌ای برای خروجی نیست.');
    return;
  }

  const days = buildReportDays(range);
  const lines = [];
  lines.push('تاریخ,روز هفته,ساعت ورود,ساعت خروج,مدت (ساعت),نوع,توضیحات');

  for (let i = 0; i < days.length; i++) {
    const day = days[i];
    const dateStr = faDateShort(day.date);
    const weekday = faWeekday(day.date);

    if (day.sessions.length === 0) {
      if (day.leaves.length > 0) {
        for (let k = 0; k < day.leaves.length; k++) {
          const lv = day.leaves[k];
          if (lv.type === 'daily') {
            lines.push(csvRow([dateStr, weekday, '', '', '', 'مرخصی روزانه', lv.note || '']));
          } else {
            lines.push(csvRow([dateStr, weekday, lv.start, lv.end, lv.hours, 'مرخصی ساعتی', lv.note || '']));
          }
        }
      } else if (day.holiday) {
        let title = day.friday ? 'جمعه' : ((holidayForDate(day.date) && holidayForDate(day.date).title) || 'تعطیل');
        lines.push(csvRow([dateStr, weekday, '', '', '', 'تعطیل', title]));
      } else {
        lines.push(csvRow([dateStr, weekday, '', '', '', 'بدون رکورد', '']));
      }
      continue;
    }

    for (let s = 0; s < day.sessions.length; s++) {
      const sess = day.sessions[s];
      const inTime = faTimeString(new Date(sess.in));
      const outTime = sess.out ? faTimeString(new Date(sess.out)) : '—';
      const hours = sess.out ? ((new Date(sess.out) - new Date(sess.in)) / 3600000) : 0;
      lines.push(csvRow([dateStr, weekday, inTime, outTime, hours.toFixed(2), 'حضور', '']));
    }

    if (day.leaves.length > 0) {
      for (let k = 0; k < day.leaves.length; k++) {
        const lv = day.leaves[k];
        if (lv.type === 'daily') {
          lines.push(csvRow([dateStr, weekday, '', '', '', 'مرخصی روزانه', lv.note || '']));
        } else {
          lines.push(csvRow([dateStr, weekday, lv.start, lv.end, lv.hours, 'مرخصی ساعتی', lv.note || '']));
        }
      }
    }
  }

  const csv = '\uFEFF' + lines.join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
  const now = new Date();
  const j = dateToJalaali(now);
  const fname = 'worklog-report-' + j.jy + '-' + pad2(j.jm) + '-' + pad2(j.jd) + '.csv';

  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = fname;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(function () { URL.revokeObjectURL(url); }, 1000);
}

function csvRow(arr) {
  return arr.map(function (v) {
    const s = String(v == null ? '' : v);
    if (s.indexOf(',') >= 0 || s.indexOf('"') >= 0 || s.indexOf('\n') >= 0) {
      return '"' + s.replace(/"/g, '""') + '"';
    }
    return s;
  }).join(',');
}

function handlePrint() {
  switchView('reports');
  setTimeout(function () {
    window.print();
  }, 250);
}

function openCalendar(mode, initialFrom, initialTo, callback) {
  calState.mode = mode;
  calState.from = initialFrom ? new Date(initialFrom) : null;
  calState.to = initialTo ? new Date(initialTo) : null;
  calState.callback = callback;
  calState.activeSlot = mode === 'range' ? 'from' : null;

  let refDate = initialFrom ? new Date(initialFrom) : new Date();
  const j = dateToJalaali(refDate);
  calState.viewYear = j.jy;
  calState.viewMonth = j.jm;

  calModal.classList.remove('hidden');
  renderCalendar();
}

function closeCalendar() {
  calModal.classList.add('hidden');
}

function renderCalendar() {
  const jy = calState.viewYear;
  const jm = calState.viewMonth;

  calTitle.textContent = PERSIAN_MONTHS[jm - 1] + ' ' + toFaDigits(jy);

  if (calState.mode === 'range') {
    calSlots.classList.remove('hidden');
    calFromVal.textContent = calState.from ? faDateShort(calState.from) : 'انتخاب';
    calToVal.textContent = calState.to ? faDateShort(calState.to) : 'انتخاب';
    calSlotFrom.classList.toggle('active', calState.activeSlot === 'from');
    calSlotTo.classList.toggle('active', calState.activeSlot === 'to');
  } else {
    calSlots.classList.add('hidden');
  }

  const firstDay = jalaaliToDate(jy, jm, 1);
  const jsDay = firstDay.getDay();
  const persianStartCol = (jsDay + 1) % 7;

  const monthLen = jalaaliMonthLength(jy, jm);
  const prevMonthLen = jm === 1 ? jalaaliMonthLength(jy - 1, 12) : jalaaliMonthLength(jy, jm - 1);

  const todayKey = localDateKey(new Date());

  let html = '';
  for (let i = 0; i < persianStartCol; i++) {
    const dayNum = prevMonthLen - persianStartCol + i + 1;
    html += '<button type="button" class="cal-day other-month" disabled>' + toFaDigits(dayNum) + '</button>';
  }

  for (let d = 1; d <= monthLen; d++) {
    const date = jalaaliToDate(jy, jm, d);
    const dayKey = localDateKey(date);

    let cls = 'cal-day';
    if (dayKey === todayKey) cls += ' today';
    if (isFriday(date)) cls += ' cal-friday';
    if (holidayForDate(date)) cls += ' cal-holiday';

    if (calState.mode === 'range') {
      if (calState.from && dayKey === localDateKey(calState.from)) cls += ' selected';
      if (calState.to && dayKey === localDateKey(calState.to)) cls += ' selected';
      if (calState.from && calState.to && date > calState.from && date < calState.to) {
        cls += ' in-range';
      }
    } else {
      const current = calState.from;
      if (current && dayKey === localDateKey(current)) cls += ' selected';
    }

    html += '<button type="button" class="' + cls + '" data-date="' + dayKey + '">' + toFaDigits(d) + '</button>';
  }

  const totalCells = persianStartCol + monthLen;
  const remaining = (7 - (totalCells % 7)) % 7;
  for (let i = 1; i <= remaining; i++) {
    html += '<button type="button" class="cal-day other-month" disabled>' + toFaDigits(i) + '</button>';
  }

  calGrid.innerHTML = html;

  calGrid.querySelectorAll('.cal-day:not(.other-month)').forEach(function (btn) {
    btn.addEventListener('click', function () {
      handleCalendarPick(parseLocalDateKey(btn.dataset.date));
    });
  });
}

function handleCalendarPick(date) {
  if (calState.mode === 'range') {
    if (calState.activeSlot === 'from') {
      calState.from = date;
      if (calState.to && calState.to < date) calState.to = null;
      calState.activeSlot = 'to';
      renderCalendar();
      return;
    } else {
      if (!calState.from) {
        calState.from = date;
        calState.activeSlot = 'to';
        renderCalendar();
        return;
      }
      let f = calState.from;
      let t = date;
      if (t < f) { const tmp = f; f = t; t = tmp; }
      const cb = calState.callback;
      closeCalendar();
      if (cb) cb(f, t);
      return;
    }
  } else {
    calState.from = date;
    const cb = calState.callback;
    closeCalendar();
    if (cb) cb(date);
    return;
  }
}

function calPrevMonth() {
  calState.viewMonth--;
  if (calState.viewMonth < 1) {
    calState.viewMonth = 12;
    calState.viewYear--;
  }
  renderCalendar();
}

function calNextMonth() {
  calState.viewMonth++;
  if (calState.viewMonth > 12) {
    calState.viewMonth = 1;
    calState.viewYear++;
  }
  renderCalendar();
}

document.querySelectorAll('.tab').forEach(function (btn) {
  btn.addEventListener('click', function () {
    document.querySelectorAll('.tab').forEach(function (b) { b.classList.remove('active'); });
    document.querySelectorAll('.tab-content').forEach(function (c) { c.classList.add('hidden'); });
    btn.classList.add('active');
    document.getElementById('tab-' + btn.dataset.tab).classList.remove('hidden');
  });
});

initTheme();

document.querySelectorAll('.theme-btn').forEach(function (btn) {
  btn.addEventListener('click', function () {
    setTheme(btn.dataset.theme);
  });
});

btnLogin.addEventListener('click', handleLogin);
btnLogout.addEventListener('click', handleLogout);
btnIn.addEventListener('click', handleCheckIn);
btnOut.addEventListener('click', handleCheckOut);
btnAddDaily.addEventListener('click', handleAddDaily);
btnAddHourly.addEventListener('click', handleAddHourly);
btnChangePwd.addEventListener('click', handleChangePassword);
btnAddManual.addEventListener('click', function () { openSessionModal('add', null); });
btnBackup.addEventListener('click', handleBackup);
inpRestore.addEventListener('change', handleRestoreFile);
btnClearAll.addEventListener('click', handleClearAll);
repExportBtn.addEventListener('click', exportReportCSV);
if (repPrintBtn) repPrintBtn.addEventListener('click', handlePrint);

$('bulk-prev').addEventListener('click', handleBulkPrev);
$('bulk-next').addEventListener('click', handleBulkNext);
$('bulk-fill').addEventListener('click', handleBulkFill);
$('bulk-clear').addEventListener('click', handleBulkClearForm);
$('bulk-save').addEventListener('click', handleBulkSave);

$('bulk-list').addEventListener('change', function () {
  bulkState.dirty = true;
});

$('bulk-list').addEventListener('click', function (e) {
  const addBtn = e.target.closest('[data-action="add-session"]');
  if (addBtn) {
    handleBulkAddSession(addBtn);
    return;
  }
  const rmBtn = e.target.closest('[data-action="remove-session"]');
  if (rmBtn) {
    handleBulkRemoveSession(rmBtn);
    return;
  }
});

inpPersonnel.addEventListener('keydown', function (e) {
  if (e.key === 'Enter') handleLogin();
});
inpPassword.addEventListener('keydown', function (e) {
  if (e.key === 'Enter') handleLogin();
});

document.querySelectorAll('.nav-item').forEach(function (btn) {
  btn.addEventListener('click', function () {
    switchView(btn.dataset.view);
  });
});

btnPickRange.addEventListener('click', function () {
  openCalendar('range', dailyFrom, dailyTo, function (from, to) {
    dailyFrom = from;
    dailyTo = to;
    rangeDisplay.textContent = faDateShortNoYear(from) + ' تا ' + faDateShortNoYear(to);
    btnPickRange.classList.add('filled');
    updateDailyPreview();
  });
});

btnPickDate.addEventListener('click', function () {
  openCalendar('single', hourlyDate, null, function (date) {
    hourlyDate = date;
    dateDisplay.textContent = faDateShort(date);
    btnPickDate.classList.add('filled');
  });
});

document.querySelectorAll('.chip[data-range]').forEach(function (chip) {
  chip.addEventListener('click', function () {
    setReportRangeFromChip(chip.dataset.range);
  });
});

repPickFrom.addEventListener('click', function () {
  openCalendar('single', reportFrom, null, function (date) {
    reportFrom = date;
    if (reportTo && reportTo < date) reportTo = null;
    reportChip = null;
    updateReportChips();
    renderReports();
  });
});

repPickTo.addEventListener('click', function () {
  openCalendar('single', reportTo, null, function (date) {
    reportTo = date;
    if (reportFrom && reportFrom > date) reportFrom = null;
    reportChip = null;
    updateReportChips();
    renderReports();
  });
});

repClear.addEventListener('click', function () {
  reportFrom = null;
  reportTo = null;
  reportChip = 'all';
  reportSearch = '';
  if (repSearchInp) repSearchInp.value = '';
  updateReportChips();
  renderReports();
});

if (repSearchInp) {
  repSearchInp.addEventListener('input', function () {
    reportSearch = repSearchInp.value.trim();
    renderReports();
  });
}

smDateBtn.addEventListener('click', function () {
  openCalendar('single', smState.date, null, function (date) {
    smState.date = date;
    smDateDisp.textContent = faDateShort(date);
  });
});

smCancel.addEventListener('click', closeSessionModal);
smBackdrop.addEventListener('click', closeSessionModal);
smSave.addEventListener('click', handleSessionSave);

calPrev.addEventListener('click', calPrevMonth);
calNext.addEventListener('click', calNextMonth);
calCancel.addEventListener('click', closeCalendar);
calBackdrop.addEventListener('click', closeCalendar);

calSlotFrom.addEventListener('click', function () {
  if (calState.mode !== 'range') return;
  calState.activeSlot = 'from';
  renderCalendar();
});

calSlotTo.addEventListener('click', function () {
  if (calState.mode !== 'range') return;
  if (!calState.from) return;
  calState.activeSlot = 'to';
  renderCalendar();
});

holCalPrev.addEventListener('click', function () {
  holCalState.viewMonth--;
  if (holCalState.viewMonth < 1) {
    holCalState.viewMonth = 12;
    holCalState.viewYear--;
  }
  renderHolidayCalendar();
});

holCalNext.addEventListener('click', function () {
  holCalState.viewMonth++;
  if (holCalState.viewMonth > 12) {
    holCalState.viewMonth = 1;
    holCalState.viewYear++;
  }
  renderHolidayCalendar();
});

['hourly-start-h','hourly-start-m','hourly-end-h','hourly-end-m'].forEach(function (id) {
  $(id).addEventListener('change', updateHourlyPreview);
});

setInterval(updateClock, 1000);
setInterval(function () {
  if (!pageDashboard.classList.contains('hidden')) renderAttendance();
}, 30000);

initTimePickers();
updateClock();

(async function init() {
  try {
    const { data } = await sb.auth.getSession();
    if (data && data.session) {
      const email = data.session.user.email || '';
      if (email.endsWith('@worklog.app')) {
        save(KEY_USER, { personnel: email.replace('@worklog.app', '') });
      }
      save(KEY_SESSION, true);
      await showDashboard();
    } else {
      showLogin();
    }
  } catch (e) {
    showLogin();
  }
})();