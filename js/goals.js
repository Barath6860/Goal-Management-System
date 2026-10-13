/* ==========================================================================
   GoalMap · goals.js
   Goal & milestone logic, plus the "My Goals" and "Goal Details" pages.
   ========================================================================== */
'use strict';

const Goals = {
  CATEGORIES: ['Career', 'Education', 'Personal', 'Financial', 'Project', 'Other'],
  STATUSES: ['not-started', 'in-progress', 'completed', 'delayed'],

  /** Overall goal progress = average progress of its milestones. */
  progress(goal) {
    if (!goal.milestones.length) return 0;
    const total = goal.milestones.reduce((sum, m) => sum + m.progress, 0);
    return Math.round(total / goal.milestones.length);
  },

  /** Goal status shown on cards, worked out from its progress. */
  status(goal) {
    const p = Goals.progress(goal);
    if (goal.milestones.length && p === 100) return 'completed';
    return p === 0 ? 'not-started' : 'in-progress';
  },

  completedCount(goal) {
    return goal.milestones.filter(m => m.status === 'completed').length;
  },

  /* ---------------------- Goals: create / update / delete ---------------------- */
  create(data) {
    const goal = { id: U.uid(), ...data, createdAt: Date.now(), milestones: [] };
    Store.add(goal);
    return goal;
  },
  update(goal, data) {
    Object.assign(goal, data);
    Store.save();
  },
  remove(goal) {
    Store.remove(goal.id);
  },

  /* ------------------- Milestones: add / update / delete ------------------- */
  /** Keeps status and progress consistent with each other. */
  syncStatus(m, changed) {
    if (changed === 'status') {
      if (m.status === 'completed') m.progress = 100;
      else if (m.status === 'not-started') m.progress = 0;
      else if (m.progress === 100) m.progress = 90;
    } else {
      if (m.progress === 100) m.status = 'completed';
      else if (m.status === 'completed') m.status = 'in-progress';
      else if (m.progress > 0 && m.status === 'not-started') m.status = 'in-progress';
    }
  },
  /* ------------------------- Dependency lock rule -------------------------
     A milestone is LOCKED while any milestone it depends on is not completed.
     A locked milestone must stay "Not Started" at 0%.                        */
  isLocked(goal, m) {
    return Deps.prerequisites(goal, m).some(p => p.status !== 'completed');
  },

  /** Resets every locked milestone that was started (repeats so chains A → B → C are handled).
      Returns the names of the milestones that were reset. */
  enforceLocks(goal) {
    const reset = [];
    let changed = true;
    while (changed) {
      changed = false;
      goal.milestones.forEach(m => {
        if (Goals.isLocked(goal, m) && (m.status !== 'not-started' || m.progress > 0)) {
          m.status = 'not-started';
          m.progress = 0;
          reset.push(m.name);
          changed = true;
        }
      });
    }
    return reset;
  },

  /** Which milestones WOULD be locked again if we made this change? (tries it on a copy) */
  previewReset(goal, m, changes, changed = 'status') {
    const copy = JSON.parse(JSON.stringify(goal));
    const target = copy.milestones.find(x => x.id === m.id);
    Object.assign(target, changes);
    Goals.syncStatus(target, changed);
    return Goals.enforceLocks(copy).filter(name => name !== target.name);
  },

  addMilestone(goal, data) {
    const m = { id: U.uid(), ...data };
    Goals.syncStatus(m, 'status');
    goal.milestones.push(m);
    Goals.enforceLocks(goal);
    Store.save();
  },

  /** Updates a milestone. Returns { unlocked: [names], reset: [names] } so the page can tell the user. */
  updateMilestone(goal, m, changes, changed = 'status') {
    const lockedBefore = goal.milestones.filter(x => Goals.isLocked(goal, x));
    Object.assign(m, changes);
    Goals.syncStatus(m, changed);
    const reset = Goals.enforceLocks(goal);
    Store.save();
    const unlocked = lockedBefore.filter(x => !Goals.isLocked(goal, x)).map(x => x.name);
    return { unlocked, reset };
  },

  /** Shows messages after a milestone update. */
  announce(result) {
    result.unlocked.forEach(name => U.toast(`“${name}” is now unlocked — you can start it.`, 'info'));
    if (result.reset.length) U.toast(`Locked again: ${result.reset.join(', ')}`, 'info');
  },
  removeMilestone(goal, m) {
    goal.milestones = goal.milestones.filter(x => x.id !== m.id);
    // Remove the deleted milestone from other milestones' dependency lists.
    goal.milestones.forEach(x => { x.dependencies = x.dependencies.filter(id => id !== m.id); });
    Store.save();
  },

  /* ------------------------------- Shared UI ------------------------------- */
  card(goal) {
    const pct = Goals.progress(goal);
    const status = Goals.status(goal);
    return `<article class="goal-card s-${status}">
      <div class="row-between">
        <span class="chip">${U.esc(goal.category)}</span>
        ${U.badge(status)}
      </div>
      <h3><a class="card-link" href="goal-details.html?id=${goal.id}">${U.esc(goal.name)}</a></h3>
      <p class="goal-desc">${U.esc(goal.description || 'No description')}</p>
      <div class="row-between small"><span class="muted">Progress</span><strong>${pct}%</strong></div>
      ${U.bar(pct, status)}
      <div class="goal-meta">
        <span>${U.icon('layers')}${Goals.completedCount(goal)} / ${goal.milestones.length} milestones</span>
        <span>${U.icon('clock')}${status === 'completed' ? 'Completed' : U.daysLeft(goal.targetDate)}</span>
      </div>
    </article>`;
  },

  /** Add / edit milestone dialog. Pass m = null to add a new milestone. */
  milestoneModal(goal, m, onSaved) {
    const lastEnd = goal.milestones.map(x => x.endDate).sort().pop();
    const start = lastEnd && lastEnd < goal.targetDate ? U.addDays(lastEnd, 1) : goal.startDate;
    const v = m || { name: '', description: '', startDate: start, endDate: U.addDays(start, 6), status: 'not-started', progress: 0, dependencies: [] };

    // Dependency checkboxes. Options that would create a loop are disabled.
    const others = goal.milestones.filter(x => !m || x.id !== m.id);
    const depOptions = others.length
      ? `<div class="check-list">${others.map(x => {
          const loop = m && Deps.createsLoop(goal, m, x);
          return `<label class="check ${loop ? 'disabled' : ''}">
            <input type="checkbox" name="deps" value="${x.id}" ${v.dependencies.includes(x.id) ? 'checked' : ''} ${loop ? 'disabled' : ''}>
            <span>${U.esc(x.name)}${loop ? '<small>Would create a loop</small>' : ''}</span></label>`;
        }).join('')}</div>`
      : '<p class="muted small">Add more milestones to create dependencies.</p>';

    U.modal({
      title: m ? 'Edit milestone' : 'Add milestone',
      confirmText: m ? 'Save changes' : 'Add milestone',
      body: `
        <form class="form-grid" novalidate>
          <div class="field span-2"><label for="m-name">Milestone name *</label>
            <input id="m-name" name="name" maxlength="60" value="${U.esc(v.name)}" placeholder="e.g. Learn Data Structures"></div>
          <div class="field span-2"><label for="m-desc">Description</label>
            <textarea id="m-desc" name="description" rows="2" maxlength="200">${U.esc(v.description)}</textarea></div>
          <div class="field"><label for="m-start">Start date *</label><input id="m-start" type="date" name="startDate" value="${v.startDate}"></div>
          <div class="field"><label for="m-end">End date *</label><input id="m-end" type="date" name="endDate" value="${v.endDate}"></div>
          <div class="field"><label for="m-status">Status</label>
            <select id="m-status" name="status">${Goals.STATUSES.map(s => `<option value="${s}" ${v.status === s ? 'selected' : ''}>${U.STATUS[s]}</option>`).join('')}</select></div>
          <div class="field"><label for="m-progress">Progress (%)</label>
            <input id="m-progress" type="number" name="progress" min="0" max="100" value="${v.progress}"></div>
          <div class="field span-2"><span class="label">Depends on</span>${depOptions}</div>
          <p class="note note-warning span-2" id="lock-note" hidden></p>
        </form>`,

      // Live lock check: if a chosen dependency is unfinished, this milestone cannot be started.
      onOpen: dialog => {
        const form = dialog.querySelector('form');
        const note = form.querySelector('#lock-note');
        function refreshLock() {
          const chosen = [...form.querySelectorAll('input[name=deps]:checked')].map(c => c.value);
          const blockers = goal.milestones.filter(x => chosen.includes(x.id) && x.status !== 'completed');
          const locked = blockers.length > 0;
          form.elements.status.disabled = locked;
          form.elements.progress.disabled = locked;
          if (locked) {
            form.elements.status.value = 'not-started';
            form.elements.progress.value = 0;
            note.innerHTML = `${U.icon('lock')}Locked until ${blockers.map(b => `“${U.esc(b.name)}”`).join(', ')} ${blockers.length === 1 ? 'is' : 'are'} completed.`;
          } else if (m) {
            // Would this change lock other milestones again?
            const reset = Goals.previewReset(goal, m, { status: form.elements.status.value, progress: Number(form.elements.progress.value) || 0, dependencies: chosen });
            note.innerHTML = reset.length ? `${U.icon('lock')}Saving will lock again and reset: ${reset.map(U.esc).join(', ')}.` : '';
          } else {
            note.innerHTML = '';
          }
          note.hidden = !note.innerHTML;
        }
        form.addEventListener('change', refreshLock);
        form.elements.progress.addEventListener('input', refreshLock);
        refreshLock();
      },

      onConfirm: dialog => {
        const form = dialog.querySelector('form');
        const f = U.formValues(form);
        // Disabled (locked) fields are not included in the form values, so read them directly.
        f.status = form.elements.status.value;
        f.progress = form.elements.progress.value;
        const progress = Number(f.progress);
        const errors = {};
        if (!f.name) errors.name = 'Please enter a milestone name.';
        else if (goal.milestones.some(x => x !== m && x.name.toLowerCase() === f.name.toLowerCase())) errors.name = 'This goal already has a milestone with this name.';
        if (!U.isValidDate(f.startDate)) errors.startDate = 'Please choose a start date.';
        if (!U.isValidDate(f.endDate)) errors.endDate = 'Please choose an end date.';
        else if (f.endDate < f.startDate) errors.endDate = 'End date must be on or after the start date.';
        if (!Number.isInteger(progress) || progress < 0 || progress > 100) errors.progress = 'Enter a whole number from 0 to 100.';
        if (!U.showErrors(form, errors)) return false;

        const data = {
          name: f.name, description: f.description, startDate: f.startDate, endDate: f.endDate,
          status: f.status, progress,
          dependencies: [...form.querySelectorAll('input[name=deps]:checked')].map(c => c.value),
        };
        // If only the progress was changed, let progress decide the status.
        const changed = m && data.status === m.status && progress !== m.progress ? 'progress' : 'status';
        if (m) Goals.announce(Goals.updateMilestone(goal, m, data, changed));
        else Goals.addMilestone(goal, data);
        U.toast(m ? 'Milestone updated.' : 'Milestone added.');
        onSaved();
      },
    });
  },
};

