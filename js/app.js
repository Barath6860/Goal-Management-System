/* ==========================================================================
   GoalMap · app.js
   Page layout (sidebar + header with the dark/light button), shared UI
   helpers, the Dashboard page, and start-up.
   Script order: utils → storage → dependencies → timeline → goals → app
   ========================================================================== */
'use strict';

const App = {
  NAV: [
    { page: 'dashboard', href: 'index.html', label: 'Dashboard', icon: 'grid' },
    { page: 'goals', href: 'goals.html', label: 'My Goals', icon: 'target' },
    { page: 'map', href: 'goal-map.html', label: 'Goal Map', icon: 'map' },
    { page: 'timeline', href: 'timeline.html', label: 'Timeline', icon: 'timeline' },
  ],

  /** Builds the sidebar and header (same on every page). */
  renderShell(page) {
    const current = page === 'details' ? 'goals' : page;
    document.getElementById('sidebar').innerHTML = `
      <a class="brand" href="index.html"><img src="assets/icons/logo.svg" alt="" width="34" height="34"><span>GoalMap</span></a>
      <nav aria-label="Main navigation"><ul class="nav">
        ${App.NAV.map(n => `<li><a class="nav-link ${n.page === current ? 'active' : ''}" href="${n.href}" ${n.page === current ? 'aria-current="page"' : ''}>${U.icon(n.icon)}${n.label}</a></li>`).join('')}
      </ul></nav>`;

    const title = page === 'details' ? 'Goal Details' : App.NAV.find(n => n.page === page).label;
    document.getElementById('topbar').innerHTML = `
      <button type="button" class="btn btn-ghost btn-icon menu-btn" aria-label="Open menu">${U.icon('menu')}</button>
      <strong class="topbar-title">${title}</strong>
      <div class="topbar-actions">
        <button type="button" class="btn btn-ghost btn-icon" id="theme-btn"></button>
        <a class="btn btn-primary" href="goals.html?view=create">${U.icon('plus')}<span class="hide-sm">New Goal</span></a>
      </div>`;

    // Dark / light mode button
    const themeBtn = document.getElementById('theme-btn');
    const showThemeIcon = () => {
      const dark = Store.getTheme() === 'dark';
      themeBtn.innerHTML = U.icon(dark ? 'sun' : 'moon');
      themeBtn.setAttribute('aria-label', dark ? 'Switch to light mode' : 'Switch to dark mode');
      themeBtn.title = themeBtn.getAttribute('aria-label');
    };
    themeBtn.addEventListener('click', () => {
      const next = Store.getTheme() === 'dark' ? 'light' : 'dark';
      Store.setTheme(next);
      document.documentElement.dataset.theme = next;
      showThemeIcon();
    });
    showThemeIcon();

    // Mobile menu
    const scrim = document.createElement('div');
    scrim.className = 'scrim';
    document.body.appendChild(scrim);
    document.querySelector('.menu-btn').addEventListener('click', () => document.body.classList.add('menu-open'));
    scrim.addEventListener('click', () => document.body.classList.remove('menu-open'));
  },

  /** Goal shown on the Map / Timeline pages: ?id=… or the first goal. */
  currentGoal() {
    return Store.get(U.qs('id')) || Store.all()[0] || null;
  },

  /** Drop-down to switch goal on the Map / Timeline pages. */
  goalSelect(selectedId) {
    return `<label class="goal-select"><span class="sr-only">Choose goal</span>
      <select id="goal-select">${Store.all().map(g =>
        `<option value="${g.id}" ${g.id === selectedId ? 'selected' : ''}>${U.esc(g.name)}</option>`).join('')}</select></label>`;
  },
  bindGoalSelect(root, onChange) {
    const select = root.querySelector('#goal-select');
    select.addEventListener('change', () => {
      history.replaceState(null, '', `?id=${select.value}`);
      onChange(select.value);
    });
  },

  emptyState(iconName, title, text, action = '') {
    return `<div class="empty-state"><div class="empty-icon">${U.icon(iconName)}</div>
      <h3>${title}</h3><p>${text}</p>${action}</div>`;
  },
  noGoals() {
    return `<div class="card">${App.emptyState('target', 'No goals yet', 'Create a goal to get started.',
      `<a class="btn btn-primary" href="goals.html?view=create">${U.icon('plus')}Create a goal</a>`)}</div>`;
  },
};

