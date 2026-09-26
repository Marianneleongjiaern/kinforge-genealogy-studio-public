import type { JSONContent } from "@tiptap/core";
import { geoArea, geoGraticule10, geoNaturalEarth1, geoPath } from "d3-geo";
import type { FeatureCollection, Geometry } from "geojson";
import { AppState, PersonEvent, fullName } from "./domain";
import type { ReportOptions } from "./reportOptions";
import { reportScope } from "./reportCatalog";
import { compareDates, dateInterval, dateParts, inDateRange } from "./reportDates";
import landData from "./data/reportLand110m.json";
import geographySource from "./data/reportGeographySource.json";

export type MappedEvent = { id: string; date: string; type: string; description: string; owners: string[]; ownerKeys: string[]; placeId?: string; sourceIds: string[] };
export type MapLocation = { number: number; id: string; name: string; latitude: number; longitude: number; events: MappedEvent[] };
export type ReportMapModel = { title: string; width: number; height: number; locations: MapLocation[]; unmapped: { event: MappedEvent; place: string; reason: string }[]; routes: { owner: string; from: number; to: number; fromDate: string; toDate: string }[] };
const p = (text: string): JSONContent => ({ type: "paragraph", content: [{ type: "text", text }] });
const h = (text: string, level = 2): JSONContent => ({ type: "heading", attrs: { level }, content: [{ type: "text", text }] });

export function recordedCoordinates(latitude: string, longitude: string): [number, number] | undefined {
  const decimal = /^[+-]?(?:\d+(?:\.\d*)?|\.\d+)$/;
  if (!decimal.test(latitude.trim()) || !decimal.test(longitude.trim())) return;
  const lat = Number(latitude), lon = Number(longitude);
  if (Number.isFinite(lat) && Number.isFinite(lon) && Math.abs(lat) <= 90 && Math.abs(lon) <= 180) return [lon, lat];
}

export function reportEventSelection(original: AppState, treeId: string, personId: string | undefined, options: ReportOptions = {}) {
  const state = reportScope(original, treeId, options.includePrivate, options.parentage);
  const person = options.familyId ? undefined : state.people.find(p => p.id === personId);
  const family = options.familyId ? state.families.find(f => f.id === options.familyId) : undefined;
  const ids = new Set(family ? [...family.partnerIds, ...family.childIds] : person ? [person.id] : []);
  if (person && !family && options.eventScope && options.eventScope !== "person") {
    const pending = [person.id];
    while (pending.length) {
      const current = pending.shift()!;
      const related = state.relationships.filter(r => r.fromId === current || r.toId === current).map(r => r.fromId === current ? r.toId : r.fromId);
      state.families.filter(f => [...f.partnerIds, ...f.childIds].includes(current)).forEach(f => related.push(...f.partnerIds, ...f.childIds));
      for (const id of related) if (!ids.has(id)) { ids.add(id); if (options.eventScope === "all-relatives") pending.push(id); }
    }
  }
  const people = state.people.filter(p => ids.has(p.id));
  const families = family ? [family] : state.families.filter(f => [...f.partnerIds, ...f.childIds].some(id => ids.has(id)));
  const eventIds = new Set([...people.flatMap(p => p.eventIds), ...families.flatMap(f => f.eventIds)]);
  const matches = (e: PersonEvent) => (options.eventTypes === undefined || options.eventTypes.includes(e.type)) && inDateRange(e.date, options.dateFrom, options.dateTo);
  const events = state.events.filter(e => eventIds.has(e.id) && matches(e)).sort((a, b) => compareDates(a.date, b.date) || a.id.localeCompare(b.id));
  return { state, person, family, people, families, events };
}

