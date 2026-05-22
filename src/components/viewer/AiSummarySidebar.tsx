import { AnimatePresence, motion } from "framer-motion";
import {
  ArrowRight,
  Loader2,
  Lock,
  Send,
  ShieldAlert,
  Sparkles,
  X,
} from "lucide-react";
import { Button } from "../ui/button";

export type AiSummarySidebarNoticeTone = "default" | "success" | "warning";

export interface AiSummarySidebarMetaItem {
  label: string;
  value: string;
}

export interface AiSummarySidebarChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
}

export interface AiSummarySidebarProps {
  isOpen: boolean;
  onClose: () => void;
  onRequireAuth: () => void;
  title?: string;
  privacyLabel?: string;
  description?: string;
  summary: string | null;
  isSummaryLoading?: boolean;
  summaryEmptyMessage?: string;
  summaryMeta?: AiSummarySidebarMetaItem[];
  summaryNotice?: string | null;
  summaryNoticeTone?: AiSummarySidebarNoticeTone;
  chatMessages?: AiSummarySidebarChatMessage[];
  chatInputValue?: string;
  onChatInputChange?: (value: string) => void;
  onChatSubmit?: () => void;
  onChatFocus?: () => void;
  isChatLoading?: boolean;
  isChatLocked?: boolean;
  chatPlaceholder?: string;
  chatEmptyMessage?: string;
  chatLockTitle?: string;
  chatLockDescription?: string;
  chatCtaLabel?: string;
}

const noticeToneClasses: Record<AiSummarySidebarNoticeTone, string> = {
  default: "border-white/10 bg-white/[0.03] text-slate-400",
  success: "border-emerald-500/20 bg-emerald-500/10 text-emerald-400",
  warning: "border-amber-500/20 bg-amber-500/10 text-amber-300",
};

function SummarySkeleton() {
  return (
    <div className="space-y-2.5" aria-hidden="true">
      <div className="h-3 w-20 bg-white/5 animate-pulse" />
      <div className="h-4 w-full bg-white/5 animate-pulse" />
      <div className="h-4 w-[94%] bg-white/5 animate-pulse" />
      <div className="h-4 w-[88%] bg-white/5 animate-pulse" />
      <div className="h-4 w-[70%] bg-white/5 animate-pulse" />
    </div>
  );
}

