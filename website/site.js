(function () {
  const auth = document.getElementById("beta-auth");
  const interest = document.getElementById("beta-register");
  const status = document.getElementById("account-status");
  const result = document.getElementById("beta-result");
  const recovery = document.getElementById("recovery");
  const recoveryKey = document.getElementById("recovery-key");
  const saveRecovery = document.getElementById("save-recovery");
  const withdraw = document.getElementById("withdraw-interest");
  if (!auth || !interest || !status || !result) return;

  const clientHeaders = { "Content-Type": "application/json", "X-KinForge-Client": "1" };
  async function api(path, init) {
    const response = await fetch(path, { credentials: "same-origin", cache: "no-store", redirect: "error", ...init, headers: { ...clientHeaders, ...(init && init.headers) } });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.error || "KinForge could not complete that request.");
    return data;
  }
  function download(name, text) {
    const url = URL.createObjectURL(new Blob([text], { type: "text/plain" }));
    const link = document.createElement("a");
    link.href = url; link.download = name; link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  async function refresh() {
    try {
      const me = await api("/api/auth/me", { method: "GET", headers: {} });
      auth.hidden = true; interest.hidden = false; status.textContent = `Signed in as ${me.user.email}.`;
      const saved = await api("/api/beta/interest", { method: "GET", headers: {} });
      withdraw.hidden = !saved.interest;
      if (saved.interest) result.textContent = `Registered interest: ${saved.interest.plan}, ${saved.interest.interval}${saved.interest.discount_code ? `, ${saved.interest.discount_code}` : ""}.`;
    } catch {
      auth.hidden = false; interest.hidden = true; status.textContent = "Create an account or sign in to register interest.";
    }
  }
  auth.addEventListener("submit", async event => {
    event.preventDefault(); result.textContent = "";
    const form = new FormData(auth);
    const action = form.get("action") === "login" ? "/api/auth/login" : "/api/auth/register";
    try {
      const data = await api(action, { method: "POST", body: JSON.stringify(Object.fromEntries(form)) });
      if (data.recoveryCode && recovery && recoveryKey) { recovery.hidden = false; recoveryKey.textContent = data.recoveryCode; }
      await refresh();
    } catch (error) { result.textContent = error.message; }
  });
  saveRecovery?.addEventListener("click", () => {
    if (recoveryKey?.textContent) download("kinforge-recovery-key.txt", `KinForge recovery key\n\n${recoveryKey.textContent}\n`);
  });
  interest.addEventListener("submit", async event => {
    event.preventDefault(); result.textContent = "";
    const data = Object.fromEntries(new FormData(interest));
    data.consent = Boolean(new FormData(interest).get("consent"));
    try {
      const saved = await api("/api/beta/interest", { method: "POST", body: JSON.stringify(data) });
      result.textContent = `Saved. ${saved.interest.plan} interest is registered${saved.interest.discountCode ? ` with ${saved.interest.discountCode}` : ""}.`;
      withdraw.hidden = false;
    } catch (error) { result.textContent = error.message; }
  });
  withdraw?.addEventListener("click", async () => {
    try { await api("/api/beta/interest", { method: "DELETE" }); result.textContent = "Beta interest withdrawn."; withdraw.hidden = true; }
    catch (error) { result.textContent = error.message; }
  });
  refresh();
})();
