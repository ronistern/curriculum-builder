import { useRef, useState } from 'react';
import type { Course, Program, Semester } from './types';
import { useProgram } from './storage';
import { downloadProgram, readProgramFile } from './fileStore';
import { emptyProgram } from './sampleData';
import { CurriculumGrid } from './components/CurriculumGrid';
import { SummaryPanel } from './components/SummaryPanel';
import { CourseEditor } from './components/CourseEditor';
import { ProgramSettings } from './components/ProgramSettings';
import { DiffView } from './components/DiffView';
import { LanguageSwitcher } from './components/LanguageSwitcher';
import { useI18n } from './i18n/useI18n';
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
    open,
    save,
    saveAs,
    reset,
  } = useProgram();
  const [present, setPresent] = useState(false);
  const [editor, setEditor] = useState<EditorState>({ mode: 'closed' });
  const [showSettings, setShowSettings] = useState(false);
  const [compareWith, setCompareWith] = useState<Program | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  const compareInput = useRef<HTMLInputElement>(null);

  const editable = !present;

  const upsertCourse = (course: Course) => {
    setProgram((p) => {
      const exists = p.courses.some((c) => c.id === course.id);
      return {
        ...p,
        courses: exists
          ? p.courses.map((c) => (c.id === course.id ? course : c))
          : [...p.courses, course],
      };
    });
    setEditor({ mode: 'closed' });
  };

  const deleteCourse = (id: string) => {
    setProgram((p) => ({
      ...p,
      courses: p.courses
        .filter((c) => c.id !== id)
        .map((c) => ({
          ...c,
          prerequisites: c.prerequisites.filter((pre) => pre !== id),
        })),
    }));
    setEditor({ mode: 'closed' });
  };

  const handleImport = async (file: File | undefined) => {
    if (!file) return;
    try {
      const imported = await readProgramFile(file);
      setProgram(imported);
    } catch (err) {
      alert(t('app.importError') + (err as Error).message);
    }
  };

  const handleCompare = async (file: File | undefined) => {
    if (!file) return;
    try {
      setCompareWith(await readProgramFile(file));
    } catch (err) {
      alert(t('app.compareError') + (err as Error).message);
    }
  };

  const onOpen = async () => {
    try {
      await open();
    } catch (err) {
      alert(t('app.openError') + (err as Error).message);
    }
  };

  const onSave = async (mode: 'save' | 'saveAs') => {
    try {
      await (mode === 'saveAs' ? saveAs() : save());
    } catch (err) {
      alert(t('app.saveError') + (err as Error).message);
    }
  };

  return (
    <div className={`app ${present ? 'present-mode' : ''}`}>
      <header className="topbar">
        <div className="title-area">
          <h1>
            {program.degree} {program.name}
          </h1>
          {program.institution && (
            <div className="subtitle">{program.institution}</div>
          )}
          {canUseFiles && !present && (
            <div className="file-status">
              {fileName ?? t('app.untitled')}
              {dirty && (
                <span className="unsaved" title={t('app.unsaved')}>
                  {' '}
                  •
                </span>
              )}
            </div>
          )}
        </div>

        <div className="toolbar">
          {editable && (
            <>
              <button onClick={() => setShowSettings(true)}>
                {t('app.program')}
              </button>
              {canUseFiles ? (
                <>
                  <button onClick={onOpen}>{t('app.open')}</button>
                  <button onClick={() => onSave('save')}>
                    {t('app.save')}
                    {dirty ? ' •' : ''}
                  </button>
                  <button onClick={() => onSave('saveAs')}>
                    {t('app.saveAs')}
                  </button>
                </>
              ) : (
                <>
                  <button onClick={() => downloadProgram(program)}>
                    {t('app.export')}
                  </button>
                  <button onClick={() => fileInput.current?.click()}>
                    {t('app.import')}
                  </button>
                </>
              )}
              <button onClick={() => compareInput.current?.click()}>
                {t('app.compare')}
              </button>
              <button
                className="danger-ghost"
                onClick={() => {
                  if (confirm(t('app.confirmNew'))) reset(emptyProgram());
                }}
              >
                {t('app.new')}
              </button>
              <input
                ref={fileInput}
                type="file"
                accept="application/json"
                hidden
                onChange={(e) => {
                  handleImport(e.target.files?.[0]);
                  e.target.value = '';
                }}
              />
              <input
                ref={compareInput}
                type="file"
                accept="application/json"
                hidden
                onChange={(e) => {
                  handleCompare(e.target.files?.[0]);
                  e.target.value = '';
                }}
              />
            </>
          )}
          <LanguageSwitcher />
          <button className="primary" onClick={() => setPresent((v) => !v)}>
            {present ? t('app.edit') : t('app.present')}
          </button>
        </div>
      </header>

      <div className="body">
        <main className="canvas">
          <CurriculumGrid
            program={program}
            editable={editable}
            onEdit={(course) => setEditor({ mode: 'edit', course })}
            onAdd={(year, semester: Semester) =>
              setEditor({ mode: 'add', seed: { year, semester } })
            }
          />
        </main>
        {!present && <SummaryPanel program={program} />}
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
