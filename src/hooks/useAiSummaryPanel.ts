import { useCallback, useRef, useState } from "react";
import {
  aiSummaryService,
  type AiSummaryChatMessage,
  type AiSummaryChatResult,
} from "../services/aiSummaryService";
import { analyticsService } from "../services/analyticsService";
import type { AiSummaryInitialResult } from "../services/aiSummaryInitialOrchestrator";
import type { AiScopeType } from "../services/aiScopeResolutionBuilder";

export interface AiSummaryPanelScope {
  scope_type: AiScopeType;
  scope_id: string;
  scope_label?: string | null;
}

export interface AiSummaryPanelMetaItem {
  label: string;
  value: string;
}

export interface UseAiSummaryPanelOptions {
  onRequireAuth: () => void;
  isGuest: boolean;
}

export interface AiSummaryPanelState {
  isOpen: boolean;
  isSummaryLoading: boolean;
  isChatLoading: boolean;
  summary: string | null;
  summaryMeta: AiSummaryPanelMetaItem[];
  summaryNotice: string | null;
  summaryNoticeTone: "default" | "success" | "warning";
  chatMessages: AiSummaryChatMessage[];
  chatInputValue: string;
  isChatLocked: boolean;
  activeScope: AiSummaryPanelScope | null;
  activeResult: AiSummaryInitialResult | null;
}

const formatCount = (count: number, singular: string, plural?: string) =>
  `${count} ${count === 1 ? singular : plural ?? `${singular}s`}`;

const getSummaryNotice = (result: AiSummaryInitialResult): {
  notice: string | null;
  tone: "default" | "success" | "warning";
} => {
  if (result.status === "quota_limited") {
    const quota = result.usage.quota;
    if (quota?.scope === "guest") {
      return {
        notice: "Guests get one AI summary per day from this IP. Sign in to continue exploring without waiting.",
        tone: "warning",
      };
    }

    return {
      notice: "You’ve reached today’s AI summary limit for your plan. Upgrade to keep generating fresh summaries.",
      tone: "warning",
    };
  }

  if (result.no_content) {
    return {
      notice: "This scope has no extractable text, so there is nothing to summarize yet.",
      tone: "warning",
    };
  }

  if (result.partial_data) {
    return {
      notice: "Some files were excluded, so the summary reflects only the extractable content.",
      tone: "default",
    };
  }

  if (result.status === "cached") {
    return {
      notice: "Reopened from cache without consuming another summary request.",
      tone: "success",
    };
  }

  return {
    notice: null,
    tone: "default",
  };
};

const buildSummaryMeta = (result: AiSummaryInitialResult): AiSummaryPanelMetaItem[] => [
  {
    label: "Scope",
    value: result.scope.scope_label ?? result.scope.scope_id,
  },
  {
    label: "Sources",
    value: formatCount(result.metadata.total_sources, "file"),
  },
  {
    label: "Included",
    value: formatCount(result.metadata.included_sources, "file"),
  },
  {
    label: "Excluded",
    value: formatCount(result.metadata.excluded_sources, "file"),
  },
  {
    label: "Strategy",
    value: result.strategy ? result.strategy.replace("_", " ") : "No content",
  },
  {
    label: "Freshness",
    value: result.cache.cached_reopen ? "Cached reopen" : result.freshness.state,
  },
];

const getSummaryText = (result: AiSummaryInitialResult | null): string | null =>
  result?.summary_text ?? null;

