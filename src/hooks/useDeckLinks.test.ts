/// <reference types="vitest/globals" />

const reactQueryMocks = vi.hoisted(() => ({
  invalidateQueries: vi.fn(() => Promise.resolve()),
  useQuery: vi.fn((options: unknown) => options),
  useMutation: vi.fn((options: {
    mutationFn: (variables?: unknown) => Promise<unknown>;
    onSuccess?: (data: unknown, variables: unknown) => Promise<void> | void;
  }) => ({
    mutateAsync: async (variables?: unknown) => {
      const data = await options.mutationFn(variables);
      await options.onSuccess?.(data, variables);
      return data;
    },
  })),
}));

vi.mock("@tanstack/react-query", () => ({
  useQuery: reactQueryMocks.useQuery,
  useMutation: reactQueryMocks.useMutation,
  useQueryClient: vi.fn(() => ({ invalidateQueries: reactQueryMocks.invalidateQueries })),
}));

vi.mock("../services/deckLinkService", () => ({
  deckLinkService: {
    listDeckLinks: vi.fn(async () => []),
    createDeckLink: vi.fn(async () => ({ id: "link-1" })),
    enableDeckLink: vi.fn(async () => ({ id: "link-1" })),
    disableDeckLink: vi.fn(async () => ({ id: "link-1" })),
  },
}));

import {
  deckLinkQueryKeys,
  useCreateDeckLink,
  useDeckLinks,
  useDisableDeckLink,
  useEnableDeckLink,
} from "./useDeckLinks";
import { deckLinkService } from "../services/deckLinkService";

describe("useDeckLinks hooks", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    reactQueryMocks.invalidateQueries.mockClear();
  });

  it("uses a stable deck link query key", () => {
    useDeckLinks("deck-1", "user-1");

    expect(reactQueryMocks.useQuery).toHaveBeenCalledWith(
      expect.objectContaining({
        queryKey: deckLinkQueryKeys.list("deck-1"),
        enabled: true,
      }),
    );
  });

  it("invalidates link, deck list, and deck detail queries after create", async () => {
    const mutation = useCreateDeckLink("deck-1", "user-1");

    await mutation.mutateAsync({
      linkName: "Investor Follow-up",
      linkAlias: "investor-follow-up",
    });

    expect(deckLinkService.createDeckLink).toHaveBeenCalledWith(
      "deck-1",
      { linkName: "Investor Follow-up", linkAlias: "investor-follow-up" },
      "user-1",
    );
    expect(reactQueryMocks.invalidateQueries).toHaveBeenCalledWith({
      queryKey: deckLinkQueryKeys.list("deck-1"),
    });
    expect(reactQueryMocks.invalidateQueries).toHaveBeenCalledWith({
      queryKey: deckLinkQueryKeys.deckList("user-1"),
    });
    expect(reactQueryMocks.invalidateQueries).toHaveBeenCalledWith({
      queryKey: deckLinkQueryKeys.deckDetail("deck-1"),
    });
  });

  it("invalidates the same cache paths after enable and disable mutations", async () => {
    const enableMutation = useEnableDeckLink("deck-1", "user-1");
    const disableMutation = useDisableDeckLink("deck-1", "user-1");

    await enableMutation.mutateAsync("link-1");
    await disableMutation.mutateAsync("link-1");

    expect(deckLinkService.enableDeckLink).toHaveBeenCalledWith("deck-1", "link-1", "user-1");
    expect(deckLinkService.disableDeckLink).toHaveBeenCalledWith("deck-1", "link-1", "user-1");
    expect(reactQueryMocks.invalidateQueries).toHaveBeenCalledTimes(6);
  });
});
