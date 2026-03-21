// uid: unique string per badge instance to namespace SVG gradient IDs
// earned: full color vs locked grey
// level: 1=Study Spark, 2=Study Scholar, 3=Study Master, 4=CCR Champion

export type BadgeLevel = 1 | 2 | 3 | 4;

export const BADGE_META: Record<BadgeLevel, { name: string; points: number; tagline: string }> = {
  1: { name: "Study Spark",    points: 250,  tagline: "First flame lit"       },
  2: { name: "Study Scholar",  points: 500,  tagline: "Knowledge in motion"   },
  3: { name: "Study Master",   points: 750,  tagline: "Command the room"      },
  4: { name: "CCR Champion",   points: 1000, tagline: "Credit earned"         },
};

// ─── Shape helpers ────────────────────────────────────────────────────────────

// Flat-top hexagon, r=32, center 40,40
const HEX = "40,8 67,24 67,56 40,72 13,56 13,24";

// Shield / rounded pentagon
const SHIELD = "M40 8 L66 21 L66 52 Q66 70 40 74 Q14 70 14 52 L14 21 Z";

// 8-pointed star (outer r=32 inner r=13 center 40,40)
const STAR8 =
  "40,8 45,28 63,17 52,35 72,40 52,45 63,63 45,52 40,72 35,52 17,63 28,45 8,40 28,35 17,17 35,28";

// Diamond / rhombus
const DIAMOND = "M40 5 L70 36 L40 75 L10 36 Z";

// ─── Lightning bolt (Badge 1) ─────────────────────────────────────────────────
function LightningIcon({ earned }: { earned: boolean }) {
  return (
    <path
      d="M 45 20 L 31 46 L 41 46 L 35 62 L 49 36 L 39 36 Z"
      fill={earned ? "white" : "#777"}
      opacity={earned ? 0.93 : 0.45}
    />
  );
}

// ─── Open book (Badge 2) ──────────────────────────────────────────────────────
function BookIcon({ earned }: { earned: boolean }) {
  const c = earned ? "white" : "#777";
  const o = earned ? 0.9 : 0.45;
  return (
    <g fill="none" stroke={c} strokeOpacity={o} strokeLinecap="round">
      {/* pages */}
      <path d="M24 22 L40 22 L40 58 L24 58 Z" fill={c} fillOpacity={earned ? 0.15 : 0.08} stroke={c} strokeWidth="1.5" />
      <path d="M40 22 L56 22 L56 58 L40 58 Z" fill={c} fillOpacity={earned ? 0.15 : 0.08} stroke={c} strokeWidth="1.5" />
      {/* spine */}
      <line x1="40" y1="22" x2="40" y2="58" strokeWidth="1.5" />
      {/* lines on left page */}
      <line x1="27" y1="32" x2="37" y2="32" strokeWidth="1.2" />
      <line x1="27" y1="39" x2="37" y2="39" strokeWidth="1.2" />
      <line x1="27" y1="46" x2="37" y2="46" strokeWidth="1.2" />
      {/* lines on right page */}
      <line x1="43" y1="32" x2="53" y2="32" strokeWidth="1.2" />
      <line x1="43" y1="39" x2="53" y2="39" strokeWidth="1.2" />
      <line x1="43" y1="46" x2="53" y2="46" strokeWidth="1.2" />
    </g>
  );
}

// ─── Crown (Badge 3) ──────────────────────────────────────────────────────────
function CrownIcon({ earned }: { earned: boolean }) {
  const c = earned ? "white" : "#777";
  const o = earned ? 0.93 : 0.45;
  return (
    <g opacity={o}>
      <path
        d="M18 55 L18 36 L28 47 L40 23 L52 47 L62 36 L62 55 Z"
        fill={c}
      />
      <rect x="18" y="55" width="44" height="5" rx="2" fill={c} />
      {/* crown jewels */}
      <circle cx="40" cy="23" r="3" fill={earned ? "#FFE066" : "#aaa"} />
      <circle cx="18" cy="36" r="2.5" fill={earned ? "#FFE066" : "#aaa"} />
      <circle cx="62" cy="36" r="2.5" fill={earned ? "#FFE066" : "#aaa"} />
    </g>
  );
}

// ─── Gem / crystal (Badge 4) ──────────────────────────────────────────────────
function GemIcon({ earned }: { earned: boolean }) {
  const c = earned ? "white" : "#777";
  const o = earned ? 0.93 : 0.45;
  return (
    <g opacity={o} fill="none" stroke={c} strokeWidth="1.4" strokeLinejoin="round">
      {/* gem outline */}
      <path d="M28 34 L40 20 L52 34 L52 52 L40 63 L28 52 Z" fill={c} fillOpacity={earned ? 0.18 : 0.1} />
      {/* facet lines */}
      <line x1="28" y1="34" x2="52" y2="34" />
      <line x1="28" y1="34" x2="40" y2="46" />
      <line x1="52" y1="34" x2="40" y2="46" />
      <line x1="40" y1="20" x2="40" y2="46" />
      <line x1="28" y1="52" x2="40" y2="46" />
      <line x1="52" y1="52" x2="40" y2="46" />
    </g>
  );
}

// ─── Lock overlay (locked state) ─────────────────────────────────────────────
function LockOverlay() {
  return (
    <g opacity={0.55}>
      <rect x="30" y="38" width="20" height="16" rx="3" fill="#888" />
      <path d="M34 38 L34 32 C34 25 46 25 46 32 L46 38" fill="none" stroke="#888" strokeWidth="2.5" strokeLinecap="round" />
      <circle cx="40" cy="46" r="2.5" fill="#555" />
    </g>
  );
}