export function useAiSummaryPanel({ onRequireAuth, isGuest }: UseAiSummaryPanelOptions) {
  const [isOpen, setIsOpen] = useState(false);
  const [isSummaryLoading, setIsSummaryLoading] = useState(false);
  const [isChatLoading, setIsChatLoading] = useState(false);
  const [summaryResult, setSummaryResult] = useState<AiSummaryInitialResult | null>(null);
  const [chatMessages, setChatMessages] = useState<AiSummaryChatMessage[]>([]);
  const [chatInputValue, setChatInputValue] = useState("");
  const [activeScope, setActiveScope] = useState<AiSummaryPanelScope | null>(null);
  const [summaryNotice, setSummaryNotice] = useState<string | null>(null);
  const [summaryNoticeTone, setSummaryNoticeTone] =
    useState<AiSummaryPanelState["summaryNoticeTone"]>("default");
  const activeRequestKeyRef = useRef<string | null>(null);

  const isChatLocked = isGuest;

  const setResultState = useCallback((result: AiSummaryInitialResult) => {
    setSummaryResult(result);
    const notice = getSummaryNotice(result);
    setSummaryNotice(notice.notice);
    setSummaryNoticeTone(notice.tone);
  }, []);

  const open = useCallback(() => setIsOpen(true), []);
  const close = useCallback(() => setIsOpen(false), []);

  const requestSummary = useCallback(async (scope: AiSummaryPanelScope) => {
    const requestKey = `${scope.scope_type}:${scope.scope_id}`;
    setActiveScope(scope);
    setIsOpen(true);

    analyticsService.trackAiSummaryRequested({
      scope_type: scope.scope_type,
      scope_id: scope.scope_id,
      scope_label: scope.scope_label ?? null,
      auth_state: isGuest ? "guest" : "signed_in",
    });

    activeRequestKeyRef.current = requestKey;
    setChatMessages([]);
    setChatInputValue("");
    setIsSummaryLoading(true);
    setSummaryNotice(null);
    setSummaryNoticeTone("default");

    try {
      const result = await aiSummaryService.summarizeScope({
        scope_type: scope.scope_type,
        scope_id: scope.scope_id,
        title: scope.scope_label ?? null,
      });
      setResultState(result);
      analyticsService.trackAiSummaryResolved({
        scope_type: scope.scope_type,
        scope_id: scope.scope_id,
        scope_label: scope.scope_label ?? null,
        auth_state: isGuest ? "guest" : "signed_in",
        status: result.status,
        cache_state: result.cache.state,
        cached_reopen: result.cache.cached_reopen,
        partial_data: result.partial_data,
        no_content: result.no_content,
        usage_count: result.usage.usage_count,
        quota_limit: result.usage.quota?.limitPer24Hours ?? null,
        quota_remaining: result.usage.quota?.remaining ?? null,
        quota_scope: result.usage.quota?.scope ?? null,
      });
      return result;
    } catch (error) {
      analyticsService.trackAiSummaryResolved({
        scope_type: scope.scope_type,
        scope_id: scope.scope_id,
        scope_label: scope.scope_label ?? null,
        auth_state: isGuest ? "guest" : "signed_in",
        status: "error",
        error_message: error instanceof Error ? error.message : String(error),
      });
      throw error;
    } finally {
      setIsSummaryLoading(false);
    }
  }, [isGuest, setResultState]);

  const submitChat = useCallback(async () => {
    if (!activeScope || !summaryResult) return;

    const question = chatInputValue.trim();
    if (!question) return;

    if (!summaryResult.summary_text) {
      return;
    }

    analyticsService.trackAiSummaryChatSubmitted({
      scope_type: activeScope.scope_type,
      scope_id: activeScope.scope_id,
      scope_label: activeScope.scope_label ?? null,
      auth_state: isGuest ? "guest" : "signed_in",
    });

    setIsChatLoading(true);
    const userMessageId = `user-${Date.now()}`;
    const userMessage: AiSummaryChatMessage = {
      id: userMessageId,
      role: "user",
      content: question,
    };
    setChatMessages((prev) => [...prev, userMessage]);
    setChatInputValue("");

    try {
      const result: AiSummaryChatResult = await aiSummaryService.sendChatMessage({
        scope_type: activeScope.scope_type,
        scope_id: activeScope.scope_id,
        content_hash: summaryResult.scope.content_hash,
        question,
        title: activeScope.scope_label ?? null,
        summary_text: getSummaryText(summaryResult),
      });

      if (Array.isArray(result.messages) && result.messages.length > 0) {
        const assistantMessage = [...result.messages].reverse().find((message) => message.role === "assistant");
        if (assistantMessage) {
          setChatMessages((prev) => [...prev, assistantMessage]);
        }
      } else if (result.assistant_message) {
        setChatMessages((prev) => [...prev, result.assistant_message as AiSummaryChatMessage]);
      }

      analyticsService.trackAiSummaryChatResolved({
        scope_type: activeScope.scope_type,
        scope_id: activeScope.scope_id,
        scope_label: activeScope.scope_label ?? null,
        auth_state: isGuest ? "guest" : "signed_in",
        status: "completed",
        session_id: result.session_id,
        message_count: Array.isArray(result.messages) ? result.messages.length : null,
      });
    } catch (error) {
      const status = (error as { status?: number } | null)?.status;
      setChatMessages((prev) => prev.filter((message) => message.id !== userMessageId));
      setChatInputValue(question);
      analyticsService.trackAiSummaryChatResolved({
        scope_type: activeScope.scope_type,
        scope_id: activeScope.scope_id,
        scope_label: activeScope.scope_label ?? null,
        auth_state: isGuest ? "guest" : "signed_in",
        status: status === 401 || status === 403 ? "auth_required" : "error",
        error_message: error instanceof Error ? error.message : String(error),
      });
      if (status === 401 || status === 403) {
        analyticsService.trackAiSummaryAuthPrompt({
          scope_type: activeScope.scope_type,
          scope_id: activeScope.scope_id,
          scope_label: activeScope.scope_label ?? null,
          auth_state: isGuest ? "guest" : "signed_in",
          status: "chat_locked",
        });
        onRequireAuth();
      }
    } finally {
      setIsChatLoading(false);
    }
  }, [activeScope, chatInputValue, isGuest, onRequireAuth, summaryResult]);

  const state: AiSummaryPanelState = {
    isOpen,
    isSummaryLoading,
    isChatLoading,
    summary: getSummaryText(summaryResult),
    summaryMeta: summaryResult ? buildSummaryMeta(summaryResult) : [],
    summaryNotice,
    summaryNoticeTone,
    chatMessages,
    chatInputValue,
    isChatLocked,
    activeScope,
    activeResult: summaryResult,
  };

  return {
    state,
    open,
    close,
    requestSummary,
    setChatInputValue,
    submitChat,
    setIsOpen,
    setChatMessages,
    setSummaryResult,
  };
}
