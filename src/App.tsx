import { useEffect, useMemo, useRef, useState } from 'react';
import type { Bundle, Course, Program, Semester } from './types';
import { useProgram } from './storage';
import { useStudentPlan } from './studentPlanStore';
import {
  advisedProgram,
  generatePlan,
  planCourses,
  planVsProgram,
  type CourseStatus,
  type TermSlot,
} from './studentPlan';
import { allCatalogs } from './catalogLibrary';
import { downloadProgram, readProgramFile } from './fileStore';
import { downloadProgramAsWord } from './wordExport';
import { emptyProgram } from './sampleData';
import { CurriculumGrid } from './components/CurriculumGrid';
import { SummaryPanel } from './components/SummaryPanel';
import { AdvisePanel } from './components/AdvisePanel';
import { CourseEditor } from './components/CourseEditor';
import { CoursePicker } from './components/CoursePicker';
import { ProgramSettings } from './components/ProgramSettings';
import { DiffView } from './components/DiffView';
import { LanguageSwitcher } from './components/LanguageSwitcher';
import { HiddenFileInput } from './components/HiddenFileInput';
import { OpenProgramDialog } from './components/OpenProgramDialog';
import { useI18n } from './i18n/useI18n';
import type { TKey } from './i18n/useI18n';
import './App.css';

/** File name + unsaved indicator shown under the title. */
function FileStatus({ name, dirty }: { name: string | null; dirty: boolean }) {
  const { t } = useI18n();
  return (
    <div className="file-status">
      {name ?? t('app.untitled')}
      {dirty && (
        <span className="unsaved" title={t('app.unsaved')}>
          {' •'}
        </span>
      )}
    </div>
  );
}

/** The Save / Save As button pair, shared by curriculum and plan toolbars. */
function SaveButtons({
  dirty,
  onSave,
  onSaveAs,
}: {
  dirty: boolean;
  onSave: () => void;
  onSaveAs: () => void;
}) {
  const { t } = useI18n();
  return (
    <>
      <button onClick={onSave}>
        {t('app.save')}
        {dirty ? ' •' : ''}
      </button>
      <button onClick={onSaveAs}>{t('app.saveAs')}</button>
    </>
  );
}

/** Undo / Redo button pair, shared by the curriculum and plan toolbars. */
function UndoRedo({
  canUndo,
  canRedo,
  onUndo,
  onRedo,
}: {
  canUndo: boolean;
  canRedo: boolean;
  onUndo: () => void;
  onRedo: () => void;
}) {
  const { t } = useI18n();
  return (
    <>
      <button onClick={onUndo} disabled={!canUndo} title={t('app.undo')}>
        ↶ {t('app.undo')}
      </button>
      <button onClick={onRedo} disabled={!canRedo} title={t('app.redo')}>
        ↷ {t('app.redo')}
      </button>
    </>
  );
}

type EditorState =
  | { mode: 'closed' }
  | { mode: 'edit'; course: Course }
  | { mode: 'add'; seed: Partial<Course> };

