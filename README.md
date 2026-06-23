# Curriculum Builder

An interactive web app for building and presenting the curriculum of a degree
program (designed with a B.Sc. in mind). Lay out courses across years and
semesters, set prerequisites, track credit totals, and switch to a clean
present mode for sharing.

## Features

- **Year × semester grid** — add courses to Semester A / B (and optional Summer)
  for each year of the program.
- **Course details** — code, name, credits, type (mandatory / elective /
  seminar / project / general studies), free-form category, description, and
  prerequisites selected from other courses.
- **Live summary** — total credits vs. required, breakdown by year and by course
  type, and a progress bar.
- **Prerequisite checks** — warns when a course is scheduled at or before one of
  its prerequisites.
- **Present mode** — hides editing controls and the summary for a clean,
  shareable layout.
- **Persistence** — everything is saved to your browser's local storage
  automatically. Export to / import from a JSON file to back up or share.
- **Sample program** — load an illustrative B.Sc. in Computer Science to see the
  layout, or start from a blank program.

## Getting started

```bash
npm install
npm run dev      # start the dev server (http://localhost:5173)
npm run build    # type-check and build for production
npm run preview  # preview the production build
```

## Tech stack

React + TypeScript + Vite. No backend — all data lives in the browser.

## Project layout

```
src/
  types.ts                  Data model (Program, Course, types)
  sampleData.ts             Sample CS program + empty-program factory
  storage.ts                localStorage persistence + JSON export/import
  stats.ts                  Credit totals, breakdowns, prerequisite checks
  App.tsx                   Top-level layout, toolbar, editor wiring
  components/
    CurriculumGrid.tsx      Years × semesters grid of course cards
    CourseCard.tsx          A single course tile
    CourseEditor.tsx        Add/edit course modal (incl. prerequisites)
    ProgramSettings.tsx     Program name, years, required credits, etc.
    SummaryPanel.tsx        Credit summary + prerequisite warnings
```

## Data model

A program is a list of courses, each pinned to a `year` and `semester`, plus
program-level fields (name, degree, institution, number of years, required
credits). The full JSON shape is exactly what Export produces and Import reads.
