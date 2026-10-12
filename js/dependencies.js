/* ==========================================================================
   GoalMap · dependencies.js
   Simple dependency helpers + the Goal Map page.

   A milestone lists the ids of the milestones it depends on:
     { name: "Learn CSS", dependencies: ["<id of Learn HTML>"] }
   meaning "Learn CSS" should start after "Learn HTML" is completed.
   ========================================================================== */
'use strict';

const Deps = {
  /** Milestones that `m` depends on. */
  prerequisites(goal, m) {
    return goal.milestones.filter(x => m.dependencies.includes(x.id));
  },

  /** Milestones that depend on `m`. */
  dependents(goal, m) {
    return goal.milestones.filter(x => x.dependencies.includes(m.id));
  },

  /** Unfinished prerequisites — while there are any, `m` is waiting. */
  waitingFor(goal, m) {
    if (m.status === 'completed') return [];
    return Deps.prerequisites(goal, m).filter(p => p.status !== 'completed');
  },

  /**
   * Would "m depends on candidate" create a loop (A → B → A)?
   * It would if candidate already depends on m, directly or indirectly.
   */
  createsLoop(goal, m, candidate) {
    if (candidate.id === m.id) return true;
    return Deps.prerequisites(goal, candidate).some(p => Deps.createsLoop(goal, m, p));
  },

  /** Map column: 0 with no dependencies, otherwise 1 + the column of its deepest prerequisite. */
  column(goal, m) {
    const prereqs = Deps.prerequisites(goal, m);
    if (!prereqs.length) return 0;
    return 1 + Math.max(...prereqs.map(p => Deps.column(goal, p)));
  },
};

/* ==========================================================================
   Goal Map page — boxes (milestones) and arrows (dependencies)
   ========================================================================== */
