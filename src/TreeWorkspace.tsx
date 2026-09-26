import { ReactNode, useEffect, useMemo, useRef, useState } from "react";
import { Background, Controls, Handle, MiniMap, Node, NodeProps, Position, ReactFlow, ReactFlowProvider, useNodesInitialized, useNodesState, useReactFlow } from "@xyflow/react";
import { ArrowDown, ArrowUp, ArrowUpRight, ChevronDown, ChevronUp, Crosshair, GitBranch, LayoutGrid, Link2, Network, Plus, Redo2, Search, Undo2, Unlink, UserRound, X } from "lucide-react";
import { AppState, ParentRole, Person, Relationship, RelationshipType, RELATIONSHIP_SUBTYPE_OPTIONS, createEmptyPerson, emptyIdentityDetails, fullName } from "./domain";
import { FamilyPositions, NODE_HEIGHT, NODE_WIDTH, TreeMode, layoutFamily, moveWithinGeneration, positionFamily, relationshipError, visiblePeople } from "./treeGraph";
import { familyLines, UnionStatus } from "./familyLines";
import { FamilyConnection, FamilyEdge, RelationshipLegend } from "./FamilyConnections";
import { PersonRelationship, relationshipsByPerson } from "./personRelationships";
import "@xyflow/react/dist/style.css";
import { reportPortrait } from "./reportDocument";
import { CaptionedGlyph, SymbolLegend } from "./Glyph";
import { PersonSymbol, personSymbols } from "./personSymbols";
import type { Parentage } from "./reportOptions";
import { PARENTAGE_LABELS } from "./reportParentage";

type ParentRoles = { parent: ParentRole; otherParent: ParentRole; parentage?: Parentage; otherParentage?: Parentage; siblingStatus?: string; relationshipSubtype?: string };
type Props = {
  itemActions?: ReactNode;
  state: AppState;
  treeId: string;
  person?: Person;
  onSelect: (id: string) => void;
  onProfile: (id: string) => void;
  onUpdate: (id: string, updater: (person: Person) => void, label?: string) => void;
  onAdd: (person: Person, type?: RelationshipType, fromId?: string, toId?: string, otherParentId?: string, roles?: ParentRoles) => void;
  onLink: (type: RelationshipType, fromId: string, toId: string, otherParentId?: string, roles?: ParentRoles) => void;
  onParentRoleChange: (id: string, role: ParentRole) => void;
  onParentageChange: (id: string, parentage: Parentage) => void;
  onUnlink: (id: string) => void;
  onUndo: () => void;
  onRedo: () => void;
  canUndo: boolean;
  canRedo: boolean;
  canEditSensitive?: boolean;
};

