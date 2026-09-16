/**
 * SVG faces for the response-to-name progress card.
 * "Looked away" = gray, pupils shifted to side, flat mouth, muted.
 * "Looks at you" = brand purple pupils, smile, dotted gaze-line to a rose heart.
 *
 * Used on both screen and PDF (inline SVG for html2canvas compatibility).
 */

const BRAND = '#6260D6';
const ROSE = '#E76F8E';

export function FaceLookingAway({ size = 72 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 72 72" fill="none" xmlns="http://www.w3.org/2000/svg">
      {/* Head */}
      <circle cx="36" cy="36" r="30" fill="#F0F0F5" stroke="#D4D4DC" strokeWidth="2" />
      {/* Left eye */}
      <ellipse cx="24" cy="32" rx="5" ry="5.5" fill="white" stroke="#D4D4DC" strokeWidth="1.5" />
      <circle cx="21" cy="32" r="2.5" fill="#B0B0BC" />
      {/* Right eye */}
      <ellipse cx="48" cy="32" rx="5" ry="5.5" fill="white" stroke="#D4D4DC" strokeWidth="1.5" />
      <circle cx="45" cy="32" r="2.5" fill="#B0B0BC" />
      {/* Flat mouth */}
      <path d="M28 46 L44 46" stroke="#C8C8D4" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

export function FaceLookingAtYou({ size = 72 }: { size?: number }) {
  return (
    <svg width={size} height={size + 8} viewBox="0 0 72 80" fill="none" xmlns="http://www.w3.org/2000/svg">
      {/* Head */}
      <circle cx="36" cy="36" r="30" fill="#F5F3FF" stroke={BRAND} strokeWidth="2" />
      {/* Left eye */}
      <ellipse cx="24" cy="32" rx="5" ry="5.5" fill="white" stroke={BRAND} strokeWidth="1.5" strokeOpacity="0.4" />
      <circle cx="24" cy="32" r="2.8" fill={BRAND} />
      <circle cx="25" cy="31" r="1" fill="white" />
      {/* Right eye */}
      <ellipse cx="48" cy="32" rx="5" ry="5.5" fill="white" stroke={BRAND} strokeWidth="1.5" strokeOpacity="0.4" />
      <circle cx="48" cy="32" r="2.8" fill={BRAND} />
      <circle cx="49" cy="31" r="1" fill="white" />
      {/* Smile */}
      <path d="M28 44 Q36 52 44 44" stroke={BRAND} strokeWidth="2" strokeLinecap="round" fill="none" />
      {/* Dotted gaze line down to heart */}
      <line x1="36" y1="68" x2="36" y2="74" stroke={ROSE} strokeWidth="1.5" strokeDasharray="2 2" />
      {/* Heart */}
      <path
        d="M36 80 C36 80 30 74 30 71.5 C30 70 31.5 68.5 33 68.5 C34 68.5 35 69 36 70 C37 69 38 68.5 39 68.5 C40.5 68.5 42 70 42 71.5 C42 74 36 80 36 80Z"
        fill={ROSE}
      />
    </svg>
  );
}
