// PRO and PRO_PLUS are retained as stable stored identifiers for existing
// accounts. Their customer-facing names are Share and Founder respectively.
export type Tier = "FREE" | "PRO" | "PRO_PLUS" | "RAISE";

export interface TierConfig {
  days: number;
  label: string;
  planLabel: string;
  isMaximum?: boolean;
  maxDataRooms: number;
  allowInteractive: boolean;
  allowOffice: boolean;
  maxDecks: number;
  maxFileSizeMB: number;
  maxViewableDocumentSizeMB: number;
  maxDecksPerDay: number;
  maxDecksPerRoom: number;
  aiSummariesPerDay: number;
  aiChatsPerDay: number;
  supportedFormats: string[];
  teamMembers: number;
  prioritySupport: boolean;
  pricingFeatures: string[];
}

export const TIER_CONFIG: Record<Tier, TierConfig> = {
  FREE: {
    days: 7,
    label: "7 Day Analytics",
    planLabel: "Free",
    isMaximum: false,
    maxDataRooms: 1,
    allowInteractive: false,
    allowOffice: false,
    maxDecks: 5,
    maxFileSizeMB: 100,
    maxViewableDocumentSizeMB: 50,
    maxDecksPerDay: 30,
    maxDecksPerRoom: 5,
    aiSummariesPerDay: 2,
    aiChatsPerDay: 4,
    supportedFormats: ["PDF"],
    teamMembers: 1,
    prioritySupport: false,
    pricingFeatures: ["Unlimited viewers", "Basic link analytics (7 days)", "2 AI credits per day", "Deckly branding"],
  },
  PRO: {
    days: 30,
    label: "30 Day Analytics",
    planLabel: "Share",
    isMaximum: true,
    maxDataRooms: 1,
    allowInteractive: true,
    allowOffice: true,
    maxDecks: 25,
    maxFileSizeMB: 500,
    maxViewableDocumentSizeMB: 50,
    maxDecksPerDay: 30,
    maxDecksPerRoom: 25,
    aiSummariesPerDay: 20,
    aiChatsPerDay: 20,
    supportedFormats: ["PDF", "XLS", "XLSX", "DOC", "DOCX", "PPT", "PPTX"],
    teamMembers: 1,
    prioritySupport: false,
    pricingFeatures: ["Unlimited viewers", "Basic page-level and drop-off analytics", "Basic visitor alerts and engagement signals", "Email capture, password and expiry", "Download controls", "Deckly branding", "20 AI credits per day"],
  },
  PRO_PLUS: {
    days: -1,
    label: "Full Analytics History",
    planLabel: "Founder",
    isMaximum: true,
    maxDataRooms: 5,
    allowInteractive: true,
    allowOffice: true,
    maxDecks: 150,
    maxFileSizeMB: 3072,
    maxViewableDocumentSizeMB: 200,
    maxDecksPerDay: 30,
    maxDecksPerRoom: 150,
    aiSummariesPerDay: 200,
    aiChatsPerDay: 200,
    supportedFormats: ["PDF", "XLS", "XLSX", "DOC", "DOCX", "PPT", "PPTX"],
    teamMembers: 2,
    prioritySupport: false,
    pricingFeatures: ["Unlimited viewers", "Full-history link analytics", "Page-level and drop-off analytics", "Visitor alerts and engagement signals", "Email capture, password and expiry", "Download controls", "Custom logo and colours", "200 AI credits per day"],
  },
  RAISE: {
    days: -1,
    label: "Full Analytics History + Export",
    planLabel: "Raise",
    isMaximum: true,
    maxDataRooms: 20,
    allowInteractive: true,
    allowOffice: true,
    maxDecks: 1000,
    maxFileSizeMB: 15360,
    maxViewableDocumentSizeMB: 200,
    maxDecksPerDay: 30,
    maxDecksPerRoom: 1000,
    aiSummariesPerDay: 500,
    aiChatsPerDay: 500,
    supportedFormats: ["PDF", "XLS", "XLSX", "DOC", "DOCX", "PPT", "PPTX"],
    teamMembers: 5,
    prioritySupport: true,
    pricingFeatures: ["Unlimited viewers", "Full-history link analytics with export", "Page-level and drop-off analytics", "Visitor alerts and engagement signals", "Email capture, password and expiry", "Granular download controls by room and folder", "Deck watermarking", "White-label branding and custom domain", "NDA gate, access groups and audit trail", "500 AI credits per day"],
  },
};

export const getTierConfig = (
  isPro: boolean,
  tierOverride?: Tier,
): TierConfig => {
  if (tierOverride) return TIER_CONFIG[tierOverride];
  return isPro ? TIER_CONFIG.PRO : TIER_CONFIG.FREE;
};