type PersonNode = Node<{ person: Person; portrait?: string; focused: boolean; relationships: PersonRelationship[]; symbols: PersonSymbol[] }, "person">;
type TreeView = "family" | "genealogy" | "descendants" | "hourglass" | "fan" | "relatives";
const TREE_VIEWS: Array<{ id: TreeView; label: string; mode: TreeMode; help: string }> = [
  { id: "family", label: "Family tree", mode: "family", help: "Full editable household tree with spouses, siblings and descendants." },
  { id: "genealogy", label: "Genealogy", mode: "ancestors", help: "Pedigree-style ancestor view from the selected person." },
  { id: "descendants", label: "Descendants", mode: "descendants", help: "Children, grandchildren and later generations below the selected person." },
  { id: "hourglass", label: "Hourglass", mode: "hourglass", help: "Ancestors above and descendants below the selected person." },
  { id: "fan", label: "Fan", mode: "ancestors", help: "Radial ancestor fan centered on the selected person." },
  { id: "relatives", label: "Relatives", mode: "family", help: "List-style relationship map for quick scanning." }
];
const SIBLING_TYPES = [
  ["", "Sibling type not recorded"],
  ["biological", "Biological sibling"],
  ["adoptive", "Adoptive sibling"],
  ["foster", "Foster sibling"],
  ["step", "Step sibling"],
  ["half", "Half sibling"]
] as const;
const RELATIVE_KIND_OPTIONS = [
  { value: "child", label: "Child", type: "parent-child" as RelationshipType, subtype: "" },
  { value: "parent", label: "Parent", type: "parent-child" as RelationshipType, subtype: "" },
  { value: "spouse", label: "Spouse", type: "spouse" as RelationshipType, subtype: "Spouse" },
  { value: "husband", label: "Husband", type: "spouse" as RelationshipType, subtype: "Husband" },
  { value: "wife", label: "Wife", type: "spouse" as RelationshipType, subtype: "Wife" },
  { value: "partner", label: "Partner", type: "partner" as RelationshipType, subtype: "Partner" },
  { value: "dating-partner", label: "Dating partner", type: "partner" as RelationshipType, subtype: "Dating partner" },
  { value: "boyfriend", label: "Boyfriend", type: "partner" as RelationshipType, subtype: "Boyfriend" },
  { value: "girlfriend", label: "Girlfriend", type: "partner" as RelationshipType, subtype: "Girlfriend" },
  { value: "fiance", label: "Fiance", type: "partner" as RelationshipType, subtype: "Fiance" },
  { value: "fiancee", label: "Fiancee", type: "partner" as RelationshipType, subtype: "Fiancee" },
  { value: "civil-union-partner", label: "Civil union partner", type: "partner" as RelationshipType, subtype: "Civil union partner" },
  { value: "domestic-partner", label: "Domestic partner", type: "partner" as RelationshipType, subtype: "Domestic partner" },
  { value: "common-law-partner", label: "Common-law partner", type: "partner" as RelationshipType, subtype: "Common-law partner" },
  { value: "polyamorous-partner", label: "Polyamorous partner", type: "partner" as RelationshipType, subtype: "Polyamorous partner" },
  { value: "open-relationship", label: "Open relationship", type: "partner" as RelationshipType, subtype: "Open relationship" },
  { value: "nesting-partner", label: "Nesting partner", type: "partner" as RelationshipType, subtype: "Nesting partner" },
  { value: "queerplatonic-partner", label: "Queerplatonic partner", type: "partner" as RelationshipType, subtype: "Queerplatonic partner" },
  { value: "polycule-member", label: "Polycule member", type: "partner" as RelationshipType, subtype: "Polycule member" },
  { value: "metamour", label: "Metamour", type: "partner" as RelationshipType, subtype: "Metamour" },
  { value: "co-parent", label: "Co-parent", type: "partner" as RelationshipType, subtype: "Co-parent" },
  { value: "sibling", label: "Sibling", type: "sibling" as RelationshipType, subtype: "" },
  { value: "relative", label: "Relative, in-law, or cousin", type: "relative" as RelationshipType, subtype: "" },
  { value: "guardian", label: "Guardian", type: "guardian" as RelationshipType, subtype: "" },
  { value: "unrelated", label: "Unrelated person", type: "relative" as RelationshipType, subtype: "" }
] as const;
const kindOption = (value: string) => RELATIVE_KIND_OPTIONS.find(option => option.value === value);
export const genderSymbol = (person: Person) => ({ male: "\u2642", female: "\u2640", nonbinary: "\u26a7", unknown: "\u25c7" })[person.gender];
export const lifespan = (person: Person) => `${person.birthDate || "Birth unknown"} \u00b7 ${person.living ? "Living" : person.deathDate || "Death unknown"}`;

function TreePerson({ data, selected }: NodeProps<PersonNode>) {
  const person = data.person;
  const relationshipNames = [...new Set(data.relationships.map(relationship => relationship.role))].join(" \u00b7 ");
  const relationshipDetails = data.relationships.map(relationship => relationship.description).join("; ");
  return <div className={`graph-person ${selected ? "selected" : ""} ${data.focused ? "focused" : ""}`} style={{ borderTopColor: person.branchColor, width: NODE_WIDTH, height: NODE_HEIGHT }}>
    <Handle type="target" position={Position.Top} id="parent" title="Connect a parent" aria-label={`Parent connection for ${fullName(person)}`} />
    <Handle type="target" position={Position.Left} id="partner-in" isConnectable={false} />
    <div className="graph-person-heading">
      <span className="person-avatar">{data.portrait ? <img src={data.portrait} alt="" /> : <UserRound size={21} />}</span>
      <strong title={fullName(person)}>{fullName(person)}</strong>
    </div>
    <span className="graph-person-dates">{lifespan(person)}</span>
    <small>{person.labels[0] || (person.private ? "Private profile" : "Family member")}</small>
    <div className="graph-person-relationships" title={relationshipDetails || "No relationships recorded"} aria-label={relationshipDetails || "No relationships recorded"}>{relationshipNames || "No relationships recorded"}</div>
    <div className="relationship-symbols nodrag nowheel" aria-label={`Relationship symbols for ${fullName(person)}`}>
      {data.relationships.slice(0, 5).map(relationship => <CaptionedGlyph key={relationship.id} id={relationship.glyphId} label={relationship.status || relationship.role} meaning={relationship.glyphMeaning} size={18} />)}
    </div>
    <div className="person-symbols nodrag nowheel" tabIndex={0} aria-label={`Symbols for ${fullName(person)}`} onKeyDown={event => {
      if (event.key === "ArrowLeft" || event.key === "ArrowRight") { event.preventDefault(); event.stopPropagation(); event.currentTarget.scrollBy({ left: event.key === "ArrowRight" ? 72 : -72 }); }
    }}>{data.symbols.map(symbol => <span className="person-symbol-entry" key={symbol.id} style={{ width: Math.max(60, Math.ceil(symbol.label.length / 2) * 7 + 8) }}><CaptionedGlyph id={symbol.glyphId} label={symbol.label} meaning={symbol.meaning} /></span>)}</div>
    <Handle type="source" position={Position.Right} id="partner-out" isConnectable={false} />
    <Handle type="source" position={Position.Bottom} id="child" title="Connect a child" aria-label={`Child connection for ${fullName(person)}`} />
  </div>;
}
const nodeTypes = { person: TreePerson };
const edgeTypes = { family: FamilyConnection };

