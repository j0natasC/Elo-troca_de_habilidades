import React, { useRef, useState } from 'react';
import { IonIcon, IonModal } from '@ionic/react';
import {
  addOutline,
  arrowBackOutline,
  cameraOutline,
  closeOutline,
  createOutline,
  ellipsisHorizontal,
  locationOutline,
  settingsOutline,
  star,
  starOutline,
  trashOutline,
} from 'ionicons/icons';
import { CategoryIconTile } from './CategoryIconTile';
import { UserAvatar } from './UserAvatar';
import type {
  AttendanceMode,
  CategoryItem,
  CategorySlug,
  SkillItem,
  UserProfile,
} from '../shared/types';

function readAndResizeImage(file: File, maxDimension: number): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Não foi possível ler o arquivo de imagem.'));
    reader.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error('Formato de imagem inválido.'));
      img.onload = () => {
        const scale = Math.min(1, maxDimension / Math.max(img.width, img.height));
        const width = Math.max(1, Math.round(img.width * scale));
        const height = Math.max(1, Math.round(img.height * scale));
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          resolve(String(reader.result));
          return;
        }
        ctx.drawImage(img, 0, 0, width, height);
        resolve(canvas.toDataURL('image/jpeg', 0.72));
      };
      img.src = String(reader.result);
    };
    reader.readAsDataURL(file);
  });
}

interface ProfileViewProps {
  user: UserProfile;
  categories: CategoryItem[];
  onBack: () => void;
  onOpenSettings: () => void;
  onUpdateProfileInfo: (payload: {
    fullName: string;
    headline: string;
    locationLabel: string;
    bio: string;
  }) => Promise<void>;
  onAddSkill: (payload: {
    name: string;
    categoryId: CategorySlug;
    level: SkillItem['level'];
    mode: AttendanceMode;
    description: string;
  }) => Promise<void>;
  onRemoveSkill: (skillId: string) => Promise<void>;
  onUpdateDesiredSkills: (desiredSkills: string[]) => Promise<void>;
  onUpdatePhotos: (payload: { avatarUrl?: string; coverUrl?: string }) => Promise<void>;
  onAddWork: (payload: { title: string; category: string; description: string }) => Promise<void>;
}

