import { ReactNode, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowLeft, ArrowUpRight, BookOpen, Camera, ChevronDown, ChevronUp, FileText, Image, MoreHorizontal, Network, Pencil, Plus, Search, UserPlus, UserRound } from "lucide-react";
import { AppState, Person, PersonNeed, emptyIdentityDetails, fullName } from "./domain";
import { getChildren, getParents, getPartners } from "./analysis";
import { relationshipsByPerson } from "./personRelationships";
import { PROFILE_TABS, workspacePath } from "./workspace";
import { familyGroups } from "./treeGraph";
import { lifespan } from "./TreeWorkspace";
import { CaptionedGlyph, EventGlyph, SymbolLegend } from "./Glyph";
import { PersonNeeds, PersonNeedsSummary } from "./PersonNeeds";
import { reportPortrait } from "./reportDocument";

type Props = { state: AppState; treeId: string; person?: Person; profileId?: string; tab?: string; editor: ReactNode; onAdd: () => void; onAddRelative: () => void; onNeedsChange: (needs: PersonNeed[]) => void; onPortrait: (id: string) => void; canEditSensitive?: boolean };

export function PeopleWorkspace({ state, treeId, person, profileId, tab = "overview", editor, onAdd, onAddRelative, onNeedsChange, onPortrait, canEditSensitive = true }: Props) {
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState("all");
  const [sort, setSort] = useState("name");
  const [profileSections, setProfileSections] = useState({ media: false, biography: false, family: true, facts: true });
  const people = state.people.filter(entry => entry.treeId === treeId);
  const profilePath = (id: string, section = "overview") => workspacePath({ treeId, view: "people", personId: id, tab: section });
  if (!profileId || !person) {
    const filtered = people.filter(entry => {
      const matches = [fullName(entry), ...entry.aliases, ...entry.labels].join(" ").toLowerCase().includes(query.toLowerCase());
      return matches && (filter === "all" || (filter === "living" && entry.living) || (filter === "private" && entry.private) || (filter === "unsourced" && !entry.sourceIds.length));
    }).sort((a, b) => sort === "birth" ? (a.birthDate || "9999").localeCompare(b.birthDate || "9999") : `${a.familyName} ${a.givenName}`.localeCompare(`${b.familyName} ${b.givenName}`));
    return <div className="people-workspace"><div className="page-heading"><div><h1>People</h1><p className="quiet">{people.length} family members</p></div><button className="button primary" onClick={onAdd}><Plus size={16} />Add person</button></div>
      <div className="directory-toolbar"><label className="tree-search"><Search size={17} /><input aria-label="Search people" placeholder="Search names, aliases, labels" value={query} onChange={event => setQuery(event.target.value)} /></label><select className="control" aria-label="Filter people" value={filter} onChange={event => setFilter(event.target.value)}><option value="all">Everyone</option><option value="living">Living people</option><option value="private">Private profiles</option><option value="unsourced">Needs sources</option></select><select className="control" aria-label="Sort people" value={sort} onChange={event => setSort(event.target.value)}><option value="name">Sort by name</option><option value="birth">Sort by birth date</option></select></div>
      <div className="people-table" role="table" aria-label="People directory"><div className="people-table-head" role="row"><span>Name</span><span>Born</span><span>Status</span><span>Sources</span></div>{filtered.map(entry => {
        const portrait = reportPortrait(state, entry, true);
        return <Link role="row" to={profilePath(entry.id)} className="people-table-row" key={entry.id}><span className="directory-name"><span className="person-avatar" style={{ borderColor: entry.branchColor }}>{portrait ? <img src={portrait.dataUrl} alt="" /> : <UserRound size={20} />}</span><span><strong>{fullName(entry)}</strong><small>{entry.aliases.join(", ") || entry.labels.join(", ") || "Family member"}</small></span></span><span>{entry.birthDate || "Unknown"}</span><span>{entry.living ? "Living" : "Deceased"}{entry.private && " · Private"}</span><span>{entry.sourceIds.length}<ArrowUpRight size={16} /></span></Link>;
      })}</div>
      {!filtered.length && <p className="empty-state">No people match this search.</p>}
    </div>;
  }
  const parents = getParents(state, person.id), partners = getPartners(state, person.id), children = getChildren(state, person.id);
  const relationshipDetails = relationshipsByPerson(people, state.relationships).get(person.id) || [];
  const identity = { ...emptyIdentityDetails(), ...(person.identity || {}) };
  const showIdentity = canEditSensitive || identity.visibility === "shared";
  const siblings = relationshipDetails.filter(rel => /\b(sibling|sister|brother)\b/i.test(rel.relativeRole)).map(rel => rel.person);
  const guardians = relationshipDetails.filter(rel => ["Guardian", "Ward"].includes(rel.relativeRole)).map(rel => rel.person);
  const personEvents = state.events.filter(event => person.eventIds.includes(event.id));
  const sourceIds = new Set([...person.sourceIds, ...personEvents.flatMap(event => event.sourceIds)]);
  const sources = state.sources.filter(source => source.treeId === treeId && sourceIds.has(source.id));
  const media = state.media.filter(item => item.treeId === treeId && (person.mediaIds.includes(item.id) || item.assignedTo.some(assignment => assignment.kind === "person" && assignment.id === person.id)));
  const portrait = reportPortrait(state, person, true);
  const timeline = [
    ...(person.birthDate ? [{ id: "birth", type: "Birth", date: person.birthDate, description: fullName(person), placeId: undefined }] : []),
    ...personEvents,
    ...(person.deathDate ? [{ id: "death", type: "Death", date: person.deathDate, description: fullName(person), placeId: undefined }] : [])
  ].sort((a, b) => (a.date || "9999").localeCompare(b.date || "9999"));
  const placeName = (placeId?: string) => placeId ? state.places.find(place => place.id === placeId)?.name || "" : "";
  const birthEventFor = (entry: Person) => state.events.find(event => entry.eventIds.includes(event.id) && /birth/i.test(event.type));
  const ownBirthEvent = birthEventFor(person);
  const relationshipTimeline = state.relationships
    .filter(rel => rel.treeId === treeId && ["spouse", "partner"].includes(rel.type) && (rel.fromId === person.id || rel.toId === person.id))
    .map(rel => {
      const relative = people.find(entry => entry.id === (rel.fromId === person.id ? rel.toId : rel.fromId));
      return {
        id: rel.id,
        date: rel.startDate || "",
        title: rel.type === "spouse" ? "Marriage to:" : "Partnership with:",
        related: relative,
        place: "",
        description: [rel.status, rel.subtype].filter(Boolean).join(" · "),
        editPath: profilePath(person.id, "edit")
      };
    });
  const childTimeline = children.map(child => {
    const event = birthEventFor(child);
    return {
      id: `child-${child.id}`,
      date: child.birthDate,
      title: child.gender === "female" ? "Birth of daughter:" : child.gender === "male" ? "Birth of son:" : "Birth of child:",
      related: child,
      place: placeName(event?.placeId),
      description: event?.description || "",
      editPath: profilePath(child.id, "edit")
    };
  });
  const factTimeline = [
    ...(person.birthDate ? [{ id: "fact-birth", date: person.birthDate, title: "Birth", related: undefined as Person | undefined, place: placeName(ownBirthEvent?.placeId), description: ownBirthEvent?.description || fullName(person), editPath: profilePath(person.id, "edit") }] : []),
    ...relationshipTimeline,
    ...personEvents.filter(event => !/birth/i.test(event.type)).map(event => ({ id: event.id, date: event.date, title: event.type, related: undefined as Person | undefined, place: placeName(event.placeId), description: event.description, editPath: profilePath(person.id, "edit") })),
    ...person.facts.map(fact => ({ id: fact.id, date: fact.date || "", title: fact.type, related: undefined as Person | undefined, place: "", description: fact.value, editPath: profilePath(person.id, "edit") })),
    ...childTimeline,
    ...(person.deathDate ? [{ id: "fact-death", date: person.deathDate, title: "Death", related: undefined as Person | undefined, place: [person.deathDetails?.deathPlace, person.deathDetails?.deathHospital].filter(Boolean).join(", "), description: fullName(person), editPath: profilePath(person.id, "edit") }] : [])
  ].sort((a, b) => (a.date || "9999").localeCompare(b.date || "9999"));
  const sectionOpen = (key: keyof typeof profileSections) => profileSections[key];
  const toggleSection = (key: keyof typeof profileSections) => setProfileSections(current => ({ ...current, [key]: !current[key] }));
  const immediateFamilyGroups = [
    ["Parents", parents],
    ["Partners", partners],
    ["Children", children],
    ["Siblings", siblings],
    ["Guardians and wards", guardians]
  ] as const;
  return <div className="profile-workspace">
    <Link className="back-link" to={workspacePath({ treeId, view: "people" })}><ArrowLeft size={15} />All people</Link>
    <div className="profile-heading"><span className="person-avatar profile-avatar" style={{ borderColor: person.branchColor }}>{portrait ? <img src={portrait.dataUrl} alt={`${fullName(person)} profile picture`} /> : <UserRound size={34} />}</span><div><h1>{fullName(person)}</h1><p className="quiet">{[lifespan(person), showIdentity && identity.pronouns ? identity.pronouns : ""].filter(Boolean).join(" · ")}</p></div><CaptionedGlyph id={`gender-${person.gender}`} /><Link className="button secondary" to={workspacePath({ treeId, view: "tree", personId: person.id })}><Network size={17} />View in tree</Link></div>
    <section className="person-snapshot" aria-label={`Quick person panel for ${fullName(person)}`}>
      <div className="person-snapshot-head">
        <Link className="person-snapshot-avatar" to={profilePath(person.id, "media")} aria-label={`Open media for ${fullName(person)}`}>
          <span className="person-avatar profile-avatar" style={{ borderColor: person.branchColor }}>{portrait ? <img src={portrait.dataUrl} alt="" /> : <UserRound size={42} />}</span>
          <span className="camera-badge"><Camera size={20} /></span>
        </Link>
        <div className="person-snapshot-summary">
          <strong className="snapshot-name">{fullName(person)}</strong>
          <p>{[person.labels[0] || "Tree focus person", showIdentity && identity.genderIdentity ? identity.genderIdentity : ""].filter(Boolean).join(" · ")}</p>
          <p><strong>*</strong> {person.birthDate || "Birth unknown"}{person.birthDate && ` (age ${ageAt(person.birthDate)})`}{placeName(ownBirthEvent?.placeId) && ` · ${placeName(ownBirthEvent?.placeId)}`}</p>
          <Link className="research-person-link" to={workspacePath({ treeId, view: "research", personId: person.id })}>Research this person <ArrowUpRight size={16} /></Link>
        </div>
      </div>
      <div className="person-quick-actions" aria-label={`Quick actions for ${fullName(person)}`}>
        <Link to={profilePath(person.id)}><span><FileText size={22} /></span><strong>Profile</strong></Link>
        <Link to={profilePath(person.id, "edit")}><span><Pencil size={22} /></span><strong>Edit</strong></Link>
        <button type="button" onClick={onAddRelative}><span><UserPlus size={22} /></span><strong>Add</strong></button>
        <Link to={profilePath(person.id, "sources")}><span><MoreHorizontal size={22} /></span><strong>More</strong></Link>
      </div>
      <div className="person-sections" aria-label={`Expandable profile sections for ${fullName(person)}`}>
        <div className="person-section-row">
          <button type="button" onClick={() => toggleSection("media")} aria-expanded={sectionOpen("media")}><span>Photos & Videos</span>{sectionOpen("media") ? <ChevronUp size={18} /> : <ChevronDown size={18} />}</button>
          <Link to={profilePath(person.id, "media")}><Plus size={18} />Add</Link>
        </div>
        {sectionOpen("media") && <div className="person-section-body media-strip">{media.slice(0, 4).map(item => <Link key={item.id} to={profilePath(person.id, "media")}>{item.type === "picture" && item.dataUrl ? <img src={item.dataUrl} alt="" /> : <FileText size={26} />}<span>{item.title}</span></Link>)}{!media.length && <p className="quiet">No photos, videos, or documents attached yet.</p>}</div>}
        <div className="person-section-row">
          <button type="button" onClick={() => toggleSection("biography")} aria-expanded={sectionOpen("biography")}><span>Biography</span>{sectionOpen("biography") ? <ChevronUp size={18} /> : <ChevronDown size={18} />}</button>
          <Link to={profilePath(person.id, "edit")}><Plus size={18} />Add</Link>
        </div>
        {sectionOpen("biography") && <div className="person-section-body"><p>{person.biography || "No biography recorded yet."}</p></div>}
        <div className="person-section-row">
          <button type="button" onClick={() => toggleSection("family")} aria-expanded={sectionOpen("family")}><span>Immediate Family</span>{sectionOpen("family") ? <ChevronUp size={18} /> : <ChevronDown size={18} />}</button>
          <button type="button" onClick={onAddRelative}><Plus size={18} />Add</button>
        </div>
        {sectionOpen("family") && <div className="person-section-body immediate-family-strip">{immediateFamilyGroups.map(([title, relatives]) => <div key={title}><strong>{title}</strong>{relatives.length ? relatives.map(relative => <Link key={relative.id} to={profilePath(relative.id)}>{fullName(relative)}<small>{lifespan(relative)}</small></Link>) : <p className="quiet">None recorded</p>}</div>)}</div>}
        <div className="person-section-row">
          <button type="button" onClick={() => toggleSection("facts")} aria-expanded={sectionOpen("facts")}><span>Facts</span>{sectionOpen("facts") ? <ChevronUp size={18} /> : <ChevronDown size={18} />}</button>
          <Link to={profilePath(person.id, "edit")}><Plus size={18} />Add</Link>
        </div>
        {sectionOpen("facts") && <div className="person-section-body facts-timeline" aria-label={`Facts timeline for ${fullName(person)}`}>
          {factTimeline.map(item => {
            const relatedPortrait = item.related ? reportPortrait(state, item.related, true) : undefined;
            return <article key={item.id} className="fact-timeline-row">
              <div><strong>{yearFromDate(item.date) || "----"}</strong>{ageAt(person.birthDate, item.date) !== "" && <small>Age {ageAt(person.birthDate, item.date)}</small>}</div>
              <div>
                <h3>{item.title}</h3>
                {item.related && <Link className="fact-related-person" to={profilePath(item.related.id)}>{relatedPortrait ? <span className="person-avatar mini"><img src={relatedPortrait.dataUrl} alt="" /></span> : <span className="person-avatar mini"><UserRound size={16} /></span>}<span>{fullName(item.related)}</span></Link>}
                {item.date && <p>{item.date}</p>}
                {(item.place || item.description) && <p>{[item.place, item.description].filter(Boolean).join(" · ")}</p>}
              </div>
              <Link className="fact-edit-button" to={item.editPath} aria-label={`Edit ${item.title}`}><Pencil size={18} /></Link>
            </article>;
          })}
          {!factTimeline.length && <p className="quiet">No facts recorded yet.</p>}
        </div>}
      </div>
    </section>
    {tab === "media" && <label className="field"><span>Profile picture</span><select className="control" aria-label="Profile picture" value={person.profileMediaId || ""} onChange={e => onPortrait(e.target.value)}><option value="">First attached photograph</option>{media.filter(m => m.type === "picture").map(m => <option key={m.id} value={m.id}>{m.title}</option>)}</select></label>}
    <nav className="profile-tabs" aria-label="Person sections">{PROFILE_TABS.map(value => <Link key={value} to={profilePath(person.id, value)} aria-current={tab === value ? "page" : undefined}>{value === "edit" ? "Edit details" : value === "access" ? "Access needs" : value[0].toUpperCase() + value.slice(1)}{value === "sources" ? ` (${sources.length})` : value === "media" ? ` (${media.length})` : ""}</Link>)}</nav>
    {tab === "overview" && <PersonNeedsSummary person={person} />}
    {tab === "access" && (canEditSensitive ? <PersonNeeds key={person.id} person={person} sources={state.sources.filter(source => source.treeId === treeId)} onChange={onNeedsChange} /> : <section><h2>Disability and access needs</h2><p>These details are private to the library owner. The owner can share them from the person's edit screen.</p></section>)}
    {tab === "overview" && <div className="profile-columns"><section><h2>Life story</h2><p className="biography">{person.biography || "No biography recorded."}</p>{showIdentity && <><h2>Identity</h2><dl className="fact-list">{[
      ["Pronouns", identity.pronouns],
      ["Gender identity", identity.genderIdentity],
      ["Gender expression", identity.genderExpression],
      ["Sexual orientation", identity.sexualOrientation],
      ["Romantic orientation", identity.romanticOrientation],
      ["Relationship orientation", identity.relationshipOrientation],
      ["Identity labels", identity.identityLabels.join(", ")],
      ["Notes", identity.identityNotes]
    ].filter(([, value]) => String(value || "").trim()).map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}</dl>{!Object.values(identity).some(value => Array.isArray(value) ? value.length : typeof value === "string" && value.trim()) && <p className="quiet">No identity details recorded.</p>}</>}<h2>Facts</h2><dl className="fact-list">{person.facts.map(fact => <div key={fact.id}><dt>{fact.type}</dt><dd>{fact.value}</dd></div>)}</dl>{!person.facts.length && <p className="quiet">No additional facts recorded.</p>}<h2>Notes</h2><p className="biography">{person.notes || "No notes recorded."}</p><Link className="button secondary" to={profilePath(person.id, "edit")}>Edit details</Link></section><section><h2>Family relationships</h2>{[["Parents", parents], ["Partners", partners], ["Children", children], ["Siblings", siblings], ["Guardians and wards", guardians]].map(([title, relatives]) => <div className="profile-relatives" key={String(title)}><h3>{String(title)}</h3>{(relatives as Person[]).map(relative => {
      const rel = relationshipDetails.find(entry => entry.person.id === relative.id);
      const portrait = reportPortrait(state, relative, true);
      return <Link key={relative.id} to={profilePath(relative.id)}>{rel ? <CaptionedGlyph id={rel.glyphId} label={rel.status || rel.relativeRole} meaning={rel.glyphMeaning} size={20} /> : portrait ? <span className="person-avatar mini"><img src={portrait.dataUrl} alt="" /></span> : <UserRound size={18} />}<span><strong>{fullName(relative)}</strong><small>{rel ? `${rel.relativeRole} · ${lifespan(relative)}` : lifespan(relative)}</small></span><ArrowUpRight size={15} /></Link>;
    })}{!(relatives as Person[]).length && <p className="quiet">None recorded</p>}</div>)}</section></div>}
    {tab === "edit" && <section className="profile-edit">{editor}</section>}
    {tab === "timeline" && <section className="person-timeline"><div className="needs-heading"><h2>Life timeline</h2><SymbolLegend /></div>{timeline.map(event => <article key={event.id}><time>{event.date || "Undated"}</time><div><h3 className="event-heading"><EventGlyph type={event.type} />{event.type}</h3><p>{event.description}</p>{event.placeId && <small>{state.places.find(place => place.id === event.placeId)?.name}</small>}</div></article>)}{!timeline.length && <p className="quiet">No life events recorded.</p>}<Link className="button secondary" to={profilePath(person.id, "edit")}><Plus size={16} />Add life event</Link></section>}
    {tab === "sources" && <section className="profile-sources"><h2>Sources and evidence</h2>{sources.map(source => <article key={source.id}><BookOpen size={21} /><div><h3>{source.title}</h3><p>{source.citation || source.notes}</p>{source.url && <a href={source.url} target="_blank" rel="noreferrer">Open source<ArrowUpRight size={14} /></a>}</div></article>)}{!sources.length && <p className="quiet">No sources attached to this person.</p>}<Link className="button secondary" to={workspacePath({ treeId, view: "research", personId: person.id })}><Search size={16} />Research this person</Link></section>}
    {tab === "media" && <section><div className="page-heading"><h2>Photographs and documents</h2><Link className="button secondary" to={workspacePath({ treeId, view: "media", personId: person.id })}><Plus size={16} />Add media</Link></div><div className="profile-gallery">{media.map(item => <article key={item.id}>{item.type === "picture" ? <img src={item.dataUrl} alt={item.title} /> : item.type === "audio" ? <audio controls src={item.dataUrl} /> : item.type === "video" ? <video controls src={item.dataUrl} /> : <FileText size={40} />}<h3>{item.title}</h3>{item.story && <p>{item.story}</p>}</article>)}</div>{!media.length && <div className="empty-state"><Image size={30} /><p>No media attached to this person.</p></div>}</section>}
  </div>;
}

function yearFromDate(value?: string) {
  return value?.match(/\d{3,4}/)?.[0] || "";
}

function ageAt(birthDate?: string, atDate?: string) {
  const birthYear = Number(yearFromDate(birthDate));
  const eventYear = Number(atDate ? yearFromDate(atDate) : new Date().getFullYear());
  if (!birthYear || !eventYear || eventYear < birthYear) return "";
  return String(eventYear - birthYear);
}

export function FamiliesWorkspace({ state, treeId }: { state: AppState; treeId: string }) {
  const groups = familyGroups(state, treeId);
  const relationshipDetails = relationshipsByPerson(state.people.filter(person => person.treeId === treeId), state.relationships);
  const roleSummary = (person: Person) => [...new Set((relationshipDetails.get(person.id) || []).map(rel => rel.role))].slice(0, 3).join(", ") || "Family member";
  const personLink = (person: Person) => <Link key={person.id} to={workspacePath({ treeId, view: "people", personId: person.id })}><UserRound size={16} /><span>{fullName(person)}<small>{roleSummary(person)} · {person.birthDate || "Birth unknown"}</small></span><ArrowUpRight size={14} /></Link>;
  const familyType = (group: (typeof groups)[number]) => state.families.find(family => {
    const parents = new Set(group.parents.map(person => person.id));
    const children = new Set(group.children.map(person => person.id));
    return family.treeId === treeId && family.partnerIds.every(id => parents.has(id)) && group.parents.every(person => family.partnerIds.includes(person.id)) && family.childIds.every(id => !children.size || children.has(id));
  })?.familyType || "Family type not recorded";
  return <div className="families-workspace"><div className="page-heading"><div><h1>Families</h1><p className="quiet">{groups.length} family groups</p></div><Link className="button primary" to={workspacePath({ treeId, view: "tree" })}><Network size={17} />Open tree</Link></div><div className="family-group-list">{groups.map(group => <article key={group.id}><h2>{group.title}</h2><p className="quiet">{familyType(group)}</p><div className="family-group-members"><div><h3>Parents / partners</h3>{group.parents.map(personLink)}</div><div><h3>Children</h3>{group.children.map(personLink)}{!group.children.length && <p className="quiet">No children recorded</p>}</div></div></article>)}</div>{!groups.length && <p className="empty-state">No family relationships recorded.</p>}</div>;
}