export function TreeWorkspace(props: Props) {
  return <ReactFlowProvider><TreeWorkspaceContent {...props} /></ReactFlowProvider>;
}

function TreeWorkspaceContent(props: Props) {
  const { state, treeId, person, onSelect, onProfile, onUpdate } = props;
  const people = state.people.filter(entry => entry.treeId === treeId);
  const [view, setView] = useState<TreeView>("family");
  const [focusId, setFocusId] = useState(person?.id || people[0]?.id || "");
  const [depth, setDepth] = useState(4);
  const [query, setQuery] = useState("");
  const [includePrivateSymbols, setIncludePrivateSymbols] = useState(false);
  const [showDetails, setShowDetails] = useState(false);
  const [dialog, setDialog] = useState(false);
  const [dialogKind, setDialogKind] = useState("child");
  const [error, setError] = useState("");
  const [nodes, setNodes, onNodesChange] = useNodesState<PersonNode>([]);
  const flow = useReactFlow<PersonNode>();
  const surface = useRef<HTMLDivElement>(null);
  const initialized = useNodesInitialized();
  const positions = useRef<FamilyPositions>({});
  const viewConfig = TREE_VIEWS.find(entry => entry.id === view)!;
  const mode = viewConfig.mode;
  const storageKey = `kinforge-chart-layout:${treeId}:${view}:${mode === "family" ? "all" : focusId}`;
  const visible = useMemo(() => visiblePeople(state, treeId, focusId, mode, depth), [state, treeId, focusId, mode, depth]);
  const ids = new Set(visible.map(entry => entry.id));
  const links = state.relationships.filter(rel => rel.treeId === treeId && ids.has(rel.fromId) && ids.has(rel.toId));
  const topology = JSON.stringify([storageKey, visible.map(entry => entry.id).sort(), state.relationships.filter(link => link.treeId === treeId).map(link => [link.id, link.type, link.fromId, link.toId, link.status || "", link.subtype || ""]).sort((a, b) => a[0].localeCompare(b[0]))]);
  const layout = useMemo(() => layoutFamily(visible, state.relationships), [visible, state.relationships]);
  const relationshipDetails = useMemo(() => relationshipsByPerson(state.people.filter(entry => entry.treeId === treeId), state.relationships), [state.people, state.relationships, treeId]);
  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(storageKey) || "null");
      positions.current = saved?.version === 5 && saved.topology === topology && saved.positions && typeof saved.positions === "object" ? saved.positions : {};
    } catch { positions.current = {}; }
  }, [storageKey, topology]);
  useEffect(() => {
    setNodes(positionFamily(layout, positions.current, state.relationships).map(({ person: entry, position }) => ({
      id: entry.id, type: "person", position,
      selected: entry.id === person?.id, width: NODE_WIDTH, height: NODE_HEIGHT,
      ariaLabel: `${fullName(entry)}, ${lifespan(entry)}`,
      data: { person: entry, focused: entry.id === focusId, relationships: relationshipDetails.get(entry.id) || [], portrait: reportPortrait(state, entry, true)?.dataUrl, symbols: personSymbols(state, entry, includePrivateSymbols) }
    })));
  }, [layout, topology, person?.id, focusId, treeId, state.media, state.relationships, relationshipDetails, includePrivateSymbols, setNodes]);
  useEffect(() => {
    if (!initialized) return;
    const frame = requestAnimationFrame(() => { void flow.fitView({ padding: 0.18, maxZoom: 1, duration: 250 }); });
    return () => cancelAnimationFrame(frame);
  }, [topology, initialized, flow]);
  useEffect(() => {
    if (!surface.current || !initialized) return;
    let timer: ReturnType<typeof setTimeout>;
    const observer = new ResizeObserver(() => {
      clearTimeout(timer);
      timer = setTimeout(() => { void flow.fitView({ padding: 0.18, maxZoom: 1, duration: 150 }); }, 100);
    });
    observer.observe(surface.current);
    return () => { clearTimeout(timer); observer.disconnect(); };
  }, [initialized, flow]);

  const lines = familyLines(nodes.map(node => ({ person: node.data.person, position: node.position })), links);
  const edges: FamilyEdge[] = view === "fan" || view === "relatives" ? [] : lines.map(line => ({ id: line.id, source: line.source, target: line.target, sourceHandle: "child", targetHandle: "parent", type: "family", ariaLabel: line.description, data: { line }, selectable: false }));
  const searchResults = query.trim() ? people.filter(entry => [fullName(entry), ...entry.aliases].join(" ").toLowerCase().includes(query.toLowerCase())).slice(0, 10) : [];
  const focusPerson = (id: string) => { onSelect(id); setFocusId(id); setQuery(""); };
  const rels = person ? relationshipDetails.get(person.id) || [] : [];
  const parents = rels.filter(rel => ["Child", "Son", "Daughter"].includes(rel.role)).map(rel => rel.person);
  const children = rels.filter(rel => ["Parent", "Mother", "Father"].includes(rel.role)).map(rel => rel.person);
  const partners = rels.filter(rel => {
    const link = state.relationships.find(entry => entry.id === rel.id);
    return link?.type === "spouse" || link?.type === "partner";
  }).map(rel => rel.person);
  const siblings = rels.filter(rel => /\b(sibling|sister|brother)\b/i.test(rel.role)).map(rel => rel.person);
  const identity = { ...emptyIdentityDetails(), ...(person?.identity || {}) };
  const showIdentity = !!person && (props.canEditSensitive || identity.visibility === "shared");
  useEffect(() => { setShowDetails(false); }, [person?.id]);
  return <div className="tree-workspace">
    <div className="workspace-toolbar">
      <div className="segmented tree-modes tree-view-modes" aria-label="Tree view">
        {TREE_VIEWS.map(entry => <button key={entry.id} aria-pressed={view === entry.id} className={view === entry.id ? "active" : ""} title={entry.help} onClick={() => setView(entry.id)}>{entry.label}</button>)}
      </div>
      {mode !== "family" && <label className="generation-control">Generations<select aria-label="Generations" value={depth} onChange={event => setDepth(Number(event.target.value))}>{[1, 2, 3, 4, 5, 8, 12].map(value => <option key={value}>{value}</option>)}</select></label>}
      <div className="tree-search"><Search size={16} /><input aria-label="Find in tree" placeholder="Find a person" value={query} onChange={event => setQuery(event.target.value)} />
        {query && <div className="search-results">{searchResults.length ? searchResults.map(entry => <button key={entry.id} onClick={() => {
          focusPerson(entry.id);
          if (mode === "family") void flow.fitView({ nodes: [{ id: entry.id }], maxZoom: 1, duration: 300 });
        }}><strong>{fullName(entry)}</strong><small>{entry.birthDate}</small></button>) : <span>No matching people</span>}</div>}
      </div>
      <div className="icon-actions">
        <button className="icon-button" title="Undo last change" aria-label="Undo last change" disabled={!props.canUndo} onClick={props.onUndo}><Undo2 size={18} /></button>
        <button className="icon-button" title="Redo last change" aria-label="Redo last change" disabled={!props.canRedo} onClick={props.onRedo}><Redo2 size={18} /></button>
        <button className="icon-button" title="Arrange tree" aria-label="Arrange tree" onClick={() => {
          positions.current = {}; localStorage.removeItem(storageKey);
          setNodes(current => current.map(node => ({ ...node, position: layout.find(item => item.person.id === node.id)!.position })));
          requestAnimationFrame(() => { void flow.fitView({ padding: 0.18, maxZoom: 1, duration: 250 }); });
        }}><LayoutGrid size={18} /></button>
      </div>
      <button className="button primary" onClick={() => setDialog(true)}><Plus size={16} />{person ? "Add relative" : "Add person"}</button>
    </div>
    <RelationshipLegend statuses={lines.flatMap(line => line.status ? [line.status as UnionStatus] : [])} />
    <div className="tree-symbol-options"><label className="check"><input type="checkbox" checked={includePrivateSymbols} onChange={e => setIncludePrivateSymbols(e.target.checked)} />Show private annotations</label><SymbolLegend /></div>
    {error && <div className="inline-error" role="alert">{error}<button aria-label="Dismiss error" onClick={() => setError("")}><X size={16} /></button></div>}
    <div className="tree-stage">
      <div className="graph-surface" ref={surface} data-testid="family-chart">
        {view === "fan" ? <FanTreeView people={visible} relationships={links} focusId={focusId} onSelect={focusPerson} /> : view === "relatives" ? <RelativesTreeView people={visible} relationships={links} relationshipDetails={relationshipDetails} onSelect={focusPerson} /> : <ReactFlow<PersonNode, FamilyEdge> nodes={nodes} edges={edges} nodeTypes={nodeTypes} edgeTypes={edgeTypes} onNodesChange={changes => onNodesChange(changes.map(change => {
          if (change.type !== "position" || !change.position) return change;
          const generation = layout.find(entry => entry.person.id === change.id)?.position.y;
          return { ...change, position: { ...change.position, y: generation ?? change.position.y } };
        }))} onNodeClick={(_, node) => onSelect(node.id)} onNodeDoubleClick={(_, node) => onProfile(node.id)} onNodeDragStop={(_, node) => {
          const next = moveWithinGeneration(layout, positions.current, node.id, node.position.x, state.relationships);
          positions.current = next;
          localStorage.setItem(storageKey, JSON.stringify({ version: 5, topology, positions: next }));
          setNodes(current => current.map(entry => ({ ...entry, position: next[entry.id] ?? entry.position })));
          onSelect(node.id);
        }} onConnect={connection => {
          const message = relationshipError(state, treeId, "parent-child", connection.source, connection.target);
          if (message) setError(message); else { props.onLink("parent-child", connection.source, connection.target); setError(""); }
        }} deleteKeyCode={null} minZoom={0.12} maxZoom={1.8} fitView fitViewOptions={{ maxZoom: 1, padding: 0.18 }}>
          <Background color="#cbd5d9" gap={24} size={1} />
          <Controls showInteractive={false} />
          <MiniMap pannable zoomable nodeColor={node => (node.data as PersonNode["data"]).person.branchColor} maskColor="rgba(244,247,248,.75)" />
        </ReactFlow>}
        {!people.length && <div className="graph-empty"><Network size={40} /><h2>Your family tree</h2><button className="button primary" onClick={() => setDialog(true)}><Plus size={16} />Add first person</button></div>}
        <div className="chart-caption">{viewConfig.label}<span>{visible.length} people</span><span>{links.length} relationships</span></div>
      </div>
      <aside className="person-inspector" aria-label="Selected person">
        {person ? <>
          <div className="inspector-title"><span className="person-avatar large"><UserRound size={26} /></span><CaptionedGlyph id={`gender-${person.gender}`} /></div>
          <h2>{fullName(person)}</h2><p className="quiet">{[lifespan(person), showIdentity && identity.pronouns ? identity.pronouns : ""].filter(Boolean).join(" · ")}</p>
          {props.itemActions}
          <section className="key-overview" aria-label={`Key info overview for ${fullName(person)}`}>
            {showIdentity && identity.genderIdentity && <div><span>Gender identity</span><strong>{identity.genderIdentity}</strong></div>}
            {showIdentity && identity.sexualOrientation && <div><span>Sexuality</span><strong>{identity.sexualOrientation}</strong></div>}
            {showIdentity && identity.romanticOrientation && <div><span>Romantic orientation</span><strong>{identity.romanticOrientation}</strong></div>}
            {showIdentity && identity.relationshipOrientation && <div><span>Relationship orientation</span><strong>{identity.relationshipOrientation}</strong></div>}
            <div><span>Parents</span><strong>{parents.length ? parents.map(fullName).join(", ") : "Not recorded"}</strong></div>
            <div><span>Partners</span><strong>{partners.length ? partners.map(fullName).join(", ") : "Not recorded"}</strong></div>
            <div><span>Children</span><strong>{children.length ? children.map(fullName).join(", ") : "Not recorded"}</strong></div>
            <div><span>Siblings</span><strong>{siblings.length ? siblings.map(fullName).join(", ") : "Not recorded"}</strong></div>
            <div><span>Events</span><strong>{person.eventIds.length}</strong></div>
            <div><span>Sources</span><strong>{person.sourceIds.length}</strong></div>
            <div><span>Media</span><strong>{person.mediaIds.length + (person.profileMediaId ? 1 : 0)}</strong></div>
            <div><span>Privacy</span><strong>{person.private ? "Private" : person.living ? "Living" : "Public export ready"}</strong></div>
          </section>
          <div className="inspector-actions"><button className="button secondary" onClick={() => onProfile(person.id)}>Open profile<ArrowUpRight size={16} /></button><button className="icon-button" aria-label="Focus on selected person" title="Focus on selected person" onClick={() => {
            setFocusId(person.id); void flow.fitView({ nodes: [{ id: person.id }], maxZoom: 1, duration: 250 });
          }}><Crosshair size={18} /></button></div>
          <button className="button secondary show-more-button" aria-expanded={showDetails} onClick={() => setShowDetails(value => !value)}>{showDetails ? <ChevronUp size={16} /> : <ChevronDown size={16} />}{showDetails ? "Show less" : "Show more"}</button>
          {showDetails && <div className="inspector-details" aria-label={`Detailed overview for ${fullName(person)}`}>
          <div className="inspector-fields">
            <label className="field"><span>Given name</span><input className="control" value={person.givenName} onChange={event => { const value = event.target.value; onUpdate(person.id, entry => { entry.givenName = value; }); }} /></label>
            <label className="field"><span>Family name</span><input className="control" value={person.familyName} onChange={event => { const value = event.target.value; onUpdate(person.id, entry => { entry.familyName = value; }); }} /></label>
            <label className="field"><span>Birth date</span><input className="control" value={person.birthDate} onChange={event => { const value = event.target.value; onUpdate(person.id, entry => { entry.birthDate = value; }); }} /></label>
          </div>
          <div className="inspector-section-title"><h3>Relationships</h3><button className="icon-button" title="Add or link a relative" aria-label="Add or link a relative" onClick={() => setDialog(true)}><Plus size={17} /></button></div>
          <div className="generation-actions">
            <button className="button secondary" onClick={() => { setDialogKind("parent"); setDialog(true); }}><ArrowUp size={16} />Add parent</button>
            <button className="button secondary" onClick={() => { setDialogKind("child"); setDialog(true); }}><ArrowDown size={16} />Add child</button>
          </div>
          <div className="relative-list">{rels.map(rel => {
            const other = rel.person;
            const relationship = state.relationships.find(entry => entry.id === rel.id)!;
            return <div className="relative-entry" key={rel.id}><div className="relative-row"><button onClick={() => onSelect(other.id)}><small>{rel.relativeRole}{rel.status && ` (${rel.status})`}</small><strong>{fullName(other)}</strong></button><button className="icon-button" title={`Unlink ${fullName(other)}`} aria-label={`Unlink ${fullName(other)}`} onClick={() => props.onUnlink(rel.id)}><Unlink size={15} /></button></div>
              {relationship.type === "parent-child" && relationship.toId === person.id && <ParentRoleField label={`Parent role for ${fullName(other)}`} value={relationship.parentRole || "parent"} onChange={role => props.onParentRoleChange(rel.id, role)} />}
              {relationship.type === "parent-child" && relationship.toId === person.id && <ParentageField label={`Parentage for ${fullName(other)}`} value={relationship.parentage || "unspecified"} onChange={value => props.onParentageChange(rel.id, value)} />}
            </div>;
          })}{!rels.length && <p className="quiet">No relatives recorded.</p>}</div>
          {person.biography && <div className="inspector-biography"><h3>Life story</h3><p>{person.biography}</p></div>}
          </div>}
        </> : <div className="empty-state"><UserRound /><p>No person selected</p></div>}
      </aside>
    </div>
    {dialog && <RelativeDialog {...props} initialKind={dialogKind} onAdd={(...args) => { props.onAdd(...args); setFocusId(args[0].id); }} onClose={() => { setDialog(false); setDialogKind("child"); }} />}
  </div>;
}

