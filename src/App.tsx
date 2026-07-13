import { useMemo, useRef, useState } from 'react';
import type { Bundle, Course, Program, Semester } from './types';
import { useProgram } from './storage';
import { useStudentPlan } from './studentPlanStore';
import { advisedProgram, generatePlan, type CourseStatus } from './studentPlan';
import { downloadProgram, readProgramFile } from './fileStore';
import { downloadProgramAsWord } from './wordExport';
import { emptyProgram } from './sampleData';
import { CurriculumGrid } from './components/CurriculumGrid';
import { SummaryPanel } from './components/SummaryPanel';
import { AdvisePanel } from './components/AdvisePanel';
import { CourseEditor } from './components/CourseEditor';
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
    open,
    save,
    saveAs,
    reset,
  } = useProgram();
  const plan = useStudentPlan();
  const [present, setPresent] = useState(false);
  const [editor, setEditor] = useState<EditorState>({ mode: 'closed' });
  const [showSettings, setShowSettings] = useState(false);
  const [showOpen, setShowOpen] = useState(false);
  const [compareWith, setCompareWith] = useState<Program | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  const compareInput = useRef<HTMLInputElement>(null);
  const planInput = useRef<HTMLInputElement>(null);

  const advising = plan.plan !== null;
  const editable = !present && !advising;

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

  const generate = () =>
    plan.setPlan((p) => ({ ...p, schedule: generatePlan(p).schedule }));

  // The grid in advise mode shows to-plan courses at their scheduled slot;
  // completed / in-progress courses stay at their curriculum slot.
  const advised = useMemo(
    () => (plan.plan ? advisedProgram(plan.plan) : null),
    [plan.plan],
  );

  return (
    <div
      className={`app ${!advising && present ? 'present-mode' : ''}${
        advising ? ' advise-mode' : ''
      }`}
    >
      <header className="topbar">
        <div className="title-area">
          {advising && plan.plan ? (
            <>
              <h1>
                {plan.plan.student.name || t('advise.untitledStudent')}
              </h1>
              <div className="subtitle">
                {t('advise.subtitle', { program: plan.plan.curriculum.name })}
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
              {canUseFiles && !present && (
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
                className="danger-ghost"
                onClick={() => {
                  if (!plan.dirty || confirm(t('advise.confirmClose'))) plan.close();
                }}
              >
                {t('advise.back')}
              </button>
              <LanguageSwitcher />
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
                    onClick={() =>
                      canUseFiles ? onOpenPlan() : planInput.current?.click()
                    }
                  >
                    {t('advise.openPlan')}
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
                  <HiddenFileInput ref={planInput} onFile={handleImportPlan} />
                </>
              )}
              <LanguageSwitcher />
              <button className="primary" onClick={() => setPresent((v) => !v)}>
                {present ? t('app.edit') : t('app.present')}
              </button>
            </>
          )}
        </div>
      </header>

      <div className="body">
        <main className="canvas">
          {advising && advised && plan.plan ? (
            <CurriculumGrid
              program={advised}
              editable={false}
              advise
              statusOf={(id) => plan.plan!.status[id]}
              onCycleStatus={cycleStatus}
            />
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
          <AdvisePanel
            plan={plan.plan}
            onChange={plan.setPlan}
            onGenerate={generate}
          />
        ) : (
          !present && <SummaryPanel program={program} />
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
    </div>
  );
}
