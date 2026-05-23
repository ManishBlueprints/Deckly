import { useCallback, useRef, useState } from "react";
import { toast } from "sonner";
import {
  aiSummaryService,
  type AiSummaryChatMessage,
  type AiSummaryChatResult,
} from "../services/aiSummaryService";
import { analyticsService } from "../services/analyticsService";
import { TIER_CONFIG, type Tier } from "../constants/tiers";
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
  tier?: Tier;
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

const getSummaryNotice = (result: AiSummaryInitialResult): {
  notice: string | null;
  tone: "default" | "success" | "warning";
} => {
  if (result.status === "quota_limited") {
    const quota = result.usage.quota;
    if (quota?.scope === "guest") {
      return {
        notice: "No summaries left today. Sign in to unlock more AI usage.",
        tone: "warning",
      };
    }

    return {
      notice: "No summaries left today on your current plan.",
      tone: "warning",
    };
  }

  return {
    notice: null,
    tone: "default",
  };
};

const getEffectiveTier = (isGuest: boolean, tier?: Tier): Tier =>
  isGuest ? "FREE" : tier ?? "FREE";

const getSummariesLeft = (
  result: AiSummaryInitialResult,
): number | null => {
  const quota = result.usage.quota;
  if (!quota) return null;

  const shouldDecrementAfterFreshSummary =
    result.status === "completed" &&
    quota.allowed &&
    quota.chargeable &&
    !result.cache.cached_reopen;

  return Math.max(
    quota.remaining - (shouldDecrementAfterFreshSummary ? 1 : 0),
    0,
  );
};

const buildSummaryMeta = (
  result: AiSummaryInitialResult,
  isGuest: boolean,
  tier?: Tier,
): AiSummaryPanelMetaItem[] => {
  const effectiveTier = getEffectiveTier(isGuest, tier);
  const tierConfig = TIER_CONFIG[effectiveTier];
  const summariesLeft = getSummariesLeft(result);

  return [
    {
      label: "Summaries left",
      value:
        summariesLeft === null
          ? `${tierConfig.aiSummariesPerDay} / day`
          : `${summariesLeft} left today`,
    },
    {
      label: "Chats",
      value: isGuest
        ? "Sign in required"
        : `${tierConfig.aiChatsPerDay} / day`,
    },
  ];
};

const getSummaryText = (result: AiSummaryInitialResult | null): string | null =>
  result?.summary_text ?? null;

export function useAiSummaryPanel({
  onRequireAuth,
  isGuest,
  tier,
}: UseAiSummaryPanelOptions) {
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

  const requestSummary = useCallback(async (
    scope: AiSummaryPanelScope,
  ): Promise<AiSummaryInitialResult | null> => {
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
      if (activeRequestKeyRef.current !== requestKey) {
        return result;
      }
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
      if (activeRequestKeyRef.current !== requestKey) {
        return null;
      }
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
      if (activeRequestKeyRef.current === requestKey) {
        setIsSummaryLoading(false);
      }
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
      setSummaryNotice(null);
      setSummaryNoticeTone("default");
      console.error("AI summary chat failed", error);
      toast.error("Deckly AI could not answer right now. Please try again.");
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
    summaryMeta: summaryResult ? buildSummaryMeta(summaryResult, isGuest, tier) : [],
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
