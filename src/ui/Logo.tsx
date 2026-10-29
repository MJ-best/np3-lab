/** Same artwork as the app icon (scripts/make-icons.mjs). */
export function Logo() {
  return (
    <svg viewBox="0 0 32 32" width="28" height="28" aria-hidden="true">
      <defs>
        <linearGradient id="np3-tile" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stop-color="#F2B200" />
          <stop offset=".75" stop-color="#FFD600" />
        </linearGradient>
        <radialGradient id="np3-dome" cx="16" cy="27.2" r="18" gradientUnits="userSpaceOnUse">
          <stop offset=".25" stop-color="#FFCD00" />
          <stop offset="1" stop-color="#FFFCE8" />
        </radialGradient>
        <clipPath id="np3-clip">
          <rect width="32" height="32" rx="7.2" />
        </clipPath>
      </defs>
      <g clip-path="url(#np3-clip)">
        <rect width="32" height="32" fill="url(#np3-tile)" />
        <ellipse cx="16" cy="28.35" rx="18.25" ry="17.48" fill="url(#np3-dome)" />
        <ellipse cx="12.73" cy="21.73" rx="2.17" ry="2.95" fill="#161616" transform="rotate(-4.6 12.73 21.73)" />
        <ellipse cx="19.34" cy="20.34" rx="2.17" ry="2.95" fill="#161616" transform="rotate(4.6 19.34 20.34)" />
      </g>
    </svg>
  );
}
