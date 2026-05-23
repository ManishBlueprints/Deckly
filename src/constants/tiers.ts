export type Tier = "FREE" | "PRO" | "PRO_PLUS";

export interface TierConfig {
  days: number;
  label: string;
  isMaximum?: boolean;
  maxDataRooms: number;
  allowInteractive: boolean;
  allowOffice: boolean;
  maxDecks: number;
  maxFileSizeMB: number;
  maxDecksPerDay: number;
  maxDecksPerRoom: number;
  aiSummariesPerDay: number;
  aiChatsPerDay: number;
  supportedFormats: string[];
  teamMembers: number;
  prioritySupport: boolean;
}

export const TIER_CONFIG: Record<Tier, TierConfig> = {
  FREE: {
    days: 7,
    label: "7 Day Analytics",
    isMaximum: false,
    maxDataRooms: 1,
    allowInteractive: false,
    allowOffice: false,
    maxDecks: 10,
    maxFileSizeMB: 10,
    maxDecksPerDay: 30,
    maxDecksPerRoom: 50,
    aiSummariesPerDay: 2,
    aiChatsPerDay: 4,
    supportedFormats: ["PDF"],
    teamMembers: 0,
    prioritySupport: false,
  },
  PRO: {
    days: 90,
    label: "90 Day Analytics",
    isMaximum: true,
    maxDataRooms: 5,
    allowInteractive: true,
    allowOffice: true,
    maxDecks: 50,
    maxFileSizeMB: 50,
    maxDecksPerDay: 30,
    maxDecksPerRoom: 50,
    aiSummariesPerDay: 10,
    aiChatsPerDay: 20,
    supportedFormats: ["PDF", "XLSX", "DOCX", "PPTX"],
    teamMembers: 0,
    prioritySupport: false,
  },
  PRO_PLUS: {
    days: 365,
    label: "1 Year Analytics",
    isMaximum: true,
    maxDataRooms: -1, // -1 means unlimited
    allowInteractive: true,
    allowOffice: true,
    maxDecks: -1,
    maxFileSizeMB: 100,
    maxDecksPerDay: 30,
    maxDecksPerRoom: 50,
    aiSummariesPerDay: 50,
    aiChatsPerDay: 100,
    supportedFormats: ["PDF", "XLSX", "DOCX", "PPTX"],
    teamMembers: 5,
    prioritySupport: true,
  },
};

export const getTierConfig = (
  isPro: boolean,
  tierOverride?: Tier,
): TierConfig => {
  if (tierOverride) return TIER_CONFIG[tierOverride];
  return isPro ? TIER_CONFIG.PRO : TIER_CONFIG.FREE;
};
