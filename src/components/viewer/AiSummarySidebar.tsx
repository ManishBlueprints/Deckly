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

interface AiSummaryScoreItem {
  label: string;
  score: number;
  detail: string | null;
}

interface AiScorecardSchemaEntry {
  label: string;
  keys: string[];
}

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

const AI_SCORECARD_LABELS = [
  "Market",
  "Team",
  "Execution / stage",
  "Traction",
  "Go-to-market",
  "Business model",
  "Startup potential",
  "Investor readiness / evidence quality",
] as const;

const AI_SCORECARD_SCHEMA: AiScorecardSchemaEntry[] = [
  { label: "Market", keys: ["market"] },
  { label: "Team", keys: ["team"] },
  { label: "Execution / stage", keys: ["execution_stage", "execution", "stage"] },
  { label: "Traction", keys: ["traction"] },
  { label: "Go-to-market", keys: ["go_to_market", "gtm"] },
  { label: "Business model", keys: ["business_model"] },
  { label: "Startup potential", keys: ["startup_potential"] },
  {
    label: "Investor readiness / evidence quality",
    keys: ["investor_readiness", "evidence_quality", "investor_readiness_evidence_quality"],
  },
] as const;

const normalizeHeadingLabel = (value: string): string =>
  value
    .replace(/^#+\s*/, "")
    .replace(/^\*\*|\*\*$/g, "")
    .replace(/^\d+\.\s*/, "")
    .trim()
    .toLowerCase();

const matchScorecardLine = (line: string) =>
  line.match(
    /^[-•]?\s*(?:\*\*)?(Market|Team|Execution\s*\/\s*stage|Traction|Go-to-market|Business model|Startup potential|Investor readiness\s*\/\s*evidence quality)(?:\*\*)?\s*:\s*(\d{1,3})\s*%?\s*(?:[–-]\s*(.+)|\((.+)\))?$/i,
  );

const parseStructuredScorecard = (value: string): {
  scorecard: AiSummaryScoreItem[];
  contentWithoutBlock: string;
} => {
  const match = value.match(/<scorecard_json>\s*([\s\S]*?)\s*<\/scorecard_json>/i);
  if (!match) {
    return {
      scorecard: [],
      contentWithoutBlock: value,
    };
  }

  const contentWithoutBlock = normalizeAiContent(value.replace(match[0], ""));
  const rawJson = match[1]?.trim();
  if (!rawJson) {
    return {
      scorecard: [],
      contentWithoutBlock,
    };
  }

  try {
    const parsed = JSON.parse(rawJson) as Record<string, unknown>;
    const scorecard = AI_SCORECARD_SCHEMA.flatMap((entry) => {
      const rawValue = entry.keys
        .map((key) => parsed[key])
        .find((candidate) => candidate !== undefined);

      if (rawValue === undefined) {
        return [];
      }

      if (typeof rawValue === "number") {
        return [
          {
            label: entry.label,
            score: Math.max(0, Math.min(Math.round(rawValue), 100)),
            detail: null,
          },
        ];
      }

      if (rawValue && typeof rawValue === "object") {
        const rawObject = rawValue as Record<string, unknown>;
        const scoreValue =
          typeof rawObject.score === "number"
            ? rawObject.score
            : typeof rawObject.value === "number"
              ? rawObject.value
              : null;

        if (scoreValue === null) {
          return [];
        }

        const detail =
          typeof rawObject.detail === "string"
            ? rawObject.detail.trim()
            : typeof rawObject.reason === "string"
              ? rawObject.reason.trim()
              : null;

        return [
          {
            label: entry.label,
            score: Math.max(0, Math.min(Math.round(scoreValue), 100)),
            detail: detail || null,
          },
        ];
      }

      return [];
    });

    return {
      scorecard,
      contentWithoutBlock,
    };
  } catch {
    return {
      scorecard: [],
      contentWithoutBlock,
    };
  }
};

const parseAiSummaryExtras = (value: string): {
  scorecard: AiSummaryScoreItem[];
  standouts: string[];
  remainingContent: string;
} => {
  const normalized = normalizeAiContent(value);
  if (!normalized) {
    return {
      scorecard: [],
      standouts: [],
      remainingContent: "",
    };
  }

  const structured = parseStructuredScorecard(normalized);

  const lines = structured.contentWithoutBlock.split("\n");
  const remainingLines: string[] = [];
  const scorecard: AiSummaryScoreItem[] = [...structured.scorecard];
  const standouts: string[] = [];
  let mode: "scorecard" | "standouts" | null = null;

  for (const rawLine of lines) {
    const line = rawLine.trim();
    const heading = normalizeHeadingLabel(line);

    if (heading === "scorecard") {
      mode = "scorecard";
      continue;
    }

    if (heading === "standouts from deck") {
      mode = "standouts";
      continue;
    }

    if (
      mode &&
      heading &&
      heading !== line.toLowerCase() &&
      heading !== "scorecard" &&
      heading !== "standouts from deck"
    ) {
      mode = null;
    }

    const scoreMatch = matchScorecardLine(line);
    if (scoreMatch) {
      const rawLabel = scoreMatch[1] ?? "";
      const matchedLabel =
        AI_SCORECARD_LABELS.find(
          (label) =>
            label.toLowerCase().replace(/\s+/g, " ").trim() ===
            rawLabel.toLowerCase().replace(/\s+/g, " ").trim(),
        ) ?? rawLabel;
      if (scorecard.some((item) => item.label === matchedLabel)) {
        continue;
      }
      const rawScore = Number(scoreMatch[2] ?? 0);
      scorecard.push({
        label: matchedLabel,
        score: Math.max(0, Math.min(rawScore, 100)),
        detail: scoreMatch[3]?.trim() ?? scoreMatch[4]?.trim() ?? null,
      });
      continue;
    }

    if (mode === "standouts") {
      const standoutMatch = line.match(/^[-•]\s+(.+)$/);
      if (standoutMatch) {
        standouts.push(standoutMatch[1]?.trim() ?? line);
        continue;
      }
    }

    if (heading === "scorecard" || heading === "standouts from deck") {
      continue;
    }

    remainingLines.push(rawLine);
  }

  const cleanedRemainingContent = normalizeAiContent(
    remainingLines
      .filter((rawLine) => {
        const heading = normalizeHeadingLabel(rawLine.trim());
        return heading !== "scorecard";
      })
      .join("\n"),
  );

  return {
    scorecard,
    standouts,
    remainingContent: cleanedRemainingContent,
  };
};

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
    const heading = normalizeHeadingLabel(line);

    if (!line) {
      flushParagraph();
      continue;
    }

    if (heading === "scorecard") {
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

function SummaryScorecard({
  items,
}: {
  items: AiSummaryScoreItem[];
}) {
  if (items.length === 0) return null;

  return (
    <section className="space-y-3 border border-white/5 bg-black/20 p-3">
      <div className="space-y-2.5">
        {items.map((item) => (
          <div key={item.label} className="group relative">
            <div className="relative h-9 overflow-hidden rounded-md border border-emerald-500/15 bg-[#171b22] shadow-[inset_0_1px_0_rgba(255,255,255,0.02)]">
              <div
                className="absolute inset-y-0 left-0 rounded-md bg-gradient-to-r from-[#38c976] to-[#67e79a] transition-[width] duration-500"
                style={{ width: `${item.score}%` }}
              />
              <div className="absolute inset-0 bg-[linear-gradient(90deg,rgba(255,255,255,0.08)_0,rgba(255,255,255,0)_24px)] opacity-30" />
              <div className="absolute inset-0 flex items-center justify-between px-3">
                <span className="text-[11px] font-semibold text-white drop-shadow-[0_1px_1px_rgba(0,0,0,0.55)]">
                  {item.label}
                </span>
                <span className="text-[11px] font-semibold text-white drop-shadow-[0_1px_1px_rgba(0,0,0,0.55)]">
                  {item.score}%
                </span>
              </div>
            </div>
            {item.detail ? (
              <div className="pointer-events-none absolute left-0 top-full z-20 mt-2 hidden w-[19rem] rounded-md border border-white/10 bg-[#11141b] p-3 text-[11px] leading-relaxed text-slate-300 shadow-[0_18px_40px_rgba(0,0,0,0.45)] group-hover:block">
                <p className="mb-1 text-[9px] font-semibold uppercase tracking-[0.16em] text-deckly-primary">
                  {item.label}
                </p>
                <p>{item.detail}</p>
              </div>
            ) : null}
          </div>
        ))}
      </div>
    </section>
  );
}

function SummaryStandouts({
  items,
}: {
  items: string[];
}) {
  if (items.length === 0) return null;

  return (
    <section className="space-y-2 border border-white/5 bg-black/20 p-3">
      <p className="text-[9px] font-semibold uppercase tracking-[0.16em] text-slate-500">
        Standouts from deck
      </p>
      <div className="space-y-2">
        {items.map((item, index) => (
          <div
            key={`${item}-${index}`}
            className="flex items-start gap-2.5 text-[13px] leading-6 text-slate-200"
          >
            <span className="mt-[8px] h-1.5 w-1.5 shrink-0 rounded-full bg-deckly-primary/70" />
            <p>{renderInlineEmphasis(item)}</p>
          </div>
        ))}
      </div>
    </section>
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
  const parsedSummary = summary ? parseAiSummaryExtras(summary) : null;
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
            className="fixed inset-0 bg-black/35 backdrop-blur-[2px] z-[var(--ui-layer-viewer)]"
          />

          <motion.div
            initial={{ opacity: 0, y: -10, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -10, scale: 0.98 }}
            transition={{ duration: 0.18, ease: "easeOut" }}
            className="fixed top-0 right-0 z-[var(--ui-layer-viewer)] flex h-screen w-[min(24rem,100vw)] flex-col overflow-hidden border border-white/10 bg-[#101114] shadow-[0_24px_80px_rgba(0,0,0,0.55)]"
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
                  aria-label="Close chat"
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

                    <div className="mt-2">
                      {isSummaryLoading ? (
                        <SummaryLoadingState />
                      ) : showSummaryEmpty ? (
                        <p className="text-sm leading-relaxed text-slate-500">
                          {summaryEmptyMessage}
                        </p>
                      ) : (
                        <div className="space-y-3">
                          <SummaryScorecard items={parsedSummary?.scorecard ?? []} />
                          <SummaryStandouts items={parsedSummary?.standouts ?? []} />
                          <FormattedAiContent
                            content={parsedSummary?.remainingContent ?? summary ?? ""}
                            variant="summary"
                          />
                        </div>
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
                  <section className="border-t border-white/5 bg-[#0f1116]">
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
                      <div className="space-y-3 px-3 py-3">
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

                        <div className="border-t border-white/5 pt-3">
                          <div className="border border-white/10 bg-[#0d1016] p-2">
                            <textarea
                              value={chatInputValue}
                              onChange={(event) => onChatInputChange?.(event.target.value)}
                              onKeyDown={handleChatKeyDown}
                              onFocus={() => onChatFocus?.()}
                              aria-label="Chat message"
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
                                aria-label="Send message"
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
                  </section>
                </div>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