/* ==========================================================================
   My Goals page — goal list with search, and the create / edit goal form
   ========================================================================== */
Pages.goals = function (root) {
  if (U.qs('view') === 'create' || U.qs('edit')) { goalForm(root, Store.get(U.qs('edit'))); return; }

  root.innerHTML = `
    <div class="page-header">
      <div><h1>My Goals</h1><p class="subtitle">Your long-term goals and how far each one has progressed.</p></div>
      <div class="page-actions"><a class="btn btn-primary" href="goals.html?view=create">${U.icon('plus')}New Goal</a></div>
    </div>
    <label class="search-box card">${U.icon('search')}<span class="sr-only">Search goals</span>
      <input type="search" id="search" placeholder="Search by goal name, category or milestone…" autocomplete="off"></label>
    <div id="results"></div>`;

  const input = root.querySelector('#search');
  const results = root.querySelector('#results');

  function showResults() {
    const q = input.value.trim().toLowerCase();
    const list = Store.all().filter(g =>
      `${g.name} ${g.description} ${g.category} ${g.milestones.map(m => m.name).join(' ')}`.toLowerCase().includes(q));

    if (!Store.all().length) {
      results.innerHTML = `<div class="card">${App.emptyState('target', 'No goals yet', 'Create your first goal, then break it into milestones.',
        `<a class="btn btn-primary" href="goals.html?view=create">${U.icon('plus')}Create a goal</a>`)}</div>`;
    } else if (!list.length) {
      results.innerHTML = `<div class="card">${App.emptyState('search', 'No matching goals', 'Try a different search word.')}</div>`;
    } else {
      results.innerHTML = `<p class="muted small result-count">${U.plural(list.length, 'goal')}</p>
        <div class="goal-grid">${list.map(Goals.card).join('')}</div>`;
    }
  }
  input.addEventListener('input', showResults);
  showResults();
};

