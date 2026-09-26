import type { JSONContent } from "@tiptap/core";
import { AppState, MediaItem, Person, fullName } from "./domain";
import type { ReportOptions } from "./reportOptions";
import { narrativeEvent, narrativeNone, narrativeSections, narrativeTerm, NARRATIVE_LANGUAGES } from "./reportNarrative";
import { historyReportDocument, reportLanguage } from "./reportHistory";
import { reportEventSelection } from "./reportMap";
import { personSymbolDocument } from "./reportSymbols";
import { lifeEvents } from "./reportFacts";

const p = (text: string): JSONContent => ({ type: "paragraph", content: text ? [{ type: "text", text }] : [] });
const h = (text: string, level = 2): JSONContent => ({ type: "heading", attrs: { level }, content: [{ type: "text", text }] });
export const localReportImage = (url: string) => /^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/=\s]+$/.test(url);

export function reportMediaVisible(state: AppState, media: MediaItem, includePrivate = false) {
  if (includePrivate) return true;
  media = state.media.find(item => item.id === media.id && item.treeId === media.treeId) || media;
  if (media.visibility === "private" || media.tags.includes("government-file") && media.visibility !== "shared") return false;
  const hiddenPeople = state.people.filter(p => p.treeId === media.treeId && p.private);
  const hiddenEvents = state.events.filter(e => e.private || hiddenPeople.some(p => p.eventIds.includes(e.id)));
  return !hiddenPeople.some(p => p.mediaIds.includes(media.id) || media.assignedTo.some(a => a.kind === "person" && a.id === p.id)) &&
    !hiddenEvents.some(e => e.mediaIds.includes(media.id) || media.assignedTo.some(a => a.kind === "event" && a.id === e.id)) &&
    !state.families.some(f => f.treeId === media.treeId && [...f.partnerIds, ...f.childIds].some(id => hiddenPeople.some(p => p.id === id)) && media.assignedTo.some(a => a.kind === "family" && a.id === f.id));
}

export function reportPortrait(state: AppState, person: Person, includePrivate = false) {
  const media = state.media.filter(m => m.treeId === person.treeId && m.type === "picture" && localReportImage(m.dataUrl) && reportMediaVisible(state, m, includePrivate) && (person.mediaIds.includes(m.id) || m.assignedTo.some(a => a.kind === "person" && a.id === person.id)));
  return media.find(m => m.id === person.profileMediaId) || media[0];
}

export function nestedReportContent(nodes: JSONContent[]) {
  return nodes.map(node => node.type === "heading" ? { ...node, attrs: { ...node.attrs, level: Math.max(3, node.attrs?.level || 2) } } : node);
}