Pages.map = function (root) {
  const BOX_W = 200, BOX_H = 86, GAP_X = 80, GAP_Y = 24, PAD = 24;
  let goal = App.currentGoal();
  let selectedId = null;

  function render() {
    if (!goal) { root.innerHTML = App.noGoals(); return; }

    root.innerHTML = `
      <div class="page-header">
        <div>
          <h1>Goal Map</h1>
          <p class="subtitle">Each box is a milestone. An arrow from A to B means B depends on A. Click a box to see its connections.</p>
        </div>
        <div class="page-actions">
          ${App.goalSelect(goal.id)}
          <a class="btn btn-secondary" href="goal-details.html?id=${goal.id}">${U.icon('layers')}Edit milestones</a>
        </div>
      </div>
      ${goal.milestones.length ? `
      <div class="map-layout">
        <section class="card map-card">
          <ul class="legend">
            ${Object.keys(U.STATUS).map(s => `<li class="s-${s}"><span class="dot"></span>${U.STATUS[s]}</li>`).join('')}
            <li>${U.icon('lock')}Waiting for a dependency</li>
            <li class="map-hint">Scroll sideways to see the whole map →</li>
          </ul>
          <div class="map-scroll"><div class="map-canvas"></div></div>
        </section>
        <aside class="card map-panel" aria-live="polite"></aside>
      </div>`
      : `<div class="card">${App.emptyState('map', 'No milestones yet', 'Add milestones and dependencies to build the map.',
          `<a class="btn btn-primary" href="goal-details.html?id=${goal.id}">${U.icon('plus')}Add milestones</a>`)}</div>`}`;

    App.bindGoalSelect(root, id => { goal = Store.get(id); selectedId = null; render(); });
    if (goal.milestones.length) { drawMap(); renderPanel(); }
  }

  function drawMap() {
    // 1. Group milestones into columns by dependency depth.
    const columns = [];
    goal.milestones.forEach(m => {
      const c = Deps.column(goal, m);
      (columns[c] = columns[c] || []).push(m);
    });

    // 2. Give every milestone an (x, y) position.
    const pos = {};
    columns.forEach((list, c) => {
      list.sort((a, b) => a.startDate.localeCompare(b.startDate));
      list.forEach((m, r) => {
        pos[m.id] = { x: PAD + c * (BOX_W + GAP_X), y: PAD + r * (BOX_H + GAP_Y) };
      });
    });
    const maxRows = Math.max(...columns.map(list => list.length));
    const width = PAD * 2 + columns.length * BOX_W + (columns.length - 1) * GAP_X;
    const height = PAD * 2 + maxRows * BOX_H + (maxRows - 1) * GAP_Y;

    // 3. Work out highlighting for the selected milestone.
    const selected = goal.milestones.find(m => m.id === selectedId);
    const prereqIds = selected ? selected.dependencies : [];
    const dependentIds = selected ? Deps.dependents(goal, selected).map(m => m.id) : [];

    // 4. Arrows: a curved SVG line from the prerequisite to the dependent milestone.
    let arrows = '';
    goal.milestones.forEach(m => {
      Deps.prerequisites(goal, m).forEach(p => {
        const x1 = pos[p.id].x + BOX_W, y1 = pos[p.id].y + BOX_H / 2;
        const x2 = pos[m.id].x - 6, y2 = pos[m.id].y + BOX_H / 2;
        const mid = (x1 + x2) / 2;
        let cls = p.status === 'completed' ? 'done' : '';
        if (selected) cls += (m.id === selectedId || p.id === selectedId) ? ' active' : ' faded';
        arrows += `<path class="arrow ${cls}" d="M${x1},${y1} C${mid},${y1} ${mid},${y2} ${x2},${y2}" marker-end="url(#arrowhead)"/>`;
      });
    });

    // 5. Boxes.
    const boxes = goal.milestones.map(m => {
      const p = pos[m.id];
      const waiting = Deps.waitingFor(goal, m).length > 0;
      let cls = '';
      if (selected) {
        cls = m.id === selectedId ? 'selected' : prereqIds.includes(m.id) ? 'prereq'
          : dependentIds.includes(m.id) ? 'dependent' : 'faded';
      }
      return `<button type="button" class="map-box s-${m.status} ${cls}" data-id="${m.id}"
          style="left:${p.x}px;top:${p.y}px;width:${BOX_W}px;height:${BOX_H}px">
          <span class="box-status"><span class="dot"></span>${U.STATUS[m.status]}${waiting ? U.icon('lock') : ''}</span>
          <span class="box-name">${U.esc(m.name)}</span>
          <span class="box-meta">${U.fmtShort(m.startDate)} – ${U.fmtShort(m.endDate)} · ${m.progress}%</span>
        </button>`;
    }).join('');

    const canvas = root.querySelector('.map-canvas');
    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;
    canvas.innerHTML = `
      <svg class="map-svg" width="${width}" height="${height}" aria-hidden="true">
        <defs><marker id="arrowhead" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="7" markerHeight="7" orient="auto">
          <path d="M0,0 L10,5 L0,10 z"/></marker></defs>
        ${arrows}
      </svg>${boxes}`;

    canvas.querySelectorAll('.map-box').forEach(box => box.addEventListener('click', () => {
      selectedId = box.dataset.id === selectedId ? null : box.dataset.id;
      drawMap();
      renderPanel();
    }));
  }

  function linkList(list, emptyText) {
    if (!list.length) return `<p class="muted small">${emptyText}</p>`;
    return `<ul class="link-list">${list.map(x =>
      `<li><button type="button" class="link-item" data-select="${x.id}">${U.badge(x.status)}<span>${U.esc(x.name)}</span></button></li>`).join('')}</ul>`;
  }

  function renderPanel() {
    const panel = root.querySelector('.map-panel');
    const m = goal.milestones.find(x => x.id === selectedId);
    if (!m) {
      panel.innerHTML = `<div class="panel-empty">${U.icon('map')}<h2>Select a milestone</h2>
        <p class="muted">Click any box on the map to see what it depends on and what depends on it.</p></div>`;
      return;
    }
    const waiting = Deps.waitingFor(goal, m);
    panel.innerHTML = `
      <div class="row-between">${U.badge(m.status)}
        <button type="button" class="btn btn-ghost btn-icon" data-clear aria-label="Clear selection">${U.icon('x')}</button></div>
      <h2 class="panel-title">${U.esc(m.name)}</h2>
      <p class="muted small">${U.esc(m.description || '')}</p>
      ${waiting.length
        ? `<p class="note note-warning">${U.icon('lock')}Waiting for: ${waiting.map(w => U.esc(w.name)).join(', ')}</p>`
        : m.status !== 'completed' ? `<p class="note note-success">${U.icon('check')}Ready — all dependencies are completed.</p>` : ''}
      <p class="small"><strong>${U.fmt(m.startDate)}</strong> → <strong>${U.fmt(m.endDate)}</strong></p>
      <div class="row-between small"><span class="muted">Progress</span><strong>${m.progress}%</strong></div>
      ${U.bar(m.progress, m.status)}
      <h3 class="panel-heading"><span class="key key-prereq"></span>Depends on</h3>
      ${linkList(Deps.prerequisites(goal, m), 'No dependencies — can start any time.')}
      <h3 class="panel-heading"><span class="key key-dependent"></span>Required for</h3>
      ${linkList(Deps.dependents(goal, m), 'No other milestone depends on this one.')}`;

    panel.querySelector('[data-clear]').addEventListener('click', () => { selectedId = null; drawMap(); renderPanel(); });
    panel.querySelectorAll('[data-select]').forEach(b => b.addEventListener('click', () => {
      selectedId = b.dataset.select; drawMap(); renderPanel();
    }));
  }

  render();
};
