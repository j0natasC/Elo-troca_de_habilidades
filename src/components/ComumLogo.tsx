import React from 'react';

interface ComumLogoProps {
  size?: 'sm' | 'md' | 'lg';
  showWordmark?: boolean;
  className?: string;
}

export const ComumLogo: React.FC<ComumLogoProps> = ({
  size = 'lg',
  showWordmark = true,
  className = '',
}) => {
  const iconDimensions =
    size === 'sm' ? 'w-12 h-12' : size === 'md' ? 'w-16 h-16' : 'w-28 h-28';

  return (
    <div className={`inline-flex flex-col items-center select-none ${className}`}>
      <svg
        viewBox="0 0 120 120"
        className={iconDimensions}
        role="img"
        aria-label="Logotipo ELO+"
      >
        {/* Outer green circular arc */}
        <path
          d="M 28 92 A 46 46 0 1 0 74 16"
          fill="none"
          stroke="#51A644"
          strokeWidth="6.5"
          strokeLinecap="round"
        />
        {/* Navy left arc & collaborative speech link */}
        <path
          d="M 55 15 A 45 45 0 0 0 21 83"
          fill="none"
          stroke="#1B3C59"
          strokeWidth="6.5"
          strokeLinecap="round"
        />
        <circle cx="38" cy="64" r="20" fill="#1B3C59" />
        <path d="M 22 76 L 18 89 L 31 81 Z" fill="#1B3C59" />
        <path
          d="M 30 56 C 30 34, 48 22, 57 18"
          fill="none"
          stroke="#1B3C59"
          strokeWidth="10"
          strokeLinecap="round"
        />
        <circle cx="38" cy="64" r="10.5" fill="#FFFFFF" className="dark:fill-slate-900" />

        {/* Top green speech bubble */}
        <ellipse cx="64" cy="27" rx="16" ry="13" fill="#85BF4B" />
        <path d="M 55 37 L 50 45 L 62 39 Z" fill="#85BF4B" />
        <line x1="56" y1="22" x2="72" y2="22" stroke="#FFFFFF" strokeWidth="2.5" strokeLinecap="round" />
        <line x1="56" y1="27" x2="70" y2="27" stroke="#FFFFFF" strokeWidth="2.5" strokeLinecap="round" />
        <line x1="56" y1="32" x2="66" y2="32" stroke="#FFFFFF" strokeWidth="2.5" strokeLinecap="round" />

        {/* Yellow lightbulb */}
        <path
          d="M 80 46 C 69 46, 62 54, 62 63 C 62 69, 66 74, 70 78 L 70 84 L 90 84 L 90 78 C 94 74, 98 69, 98 63 C 98 54, 91 46, 80 46 Z"
          fill="#FFF8DF"
          stroke="#F2AE2E"
          strokeWidth="4.5"
          strokeLinejoin="round"
        />
        <path
          d="M 75 76 L 75 63 M 85 76 L 85 63 M 75 64 C 77 61, 83 61, 85 64"
          fill="none"
          stroke="#F2AE2E"
          strokeWidth="2.8"
          strokeLinecap="round"
        />
        <line x1="72" y1="89" x2="88" y2="89" stroke="#51A644" strokeWidth="3.5" strokeLinecap="round" />
        <line x1="74" y1="94" x2="86" y2="94" stroke="#51A644" strokeWidth="3.5" strokeLinecap="round" />
      </svg>

      {showWordmark && (
        <div className="mt-2 font-display text-2xl sm:text-3xl tracking-tight text-[#1B3C59] dark:text-slate-100 leading-none flex items-baseline">
          <span className="font-extrabold">ELO</span>
          <span className="font-extrabold text-[#51A644] dark:text-[#85BF4B]">+</span>
        </div>
      )}
    </div>
  );
};