export function storyReportDocument(original: AppState, treeId: string, personId?: string, options: ReportOptions = {}): JSONContent {
  const requestedLanguage = options.language || "en";
  const language = NARRATIVE_LANGUAGES.find(value => value === requestedLanguage) || "en";
  options = { ...options, language };
  const { state, person, families } = reportEventSelection(original, treeId, personId, { ...options, familyId: undefined });
  if (!person) return { type: "doc", content: [h("Story Report", 1), p("Choose a visible person. Private profile details are hidden.")] };
  const events = lifeEvents(state, person, options.eventScope || "person", options);
  const style = options.storyStyle || "documentary";
  const portrait = reportPortrait(original, person, options.includePrivate);
  const header: JSONContent[] = [h("Story Report", 1), h(fullName(person), 3)];
  if (portrait) header.unshift({ type: "image", attrs: { src: portrait.dataUrl, alt: `${fullName(person)} profile picture` } });
  const content: JSONContent[] = [{ type: "reportHeader", content: header }];
  if (language !== requestedLanguage) content.push(p(`Generated story prose is not available in ${requestedLanguage}; English is used. Names, source text and notes remain as recorded.`));
  const none = narrativeNone(language);
  const eventIds = new Set(events.map(e => e.id));
  const eventMediaIds = new Set(events.flatMap(e => e.mediaIds));
  const headerProfileId = portrait && portrait.id === person.profileMediaId ? portrait.id : undefined;
  const photos = state.media.filter(m => m.id !== headerProfileId && m.type === "picture" && localReportImage(m.dataUrl) && reportMediaVisible(original, m, options.includePrivate) && (person.mediaIds.includes(m.id) || eventMediaIds.has(m.id) || m.assignedTo.some(a => a.kind === "person" && a.id === person.id || a.kind === "event" && eventIds.has(a.id) || a.kind === "family" && families.some(f => f.id === a.id))));
  const sourceIds = new Set([...person.sourceIds, ...events.flatMap(e => e.sourceIds), ...person.facts.flatMap(f => f.sourceIds), ...families.filter(f => f.partnerIds.includes(person.id) || f.eventIds.some(id => eventIds.has(id))).flatMap(f => f.sourceIds), ...state.relationships.filter(r => [r.fromId, r.toId].includes(person.id)).flatMap(r => r.sourceIds)]);
  const sources = state.sources.filter(s => sourceIds.has(s.id));
  const citation = (ids: string[]) => sources.map((s, i) => ids.includes(s.id) ? `[${i + 1}]` : "").filter(Boolean).join(" ");
  const photoNode = (photo: MediaItem): JSONContent => {
    const associated = events.filter(e => e.mediaIds.includes(photo.id) || photo.assignedTo.some(a => a.kind === "event" && a.id === e.id));
    return { type: "reportMedia", content: [{ type: "image", attrs: { src: photo.dataUrl, alt: photo.title || fullName(person), width: style === "album" ? "100%" : undefined } }, p(photo.title || fullName(person)), ...associated.map(e => p(`${e.date || "Undated"} | ${narrativeTerm(e.type, language)} ${citation(e.sourceIds)}`)), ...(photo.story ? [p(photo.story)] : [])] };
  };
  const sections = narrativeSections({ ...state, events }, person, { ...options, sections: undefined });
  for (const section of sections) {
    content.push(h(section.title));
    if (section.title === "Life narrative") {
      content.push(...section.paragraphs.map(value => p(`${value}${citation(person.sourceIds) ? ` ${citation(person.sourceIds)}` : ""}`)), ...personSymbolDocument(original, person, options.includePrivate));
    } else if (section.title === "Life events") {
      if (!events.length) content.push(p(none));
      for (const [index, event] of events.entries()) {
        if (style === "chronicle" && index > 0) content.push({ type: "reportPageBreak" });
        if (style === "chronicle") content.push(h(`${event.date || "Undated"} | ${narrativeTerm(event.type, language)}`, 3));
        const owners = [...new Set([...state.people.filter(p => p.eventIds.includes(event.id)).map(fullName), ...state.families.filter(f => f.eventIds.includes(event.id)).flatMap(f => f.partnerIds).map(id => fullName(state.people.find(p => p.id === id)))])];
        const sentence = narrativeEvent(state, event, options);
        content.push(p(`${!person.eventIds.includes(event.id) && owners.length ? `${owners.join(" / ")}: ` : ""}${sentence}${citation(event.sourceIds) ? ` ${citation(event.sourceIds)}` : ""}`));
        if (style !== "album") content.push(...photos.filter(m => event.mediaIds.includes(m.id) || m.assignedTo.some(a => a.kind === "event" && a.id === event.id)).map(photoNode));
      }
    } else content.push(...(section.paragraphs.length ? section.paragraphs.map(p) : [p(none)]));
  }
  content.push(h("Photo Album"));
  const album = style === "album" ? photos : photos.filter(m => !events.some(e => e.mediaIds.includes(m.id) || m.assignedTo.some(a => a.kind === "event" && a.id === e.id)));
  if (style === "album") album.forEach((photo, index) => { if (index) content.push({ type: "reportPageBreak" }); content.push(photoNode(photo)); });
  else if (album.length) content.push({ type: "reportGallery", content: album.map(photoNode) });
  if (!album.length) content.push(p(reportLanguage(options, photos.length ? "Event photographs appear with their events." : "No eligible local photographs recorded.", photos.length ? "Ereignisfotos stehen bei den Ereignissen." : "Keine lokalen Fotos verzeichnet.", photos.length ? "Les photos figurent avec les evenements." : "Aucune photo locale enregistree.", photos.length ? "Las fotos aparecen con sus eventos." : "No hay fotos locales registradas.")));
  if (options.includeHistory) content.push(h("World History"), ...nestedReportContent(historyReportDocument(original, treeId, person.id, options).content!.slice(1)));
  content.push(h("Citations"), ...(sources.length ? sources.map((s, i) => p(`[${i + 1}] ${s.citation || s.title}${s.url ? ` ${s.url}` : ""}`)) : [p("No citations attached to these records.")]));
  return { type: "doc", content };
}
