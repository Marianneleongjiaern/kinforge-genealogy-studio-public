import { describe, expect, it } from "vitest";
import { defaultPrivateAccessSettings, endpointForPrivateAccess, privateAccessStatus } from "./privateAccess";

describe("Private Access routing", () => {
  it("uses normal app paths in direct mode", () => {
    const settings = defaultPrivateAccessSettings();
    expect(privateAccessStatus(settings)).toBe("Direct access active");
    expect(endpointForPrivateAccess("/api/libraries", settings)).toBe("/api/libraries");
  });

  it("routes KinForge API requests through a configured HTTPS relay", () => {
    const settings = { ...defaultPrivateAccessSettings(), mode: "Custom HTTPS relay" as const, relayUrl: "https://relay.example/kinforge" };
    expect(privateAccessStatus(settings)).toBe("Custom relay active");
    expect(endpointForPrivateAccess("/api/libraries/abc?since=4", settings)).toBe("https://relay.example/kinforge/api/libraries/abc?since=4");
  });

  it("blocks unsafe relay and offline-only network calls", () => {
    expect(() => endpointForPrivateAccess("/api/libraries", { ...defaultPrivateAccessSettings(), mode: "Offline only" })).toThrow(/offline-only/i);
    expect(() => endpointForPrivateAccess("/api/libraries", { ...defaultPrivateAccessSettings(), mode: "Custom HTTPS relay", relayUrl: "http://relay.example" })).toThrow(/HTTPS/i);
    expect(() => endpointForPrivateAccess("https://evil.example/api/libraries", defaultPrivateAccessSettings())).toThrow(/Unsupported/i);
  });

  it("honors the kill switch when custom relay mode has no relay URL", () => {
    const settings = { ...defaultPrivateAccessSettings(), mode: "Custom HTTPS relay" as const, relayUrl: "", killSwitch: true };
    expect(privateAccessStatus(settings)).toBe("Relay URL needed");
    expect(() => endpointForPrivateAccess("/api/libraries", settings)).toThrow(/no relay URL/i);
    expect(endpointForPrivateAccess("/api/libraries", { ...settings, killSwitch: false })).toBe("/api/libraries");
  });
});