export function buildReportMap(original: AppState, treeId: string, personId?: string, options: ReportOptions = {}): ReportMapModel {
  const { state, person, family, people, families, events } = reportEventSelection(original, treeId, personId, options);
  const model: ReportMapModel = { title: `Recorded event places${person ? `: ${fullName(person)}` : family ? `: ${family.partnerIds.map(id => fullName(state.people.find(p => p.id === id))).join(" / ") || "Recorded family"}` : ""}`, width: 1080, height: 640, locations: [], unmapped: [], routes: [] };
  const owners = new Map<string, string>();
  for (const event of events) {
    const personal = people.filter(p => p.eventIds.includes(event.id));
    const groups = families.filter(f => f.eventIds.includes(event.id));
    const labels = [...personal.map(fullName), ...groups.map(f => `Family: ${f.partnerIds.map(id => fullName(state.people.find(p => p.id === id))).join(" / ") || "Recorded family"}`)];
    const keys = [...personal.map(p => `person:${p.id}`), ...groups.map(f => `family:${f.id}`)];
    keys.forEach((key, i) => owners.set(key, labels[i]));
    const mapped: MappedEvent = { ...event, owners: labels, ownerKeys: keys };
    const place = state.places.find(p => p.id === event.placeId);
    const coordinates = place && recordedCoordinates(place.latitude, place.longitude);
    if (!place || !coordinates) {
      model.unmapped.push({ event: mapped, place: place?.name || "Place not recorded", reason: !place ? "No recorded place" : !place.latitude.trim() || !place.longitude.trim() ? "Coordinates not recorded" : "Invalid recorded coordinates" });
      continue;
    }
    let location = model.locations.find(p => p.id === place.id);
    if (!location) { location = { number: model.locations.length + 1, id: place.id, name: place.name, longitude: coordinates[0], latitude: coordinates[1], events: [] }; model.locations.push(location); }
    location.events.push(mapped);
  }
  // Connect only successive unambiguously dated events belonging to the same owner.
  for (const [key, owner] of owners) {
    const dated = events.filter(e => dateParts(e.date) && (people.some(p => `person:${p.id}` === key && p.eventIds.includes(e.id)) || families.some(f => `family:${f.id}` === key && f.eventIds.includes(e.id))));
    for (let i = 1; i < dated.length; i++) {
      const a = dated[i - 1], b = dated[i];
      if (compareDates(a.date, b.date) === 0 || dated.filter(e => compareDates(e.date, a.date) === 0).length > 1 || dated.filter(e => compareDates(e.date, b.date) === 0).length > 1) continue;
      const aTime = dateInterval(a.date)!.earliest, bTime = dateInterval(b.date)!.latest;
      if (events.some(e => !dateParts(e.date) && e.id !== a.id && e.id !== b.id && (people.some(p => `person:${p.id}` === key && p.eventIds.includes(e.id)) || families.some(f => `family:${f.id}` === key && f.eventIds.includes(e.id))) && (!dateInterval(e.date) || dateInterval(e.date)!.latest >= aTime && dateInterval(e.date)!.earliest <= bTime))) continue;
      const from = model.locations.find(l => l.events.some(e => e.id === a.id)), to = model.locations.find(l => l.events.some(e => e.id === b.id));
      if (from && to && from.number !== to.number) model.routes.push({ owner, from: from.number, to: to.number, fromDate: a.date, toDate: b.date });
    }
  }
  return model;
}

export function mapReportDocument(state: AppState, treeId: string, personId?: string, options: ReportOptions = {}): JSONContent {
  const selected = reportEventSelection(state, treeId, personId, options);
  const model = buildReportMap(state, treeId, personId, options);
  const content: JSONContent[] = [h("Map Report", 1)];
  if (!selected.person && !selected.family) return { type: "doc", content: [...content, p("Choose a visible person or family. Private profile details are hidden.")] };
  const line = (e: MappedEvent) => `${e.date || "Undated"} | ${e.type} | ${e.owners.join("; ")}${e.description ? ` | ${e.description}` : ""}`;
  content.push(h("Mapped Places"), { type: "reportMap", attrs: { map: model } }, p(`${model.locations.length} recorded places mapped. Numbers identify places in the legend. Coordinates come only from your place records.`), p(geographySource.attribution), p(geographySource.limitations));
  content.push(h("Map Legend"));
  for (const place of model.locations) content.push(h(`${place.number}. ${place.name}`, 3), p(`Recorded coordinates: ${place.latitude}, ${place.longitude}`), ...place.events.map(e => p(line(e))));
  if (!model.locations.length) content.push(p("No events with valid recorded coordinates. No locations have been guessed."));
  content.push(h("Event Routes"), p("Dashed lines link successive dated events for the same person or family. These show sequence, not a recorded journey or a travel route. Same-day, partial-date and unmapped events are not joined."));
  content.push(...(model.routes.length ? model.routes.map(r => p(`${r.owner}: ${r.fromDate} at place ${r.from} to ${r.toDate} at place ${r.to}.`)) : [p("No unambiguous sequence between different mapped places.")]));
  content.push(h("Unmapped Events"), ...(model.unmapped.length ? model.unmapped.map(row => p(`${line(row.event)} | ${row.place}: ${row.reason}.`)) : [p("All selected events have valid recorded coordinates.")]));
  const sourceIds = new Set([...selected.events.flatMap(e => e.sourceIds), ...selected.state.places.filter(p => model.locations.some(l => l.id === p.id)).flatMap(p => p.sourceIds)]);
  content.push(h("Citations"), ...selected.state.sources.filter(s => sourceIds.has(s.id)).map(s => p(s.citation || s.title)), p(`Basemap: ${geographySource.website} | ${geographySource.licenseUrl}`));
  return { type: "doc", content };
}

