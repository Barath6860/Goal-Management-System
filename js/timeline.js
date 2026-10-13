/* ==========================================================================
   GoalMap · timeline.js
   Timeline page: the goal's milestones in date order, from the goal's
   start date to its target date, with a "Today" marker in between.
   ========================================================================== */
'use strict';

const Timeline = {
  /** The goal's milestones in chronological order (by start date, then end date). */
  sorted(goal) {
    return [...goal.milestones].sort((a, b) =>
      a.startDate.localeCompare(b.startDate) || a.endDate.localeCompare(b.endDate));
  },
};

Pages.timeline = function (root) {
  let goal = App.currentGoal();

  function render() {
    if (!goal) { root.innerHTML = App.noGoals(); return; }

    const milestones = Timeline.sorted(goal);
    const today = U.today();
    const totalDays = U.diff(goal.startDate, goal.targetDate) + 1;

    // Build the list items and insert a "Today" marker at the right place.
    let items = '';
    let todayShown = today < goal.startDate;
    milestones.forEach(m => {
      if (!todayShown && m.startDate > today) { items += todayItem(today); todayShown = true; }
      items += milestoneItem(m, today);
    });
    if (!todayShown && today <= goal.targetDate) items += todayItem(today);

    root.innerHTML = `
      <div class="page-header">
        <div>
          <h1>Timeline</h1>
          <p class="subtitle">Milestones in chronological order, from the goal start date to the target date.</p>
        </div>
        <div class="page-actions">
          ${App.goalSelect(goal.id)}
          <a class="btn btn-secondary" href="goal-map.html?id=${goal.id}">${U.icon('map')}View Goal Map</a>
        </div>
      </div>

      <div class="mini-stats">
        <div class="mini-stat"><span>Start date</span><strong>${U.fmt(goal.startDate)}</strong></div>
        <div class="mini-stat"><span>Target date</span><strong>${U.fmt(goal.targetDate)}</strong></div>
        <div class="mini-stat"><span>Duration</span><strong>${U.plural(totalDays, 'day')}</strong></div>
        <div class="mini-stat"><span>Time remaining</span><strong>${U.daysLeft(goal.targetDate)}</strong></div>
      </div>

      <section class="card">
        ${milestones.length ? `
        <ol class="timeline">
          <li class="tl-item tl-end">
            <span class="tl-dot">${U.icon('play')}</span>
            <div class="tl-card"><span class="tl-label">START</span><strong>${U.esc(goal.name)}</strong><span class="muted">${U.fmt(goal.startDate)}</span></div>
          </li>
          ${items}
          <li class="tl-item tl-end">
            <span class="tl-dot">${U.icon('flag')}</span>
            <div class="tl-card"><span class="tl-label">TARGET DATE</span><strong>${U.fmt(goal.targetDate)}</strong>
              <span class="muted">${Goals.progress(goal)}% of the goal completed</span></div>
          </li>
        </ol>`
        : App.emptyState('timeline', 'No milestones yet', 'Add milestones with dates to see the timeline.',
            `<a class="btn btn-primary" href="goal-details.html?id=${goal.id}">${U.icon('plus')}Add milestones</a>`)}
      </section>`;

    App.bindGoalSelect(root, id => { goal = Store.get(id); render(); });
  }

  function todayItem(today) {
    return `<li class="tl-today"><span>Today · ${U.fmt(today)}</span></li>`;
  }

  function milestoneItem(m, today) {
    const days = U.diff(m.startDate, m.endDate) + 1;
    const overdue = m.status !== 'completed' && m.endDate < today;
    const deps = Deps.prerequisites(goal, m);
    return `<li class="tl-item s-${m.status}">
      <span class="tl-dot"></span>
      <div class="tl-card">
        <div class="row-between wrap">
          <strong class="tl-name">${U.esc(m.name)}</strong>
          <span class="row">${overdue ? '<span class="chip chip-red">Past end date</span>' : ''}${Goals.isLocked(goal, m) ? `<span class="badge badge-locked">${U.icon('lock')}Locked</span>` : U.badge(m.status)}</span>
        </div>
        <p class="tl-dates">${U.icon('calendar')}${U.fmt(m.startDate)} → ${U.fmt(m.endDate)} <span class="muted">· ${U.plural(days, 'day')}</span></p>
        ${deps.length ? `<p class="tl-deps">${U.icon('link')}Depends on: ${deps.map(d => U.esc(d.name)).join(', ')}</p>` : ''}
        <div class="tl-progress">${U.bar(m.progress, m.status)}<strong>${m.progress}%</strong></div>
      </div>
    </li>`;
  }

  render();
};
