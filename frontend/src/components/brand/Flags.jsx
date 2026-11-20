// Inline SVG flags (Windows does not render flag emoji).

export function FlagKH({ className = '' }) {
  return (
    <svg viewBox="0 0 60 40" className={className} aria-hidden="true">
      <rect width="60" height="40" fill="#032EA1" />
      <rect y="10" width="60" height="20" fill="#E00025" />
      {/* simplified Angkor Wat */}
      <g fill="#fff">
        <rect x="16" y="26" width="28" height="2" />
        <rect x="18" y="23.5" width="24" height="2.5" />
        <path d="M28 23.5 L28 18 L29 16.5 L29.6 13 L30 11 L30.4 13 L31 16.5 L32 18 L32 23.5 Z" />
        <path d="M22.5 23.5 L22.5 19.5 L23.3 18.3 L23.7 15.5 L24 14 L24.3 15.5 L24.7 18.3 L25.5 19.5 L25.5 23.5 Z" />
        <path d="M34.5 23.5 L34.5 19.5 L35.3 18.3 L35.7 15.5 L36 14 L36.3 15.5 L36.7 18.3 L37.5 19.5 L37.5 23.5 Z" />
        <path d="M18.5 23.5 L18.5 21 L19.2 20 L19.5 18 L19.8 20 L20.5 21 L20.5 23.5 Z" />
        <path d="M39.5 23.5 L39.5 21 L40.2 20 L40.5 18 L40.8 20 L41.5 21 L41.5 23.5 Z" />
      </g>
    </svg>
  );
}

export function FlagGB({ className = '' }) {
  return (
    <svg viewBox="0 0 60 30" className={className} preserveAspectRatio="none" aria-hidden="true">
      <clipPath id="gb-t">
        <path d="M30,15 h30 v15 z v15 h-30 z h-30 v-15 z v-15 h30 z" />
      </clipPath>
      <path d="M0,0 v30 h60 v-30 z" fill="#012169" />
      <path d="M0,0 L60,30 M60,0 L0,30" stroke="#fff" strokeWidth="6" />
      <path d="M0,0 L60,30 M60,0 L0,30" clipPath="url(#gb-t)" stroke="#C8102E" strokeWidth="4" />
      <path d="M30,0 v30 M0,15 h60" stroke="#fff" strokeWidth="10" />
      <path d="M30,0 v30 M0,15 h60" stroke="#C8102E" strokeWidth="6" />
    </svg>
  );
}

export const LANGS = [
  { code: 'km', label: 'ភាសាខ្មែរ', Flag: FlagKH },
  { code: 'en', label: 'English', Flag: FlagGB },
];
