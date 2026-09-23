'use client';

export function HoneycombOverlay() {
  return (
    <div
      aria-hidden="true"
      className="pointer-events-none absolute inset-0 overflow-hidden -z-10 select-none"
    >
      {/* Concentrated luminous cyan-blue bloom on the right side */}
      <div className="absolute top-[8%] right-[-5%] w-[680px] h-[680px] rounded-full bg-[radial-gradient(circle_at_center,rgba(56,189,248,0.18)_0%,rgba(103,232,249,0.10)_25%,rgba(11,79,120,0.06)_55%,transparent_75%)] blur-[90px]" />
      
      {/* Secondary subtle ambient node bloom */}
      <div className="absolute top-[45%] right-[15%] w-[420px] h-[420px] rounded-full bg-[radial-gradient(circle_at_center,rgba(56,189,248,0.09)_0%,rgba(11,79,120,0.04)_50%,transparent_70%)] blur-[80px]" />
      
      {/* Left side deep atmospheric base fill */}
      <div className="absolute bottom-[10%] left-[-5%] w-[500px] h-[500px] rounded-full bg-[radial-gradient(circle_at_center,rgba(11,79,120,0.07)_0%,transparent_70%)] blur-[100px]" />

      {/* SVG Geometric Honeycomb Wireframe Accents */}
      <svg
        className="absolute right-0 top-0 w-full max-w-[1200px] h-full opacity-40 mix-blend-screen"
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 1000 900"
        fill="none"
      >
        <defs>
          <pattern
            id="hex-pattern"
            width="120"
            height="104"
            patternUnits="userSpaceOnUse"
            patternTransform="scale(0.85)"
          >
            {/* Hexagon outline */}
            <path
              d="M60 0 L120 34.6 L120 104 L60 138.6 L0 104 L0 34.6 Z"
              stroke="rgba(91, 133, 167, 0.12)"
              strokeWidth="0.75"
              fill="none"
            />
            {/* Inner secondary hexagon link */}
            <path
              d="M60 104 L120 138.6 L120 208 L60 242.6 L0 208 L0 138.6 Z"
              stroke="rgba(91, 133, 167, 0.08)"
              strokeWidth="0.75"
              fill="none"
            />
          </pattern>

          {/* Glowing joint filter */}
          <filter id="cyan-glow" x="-20%" y="-20%" width="140%" height="140%">
            <feGaussianBlur stdDeviation="3" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>

        {/* Base hex pattern across top right */}
        <rect x="250" y="0" width="750" height="900" fill="url(#hex-pattern)" />

        {/* Selected glowing hexagonal segments near the right luminous cluster */}
        <g filter="url(#cyan-glow)">
          {/* Hex 1 */}
          <polygon
            points="760,180 820,214.6 820,284 760,318.6 700,284 700,214.6"
            stroke="#38BDF8"
            strokeWidth="1.25"
            strokeOpacity="0.65"
            fill="rgba(56, 189, 248, 0.04)"
          />
          {/* Hex 2 connected */}
          <polygon
            points="820,284 880,318.6 880,388 820,422.6 760,388 760,318.6"
            stroke="#67E8F9"
            strokeWidth="1.5"
            strokeOpacity="0.8"
            fill="rgba(103, 232, 249, 0.06)"
          />
          {/* Connected bright joints */}
          <circle cx="760" cy="180" r="2.5" fill="#67E8F9" />
          <circle cx="820" cy="214.6" r="2" fill="#38BDF8" />
          <circle cx="760" cy="318.6" r="3" fill="#67E8F9" />
          <circle cx="820" cy="284" r="3.5" fill="#F4F7FB" />
          <circle cx="880" cy="318.6" r="2.5" fill="#67E8F9" />
          <circle cx="820" cy="422.6" r="2" fill="#38BDF8" />
        </g>
      </svg>
    </div>
  );
}
