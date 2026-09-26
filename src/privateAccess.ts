export const PRIVATE_ACCESS_KEY = "kinforge-private-access-v1";

export type PrivateAccessMode = "Direct" | "System proxy / system VPN" | "Custom HTTPS relay" | "Offline only";

export type PrivateAccessSettings = {
  mode: PrivateAccessMode;
  relayUrl: string;
  provider: string;
  region: string;
  killSwitch: boolean;
  offlineFallback: boolean;
  routeCloudSync: boolean;
  routeResearch: boolean;
};

export const defaultPrivateAccessSettings = (): PrivateAccessSettings => ({
  mode: "Direct",
  relayUrl: "",
  provider: "KinForge Private Relay",
  region: "Auto",
  killSwitch: true,
  offlineFallback: true,
  routeCloudSync: true,
  routeResearch: true
});

export function normalizePrivateAccessSettings(value: unknown): PrivateAccessSettings {
  const defaults = defaultPrivateAccessSettings();
  if (!value || typeof value !== "object") return defaults;
  const source = value as Partial<PrivateAccessSettings>;
  const mode = source.mode === "System proxy / system VPN" || source.mode === "Custom HTTPS relay" || source.mode === "Offline only" || source.mode === "Direct"
    ? source.mode
    : defaults.mode;
  return {
    mode,
    relayUrl: typeof source.relayUrl === "string" ? source.relayUrl : defaults.relayUrl,
    provider: typeof source.provider === "string" ? source.provider : defaults.provider,
    region: typeof source.region === "string" ? source.region : defaults.region,
    killSwitch: typeof source.killSwitch === "boolean" ? source.killSwitch : defaults.killSwitch,
    offlineFallback: typeof source.offlineFallback === "boolean" ? source.offlineFallback : defaults.offlineFallback,
    routeCloudSync: typeof source.routeCloudSync === "boolean" ? source.routeCloudSync : defaults.routeCloudSync,
    routeResearch: typeof source.routeResearch === "boolean" ? source.routeResearch : defaults.routeResearch
  };
}

export function readPrivateAccessSettings(): PrivateAccessSettings {
  try {
    return normalizePrivateAccessSettings(JSON.parse(localStorage.getItem(PRIVATE_ACCESS_KEY) || "null"));
  } catch {
    return defaultPrivateAccessSettings();
  }
}

export function savePrivateAccessSettings(settings: PrivateAccessSettings) {
  try {
    localStorage.setItem(PRIVATE_ACCESS_KEY, JSON.stringify(normalizePrivateAccessSettings(settings)));
  } catch {
    /* Private Access remains usable for the current session if storage is unavailable. */
  }
}

export function serviceForCloudPath(path: string) {
  return path.includes("/api/terms/") ? "research" : "cloud";
}

export function shouldUsePrivateRoute(settings: PrivateAccessSettings, path: string) {
  const service = serviceForCloudPath(path);
  if (service === "research") return settings.routeResearch;
  return settings.routeCloudSync;
}

export function privateAccessStatus(settings: PrivateAccessSettings) {
  if (settings.mode === "Offline only") return "Offline library mode active";
  if (settings.mode === "Custom HTTPS relay" && !settings.relayUrl.trim()) return settings.killSwitch ? "Relay URL needed" : "Direct fallback active";
  if (settings.mode === "Custom HTTPS relay") return "Custom relay active";
  if (settings.mode === "System proxy / system VPN") return "System proxy/VPN active";
  return "Direct access active";
}

export function endpointForPrivateAccess(path: string, settings: PrivateAccessSettings) {
  if (!/^\/api\/[a-zA-Z0-9/?=&_.-]+$/.test(path)) throw new Error("Unsupported KinForge request path.");
  if (settings.mode === "Offline only") throw new Error("Private Access offline-only mode is active. KinForge opened the cached library and blocked network requests.");
  if (settings.mode !== "Custom HTTPS relay" || !shouldUsePrivateRoute(settings, path)) return path;
  const relay = settings.relayUrl.trim();
  if (!relay) {
    if (settings.killSwitch) throw new Error("Private Access custom relay is selected, but no relay URL is saved.");
    return path;
  }
  const base = new URL(relay);
  if (base.protocol !== "https:") throw new Error("Private Access relay URLs must use HTTPS.");
  return new URL(path.replace(/^\//, ""), base.href.endsWith("/") ? base.href : `${base.href}/`).href;
}
