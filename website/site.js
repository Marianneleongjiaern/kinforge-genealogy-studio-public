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
  const visualDemos = Array.from(document.querySelectorAll("[data-visual-demo]"));
  visualDemos.forEach(demo => {
    const frames = Array.from(demo.querySelectorAll("[data-visual-frame]"));
    const previous = demo.querySelector("[data-visual-prev]");
    const next = demo.querySelector("[data-visual-next]");
    const play = demo.querySelector("[data-visual-play]");
    const statusLine = demo.querySelector("[data-visual-status]");
    let index = 0, timer = 0, playing = false;
    const show = nextIndex => {
      index = (nextIndex + frames.length) % frames.length;
      frames.forEach((frame, frameIndex) => { frame.hidden = frameIndex !== index; frame.classList.toggle("active", frameIndex === index); });
      if (statusLine) statusLine.textContent = `Showing step ${index + 1} of ${frames.length}.`;
    };
    const stopAuto = () => { if (timer) window.clearInterval(timer); timer = 0; playing = false; if (play) play.textContent = "Play demo"; };
    previous?.addEventListener("click", () => { stopAuto(); show(index - 1); });
    next?.addEventListener("click", () => { stopAuto(); show(index + 1); });
    play?.addEventListener("click", () => {
      if (playing) { stopAuto(); return; }
      playing = true; play.textContent = "Pause demo";
      timer = window.setInterval(() => show(index + 1), 3600);
    });
    show(0);
  });
  const createElevenLabsAudio = async text => {
    const response = await fetch("/api/tts", {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-KinForge-Client": "1" },
      body: JSON.stringify({ text })
    });
    if (!response.ok) throw new Error("ElevenLabs narration unavailable");
    const blob = await response.blob();
    const url = URL.createObjectURL(blob);
    const audio = new Audio(url);
    audio.addEventListener("ended", () => URL.revokeObjectURL(url), { once: true });
    audio.addEventListener("error", () => URL.revokeObjectURL(url), { once: true });
    return { audio, url };
  };
  const narrationPlayers = Array.from(document.querySelectorAll(".narration-player"));
  if (narrationPlayers.length && "speechSynthesis" in window) {
    let active = null;
    const edgeVoiceHint = /microsoft.*(aria|jenny|michelle|emma|ava|sara|sonia|libby|natasha|clara|neerja|priya|online|natural)/i;
    const voiceHint = /female|woman|samantha|victoria|karen|zira|aria|jenny|susan|ava|serena|moira|tessa|salli|joanna|amy|emma/i;
    const chooseVoice = () => {
      const voices = speechSynthesis.getVoices();
      return voices.find(voice => voice.lang.toLowerCase().startsWith("en") && edgeVoiceHint.test(voice.name)) || voices.find(voice => edgeVoiceHint.test(voice.name)) || voices.find(voice => voice.lang.toLowerCase().startsWith("en") && voiceHint.test(voice.name)) || voices.find(voice => voice.lang.toLowerCase().startsWith("en")) || voices[0] || null;
    };
    const clearActiveLine = () => document.querySelectorAll("[data-narration-line].active").forEach(line => line.classList.remove("active"));
    const stop = () => {
      speechSynthesis.cancel();
      if (active?.audio) { active.audio.pause(); active.audio.src = ""; if (active.url) URL.revokeObjectURL(active.url); }
      clearActiveLine();
      if (active?.status) active.status.textContent = "Narration stopped.";
      active = null;
    };
    narrationPlayers.forEach(player => {
      const lines = Array.from(player.querySelectorAll("[data-narration-line]"));
      const play = player.querySelector(".narration-play");
      const pause = player.querySelector(".narration-pause");
      const stopButton = player.querySelector(".narration-stop");
      const statusLine = player.querySelector(".narration-status");
      const volume = player.querySelector(".narration-volume input");
      const volumeValue = player.querySelector(".narration-volume span");
      if (!lines.length || !play || !pause || !stopButton) return;
      volume?.addEventListener("input", () => {
        if (volumeValue) volumeValue.textContent = `${volume.value}%`;
        if (active?.audio && active.player === player) active.audio.volume = Math.max(0, Math.min(1, Number(volume.value) / 100));
      });
      play.addEventListener("click", async () => {
        if (active?.audio && active.player === player && active.audio.paused) { await active.audio.play(); if (statusLine) statusLine.textContent = "Narration resumed."; return; }
        if (speechSynthesis.paused && active?.player === player) { speechSynthesis.resume(); if (statusLine) statusLine.textContent = "Narration resumed."; return; }
        stop();
        active = { player, status: statusLine };
        const fullText = lines.map(line => line.textContent || "").join(" ");
        try {
          if (statusLine) statusLine.textContent = "Preparing human-like narration.";
          const generated = await createElevenLabsAudio(fullText);
          generated.audio.volume = Math.max(0, Math.min(1, Number(volume?.value || 85) / 100));
          active = { player, status: statusLine, audio: generated.audio, url: generated.url };
          lines[0]?.classList.add("active");
          generated.audio.onplay = () => { if (statusLine) statusLine.textContent = "Human-like narration playing."; };
          generated.audio.onended = () => { if (statusLine) statusLine.textContent = "Narration complete."; clearActiveLine(); active = null; };
          generated.audio.onerror = () => { if (statusLine) statusLine.textContent = "Narration stopped."; clearActiveLine(); active = null; };
          await generated.audio.play();
          return;
        } catch (error) {
          if (statusLine) statusLine.textContent = "Using browser narration while human-like audio is unavailable.";
        }
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
          utterance.volume = Math.max(0, Math.min(1, Number(volume?.value || 85) / 100));
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
        if (active?.audio && active.player === player && !active.audio.paused) { active.audio.pause(); if (statusLine) statusLine.textContent = "Narration paused."; return; }
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
  const siteReaderTargets = Array.from(document.querySelectorAll("main section, main article, main details")).filter(target => {
    if (target.closest(".narration-player") || target.closest(".site-reader-controls") || target.querySelector(":scope > .site-reader-controls")) return false;
    const text = (target.innerText || "").replace(/\s+/g, " ").trim();
    return text.length > 80;
  });
  if (siteReaderTargets.length && "speechSynthesis" in window) {
    let readerVoice = null;
    let readerActive = null;
    const chooseReaderVoice = () => {
      const voices = speechSynthesis.getVoices();
      readerVoice = voices.find(v => /microsoft.*(aria|jenny|michelle|emma|ava|sara|sonia|libby|natasha|clara|neerja|priya|online|natural)/i.test(v.name) && /^en[-_]/i.test(v.lang)) || voices.find(v => /microsoft.*(aria|jenny|michelle|emma|ava|sara|sonia|libby|natasha|clara|neerja|priya|online|natural)/i.test(v.name)) || voices.find(v => /samantha|victoria|karen|serena|moira|tessa|zira|ava|susan|allison|female/i.test(v.name) && /^en[-_]/i.test(v.lang)) || voices.find(v => /samantha|victoria|karen|serena|moira|tessa|zira|ava|susan|allison|female/i.test(v.name)) || voices.find(v => /natural|premium|neural/i.test(v.name) && /^en[-_]/i.test(v.lang)) || voices.find(v => /^en[-_]/i.test(v.lang)) || voices[0] || null;
    };
    const stopReader = () => {
      speechSynthesis.cancel();
      if (readerActive?.audio) { readerActive.audio.pause(); readerActive.audio.src = ""; if (readerActive.url) URL.revokeObjectURL(readerActive.url); }
      if (readerActive?.status) readerActive.status.textContent = "Read aloud stopped.";
      document.querySelectorAll(".site-reader-active").forEach(node => node.classList.remove("site-reader-active"));
      readerActive = null;
    };
    const getReaderText = target => Array.from(target.querySelectorAll("h1,h2,h3,h4,p,li,summary,figcaption,a.button,button:not(.site-reader-button)"))
      .map(node => (node.innerText || node.textContent || "").replace(/\s+/g, " ").trim())
      .filter(Boolean)
      .join(". ");
    chooseReaderVoice();
    siteReaderTargets.forEach((target, index) => {
      const controls = document.createElement("div");
      controls.className = "site-reader-controls";
      controls.setAttribute("aria-label", "Text to speech controls");
      controls.innerHTML = '<button type="button" class="site-reader-button site-reader-play">Read aloud</button><button type="button" class="site-reader-button site-reader-pause">Pause</button><button type="button" class="site-reader-button site-reader-stop">Stop</button><label class="site-reader-volume">Volume <input type="range" min="0" max="100" step="5" value="85" aria-label="Read aloud volume"><span>85%</span></label><p class="site-reader-status" aria-live="polite"></p>';
      target.insertBefore(controls, target.firstChild);
      const play = controls.querySelector(".site-reader-play");
      const pause = controls.querySelector(".site-reader-pause");
      const stop = controls.querySelector(".site-reader-stop");
      const volume = controls.querySelector(".site-reader-volume input");
      const volumeLabel = controls.querySelector(".site-reader-volume span");
      const status = controls.querySelector(".site-reader-status");
      target.dataset.siteReader = String(index + 1);
      volume?.addEventListener("input", () => {
        if (volumeLabel) volumeLabel.textContent = volume.value + "%";
        if (readerActive?.utterance) readerActive.utterance.volume = Number(volume.value) / 100;
        if (readerActive?.audio) readerActive.audio.volume = Number(volume.value) / 100;
      });
      play?.addEventListener("click", async () => {
        if (readerActive?.audio && readerActive.target === target && readerActive.audio.paused) { await readerActive.audio.play(); if (status) status.textContent = "Read aloud resumed."; return; }
        if (speechSynthesis.paused && readerActive?.target === target) { speechSynthesis.resume(); if (status) status.textContent = "Read aloud resumed."; return; }
        stopReader();
        const text = getReaderText(target);
        if (!text) { if (status) status.textContent = "There is no readable text in this section."; return; }
        try {
          if (status) status.textContent = "Preparing human-like read aloud.";
          const generated = await createElevenLabsAudio(text);
          generated.audio.volume = volume ? Number(volume.value) / 100 : 0.85;
          target.classList.add("site-reader-active");
          readerActive = { target, audio: generated.audio, url: generated.url, status };
          generated.audio.onplay = () => { if (status) status.textContent = "Human-like read aloud playing."; };
          generated.audio.onended = () => { if (status) status.textContent = "Finished reading this section."; target.classList.remove("site-reader-active"); readerActive = null; };
          generated.audio.onerror = () => { if (status) status.textContent = "Read aloud stopped."; target.classList.remove("site-reader-active"); readerActive = null; };
          await generated.audio.play();
          return;
        } catch (error) {
          if (status) status.textContent = "Using browser voice while human-like audio is unavailable.";
        }
        const utterance = new SpeechSynthesisUtterance(text);
        if (readerVoice) utterance.voice = readerVoice;
        utterance.lang = document.documentElement.lang || readerVoice?.lang || "en-US";
        utterance.rate = 0.94;
        utterance.pitch = 1.03;
        utterance.volume = volume ? Number(volume.value) / 100 : 0.85;
        target.classList.add("site-reader-active");
        readerActive = { target, utterance, status };
        utterance.onstart = () => { if (status) status.textContent = "Reading this section aloud."; };
        utterance.onend = () => { if (status) status.textContent = "Finished reading this section."; target.classList.remove("site-reader-active"); readerActive = null; };
        utterance.onerror = () => { if (status) status.textContent = "Read aloud stopped."; target.classList.remove("site-reader-active"); readerActive = null; };
        speechSynthesis.speak(utterance);
      });
      pause?.addEventListener("click", () => {
        if (!readerActive || readerActive.target !== target) return;
        if (readerActive.audio) {
          if (readerActive.audio.paused) { readerActive.audio.play(); if (status) status.textContent = "Read aloud resumed."; }
          else { readerActive.audio.pause(); if (status) status.textContent = "Read aloud paused."; }
          return;
        }
        if (speechSynthesis.paused) { speechSynthesis.resume(); if (status) status.textContent = "Read aloud resumed."; }
        else { speechSynthesis.pause(); if (status) status.textContent = "Read aloud paused."; }
      });
      stop?.addEventListener("click", stopReader);
    });
    window.addEventListener("pagehide", stopReader);
    speechSynthesis.addEventListener?.("voiceschanged", chooseReaderVoice);
  } else if (siteReaderTargets.length) {
    siteReaderTargets.forEach(target => {
      const controls = document.createElement("div");
      controls.className = "site-reader-controls";
      controls.innerHTML = '<p class="site-reader-status">Read aloud is not available in this browser.</p>';
      target.insertBefore(controls, target.firstChild);
    });
  }
  const languagePanels = Array.from(document.querySelectorAll("[data-language-panel]"));
  languagePanels.forEach(panel => {
    const reader = panel.querySelector("[data-reader-language]");
    const apply = panel.querySelector("[data-apply-language]");
    const statusLine = panel.querySelector("[data-language-status]");
    const params = new URLSearchParams(window.location.search);
    const queryLanguage = params.get("lang");
    const savedLanguage = queryLanguage || localStorage.getItem("kinforgeReaderLanguage") || ((navigator.language || "").toLowerCase().includes("us") ? "en-US" : "en-GB");
    if (reader) reader.value = savedLanguage;
    const copy = {
      "en-US": { title: "Choose the language that works best for you", intro: "KinForge is designed to feel natural for people using American English. This setting uses U.S. spelling, grammar, vocabulary, and phrasing across the page.", note: "The page is using American English wording." },
      "en-GB": { title: "Choose the language that suits you best", intro: "KinForge is written to read naturally for people using British English. This setting favours British spelling, grammar, vocabulary, and phrasing across the page.", note: "The page is using British English wording." }
    };
    const languageCodes = { "en-US":"en-US", "en-GB":"en-GB", zh:"zh", es:"es", fr:"fr", de:"de", hi:"hi", ar:"ar", pt:"pt", id:"id", ms:"ms", ja:"ja", ko:"ko", other:"en" };
    const translatedCodes = new Set(["zh", "es", "fr", "de", "hi", "ar", "pt", "id", "ms", "ja", "ko"]);
    const britishTerms = [
      ["localization", "localisation"], ["Localization", "Localisation"], ["localize", "localise"], ["localizing", "localising"], ["localized", "localised"],
      ["organization", "organisation"], ["Organization", "Organisation"], ["organize", "organise"], ["organizing", "organising"], ["organized", "organised"],
      ["behavior", "behaviour"], ["Behavior", "Behaviour"], ["color", "colour"], ["Color", "Colour"], ["favorite", "favourite"], ["Favorite", "Favourite"],
      ["center", "centre"], ["Center", "Centre"], ["program", "programme"], ["Program", "Programme"], ["toward", "towards"], ["Toward", "Towards"],
      ["learned", "learnt"], ["Learned", "Learnt"], ["canceled", "cancelled"], ["Canceled", "Cancelled"], ["modeling", "modelling"], ["Modeling", "Modelling"],
      ["license", "licence"], ["License", "Licence"], ["practice", "practise"], ["Practice", "Practise"]
    ];
    const americanTerms = britishTerms.map(([us, gb]) => [gb, us]);
    const britishPhrases = [
      ["Choose the language that works best for you", "Choose the language that suits you best"],
      ["KinForge is designed to feel natural for people using American English.", "KinForge is written to read naturally for people using British English."],
      ["This setting uses U.S. spelling, grammar, vocabulary, and phrasing across the page.", "This setting favours British spelling, grammar, vocabulary, and phrasing across the page."],
      ["The page is using American English wording.", "The page is using British English wording."],
      ["Get started free", "Start for free"], ["Get started for free", "Start for free"], ["Create free account", "Create a free account"],
      ["Official app", "Official application"], ["official app", "official application"], ["Use cases", "Who it is for"], ["use cases", "who it is for"],
      ["Help & support", "Help and support"], ["Download KinForge", "Download KinForge"], ["4-day free trial", "four-day free trial"],
      ["safer workspace", "more secure workspace"], ["safe workspace", "secure workspace"], ["data practices", "data handling"],
      ["feedback paths", "feedback routes"], ["support paths", "support routes"], ["meaningful features", "properly useful features"],
      ["people using it", "people who use it"], ["works best for you", "suits you best"], ["what comes next", "what happens next"],
      ["relationship-focused workspace", "relationship-focused workspace"], ["user ownership", "user control"], ["Users should", "People should"],
      ["users deserve", "people deserve"], ["Users deserve", "People deserve"], ["user needs", "people's needs"], ["real users", "real people"],
      ["learn", "find out"], ["Learn", "Find out"], ["sign up", "register"], ["Sign up", "Register"]
    ];
    const americanPhrases = britishPhrases.map(([us, gb]) => [gb, us]);
    const replaceWords = (text, pairs) => pairs.reduce((value, pair) => value.replace(new RegExp("\\b" + pair[0] + "\\b", "g"), pair[1]), text);
    const applyEnglishVariant = (style) => {
      const phrasePairs = style === "en-GB" ? britishPhrases : americanPhrases;
      const pairs = style === "en-GB" ? britishTerms : americanTerms;
      const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT, {
        acceptNode(node) {
          const parent = node.parentElement;
          if (!parent || ["SCRIPT", "STYLE", "TEXTAREA", "INPUT", "SELECT", "OPTION"].includes(parent.tagName)) return NodeFilter.FILTER_REJECT;
          if (!node.nodeValue || !node.nodeValue.trim()) return NodeFilter.FILTER_REJECT;
          return NodeFilter.FILTER_ACCEPT;
        }
      });
      const nodes = [];
      while (walker.nextNode()) nodes.push(walker.currentNode);
      nodes.forEach(node => { node.nodeValue = replaceWords(replaceWords(node.nodeValue, phrasePairs), pairs); });
    };
    const updateText = (selector, text) => panel.querySelectorAll(selector).forEach(node => { node.textContent = text; });
    const currentPageUrl = (value) => {
      const next = new URL(window.location.href);
      next.searchParams.set("lang", value);
      return next.toString();
    };
    const translateUrl = (value) => "https://translate.google.com/translate?sl=en&tl=" + encodeURIComponent(value) + "&u=" + encodeURIComponent(currentPageUrl(value));
    const update = () => {
      const value = reader?.value || "en-US";
      const selectedName = reader?.selectedOptions?.[0]?.textContent || "English - American English";
      const englishCopy = copy[value] || { title: "Choose your reading language", intro: "KinForge is meant to be readable in your own language where browser or device translation supports it. For English, choose American English or British English in this same dropdown.", note: "Use your browser or device translation tool for this language where available." };
      document.documentElement.lang = languageCodes[value] || "en";
      document.documentElement.dir = value === "ar" ? "rtl" : "ltr";
      localStorage.setItem("kinforgeReaderLanguage", value);
      localStorage.setItem("kinforgeEnglishStyle", value === "en-GB" ? "gb" : "us");
      updateText("[data-language-title]", englishCopy.title);
      updateText('[data-language-copy="intro"]', englishCopy.intro);
      if (value === "en-US") updateText('[data-language-card-copy="english"]', "American English is active. KinForge uses U.S. spelling, grammar, and wording in this language panel.");
      else if (value === "en-GB") updateText('[data-language-card-copy="english"]', "British English is active. KinForge uses British spelling, grammar, and wording in this language panel.");
      else updateText('[data-language-card-copy="english"]', "English remains available as American English or British English in this same dropdown.");
      if (statusLine) statusLine.textContent = "Current choice: " + selectedName + ". " + englishCopy.note;
      if (value === "en-US" || value === "en-GB") applyEnglishVariant(value);
    };
    const reloadForChoice = () => {
      const value = reader?.value || "en-US";
      localStorage.setItem("kinforgeReaderLanguage", value);
      localStorage.setItem("kinforgeEnglishStyle", value === "en-GB" ? "gb" : "us");
      if (translatedCodes.has(value)) { window.location.assign(translateUrl(value)); return; }
      window.location.assign(currentPageUrl(value));
    };
    reader?.addEventListener("change", reloadForChoice);
    apply?.addEventListener("click", reloadForChoice);
    update();
  });
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