/* ==========================================================================
   Dashboard page
   ========================================================================== */
Pages.dashboard = function (root) {
  const goals = Store.all();
  const allMilestones = goals.flatMap(g => g.milestones.map(m => ({ m, goal: g })));
  const completedGoals = goals.filter(g => Goals.status(g) === 'completed').length;
  const completedMilestones = allMilestones.filter(x => x.m.status === 'completed').length;
  const overall = goals.length ? Math.round(goals.reduce((sum, g) => sum + Goals.progress(g), 0) / goals.length) : 0;

  // Next unfinished milestones, ordered by end date.
  const upcoming = allMilestones
    .filter(x => x.m.status !== 'completed')
    .sort((a, b) => a.m.endDate.localeCompare(b.m.endDate))
    .slice(0, 6);

  const stat = (label, value, iconName) => `
    <div class="stat-card"><span class="stat-icon">${U.icon(iconName)}</span>
      <div><span class="stat-label">${label}</span><strong class="stat-value">${value}</strong></div></div>`;

  root.innerHTML = `
    <div class="page-header">
      <div><h1>Dashboard</h1><p class="subtitle">${U.fmt(U.today())} · An overview of your goals and milestones.</p></div>
    </div>

    <div class="stats-grid">
      ${stat('Total goals', goals.length, 'target')}
      ${stat('Completed goals', completedGoals, 'flag')}
      ${stat('Milestones completed', `${completedMilestones} / ${allMilestones.length}`, 'layers')}
      ${stat('Overall progress', `${overall}%`, 'check')}
    </div>

    <section>
      <div class="section-head"><h2>Your goals</h2><a href="goals.html">View all ${U.icon('chevron')}</a></div>
      ${goals.length ? `<div class="goal-grid">${goals.slice(0, 6).map(Goals.card).join('')}</div>` : App.noGoals()}
    </section>

    <section class="card">
      <div class="card-header"><div><h2>Upcoming milestones</h2><p class="muted small">Unfinished milestones, by end date.</p></div></div>
      ${upcoming.length ? `<ul class="upcoming">${upcoming.map(({ m, goal }) => `
        <li>
          <span class="up-date s-${m.status}"><strong>${U.fmtShort(m.endDate).split(' ')[0]}</strong>${U.fmtShort(m.endDate).split(' ')[1]}</span>
          <div class="up-main"><a href="goal-details.html?id=${goal.id}">${U.esc(m.name)}</a><span class="muted small">${U.esc(goal.name)}</span></div>
          ${U.badge(m.status)}
        </li>`).join('')}</ul>`
        : App.emptyState('check', 'Nothing upcoming', 'All milestones are completed.')}
    </section>`;
};

/* ==========================================================================
   Start-up: build the layout, then draw the current page.
   ========================================================================== */
document.addEventListener('DOMContentLoaded', () => {
  const page = document.body.dataset.page;

  // "intro" turns on the slow entrance animations for the first load only.
  document.body.classList.add('intro');
  setTimeout(() => document.body.classList.remove('intro'), 2600);

  // Fix any saved milestone that was started before its dependencies were completed.
  if (Store.all().some(g => Goals.enforceLocks(g).length)) Store.save();

  App.renderShell(page);
  Pages[page](document.getElementById('page'));
  document.querySelectorAll('.stat-value').forEach(el => U.countUp(el));
  U.showFlash();
});

// Card spotlight: tell the CSS where the mouse is inside the card.
document.addEventListener('mousemove', e => {
  const card = e.target.closest('.stat-card, .goal-card');
  if (!card) return;
  const box = card.getBoundingClientRect();
  card.style.setProperty('--mx', `${e.clientX - box.left}px`);
  card.style.setProperty('--my', `${e.clientY - box.top}px`);
});