function FanTreeView({ people, relationships, focusId, onSelect }: { people: Person[]; relationships: Relationship[]; focusId: string; onSelect: (id: string) => void }) {
  const byId = new Map(people.map(person => [person.id, person]));
  const focus = byId.get(focusId) || people[0];
  const slots: Array<{ person?: Person; number: number; level: number; index: number }> = [{ person: focus, number: 1, level: 0, index: 0 }];
  for (let level = 0; level < 5; level++) {
    const current = slots.filter(slot => slot.level === level);
    for (const slot of current) {
      if (!slot.person) continue;
      const parents = relationships.filter(rel => rel.type === "parent-child" && rel.toId === slot.person!.id).map(rel => byId.get(rel.fromId)).filter(Boolean) as Person[];
      parents.slice(0, 2).forEach((parent, offset) => slots.push({ person: parent, number: slot.number * 2 + offset, level: level + 1, index: slot.index * 2 + offset }));
    }
  }
  const maxLevel = Math.max(1, ...slots.map(slot => slot.level));
  const ring = 86;
  const wedgePath = (inner: number, outer: number, start: number, end: number) => {
    const large = end - start > Math.PI ? 1 : 0;
    const p = (radius: number, angle: number) => [300 + Math.cos(angle) * radius, 330 + Math.sin(angle) * radius];
    const [x1, y1] = p(outer, start), [x2, y2] = p(outer, end), [x3, y3] = p(inner, end), [x4, y4] = p(inner, start);
    return `M${x1} ${y1} A${outer} ${outer} 0 ${large} 1 ${x2} ${y2} L${x3} ${y3} A${inner} ${inner} 0 ${large} 0 ${x4} ${y4} Z`;
  };
  return <div className="fan-view" role="img" aria-label="Fan chart view">
    <svg viewBox="0 0 600 380">
      {slots.filter(slot => slot.person).map(slot => {
        const count = 2 ** slot.level;
        const start = Math.PI + (slot.index / count) * Math.PI;
        const end = Math.PI + ((slot.index + 1) / count) * Math.PI;
        const inner = slot.level * ring;
        const outer = Math.max(70, (slot.level + 1) * ring);
        const mid = (start + end) / 2, radius = (inner + outer) / 2;
        const x = 300 + Math.cos(mid) * radius, y = 330 + Math.sin(mid) * radius;
        return <g key={`${slot.level}-${slot.number}`} className="fan-segment" onClick={() => slot.person && onSelect(slot.person.id)}>
          <path d={slot.level === 0 ? "M230 330 A70 70 0 0 1 370 330 L300 330 Z" : wedgePath(inner, outer, start, end)} fill={slot.person!.branchColor} opacity={slot.person!.id === focusId ? 1 : .78} />
          <text x={x} y={y - 2} textAnchor="middle">{fullName(slot.person!).split(" ")[0]}</text>
          <text x={x} y={y + 15} textAnchor="middle">{slot.person!.birthDate || "birth ?"}</text>
        </g>;
      })}
    </svg>
  </div>;
}