const land = structuredClone(landData) as FeatureCollection<Geometry>;
// D3 uses clockwise small spherical polygons; normalize independently of GeoJSON winding.
for (const feature of land.features) {
  if (feature.geometry.type === "Polygon" && geoArea(feature) > 2 * Math.PI) feature.geometry.coordinates.forEach(ring => ring.reverse());
  if (feature.geometry.type === "MultiPolygon") for (const polygon of feature.geometry.coordinates) if (geoArea({ type: "Polygon", coordinates: polygon }) > 2 * Math.PI) polygon.forEach(ring => ring.reverse());
}

export function drawReportMap(model: ReportMapModel): string {
  const canvas = document.createElement("canvas"); canvas.width = model.width * 2; canvas.height = model.height * 2;
  const c = canvas.getContext("2d"); if (!c) throw new Error("Map drawing is unavailable.");
  c.scale(2, 2); c.fillStyle = "#ffffff"; c.fillRect(0, 0, model.width, model.height);
  const projection = geoNaturalEarth1().fitExtent([[22, 64], [model.width - 22, model.height - 54]], { type: "Sphere" });
  const path = geoPath(projection, c);
  c.beginPath(); path({ type: "Sphere" }); c.fillStyle = "#e8f4f8"; c.fill(); c.strokeStyle = "#a6c1cc"; c.stroke();
  c.beginPath(); path(geoGraticule10()); c.strokeStyle = "#cedfe5"; c.lineWidth = .5; c.stroke();
  c.beginPath(); path(land); c.fillStyle = "#e7eddc"; c.fill(); c.strokeStyle = "#84977c"; c.lineWidth = .8; c.stroke();
  c.strokeStyle = "#9a4364"; c.lineWidth = 2; c.setLineDash([5, 4]);
  for (const route of model.routes) {
    const a = model.locations.find(l => l.number === route.from)!, b = model.locations.find(l => l.number === route.to)!;
    c.beginPath(); path({ type: "LineString", coordinates: [[a.longitude, a.latitude], [b.longitude, b.latitude]] }); c.stroke();
  }
  c.setLineDash([]);
  const used: [number, number][] = [];
  for (const location of model.locations) {
    const [x, y] = projection([location.longitude, location.latitude])!;
    let labelX = x, labelY = y;
    for (let step = 0; used.some(([a, b]) => Math.hypot(a - labelX, b - labelY) < 29) && step < 200; step++) {
      const angle = step * 2.39996, radius = 18 + Math.sqrt(step) * 10;
      labelX = Math.max(17, Math.min(model.width - 17, x + Math.cos(angle) * radius)); labelY = Math.max(66, Math.min(model.height - 54, y + Math.sin(angle) * radius));
    }
    used.push([labelX, labelY]);
    c.fillStyle = "#235765"; c.beginPath(); c.arc(x, y, 3, 0, Math.PI * 2); c.fill();
    c.strokeStyle = "#235765"; c.beginPath(); c.moveTo(x, y); c.lineTo(labelX, labelY); c.stroke();
    c.fillStyle = "#235765"; c.beginPath(); c.arc(labelX, labelY, 13, 0, Math.PI * 2); c.fill();
    c.fillStyle = "white"; c.font = "bold 14px Arial"; c.textAlign = "center"; c.fillText(String(location.number), labelX, labelY + 5, 23);
  }
  c.textAlign = "left"; c.fillStyle = "#24383b"; c.font = "bold 22px Arial"; c.fillText(model.title, 22, 32, model.width - 44);
  c.font = "14px Arial"; c.fillText("Natural Earth 1:110m | Recorded coordinates | Dashed lines: event sequence", 22, model.height - 20, model.width - 44);
  return canvas.toDataURL("image/png");
}
