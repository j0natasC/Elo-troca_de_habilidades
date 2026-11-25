import React from 'react';
import { IonIcon } from '@ionic/react';
import {
  codeSlashOutline,
  colorPaletteOutline,
  restaurantOutline,
  trendingUpOutline,
  musicalNotesOutline,
  pencilOutline,
  megaphoneOutline,
  serverOutline,
} from 'ionicons/icons';
import type { CategorySlug } from '../shared/types';

interface CategoryIconTileProps {
  iconKey: CategorySlug;
  size?: 'sm' | 'md' | 'lg';
}

const ICON_MAP: Record<CategorySlug, string> = {
  programacao: codeSlashOutline,
  desenho: colorPaletteOutline,
  cozinhar: restaurantOutline,
  ilustracao: trendingUpOutline,
  musica: musicalNotesOutline,
  escrita: pencilOutline,
  trafego: megaphoneOutline,
  'banco-de-dados': serverOutline,
};

export const CategoryIconTile: React.FC<CategoryIconTileProps> = ({
  iconKey,
  size = 'md',
}) => {
  const boxClass =
    size === 'sm'
      ? 'w-12 h-12 rounded-xl text-2xl'
      : size === 'lg'
        ? 'w-20 h-20 rounded-2xl text-4xl'
        : 'w-16 h-16 rounded-2xl text-3xl';

  const icon = ICON_MAP[iconKey] ?? codeSlashOutline;

  return (
    <div
      className={`${boxClass} bg-[#77BC43] text-[#111827] flex items-center justify-center shadow-sm shrink-0`}
      aria-hidden="true"
    >
      <IonIcon icon={icon} />
    </div>
  );
};
