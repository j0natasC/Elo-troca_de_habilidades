import React, { useRef, useState } from 'react';
import { IonIcon, IonModal, IonSpinner } from '@ionic/react';
import {
  closeOutline,
  eyeOffOutline,
  eyeOutline,
  lockClosedOutline,
  megaphoneOutline,
  personOutline,
} from 'ionicons/icons';
import { ComumLogo } from './ComumLogo';
import { hasFirebaseConfig } from '../firebase';
import { api } from '../services/api';
import {
  loginWithEmailFirebase,
  registerWithEmailFirebase,
  sendPasswordResetFirebase,
  signInWithGoogleFirebase,
} from '../services/firebaseRuntime';
import {
  validateEmail,
  validateNewPassword,
  validateOtpCode,
  validatePassword,
  validateRegistration,
} from '../shared/validation';
import type { AuthResponse } from '../shared/types';

export type AuthScreen =
  | 'login'
  | 'register'
  | 'forgot'
  | 'verify-otp'
  | 'new-password';

interface AuthViewsProps {
  onAuthenticated: (auth: AuthResponse, mode?: 'firebase' | 'local') => void;
  onToast: (message: string, color?: 'success' | 'danger' | 'primary') => void;
}

export const AuthViews: React.FC<AuthViewsProps> = ({ onAuthenticated, onToast }) => {
  const [screen, setScreen] = useState<AuthScreen>('login');
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Login state
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [showLoginPass, setShowLoginPass] = useState(false);

  // Register state
  const [regName, setRegName] = useState('');
  const [regEmail, setRegEmail] = useState('');
  const [regPassword, setRegPassword] = useState('');
  const [regConfirm, setRegConfirm] = useState('');
  const [showRegPass, setShowRegPass] = useState(false);
  const [showRegConfirm, setShowRegConfirm] = useState(false);
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const [termsOpen, setTermsOpen] = useState(false);

  // Google quick modal state
  const [googleModalOpen, setGoogleModalOpen] = useState(false);
  const [googleEmail, setGoogleEmail] = useState('');
  const [googleName, setGoogleName] = useState('');

  // Recovery flow state
  const [recName, setRecName] = useState('');
  const [recEmail, setRecEmail] = useState('');
  const [recIdentifier, setRecIdentifier] = useState('');
  const [devPreviewCode, setDevPreviewCode] = useState<string | undefined>(undefined);
  const [otpDigits, setOtpDigits] = useState<string[]>(['', '', '', '']);
  const otpRefs = [
    useRef<HTMLInputElement>(null),
    useRef<HTMLInputElement>(null),
    useRef<HTMLInputElement>(null),
    useRef<HTMLInputElement>(null),
  ];
  const [newPassword, setNewPassword] = useState('');
  const [confirmNewPassword, setConfirmNewPassword] = useState('');
  const [showNewPass, setShowNewPass] = useState(false);
  const [showConfirmNewPass, setShowConfirmNewPass] = useState(false);

  const mapFirebaseAuthError = (err: unknown, fallback: string): string => {
    const code = (err as { code?: string } | null)?.code || '';
    if (code === 'auth/operation-not-allowed') {
      return 'Ative o provedor "E-mail/senha" no Firebase Console (Authentication → Sign-in method) para cadastrar contas sem Google.';
    }
    if (code === 'auth/email-already-in-use') {
      return 'Este e-mail já está cadastrado. Faça login ou clique em "Esqueci minha senha".';
    }
    if (
      code === 'auth/invalid-credential' ||
      code === 'auth/wrong-password' ||
      code === 'auth/user-not-found'
    ) {
      return 'E-mail ou senha incorretos.';
    }
    if (code === 'auth/weak-password') {
      return 'A senha deve ter pelo menos 6 caracteres.';
    }
    if (code === 'auth/too-many-requests') {
      return 'Muitas tentativas em sequência. Aguarde alguns instantes e tente novamente.';
    }
    if (code === 'auth/unauthorized-domain') {
      const host = typeof window !== 'undefined' ? window.location.hostname : 'este domínio';
      return `Domínio "${host}" não autorizado no Firebase Authentication. Adicione "${host}" em Authorized domains.`;
    }
    return err instanceof Error ? err.message : fallback;
  };

  const switchScreen = (next: AuthScreen) => {
    setErrorMsg(null);
    setScreen(next);
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    const emailCheck = validateEmail(loginEmail);
    if (!emailCheck.valid) {
      setErrorMsg(emailCheck.error || 'E-mail inválido.');
      return;
    }
    const passCheck = validatePassword(loginPassword);
    if (!passCheck.valid) {
      setErrorMsg(passCheck.error || 'Senha inválida.');
      return;
    }

    setLoading(true);
    try {
      if (hasFirebaseConfig) {
        const res = await loginWithEmailFirebase(loginEmail, loginPassword);
        onToast('Conectado à rede ELO+ na nuvem!', 'success');
        onAuthenticated(res, 'firebase');
      } else {
        const res = await api.login(loginEmail, loginPassword);
        onAuthenticated(res, 'local');
      }
    } catch (err) {
      setErrorMsg(mapFirebaseAuthError(err, 'Falha no login.'));
    } finally {
      setLoading(false);
    }
  };

  const handleDemoLogin = async () => {
    setErrorMsg(null);
    setLoading(true);
    try {
      const res = await api.login('juan.silva@gmail.com', 'Comum@123');
      onAuthenticated(res);
    } catch {
      try {
        const res = await api.googleSignIn('juan.silva@gmail.com', 'Juan Silva de Lima');
        onAuthenticated(res);
      } catch (err) {
        setErrorMsg(err instanceof Error ? err.message : 'Erro ao acessar demonstração.');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    const check = validateRegistration({
      name: regName,
      email: regEmail,
      password: regPassword,
      confirmPassword: regConfirm,
      acceptedTerms,
    });
    if (!check.valid) {
      setErrorMsg(check.error || 'Dados inválidos.');
      return;
    }

    setLoading(true);
    try {
      if (hasFirebaseConfig) {
        const res = await registerWithEmailFirebase({
          name: regName,
          email: regEmail,
          password: regPassword,
        });
        onToast('Conta criada e sincronizada na nuvem!', 'success');
        onAuthenticated(res, 'firebase');
      } else {
        const res = await api.register({
          name: regName,
          email: regEmail,
          password: regPassword,
          confirmPassword: regConfirm,
          acceptedTerms,
        });
        onToast('Conta criada com sucesso!', 'success');
        onAuthenticated(res, 'local');
      }
    } catch (err) {
      setErrorMsg(mapFirebaseAuthError(err, 'Erro ao criar conta.'));
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleButtonClick = async () => {
    setErrorMsg(null);
    if (!hasFirebaseConfig) {
      setGoogleName('');
      setGoogleEmail('');
      setGoogleModalOpen(true);
      return;
    }

    setLoading(true);
    try {
      const res = await signInWithGoogleFirebase();
      onToast('Conectado à rede em tempo real com Google!', 'success');
      onAuthenticated(res, 'firebase');
    } catch (err: unknown) {
      const code = (err as { code?: string } | null)?.code || '';
      if (code === 'auth/popup-closed-by-user' || code === 'auth/cancelled-popup-request') {
        setErrorMsg('Login com Google cancelado.');
      } else if (code === 'auth/unauthorized-domain') {
        const host = typeof window !== 'undefined' ? window.location.hostname : 'este domínio';
        setErrorMsg(
          `Domínio "${host}" ainda não autorizado no Firebase Authentication. Adicione "${host}" em Authorized domains no console do Firebase.`,
        );
      } else {
        setErrorMsg(err instanceof Error ? err.message : 'Não foi possível entrar com o Google.');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    if (googleName.trim().length < 2) {
      setErrorMsg('Informe seu nome completo para conectar com o Google.');
      return;
    }
    const emailCheck = validateEmail(googleEmail);
    if (!emailCheck.valid) {
      setErrorMsg(emailCheck.error || 'Informe um e-mail Google válido.');
      return;
    }
    setLoading(true);
    try {
      const res = await api.googleSignIn(googleEmail.trim(), googleName.trim());
      setGoogleModalOpen(false);
      setGoogleName('');
      setGoogleEmail('');
      onAuthenticated(res, 'local');
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Erro ao entrar com Google.');
    } finally {
      setLoading(false);
    }
  };

  const handleForgotSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    if (hasFirebaseConfig) {
      const emailCheck = validateEmail(recEmail);
      if (!emailCheck.valid) {
        setErrorMsg('Informe um e-mail válido cadastrado para receber o link de redefinição.');
        return;
      }
      setLoading(true);
      try {
        await sendPasswordResetFirebase(recEmail);
        onToast('Link de redefinição enviado para o seu e-mail!', 'success');
        switchScreen('login');
      } catch (err) {
        setErrorMsg(mapFirebaseAuthError(err, 'Não foi possível enviar o e-mail de recuperação.'));
      } finally {
        setLoading(false);
      }
      return;
    }

    const identifier = recEmail.trim() || recName.trim();
    if (!identifier) {
      setErrorMsg('Informe seu nome ou e-mail cadastrado.');
      return;
    }
    setLoading(true);
    try {
      const res = await api.forgotPassword(identifier);
      setRecIdentifier(identifier);
      setDevPreviewCode(res.devPreviewCode);
      setOtpDigits(['', '', '', '']);
      onToast(`Código enviado para ${res.emailMasked}`, 'primary');
      switchScreen('verify-otp');
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Conta não encontrada.');
    } finally {
      setLoading(false);
    }
  };

  const handleOtpInput = (index: number, value: string) => {
    const clean = value.replace(/\D/g, '').slice(-1);
    const next = [...otpDigits];
    next[index] = clean;
    setOtpDigits(next);
    if (clean && index < 3) {
      otpRefs[index + 1].current?.focus();
    }
  };

  const handleOtpKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Backspace' && !otpDigits[index] && index > 0) {
      otpRefs[index - 1].current?.focus();
    }
  };

  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    const check = validateOtpCode(otpDigits);
    if (!check.valid) {
      setErrorMsg(check.error || 'Código inválido.');
      return;
    }

    setLoading(true);
    try {
      await api.verifyOtp(recIdentifier, otpDigits);
      switchScreen('new-password');
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Código incorreto.');
    } finally {
      setLoading(false);
    }
  };

  const handleResendOtp = async () => {
    if (!recIdentifier) return;
    setLoading(true);
    setErrorMsg(null);
    try {
      const res = await api.forgotPassword(recIdentifier);
      setDevPreviewCode(res.devPreviewCode);
      onToast('Novo código enviado!', 'primary');
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Erro ao reenviar código.');
    } finally {
      setLoading(false);
    }
  };

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    const check = validateNewPassword(newPassword, confirmNewPassword);
    if (!check.valid) {
      setErrorMsg(check.error || 'Senhas inválidas.');
      return;
    }

    setLoading(true);
    try {
      await api.resetPassword(recIdentifier, newPassword, confirmNewPassword);
      setNewPassword('');
      setConfirmNewPassword('');
      setLoginPassword('');
      onToast('Senha redefinida com sucesso! Faça login.', 'success');
      switchScreen('login');
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Erro ao redefinir senha.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#F7F8FA] dark:bg-slate-950 flex items-center justify-center p-4 sm:p-6 lg:p-10">
      <div className="w-full max-w-5xl grid grid-cols-1 lg:grid-cols-12 bg-white dark:bg-slate-900 rounded-3xl shadow-xl shadow-slate-900/5 border border-slate-200/80 dark:border-slate-800 overflow-hidden">
        {/* Desktop Editorial Side Panel */}
        <div className="hidden lg:flex lg:col-span-5 relative flex-col justify-between p-8 bg-[#1D3B58] text-white">
          <img
            src="./src/assets/images/cover_coast_1795444433020.jpg"
            alt="Comunidade ELO+"
            referrerPolicy="no-referrer"
            className="absolute inset-0 w-full h-full object-cover opacity-25"
          />
          <div className="relative z-10">
            <span className="text-xs font-medium tracking-wider uppercase text-[#85BF4B]">
              Economia Colaborativa · ELO+
            </span>
            <h2 className="mt-3 font-display text-3xl font-bold leading-tight text-balance">
              Troque habilidades e serviços sem precisar usar dinheiro.
            </h2>
            <p className="mt-4 text-sm text-slate-200 leading-relaxed">
              Conecte seu talento com pessoas da sua região ou remotamente, negocie datas e locais de atendimento e construa parcerias reais na rede ELO+.
            </p>
          </div>

          <div className="relative z-10 space-y-4 pt-6 border-t border-white/15">
            <div className="flex items-center gap-3">
              <img
                src="./src/assets/images/avatar_mateus_1795444433229.jpg"
                alt="Mateus Silva"
                referrerPolicy="no-referrer"
                className="w-10 h-10 rounded-full object-cover ring-2 ring-[#77BC43]"
              />
              <div>
                <p className="text-sm font-semibold">Mateus Silva</p>
                <p className="text-xs text-slate-300">Programador · Java &amp; Ionic</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <img
                src="./src/assets/images/avatar_ana_1795444433009.jpg"
                alt="Ana Costa"
                referrerPolicy="no-referrer"
                className="w-10 h-10 rounded-full object-cover ring-2 ring-[#77BC43]"
              />
              <div>
                <p className="text-sm font-semibold">Ana Costa</p>
                <p className="text-xs text-slate-300">Ilustradora · Identidade Visual</p>
              </div>
            </div>
          </div>
        </div>

        {/* Interactive Form Panel */}
        <div className="lg:col-span-7 p-6 sm:p-10 flex flex-col justify-center relative">
          {screen !== 'login' && (
            <div className="flex justify-end mb-4">
              <ComumLogo size="sm" showWordmark={false} />
            </div>
          )}

          {errorMsg && (
            <div
              role="alert"
              className="mb-5 rounded-xl bg-red-50 dark:bg-red-950/50 border border-red-200 dark:border-red-800 px-4 py-3 text-sm text-red-700 dark:text-red-300"
            >
              {errorMsg}
            </div>
          )}

          {/* LOGIN SCREEN */}
          {screen === 'login' && (
            <div className="max-w-md w-full mx-auto">
              <div className="flex justify-center mb-6">
                <ComumLogo size="lg" showWordmark />
              </div>

              <p className="text-center text-slate-600 dark:text-slate-300 text-base mb-7 text-balance">
                Preencha e faça login, ou crie uma conta agora mesmo.
              </p>

              <form onSubmit={handleLogin} autoComplete="off" className="space-y-4">
                <div className="relative flex items-center bg-[#F4F5F7] dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3.5 h-12 focus-within:border-[#1D3B58] dark:focus-within:border-[#77BC43] transition-colors">
                  <IonIcon icon={personOutline} className="text-slate-500 text-lg mr-2.5 shrink-0" />
                  <label htmlFor="login-email" className="sr-only">
                    E-mail
                  </label>
                  <input
                    id="login-email"
                    name="elo_login_email"
                    type="email"
                    value={loginEmail}
                    onChange={(e) => setLoginEmail(e.target.value)}
                    placeholder="insira seu e-mail"
                    autoComplete="off"
                    className="w-full bg-transparent text-sm text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none"
                  />
                  {loginEmail && (
                    <button
                      type="button"
                      onClick={() => setLoginEmail('')}
                      aria-label="Limpar e-mail"
                      className="min-w-[36px] min-h-[36px] flex items-center justify-center text-slate-400 hover:text-slate-600"
                    >
                      <IonIcon icon={closeOutline} />
                    </button>
                  )}
                </div>

                <div className="relative flex items-center bg-[#F4F5F7] dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3.5 h-12 focus-within:border-[#1D3B58] dark:focus-within:border-[#77BC43] transition-colors">
                  <IonIcon icon={lockClosedOutline} className="text-slate-500 text-lg mr-2.5 shrink-0" />
                  <label htmlFor="login-password" className="sr-only">
                    Senha
                  </label>
                  <input
                    id="login-password"
                    name="elo_login_password"
                    type={showLoginPass ? 'text' : 'password'}
                    value={loginPassword}
                    onChange={(e) => setLoginPassword(e.target.value)}
                    placeholder="insira sua senha"
                    autoComplete="new-password"
                    className="w-full bg-transparent text-sm text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none"
                  />
                  <button
                    type="button"
                    onClick={() => setShowLoginPass((v) => !v)}
                    aria-label={showLoginPass ? 'Ocultar senha' : 'Mostrar senha'}
                    className="min-w-[36px] min-h-[36px] flex items-center justify-center text-slate-400 hover:text-slate-600"
                  >
                    <IonIcon icon={showLoginPass ? eyeOutline : eyeOffOutline} />
                  </button>
                  {loginPassword && (
                    <button
                      type="button"
                      onClick={() => setLoginPassword('')}
                      aria-label="Limpar senha"
                      className="min-w-[36px] min-h-[36px] flex items-center justify-center text-slate-400 hover:text-slate-600"
                    >
                      <IonIcon icon={closeOutline} />
                    </button>
                  )}
                </div>

                <div className="flex justify-end">
                  <button
                    type="button"
                    onClick={() => switchScreen('forgot')}
                    className="text-sm italic underline text-slate-500 hover:text-[#1D3B58] dark:text-slate-400 dark:hover:text-[#77BC43] py-1"
                  >
                    Esqueci minha senha
                  </button>
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full h-12 rounded-xl bg-[#1D3B58] hover:bg-[#162f47] text-white font-semibold text-sm shadow-md shadow-[#1D3B58]/20 transition-all active:scale-[0.99] disabled:opacity-60 flex items-center justify-center gap-2"
                >
                  {loading ? <IonSpinner name="crescent" className="w-5 h-5" /> : 'Entrar'}
                </button>
              </form>

              <div className="mt-3.5 space-y-3">
                <button
                  type="button"
                  onClick={() => void handleGoogleButtonClick()}
                  disabled={loading}
                  className="w-full h-12 rounded-xl bg-white dark:bg-slate-800 border-2 border-[#51A644]/50 hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-100 font-semibold text-sm shadow-sm flex items-center justify-center gap-2.5 transition-colors"
                >
                  <svg viewBox="0 0 24 24" className="w-5 h-5" aria-hidden="true">
                    <path
                      fill="#EA4335"
                      d="M12 5c1.6 0 3 .6 4.1 1.6l3.1-3.1C17.3 1.7 14.8 1 12 1 7.4 1 3.5 3.6 1.6 7.4l3.7 2.8C6.2 7.2 8.9 5 12 5z"
                    />
                    <path
                      fill="#4285F4"
                      d="M23.5 12.3c0-.8-.1-1.6-.2-2.3H12v4.5h6.5c-.3 1.5-1.1 2.8-2.4 3.6l3.7 2.9c2.2-2 3.7-5 3.7-8.7z"
                    />
                    <path
                      fill="#FBBC05"
                      d="M5.3 14.8c-.2-.8-.4-1.6-.4-2.5s.2-1.7.4-2.5L1.6 7C.6 9 0 10.7 0 12.3s.6 3.3 1.6 5.3l3.7-2.8z"
                    />
                    <path
                      fill="#34A853"
                      d="M12 23.5c3.2 0 6-1.1 8-2.9l-3.7-2.9c-1.1.7-2.5 1.2-4.3 1.2-3.1 0-5.8-2.1-6.7-5l-3.7 2.8C3.5 20.9 7.4 23.5 12 23.5z"
                    />
                  </svg>
                  <span>Entrar com o Google</span>
                </button>

                {hasFirebaseConfig && (
                  <p className="text-[11px] text-center text-slate-500 dark:text-slate-400 leading-relaxed px-1">
                    Tanto <strong className="text-[#3e8533] dark:text-[#85BF4B]">E-mail e senha</strong> quanto{' '}
                    <strong>Google</strong> sincronizam seu perfil e conversas em tempo real na nuvem.
                  </p>
                )}

                <div className="flex items-center gap-3 py-1">
                  <div className="h-px flex-1 bg-slate-200 dark:bg-slate-700" />
                  <span className="text-xs font-medium text-slate-500">ou</span>
                  <div className="h-px flex-1 bg-slate-200 dark:bg-slate-700" />
                </div>

                <button
                  type="button"
                  onClick={() => switchScreen('register')}
                  className="w-full h-12 rounded-xl bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-100 font-semibold text-sm shadow-sm transition-colors"
                >
                  Criar conta
                </button>

                <button
                  type="button"
                  onClick={handleDemoLogin}
                  disabled={loading}
                  className="w-full py-2.5 text-xs font-medium text-[#1D3B58] dark:text-[#8ED15A] hover:underline"
                >
                  Explorar com conta demonstração (Juan Silva)
                </button>
              </div>
            </div>
          )}

          {/* REGISTER SCREEN */}
          {screen === 'register' && (
            <div className="max-w-md w-full mx-auto">
              <h1 className="font-display text-2xl sm:text-3xl font-bold text-center text-slate-900 dark:text-white mb-4">
                Crie sua <span className="text-[#77BC43]">conta</span>
              </h1>

              {hasFirebaseConfig && (
                <div className="mb-4 rounded-xl bg-[#51A644]/10 border border-[#51A644]/30 px-3.5 py-2.5 text-xs text-slate-700 dark:text-slate-200 leading-relaxed">
                  Cadastro instantâneo sem confirmação de e-mail: use qualquer endereço no formato{' '}
                  <strong>nome@exemplo.com</strong> e sincronize seu perfil e chat na nuvem na hora.
                </div>
              )}

              <form onSubmit={handleRegister} className="space-y-3.5">
                <div className="flex items-center bg-[#F4F5F7] dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3.5 h-12">
                  <IonIcon icon={personOutline} className="text-slate-500 text-lg mr-2.5 shrink-0" />
                  <label htmlFor="reg-name" className="sr-only">
                    Nome completo
                  </label>
                  <input
                    id="reg-name"
                    type="text"
                    value={regName}
                    onChange={(e) => setRegName(e.target.value)}
                    placeholder="nome"
                    className="w-full bg-transparent text-sm text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none"
                  />
                  {regName && (
                    <button
                      type="button"
                      onClick={() => setRegName('')}
                      aria-label="Limpar nome"
                      className="min-w-[36px] min-h-[36px] flex items-center justify-center text-slate-400"
                    >
                      <IonIcon icon={closeOutline} />
                    </button>
                  )}
                </div>

                <div className="flex items-center bg-[#F4F5F7] dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3.5 h-12">
                  <IonIcon icon={megaphoneOutline} className="text-slate-500 text-lg mr-2.5 shrink-0" />
                  <label htmlFor="reg-email" className="sr-only">
                    E-mail
                  </label>
                  <input
                    id="reg-email"
                    type="email"
                    value={regEmail}
                    onChange={(e) => setRegEmail(e.target.value)}
                    placeholder="e-mail"
                    className="w-full bg-transparent text-sm text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none"
                  />
                  {regEmail && (
                    <button
                      type="button"
                      onClick={() => setRegEmail('')}
                      aria-label="Limpar e-mail"
                      className="min-w-[36px] min-h-[36px] flex items-center justify-center text-slate-400"
                    >
                      <IonIcon icon={closeOutline} />
                    </button>
                  )}
                </div>

                <div className="flex items-center bg-[#F4F5F7] dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3.5 h-12">
                  <IonIcon icon={lockClosedOutline} className="text-slate-500 text-lg mr-2.5 shrink-0" />
                  <label htmlFor="reg-pass" className="sr-only">
                    Senha
                  </label>
                  <input
                    id="reg-pass"
                    type={showRegPass ? 'text' : 'password'}
                    value={regPassword}
                    onChange={(e) => setRegPassword(e.target.value)}
                    placeholder="senha"
                    className="w-full bg-transparent text-sm text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none"
                  />
                  <button
                    type="button"
                    onClick={() => setShowRegPass((v) => !v)}
                    aria-label="Alternar visibilidade da senha"
                    className="min-w-[36px] min-h-[36px] flex items-center justify-center text-slate-400"
                  >
                    <IonIcon icon={showRegPass ? eyeOutline : eyeOffOutline} />
                  </button>
                </div>

                <div className="flex items-center bg-[#F4F5F7] dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3.5 h-12">
                  <IonIcon icon={lockClosedOutline} className="text-slate-500 text-lg mr-2.5 shrink-0" />
                  <label htmlFor="reg-confirm" className="sr-only">
                    Confirme sua senha
                  </label>
                  <input
                    id="reg-confirm"
                    type={showRegConfirm ? 'text' : 'password'}
                    value={regConfirm}
                    onChange={(e) => setRegConfirm(e.target.value)}
                    placeholder="confirme sua senha"
                    className="w-full bg-transparent text-sm text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none"
                  />
                  <button
                    type="button"
                    onClick={() => setShowRegConfirm((v) => !v)}
                    aria-label="Alternar visibilidade da confirmação"
                    className="min-w-[36px] min-h-[36px] flex items-center justify-center text-slate-400"
                  >
                    <IonIcon icon={showRegConfirm ? eyeOutline : eyeOffOutline} />
                  </button>
                </div>

                <div className="flex items-start gap-2.5 pt-1">
                  <input
                    id="accept-terms"
                    type="checkbox"
                    checked={acceptedTerms}
                    onChange={(e) => setAcceptedTerms(e.target.checked)}
                    className="mt-1 h-4 w-4 rounded border-slate-300 text-[#1D3B58] focus:ring-[#1D3B58]"
                  />
                  <label htmlFor="accept-terms" className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
                    Eu concordo com os{' '}
                    <button
                      type="button"
                      onClick={() => setTermsOpen(true)}
                      className="italic underline text-slate-700 dark:text-slate-200 hover:text-[#1D3B58]"
                    >
                      Termos de Uso e Política de Privacidade.
                    </button>
                  </label>
                </div>

                <div className="pt-2 space-y-3">
                  <button
                    type="submit"
                    disabled={loading}
                    className="w-full h-12 rounded-xl bg-[#1D3B58] hover:bg-[#162f47] text-white font-semibold text-sm shadow-md shadow-[#1D3B58]/20 transition-all disabled:opacity-60 flex items-center justify-center"
                  >
                    {loading ? <IonSpinner name="crescent" className="w-5 h-5" /> : 'Registrar'}
                  </button>
                  <button
                    type="button"
                    onClick={() => switchScreen('login')}
                    className="w-full h-12 rounded-xl bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-slate-800 dark:text-slate-100 font-semibold text-sm shadow-sm hover:bg-slate-50"
                  >
                    Voltar
                  </button>
                </div>
              </form>
            </div>
          )}

          {/* FORGOT PASSWORD SCREEN */}
          {screen === 'forgot' && (
            <div className="max-w-md w-full mx-auto">
              <h1 className="font-display text-2xl sm:text-3xl font-bold text-center text-slate-900 dark:text-white mb-2">
                Recupere sua <span className="text-[#77BC43]">senha</span>
              </h1>
              <p className="text-center text-sm text-slate-600 dark:text-slate-300 mb-7 text-balance">
                {hasFirebaseConfig
                  ? 'Enviaremos um link oficial de redefinição para o e-mail cadastrado.'
                  : 'Será enviada uma mensagem com um código de validação para o e-mail cadastrado'}
              </p>

              <form onSubmit={handleForgotSubmit} className="space-y-3.5">
                {!hasFirebaseConfig && (
                  <>
                    <div className="flex items-center bg-[#F4F5F7] dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3.5 h-12">
                      <IonIcon icon={personOutline} className="text-slate-500 text-lg mr-2.5 shrink-0" />
                      <label htmlFor="rec-name" className="sr-only">
                        Nome
                      </label>
                      <input
                        id="rec-name"
                        type="text"
                        value={recName}
                        onChange={(e) => setRecName(e.target.value)}
                        placeholder="nome"
                        className="w-full bg-transparent text-sm text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none"
                      />
                      {recName && (
                        <button
                          type="button"
                          onClick={() => setRecName('')}
                          aria-label="Limpar nome"
                          className="min-w-[36px] min-h-[36px] flex items-center justify-center text-slate-400"
                        >
                          <IonIcon icon={closeOutline} />
                        </button>
                      )}
                    </div>

                    <p className="text-center text-xs font-medium text-slate-500">ou</p>
                  </>
                )}

                <div className="flex items-center bg-[#F4F5F7] dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3.5 h-12">
                  <IonIcon icon={megaphoneOutline} className="text-slate-500 text-lg mr-2.5 shrink-0" />
                  <label htmlFor="rec-email" className="sr-only">
                    E-mail
                  </label>
                  <input
                    id="rec-email"
                    type="email"
                    value={recEmail}
                    onChange={(e) => setRecEmail(e.target.value)}
                    placeholder="e-mail"
                    className="w-full bg-transparent text-sm text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none"
                  />
                  {recEmail && (
                    <button
                      type="button"
                      onClick={() => setRecEmail('')}
                      aria-label="Limpar e-mail"
                      className="min-w-[36px] min-h-[36px] flex items-center justify-center text-slate-400"
                    >
                      <IonIcon icon={closeOutline} />
                    </button>
                  )}
                </div>

                <div className="pt-3 space-y-3">
                  <button
                    type="submit"
                    disabled={loading}
                    className="w-full h-12 rounded-xl bg-[#1D3B58] hover:bg-[#162f47] text-white font-semibold text-sm shadow-md shadow-[#1D3B58]/20 flex items-center justify-center"
                  >
                    {loading ? <IonSpinner name="crescent" className="w-5 h-5" /> : 'Enviar'}
                  </button>
                  <button
                    type="button"
                    onClick={() => switchScreen('login')}
                    className="w-full h-12 rounded-xl bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-slate-800 dark:text-slate-100 font-semibold text-sm shadow-sm hover:bg-slate-50"
                  >
                    Voltar
                  </button>
                </div>
              </form>
            </div>
          )}

          {/* OTP VALIDATION SCREEN */}
          {screen === 'verify-otp' && (
            <div className="max-w-md w-full mx-auto">
              <h1 className="font-display text-2xl sm:text-3xl font-bold text-center text-slate-900 dark:text-white leading-tight mb-3">
                Validando sua <br />
                <span className="text-[#77BC43]">identidade</span>
              </h1>
              <p className="text-center text-sm text-slate-600 dark:text-slate-300 mb-5">
                Insira o código enviado para o e-mail cadastrado:
              </p>

              {devPreviewCode && (
                <div className="mb-5 rounded-xl bg-[#77BC43]/15 border border-[#77BC43]/40 px-4 py-2.5 text-center text-xs text-slate-800 dark:text-slate-200">
                  Código de validação (ambiente local):{' '}
                  <strong className="font-mono text-sm tracking-widest">{devPreviewCode}</strong>
                </div>
              )}

              <form onSubmit={handleVerifyOtp} className="space-y-6">
                <div className="grid grid-cols-4 gap-3 max-w-xs mx-auto">
                  {otpDigits.map((digit, idx) => (
                    <input
                      key={idx}
                      ref={otpRefs[idx]}
                      type="text"
                      inputMode="numeric"
                      maxLength={1}
                      aria-label={`Dígito ${idx + 1} do código`}
                      value={digit}
                      onChange={(e) => handleOtpInput(idx, e.target.value)}
                      onKeyDown={(e) => handleOtpKeyDown(idx, e)}
                      className="h-16 w-full text-center text-2xl font-bold font-mono rounded-2xl bg-[#F4F5F7] dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white focus:border-[#1D3B58] dark:focus:border-[#77BC43] focus:outline-none"
                    />
                  ))}
                </div>

                <div className="space-y-3">
                  <button
                    type="submit"
                    disabled={loading}
                    className="w-full h-12 rounded-xl bg-[#1D3B58] hover:bg-[#162f47] text-white font-semibold text-sm shadow-md shadow-[#1D3B58]/20 flex items-center justify-center"
                  >
                    {loading ? <IonSpinner name="crescent" className="w-5 h-5" /> : 'Verificar'}
                  </button>
                  <button
                    type="button"
                    onClick={() => switchScreen('forgot')}
                    className="w-full h-12 rounded-xl bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-slate-800 dark:text-slate-100 font-semibold text-sm shadow-sm hover:bg-slate-50"
                  >
                    Voltar
                  </button>
                </div>

                <div className="text-center text-xs text-slate-600 dark:text-slate-400">
                  Não recebeu nenhum código?{' '}
                  <button
                    type="button"
                    onClick={handleResendOtp}
                    className="font-semibold text-[#1D3B58] dark:text-[#77BC43] hover:underline"
                  >
                    Enviar novamente.
                  </button>
                </div>
              </form>
            </div>
          )}

          {/* NEW PASSWORD SCREEN */}
          {screen === 'new-password' && (
            <div className="max-w-md w-full mx-auto">
              <h1 className="font-display text-2xl sm:text-3xl font-bold text-center text-slate-900 dark:text-white leading-tight mb-7">
                Qual será sua <br />
                <span className="text-[#77BC43]">nova senha</span> ?
              </h1>

              <form onSubmit={handleResetPassword} className="space-y-4">
                <div className="flex items-center bg-[#F4F5F7] dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3.5 h-12">
                  <IonIcon icon={lockClosedOutline} className="text-slate-500 text-lg mr-2.5 shrink-0" />
                  <label htmlFor="new-pass" className="sr-only">
                    Nova senha
                  </label>
                  <input
                    id="new-pass"
                    type={showNewPass ? 'text' : 'password'}
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="nova senha"
                    className="w-full bg-transparent text-sm text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none"
                  />
                  <button
                    type="button"
                    onClick={() => setShowNewPass((v) => !v)}
                    aria-label="Mostrar nova senha"
                    className="min-w-[36px] min-h-[36px] flex items-center justify-center text-slate-400"
                  >
                    <IonIcon icon={showNewPass ? eyeOutline : eyeOffOutline} />
                  </button>
                </div>

                <div className="flex items-center bg-[#F4F5F7] dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3.5 h-12">
                  <IonIcon icon={lockClosedOutline} className="text-slate-500 text-lg mr-2.5 shrink-0" />
                  <label htmlFor="confirm-new-pass" className="sr-only">
                    Confirme a nova senha
                  </label>
                  <input
                    id="confirm-new-pass"
                    type={showConfirmNewPass ? 'text' : 'password'}
                    value={confirmNewPassword}
                    onChange={(e) => setConfirmNewPassword(e.target.value)}
                    placeholder="confirme a senha"
                    className="w-full bg-transparent text-sm text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none"
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirmNewPass((v) => !v)}
                    aria-label="Mostrar confirmação da nova senha"
                    className="min-w-[36px] min-h-[36px] flex items-center justify-center text-slate-400"
                  >
                    <IonIcon icon={showConfirmNewPass ? eyeOutline : eyeOffOutline} />
                  </button>
                </div>

                <div className="pt-2 space-y-3">
                  <button
                    type="submit"
                    disabled={loading}
                    className="w-full h-12 rounded-xl bg-[#1D3B58] hover:bg-[#162f47] text-white font-semibold text-sm shadow-md shadow-[#1D3B58]/20 flex items-center justify-center"
                  >
                    {loading ? <IonSpinner name="crescent" className="w-5 h-5" /> : 'Confirmar'}
                  </button>
                  <button
                    type="button"
                    onClick={() => switchScreen('login')}
                    className="w-full h-12 rounded-xl bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-slate-800 dark:text-slate-100 font-semibold text-sm shadow-sm hover:bg-slate-50"
                  >
                    Voltar
                  </button>
                </div>
              </form>
            </div>
          )}
        </div>
      </div>

      {/* Terms Modal */}
      <IonModal isOpen={termsOpen} onDidDismiss={() => setTermsOpen(false)}>
        <div className="p-6 bg-white dark:bg-slate-900 min-h-full flex flex-col justify-between">
          <div className="space-y-4">
            <h2 className="font-display text-xl font-bold text-slate-900 dark:text-white">
              Termos de Uso e Política de Privacidade
            </h2>
            <p className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
              A plataforma ELO+ conecta pessoas interessadas em oferecer e contratar serviços por meio de troca mútua de habilidades e conhecimentos, sem uso de dinheiro, em conformidade com a LGPD (Lei nº 13.709/2018).
            </p>
            <p className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
              Seus dados cadastrais são utilizados apenas para exibição do perfil conforme suas configurações de privacidade e autenticação segura. Você pode editar ou excluir sua conta permanentemente a qualquer momento em Configurações.
            </p>
          </div>
          <button
            type="button"
            onClick={() => {
              setAcceptedTerms(true);
              setTermsOpen(false);
            }}
            className="w-full h-12 rounded-xl bg-[#1D3B58] text-white font-semibold text-sm"
          >
            Concordo e fechar
          </button>
        </div>
      </IonModal>

      {/* Google Quick Sign-In Modal */}
      <IonModal isOpen={googleModalOpen} onDidDismiss={() => setGoogleModalOpen(false)}>
        <div className="p-6 py-8 bg-white dark:bg-slate-900 min-h-full flex flex-col justify-start sm:justify-center overflow-y-auto max-w-md mx-auto w-full">
          <h2 className="font-display text-xl font-bold text-slate-900 dark:text-white mb-2">
            Conectar com conta Google
          </h2>
          <p className="text-sm text-slate-600 dark:text-slate-300 mb-6">
            Informe seus dados da conta Google para entrar na ELO+.
          </p>
          <form onSubmit={handleGoogleSignIn} autoComplete="off" className="space-y-4">
            <div>
              <label htmlFor="g-name" className="block text-xs font-medium text-slate-600 dark:text-slate-300 mb-1">
                Nome completo
              </label>
              <input
                id="g-name"
                name="elo_google_name"
                type="text"
                autoComplete="off"
                value={googleName}
                onChange={(e) => setGoogleName(e.target.value)}
                placeholder="Seu nome completo"
                className="w-full h-11 px-3.5 rounded-xl bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-sm text-slate-900 dark:text-white placeholder:text-slate-400"
              />
            </div>
            <div>
              <label htmlFor="g-email" className="block text-xs font-medium text-slate-600 dark:text-slate-300 mb-1">
                E-mail Google
              </label>
              <input
                id="g-email"
                name="elo_google_email"
                type="email"
                autoComplete="off"
                value={googleEmail}
                onChange={(e) => setGoogleEmail(e.target.value)}
                placeholder="seuemail@gmail.com"
                className="w-full h-11 px-3.5 rounded-xl bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-sm text-slate-900 dark:text-white placeholder:text-slate-400"
              />
            </div>
            <div className="pt-2 flex gap-3">
              <button
                type="button"
                onClick={() => setGoogleModalOpen(false)}
                className="flex-1 h-11 rounded-xl border border-slate-300 dark:border-slate-700 text-sm font-medium text-slate-700 dark:text-slate-200"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={loading}
                className="flex-1 h-11 rounded-xl bg-[#1D3B58] text-white text-sm font-semibold"
              >
                Continuar
              </button>
            </div>
          </form>
        </div>
      </IonModal>
    </div>
  );
};