/** Create / edit goal form. `editing` is the goal being edited, or null for a new goal. */
function goalForm(root, editing) {
  const today = U.today();
  const v = editing || { name: '', description: '', category: 'Career', startDate: today, targetDate: U.addDays(today, 90) };

  root.innerHTML = `
    <nav class="breadcrumb"><a href="goals.html">My Goals</a>${U.icon('chevron')}<span>${editing ? 'Edit goal' : 'New goal'}</span></nav>
    <div class="page-header"><div>
      <h1>${editing ? 'Edit Goal' : 'Create a New Goal'}</h1>
      <p class="subtitle">${editing ? 'Update the goal details. Milestones are not changed.' : 'Define the goal first — next you will break it into milestones.'}</p>
    </div></div>
    <form class="card goal-form form-grid" novalidate>
      <div class="field span-2"><label for="g-name">Goal name *</label>
        <input id="g-name" name="name" maxlength="70" value="${U.esc(v.name)}" placeholder="e.g. Get a Software Developer Internship"></div>
      <div class="field span-2"><label for="g-desc">Description</label>
        <textarea id="g-desc" name="description" rows="3" maxlength="300" placeholder="What does success look like?">${U.esc(v.description)}</textarea></div>
      <div class="field"><label for="g-cat">Category *</label>
        <select id="g-cat" name="category">${Goals.CATEGORIES.map(c => `<option ${v.category === c ? 'selected' : ''}>${c}</option>`).join('')}</select></div>
      <div class="field"></div>
      <div class="field"><label for="g-start">Start date *</label><input id="g-start" type="date" name="startDate" value="${v.startDate}"></div>
      <div class="field"><label for="g-target">Target date *</label><input id="g-target" type="date" name="targetDate" value="${v.targetDate}"></div>
      <div class="form-actions span-2">
        <a class="btn btn-secondary" href="${editing ? `goal-details.html?id=${editing.id}` : 'goals.html'}">Cancel</a>
        <button type="submit" class="btn btn-primary">${editing ? 'Save changes' : 'Create goal'}</button>
      </div>
    </form>`;

  const form = root.querySelector('form');
  form.addEventListener('submit', e => {
    e.preventDefault();
    const f = U.formValues(form);
    const errors = {};
    if (f.name.length < 3) errors.name = 'Goal name must be at least 3 characters.';
    if (!U.isValidDate(f.startDate)) errors.startDate = 'Please choose a start date.';
    if (!U.isValidDate(f.targetDate)) errors.targetDate = 'Please choose a target date.';
    else if (f.targetDate <= f.startDate) errors.targetDate = 'Target date must be after the start date.';
    if (!U.showErrors(form, errors)) return;

    const data = { name: f.name, description: f.description, category: f.category, startDate: f.startDate, targetDate: f.targetDate };
    if (editing) {
      Goals.update(editing, data);
      U.flash('Goal updated.');
      location.href = `goal-details.html?id=${editing.id}`;
    } else {
      const goal = Goals.create(data);
      U.flash('Goal created. Now add its milestones.');
      location.href = `goal-details.html?id=${goal.id}`;
    }
  });
}

