import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { act, createElement, StrictMode } from "react";
import { createRoot, type Root } from "react-dom/client";
import { renderToStaticMarkup } from "react-dom/server";
import { BURIAL_TYPE_OPTIONS, CHART_TYPES, EVENT_TYPES, FACT_TYPES, FAMILY_TYPE_OPTIONS, LIST_TYPES, RELATIONSHIP_SUBTYPE_OPTIONS, REPORT_TYPES } from "./domain";
import { GLOSSARY_ENTRIES, GLOSSARY_NOTE, GLOSSARY_SOURCES, meaningFor, searchTerms } from "./terms";
import { TermMeaning, TermsDialog } from "./TermsDialog";

const newCareTerms = [
  "Custody removal", "Custody change", "Custody restoration", "Government protection started",
  "Government protection ended", "Government protection review", "Protective services involvement",
  "Protection order", "Restraining order", "Emergency placement", "Foster placement", "Foster placement ended",
  "Social worker assigned", "Government facility admission", "Government facility discharge", "Kinship care", "Reunification"
];

describe("plain-language glossary", () => {
  it.each([
    ["events", EVENT_TYPES], ["facts", FACT_TYPES], ["families", FAMILY_TYPE_OPTIONS],
    ["relationships", RELATIONSHIP_SUBTYPE_OPTIONS], ["burial", BURIAL_TYPE_OPTIONS],
    ["charts", CHART_TYPES], ["reports", REPORT_TYPES], ["lists", LIST_TYPES], ["new care events", newCareTerms]
  ])("defines every named option in %s", (_name, terms) => {
    for (const term of terms) {
      if (!term.trim()) continue;
      const meaning = meaningFor(term);
      expect(meaning, `Missing definition: ${term}`).toBeDefined();
      expect(meaning!.length, term).toBeGreaterThan(20);
      expect(meaning, term).not.toMatch(/no definition|not yet defined|information about this term/i);
    }
  });

  it("has unambiguous labels and aliases, and valid source references", () => {
    const labels = new Set<string>();
    const sourceIds = new Set(GLOSSARY_SOURCES.map(source => source.id));
    expect(sourceIds.size).toBe(GLOSSARY_SOURCES.length);
    for (const entry of GLOSSARY_ENTRIES) {
      expect(entry.meaning).not.toBe(entry.term);
      for (const label of [entry.term, ...entry.aliases]) {
        const key = label.normalize("NFKD").replace(/\p{M}/gu, "").toLowerCase().replace(/[-\u2010-\u2015]/g, " ").replace(/\s+/g, " ").trim();
        expect(labels.has(key), `Ambiguous glossary label: ${label}`).toBe(false);
        labels.add(key);
        expect(meaningFor(label)).toBe(entry.meaning);
      }
      for (const sourceId of entry.sourceIds) expect(sourceIds.has(sourceId), sourceId).toBe(true);
    }
    for (const source of GLOSSARY_SOURCES) expect(new URL(source.url).protocol).toBe("https:");
  });

  it.each(["", " ", "Custom ceremony", "Possible civil union?", "custody removal alleged", "Unknown court status", "My age custom field", "toString", "__proto__"])("does not invent a meaning for %j", term => {
    expect(meaningFor(term)).toBeUndefined();
    expect(renderToStaticMarkup(createElement(TermMeaning, { term }))).toBe("");
  });

  it("recognises case, spacing, hyphens, and explicit spelling aliases", () => {
    expect(meaningFor("  CIVIL   UNION \n")).toBe(meaningFor("Civil Union"));
    expect(meaningFor("mother in law")).toBe(meaningFor("Mother-in-law"));
    expect(meaningFor("Mother\u2011in\u2011law")).toBe(meaningFor("Mother-in-law"));
    expect(meaningFor("Naturalization")).toBe(meaningFor("Naturalisation"));
    expect(meaningFor("Hospitalisation")).toBe(meaningFor("Hospitalization"));
    expect(meaningFor("Foster ended")).toBe(meaningFor("Foster placement ended"));
  });

  it("keeps union, filing, separation, and annulment meanings distinct", () => {
    expect(meaningFor("Civil union")).toMatch(/legally recognised couple relationship/i);
    expect(meaningFor("Civil union")).toMatch(/vary by place and date/i);
    expect(meaningFor("Separation")).toMatch(/does not end a marriage/i);
    expect(meaningFor("Divorce Filing")).toMatch(/not a completed divorce/i);
    expect(meaningFor("Annulment")).toMatch(/not legally valid/i);
    expect(meaningFor("Marriage License")).toMatch(/does not.*prove.*wedding/i);
  });

  it("explains custody decisions without asserting guilt or permanent loss of rights", () => {
    expect(meaningFor("Custody removal")).toMatch(/does not.*permanent loss of parental rights.*criminal guilt/i);
    expect(meaningFor("Custody change")).toMatch(/who has custody.*where a child lives.*decisions/i);
    expect(meaningFor("Custody restoration")).toMatch(/returning some or all custody/i);
    expect(meaningFor("Legal custody")).toMatch(/important decisions/i);
    expect(meaningFor("Physical custody")).toMatch(/where a child lives/i);
    expect(meaningFor("Protective services involvement")).toMatch(/does not.*allegation was proved/i);
    expect(meaningFor("Restraining order")).toMatch(/not by itself a criminal conviction/i);
    expect(meaningFor("Criminal Record")).toMatch(/not automatically proof of guilt/i);
  });

  it("distinguishes stages of protection, placement, and facility stays", () => {
    expect(meaningFor("Government protection started")).toMatch(/began/i);
    expect(meaningFor("Government protection ended")).toMatch(/does not.*where the person went/i);
    expect(meaningFor("Government protection review")).toMatch(/review alone does not mean.*ended/i);
    expect(meaningFor("Emergency placement")).toMatch(/urgent.*temporary/i);
    expect(meaningFor("Foster placement")).toMatch(/not an adoption/i);
    expect(meaningFor("Foster placement ended")).toMatch(/another placement.*return home/i);
    expect(meaningFor("Government facility admission")).toMatch(/does not establish detention.*guilt.*diagnosis/i);
    expect(meaningFor("Government facility discharge")).toMatch(/stay.*ended/i);
    expect(meaningFor("Social worker assigned")).toMatch(/alone does not say why/i);
    expect(meaningFor("Kinship care")).toMatch(/relatives or trusted people/i);
    expect(meaningFor("Reunification")).toMatch(/does not automatically close a case/i);
  });

  it("explains specific fact types instead of returning a generic fact description", () => {
    expect(meaningFor("Age at Event")).toMatch(/how old.*particular event/i);
    expect(meaningFor("Haplogroup")).toMatch(/one maternal or paternal line/i);
    expect(meaningFor("Ethnicity Estimate")).toMatch(/does not define.*cultural identity/i);
    expect(meaningFor("LDS: Sealing to Parents")).toMatch(/temple ceremony.*Latter-day Saint belief/i);
    expect(meaningFor("LDS: Sealing to Parents")).toMatch(/does not.*biological parentage/i);
    expect(meaningFor("LDS: Endowment")).toMatch(/religious instruction.*promises/i);
    expect(meaningFor("Mobility Aid")).toMatch(/wheelchair.*cane.*walker/i);
  });

  it("makes burial and kinship vocabulary concrete", () => {
    expect(meaningFor("Columbarium")).toMatch(/niches.*urns.*cremated remains/i);
    expect(meaningFor("Mausoleum")).toMatch(/tombs.*above ground/i);
    expect(meaningFor("Reburial")).toMatch(/earlier resting place.*again/i);
    expect(meaningFor("Second cousin")).toMatch(/great-grandparent/i);
    expect(meaningFor("Once removed")).toMatch(/one family generation/i);
    expect(meaningFor("Cousin-in-law")).toMatch(/cousin's spouse.*spouse's cousin/i);
    expect(meaningFor("Maternal")).toMatch(/recorded as the mother/i);
    expect(meaningFor("Parentage")).toMatch(/must not be assumed biological/i);
  });

  it("searches definitions, aliases, and categories with all query words", () => {
    expect(searchTerms("custody")[0].term).toBe("Child Custody");
    expect(searchTerms("civil union")[0].term).toBe("Civil Union");
    expect(searchTerms("urns").map(entry => entry.term)).toContain("Columbarium");
    expect(searchTerms("PPO").map(entry => entry.term)).toContain("Personal protection order");
    expect(searchTerms("  LEGAL decisions ").map(entry => entry.term)).toContain("Legal custody");
    expect(searchTerms("kinship").map(entry => entry.term)).toContain("Once removed");
    expect(searchTerms("sdfgnotaword")).toEqual([]);
    expect(searchTerms("   ")).toEqual(GLOSSARY_ENTRIES);
    expect(searchTerms("child custody").map(entry => entry.term)).not.toContain("Columbarium");
  });

  it("carries the jurisdiction and non-inference rule plus official sources", () => {
    expect(GLOSSARY_NOTE).toMatch(/vary by jurisdiction.*by date/i);
    expect(GLOSSARY_NOTE).toMatch(/does not establish guilt, legal status, parentage/i);
    for (const term of ["Civil Union", "Child Custody", "Protection order", "Kinship care", "Reunification"]) {
      const entry = GLOSSARY_ENTRIES.find(entry => entry.term === term)!;
      expect(entry.sourceIds.length, term).toBeGreaterThan(0);
    }
  });
});

