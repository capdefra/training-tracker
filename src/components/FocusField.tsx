import { useState } from 'react';

const SUGGESTED = ['Legs', 'Balance', 'Cardio', 'Strength', 'Core', 'Mobility'];

export function FocusField({ value, onChange }: { value: string[]; onChange: (next: string[]) => void }) {
  const [custom, setCustom] = useState('');
  const extras = value.filter((tag) => !SUGGESTED.includes(tag));

  function toggle(tag: string) {
    onChange(value.includes(tag) ? value.filter((item) => item !== tag) : [...value, tag]);
  }

  function addCustom() {
    const label = custom.trim();
    if (!label) return;
    if (!value.some((item) => item.toLowerCase() === label.toLowerCase())) onChange([...value, label]);
    setCustom('');
  }

  return (
    <div className="field">
      <span>Focus</span>
      <div className="chips">
        {[...SUGGESTED, ...extras].map((tag) => (
          <button key={tag} type="button" className={value.includes(tag) ? 'chip on' : 'chip'} onClick={() => toggle(tag)}>
            {tag}
          </button>
        ))}
      </div>
      <div className="inline-add">
        <input
          value={custom}
          onChange={(event) => setCustom(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter') {
              event.preventDefault();
              addCustom();
            }
          }}
          placeholder="Add a focus"
          aria-label="Custom focus"
        />
        <button type="button" className="btn ghost small" onClick={addCustom}>
          Add
        </button>
      </div>
    </div>
  );
}