/* ==========================================================================
   Goal Details page — goal summary and its milestones
   ========================================================================== */
Pages.details = function (root) {
  const goal = Store.get(U.qs('id'));
  if (!goal) {
    root.innerHTML = `<div class="card">${App.emptyState('target', 'Goal not found', 'This goal may have been deleted.',
      '<a class="btn btn-primary" href="goals.html">Back to My Goals</a>')}</div>`;
    return;
  }

  function render() {
    const pct = Goals.progress(goal);
    const status = Goals.status(goal);
    document.title = `${goal.name} · GoalMap`;

    root.innerHTML = `
      <nav class="breadcrumb"><a href="goals.html">My Goals</a>${U.icon('chevron')}<span>${U.esc(goal.name)}</span></nav>

      <section class="card goal-hero s-${status}">
        <div class="goal-hero-main">
          <div class="row"><span class="chip">${U.esc(goal.category)}</span>${U.badge(status)}</div>
          <h1>${U.esc(goal.name)}</h1>
          <p class="muted">${U.esc(goal.description || 'No description.')}</p>
          <p class="small">${U.icon('calendar')} ${U.fmt(goal.startDate)} → ${U.fmt(goal.targetDate)}</p>
        </div>
        <div class="row">
          <a class="btn btn-secondary" href="goals.html?edit=${goal.id}">${U.icon('edit')}Edit</a>
          <button type="button" class="btn btn-secondary btn-danger-text" id="delete-goal">${U.icon('trash')}Delete</button>
        </div>
        <div class="hero-progress">
          <div class="row-between"><span class="muted small">Overall progress</span><strong>${pct}%</strong></div>
          ${U.bar(pct, status)}
        </div>
      </section>

      <div class="mini-stats">
        <div class="mini-stat"><span>Milestones completed</span><strong>${Goals.completedCount(goal)} / ${goal.milestones.length}</strong></div>
        <div class="mini-stat"><span>Time remaining</span><strong>${U.daysLeft(goal.targetDate)}</strong></div>
        <a class="mini-stat link-stat" href="goal-map.html?id=${goal.id}"><span>${U.icon('map')}Goal Map</span><strong>View dependencies →</strong></a>
        <a class="mini-stat link-stat" href="timeline.html?id=${goal.id}"><span>${U.icon('timeline')}Timeline</span><strong>View in date order →</strong></a>
      </div>

      <section class="card">
        <div class="card-header">
          <div><h2>Milestones</h2><p class="muted small">Break the goal into steps, link dependencies and update progress.</p></div>
          <button type="button" class="btn btn-primary" data-add>${U.icon('plus')}Add milestone</button>
        </div>
        ${goal.milestones.length
          ? `<ol class="ms-list">${goal.milestones.map(milestoneRow).join('')}</ol>`
          : App.emptyState('layers', 'No milestones yet', 'Add the steps that lead to this goal, e.g. “Learn Java”, “Build a project”.')}
      </section>`;

    bind();
  }

  function milestoneRow(m, i) {
    const waiting = Deps.waitingFor(goal, m);
    const deps = Deps.prerequisites(goal, m);
    const locked = Goals.isLocked(goal, m);
    const lockText = locked ? `title="Locked: complete ${U.esc(waiting.map(d => d.name).join(', '))} first" disabled` : '';
    return `<li class="ms-item s-${m.status} ${locked ? 'locked' : ''}" data-id="${m.id}">
      <span class="ms-number">${locked ? U.icon('lock') : i + 1}</span>
      <div class="ms-main">
        <div class="row wrap"><h3>${U.esc(m.name)}</h3>${locked ? `<span class="badge badge-locked">${U.icon('lock')}Locked</span>` : U.badge(m.status)}</div>
        ${m.description ? `<p class="muted small">${U.esc(m.description)}</p>` : ''}
        <p class="ms-meta">${U.icon('calendar')}${U.fmt(m.startDate)} → ${U.fmt(m.endDate)}</p>
        ${deps.length ? `<p class="ms-meta">${U.icon('link')}Depends on: ${deps.map(d => U.esc(d.name)).join(', ')}</p>` : ''}
        ${locked ? `<p class="ms-meta text-warning">${U.icon('lock')}Unlocks when ${waiting.map(d => `“${U.esc(d.name)}”`).join(', ')} ${waiting.length === 1 ? 'is' : 'are'} completed</p>` : ''}
      </div>
      <div class="ms-controls">
        <select aria-label="Status of ${U.esc(m.name)}" data-status ${lockText}>
          ${Goals.STATUSES.map(s => `<option value="${s}" ${m.status === s ? 'selected' : ''}>${U.STATUS[s]}</option>`).join('')}
        </select>
        <div class="row"><input type="range" min="0" max="100" step="5" value="${m.progress}" aria-label="Progress of ${U.esc(m.name)}" data-progress ${lockText}><output>${m.progress}%</output></div>
      </div>
      <div class="ms-actions">
        <button type="button" class="btn btn-ghost btn-icon" data-edit aria-label="Edit ${U.esc(m.name)}">${U.icon('edit')}</button>
        <button type="button" class="btn btn-ghost btn-icon" data-delete aria-label="Delete ${U.esc(m.name)}">${U.icon('trash')}</button>
      </div>
    </li>`;
  }

  function bind() {
    root.querySelector('[data-add]').addEventListener('click', () => Goals.milestoneModal(goal, null, render));

    root.querySelector('#delete-goal').addEventListener('click', async () => {
      if (!await U.confirm('Delete goal?', `“${U.esc(goal.name)}” and all of its milestones will be deleted.`, 'Delete goal')) return;
      Goals.remove(goal);
      U.flash('Goal deleted.', 'info');
      location.href = 'goals.html';
    });

    root.querySelectorAll('.ms-item').forEach(row => {
      const m = goal.milestones.find(x => x.id === row.dataset.id);

      /* Applies a status/progress change. If it would lock other milestones again
         (e.g. un-completing a dependency), ask first. */
      async function change(changes, changed) {
        const reset = Goals.previewReset(goal, m, changes, changed);
        if (reset.length && !await U.confirm('Lock dependent milestones?',
          `${reset.map(n => `<strong>${U.esc(n)}</strong>`).join(', ')} depend on “${U.esc(m.name)}”. They will be locked again and reset to Not Started (0%).`, 'Continue')) {
          render();
          return;
        }
        const result = Goals.updateMilestone(goal, m, changes, changed);
        U.toast(changed === 'status' ? `“${m.name}” is now ${U.STATUS[m.status]}.` : `Progress of “${m.name}” set to ${m.progress}%.`);
        Goals.announce(result);
        render();
      }

      row.querySelector('[data-status]').addEventListener('change', e => change({ status: e.target.value }, 'status'));

      const slider = row.querySelector('[data-progress]');
      slider.addEventListener('input', () => { slider.nextElementSibling.textContent = `${slider.value}%`; });
      slider.addEventListener('change', () => change({ progress: Number(slider.value) }, 'progress'));

      row.querySelector('[data-edit]').addEventListener('click', () => Goals.milestoneModal(goal, m, render));
      row.querySelector('[data-delete]').addEventListener('click', async () => {
        if (!await U.confirm('Delete milestone?', `“${U.esc(m.name)}” will be removed from this goal.`, 'Delete milestone')) return;
        Goals.removeMilestone(goal, m);
        U.toast('Milestone deleted.', 'info');
        render();
      });
    });
  }

  render();
};