describe("glossary components", () => {
  const showDescriptor = Object.getOwnPropertyDescriptor(HTMLDialogElement.prototype, "showModal");
  const closeDescriptor = Object.getOwnPropertyDescriptor(HTMLDialogElement.prototype, "close");
  const showModal = vi.fn(function (this: HTMLDialogElement) { this.setAttribute("open", ""); });
  const close = vi.fn(function (this: HTMLDialogElement) { this.removeAttribute("open"); });
  let container: HTMLDivElement;
  let launcher: HTMLButtonElement;
  let root: Root;

  beforeAll(() => {
    vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
    Object.defineProperties(HTMLDialogElement.prototype, {
      showModal: { configurable: true, value: showModal },
      close: { configurable: true, value: close }
    });
  });
  afterAll(() => {
    if (showDescriptor) Object.defineProperty(HTMLDialogElement.prototype, "showModal", showDescriptor);
    else Reflect.deleteProperty(HTMLDialogElement.prototype, "showModal");
    if (closeDescriptor) Object.defineProperty(HTMLDialogElement.prototype, "close", closeDescriptor);
    else Reflect.deleteProperty(HTMLDialogElement.prototype, "close");
    vi.unstubAllGlobals();
  });
  beforeEach(() => {
    showModal.mockClear();
    close.mockClear();
    container = document.createElement("div");
    launcher = document.createElement("button");
    launcher.textContent = "Terms";
    document.body.append(launcher, container);
    launcher.focus();
    root = createRoot(container);
  });
  afterEach(() => {
    act(() => root.unmount());
    container.remove();
    launcher.remove();
  });

  function openDialog() {
    const onClose = vi.fn(() => root.render(null));
    act(() => root.render(createElement(TermsDialog, { onClose })));
    return onClose;
  }

  function searchFor(value: string) {
    const input = container.querySelector<HTMLInputElement>('input[type="search"]')!;
    act(() => {
      Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!.call(input, value);
      input.dispatchEvent(new Event("input", { bubbles: true }));
    });
  }

  it("renders a readable inline meaning with an accessible term label", () => {
    act(() => root.render(createElement(TermMeaning, { term: "Civil Union" })));
    expect(container.querySelector(".term-meaning")?.textContent).toBe(meaningFor("Civil Union"));
    expect(container.querySelector(".term-meaning")?.getAttribute("aria-label")).toBe("Meaning of Civil Union");
  });

  it("opens a named native modal, focuses search, and restores focus on dismissal", () => {
    const onClose = openDialog();
    const dialog = container.querySelector("dialog")!;
    expect(showModal).toHaveBeenCalledOnce();
    expect(dialog.open).toBe(true);
    expect(document.getElementById(dialog.getAttribute("aria-labelledby")!)?.textContent).toBe("Terms and meanings");
    expect(document.activeElement).toBe(container.querySelector("input"));
    act(() => container.querySelector<HTMLButtonElement>('[aria-label="Close terms"]')!.click());
    expect(onClose).toHaveBeenCalledOnce();
    expect(close).toHaveBeenCalledOnce();
    expect(container.querySelector("dialog")).toBeNull();
    expect(document.activeElement).toBe(launcher);
  });

  it("handles native Escape cancellation through the supplied close callback", () => {
    const onClose = openDialog();
    const event = new Event("cancel", { bubbles: false, cancelable: true });
    act(() => container.querySelector("dialog")!.dispatchEvent(event));
    expect(event.defaultPrevented).toBe(true);
    expect(onClose).toHaveBeenCalledOnce();
    expect(document.activeElement).toBe(launcher);
  });

  it("filters meanings, announces empty results, and clears the search", () => {
    openDialog();
    const results = container.querySelector<HTMLDivElement>(".terms-results")!;
    results.scrollTop = 200;
    searchFor("urns");
    expect(results.scrollTop).toBe(0);
    expect(container.querySelectorAll("dt")).toHaveLength(1);
    expect(container.querySelector("dt")?.textContent).toContain("Columbarium");
    expect(container.querySelector('[role="status"]')?.textContent).toBe("1 term");
    searchFor("sdfgnotaword");
    expect(container.querySelectorAll("dt")).toHaveLength(0);
    expect(container.querySelector('[role="status"]')?.textContent).toBe("No matching terms.");
    act(() => container.querySelector<HTMLButtonElement>('[aria-label="Clear search"]')!.click());
    expect(container.querySelectorAll("dt")).toHaveLength(GLOSSARY_ENTRIES.length);
    expect(container.querySelector("input")?.value).toBe("");
    expect(document.activeElement).toBe(container.querySelector("input"));
  });

  it("keeps the jurisdiction note and official references available with no matches", () => {
    openDialog();
    searchFor("sdfgnotaword");
    expect(container.querySelector("footer")?.textContent).toContain(GLOSSARY_NOTE);
    expect(container.querySelectorAll("footer a")).toHaveLength(GLOSSARY_SOURCES.length);
    expect(container.querySelector("details")?.open).toBe(false);
  });

  it("survives StrictMode effect replay without leaving the dialog closed", () => {
    act(() => root.render(createElement(StrictMode, null, createElement(TermsDialog, { onClose: () => root.render(null) }))));
    expect(container.querySelector("dialog")?.open).toBe(true);
    expect(document.activeElement).toBe(container.querySelector("input"));
    act(() => root.render(null));
    expect(document.activeElement).toBe(launcher);
  });
});
