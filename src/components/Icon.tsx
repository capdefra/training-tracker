export type IconName = 'today' | 'log' | 'plans' | 'progress' | 'data';

export function Icon({ name }: { name: IconName }) {
  const common = {
    width: 22,
    height: 22,
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 1.8,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
    'aria-hidden': true,
  };
  if (name === 'today') {
    return (
      <svg {...common}>
        <rect x="3.5" y="4.5" width="17" height="16" rx="2" />
        <path d="M3.5 9.5h17M8 3.5v3M16 3.5v3" />
      </svg>
    );
  }
  if (name === 'log') {
    return (
      <svg {...common}>
        <circle cx="12" cy="12" r="8.25" />
        <path d="M12 8v8M8 12h8" />
      </svg>
    );
  }
  if (name === 'plans') {
    return (
      <svg {...common}>
        <path d="M8 4.5h11v15H8a2 2 0 0 1-2-2v-11a2 2 0 0 1 2-2z" />
        <path d="M8 8.5h8M8 12.5h8M8 16.5h5" />
      </svg>
    );
  }
  if (name === 'progress') {
    return (
      <svg {...common}>
        <path d="M4 16.5l5-5 3.5 3.5L20 7.5" />
        <path d="M14.5 7.5H20V13" />
      </svg>
    );
  }
  return (
    <svg {...common}>
      <ellipse cx="12" cy="7" rx="6.5" ry="2.5" />
      <path d="M5.5 7v10c0 1.4 2.9 2.5 6.5 2.5s6.5-1.1 6.5-2.5V7" />
      <path d="M5.5 12c0 1.4 2.9 2.5 6.5 2.5s6.5-1.1 6.5-2.5" />
    </svg>
  );
}
