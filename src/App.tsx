import { useRef, useState } from 'react';
import type { Course, Semester } from './types';
import { useProgram, exportProgram, importProgram } from './storage';
import { emptyProgram, sampleProgram } from './sampleData';
import { CurriculumGrid } from './components/CurriculumGrid';
import { SummaryPanel } from './components/SummaryPanel';
import { CourseEditor } from './components/CourseEditor';
import { ProgramSettings } from './components/ProgramSettings';
import { LanguageSwitcher } from './components/LanguageSwitcher';
import { useI18n } from './i18n/useI18n';
import './App.css';

type EditorState =
  | { mode: 'closed' }
  | { mode: 'edit'; course: Course }
  | { mode: 'add'; seed: Partial<Course> };

export default function App() {
  const { t } = useI18n();
  const [program, setProgram] = useProgram();
  const [present, setPresent] = useState(false);
  const [editor, setEditor] = useState<EditorState>({ mode: 'closed' });
  const [showSettings, setShowSettings] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);

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
      const imported = await importProgram(file);
      setProgram(imported);
    } catch (err) {
      alert(t('app.importError') + (err as Error).message);
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
        </div>

        <div className="toolbar">
          {editable && (
            <>
              <button onClick={() => setShowSettings(true)}>
                {t('app.program')}
              </button>
              <button onClick={() => exportProgram(program)}>
                {t('app.export')}
              </button>
              <button onClick={() => fileInput.current?.click()}>
                {t('app.import')}
              </button>
              <button
                onClick={() => {
                  if (confirm(t('app.confirmSample')))
                    setProgram(sampleProgram);
                }}
              >
                {t('app.sample')}
              </button>
              <button
                className="danger-ghost"
                onClick={() => {
                  if (confirm(t('app.confirmNew'))) setProgram(emptyProgram());
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
    </div>
  );
}
