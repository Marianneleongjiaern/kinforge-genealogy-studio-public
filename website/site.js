(function () {
  const auth = document.getElementById("beta-auth");
  const interest = document.getElementById("beta-register");
  const support = document.getElementById("public-support");
  const supportResult = document.getElementById("support-result");
  const status = document.getElementById("account-status");
  const result = document.getElementById("beta-result");
  const recovery = document.getElementById("recovery");
  const recoveryKey = document.getElementById("recovery-key");
  const saveRecovery = document.getElementById("save-recovery");
  const withdraw = document.getElementById("withdraw-interest");
  const billingControls = document.getElementById("billing-controls");
  const checkout = document.getElementById("checkout");
  const portal = document.getElementById("billing-portal");
  const syncBilling = document.getElementById("sync-billing");
  const syncRevenue = document.getElementById("sync-revenue");
  const billingHistory = document.getElementById("billing-history");
  const revenueReport = document.getElementById("revenue-report");
  const discountNote = document.getElementById("discount-note");
  if (!auth && !support) return;

  const discounts = {
    other: "Other uses standard pricing with no discount.",
    writer: "Writer discount: WRITER10 for 10% off.",
    social_worker: "Social worker discount: SOCIALWORK15 for 15% off.",
    genealogist: "Genealogist discount: GENEALOGY10 for 10% off.",
    historian: "Historian discount: HISTORY10 for 10% off.",
    roleplayer: "Roleplayer discount: ROLEPLAYER12 for 12% off.",
    rpg: "RPG player discount: RPG12 for 12% off.",
    dnd: "DND player discount: DND12 for 12% off.",
    student: "Student discount: STUDENT20 for 20% off.",
    nonprofit: "Nonprofit discount: NONPROFIT20 for 20% off.",
    educator: "Educator discount: EDUCATOR15 for 15% off.",
    special_unpaid: "Special unpaid or copyright-free versions require a support request before checkout."
  };

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
  if (auth && interest && status && result) {
    async function refresh() {
      try {
        const me = await api("/api/auth/me", { method: "GET", headers: {} });
        auth.hidden = true; interest.hidden = false; status.textContent = `Signed in as ${me.user.email}.`;
        const saved = await api("/api/beta/interest", { method: "GET", headers: {} });
        withdraw.hidden = !saved.interest;
        if (billingControls) billingControls.hidden = false;
        if (checkout) checkout.hidden = !saved.interest;
        if (portal) portal.hidden = false;
        if (saved.interest) result.textContent = `Saved choice: ${saved.interest.plan}, ${saved.interest.interval || "month"}${saved.interest.discount_code ? `, ${saved.interest.discount_code}` : ""}.`;
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
        result.textContent = `Saved. ${saved.interest.plan} choice is registered${saved.interest.discountCode ? ` with ${saved.interest.discountCode}` : ""}.`;
        withdraw.hidden = false;
        if (billingControls) billingControls.hidden = false;
        if (checkout) checkout.hidden = data.userType === "special_unpaid";
      } catch (error) { result.textContent = error.message; }
    });
    interest.elements.userType?.addEventListener("change", () => {
      const type = interest.elements.userType.value;
      if (discountNote) discountNote.textContent = discounts[type] || discounts.other;
      if (checkout) checkout.hidden = type === "special_unpaid";
    });
    withdraw?.addEventListener("click", async () => {
      try { await api("/api/beta/interest", { method: "DELETE" }); result.textContent = "Saved choice withdrawn."; withdraw.hidden = true; if (checkout) checkout.hidden = true; }
      catch (error) { result.textContent = error.message; }
    });
    checkout?.addEventListener("click", async () => {
      const data = Object.fromEntries(new FormData(interest));
      if (data.userType === "special_unpaid") {
        result.textContent = "Special unpaid versions must be requested through the support form.";
        return;
      }
      try {
        const checkoutSession = await api("/api/billing/checkout", { method: "POST", body: JSON.stringify(data) });
        location.href = checkoutSession.url;
      } catch (error) { result.textContent = error.message; }
    });
    portal?.addEventListener("click", async () => {
      try {
        const data = await api("/api/billing/portal", { method: "POST", body: "{}" });
        location.href = data.url;
      } catch (error) { result.textContent = error.message; }
    });
    syncBilling?.addEventListener("click", async () => {
      try {
        const data = await api("/api/billing/history", { method: "GET", headers: {} });
        if (billingHistory) billingHistory.textContent = JSON.stringify(data, null, 2);
      } catch (error) { result.textContent = error.message; }
    });
    syncRevenue?.addEventListener("click", async () => {
      try {
        const data = await api("/api/admin/revenue", { method: "GET", headers: {} });
        if (revenueReport) revenueReport.textContent = JSON.stringify(data, null, 2);
      } catch (error) { result.textContent = error.message; }
    });
    refresh();
  }
  support?.addEventListener("submit", async event => {
    event.preventDefault();
    if (supportResult) supportResult.textContent = "";
    const data = Object.fromEntries(new FormData(support));
    data.permissionToReply = Boolean(new FormData(support).get("permissionToReply"));
    try {
      const saved = await api("/api/support", { method: "POST", body: JSON.stringify(data) });
      if (supportResult) supportResult.textContent = saved.message || "Request sent.";
      support.reset();
    } catch (error) {
      if (supportResult) supportResult.textContent = error.message;
    }
  });
})();