function RelativesTreeView({ people, relationships, relationshipDetails, onSelect }: { people: Person[]; relationships: Relationship[]; relationshipDetails: Map<string, PersonRelationship[]>; onSelect: (id: string) => void }) {
  return <div className="relatives-view" aria-label="Relatives relationship view">
    {people.map(person => {
      const rels = relationshipDetails.get(person.id) || [];
      const direct = relationships.filter(rel => rel.fromId === person.id || rel.toId === person.id).length;
      return <button key={person.id} className="relative-card" onClick={() => onSelect(person.id)}>
        <span className="person-avatar">{<UserRound size={20} />}</span>
        <strong>{fullName(person)}</strong>
        <small>{lifespan(person)}</small>
        <span>{direct} links</span>
        <em>{rels.slice(0, 4).map(rel => rel.role).join(" · ") || "No relatives recorded"}</em>
      </button>;
    })}
  </div>;
}

function ParentRoleField({ label, value, onChange }: { label: string; value: ParentRole; onChange: (role: ParentRole) => void }) {
  return <label className="field parent-role-field"><span>{label}</span><select className="control" aria-label={label} value={value} onChange={event => onChange(event.target.value as ParentRole)}><option value="parent">Parent (side not recorded)</option><option value="mother">Mother (maternal)</option><option value="father">Father (paternal)</option></select></label>;
}

