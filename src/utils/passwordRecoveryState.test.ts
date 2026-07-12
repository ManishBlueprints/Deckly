import { describe, expect, it } from "vitest";
import {
  createPasswordRecoveryMarker,
  isPasswordRecoveryMarkerActive,
  PASSWORD_RECOVERY_MARKER_TTL_MS,
} from "./passwordRecoveryState";

describe("password recovery marker", () => {
  it("accepts only a recent, well-formed recovery marker", () => {
    const now = 1_000_000;

    expect(isPasswordRecoveryMarkerActive(createPasswordRecoveryMarker(now), now)).toBe(true);
    expect(
      isPasswordRecoveryMarkerActive(
        createPasswordRecoveryMarker(now - PASSWORD_RECOVERY_MARKER_TTL_MS - 1),
        now,
      ),
    ).toBe(false);
    expect(isPasswordRecoveryMarkerActive("true", now)).toBe(false);
    expect(isPasswordRecoveryMarkerActive("not-json", now)).toBe(false);
  });
});
