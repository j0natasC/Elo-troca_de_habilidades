import React, { useState } from 'react';
import { IonIcon } from '@ionic/react';
import { addOutline, checkmarkCircleOutline, trashOutline } from 'ionicons/icons';
import { ComumLogo } from './ComumLogo';
import { validateOnboardingProfile } from '../shared/validation';
import type {
  AttendanceMode,
  CategoryItem,
  CategorySlug,
  SkillItem,
  UserProfile,
} from '../shared/types';

export interface OnboardingPayload {
  fullName: string;
  age: number;
  locationLabel: string;
  headline: string;
  bio: string;
  skills: Array<{
    name: string;
    categoryId: CategorySlug;
    level: SkillItem['level'];
    mode: AttendanceMode;
    description?: string;
  }>;
  desiredSkills: string[];
}

interface OnboardingViewProps {
  user: UserProfile;
  categories: CategoryItem[];
  onComplete: (payload: OnboardingPayload) => Promise<void>;
  onSkip: () => void;
}

export const OnboardingView: React.FC<OnboardingViewProps> = ({
  user,
  categories,
  onComplete,
  onSkip,
}) => {
  const [fullName, setFullName] = useState(user.fullName);
  const [age, setAge] = useState('');
  const [locationLabel, setLocationLabel] = useState('');
  const [headline, setHeadline] = useState('');
  const [bio, setBio] = useState('');

  const [skills, setSkills] = useState<OnboardingPayload['skills']>([]);
  const [skillName, setSkillName] = useState('');
  const [skillCategory, setSkillCategory] = useState<CategorySlug>('programacao');
  const [skillLevel, setSkillLevel] = useState<SkillItem['level']>('Intermediário');
  const [skillMode, setSkillMode] = useState<AttendanceMode>('Presencial e Remoto');

  const [desiredInput, setDesiredInput] = useState('');
  const [desiredSkills, setDesiredSkills] = useState<string[]>([]);

  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const handleAddSkillToList = () => {
    setErrorMsg(null);
    const clean = skillName.trim();
    if (clean.length < 2) {
      setErrorMsg('Digite o nome da habilidade antes de adicionar.');
      return;
    }
    const duplicate = skills.some(
      (s) => s.name.toLowerCase() === clean.toLowerCase() && s.categoryId === skillCategory,
    );
    if (duplicate) {
      setErrorMsg('Essa habilidade já foi adicionada nessa categoria.');
      return;
    }
    if (skills.length >= 12) {
      setErrorMsg('Limite máximo de 12 habilidades atingido.');
      return;
    }

    setSkills((prev) => [
      ...prev,
      {
        name: clean,
        categoryId: skillCategory,
        level: skillLevel,
        mode: skillMode,
      },
    ]);
    setSkillName('');
  };

  const handleAddDesired = () => {
    const clean = desiredInput.trim();
    if (!clean) return;
    if (desiredSkills.some((item) => item.toLowerCase() === clean.toLowerCase())) {
      setDesiredInput('');
      return;
    }
    if (desiredSkills.length >= 12) return;
    setDesiredSkills((prev) => [...prev, clean]);
    setDesiredInput('');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    let finalSkills = [...skills];
    const pendingSkill = skillName.trim();
    if (pendingSkill.length >= 2) {
      const exists = finalSkills.some(
        (s) => s.name.toLowerCase() === pendingSkill.toLowerCase() && s.categoryId === skillCategory,
      );
      if (!exists && finalSkills.length < 12) {
        finalSkills = [
          ...finalSkills,
          {
            name: pendingSkill,
            categoryId: skillCategory,
            level: skillLevel,
            mode: skillMode,
          },
        ];
      }
    }

    let finalDesired = [...desiredSkills];
    const pendingDesired = desiredInput.trim();
    if (pendingDesired && !finalDesired.some((d) => d.toLowerCase() === pendingDesired.toLowerCase())) {
      finalDesired = [...finalDesired, pendingDesired].slice(0, 12);
    }

    const check = validateOnboardingProfile({
      fullName,
      age,
      locationLabel,
      headline,
      skillsCount: finalSkills.length,
    });
    if (!check.valid) {
      setErrorMsg(check.error || 'Preencha os campos obrigatórios para continuar.');
      return;
    }

    setSaving(true);
    try {
      await onComplete({
        fullName: fullName.trim(),
        age: Math.round(Number(age)),
        locationLabel: locationLabel.trim(),
        headline: headline.trim(),
        bio: bio.trim(),
        skills: finalSkills,
        desiredSkills: finalDesired,
      });
    } catch (err) {
      setErrorMsg(
        err instanceof Error ? err.message : 'Não foi possível salvar seu cadastro inicial.',
      );
    } finally {
      setSaving(false);
    }
  };

  const categoryNameFor = (slug: CategorySlug) =>
    categories.find((c) => c.id === slug)?.name ?? slug;

  return (
    <main className="min-h-[100dvh] bg-[#F7F8FA] dark:bg-slate-950 text-slate-900 dark:text-slate-100 px-4 sm:px-6 lg:px-10 py-8 sm:py-10">
      <div className="max-w-5xl mx-auto space-y-6">
        <header className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-200/80 dark:border-slate-800 pb-5">
          <div className="flex items-center gap-4 min-w-0">
            <ComumLogo size="sm" showWordmark={false} />
            <div className="min-w-0">
              <h1 className="font-display text-2xl sm:text-3xl font-extrabold text-[#1B3C59] dark:text-white tracking-tight">
                Complete seu perfil inicial
              </h1>
              <p className="text-sm text-slate-600 dark:text-slate-400 mt-0.5">
                Informe sua idade, bairro, área de atuação e cadastre suas primeiras habilidades.
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onSkip}
            className="min-h-[44px] px-4 py-2 rounded-xl text-sm font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-200/60 dark:hover:bg-slate-800 transition-colors whitespace-nowrap shrink-0"
          >
            Pular por agora
          </button>
        </header>

        {errorMsg && (
          <div
            role="alert"
            className="p-4 rounded-2xl bg-red-50 dark:bg-red-950/60 border border-red-200 dark:border-red-800 text-sm text-red-700 dark:text-red-300"
          >
            {errorMsg}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
            {/* Coluna 1: Dados pessoais e apresentação */}
            <section className="lg:col-span-6 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 p-5 sm:p-6 space-y-4">
              <div>
                <h2 className="font-display text-lg font-bold text-slate-900 dark:text-white">
                  Sobre você
                </h2>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  Essas informações aparecem para outros participantes na busca e nas trocas.
                </p>
              </div>

              <div>
                <label
                  htmlFor="onb-fullname"
                  className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1.5"
                >
                  Nome completo
                </label>
                <input
                  id="onb-fullname"
                  type="text"
                  required
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder="Seu nome completo"
                  className="w-full h-11 px-3.5 rounded-xl bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-sm text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-[#1B3C59]/30 dark:focus:ring-[#77BC43]/40"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label
                    htmlFor="onb-age"
                    className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1.5"
                  >
                    Idade
                  </label>
                  <input
                    id="onb-age"
                    type="number"
                    min={13}
                    max={120}
                    required
                    value={age}
                    onChange={(e) => setAge(e.target.value)}
                    placeholder="Ex: 23"
                    className="w-full h-11 px-3.5 rounded-xl bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-sm text-slate-900 dark:text-white placeholder:text-slate-400 tabular-nums focus:outline-none focus:ring-2 focus:ring-[#1B3C59]/30 dark:focus:ring-[#77BC43]/40"
                  />
                </div>

                <div>
                  <label
                    htmlFor="onb-location"
                    className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1.5"
                  >
                    Bairro / Cidade
                  </label>
                  <input
                    id="onb-location"
                    type="text"
                    required
                    maxLength={120}
                    value={locationLabel}
                    onChange={(e) => setLocationLabel(e.target.value)}
                    placeholder="Ex: Santo Amaro · São Paulo"
                    className="w-full h-11 px-3.5 rounded-xl bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-sm text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-[#1B3C59]/30 dark:focus:ring-[#77BC43]/40"
                  />
                </div>
              </div>

              <div>
                <label
                  htmlFor="onb-headline"
                  className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1.5"
                >
                  Título profissional ou área de atuação
                </label>
                <input
                  id="onb-headline"
                  type="text"
                  required
                  maxLength={140}
                  value={headline}
                  onChange={(e) => setHeadline(e.target.value)}
                  placeholder="Ex: Desenvolvedor Web, Designer UI, Professor de Música"
                  className="w-full h-11 px-3.5 rounded-xl bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-sm text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-[#1B3C59]/30 dark:focus:ring-[#77BC43]/40"
                />
              </div>

              <div>
                <label
                  htmlFor="onb-bio"
                  className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1.5"
                >
                  Biografia curta (opcional)
                </label>
                <textarea
                  id="onb-bio"
                  rows={3}
                  maxLength={600}
                  value={bio}
                  onChange={(e) => setBio(e.target.value)}
                  placeholder="Conte sua experiência e que tipo de troca de habilidades procura."
                  className="w-full p-3.5 rounded-xl bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-sm text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-[#1B3C59]/30 dark:focus:ring-[#77BC43]/40"
                />
              </div>
            </section>

            {/* Coluna 2: Habilidades ofertadas e desejadas */}
            <section className="lg:col-span-6 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 p-5 sm:p-6 space-y-5">
              <div>
                <h2 className="font-display text-lg font-bold text-slate-900 dark:text-white">
                  Suas habilidades
                </h2>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  Cadastre pelo menos uma habilidade que você sabe ensinar ou executar.
                </p>
              </div>

              <div className="space-y-3">
                <div>
                  <label
                    htmlFor="onb-skill-name"
                    className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1.5"
                  >
                    Habilidade que você oferece
                  </label>
                  <input
                    id="onb-skill-name"
                    type="text"
                    maxLength={80}
                    value={skillName}
                    onChange={(e) => setSkillName(e.target.value)}
                    placeholder="Ex: React, Edição de Vídeo, Violão, SQL"
                    className="w-full h-11 px-3.5 rounded-xl bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-sm text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-[#1B3C59]/30 dark:focus:ring-[#77BC43]/40"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label
                      htmlFor="onb-skill-category"
                      className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1"
                    >
                      Categoria
                    </label>
                    <select
                      id="onb-skill-category"
                      value={skillCategory}
                      onChange={(e) => setSkillCategory(e.target.value as CategorySlug)}
                      className="w-full h-11 px-3 rounded-xl bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-sm text-slate-900 dark:text-white"
                    >
                      {categories.map((cat) => (
                        <option key={cat.id} value={cat.id}>
                          {cat.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label
                      htmlFor="onb-skill-level"
                      className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1"
                    >
                      Nível
                    </label>
                    <select
                      id="onb-skill-level"
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
                    <label
                      htmlFor="onb-skill-mode"
                      className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1"
                    >
                      Atendimento
                    </label>
                    <select
                      id="onb-skill-mode"
                      value={skillMode}
                      onChange={(e) => setSkillMode(e.target.value as AttendanceMode)}
                      className="w-full h-11 px-3 rounded-xl bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-sm text-slate-900 dark:text-white"
                    >
                      <option value="Presencial e Remoto">Presencial e Remoto</option>
                      <option value="Presencial">Presencial</option>
                      <option value="Remoto">Remoto</option>
                    </select>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={handleAddSkillToList}
                  className="inline-flex items-center gap-1.5 min-h-[44px] px-4 py-2 rounded-xl border border-[#1B3C59]/25 dark:border-slate-700 text-sm font-semibold text-[#1B3C59] dark:text-[#85BF4B] hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors whitespace-nowrap"
                >
                  <IonIcon icon={addOutline} className="text-lg" />
                  <span>Adicionar habilidade à lista</span>
                </button>
              </div>

              {skills.length > 0 && (
                <div className="border-t border-slate-100 dark:border-slate-800 pt-4 space-y-2">
                  <p className="text-xs font-semibold text-slate-600 dark:text-slate-300">
                    Habilidades adicionadas ({skills.length})
                  </p>
                  <ul className="divide-y divide-slate-100 dark:divide-slate-800">
                    {skills.map((sk, idx) => (
                      <li
                        key={`${sk.name}-${sk.categoryId}-${idx}`}
                        className="py-2.5 flex items-center justify-between gap-3"
                      >
                        <div className="min-w-0">
                          <p className="text-sm font-semibold text-slate-900 dark:text-white truncate">
                            {sk.name}
                          </p>
                          <p className="text-xs text-slate-500 dark:text-slate-400">
                            {categoryNameFor(sk.categoryId)} · {sk.level} · {sk.mode}
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={() => setSkills((prev) => prev.filter((_, i) => i !== idx))}
                          aria-label={`Remover habilidade ${sk.name}`}
                          className="min-w-[40px] min-h-[40px] rounded-xl flex items-center justify-center text-slate-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/40 transition-colors shrink-0"
                        >
                          <IonIcon icon={trashOutline} />
                        </button>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              <div className="border-t border-slate-100 dark:border-slate-800 pt-4 space-y-2.5">
                <label
                  htmlFor="onb-desired"
                  className="block text-xs font-medium text-slate-700 dark:text-slate-300"
                >
                  O que você gostaria de aprender em troca? (opcional)
                </label>
                <div className="flex items-center gap-2">
                  <input
                    id="onb-desired"
                    type="text"
                    maxLength={80}
                    value={desiredInput}
                    onChange={(e) => setDesiredInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        handleAddDesired();
                      }
                    }}
                    placeholder="Ex: Inglês, Design UI, Banco de Dados"
                    className="flex-1 min-w-0 h-11 px-3.5 rounded-xl bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-sm text-slate-900 dark:text-white placeholder:text-slate-400"
                  />
                  <button
                    type="button"
                    onClick={handleAddDesired}
                    className="h-11 px-4 rounded-xl bg-slate-200 dark:bg-slate-800 hover:bg-slate-300 dark:hover:bg-slate-700 text-sm font-semibold text-slate-800 dark:text-slate-100 whitespace-nowrap shrink-0 transition-colors"
                  >
                    Incluir
                  </button>
                </div>

                {desiredSkills.length > 0 && (
                  <ul className="divide-y divide-slate-100 dark:divide-slate-800">
                    {desiredSkills.map((item) => (
                      <li
                        key={item}
                        className="py-2 flex items-center justify-between gap-2 text-sm text-slate-700 dark:text-slate-200"
                      >
                        <span className="truncate">{item}</span>
                        <button
                          type="button"
                          onClick={() =>
                            setDesiredSkills((prev) => prev.filter((d) => d !== item))
                          }
                          aria-label={`Remover interesse ${item}`}
                          className="min-w-[36px] min-h-[36px] rounded-lg flex items-center justify-center text-slate-400 hover:text-red-600"
                        >
                          <IonIcon icon={trashOutline} />
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </section>
          </div>

          <div className="flex flex-col-reverse sm:flex-row sm:items-center sm:justify-end gap-3 pt-2">
            <button
              type="submit"
              disabled={saving}
              className="w-full sm:w-auto min-h-[48px] px-7 py-3 rounded-xl bg-[#1B3C59] hover:bg-[#142d44] text-white font-semibold text-sm inline-flex items-center justify-center gap-2 shadow-sm disabled:opacity-60 transition-colors whitespace-nowrap"
            >
              <IonIcon icon={checkmarkCircleOutline} className="text-lg" />
              <span>{saving ? 'Salvando perfil...' : 'Concluir cadastro e entrar'}</span>
            </button>
          </div>
        </form>
      </div>
    </main>
  );
};
