import { useId } from 'react';

// MedStock app icon: white tile, glossy red + blue rising bars, blue swoosh ring and medical cross.
// Keep in sync with public/favicon.svg.
export default function Logo({ className = 'h-12 w-12' }) {
  const u = useId().replace(/:/g, '');
  const id = (name) => `ms-${name}-${u}`;
  const url = (name) => `url(#${id(name)})`;

  // Swoosh = outer ellipse minus an inner ellipse shifted upward (thick at the bottom, thin at the top).
  const swoosh = 'M6.8 35.7a24.6 9.4 0 1 0 49.2 0a24.6 9.4 0 1 0 -49.2 0Z M9.4 33.8a22.9 7.2 0 1 0 45.8 0a22.9 7.2 0 1 0 -45.8 0Z';

  return (
    <svg viewBox="0 0 64 64" className={className} role="img" aria-label="MedStock">
      <defs>
        <linearGradient id={id('tile')} x1="0" y1="0" x2="0.35" y2="1">
          <stop offset="0" stopColor="#FFFFFF" />
          <stop offset="1" stopColor="#E1E8FB" />
        </linearGradient>
        <linearGradient id={id('red')} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#FF5C4D" />
          <stop offset="0.45" stopColor="#F50A0A" />
          <stop offset="1" stopColor="#A6001C" />
        </linearGradient>
        <linearGradient id={id('blue')} x1="0" y1="0" x2="0.6" y2="1">
          <stop offset="0" stopColor="#2F8CFF" />
          <stop offset="0.5" stopColor="#0B4EE8" />
          <stop offset="1" stopColor="#0026B0" />
        </linearGradient>
        <linearGradient id={id('ring')} x1="0" y1="0" x2="0.3" y2="1">
          <stop offset="0" stopColor="#4FB0FF" />
          <stop offset="0.5" stopColor="#1A66F5" />
          <stop offset="1" stopColor="#0634D6" />
        </linearGradient>
        <linearGradient id={id('cross')} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#3D96FF" />
          <stop offset="1" stopColor="#0D4BE3" />
        </linearGradient>
        <linearGradient id={id('gloss')} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#fff" stopOpacity="0.3" />
          <stop offset="0.55" stopColor="#fff" stopOpacity="0.04" />
          <stop offset="0.55" stopColor="#fff" stopOpacity="0" />
        </linearGradient>
        {/* part of the ring that passes in front of the bars (below its long axis) */}
        <clipPath id={id('front')}>
          <path d="M0 44.7 L64 26.3 L64 64 L0 64 Z" />
        </clipPath>
      </defs>

      <rect width="64" height="64" rx="16" fill={url('tile')} />
      <rect x="0.4" y="0.4" width="63.2" height="63.2" rx="15.6" fill="none" stroke="#fff" strokeWidth="0.8" />

      {/* ring: back half, behind the bars */}
      <g transform="rotate(-16 31.4 35.7)">
        <path d={swoosh} fill={url('ring')} fillRule="evenodd" />
      </g>

      {/* bars */}
      <rect x="17.1" y="28" width="8.1" height="15.3" rx="1.6" fill={url('red')} stroke="#B3001F" strokeOpacity="0.5" strokeWidth="0.4" />
      <rect x="17.1" y="28" width="8.1" height="15.3" rx="1.6" fill={url('gloss')} />
      <rect x="27.4" y="20.7" width="8.4" height="21.6" rx="1.6" fill={url('red')} stroke="#B3001F" strokeOpacity="0.5" strokeWidth="0.4" />
      <rect x="27.4" y="20.7" width="8.4" height="21.6" rx="1.6" fill={url('gloss')} />
      <rect x="37.7" y="11.8" width="7.9" height="38.5" rx="1.6" fill={url('blue')} stroke="#0028A6" strokeOpacity="0.5" strokeWidth="0.4" />
      <rect x="37.7" y="11.8" width="7.9" height="38.5" rx="1.6" fill={url('gloss')} />

      {/* ring: front half, over the bars */}
      <g clipPath={url('front')}>
        <g transform="rotate(-16 31.4 35.7)">
          <path d={swoosh} fill={url('ring')} fillRule="evenodd" stroke="#CFE6FF" strokeOpacity="0.9" strokeWidth="0.5" />
        </g>
      </g>

      {/* medical cross */}
      <g fill={url('cross')}>
        <rect x="50.3" y="16.8" width="3.2" height="8.9" rx="0.7" />
        <rect x="47.45" y="19.65" width="8.9" height="3.2" rx="0.7" />
      </g>
    </svg>
  );
}

// "Med" in red, "Stock" in blue. `onDark` uses a lighter blue so it stays readable on navy.
export function Wordmark({ className = 'text-2xl', onDark = false }) {
  return (
    <span className={`font-extrabold tracking-tight ${className}`}>
      <span className="text-[#F0283A]">Med</span>
      <span className={onDark ? 'text-[#5B85FF]' : 'text-[#1F45C8]'}>Stock</span>
    </span>
  );
}