export function AiSummarySidebar({
  isOpen,
  onClose,
  onRequireAuth,
  title = "AI Summary",
  privacyLabel = "Investor view",
  description = "Quick overview plus follow-up chat for this document.",
  summary,
  isSummaryLoading = false,
  summaryEmptyMessage = "Summary will appear here when available.",
  summaryMeta = [],
  summaryNotice = null,
  summaryNoticeTone = "default",
  chatMessages = [],
  chatInputValue = "",
  onChatInputChange,
  onChatSubmit,
  onChatFocus,
  isChatLoading = false,
  isChatLocked = false,
  chatPlaceholder = "Ask a follow-up question...",
  chatEmptyMessage = "Ask a follow-up question to explore the summary in more detail.",
  chatLockTitle = "Sign in to continue the conversation",
  chatLockDescription = "Guests can read the summary, but follow-up chat unlocks after sign-in so the conversation can persist to your account.",
  chatCtaLabel = "Continue with account",
}: AiSummarySidebarProps) {
  const showSummaryEmpty = !isSummaryLoading && !summary?.trim();
  const isChatDisabled = isChatLocked || isSummaryLoading || showSummaryEmpty;
  const canSubmit = Boolean(chatInputValue.trim()) && !isChatLoading && !isChatDisabled;

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-black/35 backdrop-blur-[2px] z-[110]"
          />

          <motion.div
            initial={{ opacity: 0, y: -10, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -10, scale: 0.98 }}
            transition={{ duration: 0.18, ease: "easeOut" }}
            className="fixed top-0 right-0 z-[120] flex h-screen w-[min(24rem,100vw)] flex-col overflow-hidden border border-white/10 bg-[#101114] shadow-[0_24px_80px_rgba(0,0,0,0.55)]"
          >
            <div className="border-b border-white/5 bg-[#0f1116] px-4 py-3">
              <div className="flex items-center justify-between gap-3">
                <div className="flex min-w-0 items-center gap-2.5">
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center border border-deckly-primary/20 bg-deckly-primary/10 text-deckly-primary">
                    <Sparkles size={16} />
                  </div>
                  <div className="min-w-0">
                    <h3 className="truncate text-[12px] font-semibold uppercase tracking-[0.22em] text-slate-100">
                      {title}
                    </h3>
                    <div className="mt-0.5 flex items-center gap-1.5">
                      <ShieldAlert size={11} className="text-emerald-500" />
                      <span className="text-[9px] font-bold uppercase tracking-[0.16em] text-emerald-500">
                        {privacyLabel}
                      </span>
                    </div>
                    <p className="mt-1 text-[9px] leading-relaxed text-slate-500">
                      {description}
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={onClose}
                  className="flex h-8 w-8 items-center justify-center border border-white/10 bg-white/[0.03] text-slate-400 transition-colors hover:text-white"
                >
                  <X size={16} />
                </button>
              </div>
            </div>

            <div className="flex min-h-0 flex-1 flex-col">
              <div className="min-h-0 flex-1 overflow-y-auto p-3 custom-scrollbar">
                <div className="space-y-3">
                  <section className="border border-deckly-primary/15 bg-[#0d1016] p-3">
                    <div className="flex items-center justify-between gap-3">
                      <p className="text-[9px] font-semibold uppercase tracking-[0.16em] text-slate-500">
                        Summary
                      </p>
                      {isSummaryLoading ? (
                        <div className="flex items-center gap-1.5 text-[9px] font-semibold uppercase tracking-[0.14em] text-deckly-primary">
                          <Loader2 size={11} className="animate-spin" />
                          Generating
                        </div>
                      ) : null}
                    </div>

                    <div className="mt-3">
                      {isSummaryLoading ? (
                        <SummarySkeleton />
                      ) : showSummaryEmpty ? (
                        <p className="text-sm leading-relaxed text-slate-500">
                          {summaryEmptyMessage}
                        </p>
                      ) : (
                        <p className="whitespace-pre-wrap text-sm leading-relaxed text-slate-100">
                          {summary}
                        </p>
                      )}
                    </div>
                  </section>

                  {(summaryMeta.length > 0 || summaryNotice) && (
                    <section className="space-y-2">
                      {summaryMeta.length > 0 ? (
                        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                          {summaryMeta.map((item) => (
                            <div
                              key={`${item.label}-${item.value}`}
                              className="border border-white/5 bg-black/20 px-3 py-2"
                            >
                              <p className="text-[8px] font-semibold uppercase tracking-[0.18em] text-slate-500">
                                {item.label}
                              </p>
                              <p className="mt-1 text-[11px] font-medium text-slate-200">
                                {item.value}
                              </p>
                            </div>
                          ))}
                        </div>
                      ) : null}

                      {summaryNotice ? (
                        <div
                          className={`border px-3 py-2 text-[10px] leading-relaxed ${noticeToneClasses[summaryNoticeTone]}`}
                        >
                          {summaryNotice}
                        </div>
                      ) : null}
                    </section>
                  )}
                </div>
              </div>

              <div className="mt-auto border-t border-white/5 bg-[#0f1116]">
                <div className="border-b border-white/5 px-3 py-2.5">
                  <p className="text-[9px] font-semibold uppercase tracking-[0.16em] text-slate-500">
                    Follow-up chat
                  </p>
                </div>

                {isChatLocked ? (
                  <div className="space-y-4 p-3">
                    <div className="flex h-10 w-10 items-center justify-center border border-white/10 bg-white/[0.03] text-slate-400">
                      <Lock size={16} />
                    </div>
                    <div className="space-y-2">
                      <h4 className="text-sm font-semibold text-white">
                        {chatLockTitle}
                      </h4>
                      <p className="text-xs leading-relaxed text-slate-400">
                        {chatLockDescription}
                      </p>
                    </div>
                    <Button
                      onClick={onRequireAuth}
                      className="bg-deckly-primary px-4 font-semibold text-slate-950 hover:bg-deckly-primary/90"
                    >
                      {chatCtaLabel}
                      <ArrowRight size={14} />
                    </Button>
                  </div>
                ) : (
                  <div className="flex min-h-0 flex-1 flex-col">
                    <div className="flex-1 min-h-0 space-y-3 overflow-y-auto px-3 py-3 custom-scrollbar">
                      {chatMessages.length === 0 ? (
                        <p className="text-xs leading-relaxed text-slate-500">
                          {chatEmptyMessage}
                        </p>
                      ) : (
                        chatMessages.map((message) => {
                          const isUser = message.role === "user";

                          return (
                            <div
                              key={message.id}
                              className={`border px-3 py-2 text-sm leading-relaxed ${isUser ? "ml-8 border-deckly-primary/20 bg-deckly-primary/8 text-slate-100" : "mr-8 border-white/10 bg-white/[0.03] text-slate-300"}`}
                            >
                              <p className="mb-1 text-[8px] font-semibold uppercase tracking-[0.16em] text-slate-500">
                                {isUser ? "You" : "Deckly AI"}
                              </p>
                              <p className="whitespace-pre-wrap">{message.content}</p>
                            </div>
                          );
                        })
                      )}

                      {isChatLoading ? (
                        <div className="mr-8 flex items-center gap-2 border border-white/10 bg-white/[0.03] px-3 py-2 text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-400">
                          <Loader2 size={11} className="animate-spin" />
                          Thinking...
                        </div>
                      ) : null}
                    </div>

                    <div className="border-t border-white/5 p-3">
                      <div className="border border-white/10 bg-[#0d1016] p-2">
                        <textarea
                          value={chatInputValue}
                          onChange={(event) => onChatInputChange?.(event.target.value)}
                          onFocus={() => onChatFocus?.()}
                          placeholder={chatPlaceholder}
                          disabled={isChatDisabled}
                          className="min-h-[4.5rem] w-full resize-none border-none bg-transparent text-sm leading-relaxed text-slate-100 outline-none placeholder:text-slate-500 disabled:cursor-not-allowed disabled:text-slate-600"
                        />
                        <div className="mt-2 flex items-center justify-between gap-3">
                          <p className="text-[9px] text-slate-500">
                            Chat stays scoped to this summary session
                          </p>
                          <button
                            type="button"
                            onClick={() => onChatSubmit?.()}
                            disabled={!canSubmit}
                            className="flex h-8 w-8 items-center justify-center border border-deckly-primary/20 bg-deckly-primary/10 text-deckly-primary transition-colors disabled:cursor-not-allowed disabled:border-white/10 disabled:bg-white/[0.03] disabled:text-slate-600"
                          >
                            <Send size={14} />
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
