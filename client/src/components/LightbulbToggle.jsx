import React from 'react';

export default function LightbulbToggle({
  isOn,
  onToggle,
  size = 28,
  titleOn = 'Switch to Light Mode',
  titleOff = 'Switch to Dark Mode',
}) {
  return (
    <button
      className={`bulb-btn${isOn ? ' on' : ''}`}
      onClick={onToggle}
      aria-pressed={isOn}
      aria-label={isOn ? titleOn : titleOff}
      title={isOn ? titleOn : titleOff}
      type="button"
      style={{ width: size + 8, height: size + 8 }}
    >
      <svg
        width={size}
        height={size}
        viewBox="0 0 64 64"
        role="img"
        aria-hidden="true"
      >
        {/* bulb glass */}
        <circle className="bulb-glass" cx="32" cy="26" r="16" />
        {/* filament */}
        <path className="bulb-filament" d="M24 26c4 0 4 6 8 6s4-6 8-6" fill="none" strokeWidth="2" />
        {/* base */}
        <rect className="bulb-base" x="26" y="40" width="12" height="8" rx="2" />
        <rect className="bulb-socket" x="24" y="48" width="16" height="6" rx="2" />
        {/* rays (show only when on) */}
        <g className="bulb-rays">
          <line x1="32" y1="6"  x2="32" y2="14" />
          <line x1="32" y1="38" x2="32" y2="46" />
          <line x1="14" y1="26" x2="22" y2="26" />
          <line x1="42" y1="26" x2="50" y2="26" />
          <line x1="20" y1="14" x2="25" y2="19" />
          <line x1="44" y1="14" x2="39" y2="19" />
          <line x1="20" y1="38" x2="25" y2="33" />
          <line x1="44" y1="38" x2="39" y2="33" />
        </g>
      </svg>
    </button>
  );
}
