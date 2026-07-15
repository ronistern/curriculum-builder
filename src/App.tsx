import { useEffect, useRef, useState } from 'react';
import type { Bundle, Course, Program, Semester } from './types';
import { useProgram } from './storage';
import { useStudentPlan } from './studentPlanStore';
import { planVsProgram, type TermSlot } from './studentPlan';
import { usePlanAdvisor } from './usePlanAdvisor';
import { downloadProgram, readProgramFile } from './fileStore';
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
import { FileStatus, SaveButtons, UndoRedo } from './components/Toolbar';
import { useI18n } from './i18n/useI18n';
import type { TKey } from './i18n/useI18n';
import './App.css';

type EditorState =
  | { mode: 'closed' }
  | { mode: 'edit'; course: Course }
  | { mode: 'add'; seed: Partial<Course> };

export default function App() {
  const { t } = useI18n();
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
  const advisor = usePlanAdvisor(plan);
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
  const catalog = plan.catalog;

  // A blocking dialog owns its own draft state; a background undo/redo behind it
  // would be invisible and surprising, so the shortcut is muted while one is open.
  const modalOpen =
    editor.mode !== 'closed' ||
    showSettings ||
    showOpen ||
    compareWith !== null ||
    showPlanDiff ||
    picker !== null;

  // Ctrl/Cmd+Z to undo, Ctrl/Cmd+Shift+Z or Ctrl/Cmd+Y to redo, routed to the
  // active document (plan while advising, otherwise the curriculum). Ignored
  // while typing in a field so the browser's native text undo still works.
  const planUndo = plan.undo;
  const planRedo = plan.redo;
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (modalOpen || !(e.ctrlKey || e.metaKey)) return;
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
  }, [modalOpen, advising, undo, redo, planUndo, planRedo]);

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
      alert(t(errKey) + (err instanceof Error ? err.message : String(err)));
    }
  };

  // Opening a file is a wholesale document swap, so it goes through `reset`
  // (clearing undo history + detaching any handle) rather than `setProgram`,
  // which would leave the swap on the undo stack. This is the fallback path for
  // browsers without the File System Access API; `canUseFiles` browsers use the
  // native `open` above, which resets similarly.
  const handleImport = (file: File | undefined) =>
    file &&
    runOrAlert(async () => reset(await readProgramFile(file)), 'app.importError');

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

  // Resolve the referenced catalog from an opened file when it isn't in the
  // library (e.g. a plan saved on another device).
  const handleProvideCatalog = (file: File | undefined) =>
    file &&
    runOrAlert(
      async () => advisor.adoptCatalog(await readProgramFile(file)),
      'advise.openError',
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
              <UndoRedo
                canUndo={plan.canUndo}
                canRedo={plan.canRedo}
                onUndo={plan.undo}
                onRedo={plan.redo}
              />
              <HiddenFileInput ref={planInput} onFile={handleImportPlan} />
            </>
          ) : (
            <>
              {editable && (
                <>
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
              {editable && (
                <UndoRedo
                  canUndo={canUndo}
                  canRedo={canRedo}
                  onUndo={undo}
                  onRedo={redo}
                />
              )}
            </>
          )}
        </div>
      </header>

      <div className="body">
        <main className="canvas">
          {advising && plan.plan ? (
            advisor.advised && catalog ? (
              <CurriculumGrid
                program={advisor.advised}
                editable={false}
                advise
                statusOf={(id) => plan.plan!.status[id]}
                onCycleStatus={advisor.cycleStatus}
                onRemove={advisor.removeCourse}
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
              onGenerate={advisor.generate}
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
          groups={advisor.pickerGroups}
          inPlan={advisor.pickerInPlan}
          target={`${t('grid.year', { n: picker.year })} · ${t(
            `semester.${picker.semester}`,
          )}`}
          onSelect={(course) => {
            advisor.addCourseAt(course, picker);
            setPicker(null);
          }}
          onClose={() => setPicker(null)}
        />
      )}
    </div>
  );
}
