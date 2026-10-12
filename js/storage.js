/* ==========================================================================
   GoalMap · storage.js
   Saves and loads data with localStorage.

     goalmap_data  → array of goals (each goal contains its milestones)
     goalmap_theme → "dark" or "light"

   Goal shape:
     { id, name, description, category, startDate, targetDate, createdAt,
       milestones: [ { id, name, description, startDate, endDate,
                       status, progress, dependencies: [milestoneIds] } ] }
   ========================================================================== */
'use strict';

const Store = (() => {
  const DATA_KEY = 'goalmap_data';
  const THEME_KEY = 'goalmap_theme';
  let goals = null;   // in-memory copy of the saved data

  function load() {
    if (goals) return goals;
    try {
      goals = JSON.parse(localStorage.getItem(DATA_KEY));
    } catch (e) {
      goals = null;
    }
    // First visit (or unreadable data): start with a sample goal.
    if (!Array.isArray(goals)) {
      goals = sampleGoals();
      save();
    }
    return goals;
  }

  function save() {
    localStorage.setItem(DATA_KEY, JSON.stringify(goals));
  }

  const all = () => load();
  const get = id => load().find(g => g.id === id) || null;
  function add(goal) {
    load().unshift(goal);
    save();
  }
  function remove(id) {
    goals = load().filter(g => g.id !== id);
    save();
  }

  /* Theme preference (dark by default) */
  const getTheme = () => localStorage.getItem(THEME_KEY) === 'light' ? 'light' : 'dark';
  const setTheme = theme => localStorage.setItem(THEME_KEY, theme);

  /* Sample data — dates are relative to today so it always looks current. */
  function sampleGoals() {
    const d = n => U.addDays(U.today(), n);

    function goal(name, description, category, start, target, list) {
      const g = { id: U.uid(), name, description, category, startDate: d(start), targetDate: d(target), createdAt: Date.now(), milestones: [] };
      list.forEach(([mName, desc, s, days, status, progress, deps]) => {
        g.milestones.push({
          id: U.uid(), name: mName, description: desc,
          startDate: d(s), endDate: d(s + days - 1),
          status, progress,
          dependencies: deps.map(i => g.milestones[i].id),   // indexes → ids
        });
      });
      return g;
    }

    return [
      goal('Become a Software Developer',
        'Build the skills, projects and application materials needed to land a software developer internship.',
        'Career', -40, 80, [
          ['Learn HTML', 'Semantic markup, forms and page structure.', -40, 10, 'completed', 100, []],
          ['Learn CSS', 'Flexbox, Grid and responsive layouts.', -30, 12, 'completed', 100, [0]],
          ['Learn JavaScript', 'DOM, events, ES6+ and async programming.', -18, 25, 'in-progress', 70, [1]],
          ['Learn Java', 'Core Java, OOP and the Collections framework.', -35, 30, 'delayed', 85, []],
          ['Learn DSA', 'Arrays, linked lists, trees and problem-solving patterns.', 0, 30, 'not-started', 0, [3]],
          ['Build 2 Projects', 'One web application and one Java project.', 20, 25, 'not-started', 0, [2, 3]],
          ['Create Resume', 'One-page technical resume.', 45, 7, 'not-started', 0, [5]],
          ['Prepare Portfolio', 'Portfolio site with project write-ups.', 45, 10, 'not-started', 0, [5]],
          ['Apply for Internships', 'Shortlist companies and send applications.', 56, 20, 'not-started', 0, [4, 6, 7]],
        ]),
      goal('AWS Cloud Practitioner Certification',
        'Earn the AWS Certified Cloud Practitioner credential to strengthen cloud fundamentals.',
        'Education', -20, 25, [
          ['Cloud Concepts', 'Cloud models and the shared responsibility model.', -20, 8, 'completed', 100, []],
          ['Core AWS Services', 'EC2, S3, RDS, Lambda and IAM.', -12, 14, 'in-progress', 80, [0]],
          ['Practice Exams', 'Three timed practice exams.', 6, 10, 'not-started', 0, [1]],
          ['Take the Exam', 'Book the slot and pass the exam.', 18, 3, 'not-started', 0, [2]],
        ]),
    ];
  }

  return { load, save, all, get, add, remove, getTheme, setTheme };
})();
