import { useState } from 'react';
import type { FormEvent } from 'react';
import { LIMITS, PROJECT_COLORS } from '../domain/constants';
import type { Project, ProjectInput } from '../domain/types';
import { hasErrors, validateProject } from '../domain/validation';
import type { FieldErrors } from '../domain/validation';
import { useStore } from '../state/store';
import { Dialog } from './ui/Dialog';
import { Field } from './ui/Field';
import { Icon } from './ui/Icon';

interface Props {
  /** Omit to create a new project. */
  project?: Project;
  onClose: (saved?: Project) => void;
}

export function ProjectDialog({ project, onClose }: Props) {
  const { actions, data } = useStore();
  const [values, setValues] = useState<ProjectInput>({
    name: project?.name ?? '',
    description: project?.description ?? '',
    color: project?.color ?? PROJECT_COLORS[data.projects.length % PROJECT_COLORS.length],
  });
  const [errors, setErrors] = useState<FieldErrors<ProjectInput>>({});
  const [saving, setSaving] = useState(false);
  const editing = !!project;

  async function submit(e: FormEvent) {
    e.preventDefault();
    const found = validateProject(values);
    setErrors(found);
    if (hasErrors(found)) {
      // Move focus to the first problem so keyboard and screen reader users land on it.
      requestAnimationFrame(() => document.querySelector<HTMLElement>('dialog [aria-invalid="true"]')?.focus());
      return;
    }
    setSaving(true);
    const saved = project ? await actions.updateProject(project.id, values) : await actions.createProject(values);
    setSaving(false);
    if (saved) onClose(saved);
  }

  return (
    <Dialog
      title={editing ? 'Edit project' : 'New project'}
      onClose={() => onClose()}
      footer={
        <>
          <button type="button" className="btn" onClick={() => onClose()}>
            Cancel
          </button>
          <button type="submit" form="project-form" className="btn btn-primary" disabled={saving}>
            {editing ? 'Save changes' : 'Create project'}
          </button>
        </>
      }
    >
      <form id="project-form" onSubmit={submit} noValidate className="form-stack">
        <Field label="Name" required error={errors.name} counter={`${values.name.length}/${LIMITS.projectName}`}>
          {(p) => (
            <input
              {...p}
              className="input"
              data-autofocus=""
              value={values.name}
              maxLength={LIMITS.projectName + 20}
              onChange={(e) => setValues({ ...values, name: e.target.value })}
              autoComplete="off"
            />
          )}
        </Field>
        <Field
          label="Description"
          error={errors.description}
          hint="Optional. A sentence about what this project is for."
          counter={`${values.description.length}/${LIMITS.projectDescription}`}
        >
          {(p) => (
            <textarea
              {...p}
              className="input textarea"
              rows={3}
              value={values.description}
              onChange={(e) => setValues({ ...values, description: e.target.value })}
            />
          )}
        </Field>
        <fieldset className="fieldset">
          <legend className="field-label">Colour</legend>
          <div className="swatches" role="radiogroup" aria-label="Project colour">
            {PROJECT_COLORS.map((c, i) => (
              <label key={c} className="swatch" style={{ background: c }}>
                <input
                  type="radio"
                  name="project-color"
                  value={c}
                  checked={values.color === c}
                  onChange={() => setValues({ ...values, color: c })}
                  className="visually-hidden"
                  aria-label={`Colour ${i + 1} of ${PROJECT_COLORS.length}`}
                />
                {values.color === c && <Icon name="check" size={16} />}
              </label>
            ))}
          </div>
        </fieldset>
        {editing && <p className="field-hint">The project key ({project.key}) stays the same so existing issue references keep working.</p>}
      </form>
    </Dialog>
  );
}
