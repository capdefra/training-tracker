import { useEffect, useId, useRef, type MouseEvent } from 'react';
import { ExerciseDemo } from './ExerciseDemo';
import type { SessionPreviewModel } from '../lib/preview';

export function SessionPreview({
  model,
  onClose,
  onStart,
}: {
  model: SessionPreviewModel | null;
  onClose: () => void;
  onStart: (() => void) | null;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const titleId = useId();

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (model && !dialog.open) dialog.showModal();
    if (!model && dialog.open) dialog.close();
  }, [model]);

  useEffect(() => {
    const dialog = dialogRef.current;
    return () => {
      if (dialog?.open) dialog.close();
    };
  }, []);

  function requestClose() {
    const dialog = dialogRef.current;
    if (dialog?.open) dialog.close();
    else onClose();
  }

  function onDialogClick(event: MouseEvent<HTMLDialogElement>) {
    const rect = event.currentTarget.getBoundingClientRect();
    const inside = event.clientX >= rect.left && event.clientX <= rect.right && event.clientY >= rect.top && event.clientY <= rect.bottom;
    if (!inside) requestClose();
  }

  return (
    <dialog
      ref={dialogRef}
      className="form-sheet preview-sheet"
      aria-labelledby={titleId}
      onClose={onClose}
      onClick={onDialogClick}
    >
      {model ? (
        <>
          <div className="preview-sheet-top">
            <div className="form-sheet-head">
              <div>
                <p className="kicker">
                  {model.dateLabel}
                  {model.phaseName ? ` · ${model.phaseName}` : ''}
                  {model.kind === 'run' ? ' · Run' : ' · Strength'}
                </p>
                <h2 id={titleId}>{model.title}</h2>
              </div>
              <button type="button" className="icon-btn" aria-label="Close preview" onClick={requestClose}>
                ×
              </button>
            </div>
            <div className="preview-actions">
              {model.kind === 'strength' && onStart ? (
                <button type="button" className="btn primary" onClick={onStart}>
                  Start session
                </button>
              ) : null}
              <button type="button" className="btn ghost" onClick={requestClose}>
                Close
              </button>
            </div>
            {model.phaseNotes ? <p className="preview-phase">{model.phaseNotes}</p> : null}
            {model.runLine && !model.phaseNotes ? <p className="preview-phase">{model.runLine}</p> : null}
          </div>
          {model.exercises.length > 0 ? (
            <ul className="preview-list">
              {model.exercises.map((exercise) => (
                <li key={exercise.name} className="preview-row">
                  <div className="preview-row-head">
                    <h3>{exercise.name}</h3>
                    {exercise.hasDemo ? (
                      <ExerciseDemo name={exercise.name} />
                    ) : (
                      <span className="form-link is-off" aria-disabled="true">
                        Form
                        <span className="sr-only"> unavailable for {exercise.name}</span>
                      </span>
                    )}
                  </div>
                  <p className="preview-plan">{exercise.planLabel}</p>
                  <p className="preview-target">{exercise.targetLabel}</p>
                  <p className="preview-last">{exercise.lastLabel || 'Last: no log yet'}</p>
                  {exercise.notes ? <p className="preview-notes">{exercise.notes}</p> : null}
                </li>
              ))}
            </ul>
          ) : null}
        </>
      ) : null}
    </dialog>
  );
}
