/// <reference types="vitest/globals" />
// @vitest-environment jsdom

import { act, renderHook } from "@testing-library/react";
import { vi } from "vitest";
import { useManageDeckWorkflow } from "./useManageDeckWorkflow";

const spies = vi.hoisted(() => ({
  addDocuments: vi.fn(),
  capture: vi.fn(),
  captureException: vi.fn(),
  cleanupWatermarkedDeck: vi.fn(),
  completeUpload: vi.fn(),
  deleteSlideImages: vi.fn(),
  from: vi.fn(),
  getProfile: vi.fn(),
  getSession: vi.fn(),
  invalidateQueries: vi.fn(),
  prepareOfficeUpload: vi.fn(),
  processPdfToImages: vi.fn(),
  rpc: vi.fn(),
  uploadDeckFile: vi.fn(),
  uploadPreparedOfficeSource: vi.fn(),
  uploadSlideImages: vi.fn(),
  verifyDirectPdf: vi.fn(),
}));

vi.mock("../services/supabase", () => ({
  supabase: {
    auth: { getSession: spies.getSession },
    from: spies.from,
    rpc: spies.rpc,
  },
}));

vi.mock("../services/userService", () => ({
  userService: { getProfile: spies.getProfile },
}));

vi.mock("../services/dataRoomService", () => ({
  dataRoomService: { addDocuments: spies.addDocuments },
}));

vi.mock("../services/deckService", () => ({
  deckService: { cleanupWatermarkedDeck: spies.cleanupWatermarkedDeck },
}));

vi.mock("../services/deckStorageService", () => ({
  deckStorageService: {
    deleteSlideImages: spies.deleteSlideImages,
    uploadDeckFile: spies.uploadDeckFile,
    uploadSlideImages: spies.uploadSlideImages,
  },
}));

vi.mock("../services/documentProcessingService", () => ({
  documentProcessingService: {
    completeUpload: spies.completeUpload,
    prepareOfficeUpload: spies.prepareOfficeUpload,
    uploadPreparedOfficeSource: spies.uploadPreparedOfficeSource,
    verifyDirectPdf: spies.verifyDirectPdf,
  },
}));

vi.mock("../workflows/deckProcessing", () => ({
  processPdfToImages: spies.processPdfToImages,
}));

vi.mock("./useDecks", () => ({
  deckQueryKeys: { list: (userId: string) => ["decks", userId] },
}));

vi.mock("./useUserTotalStats", () => ({
  userTotalStatsQueryKeys: { allForUser: (userId: string) => ["user-total-stats", userId] },
}));

vi.mock("posthog-js", () => ({ default: { capture: spies.capture } }));
vi.mock("@sentry/react", () => ({ captureException: spies.captureException }));

const setter = () => vi.fn();

function renderWorkflow(editId: string | null = null) {
  const setters = {
    error: setter(),
    existingDeck: setter(),
    fileType: setter(),
    loading: setter(),
    progress: setter(),
    progressPercent: setter(),
    title: setter(),
    userProfile: setter(),
  };

  return {
    ...renderHook(() =>
      useManageDeckWorkflow({
        editId,
        setExistingDeck: setters.existingDeck,
        setTitle: setters.title,
        setSlug: setter(),
        setDescription: setter(),
        setRequireEmail: setter(),
        setRequirePassword: setter(),
        setAllowDownload: setter(),
        setWatermarkEnabled: setter(),
        setWatermarkText: setter(),
        setFileType: setters.fileType,
        setViewPassword: setter(),
        setExpiresAt: setter(),
        setEnableExpiry: setter(),
        setLoading: setters.loading,
        setProgress: setters.progress,
        setProgressPercent: setters.progressPercent,
        setError: setters.error,
        setUserProfile: setters.userProfile,
      }),
    ),
    setters,
  };
}

function submitParams(overrides: Record<string, unknown> = {}) {
  return {
    allowDownload: false,
    conversionMode: "interactive" as const,
    description: "",
    existingDeck: null,
    expiresAt: "",
    file: null,
    fileType: "pdf",
    navigate: vi.fn(),
    queryClient: { invalidateQueries: spies.invalidateQueries } as never,
    requireEmail: false,
    requirePassword: false,
    returnToRoom: null,
    slug: "deck",
    title: "Deck",
    viewPassword: "",
    watermarkEnabled: false,
    watermarkText: "",
    ...overrides,
  };
}