export const ProfileView: React.FC<ProfileViewProps> = ({
  user,
  categories,
  onBack,
  onOpenSettings,
  onUpdateProfileInfo,
  onAddSkill,
  onRemoveSkill,
  onUpdateDesiredSkills,
  onUpdatePhotos,
  onAddWork,
}) => {
  const avatarInputRef = useRef<HTMLInputElement>(null);
  const coverInputRef = useRef<HTMLInputElement>(null);

  const [editModalOpen, setEditModalOpen] = useState(false);
  const [editFullName, setEditFullName] = useState(user.fullName);
  const [editHeadline, setEditHeadline] = useState(user.headline);
  const [editLocation, setEditLocation] = useState(user.locationLabel);
  const [editBio, setEditBio] = useState(user.bio);

  const [skillModalOpen, setSkillModalOpen] = useState(false);
  const [skillName, setSkillName] = useState('');
  const [skillCategory, setSkillCategory] = useState<CategorySlug>('programacao');
  const [skillLevel, setSkillLevel] = useState<SkillItem['level']>('Intermediário');
  const [skillMode, setSkillMode] = useState<AttendanceMode>('Presencial e Remoto');
  const [skillDesc, setSkillDesc] = useState('');

  const [desiredInput, setDesiredInput] = useState('');

  const [workModalOpen, setWorkModalOpen] = useState(false);
  const [workTitle, setWorkTitle] = useState('');
  const [workCategory, setWorkCategory] = useState('Programação');
  const [workDesc, setWorkDesc] = useState('');
  const [saving, setSaving] = useState(false);

  const handlePhotoFileChange = async (
    field: 'avatarUrl' | 'coverUrl',
    e: React.ChangeEvent<HTMLInputElement>,
  ) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    const dataUrl = await readAndResizeImage(file, field === 'avatarUrl' ? 360 : 800);
    await onUpdatePhotos({ [field]: dataUrl });
  };

  const openEditProfileModal = () => {
    setEditFullName(user.fullName);
    setEditHeadline(user.headline);
    setEditLocation(user.locationLabel);
    setEditBio(user.bio);
    setEditModalOpen(true);
  };

  const handleSaveProfileInfo = async (e: React.FormEvent) => {
    e.preventDefault();
    if (editFullName.trim().length < 2) return;
    setSaving(true);
    try {
      await onUpdateProfileInfo({
        fullName: editFullName.trim(),
        headline: editHeadline.trim(),
        locationLabel: editLocation.trim(),
        bio: editBio.trim(),
      });
      setEditModalOpen(false);
    } finally {
      setSaving(false);
    }
  };

  const handleSaveSkill = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!skillName.trim()) return;
    setSaving(true);
    try {
      await onAddSkill({
        name: skillName.trim(),
        categoryId: skillCategory,
        level: skillLevel,
        mode: skillMode,
        description: skillDesc.trim(),
      });
      setSkillName('');
      setSkillDesc('');
      setSkillModalOpen(false);
    } finally {
      setSaving(false);
    }
  };

  const handleAddDesired = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = desiredInput.trim();
    if (!trimmed) return;
    if (user.desiredSkills.some((s) => s.toLowerCase() === trimmed.toLowerCase())) {
      setDesiredInput('');
      return;
    }
    await onUpdateDesiredSkills([...user.desiredSkills, trimmed]);
    setDesiredInput('');
  };

  const handleRemoveDesired = async (item: string) => {
    await onUpdateDesiredSkills(user.desiredSkills.filter((s) => s !== item));
  };

  const handleSaveWork = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!workTitle.trim()) return;
    setSaving(true);
    try {
      await onAddWork({
        title: workTitle.trim(),
        category: workCategory,
        description: workDesc.trim(),
      });
      setWorkTitle('');
      setWorkDesc('');
      setWorkModalOpen(false);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6 pb-8">
      {/* Cover + Avatar Card */}
      <div className="rounded-3xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 overflow-hidden shadow-sm">
        <input
          ref={coverInputRef}
          type="file"
          accept="image/*"
          className="hidden"
          aria-label="Selecionar foto de capa"
          onChange={(e) => void handlePhotoFileChange('coverUrl', e)}
        />
        <input
          ref={avatarInputRef}
          type="file"
          accept="image/*"
          className="hidden"
          aria-label="Selecionar foto de perfil"
          onChange={(e) => void handlePhotoFileChange('avatarUrl', e)}
        />

        <div className="relative h-44 sm:h-52">
          {user.coverUrl ? (
            <img
              src={user.coverUrl}
              alt="Capa do perfil"
              referrerPolicy="no-referrer"
              className="w-full h-full object-cover"
            />
          ) : (
            <div className="w-full h-full bg-gradient-to-br from-[#1B3C59] via-[#264d70] to-[#51A644]" />
          )}
          <div className="absolute inset-0 bg-gradient-to-b from-black/40 via-transparent to-black/20" />
          <div className="absolute top-3 left-3 right-3 flex items-center justify-between">
            <button
              type="button"
              onClick={onBack}
              aria-label="Voltar para início"
              className="w-10 h-10 rounded-full bg-black/35 text-white flex items-center justify-center hover:bg-black/55 backdrop-blur-sm"
            >
              <IonIcon icon={arrowBackOutline} className="text-xl" />
            </button>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => coverInputRef.current?.click()}
                aria-label="Alterar foto de capa"
                className="h-9 px-3 rounded-full bg-black/35 text-white text-xs font-medium flex items-center gap-1.5 hover:bg-black/55 backdrop-blur-sm"
              >
                <IonIcon icon={cameraOutline} className="text-sm" />
                <span>{user.coverUrl ? 'Trocar capa' : 'Adicionar capa'}</span>
              </button>
              {user.coverUrl && (
                <button
                  type="button"
                  onClick={() => void onUpdatePhotos({ coverUrl: '' })}
                  aria-label="Remover foto de capa"
                  className="w-9 h-9 rounded-full bg-black/35 text-white flex items-center justify-center hover:bg-black/55 backdrop-blur-sm"
                >
                  <IonIcon icon={trashOutline} className="text-sm" />
                </button>
              )}
              <button
                type="button"
                onClick={onOpenSettings}
                aria-label="Opções da conta"
                className="w-10 h-10 rounded-full bg-black/35 text-white flex items-center justify-center hover:bg-black/55 backdrop-blur-sm"
              >
                <IonIcon icon={ellipsisHorizontal} className="text-xl" />
              </button>
            </div>
          </div>
        </div>

        <div className="px-6 pb-6 pt-3 relative flow-root">
          <div className="flex justify-center -mt-16 relative z-10 pointer-events-none">
            <div className="relative pointer-events-auto">
              <UserAvatar
                src={user.avatarUrl}
                name={user.fullName}
                className="w-28 h-28 rounded-full border-4 border-white dark:border-slate-900 shadow-lg"
                textClassName="text-3xl"
              />
              <button
                type="button"
                onClick={() => avatarInputRef.current?.click()}
                aria-label={user.avatarUrl ? 'Alterar foto de perfil' : 'Adicionar foto de perfil'}
                className="absolute bottom-0 right-0 w-9 h-9 rounded-full bg-[#1B3C59] text-white border-2 border-white dark:border-slate-900 flex items-center justify-center shadow hover:bg-[#142d44]"
              >
                <IonIcon icon={cameraOutline} className="text-base" />
              </button>
            </div>
          </div>

          <button
            type="button"
            onClick={onOpenSettings}
            aria-label="Abrir configurações do perfil"
            className="absolute top-3 right-5 w-10 h-10 rounded-xl flex items-center justify-center text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 z-20"
          >
            <IonIcon icon={settingsOutline} className="text-2xl" />
          </button>

          <div className="text-center mt-3 space-y-1">
            {user.avatarUrl && (
              <button
                type="button"
                onClick={() => void onUpdatePhotos({ avatarUrl: '' })}
                className="text-[11px] text-slate-400 hover:text-red-500 underline"
              >
                Remover foto de perfil
              </button>
            )}
            <h1 className="font-display text-2xl sm:text-3xl font-bold text-slate-900 dark:text-white">
              {user.displayName}
            </h1>
            {user.headline && (
              <p className="text-sm font-medium text-[#51A644] dark:text-[#85BF4B]">
                {user.headline}
              </p>
            )}
            <p className="text-sm text-slate-600 dark:text-slate-300">
              Nome Completo: {user.fullName}
            </p>
            {user.settings.privacyShowEmail && (
              <p className="text-sm text-slate-600 dark:text-slate-300">
                E-mail: {user.email}
              </p>
            )}
            <p className="text-sm text-slate-600 dark:text-slate-300 tabular-nums">
              Idade: {user.age} anos · Nota: {user.rating.toFixed(1)}/5
            </p>
            <p className="text-xs text-slate-500 dark:text-slate-400 inline-flex items-center justify-center gap-1 pt-1">
              <IonIcon icon={locationOutline} />
              <span>{user.locationLabel || 'Localização não informada'}</span>
            </p>
            {user.bio && (
              <p className="text-xs text-slate-500 dark:text-slate-400 max-w-xl mx-auto pt-2">
                {user.bio}
              </p>
            )}
            <div className="pt-3 flex justify-center">
              <button
                type="button"
                onClick={openEditProfileModal}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-100 text-xs font-semibold transition-colors"
              >
                <IonIcon icon={createOutline} className="text-sm" />
                <span>Editar informações</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Suas habilidades (ofertadas em troca) */}
      <section aria-labelledby="habilidades-heading">
        <div className="flex items-center justify-between mb-3.5">
          <div>
            <h2
              id="habilidades-heading"
              className="font-display text-xl font-bold text-slate-900 dark:text-white"
            >
              Suas habilidades ofertadas
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Competências que você oferece como forma de troca na ELO+
            </p>
          </div>
          <button
            type="button"
            onClick={() => setSkillModalOpen(true)}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#1B3C59] text-white text-xs font-semibold hover:bg-[#142d44] shrink-0"
          >
            <IonIcon icon={addOutline} />
            <span>Adicionar</span>
          </button>
        </div>

        {user.skills.length === 0 ? (
          <div className="rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-6 text-center">
            <p className="text-sm font-medium text-slate-700 dark:text-slate-200">
              Nenhuma habilidade cadastrada ainda.
            </p>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
              Adicione pelo menos uma habilidade para começar a propor trocas na ELO+.
            </p>
          </div>
        ) : (
          <div className="flex sm:grid sm:grid-cols-3 lg:grid-cols-4 gap-3.5 overflow-x-auto pb-2">
            {user.skills.map((skill) => (
              <div
                key={skill.id}
                className="relative shrink-0 w-40 sm:w-auto flex flex-col items-center justify-center p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-sm text-center"
              >
                <button
                  type="button"
                  onClick={() => onRemoveSkill(skill.id)}
                  aria-label={`Remover habilidade ${skill.name}`}
                  className="absolute top-2 right-2 w-7 h-7 rounded-lg flex items-center justify-center text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950/40"
                >
                  <IonIcon icon={trashOutline} className="text-sm" />
                </button>
                <CategoryIconTile iconKey={skill.categoryId} size="md" />
                <span className="mt-2.5 text-xs font-semibold text-slate-800 dark:text-slate-100 truncate max-w-full">
                  {skill.name}
                </span>
                <span className="text-[11px] text-slate-400 mt-0.5">
                  {skill.level}
                </span>
                {skill.mode && (
                  <span className="text-[10px] text-[#51A644] dark:text-[#85BF4B] mt-0.5 truncate max-w-full">
                    {skill.mode}
                  </span>
                )}
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Serviços que gostaria de receber em troca */}
      <section className="rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 p-5 space-y-3">
        <div>
          <h2 className="font-display text-lg font-bold text-slate-900 dark:text-white">
            Serviços que deseja receber em troca
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Informe o que você procura aprender ou contratar via permuta de talentos.
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          {user.desiredSkills.map((item) => (
            <div
              key={item}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-100 dark:bg-slate-800 text-xs font-medium text-slate-800 dark:text-slate-200"
            >
              <span>{item}</span>
              <button
                type="button"
                onClick={() => void handleRemoveDesired(item)}
                aria-label={`Remover interesse em ${item}`}
                className="text-slate-400 hover:text-red-500"
              >
                <IonIcon icon={closeOutline} className="text-sm" />
              </button>
            </div>
          ))}
        </div>

        <form onSubmit={handleAddDesired} className="flex items-center gap-2 pt-1">
          <label htmlFor="desired-skill-input" className="sr-only">
            Adicionar serviço desejado
          </label>
          <input
            id="desired-skill-input"
            type="text"
            value={desiredInput}
            onChange={(e) => setDesiredInput(e.target.value)}
            placeholder="Ex.: Aulas de Inglês, Identidade Visual..."
            className="flex-1 h-10 px-3.5 rounded-xl bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs text-slate-900 dark:text-white"
          />
          <button
            type="submit"
            disabled={!desiredInput.trim()}
            className="h-10 px-4 rounded-xl bg-[#51A644] text-white text-xs font-semibold disabled:opacity-50"
          >
            Incluir
          </button>
        </form>
      </section>

      {/* Trabalhos em destaque */}
      <section aria-labelledby="trabalhos-heading">
        <div className="flex items-center justify-between mb-3.5">
          <h2
            id="trabalhos-heading"
            className="font-display text-xl font-bold text-slate-900 dark:text-white"
          >
            Trabalhos em destaque
          </h2>
          <button
            type="button"
            onClick={() => setWorkModalOpen(true)}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-800 dark:text-slate-100 text-xs font-semibold hover:bg-slate-50"
          >
            <IonIcon icon={addOutline} />
            <span>Publicar trabalho</span>
          </button>
        </div>

        {user.featuredWorks.length === 0 ? (
          <div className="rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-8 text-center">
            <p className="text-sm font-medium text-slate-700 dark:text-slate-200">
              Nenhum trabalho publicado ainda.
            </p>
            <button
              type="button"
              onClick={() => setWorkModalOpen(true)}
              className="mt-3 px-4 py-2 rounded-xl bg-[#1B3C59] text-white text-xs font-semibold"
            >
              Adicionar primeiro projeto
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {user.featuredWorks.map((work) => (
              <div
                key={work.id}
                className="relative h-52 rounded-3xl overflow-hidden shadow-md bg-slate-900"
              >
                <img
                  src={work.imageUrl}
                  alt={work.title}
                  referrerPolicy="no-referrer"
                  className="w-full h-full object-cover"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/45 to-black/20 flex flex-col justify-center items-center text-center p-5 text-white">
                  <h3 className="font-display text-xl font-bold leading-snug">{work.title}</h3>
                  <p className="text-xs text-slate-200 mt-1">{work.authorName}</p>
                  <div className="flex items-center gap-1 mt-2" aria-label={`Nota ${work.rating}`}>
                    {[1, 2, 3, 4, 5].map((n) => (
                      <IonIcon
                        key={n}
                        icon={n <= Math.round(work.rating) ? star : starOutline}
                        className="text-sm text-amber-300"
                      />
                    ))}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Add Skill Modal */}
      <IonModal isOpen={skillModalOpen} onDidDismiss={() => setSkillModalOpen(false)}>
        <div className="p-6 bg-white dark:bg-slate-900 min-h-full flex flex-col overflow-y-auto">
          <div className="flex items-center justify-between mb-6">
            <h2 className="font-display text-xl font-bold text-slate-900 dark:text-white">
              Cadastrar habilidade ofertada
            </h2>
            <button
              type="button"
              onClick={() => setSkillModalOpen(false)}
              aria-label="Fechar modal"
              className="w-10 h-10 rounded-full flex items-center justify-center text-slate-500"
            >
              <IonIcon icon={closeOutline} className="text-xl" />
            </button>
          </div>

          <form onSubmit={handleSaveSkill} className="space-y-4 max-w-md w-full mx-auto">
            <div>
              <label htmlFor="skill-name" className="block text-xs font-medium text-slate-600 dark:text-slate-300 mb-1">
                Nome da habilidade
              </label>
              <input
                id="skill-name"
                type="text"
                value={skillName}
                onChange={(e) => setSkillName(e.target.value)}
                placeholder="Ex.: Java Spring Boot, UI Design"
                className="w-full h-11 px-3.5 rounded-xl bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-sm text-slate-900 dark:text-white"
              />
            </div>

            <div>
              <label htmlFor="skill-cat" className="block text-xs font-medium text-slate-600 dark:text-slate-300 mb-1">
                Categoria
              </label>
              <select
                id="skill-cat"
                value={skillCategory}
                onChange={(e) => setSkillCategory(e.target.value as CategorySlug)}
                className="w-full h-11 px-3.5 rounded-xl bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-sm text-slate-900 dark:text-white"
              >
                {categories.map((cat) => (
                  <option key={cat.id} value={cat.id}>
                    {cat.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label htmlFor="skill-lvl" className="block text-xs font-medium text-slate-600 dark:text-slate-300 mb-1">
                  Nível
                </label>
                <select
                  id="skill-lvl"
                  value={skillLevel}
                  onChange={(e) => setSkillLevel(e.target.value as SkillItem['level'])}
                  className="w-full h-11 px-3 rounded-xl bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-sm text-slate-900 dark:text-white"
                >
                  <option value="Iniciante">Iniciante</option>
                  <option value="Intermediário">Intermediário</option>
                  <option value="Avançado">Avançado</option>
                </select>
              </div>

              <div>
                <label htmlFor="skill-mode" className="block text-xs font-medium text-slate-600 dark:text-slate-300 mb-1">
                  Modalidade
                </label>
                <select
                  id="skill-mode"
                  value={skillMode}
                  onChange={(e) => setSkillMode(e.target.value as AttendanceMode)}
                  className="w-full h-11 px-3 rounded-xl bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-sm text-slate-900 dark:text-white"
                >
                  <option value="Presencial e Remoto">Ambos</option>
                  <option value="Presencial">Presencial</option>
                  <option value="Remoto">Remoto</option>
                </select>
              </div>
            </div>

            <div>
              <label htmlFor="skill-desc" className="block text-xs font-medium text-slate-600 dark:text-slate-300 mb-1">
                Descrição da experiência prática
              </label>
              <textarea
                id="skill-desc"
                rows={3}
                value={skillDesc}
                onChange={(e) => setSkillDesc(e.target.value)}
                placeholder="Explique como você pode ajudar outros membros..."
                className="w-full p-3.5 rounded-xl bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-sm text-slate-900 dark:text-white"
              />
            </div>

            <button
              type="submit"
              disabled={saving || !skillName.trim()}
              className="w-full h-12 rounded-xl bg-[#1B3C59] text-white font-semibold text-sm disabled:opacity-50"
            >
              Salvar habilidade
            </button>
          </form>
        </div>
      </IonModal>

      {/* Add Work Modal */}
      <IonModal isOpen={workModalOpen} onDidDismiss={() => setWorkModalOpen(false)}>
        <div className="p-6 bg-white dark:bg-slate-900 min-h-full flex flex-col">
          <div className="flex items-center justify-between mb-6">
            <h2 className="font-display text-xl font-bold text-slate-900 dark:text-white">
              Publicar trabalho em destaque
            </h2>
            <button
              type="button"
              onClick={() => setWorkModalOpen(false)}
              aria-label="Fechar modal"
              className="w-10 h-10 rounded-full flex items-center justify-center text-slate-500"
            >
              <IonIcon icon={closeOutline} className="text-xl" />
            </button>
          </div>

          <form onSubmit={handleSaveWork} className="space-y-4 max-w-md w-full mx-auto">
            <div>
              <label htmlFor="work-title" className="block text-xs font-medium text-slate-600 dark:text-slate-300 mb-1">
                Título do projeto
              </label>
              <input
                id="work-title"
                type="text"
                value={workTitle}
                onChange={(e) => setWorkTitle(e.target.value)}
                placeholder="Ex.: Plataforma ELO+ em Ionic"
                className="w-full h-11 px-3.5 rounded-xl bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-sm text-slate-900 dark:text-white"
              />
            </div>

            <div>
              <label htmlFor="work-cat" className="block text-xs font-medium text-slate-600 dark:text-slate-300 mb-1">
                Área
              </label>
              <select
                id="work-cat"
                value={workCategory}
                onChange={(e) => setWorkCategory(e.target.value)}
                className="w-full h-11 px-3.5 rounded-xl bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-sm text-slate-900 dark:text-white"
              >
                {categories.map((cat) => (
                  <option key={cat.id} value={cat.name}>
                    {cat.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label htmlFor="work-desc" className="block text-xs font-medium text-slate-600 dark:text-slate-300 mb-1">
                Resumo
              </label>
              <textarea
                id="work-desc"
                rows={3}
                value={workDesc}
                onChange={(e) => setWorkDesc(e.target.value)}
                placeholder="Descreva rapidamente o que você construiu..."
                className="w-full p-3.5 rounded-xl bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-sm text-slate-900 dark:text-white"
              />
            </div>

            <button
              type="submit"
              disabled={saving || workTitle.trim().length < 3}
              className="w-full h-12 rounded-xl bg-[#1B3C59] text-white font-semibold text-sm disabled:opacity-50"
            >
              Publicar trabalho
            </button>
          </form>
        </div>
      </IonModal>

      {/* Edit Profile Info Modal */}
      <IonModal isOpen={editModalOpen} onDidDismiss={() => setEditModalOpen(false)}>
        <div className="p-6 bg-white dark:bg-slate-900 min-h-full flex flex-col overflow-y-auto">
          <div className="flex items-center justify-between mb-6">
            <h2 className="font-display text-xl font-bold text-slate-900 dark:text-white">
              Editar informações do perfil
            </h2>
            <button
              type="button"
              onClick={() => setEditModalOpen(false)}
              aria-label="Fechar edição do perfil"
              className="w-10 h-10 rounded-full flex items-center justify-center text-slate-500"
            >
              <IonIcon icon={closeOutline} className="text-xl" />
            </button>
          </div>

          <form onSubmit={handleSaveProfileInfo} className="space-y-4 max-w-md w-full mx-auto">
            <div>
              <label htmlFor="prof-fullname" className="block text-xs font-medium text-slate-600 dark:text-slate-300 mb-1">
                Nome completo
              </label>
              <input
                id="prof-fullname"
                type="text"
                value={editFullName}
                onChange={(e) => setEditFullName(e.target.value)}
                placeholder="Seu nome completo"
                className="w-full h-11 px-3.5 rounded-xl bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-sm text-slate-900 dark:text-white"
              />
            </div>

            <div>
              <label htmlFor="prof-headline" className="block text-xs font-medium text-slate-600 dark:text-slate-300 mb-1">
                Título / Especialidade
              </label>
              <input
                id="prof-headline"
                type="text"
                value={editHeadline}
                onChange={(e) => setEditHeadline(e.target.value)}
                placeholder="Ex.: Desenvolvedor Front-end · Ionic React"
                className="w-full h-11 px-3.5 rounded-xl bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-sm text-slate-900 dark:text-white"
              />
            </div>

            <div>
              <label htmlFor="prof-location" className="block text-xs font-medium text-slate-600 dark:text-slate-300 mb-1">
                Bairro / Cidade
              </label>
              <input
                id="prof-location"
                type="text"
                value={editLocation}
                onChange={(e) => setEditLocation(e.target.value)}
                placeholder="Ex.: Santo Amaro, São Paulo - SP"
                className="w-full h-11 px-3.5 rounded-xl bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-sm text-slate-900 dark:text-white"
              />
            </div>

            <div>
              <label htmlFor="prof-bio" className="block text-xs font-medium text-slate-600 dark:text-slate-300 mb-1">
                Sobre você (Bio)
              </label>
              <textarea
                id="prof-bio"
                rows={4}
                value={editBio}
                onChange={(e) => setEditBio(e.target.value)}
                placeholder="Conte quais habilidades você domina e o que gostaria de trocar..."
                className="w-full p-3.5 rounded-xl bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-sm text-slate-900 dark:text-white"
              />
            </div>

            <button
              type="submit"
              disabled={saving || editFullName.trim().length < 2}
              className="w-full h-12 rounded-xl bg-[#1B3C59] hover:bg-[#142d44] text-white font-semibold text-sm disabled:opacity-50"
            >
              {saving ? 'Salvando...' : 'Salvar informações'}
            </button>
          </form>
        </div>
      </IonModal>
    </div>
  );
};
