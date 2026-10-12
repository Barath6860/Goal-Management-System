/* ==========================================================================
   GoalMap · utils.js
   Small helpers shared by every page: dates, HTML escaping, icons,
   progress bars, toast messages, modal dialogs and form errors.
   ========================================================================== */
'use strict';

/** Each page file registers its render function here, e.g. Pages.timeline = ... */
const Pages = {};

const U = (() => {
  const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

  /* ---------- Dates: always stored as "YYYY-MM-DD" text ---------- */
  const pad = n => String(n).padStart(2, '0');
  const toISO = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  function parse(iso) {
    const [y, m, d] = iso.split('-').map(Number);
    return new Date(y, m - 1, d);
  }
  const today = () => toISO(new Date());
  function addDays(iso, n) {
    const d = parse(iso);
    d.setDate(d.getDate() + n);
    return toISO(d);
  }
  /** Number of days from date a to date b. */
  const diff = (a, b) => Math.round((parse(b) - parse(a)) / 86400000);
  const isValidDate = s => /^\d{4}-\d{2}-\d{2}$/.test(s || '') && toISO(parse(s)) === s;
  function fmt(iso) {
    if (!iso) return '—';
    const d = parse(iso);
    return `${d.getDate()} ${MONTHS[d.getMonth()]} ${d.getFullYear()}`;
  }
  function fmtShort(iso) {
    const d = parse(iso);
    return `${d.getDate()} ${MONTHS[d.getMonth()]}`;
  }
  /** "12 days left", "Due today", "3 days overdue" */
  function daysLeft(targetDate) {
    const n = diff(today(), targetDate);
    if (n > 0) return `${n} day${n === 1 ? '' : 's'} left`;
    if (n === 0) return 'Due today';
    return `${-n} day${n === -1 ? '' : 's'} overdue`;
  }

  /* ---------- Text ---------- */
  const esc = s => String(s ?? '').replace(/[&<>"']/g, c =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
  const qs = name => new URLSearchParams(location.search).get(name);
  const plural = (n, word) => `${n} ${word}${n === 1 ? '' : 's'}`;

  /* ---------- Icons (inline SVG, 24×24) ---------- */
  const ICONS = {
    grid: '<rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/>',
    target: '<circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="2"/>',
    map: '<circle cx="5" cy="6" r="2.5"/><circle cx="5" cy="18" r="2.5"/><circle cx="19" cy="12" r="2.5"/><path d="M7.5 6h3a3 3 0 0 1 3 3 3 3 0 0 0 3 3"/><path d="M7.5 18h3a3 3 0 0 0 3-3 3 3 0 0 1 3-3"/>',
    timeline: '<line x1="4" y1="6" x2="13" y2="6"/><line x1="8" y1="12" x2="19" y2="12"/><line x1="11" y1="18" x2="20" y2="18"/><line x1="3" y1="3" x2="3" y2="21"/>',
    layers: '<polygon points="12 2 2 7 12 12 22 7 12 2"/><polyline points="2 17 12 22 22 17"/><polyline points="2 12 12 17 22 12"/>',
    plus: '<line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>',
    edit: '<path d="M12 20h9"/><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4 12.5-12.5z"/>',
    trash: '<polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6M14 11v6"/><path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/>',
    check: '<polyline points="20 6 9 17 4 12"/>',
    clock: '<circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>',
    calendar: '<rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>',
    x: '<line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>',
    menu: '<line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="18" x2="21" y2="18"/>',
    sun: '<circle cx="12" cy="12" r="4.5"/><path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42"/>',
    moon: '<path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/>',
    search: '<circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>',
    link: '<path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/>',
    flag: '<path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z"/><line x1="4" y1="22" x2="4" y2="15"/>',
    lock: '<rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>',
    chevron: '<polyline points="9 18 15 12 9 6"/>',
    arrow: '<line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/>',
    alert: '<path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>',
    info: '<circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/>',
    play: '<polygon points="6 3 20 12 6 21 6 3"/>',
  };
  const icon = name =>
    `<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICONS[name] || ''}</svg>`;

  /* ---------- Status badge and progress bar ---------- */
  const STATUS = {
    'not-started': 'Not Started',
    'in-progress': 'In Progress',
    'completed': 'Completed',
    'delayed': 'Delayed',
  };
  const badge = status => `<span class="badge s-${status}"><span class="dot"></span>${STATUS[status]}</span>`;
  function bar(pct, status = '') {
    return `<div class="progress s-${status}" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${pct}"><span style="width:${pct}%"></span></div>`;
  }

  /* ---------- Toast messages ---------- */
  function toast(message, type = 'success') {
    let stack = document.querySelector('.toast-stack');
    if (!stack) {
      stack = document.createElement('div');
      stack.className = 'toast-stack';
      stack.setAttribute('aria-live', 'polite');
      document.body.appendChild(stack);
    }
    const el = document.createElement('div');
    el.className = `toast toast-${type}`;
    el.innerHTML = `${icon(type === 'error' ? 'alert' : type === 'info' ? 'info' : 'check')}<span>${esc(message)}</span>`;
    stack.appendChild(el);
    setTimeout(() => { el.classList.add('leaving'); setTimeout(() => el.remove(), 300); }, 3500);
  }
  /** Shows a toast on the NEXT page (used after redirects). */
  const flash = (message, type = 'success') => sessionStorage.setItem('goalmap_flash', JSON.stringify({ message, type }));
  function showFlash() {
    const saved = sessionStorage.getItem('goalmap_flash');
    if (!saved) return;
    sessionStorage.removeItem('goalmap_flash');
    const f = JSON.parse(saved);
    toast(f.message, f.type);
  }

  /* ---------- Modal dialog ----------
     onConfirm(dialog) can return false to keep the dialog open (e.g. invalid form). */
  function modal({ title, body, confirmText = 'Save', danger = false, onConfirm, onClose }) {
    const backdrop = document.createElement('div');
    backdrop.className = 'modal-backdrop';
    backdrop.innerHTML = `
      <div class="modal" role="dialog" aria-modal="true" aria-label="${esc(title)}">
        <div class="modal-header">
          <h2>${esc(title)}</h2>
          <button type="button" class="btn btn-ghost btn-icon" data-close aria-label="Close">${icon('x')}</button>
        </div>
        <div class="modal-body">${body}</div>
        <div class="modal-footer">
          <button type="button" class="btn btn-secondary" data-close>Cancel</button>
          <button type="button" class="btn ${danger ? 'btn-danger' : 'btn-primary'}" data-confirm>${esc(confirmText)}</button>
        </div>
      </div>`;
    document.body.appendChild(backdrop);
    const dialog = backdrop.querySelector('.modal');

    function close() {
      backdrop.remove();
      document.removeEventListener('keydown', onKey);
      if (onClose) onClose();
    }
    function confirm() {
      if (onConfirm && onConfirm(dialog) === false) return;
      close();
    }
    function onKey(e) { if (e.key === 'Escape') close(); }

    backdrop.querySelectorAll('[data-close]').forEach(b => b.addEventListener('click', close));
    backdrop.querySelector('[data-confirm]').addEventListener('click', confirm);
    backdrop.addEventListener('mousedown', e => { if (e.target === backdrop) close(); });
    dialog.querySelector('form')?.addEventListener('submit', e => { e.preventDefault(); confirm(); });
    document.addEventListener('keydown', onKey);
    (dialog.querySelector('input, select, textarea') || dialog.querySelector('[data-confirm]')).focus();
  }

  /** Yes/No confirmation → Promise<boolean> */
  function confirm(title, message, confirmText = 'Delete') {
    return new Promise(resolve => {
      let answer = false;
      modal({
        title, confirmText, danger: true,
        body: `<p class="modal-message">${message}</p>`,
        onConfirm: () => { answer = true; },
        onClose: () => resolve(answer),
      });
    });
  }

  /* ---------- Forms ---------- */
  function formValues(form) {
    const values = {};
    new FormData(form).forEach((v, k) => { values[k] = typeof v === 'string' ? v.trim() : v; });
    return values;
  }
  /** errors = { fieldName: "message" }. Returns true when there are no errors. */
  function showErrors(form, errors) {
    form.querySelectorAll('.field').forEach(f => f.classList.remove('invalid'));
    form.querySelectorAll('.field-error').forEach(e => e.remove());
    Object.entries(errors).forEach(([name, message]) => {
      const field = form.querySelector(`[name="${name}"]`)?.closest('.field');
      if (!field) return;
      field.classList.add('invalid');
      field.insertAdjacentHTML('beforeend', `<p class="field-error">${esc(message)}</p>`);
    });
    const first = Object.keys(errors)[0];
    if (first) form.querySelector(`[name="${first}"]`).focus();
    return !first;
  }

  return {
    today, addDays, diff, isValidDate, fmt, fmtShort, daysLeft,
    esc, uid, qs, plural, icon, STATUS, badge, bar,
    toast, flash, showFlash, modal, confirm, formValues, showErrors,
  };
})();
