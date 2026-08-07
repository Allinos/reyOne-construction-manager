import { useId, useState } from 'react';

// The app's brand mark. If a real logo file is present at /logo.png it is used;
// otherwise a self-contained, on-brand infinity mark is rendered so the UI
// always looks finished. Drop your logo at client/public/logo.png to override.
export default function BrandLogo({ className = 'h-12 w-12' }) {
  const [useImg, setUseImg] = useState(true);
  const gid = useId().replace(/:/g, '');

  if (useImg) {
    return (
      <img
        src="/logo.png"
        alt="Logo"
        className={`${className} object-contain`}
        onError={() => setUseImg(false)}
      />
    );
  }

  return (
    <svg viewBox="0 0 120 120" className={className} role="img" aria-label="Logo">
      <defs>
        <linearGradient id={`g-${gid}`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#FDBA74" />
          <stop offset="55%" stopColor="#FB923C" />
          <stop offset="100%" stopColor="#EA580C" />
        </linearGradient>
      </defs>
      <path
        d="M35,60 C35,41 53,41 60,60 C67,79 85,79 85,60 C85,41 67,41 60,60 C53,79 35,79 35,60 Z"
        fill="none"
        stroke={`url(#g-${gid})`}
        strokeWidth="13"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
