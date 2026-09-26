export type LocalUser = {
  id: string;
  name: string;
  email: string;
  passwordHash: string;
  recoveryHash?: string;
  recoveryHint: string;
  createdAt: string;
};

export type AuthState = {
  users: LocalUser[];
  activeUserId: string | null;
};

const AUTH_KEY = "kinforge-auth-v1";

export const defaultAuthState = (): AuthState => ({ users: [], activeUserId: null });

export const loadAuthState = (): AuthState => {
  try {
    const raw = localStorage.getItem(AUTH_KEY);
    if (raw) return JSON.parse(raw) as AuthState;
  } catch {
    return defaultAuthState();
  }
  return defaultAuthState();
};

export const saveAuthState = (state: AuthState) => {
  localStorage.setItem(AUTH_KEY, JSON.stringify(state));
};

export const simpleHash = (value: string) => {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(16);
};

export const createRecoveryKey = () => {
  const bytes = crypto.getRandomValues(new Uint8Array(18));
  return Array.from(bytes, byte => byte.toString(16).padStart(2, "0")).join("").replace(/(.{6})/g, "$1-").replace(/-$/, "");
};

export const createAccount = (state: AuthState, name: string, email: string, password: string, recoveryHint: string) => {
  if (!email.includes("@")) return { state, error: "Enter a valid email address." };
  if (password.length < 8) return { state, error: "Use at least 8 characters for the password." };
  if (state.users.some((user) => user.email.toLowerCase() === email.toLowerCase())) return { state, error: "An account already exists for this email." };
  const recoveryCode = createRecoveryKey();
  const user: LocalUser = {
    id: crypto.randomUUID(),
    name: name.trim() || email.split("@")[0],
    email: email.trim(),
    passwordHash: simpleHash(`${email.toLowerCase()}:${password}`),
    recoveryHash: simpleHash(`${email.toLowerCase()}:${recoveryCode}`),
    recoveryHint: recoveryHint.trim(),
    createdAt: new Date().toISOString()
  };
  return { state: { users: [...state.users, user], activeUserId: user.id }, error: "", recoveryCode };
};

export const login = (state: AuthState, email: string, password: string) => {
  const user = state.users.find((entry) => entry.email.toLowerCase() === email.trim().toLowerCase());
  if (!user) return { state, error: "No account was found for that email." };
  if (user.passwordHash !== simpleHash(`${user.email.toLowerCase()}:${password}`)) return { state, error: "The password did not match." };
  return { state: { ...state, activeUserId: user.id }, error: "" };
};

export const resetPassword = (state: AuthState, email: string, newPassword: string, recoveryCode: string) => {
  if (newPassword.length < 8) return { state, error: "Use at least 8 characters for the new password." };
  const user = state.users.find((entry) => entry.email.toLowerCase() === email.trim().toLowerCase());
  if (!user) return { state, error: "No account was found for that email." };
  if (!recoveryCode.trim()) return { state, error: "Enter the secret recovery key for this account." };
  const validRecovery = user.recoveryHash
    ? user.recoveryHash === simpleHash(`${user.email.toLowerCase()}:${recoveryCode.trim()}`)
    : user.recoveryHint.trim() && user.recoveryHint.trim().toLowerCase() === recoveryCode.trim().toLowerCase();
  if (!validRecovery) return { state, error: "The recovery key did not match." };
  const nextRecoveryCode = createRecoveryKey();
  const next = {
    ...state,
    users: state.users.map((entry) => entry.id === user.id ? { ...entry, passwordHash: simpleHash(`${entry.email.toLowerCase()}:${newPassword}`), recoveryHash: simpleHash(`${entry.email.toLowerCase()}:${nextRecoveryCode}`) } : entry)
  };
  return { state: next, error: "", recoveryCode: nextRecoveryCode };
};

export const activeUser = (state: AuthState) => state.users.find((user) => user.id === state.activeUserId);
