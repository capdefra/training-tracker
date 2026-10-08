import { useEffect, useId, useRef, useState, type MouseEvent } from 'react';
import { demoAssetUrl, findDemo, FORM_LIBRARY, type ExerciseDemo as Demo } from '../lib/demos';

export function ExerciseDemo({ name, className }: { name: string; className?: string }) {
  const demo = findDemo(name);
  const dialogRef = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const [open, setOpen] = useState(false);
  const [failedClip, setFailedClip] = useState<string | null>(null);
  const [reduceMotion, setReduceMotion] = useState(false);
  const failed = failedClip === demo?.clip;

  useEffect(() => {
    const dialog = dialogRef.current;
    return () => {
      if (dialog?.open) dialog.close();
    };
  }, []);

  useEffect(() => {
    const media = window.matchMedia('(prefers-reduced-motion: reduce)');
    const apply = () => setReduceMotion(media.matches);
    apply();
    media.addEventListener('change', apply);
    return () => media.removeEventListener('change', apply);
  }, []);

  if (!demo) return null;

  function show() {
    const dialog = dialogRef.current;
    if (!dialog || dialog.open) return;
    setOpen(true);
    dialog.showModal();
  }

  function onDialogClick(event: MouseEvent<HTMLDialogElement>) {
    const rect = event.currentTarget.getBoundingClientRect();
    const inside = event.clientX >= rect.left && event.clientX <= rect.right && event.clientY >= rect.top && event.clientY <= rect.bottom;
    if (!inside) event.currentTarget.close();
  }

  return (
    <>
      <button type="button" className={className ? `form-link ${className}` : 'form-link'} onClick={show} title={`Play the ${name} form clip`}>
        Form
        <span className="sr-only"> for {name}</span>
      </button>
      <dialog
        ref={dialogRef}
        className="form-sheet"
        aria-labelledby={titleId}
        onClose={() => setOpen(false)}
        onClick={onDialogClick}
      >
        <div className="form-sheet-head">
          <div>
            <p className="kicker">Form</p>
            <h2 id={titleId}>{name}</h2>
            {demo.source === 'wger' && demo.title !== name ? <p className="muted fine">{demo.title}</p> : null}
          </div>
          <button type="button" className="icon-btn" aria-label="Close form clip" onClick={() => dialogRef.current?.close()}>
            ×
          </button>
        </div>
        <div className="form-stage">
          {failed ? <p className="form-stage-note">This clip didn’t load.</p> : <Clip demo={demo} active={open} reduceMotion={reduceMotion} onError={() => setFailedClip(demo.clip)} />}
        </div>
        <div className="form-sheet-foot">
          {demo.source === 'placeholder' ? (
            <p className="muted fine">
              <span className="badge warn">Placeholder</span> Stick-figure stand-in, not a filmed demo.
            </p>
          ) : (
            <p className="muted fine">{demo.credit}</p>
          )}
          <p className="form-sheet-more">
            <a className="text-link" href={demo.href} target="_blank" rel="noopener noreferrer">
              Learn more on {FORM_LIBRARY.name}
              <span className="sr-only">, opens in a new tab</span>
            </a>
          </p>
        </div>
      </dialog>
    </>
  );
}

function Clip({
  demo,
  active,
  reduceMotion,
  onError,
}: {
  demo: Demo;
  active: boolean;
  reduceMotion: boolean;
  onError: () => void;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const url = demoAssetUrl(demo.clip, import.meta.env.BASE_URL);
  const video = /\.(webm|mp4)$/i.test(demo.clip);

  useEffect(() => {
    const element = videoRef.current;
    if (!element) return;
    element.muted = true;
    if (!active || reduceMotion) {
      element.pause();
      return;
    }
    void element.play().catch(() => {});
  }, [active, reduceMotion, url]);

  if (!video) {
    if (!active) return null;
    return <img src={url} alt="" onError={onError} />;
  }

  return (
    <video
      ref={videoRef}
      src={active ? url : undefined}
      muted
      playsInline
      loop={!reduceMotion}
      autoPlay={active && !reduceMotion}
      controls
      controlsList="nodownload"
      disablePictureInPicture
      preload={active ? 'auto' : 'none'}
      onError={() => {
        if (active) onError();
      }}
    />
  );
}
