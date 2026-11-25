import React from 'react';

interface UserAvatarProps {
  src?: string | null;
  name: string;
  className?: string;
  textClassName?: string;
}

function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return 'E+';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0] ?? ''}${parts[parts.length - 1][0] ?? ''}`.toUpperCase();
}

export const UserAvatar: React.FC<UserAvatarProps> = ({
  src,
  name,
  className = 'w-10 h-10 rounded-full',
  textClassName = 'text-sm',
}) => {
  const cleanSrc = typeof src === 'string' ? src.trim() : '';

  if (cleanSrc) {
    return (
      <img
        src={cleanSrc}
        alt={name}
        referrerPolicy="no-referrer"
        className={`object-cover ${className}`}
      />
    );
  }

  return (
    <div
      role="img"
      aria-label={name}
      className={`bg-[#1B3C59] text-white font-display font-bold flex items-center justify-center select-none ${className}`}
    >
      <span className={textClassName}>{getInitials(name)}</span>
    </div>
  );
};