function ParentageField({ label, value, onChange }: { label: string; value: Parentage; onChange: (value: Parentage) => void }) {
  return <label className="field parent-role-field"><span>{label}</span><select className="control" aria-label={label} value={value} onChange={e => onChange(e.target.value as Parentage)}>{Object.entries(PARENTAGE_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>;
}

function RelativeDialog({ state, treeId, person, onClose, onAdd, onLink, initialKind }: Props & { onClose: () => void; initialKind: string }) {
  const ref = useRef<HTMLDialogElement>(null);
  const [existing, setExisting] = useState(false);
  const [kind, setKind] = useState(initialKind);
  const [parentRole, setParentRole] = useState<ParentRole>("parent");
  const [otherParentRole, setOtherParentRole] = useState<ParentRole>("parent");
  const [parentage, setParentage] = useState<Parentage>("unspecified");
  const [otherParentage, setOtherParentage] = useState<Parentage>("unspecified");
  const [siblingStatus, setSiblingStatus] = useState("");
  const [relationshipSubtype, setRelationshipSubtype] = useState("");
  const [targetId, setTargetId] = useState("");
  const [otherParentId, setOtherParentId] = useState("");
  const [givenName, setGivenName] = useState("");
  const [familyName, setFamilyName] = useState(person?.familyName || "");
  const [birthDate, setBirthDate] = useState("");
  const [gender, setGender] = useState<Person["gender"]>("unknown");
  const [error, setError] = useState("");
  useEffect(() => { ref.current?.showModal(); }, []);
  const linked = person && kind !== "unrelated";
  const onKindChange = (value: string) => {
    setKind(value);
    const option = kindOption(value);
    if (option?.subtype) setRelationshipSubtype(option.subtype);
    else if (value === "unrelated") setExisting(false);
    else setRelationshipSubtype("");
  };
  return <dialog className="relative-dialog" ref={ref} onCancel={onClose} aria-labelledby="relative-title">
    <div className="dialog-heading"><h2 id="relative-title">{person ? `Add to ${fullName(person)}'s family` : "Add first person"}</h2><button className="icon-button" aria-label="Close dialog" onClick={onClose}><X size={20} /></button></div>
    <form onSubmit={event => {
      event.preventDefault();
      const created = createEmptyPerson(treeId);
      Object.assign(created, { givenName: givenName.trim(), familyName: familyName.trim(), birthDate, gender, branchColor: person?.branchColor || "#b88f98" });
      const id = existing ? targetId : created.id;
      if (existing && !id) { setError("Choose a person to link."); return; }
      const option = kindOption(kind);
      const type: RelationshipType = kind === "parent" || kind === "child" ? "parent-child" : option?.type || "partner";
      const fromId = kind === "parent" || kind === "guardian" ? id : person?.id;
      const toId = kind === "parent" || kind === "guardian" ? person?.id : id;
      if (linked && fromId && toId) {
        const candidate = existing ? state : { ...state, people: [...state.people, created] };
        const message = relationshipError(candidate, treeId, type, fromId, toId);
        if (message) { setError(message); return; }
        const coParent = kind === "child" ? otherParentId || undefined : undefined;
        if (coParent) {
          const parentError = relationshipError(candidate, treeId, "parent-child", coParent, toId);
          if (parentError) { setError(parentError); return; }
        }
        const relationshipSubtypeValue = relationshipSubtype.trim() || option?.subtype || "";
        const roles = { parent: parentRole, otherParent: otherParentRole, parentage, otherParentage, siblingStatus, relationshipSubtype: relationshipSubtypeValue };
        if (existing) onLink(type, fromId, toId, coParent, roles); else onAdd(created, type, fromId, toId, coParent, roles);
      } else onAdd(created);
      onClose();
    }}>
      {person && <label className="field"><span>Relationship to {fullName(person)}</span><select className="control" aria-label="Relationship" value={kind} onChange={event => onKindChange(event.target.value)}>{RELATIVE_KIND_OPTIONS.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}</select></label>}
      {person && <p className="quiet">You can add more than one husband, wife, spouse, partner, dating partner, civil-union partner, co-parent, or user-defined partner link. KinForge keeps each relationship as its own editable connection.</p>}
      {person && kind === "child" && <label className="field"><span>Other parent</span><select className="control" aria-label="Other parent" value={otherParentId} onChange={event => setOtherParentId(event.target.value)}><option value="">Not recorded</option>{state.people.filter(entry => entry.treeId === treeId && entry.id !== person.id && (!existing || entry.id !== targetId)).map(entry => <option key={entry.id} value={entry.id}>{fullName(entry)}</option>)}</select></label>}
      {person && (kind === "parent" || kind === "child") && <ParentRoleField label={kind === "parent" ? "New parent's role" : `${fullName(person)}'s parent role`} value={parentRole} onChange={setParentRole} />}
      {person && (kind === "parent" || kind === "child") && <ParentageField label="Parentage" value={parentage} onChange={setParentage} />}
      {person && kind === "sibling" && <label className="field parent-role-field"><span>Sibling type</span><select className="control" aria-label="Sibling type" value={siblingStatus} onChange={event => setSiblingStatus(event.target.value)}>{SIBLING_TYPES.map(([value, label]) => <option key={value || "none"} value={value}>{label}</option>)}</select></label>}
      {linked && <label className="field parent-role-field"><span>Relationship sub-type</span><input className="control" aria-label="Relationship sub-type" list="relationship-subtype-options" placeholder="Stepfamily, foster, in-law, cousin-in-law..." value={relationshipSubtype} onChange={event => setRelationshipSubtype(event.target.value)} /></label>}
      <datalist id="relationship-subtype-options">{[...new Set([...RELATIONSHIP_SUBTYPE_OPTIONS, ...(state.customRelationshipSubtypes || [])])].filter(Boolean).map(value => <option key={value} value={value} />)}</datalist>
      {person && kind === "child" && otherParentId && <ParentRoleField label="Other parent's role" value={otherParentRole} onChange={setOtherParentRole} />}
      {person && kind === "child" && otherParentId && <ParentageField label="Other parent's parentage" value={otherParentage} onChange={setOtherParentage} />}
      {linked && <div className="segmented"><button type="button" className={!existing ? "active" : ""} onClick={() => setExisting(false)}>New person</button><button type="button" className={existing ? "active" : ""} onClick={() => setExisting(true)}>Existing person</button></div>}
      {existing ? <label className="field"><span>Person</span><select className="control" aria-label="Existing person" required value={targetId} onChange={event => setTargetId(event.target.value)}><option value="">Choose a person</option>{state.people.filter(entry => entry.treeId === treeId && entry.id !== person?.id).map(entry => <option key={entry.id} value={entry.id}>{fullName(entry)}</option>)}</select></label> : <div className="settings-grid">
        <label className="field"><span>Given name</span><input autoFocus required className="control" value={givenName} onChange={event => setGivenName(event.target.value)} /></label>
        <label className="field"><span>Family name</span><input className="control" value={familyName} onChange={event => setFamilyName(event.target.value)} /></label>
        <label className="field"><span>Birth date</span><input className="control" placeholder="YYYY-MM-DD" value={birthDate} onChange={event => setBirthDate(event.target.value)} /></label>
        <label className="field"><span>Gender</span><select className="control" value={gender} onChange={event => setGender(event.target.value as Person["gender"])}><option value="unknown">Unknown</option><option value="female">Female</option><option value="male">Male</option><option value="nonbinary">Nonbinary</option></select></label>
      </div>}
      {error && <p role="alert" className="inline-error">{error}</p>}
      <div className="dialog-footer"><button className="button secondary" type="button" onClick={onClose}>Cancel</button><button className="button primary" type="submit">{existing ? <Link2 size={16} /> : <GitBranch size={16} />}{existing ? "Link relative" : "Add person"}</button></div>
    </form>
  </dialog>;
}
