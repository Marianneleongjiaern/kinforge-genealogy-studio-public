(function () {
  const auth = document.getElementById("beta-auth");
  const interest = document.getElementById("beta-register");
  const support = document.getElementById("public-support");
  const newsletter = document.getElementById("public-newsletter");
  const supportResult = document.getElementById("support-result");
  const newsletterResult = document.getElementById("newsletter-result");
  const status = document.getElementById("account-status");
  const result = document.getElementById("beta-result");
  const recovery = document.getElementById("recovery");
  const recoveryKey = document.getElementById("recovery-key");
  const saveRecovery = document.getElementById("save-recovery");
  const withdraw = document.getElementById("withdraw-interest");
  const narrationPlayers = Array.from(document.querySelectorAll(".narration-player"));
  if (narrationPlayers.length && "speechSynthesis" in window) {
    let active = null;
    const voiceHint = /female|woman|samantha|victoria|karen|zira|aria|jenny|susan|ava|serena|moira|tessa|salli|joanna|amy|emma/i;
    const chooseVoice = () => {
      const voices = speechSynthesis.getVoices();
      return voices.find(voice => voice.lang.toLowerCase().startsWith("en") && voiceHint.test(voice.name)) || voices.find(voice => voice.lang.toLowerCase().startsWith("en")) || voices[0] || null;
    };
    const clearActiveLine = () => document.querySelectorAll("[data-narration-line].active").forEach(line => line.classList.remove("active"));
    const stop = () => { speechSynthesis.cancel(); clearActiveLine(); if (active?.status) active.status.textContent = "Narration stopped."; active = null; };
    narrationPlayers.forEach(player => {
      const lines = Array.from(player.querySelectorAll("[data-narration-line]"));
      const play = player.querySelector(".narration-play");
      const pause = player.querySelector(".narration-pause");
      const stopButton = player.querySelector(".narration-stop");
      const statusLine = player.querySelector(".narration-status");
      if (!lines.length || !play || !pause || !stopButton) return;
      play.addEventListener("click", () => {
        if (speechSynthesis.paused && active?.player === player) { speechSynthesis.resume(); if (statusLine) statusLine.textContent = "Narration resumed."; return; }
        stop();
        active = { player, status: statusLine };
        const voice = chooseVoice();
        let index = 0;
        const speakNext = () => {
          clearActiveLine();
          if (index >= lines.length) { if (statusLine) statusLine.textContent = "Narration complete."; active = null; return; }
          const line = lines[index++];
          line.classList.add("active");
          line.scrollIntoView({ behavior: "smooth", block: "nearest" });
          const utterance = new SpeechSynthesisUtterance(line.textContent || "");
          if (voice) utterance.voice = voice;
          utterance.rate = 0.95;
          utterance.pitch = 1.04;
          utterance.onend = speakNext;
          utterance.onerror = () => { if (statusLine) statusLine.textContent = "Narration stopped because this browser could not finish the audio."; clearActiveLine(); active = null; };
          if (statusLine) statusLine.textContent = `Playing line ${index} of ${lines.length}.`;
          speechSynthesis.speak(utterance);
        };
        speakNext();
      });
      pause.addEventListener("click", () => {
        if (active?.player === player && speechSynthesis.speaking && !speechSynthesis.paused) { speechSynthesis.pause(); if (statusLine) statusLine.textContent = "Narration paused."; }
      });
      stopButton.addEventListener("click", stop);
    });
    window.addEventListener("pagehide", stop);
    speechSynthesis.onvoiceschanged = chooseVoice;
  } else if (narrationPlayers.length) {
    narrationPlayers.forEach(player => {
      const statusLine = player.querySelector(".narration-status");
      if (statusLine) statusLine.textContent = "Audio narration is not available in this browser. The full script and subtitles are still available below.";
    });
  }
  if (!auth && !support && !newsletter) return;

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
        if (saved.interest) result.textContent = `Registered interest: ${saved.interest.plan}.`;
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
        result.textContent = `Saved. ${saved.interest.plan} interest is registered.`;
        withdraw.hidden = false;
      } catch (error) { result.textContent = error.message; }
    });
    withdraw?.addEventListener("click", async () => {
      try { await api("/api/beta/interest", { method: "DELETE" }); result.textContent = "Beta interest withdrawn."; withdraw.hidden = true; }
      catch (error) { result.textContent = error.message; }
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
  newsletter?.addEventListener("submit", async event => {
    event.preventDefault();
    if (newsletterResult) newsletterResult.textContent = "";
    const data = Object.fromEntries(new FormData(newsletter));
    data.permissionToReply = Boolean(new FormData(newsletter).get("permissionToReply"));
    data.proof = "";
    data.device = "Public website newsletter signup";
    data.message = `${data.message || "Please add this email to the monthly KinForge newsletter and app-update list."}\n\nUser type: ${data.userType || "Not provided"}`;
    try {
      const saved = await api("/api/support", { method: "POST", body: JSON.stringify(data) });
      if (newsletterResult) newsletterResult.textContent = saved.message || "Newsletter signup sent.";
      newsletter.reset();
    } catch (error) {
      if (newsletterResult) newsletterResult.textContent = error.message;
    }
  });
})();
