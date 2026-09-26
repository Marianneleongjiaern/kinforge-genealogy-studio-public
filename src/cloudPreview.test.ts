import { beforeEach, expect, it } from "vitest";
import { createSeedState } from "./domain";
import { readLibraryPreview, writeLibraryPreview } from "./cloudPreview";
beforeEach(() => localStorage.clear());
it("isolates startup copies by account and library", () => {
  writeLibraryPreview("owner", "family", createSeedState());
  expect(readLibraryPreview("owner", "family")?.people).toHaveLength(4);
  expect(readLibraryPreview("other", "family")).toBeUndefined();
  expect(readLibraryPreview("owner", "other")).toBeUndefined();
});
it("preserves text and privacy while omitting attachment bytes without mutating the draft", () => {
  const state = createSeedState(), original = JSON.stringify(state);
  state.people[0].biography = "Original biography";
  writeLibraryPreview("owner", "family", state);
  const preview = readLibraryPreview("owner", "family")!;
  expect(preview.people).toEqual(state.people);
  expect(preview.media[0].dataUrl).toBe("");
  expect(state.media[0].dataUrl).toBe(JSON.parse(original).media[0].dataUrl);
});
it("drops an obsolete preview if a library grows beyond the size budget", () => {
  const state = createSeedState(); writeLibraryPreview("owner", "family", state);
  state.people[0].biography = "x".repeat(600 * 1024);
  writeLibraryPreview("owner", "family", state);
  expect(readLibraryPreview("owner", "family")).toBeUndefined();
});
