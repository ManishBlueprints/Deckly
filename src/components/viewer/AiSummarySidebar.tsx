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

type AiFormattedBlock =
  | { type: "heading"; content: string }
  | { type: "bullet"; content: string }
  | { type: "paragraph"; content: string };

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

const normalizeAiContent = (value: string): string =>
  value
    .replace(/\r\n?/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();

const parseAiFormattedBlocks = (value: string): AiFormattedBlock[] => {
  const normalized = normalizeAiContent(value);
  if (!normalized) return [];

  const lines = normalized.split("\n");
  const blocks: AiFormattedBlock[] = [];
  let paragraphBuffer: string[] = [];

  const flushParagraph = () => {
    if (paragraphBuffer.length === 0) return;
    const content = paragraphBuffer.join(" ").replace(/\s+/g, " ").trim();
    if (content) {
      blocks.push({ type: "paragraph", content });
    }
    paragraphBuffer = [];
  };

  for (const rawLine of lines) {
    const line = rawLine.trim();

    if (!line) {
      flushParagraph();
      continue;
    }

    const boldHeadingMatch = line.match(/^\*\*(.+?)\*\*$/);
    if (boldHeadingMatch) {
      flushParagraph();
      blocks.push({
        type: "heading",
        content: boldHeadingMatch[1]?.trim() ?? line,
      });
      continue;
    }

    const plainHeadingMatch = line.match(/^\d+\.\s*(.+)$/);
    if (plainHeadingMatch && line.length <= 80) {
      flushParagraph();
      blocks.push({
        type: "heading",
        content: plainHeadingMatch[1]?.trim() ?? line,
      });
      continue;
    }

    const bulletMatch = line.match(/^[-•]\s+(.+)$/);
    if (bulletMatch) {
      flushParagraph();
      blocks.push({
        type: "bullet",
        content: bulletMatch[1]?.trim() ?? line,
      });
      continue;
    }

    paragraphBuffer.push(line);
  }

  flushParagraph();
  return blocks;
};

function renderInlineEmphasis(content: string) {
  const segments = content.split(/(\*\*.*?\*\*)/g).filter(Boolean);

  return segments.map((segment, index) => {
    const strongMatch = segment.match(/^\*\*(.*?)\*\*$/);
    if (strongMatch) {
      return (
        <strong key={`${segment}-${index}`} className="font-semibold text-slate-100">
          {strongMatch[1]}
        </strong>
      );
    }

    return <span key={`${segment}-${index}`}>{segment}</span>;
  });
}

function FormattedAiContent({
  content,
  variant = "summary",
}: {
  content: string;
  variant?: "summary" | "chat";
}) {
  const blocks = parseAiFormattedBlocks(content);

  if (blocks.length === 0) {
    return <p className="text-sm leading-relaxed text-slate-100">{content}</p>;
  }

  return (
    <div className={variant === "summary" ? "space-y-4" : "space-y-3"}>
      {blocks.map((block, index) => {
        if (block.type === "heading") {
          return (
            <div
              key={`${block.type}-${index}-${block.content}`}
              className="border-l-2 border-deckly-primary/40 pl-3"
            >
              <h4 className="text-[13px] font-semibold tracking-tight text-white">
                {renderInlineEmphasis(block.content)}
              </h4>
            </div>
          );
        }

        if (block.type === "bullet") {
          return (
            <div
              key={`${block.type}-${index}-${block.content}`}
              className="flex items-start gap-2.5 text-[13px] leading-6 text-slate-200"
            >
              <span className="mt-[8px] h-1.5 w-1.5 shrink-0 rounded-full bg-deckly-primary/70" />
              <p>{renderInlineEmphasis(block.content)}</p>
            </div>
          );
        }

        return (
          <p
            key={`${block.type}-${index}-${block.content}`}
            className={`text-[13px] leading-6 ${variant === "summary" ? "text-slate-200" : "text-slate-300"}`}
          >
            {renderInlineEmphasis(block.content)}
          </p>
        );
      })}
    </div>
  );
}

function SummaryLoadingState() {
  return (
    <div className="space-y-4">
      <div className="rounded-sm border border-deckly-primary/10 bg-deckly-primary/[0.04] px-3 py-2">
        <p className="text-[11px] font-medium text-slate-200">
          Deckly AI is reviewing the deck from a startup investor perspective.
        </p>
        <p className="mt-1 text-[10px] leading-relaxed text-slate-500">
          Pulling out the company story, market signals, traction, risks, and the main points investors would care about.
        </p>
      </div>
      <SummarySkeleton />
      <p className="text-[10px] leading-relaxed text-slate-500">
        This usually takes a few seconds. The summary will appear here automatically when it is ready.
      </p>
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
  const handleChatKeyDown = (event: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key !== "Enter" || event.shiftKey) {
      return;
    }

    event.preventDefault();
    if (canSubmit) {
      onChatSubmit?.();
    }
  };

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
                          Building investor summary
                        </div>
                      ) : null}
                    </div>

                    <div className="mt-3">
                      {isSummaryLoading ? (
                        <SummaryLoadingState />
                      ) : showSummaryEmpty ? (
                        <p className="text-sm leading-relaxed text-slate-500">
                          {summaryEmptyMessage}
                        </p>
                      ) : (
                        <FormattedAiContent content={summary ?? ""} variant="summary" />
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

              <div className="flex min-h-0 max-h-[52vh] flex-col overflow-hidden border-t border-white/5 bg-[#0f1116]">
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
                  <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
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
                              {isUser ? (
                                <p className="whitespace-pre-wrap">{message.content}</p>
                              ) : (
                                <FormattedAiContent content={message.content} variant="chat" />
                              )}
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
                          onKeyDown={handleChatKeyDown}
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