// ─── Main badge component ─────────────────────────────────────────────────────

export function BadgeIcon({
  level,
  earned,
  uid,
}: {
  level: BadgeLevel;
  earned: boolean;
  uid: string;
}) {
  const g = `${uid}g`;
  const s = `${uid}s`;
  const glow = `${uid}glow`;

  // per-badge colour palettes
  const palettes: Record<BadgeLevel, { from: string; mid: string; to: string; glow: string; border: string }> = {
    1: { from: "#F2B56A", mid: "#CD7F32", to: "#8B5210", glow: "#E8963A", border: "#FFD8A8" },
    2: { from: "#E0E0E0", mid: "#B0B0B0", to: "#707070", glow: "#D0D0D0", border: "#FFFFFF" },
    3: { from: "#FFE066", mid: "#DAA520", to: "#9A6E00", glow: "#FFD700", border: "#FFEF99" },
    4: { from: "#C2708A", mid: "#9B6BA5", to: "#5B3A7A", glow: "#B07EC8", border: "#DDB8F0" },
  };

  const pal = palettes[level];
  const dimPal = { from: "#444", mid: "#333", to: "#222", glow: "#333", border: "#555" };
  const p = earned ? pal : dimPal;

  return (
    <svg viewBox="0 0 80 80" className="w-full h-full" aria-hidden>
      <defs>
        <linearGradient id={g} x1="20%" y1="0%" x2="80%" y2="100%">
          <stop offset="0%"   stopColor={p.from} />
          <stop offset="50%"  stopColor={p.mid}  />
          <stop offset="100%" stopColor={p.to}   />
        </linearGradient>
        <linearGradient id={s} x1="0%" y1="0%" x2="70%" y2="70%">
          <stop offset="0%"   stopColor="white" stopOpacity={earned ? 0.38 : 0.08} />
          <stop offset="100%" stopColor="white" stopOpacity="0" />
        </linearGradient>
        {earned && (
          <filter id={glow} x="-25%" y="-25%" width="150%" height="150%">
            <feGaussianBlur stdDeviation="3.5" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        )}
      </defs>

      {/* Outer glow ring */}
      {earned && level === 1 && <polygon points={HEX} fill="none" stroke={pal.glow} strokeWidth="1.5" strokeOpacity="0.35" transform="scale(1.08) translate(-3,-3)" />}
      {earned && level === 2 && <path d={SHIELD} fill="none" stroke={pal.glow} strokeWidth="1.5" strokeOpacity="0.35" transform="scale(1.07) translate(-2.6,-2.6)" />}
      {earned && level === 3 && <polygon points={STAR8} fill="none" stroke={pal.glow} strokeWidth="1" strokeOpacity="0.3" transform="scale(1.06) translate(-2.3,-2.3)" />}
      {earned && level === 4 && <path d={DIAMOND} fill="none" stroke={pal.glow} strokeWidth="1.5" strokeOpacity="0.4" transform="scale(1.07) translate(-2.6,-2.6)" />}

      {/* Main shape */}
      {level === 1 && (
        <polygon points={HEX} fill={`url(#${g})`} filter={earned ? `url(#${glow})` : undefined} />
      )}
      {level === 2 && (
        <path d={SHIELD} fill={`url(#${g})`} filter={earned ? `url(#${glow})` : undefined} />
      )}
      {level === 3 && (
        <polygon points={STAR8} fill={`url(#${g})`} filter={earned ? `url(#${glow})` : undefined} />
      )}
      {level === 4 && (
        <path d={DIAMOND} fill={`url(#${g})`} filter={earned ? `url(#${glow})` : undefined} />
      )}

      {/* Inner border */}
      {level === 1 && <polygon points="40,12 63,25 63,55 40,68 17,55 17,25" fill="none" stroke={p.border} strokeWidth="1.4" strokeOpacity="0.5" />}
      {level === 2 && <path d="M40 12 L62 23 L62 50 Q62 66 40 70 Q18 66 18 50 L18 23 Z" fill="none" stroke={p.border} strokeWidth="1.4" strokeOpacity="0.5" />}
      {level === 3 && <polygon points="40,13 44,29 59,20 51,33 68,40 51,47 59,60 44,51 40,67 36,51 21,60 29,47 12,40 29,33 21,20 36,29" fill="none" stroke={p.border} strokeWidth="1" strokeOpacity="0.45" />}
      {level === 4 && <path d="M40 12 L65 38 L40 70 L15 38 Z" fill="none" stroke={p.border} strokeWidth="1.4" strokeOpacity="0.5" />}

      {/* Shine highlight */}
      {level === 1 && <polygon points="40,12 63,25 51.5,12" fill={`url(#${s})`} />}
      {level === 2 && <path d="M40 12 L62 23 L51 12 Z" fill={`url(#${s})`} />}
      {level === 3 && <polygon points="40,13 44,29 36,29" fill={`url(#${s})`} />}
      {level === 4 && <path d="M40 12 L65 38 L52.5 12 Z" fill={`url(#${s})`} />}

      {/* Badge icon */}
      {level === 1 && <LightningIcon earned={earned} />}
      {level === 2 && <BookIcon earned={earned} />}
      {level === 3 && <CrownIcon earned={earned} />}
      {level === 4 && <GemIcon earned={earned} />}

      {/* Lock overlay for unearned */}
      {!earned && <LockOverlay />}
    </svg>
  );
}
