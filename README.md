# Curriculum Builder

An interactive web app for building the curriculum of a degree program
(designed with a B.Sc. in mind). Lay out courses across years and semesters,
set prerequisites, and track credit totals.

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
- **Persistence** — everything is saved to your browser's local storage
  automatically. Export to / import from a JSON file to back up or share.
- **Sample program** — load an illustrative B.Sc. in Computer Science to see the
  layout, or start from a blank program.
- **Multi-lingual** — full Hebrew and English interface, switchable from the
  toolbar. Defaults to Hebrew with right-to-left layout; the choice is
  remembered in local storage.

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
  defaultPrograms.ts        Loads the built-in programs shown in the Open dialog
  defaultPrograms/          Built-in program JSONs (one file per program)
  storage.ts                localStorage persistence + JSON export/import
  stats.ts                  Credit totals, breakdowns, prerequisite checks
  App.tsx                   Top-level layout, toolbar, editor wiring
  i18n/
    translations.ts         Hebrew + English dictionaries, language list
    I18nContext.tsx         Provider: language state, RTL on <html>, t()
    useI18n.ts              Context + useI18n() hook + typed t() keys
  components/
    CurriculumGrid.tsx      Years × semesters grid of course cards
    CourseCard.tsx          A single course tile
    CourseEditor.tsx        Add/edit course modal (incl. prerequisites)
    ProgramSettings.tsx     Program name, years, required credits, etc.
    SummaryPanel.tsx        Credit summary + prerequisite warnings
    LanguageSwitcher.tsx    Language dropdown in the toolbar
```

## Adding a default program

The **Open** dialog lists a set of built-in programs plus an "Open from file"
option. The built-ins are every `*.json` file in
[src/defaultPrograms/](src/defaultPrograms/) — the exact JSON that Export / Save
produces. Drop a curriculum file into that folder and it appears automatically;
no code change is needed. The name shown is the program's own `name`/`degree`.

## Adding a language

1. Add the language code to `Lang` and the `LANGUAGES` list in
   [src/i18n/translations.ts](src/i18n/translations.ts) (set its `dir`).
2. Add a matching entry to the `translations` map. The `en` dictionary is the
   canonical shape — TypeScript will flag any missing keys.

## Data model

A program is a list of courses, each pinned to a `year` and `semester`, plus
program-level fields (name, degree, institution, number of years, required
credits). The full JSON shape is exactly what Export produces and Import reads.