export default function App() {
  const { t, dir } = useI18n();
  const {
    program,
    setProgram,
    fileName,
    dirty,
    canUseFiles,
    undo,
    redo,
    canUndo,
    canRedo,
    open,
    save,
    saveAs,
    reset,
  } = useProgram();
  const plan = useStudentPlan();
  const [editor, setEditor] = useState<EditorState>({ mode: 'closed' });
  const [showSettings, setShowSettings] = useState(false);
  const [showOpen, setShowOpen] = useState(false);
  const [compareWith, setCompareWith] = useState<Program | null>(null);
  // Advise mode: show the plan-vs-recommended-program changes dialog.
  const [showPlanDiff, setShowPlanDiff] = useState(false);
  // Advise mode: the cell a course is being added into (null = picker closed).
  const [picker, setPicker] = useState<TermSlot | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  const compareInput = useRef<HTMLInputElement>(null);
  const planInput = useRef<HTMLInputElement>(null);
  const catalogInput = useRef<HTMLInputElement>(null);

  const advising = plan.plan !== null;
  const editable = !advising;

  // Ctrl/Cmd+Z to undo, Ctrl/Cmd+Shift+Z or Ctrl/Cmd+Y to redo, routed to the
  // active document (plan while advising, otherwise the curriculum). Ignored
  // while typing in a field so the browser's native text undo still works.
  const planUndo = plan.undo;
  const planRedo = plan.redo;
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!(e.ctrlKey || e.metaKey)) return;
      const key = e.key.toLowerCase();
      const isUndo = key === 'z' && !e.shiftKey;
      const isRedo = (key === 'z' && e.shiftKey) || key === 'y';
      if (!isUndo && !isRedo) return;
      const el = e.target as HTMLElement | null;
      if (el && (el.isContentEditable || el.closest('input, textarea, select')))
        return;
      e.preventDefault();
      if (advising) (isUndo ? planUndo : planRedo)();
      else (isUndo ? undo : redo)();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [advising, undo, redo, planUndo, planRedo]);

  /** Drop bundles that no longer have any member courses. */
  const pruneBundles = (bundles: Bundle[], courses: Course[]): Bundle[] =>
    bundles.filter((b) => courses.some((c) => c.bundleId === b.id));

  const upsertCourse = (course: Course, bundle?: Bundle) => {
    setProgram((p) => {
      const exists = p.courses.some((c) => c.id === course.id);
      const courses = exists
        ? p.courses.map((c) => (c.id === course.id ? course : c))
        : [...p.courses, course];
      let bundles = p.bundles;
      if (bundle) {
        bundles = bundles.some((b) => b.id === bundle.id)
          ? bundles.map((b) => (b.id === bundle.id ? bundle : b))
          : [...bundles, bundle];
      }
      return { ...p, courses, bundles: pruneBundles(bundles, courses) };
    });
    setEditor({ mode: 'closed' });
  };

  const deleteCourse = (id: string) => {
    setProgram((p) => {
      const courses = p.courses
        .filter((c) => c.id !== id)
        .map((c) => ({
          ...c,
          prerequisites: c.prerequisites.filter((pre) => pre !== id),
        }));
      return { ...p, courses, bundles: pruneBundles(p.bundles, courses) };
    });
    setEditor({ mode: 'closed' });
  };

  /** Run an async file action, surfacing any failure as an alert. */
  const runOrAlert = async (fn: () => unknown, errKey: TKey) => {
    try {
      await fn();
    } catch (err) {
      alert(t(errKey) + (err as Error).message);
    }
  };

  const handleImport = (file: File | undefined) =>
    file &&
    runOrAlert(async () => setProgram(await readProgramFile(file)), 'app.importError');

  const handleCompare = (file: File | undefined) =>
    file &&
    runOrAlert(async () => setCompareWith(await readProgramFile(file)), 'app.compareError');

  // Load a built-in program as a fresh, untitled working copy. Clone it so
  // edits never mutate the shared module object behind `defaultPrograms`.
  const handleSelectDefault = (p: Program) => {
    setShowOpen(false);
    reset(structuredClone(p));
  };

  // "Open from file" inside the dialog: native picker where available, else the
  // hidden upload input used by browsers without the File System Access API.
  const handleOpenFromFile = () => {
    setShowOpen(false);
    if (canUseFiles) onOpen();
    else fileInput.current?.click();
  };

  const onOpen = () => runOrAlert(open, 'app.openError');

  const onSave = (mode: 'save' | 'saveAs') =>
    runOrAlert(mode === 'saveAs' ? saveAs : save, 'app.saveError');

  const onOpenPlan = () => runOrAlert(plan.open, 'advise.openError');

  const handleImportPlan = (file: File | undefined) =>
    file && runOrAlert(() => plan.importFile(file), 'advise.openError');

  const onSavePlan = (mode: 'save' | 'saveAs') =>
    runOrAlert(mode === 'saveAs' ? plan.saveAs : plan.save, 'app.saveError');

  // Cycle a course's plan status: to-plan → completed → in-progress → to-plan.
  const cycleStatus = (id: string) =>
    plan.setPlan((p) => {
      const next: Record<string, CourseStatus> = { ...p.status };
      const cur = next[id];
      if (!cur) next[id] = 'completed';
      else if (cur === 'completed') next[id] = 'in-progress';
      else delete next[id];
      return { ...p, status: next };
    });

  const catalog = plan.catalog;

  // Remove a course from this student's plan (also clearing any status / slot /
  // manual placement). A base catalog course goes onto `excluded`; an added
  // course is dropped from `extraCourses`. Either way it's re-addable via the
  // grid's per-cell "+".
  const removeCourse = (id: string) =>
    plan.setPlan((p) => {
      const status = { ...p.status };
      const schedule = { ...p.schedule };
      const placements = { ...p.placements };
      delete status[id];
      delete schedule[id];
      delete placements[id];
      const isBase = !!catalog?.courses.some((c) => c.id === id);
      return {
        ...p,
        status,
        schedule,
        placements,
        excluded:
          isBase && !p.excluded.includes(id) ? [...p.excluded, id] : p.excluded,
        extraCourses: isBase
          ? p.extraCourses
          : p.extraCourses.filter((c) => c.id !== id),
      };
    });

  // Add a catalog course into a specific cell (year+semester). A base course is
  // un-excluded and pinned there; a course from another program is snapshotted
  // into `extraCourses`. Either way its placement overrides the auto-scheduler.
  const addCourseAt = (course: Course, slot: TermSlot) => {
    plan.setPlan((p) => {
      const isBase = !!catalog?.courses.some((c) => c.id === course.id);
      const placements = { ...p.placements, [course.id]: slot };
      return isBase
        ? { ...p, placements, excluded: p.excluded.filter((x) => x !== course.id) }
        : {
            ...p,
            placements,
            extraCourses: p.extraCourses.some((c) => c.id === course.id)
              ? p.extraCourses
              : [...p.extraCourses, course],
          };
    });
    setPicker(null);
  };

  const generate = () =>
    catalog &&
    plan.setPlan((p) => ({ ...p, schedule: generatePlan(p, catalog).schedule }));

  // Courses selectable in the per-cell picker: every course across all catalogs
  // in the library (deduped by id). Courses already in this plan are included
  // too — picking one re-places it into the chosen cell — and flagged via
  // `pickerInPlan` so the picker can mark them.
  const pickerInPlan = useMemo(
    () =>
      plan.plan && catalog
        ? new Set(planCourses(catalog, plan.plan).map((c) => c.id))
        : new Set<string>(),
    [plan.plan, catalog],
  );
  const pickerGroups = useMemo(() => {
    if (!plan.plan || !catalog) return [];
    const seen = new Set<string>();
    return allCatalogs()
      .map((prog) => ({
        program: `${prog.degree} ${prog.name}`.trim(),
        courses: prog.courses.filter((c) => {
          if (seen.has(c.id)) return false;
          seen.add(c.id);
          return true;
        }),
      }))
      .filter((g) => g.courses.length > 0);
  }, [plan.plan, catalog]);

  // Resolve the referenced catalog from an opened file when it isn't in the
  // library (e.g. a plan saved on another device), adopting its id.
  const handleProvideCatalog = (file: File | undefined) =>
    file &&
    runOrAlert(async () => {
      const opened = await readProgramFile(file);
      plan.provideCatalog(opened);
      plan.setPlan((p) => ({
        ...p,
        catalogId: opened.id,
        catalogName: opened.name,
      }));
    }, 'advise.openError');

  // The schedule grid places to-plan courses (scheduled) + in-progress courses
  // (at the current term); completed courses are listed in the AdvisePanel.
  const advised = useMemo(
    () => (plan.plan && catalog ? advisedProgram(plan.plan, catalog) : null),
    [plan.plan, catalog],
  );

  return (
    <div className={`app${advising ? ' advise-mode' : ''}`}>
      <header className="topbar">
        <div className="title-area">
          {advising && plan.plan ? (
            <>
              <h1>
                {plan.plan.student.name || t('advise.untitledStudent')}
              </h1>
              <div className="subtitle">
                {t('advise.subtitle', {
                  program: catalog?.name ?? plan.plan.catalogName,
                })}
              </div>
              {canUseFiles && (
                <FileStatus name={plan.fileName} dirty={plan.dirty} />
              )}
            </>
          ) : (
            <>
              <h1>
                {program.degree} {program.name}
              </h1>
              {program.institution && (
                <div className="subtitle">{program.institution}</div>
              )}
              {canUseFiles && (
                <FileStatus name={fileName} dirty={dirty} />
              )}
            </>
          )}
        </div>

        <div className="toolbar">
          {advising ? (
            <>
              <UndoRedo
                canUndo={plan.canUndo}
                canRedo={plan.canRedo}
                onUndo={plan.undo}
                onRedo={plan.redo}
              />
              {canUseFiles ? (
                <SaveButtons
                  dirty={plan.dirty}
                  onSave={() => onSavePlan('save')}
                  onSaveAs={() => onSavePlan('saveAs')}
                />
              ) : (
                <button onClick={() => plan.download()}>{t('app.export')}</button>
              )}
              <button
                onClick={() =>
                  canUseFiles ? onOpenPlan() : planInput.current?.click()
                }
              >
                {t('advise.openPlan')}
              </button>
              {catalog && (
                <button onClick={() => setShowPlanDiff(true)}>
                  {t('planDiff.button')}
                </button>
              )}
              <button
                className="danger-ghost"
                onClick={() => {
                  if (!plan.dirty || confirm(t('advise.confirmClose'))) plan.close();
                }}
              >
                {t('advise.back')}
              </button>
              <LanguageSwitcher />
              <HiddenFileInput ref={planInput} onFile={handleImportPlan} />
            </>
          ) : (
            <>
              {editable && (
                <>
                  <UndoRedo
                    canUndo={canUndo}
                    canRedo={canRedo}
                    onUndo={undo}
                    onRedo={redo}
                  />
                  <button onClick={() => setShowSettings(true)}>
                    {t('app.program')}
                  </button>
                  <button onClick={() => setShowOpen(true)}>
                    {t('app.open')}
                  </button>
                  {canUseFiles ? (
                    <SaveButtons
                      dirty={dirty}
                      onSave={() => onSave('save')}
                      onSaveAs={() => onSave('saveAs')}
                    />
                  ) : (
                    <button onClick={() => downloadProgram(program)}>
                      {t('app.export')}
                    </button>
                  )}
                  <button onClick={() => downloadProgramAsWord(program, t, dir)}>
                    {t('app.exportWord')}
                  </button>
                  <button onClick={() => compareInput.current?.click()}>
                    {t('app.compare')}
                  </button>
                  <button onClick={() => plan.start(program)}>
                    {t('advise.planForStudent')}
                  </button>
                  <button
                    className="danger-ghost"
                    onClick={() => {
                      if (confirm(t('app.confirmNew'))) reset(emptyProgram());
                    }}
                  >
                    {t('app.new')}
                  </button>
                  <HiddenFileInput ref={fileInput} onFile={handleImport} />
                  <HiddenFileInput ref={compareInput} onFile={handleCompare} />
                </>
              )}
              <LanguageSwitcher />
            </>
          )}
        </div>
      </header>

      <div className="body">
        <main className="canvas">
          {advising && plan.plan ? (
            advised && catalog ? (
              <CurriculumGrid
                program={advised}
                editable={false}
                advise
                statusOf={(id) => plan.plan!.status[id]}
                onCycleStatus={cycleStatus}
                onRemove={removeCourse}
                onAddAt={(year, semester) => setPicker({ year, semester })}
              />
            ) : (
              <div className="catalog-missing">
                <p>{t('advise.catalogMissing', { name: plan.plan.catalogName })}</p>
                <button
                  className="primary"
                  onClick={() => catalogInput.current?.click()}
                >
                  {t('advise.openCatalog')}
                </button>
                <HiddenFileInput ref={catalogInput} onFile={handleProvideCatalog} />
              </div>
            )
          ) : (
            <CurriculumGrid
              program={program}
              editable={editable}
              onEdit={(course) => setEditor({ mode: 'edit', course })}
              onAdd={(year, semester: Semester) =>
                setEditor({ mode: 'add', seed: { year, semester } })
              }
            />
          )}
        </main>
        {advising && plan.plan ? (
          catalog && (
            <AdvisePanel
              plan={plan.plan}
              catalog={catalog}
              onChange={plan.setPlan}
              onGenerate={generate}
            />
          )
        ) : (
          <SummaryPanel program={program} />
        )}
      </div>

      {editor.mode === 'edit' && (
        <CourseEditor
          program={program}
          initial={editor.course}
          onSave={upsertCourse}
          onCancel={() => setEditor({ mode: 'closed' })}
          onDelete={() => deleteCourse(editor.course.id)}
        />
      )}
      {editor.mode === 'add' && (
        <CourseEditor
          program={program}
          initial={editor.seed}
          onSave={upsertCourse}
          onCancel={() => setEditor({ mode: 'closed' })}
        />
      )}
      {showOpen && (
        <OpenProgramDialog
          onSelect={handleSelectDefault}
          onOpenFile={handleOpenFromFile}
          onClose={() => setShowOpen(false)}
        />
      )}
      {showSettings && (
        <ProgramSettings
          program={program}
          onChange={setProgram}
          onClose={() => setShowSettings(false)}
        />
      )}
      {compareWith && (
        <DiffView
          base={compareWith}
          other={program}
          onClose={() => setCompareWith(null)}
        />
      )}
      {showPlanDiff &&
        plan.plan &&
        catalog &&
        (() => {
          const { recommended, planned } = planVsProgram(plan.plan, catalog);
          return (
            <DiffView
              base={recommended}
              other={planned}
              title={t('planDiff.title')}
              subtitle={t('planDiff.against', {
                program: catalog.name,
                student: plan.plan.student.name || t('advise.untitledStudent'),
              })}
              identicalText={t('planDiff.identical')}
              onClose={() => setShowPlanDiff(false)}
            />
          );
        })()}
      {picker && (
        <CoursePicker
          groups={pickerGroups}
          inPlan={pickerInPlan}
          target={`${t('grid.year', { n: picker.year })} · ${t(
            `semester.${picker.semester}`,
          )}`}
          onSelect={(course) => addCourseAt(course, picker)}
          onClose={() => setPicker(null)}
        />
      )}
    </div>
  );
}
