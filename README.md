# GoalMap – Goal & Milestone Planning System

A web-based goal planning app built with **HTML, CSS and vanilla JavaScript**. Data is saved in the browser with **localStorage** — there is no backend or database.

**Core idea:** Goal → Milestones → Dependencies → Progress → Timeline

## How to run

Open `index.html` in a browser. No installation is needed.

## Pages

| Page | What it does |
|---|---|
| **Dashboard** (`index.html`) | Totals, overall progress, goal cards and upcoming milestones |
| **My Goals** (`goals.html`) | Search goals, and create or edit a goal |
| **Goal Details** (`goal-details.html`) | Add, edit and delete milestones, set status, progress and dependencies |
| **Goal Map** (`goal-map.html`) | Boxes and arrows showing which milestone depends on which |
| **Timeline** (`timeline.html`) | Milestones in date order from the start date to the target date |

## Features

- Create, edit and delete goals (name, description, category, start date, target date)
- Add, edit and delete milestones with status: Not Started, In Progress, Completed, Delayed
- Milestone progress slider; overall goal progress is the average of milestone progress
- Dependencies between milestones (loops are prevented)
- Visual goal map and chronological timeline
- Goal search
- Dark / light mode button
- Data saved in localStorage

## Project structure

```
index.html, goals.html, goal-details.html, goal-map.html, timeline.html
css/style.css
js/utils.js         helpers: dates, icons, toasts, dialogs, form errors
js/storage.js       localStorage save/load and sample data
js/goals.js         goal & milestone logic, My Goals and Goal Details pages
js/dependencies.js  dependency helpers and the Goal Map page
js/timeline.js      Timeline page
js/app.js           layout, dark/light mode, Dashboard and start-up
assets/icons/logo.svg
```