describe("useManageDeckWorkflow upload contracts", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    spies.getSession.mockResolvedValue({ data: { session: { user: { id: "user-1" } } } });
    spies.getProfile.mockResolvedValue(null);
    spies.completeUpload.mockResolvedValue({ id: "job-1" });
    spies.deleteSlideImages.mockResolvedValue(undefined);
  });

  it("prepares, uploads, and queues Office files in order", async () => {
    const calls: string[] = [];
    spies.prepareOfficeUpload.mockImplementation(async () => {
      calls.push("prepare");
      return { jobId: "job-1", deckId: "deck-1", uploadUrl: "https://upload.example" };
    });
    spies.uploadPreparedOfficeSource.mockImplementation(async () => {
      calls.push("upload");
    });
    spies.completeUpload.mockImplementation(async () => {
      calls.push("complete");
      return { id: "job-1" };
    });
    const { result } = renderWorkflow();
    const navigate = vi.fn();
    const file = new File(["presentation"], "deck.pptx", {
      type: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
    });

    await act(async () => {
      await result.current.submitDeck(
        submitParams({ file, fileType: "pptx", navigate }),
      );
    });

    expect(calls).toEqual(["prepare", "upload", "complete"]);
    expect(spies.prepareOfficeUpload).toHaveBeenCalledWith(
      expect.objectContaining({ sourceFilename: "deck.pptx", sourceFileType: "pptx" }),
    );
    expect(spies.uploadPreparedOfficeSource).toHaveBeenCalledWith("https://upload.example", file);
    expect(spies.completeUpload).toHaveBeenCalledWith("job-1");
    expect(navigate).toHaveBeenCalledWith("/content");
  });

  it("rejects PDFs exceeding 500 pages before slide upload or publication", async () => {
    spies.uploadDeckFile.mockResolvedValue({
      userId: "user-1",
      fileName: "user-1/uploads/decks/deck.pdf",
      publicUrl: "user-1/uploads/decks/deck.pdf",
    });
    spies.processPdfToImages.mockResolvedValue(Array.from({ length: 501 }, () => ({ blob: new Blob() })));
    const { result, setters } = renderWorkflow();
    const file = new File(["pdf"], "deck.pdf", { type: "application/pdf" });

    await act(async () => {
      await result.current.submitDeck(submitParams({ file }));
    });

    expect(setters.error).toHaveBeenCalledWith("Viewable documents are limited to 500 pages.");
    expect(spies.uploadSlideImages).not.toHaveBeenCalled();
    expect(spies.verifyDirectPdf).not.toHaveBeenCalled();
    expect(spies.rpc).not.toHaveBeenCalled();
  });

  it("publishes a verified direct PDF and leaves watermark preparation in the background", async () => {
    const file = new File(["pdf"], "deck.pdf", { type: "application/pdf" });
    spies.uploadDeckFile.mockResolvedValue({
      userId: "user-1",
      fileName: "user-1/uploads/decks/deck.pdf",
      publicUrl: "user-1/uploads/decks/deck.pdf",
    });
    spies.processPdfToImages.mockResolvedValue([
      { blob: new Blob(["page"]), width: 100, height: 100, links: [] },
    ]);
    spies.uploadSlideImages.mockResolvedValue(["user-1/deck-images/deck/staging/v-1/page-1.webp"]);
    spies.verifyDirectPdf.mockResolvedValue({
      storagePath: "user-1/decks/verified/deck.pdf",
      fileSize: 3,
      pageCount: 1,
    });
    spies.rpc.mockResolvedValue({ data: { id: "deck-1" }, error: null });
    const { result, setters } = renderWorkflow();
    const navigate = vi.fn();

    await act(async () => {
      await result.current.submitDeck(
        submitParams({ allowDownload: true, file, navigate, watermarkEnabled: true, watermarkText: "Confidential" }),
      );
    });

    expect(spies.verifyDirectPdf).toHaveBeenCalledWith("user-1/uploads/decks/deck.pdf");
    expect(spies.rpc).toHaveBeenCalledWith(
      "create_deck_with_primary_link",
      expect.objectContaining({
        p_allow_download: true,
        p_file_url: "user-1/decks/verified/deck.pdf",
        p_status: "PROCESSED",
        p_watermark_enabled: true,
        p_watermark_text: "Confidential",
      }),
    );
    expect(setters.progress).toHaveBeenCalledWith("Preparing protected download in the background...");
    expect(navigate).toHaveBeenCalledWith("/content");
  });
});
