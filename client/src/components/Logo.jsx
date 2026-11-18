import { useId } from 'react';

// MedStock app icon: white rounded tile, red + blue rising bars, blue orbit ring and medical cross.
// Keep in sync with public/favicon.svg.
export default function Logo({ className = 'h-12 w-12' }) {
  const id = useId().replace(/:/g, '');
  const tile = `ms-tile-${id}`;
  const red = `ms-red-${id}`;
  const blue = `ms-blue-${id}`;
  return (
    <svg viewBox="0 0 64 64" className={className} role="img" aria-label="MedStock">
      <defs>
        <linearGradient id={tile} x1="0" y1="0" x2="0.4" y2="1">
          <stop offset="0" stopColor="#FFFFFF" />
          <stop offset="1" stopColor="#E4E9F7" />
        </linearGradient>
        <linearGradient id={red} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#FF2B3D" />
          <stop offset="1" stopColor="#C8102E" />
        </linearGradient>
        <linearGradient id={blue} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#2F55D8" />
          <stop offset="1" stopColor="#1A2F9A" />
        </linearGradient>
      </defs>
      <rect width="64" height="64" rx="16" fill={`url(#${tile})`} />
      {/* back half of the ring, behind the bars */}
      <path d="M12.74 46.24 A19 6.5 -16 0 1 49.26 35.76" fill="none" stroke="#1F45C8" strokeOpacity="0.3" strokeWidth="2.6" strokeLinecap="round" />
      <rect x="18" y="33" width="6.5" height="15" rx="1" fill={`url(#${red})`} />
      <rect x="27" y="26" width="6.5" height="22" rx="1" fill={`url(#${red})`} />
      <rect x="36" y="15" width="6.5" height="36" rx="1" fill={`url(#${blue})`} />
      {/* front half of the ring */}
      <path d="M49.26 35.76 A19 6.5 -16 0 1 12.74 46.24" fill="none" stroke="#1F45C8" strokeWidth="3.6" strokeLinecap="round" />
      {/* medical cross */}
      <path d="M46.5 21.5h2.4v3h3v2.4h-3v3h-2.4v-3h-3v-2.4h3z" fill="#1F45C8" />
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
