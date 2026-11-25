import React, { useEffect, useRef, useState } from 'react';
import { IonIcon } from '@ionic/react';
import { arrowBackOutline, sendOutline, swapHorizontalOutline } from 'ionicons/icons';
import { UserAvatar } from './UserAvatar';
import type { ConversationThread, UserProfile } from '../shared/types';

interface MessagesViewProps {
  user: UserProfile;
  conversations: ConversationThread[];
  activeParticipantId: string | null;
  onSelectConversation: (participantId: string | null) => void;
  onMarkConversationRead: (participantId: string) => void;
  onSendMessage: (participantId: string, text: string) => Promise<void>;
  onProposeExchangeFromChat: (thread: ConversationThread) => void;
}

export const MessagesView: React.FC<MessagesViewProps> = ({
  user,
  conversations,
  activeParticipantId,
  onSelectConversation,
  onMarkConversationRead,
  onSendMessage,
  onProposeExchangeFromChat,
}) => {
  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState<string | null>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);

  const activeThread =
    conversations.find((c) => c.participantId === activeParticipantId) ?? conversations[0] ?? null;

  useEffect(() => {
    setSendError(null);
  }, [activeThread?.participantId]);

  useEffect(() => {
    if (activeThread && activeThread.unreadCount > 0) {
      onMarkConversationRead(activeThread.participantId);
    }
  }, [activeThread, onMarkConversationRead]);

  useEffect(() => {
    const el = messagesContainerRef.current;
    if (el) {
      el.scrollTop = el.scrollHeight;
    }
  }, [activeThread?.id, activeThread?.messages.length]);

  const submitMessage = async () => {
    const cleanText = draft.trim();
    if (!activeThread || !cleanText || sending) return;
    setSendError(null);
    setSending(true);
    try {
      await onSendMessage(activeThread.participantId, cleanText);
      setDraft('');
    } catch (err) {
      const msg =
        err instanceof Error && err.message.trim()
          ? err.message
          : 'Não foi possível enviar a mensagem. Tente novamente.';
      setSendError(msg);
    } finally {
      setSending(false);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    void submitMessage();
  };

  return (
    <div className="space-y-4 pb-6">
      <div>
        <h1 className="font-display text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-white">
          Mensagens
        </h1>
        <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
          Converse com criadores e alinhe colaborações em projetos.
        </p>
      </div>

      {conversations.length === 0 ? (
        <div className="rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-8 text-center">
          <p className="font-medium text-slate-700 dark:text-slate-200">
            Você ainda não iniciou conversas.
          </p>
          <p className="text-xs text-slate-500 mt-1">
            Explore os destaques na tela inicial para mandar sua primeira mensagem.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 min-h-[480px]">
          {/* Threads list */}
          <div
            className={`lg:col-span-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 divide-y divide-slate-100 dark:divide-slate-800 overflow-hidden ${
              activeParticipantId ? 'hidden lg:block' : 'block'
            }`}
          >
            {conversations.map((thread) => {
              const lastMsg = thread.messages[thread.messages.length - 1];
              const isSelected = activeThread?.participantId === thread.participantId;
              return (
                <button
                  key={thread.id}
                  type="button"
                  onClick={() => onSelectConversation(thread.participantId)}
                  className={`w-full text-left p-4 flex items-center gap-3 transition-colors ${
                    isSelected
                      ? 'bg-[#1D3B58]/5 dark:bg-slate-800'
                      : 'hover:bg-slate-50 dark:hover:bg-slate-800/50'
                  }`}
                >
                  <UserAvatar
                    src={thread.participantAvatarUrl}
                    name={thread.participantName}
                    className="w-12 h-12 rounded-full shrink-0"
                  />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-display font-bold text-sm text-slate-900 dark:text-white truncate">
                        {thread.participantName}
                      </span>
                      <div className="flex items-center gap-1.5 shrink-0">
                        {thread.unreadCount > 0 && (
                          <span className="min-w-[18px] h-[18px] px-1 rounded-full bg-[#51A644] text-white text-[10px] font-bold flex items-center justify-center tabular-nums">
                            {thread.unreadCount}
                          </span>
                        )}
                        <span className="text-[11px] text-slate-400 truncate max-w-[110px]">
                          {thread.participantRole}
                        </span>
                      </div>
                    </div>
                    <p className="text-xs text-slate-500 dark:text-slate-400 truncate mt-0.5">
                      {lastMsg ? lastMsg.text : 'Iniciar conversa'}
                    </p>
                  </div>
                </button>
              );
            })}
          </div>

          {/* Active Chat Thread */}
          <div
            className={`lg:col-span-8 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 flex flex-col overflow-hidden ${
              activeParticipantId ? 'flex' : 'hidden lg:flex'
            }`}
          >
            {activeThread ? (
              <>
                <div className="p-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <button
                      type="button"
                      onClick={() => onSelectConversation(null)}
                      aria-label="Voltar para lista de conversas"
                      className="lg:hidden min-w-[40px] min-h-[40px] flex items-center justify-center rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 shrink-0"
                    >
                      <IonIcon icon={arrowBackOutline} className="text-xl" />
                    </button>
                    <UserAvatar
                      src={activeThread.participantAvatarUrl}
                      name={activeThread.participantName}
                      className="w-10 h-10 rounded-full shrink-0"
                    />
                    <div className="min-w-0">
                      <p className="font-display font-bold text-sm text-slate-900 dark:text-white truncate">
                        {activeThread.participantName}
                      </p>
                      <p className="text-xs text-slate-500 dark:text-slate-400 truncate">
                        {activeThread.participantRole}
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => onProposeExchangeFromChat(activeThread)}
                    className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-[#51A644] hover:bg-[#448e39] text-white text-xs font-semibold shrink-0 transition-colors"
                  >
                    <IonIcon icon={swapHorizontalOutline} className="text-sm" />
                    <span>Propor troca</span>
                  </button>
                </div>

                <div
                  ref={messagesContainerRef}
                  className="flex-1 p-4 space-y-3 overflow-y-auto max-h-[380px]"
                >
                  {activeThread.messages.length === 0 ? (
                    <p className="text-center text-xs text-slate-400 py-8">
                      Envie a primeira mensagem para {activeThread.participantName}.
                    </p>
                  ) : (
                    activeThread.messages.map((msg) => {
                      const isMine = msg.senderId === user.id;
                      return (
                        <div
                          key={msg.id}
                          className={`flex ${isMine ? 'justify-end' : 'justify-start'}`}
                        >
                          <div
                            className={`max-w-[80%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed break-words ${
                              isMine
                                ? 'bg-[#1D3B58] text-white rounded-br-sm'
                                : 'bg-slate-100 dark:bg-slate-800 text-slate-900 dark:text-slate-100 rounded-bl-sm'
                            }`}
                          >
                            <p>{msg.text}</p>
                            <span
                              className={`block text-[10px] mt-1 tabular-nums ${
                                isMine ? 'text-slate-300' : 'text-slate-400'
                              }`}
                            >
                              {new Date(msg.sentAt).toLocaleTimeString('pt-BR', {
                                hour: '2-digit',
                                minute: '2-digit',
                              })}
                            </span>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>

                {sendError && (
                  <div
                    role="alert"
                    className="mx-3 mt-2 rounded-xl bg-red-50 dark:bg-red-950/50 border border-red-200 dark:border-red-800 px-3 py-2 text-xs text-red-700 dark:text-red-300"
                  >
                    {sendError}
                  </div>
                )}

                <form
                  onSubmit={handleSubmit}
                  className="p-3 border-t border-slate-100 dark:border-slate-800 flex items-center gap-2"
                >
                  <label htmlFor="chat-input" className="sr-only">
                    Escreva uma mensagem
                  </label>
                  <input
                    id="chat-input"
                    type="text"
                    value={draft}
                    maxLength={1000}
                    autoComplete="off"
                    onChange={(e) => {
                      setDraft(e.target.value);
                      if (sendError) setSendError(null);
                    }}
                    placeholder={`Mensagem para ${activeThread.participantName}...`}
                    className="flex-1 min-w-0 h-11 px-4 rounded-xl bg-slate-100 dark:bg-slate-800 text-sm text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-[#1D3B58]/30 dark:focus:ring-[#77BC43]/40"
                  />
                  <button
                    type="submit"
                    disabled={sending || !draft.trim()}
                    aria-label="Enviar mensagem"
                    className="h-11 px-4 rounded-xl bg-[#1D3B58] hover:bg-[#162f47] text-white font-semibold text-sm flex items-center gap-1.5 shrink-0 whitespace-nowrap disabled:opacity-50 transition-colors"
                  >
                    <IonIcon icon={sendOutline} />
                    <span>{sending ? 'Enviando...' : 'Enviar'}</span>
                  </button>
                </form>
              </>
            ) : null}
          </div>
        </div>
      )}
    </div>
  );
};
