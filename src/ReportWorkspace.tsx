import { useEffect, useLayoutEffect, useRef, useState, type CSSProperties } from "react";
import { EditorContent, useEditor } from "@tiptap/react";
import { generateHTML, type JSONContent } from "@tiptap/core";
import { NodeSelection } from "@tiptap/pm/state";
import { AlignCenter, AlignLeft, AlignRight, ArrowDown, ArrowUp, Bold, BringToFront, Download, FolderOpen, ImagePlus, Italic, Minus, Plus, Printer, Redo2, Scissors, SendToBack, Share2, Table2, TextCursorInput, Trash2, Type, Underline, Undo2 } from "lucide-react";
import { AppState, LANGUAGES, LIST_TYPES, Person, REPORT_TYPES, ReportDraft, fullName, languageLabel, makeId, nowIso } from "./domain";
import { buildReportDocument, localReportImage, reportFromText } from "./reportDocument";
import { generateListBody } from "./analysis";
import { downloadBlob, exportCsv, exportText } from "./exporters";
import { exportFormattedPdf, exportFormattedRtf } from "./reportExports";
import "./reports.css";
import { buildCatalogReport, reportScope } from "./reportCatalog";
import { materializeReportCharts } from "./reportCharts";
import { REPORT_THEMES, type ReportOptions, type ReportPresentation } from "./reportOptions";
import { reportColumns, reportSections } from "./reportSections";
import { captureReportCanvas, changeReportObjects, clearReportObjectSelection, formatReportObjects, insertReportBlock, reportBlocks, reportCanvasObjects, reportExtensions, reportHtmlDocument, reportPresentation, reportSelectionKey, selectReportObject, setCanvasObjects, stackReportCanvas, syncReportCanvas, type CanvasObject } from "./reportLayout";
import { getNativeStorageFolders, openNativeFolder, type NativeStorageFolders } from "./nativeStorage";
import { SENSITIVE_VISIBILITY_LABELS } from "./protection";
import { TermMeaning } from "./TermsDialog";
import { collectionOptions } from "./libraryHierarchy";

const labelFor = (value: string) => value.replace(/-/g, " ").replace(/^./, letter => letter.toUpperCase());
const defaults: ReportOptions = { includePrivate: false, generations: 3, language: "en", parentage: "all" };

function ReportOptionControls({ type, options, onChange, state, treeId }: { type: string; options: ReportOptions; onChange: (options: ReportOptions) => void; state: AppState; treeId: string }) {
  const change = (patch: Partial<ReportOptions>) => onChange({ ...options, ...patch });
  const sections = reportSections(type), columns = reportColumns(type);
  const events = ["Person Report", "Person Events Report", "Narrative Report", "Timeline Report", "Timeline Chart", "Events List", "Map Report", "Story Report", "Anniversary List", "Today Report"].includes(type);
  const dates = events || ["Facts List", "Marriage List", "Marriages List", "Changes List", "World History Report", "ToDo List", "Persons List"].includes(type);
  const ancestry = /Person Report|Ahnentafel|Descendan|Register|Family|Fan Chart|Hourglass|Kinship|Relationship|Genogram|Sociogram/.test(type);
  const eventTypes = [...new Set(reportScope(state, treeId, options.includePrivate, options.parentage).events.map(e => e.type))].sort();
  const groups = ["none", ...(/Facts|Events|Marriage/.test(type) ? ["type"] : []), ...(/Persons|Facts/.test(type) ? ["surname"] : []), ...(/Events|Persons|Places/.test(type) ? ["place"] : []), ...(/ToDo|Marriage|Persons/.test(type) ? ["status"] : [])];
  const sortChoices = type === "Sources List" ? ["name", "type"] : type === "Changes List" ? ["name", "date"] : ["name", "date", "type"];
  const distinctive = type !== "Plausibility Report";
  const select = (label: string, key: keyof ReportOptions, values: readonly string[], fallback: string) => <label className="field"><span>{label}</span><select className="control" aria-label={label} value={String(options[key] ?? fallback)} onChange={e => change({ [key]: e.target.value })}>{values.map(value => <option key={value} value={value}>{labelFor(value)}</option>)}</select></label>;
  const choices = (legend: string, key: "sections" | "columns" | "eventTypes" | "kinshipCategories", values: string[]) => values.length > 0 && <fieldset className="report-option-checks"><legend>{legend}</legend>{values.map(value => <label className="check" key={value}><input type="checkbox" aria-label={`${legend}: ${value}`} checked={(options[key] ?? values).includes(value)} onChange={e => change({ [key]: e.target.checked ? [...(options[key] ?? values), value] : (options[key] ?? values).filter(item => item !== value) })} />{labelFor(value)}</label>)}</fieldset>;
  return <details className="report-content-options"><summary>Report content</summary><div className="report-option-grid">
    {["Person Report", "Narrative Report", "Story Report", "Ahnentafel Report", "Descendancy Report", "Register Report", "Family Tree Book"].includes(type) && <label className="field"><span>Report language</span><select className="control" aria-label="Report language" value={options.language || "en"} onChange={e => change({ language: e.target.value as ReportOptions["language"] })}>{LANGUAGES.map(language => <option key={language.code} value={language.code}>{languageLabel(language.code)}{language.region ? ` (${language.region})` : ""}</option>)}</select></label>}
    {ancestry && select("Parentage", "parentage", ["all", "unspecified", "biological", "adoptive", "foster", "step"], "all")}
    {["Person Events Report", "Narrative Report", "Story Report", "Timeline Report", "Timeline Chart"].includes(type) && select("Event scope", "eventScope", ["person", "immediate-family", "all-relatives"], type === "Person Events Report" ? "all-relatives" : "person")}
    {dates && <><label className="field"><span>Date from</span><input className="control" aria-label="Date from" type="date" value={options.dateFrom || ""} onChange={e => change({ dateFrom: e.target.value || undefined })} /></label><label className="field"><span>Date to</span><input className="control" aria-label="Date to" type="date" value={options.dateTo || ""} min={options.dateFrom} onChange={e => change({ dateTo: e.target.value || undefined })} /></label></>}
    {columns.length > 0 && <><label className="field"><span>Sort by</span><select className="control" aria-label="Sort by" value={options.sortBy || ""} onChange={e => change({ sortBy: e.target.value as ReportOptions["sortBy"] || undefined })}><option value="">Default order</option>{sortChoices.map(value => <option key={value} value={value}>{labelFor(value)}</option>)}</select></label>{select("Sort direction", "sortDirection", ["asc", "desc"], "asc")}{groups.length > 1 && select("Group by", "groupBy", groups, "none")}</>}
    {["Person Report", "Hourglass Chart"].includes(type) && <>{(["ancestorGenerations", "descendantGenerations"] as const).map(key => <label className="field" key={key}><span>{key === "ancestorGenerations" ? "Ancestor generations" : "Descendant generations"}</span><input type="number" className="control" aria-label={key === "ancestorGenerations" ? "Ancestor generations" : "Descendant generations"} placeholder={`Default (${options.generations || 3})`} min="1" max="10" value={options[key] ?? ""} onChange={e => change({ [key]: e.target.value === "" ? undefined : Math.max(1, Math.min(10, Number(e.target.value))) })} /></label>)}</>}
    {type === "ToDo List" && select("Task status", "todoStatus", ["all", "open", "doing", "done"], "all")}
    {type === "Story Report" && select("Story style", "storyStyle", ["documentary", "album", "chronicle"], "documentary")}
    {["Person Report", "Timeline Report", "Timeline Chart", "Narrative Report", "Story Report", "Family Tree Book"].includes(type) && <label className="check"><input type="checkbox" checked={options.includeHistory ?? type === "Person Report"} onChange={e => change({ includeHistory: e.target.checked })} />Include world history</label>}
    {type === "Status Report" && <label className="check"><input type="checkbox" checked={options.includeUnassignedMedia || false} onChange={e => change({ includeUnassignedMedia: e.target.checked })} />Include unassigned media</label>}
  </div>
    {choices("Sections", "sections", sections)}{choices("Columns", "columns", columns)}{events && choices("Event types", "eventTypes", eventTypes)}
    {type === "Kinship Report" && choices("Kinship categories", "kinshipCategories", ["ancestors", "descendants", "siblings", "cousins", "collateral", "partners", "in-laws", "other"])}
    {["Plausibility Report", "Distinctive Persons List", "Particularities Report"].includes(type) && <fieldset className="report-option-grid report-thresholds"><legend>Thresholds</legend>{([
      ["minParentAge", "Minimum parent age", distinctive ? 18 : 12], ["maxParentAge", "Maximum parent age", distinctive ? 40 : 80], ["maxLifespan", "Maximum lifespan", distinctive ? 80 : 120], ["minMarriageAge", "Minimum marriage age", distinctive ? 18 : 16], ["maxMarriageAge", "Maximum marriage age", distinctive ? 40 : 100], ["manyChildren", "Many children (more than)", 4], ["earlyDeath", "Early death age", 10], ["burialDelayDays", "Burial delay (days)", 366]
    ] as const).filter(([key]) => distinctive ? key !== "burialDelayDays" : !["manyChildren", "earlyDeath"].includes(key)).map(([key, label, fallback]) => <label className="field" key={key}><span>{label}</span><input className="control" type="number" min="0" max={key === "burialDelayDays" ? 36500 : 200} aria-label={label} value={options.thresholds?.[key] ?? fallback} onChange={e => change({ thresholds: { ...options.thresholds, [key]: e.target.value === "" ? undefined : Math.max(0, Number(e.target.value)) } })} /></label>)}</fieldset>}
  </details>;
}

type Props = {
  saved: boolean;
  saveTarget?: "cloud" | "device";
  readOnly?: boolean;
  canManagePrivacy?: boolean;
  state: AppState; treeId: string; person?: Person;
  reportType: string; setReportType: (type: string) => void;
  mode: "report" | "list"; setMode: (mode: "report" | "list") => void;
  onPerson: (id: string) => void; onSave: (draft: ReportDraft) => void; onDelete: (id: string) => void;
};

function ReportPlacement({ state, bookId, collectionId, disabled, onChange }: { state: AppState; bookId: string; collectionId: string; disabled: boolean; onChange: (bookId: string, collectionId: string) => void }) {
  const collections = collectionOptions(state.collections, bookId);
  return <fieldset className="report-placement" aria-label="Report library placement" disabled={disabled}>
    <legend>Save to library</legend>
    <p className="quiet">Choose the book and optional collection where this report draft belongs. A subcollection is selected from the same list.</p>
    <div className="report-option-grid">
      <label className="field"><span>Book</span><select className="control" aria-label="Report book" value={bookId} onChange={event => onChange(event.target.value, "")}>
        {state.books.map(book => <option key={book.id} value={book.id}>{book.title}</option>)}
        {!state.books.length && <option value="">No books yet</option>}
      </select></label>
      <label className="field"><span>Collection or subcollection</span><select className="control" aria-label="Report collection" value={collectionId} onChange={event => onChange(bookId, event.target.value)}>
        <option value="">No collection</option>
        {collections.map(collection => <option key={collection.id} value={collection.id}>{collection.label}</option>)}
      </select></label>
    </div>
  </fieldset>;
}

export function ReportWorkspace({ saved, saveTarget = "device", readOnly = false, canManagePrivacy = true, state, treeId, person, reportType, setReportType, mode, setMode, onPerson, onSave, onDelete }: Props) {
  const [comparison, setComparison] = useState("");
  const [includePrivate, setIncludePrivate] = useState(false);
  const [generations, setGenerations] = useState(3);
  const [listType, setListType] = useState(LIST_TYPES[0]);
  const [familyId, setFamilyId] = useState("");
  const [analysisType, setAnalysisType] = useState("all-facts");
  const [contentOptions, setContentOptions] = useState<ReportOptions>(defaults);
  const [generationError, setGenerationError] = useState("");
  const [generating, setGenerating] = useState(false);
  const [activeId, setActiveId] = useState("");
  const selectedTree = state.trees.find(tree => tree.id === treeId);
  const fallbackBookId = selectedTree?.bookId || state.books[0]?.id || "";
  const fallbackCollectionId = selectedTree?.collectionId || "";
  const [destinationBookId, setDestinationBookId] = useState(fallbackBookId);
  const [destinationCollectionId, setDestinationCollectionId] = useState(fallbackCollectionId);
  const people = state.people.filter(p => p.treeId === treeId);
  const drafts = (state.reportDrafts || []).filter(d => d.treeId === treeId);
  const draft = drafts.find(d => d.id === activeId) || drafts[drafts.length - 1];
  useEffect(() => {
    if (!draft) {
      setDestinationBookId(fallbackBookId);
      setDestinationCollectionId(fallbackCollectionId);
      return;
    }
    setDestinationBookId(draft.bookId || fallbackBookId);
    setDestinationCollectionId(draft.collectionId || (!draft.bookId ? fallbackCollectionId : ""));
    if (!draft) return;
    const restored = { ...defaults, ...draft.options };
    setContentOptions(restored); setComparison(restored.comparisonId || ""); setIncludePrivate(!!restored.includePrivate);
    setGenerations(restored.generations || 3); setFamilyId(restored.familyId || ""); setAnalysisType(restored.analysisType || "all-facts");
    if (draft.mode === "list" && LIST_TYPES.includes(draft.type)) { setMode("list"); setListType(draft.type); }
    else if (REPORT_TYPES.includes(draft.type)) { setMode("report"); setReportType(draft.type); }
    else if (LIST_TYPES.includes(draft.type)) { setMode("list"); setListType(draft.type); }
    if (draft.personId && people.some(p => p.id === draft.personId)) onPerson(draft.personId);
  }, [draft?.id, treeId, fallbackBookId, fallbackCollectionId]);
  const placementBookId = draft ? (draft.bookId || fallbackBookId) : destinationBookId;
  const placementCollectionId = draft ? (draft.collectionId || (!draft.bookId ? fallbackCollectionId : "")) : destinationCollectionId;
  const updatePlacement = (bookId: string, collectionId: string) => {
    setDestinationBookId(bookId); setDestinationCollectionId(collectionId);
    if (draft) onSave({ ...draft, bookId: bookId || undefined, collectionId: collectionId || undefined, updatedAt: nowIso() });
  };
  const generate = async () => {
    if (readOnly) return;
    setGenerating(true);
    try {
    const type = mode === "report" ? reportType : listType;
    const options: ReportOptions = { ...contentOptions, comparisonId: people.some(p => p.id === comparison) ? comparison : undefined, includePrivate, generations, familyId: familyId || undefined, analysisType };
    if (options.dateFrom && options.dateTo && options.dateFrom > options.dateTo) throw new Error("The end date must be on or after the start date.");
    const content = await materializeReportCharts(mode === "report" ? buildReportDocument(state, treeId, type, person?.id, options) : buildCatalogReport(state, treeId, type, person?.id, options) || reportFromText(generateListBody(state, treeId, type)));
    const next: ReportDraft = { id: makeId("report"), treeId, bookId: placementBookId || undefined, collectionId: placementCollectionId || undefined, type, mode, title: `${type} - ${person && (!person.private || includePrivate) ? fullName(person) : "Private person"}`, personId: person?.id, body: "", html: generateHTML(content, reportExtensions()), visibility: includePrivate && canManagePrivacy ? "private" : "shared", pageSize: draft?.pageSize || "a4", options, presentation: reportPresentation(draft?.presentation), updatedAt: nowIso() };
    onSave(next); setActiveId(next.id); setGenerationError("");
    } catch (error) { setGenerationError(error instanceof Error ? error.message : "The report could not be generated."); } finally { setGenerating(false); }
  };
  return <div className="report-workspace">
    <div className="report-generator">
      <div className="segmented"><button className={mode === "report" ? "active" : ""} onClick={() => { setMode("report"); setContentOptions(o => ({ ...o, sections: undefined, columns: undefined })); }}>Reports</button><button className={mode === "list" ? "active" : ""} onClick={() => { setMode("list"); setContentOptions(o => ({ ...o, sections: undefined, columns: undefined })); }}>Lists</button></div>
      <label className="field"><span>{mode === "report" ? "Report type" : "List type"}</span><select className="control" aria-label={mode === "report" ? "Report type" : "List type"} value={mode === "report" ? reportType : listType} onChange={event => { mode === "report" ? setReportType(event.target.value) : setListType(event.target.value); setContentOptions(o => ({ ...o, sections: undefined, columns: undefined })); }}>{(mode === "report" ? REPORT_TYPES : LIST_TYPES).map(type => <option key={type}>{type}</option>)}</select></label>
      <label className="field"><span>{reportType === "Kinship Report" ? "Reference person" : "Person"}</span><select className="control" aria-label={reportType === "Kinship Report" ? "Reference person" : "Report person"} value={person?.id || ""} onChange={e => onPerson(e.target.value)}>{people.map(p => <option key={p.id} value={p.id}>{fullName(p)}</option>)}</select></label>
      {mode === "report" && ["Kinship Report", "Relationship Chart"].includes(reportType) && <label className="field"><span>Compare with</span><select className="control" aria-label="Compare with" value={comparison} onChange={e => setComparison(e.target.value)}><option value="">{reportType === "Kinship Report" ? "All other people" : "Choose a person"}</option>{people.map(p => <option key={p.id} value={p.id}>{fullName(p)}</option>)}</select></label>}
      {mode === "report" && ["Family Report", "Family Group Report"].includes(reportType) && <label className="field"><span>Family</span><select className="control" aria-label="Report family" value={familyId} onChange={e => setFamilyId(e.target.value)}><option value="">Selected person's families</option>{state.families.filter(f => f.treeId === treeId).map(f => <option key={f.id} value={f.id}>{f.name}</option>)}</select></label>}
      {mode === "report" && ["Person Report", "Ahnentafel Report", "Ahnentafel Diagram", "Fan Chart", "Hourglass Chart", "Family Report", "Family Group Report", "Register Report", "Descendancy Report", "Descendancy List"].includes(reportType) && <label className="field"><span>Generations</span><input className="control" aria-label="Report generations" type="number" min="1" max="10" value={generations} onChange={e => setGenerations(Math.max(1, Math.min(10, Number(e.target.value))))} /></label>}
      {(mode === "report" ? reportType : listType) === "Person Analysis" && <label className="field"><span>Analyse</span><select className="control" aria-label="Analysis type" value={analysisType} onChange={e => setAnalysisType(e.target.value)}><option value="all-facts">All fact types and values</option>{["gender", "surname", "birth-year", "death-year", "lifespan", "children", "marriages", "sources", "events", "media", "event-type", "event-place", "event-year"].map(value => <option key={value} value={value}>{labelFor(value)}</option>)}{[...new Set(people.filter(p => includePrivate || !p.private).flatMap(p => p.facts.filter(f => includePrivate || !f.private).map(f => f.type)))].sort().map(type => <option key={`fact:${type}`} value={`fact:${type}`}>Fact: {type}</option>)}{[...new Set(reportScope(state, treeId, includePrivate).events.map(e => e.type))].sort().map(type => <option key={`event:${type}`} value={`event:${type}`}>Event: {type} by place</option>)}</select></label>}
      <label className="check"><input type="checkbox" checked={includePrivate} onChange={e => setIncludePrivate(e.target.checked)} />Include private people and annotations</label>
      <ReportPlacement state={state} bookId={placementBookId} collectionId={placementCollectionId} disabled={readOnly} onChange={updatePlacement} />
      <ReportOptionControls type={mode === "report" ? reportType : listType} options={{ ...contentOptions, includePrivate, generations }} onChange={setContentOptions} state={state} treeId={treeId} />
      <button className="button primary" disabled={generating} onClick={generate}><Plus size={16} />{generating ? "Generating draft" : "Generate Editable Draft"}</button>
    </div>
    {generationError && <p role="alert">{generationError}</p>}
    <TermMeaning term={mode === "report" ? reportType : listType} />
    {drafts.length > 0 && <label className="report-drafts"><span>Saved drafts</span><select className="control" aria-label="Saved drafts" value={draft?.id || ""} onChange={e => setActiveId(e.target.value)}>{drafts.map(d => <option key={d.id} value={d.id}>{d.title} | {new Date(d.updatedAt).toLocaleString()}</option>)}</select></label>}
    {draft && <div className="report-draft-management"><label className="field"><span>Draft name</span><input className="control" aria-label="Draft name" value={draft.title} onChange={e => onSave({ ...draft, title: e.target.value, updatedAt: nowIso() })} /></label><label className="field"><span>Report visibility</span><select className="control" aria-label="Report visibility" disabled={readOnly || !canManagePrivacy} value={draft.visibility || (draft.options?.includePrivate ? "private" : "shared")} onChange={e => onSave({ ...draft, visibility: e.target.value === "private" ? "private" : "shared", updatedAt: nowIso() })}>{Object.entries(SENSITIVE_VISIBILITY_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label><button className="icon-button" title="Delete selected draft" aria-label="Delete selected draft" disabled={readOnly} onClick={() => onDelete(draft.id)}><Trash2 size={17} /></button></div>}
    {draft && <p className="quiet">Reports are saved copies. Changing a person's visibility later does not change an existing report or a file already downloaded.</p>}
    {draft ? <ReportEditor key={draft.id} saved={saved} saveTarget={saveTarget} readOnly={readOnly} draft={draft} onSave={onSave} /> : <div className="report-empty"><h2>Reports</h2><p>No saved report drafts.</p></div>}
  </div>;
}

function ReportEditor({ draft, onSave, saved, saveTarget, readOnly }: { draft: ReportDraft; onSave: (draft: ReportDraft) => void; saved: boolean; saveTarget: "cloud" | "device"; readOnly: boolean }) {
  const latest = useRef({ draft, onSave, readOnly }); latest.current = { draft, onSave, readOnly };
  const [, redraw] = useState(0);
  const [preview, setPreview] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [objectMode, setObjectMode] = useState(false);
  const [nativeFolders, setNativeFolders] = useState<NativeStorageFolders | null>(null);
  const interaction = useRef({ objectMode, preview }); interaction.current = { objectMode, preview };
  const [insertLabel, setInsertLabel] = useState("New field");
  const [tableRows, setTableRows] = useState(3);
  const [tableColumns, setTableColumns] = useState(2);
  const [drag, setDrag] = useState<{ pointer: number; clientX: number; clientY: number; dx: number; dy: number; objects: CanvasObject[] } | null>(null);
  const dragRef = useRef(drag); dragRef.current = drag;
  const skipCanvasClick = useRef(false);
  const fileInput = useRef<HTMLInputElement>(null);
  const crestInput = useRef<HTMLInputElement>(null);
  const presentation = reportPresentation(draft.presentation);
  const colors = REPORT_THEMES[presentation.theme];
  const editor = useEditor({
    editable: !readOnly,
    extensions: reportExtensions(), content: draft.html || reportFromText(draft.body),
    editorProps: {
      attributes: { class: "report-document", role: "textbox", "aria-label": "Report draft", "aria-multiline": "true", spellcheck: "true" },
      handleClick(view, pos, event) {
        if (skipCanvasClick.current) { skipCanvasClick.current = false; return true; }
        if (!interaction.current.objectMode || interaction.current.preview) return false;
        const resolved = view.state.doc.resolve(pos), position = resolved.depth ? resolved.before(1) : pos;
        const current = reportSelectionKey.getState(view.state) || [];
        const selected = event.shiftKey ? current.includes(position) ? current.filter(p => p !== position) : [...current, position] : [position];
        view.dispatch(view.state.tr.setMeta(reportSelectionKey, selected.sort((a, b) => a - b)));
        return true;
      }
    },
    onCreate: ({ editor }) => { if (!latest.current.readOnly) latest.current.onSave({ ...latest.current.draft, body: editor.getText(), html: editor.getHTML() }); },
    onUpdate: ({ editor }) => { if (!latest.current.readOnly) latest.current.onSave({ ...latest.current.draft, body: editor.getText(), html: editor.getHTML(), updatedAt: nowIso() }); },
    onTransaction: () => redraw(n => n + 1)
  });
  useEffect(() => { editor?.setEditable(!readOnly && !preview, false); }, [editor, readOnly, preview]);
  useEffect(() => {
    if (!editor) return;
    const changed = draft.html ? editor.getHTML() !== draft.html : editor.getText() !== draft.body;
    if (changed) editor.commands.setContent(draft.html || reportFromText(draft.body), { emitUpdate: false });
  }, [editor, draft.html, draft.body]);
  useEffect(() => {
    if (!editor) return;
    editor.view.dom.style.setProperty("--report-ink", colors.ink);
    editor.view.dom.style.setProperty("--report-band", colors.band);
    editor.view.dom.style.setProperty("--report-accent", colors.accent);
  }, [editor, colors]);
  useEffect(() => {
    let mounted = true;
    void getNativeStorageFolders().then((folders) => { if (mounted) setNativeFolders(folders); });
    return () => { mounted = false; };
  }, []);
  useLayoutEffect(() => {
    if (!editor) return;
    const sync = () => syncReportCanvas(editor, presentation.layout === "canvas", presentation.canvasWidth);
    sync();
    if (presentation.layout !== "canvas") return;
    const observer = new ResizeObserver(sync);
    for (const child of Array.from(editor.view.dom.children)) observer.observe(child);
    return () => observer.disconnect();
  }, [editor, draft.html, presentation.layout, presentation.canvasWidth]);
  if (!editor) return null;
  const tool = (label: string, icon: React.ReactNode, action: () => void, active = false, disabled = false) => <button type="button" title={label} aria-label={label} aria-pressed={active} className={`report-icon ${active ? "active" : ""}`} disabled={disabled || preview} onMouseDown={e => e.preventDefault()} onClick={action}>{icon}</button>;
  const attrs = editor.getAttributes("textStyle");
  const changePage = (pageSize: "a4" | "letter") => onSave({ ...draft, pageSize, updatedAt: nowIso() });
  const changePresentation = (patch: Partial<ReportPresentation>) => onSave({ ...latest.current.draft, presentation: { ...presentation, ...patch }, updatedAt: nowIso() });
  const selected = reportSelectionKey.getState(editor.state) || [];
  const blocks = reportBlocks(editor);
  const canvas = presentation.layout === "canvas";
  const canvasObjects = canvas ? reportCanvasObjects(editor) : [];
  const selectedCanvas = canvasObjects.filter(item => selected.includes(item.position));
  const firstObject = selectedCanvas[0];
  const canvasWidth = presentation.canvasWidth || editor.view.dom.getBoundingClientRect().width;
  const constrainMove = (items: CanvasObject[], dx: number, dy: number) => ({
    dx: Math.max(-Math.min(...items.map(item => item.x)), Math.min(dx, canvasWidth - Math.max(...items.map(item => item.x + item.width)))),
    dy: Math.max(-Math.min(...items.map(item => item.y)), Math.min(dy, 100000 - Math.max(...items.map(item => item.y))))
  });
  const positionObjects = (axis: "x" | "y", value: number) => {
    if (!firstObject) return;
    const { dx, dy } = constrainMove(selectedCanvas, axis === "x" ? value - firstObject.x : 0, axis === "y" ? value - firstObject.y : 0);
    setCanvasObjects(editor, selectedCanvas.map(item => ({ position: item.position, x: item.x + dx, y: item.y + dy })));
  };
  const changeLayout = (layout: "flow" | "canvas") => {
    const width = layout === "canvas" ? captureReportCanvas(editor) : presentation.canvasWidth;
    if (layout === "canvas") { setObjectMode(true); selectReportObject(editor, 0); }
    onSave({ ...latest.current.draft, html: editor.getHTML(), body: editor.getText(), presentation: { ...presentation, layout, canvasWidth: width }, updatedAt: nowIso() });
  };
  const image = editor.state.selection instanceof NodeSelection && editor.state.selection.node.type.name === "image" ? editor.state.selection.node : null;
  const field = editor.isActive("reportField") ? editor.getAttributes("reportField") : null;
  const insert = (content: JSONContent | JSONContent[]) => insertReportBlock(editor, content);
  const textNode = (text: string): JSONContent[] => text ? [{ type: "text", text }] : [];
  const upload = async (file: File | undefined, crest = false) => {
    if (!file) return;
    try {
      if (file.size > 5 * 1024 * 1024) throw new Error("Choose an image smaller than 5 MB.");
      const src = await new Promise<string>((resolve, reject) => { const reader = new FileReader(); reader.onload = () => resolve(String(reader.result)); reader.onerror = () => reject(new Error("The image could not be opened.")); reader.readAsDataURL(file); });
      if (!localReportImage(src)) throw new Error("Choose a PNG, JPEG, or WebP image.");
      const decoded = new window.Image(); decoded.src = src; await decoded.decode();
      if (crest) changePresentation({ crest: src });
      else insert({ type: "reportMedia", content: [{ type: "image", attrs: { src, alt: file.name } }, { type: "paragraph", content: textNode(file.name) }] });
      setError("");
    } catch (error) { setError(error instanceof Error ? error.message : "The image could not be opened."); }
  };
  const exportPdf = async (fillable = false) => { setBusy(true); setError(""); try { await exportFormattedPdf(editor.view.dom, draft.pageSize || "a4", presentation, fillable); } catch (error) { console.error("PDF export failed", error); setError("PDF export could not finish. Your draft remains open; please try again."); } finally { setBusy(false); } };
  const htmlFile = () => new File([reportHtmlDocument(editor.getHTML(), draft.title, draft.pageSize || "a4", presentation, editor.view.dom.getBoundingClientRect().height)], "KinForge-report.html", { type: "text/html" });
  const canShare = typeof navigator.canShare === "function" && typeof navigator.share === "function" && navigator.canShare({ files: [new File([""], "KinForge-report.html", { type: "text/html" })] });
  const pageStyle = { "--report-ink": colors.ink, "--report-accent": colors.accent, "--report-band": colors.band, "--report-margin": `${presentation.margin}pt` } as CSSProperties;
  return <div className="report-editor-workbench">
    {drag && <style>{drag.objects.map(item => `.report-paper .report-document[data-report-layout="canvas"] > :nth-child(${item.index + 1}){transform:translate(${drag.dx}px,${drag.dy}px)!important;}`).join("\n")}</style>}
    <style media="print">{`@page { size: ${draft.pageSize === "letter" ? "letter" : "A4"} ${presentation.orientation}; margin:${presentation.margin}pt; ${presentation.pageNumbers ? '@bottom-right { content: counter(page); }' : ""} }${presentation.printBackground ? "" : ".report-document h2,.report-table th{background:white!important}.report-page-watermark{display:none!important}"}`}</style>
    <div className="report-toolbar">
      <div className="report-tools">
        {tool("Undo report edit", <Undo2 size={17} />, () => { editor.chain().focus().undo().run(); }, false, !editor.can().undo())}
        {tool("Redo report edit", <Redo2 size={17} />, () => { editor.chain().focus().redo().run(); }, false, !editor.can().redo())}
        {tool("Bold", <Bold size={17} />, () => { editor.chain().focus().toggleBold().run(); }, editor.isActive("bold"), objectMode)}
        {tool("Italic", <Italic size={17} />, () => { editor.chain().focus().toggleItalic().run(); }, editor.isActive("italic"), objectMode)}
        {tool("Underline", <Underline size={17} />, () => { editor.chain().focus().toggleUnderline().run(); }, editor.isActive("underline"), objectMode)}
        {tool("Insert image", <ImagePlus size={17} />, () => fileInput.current?.click())}
        {tool("Insert text", <Type size={17} />, () => insert({ type: "paragraph", content: textNode("New text") }))}
        {tool("Insert line", <Minus size={17} />, () => insert({ type: "horizontalRule" }))}
        {tool("Insert page break", <Scissors size={17} />, () => insert([{ type: "reportPageBreak" }, { type: "paragraph" }]))}
        <input ref={fileInput} aria-label="Report image file" type="file" accept="image/png,image/jpeg,image/webp" hidden onChange={e => { const file = e.target.files?.[0]; e.target.value = ""; void upload(file); }} />
      </div>
      <div className="segmented"><button className={!preview ? "active" : ""} onClick={() => { setPreview(false); editor.setEditable(!readOnly); }}>Edit</button><button className={preview ? "active" : ""} onClick={() => { setPreview(true); editor.setEditable(false); }}>Preview</button></div>
      <div className="segmented" role="group" aria-label="Selection mode"><button aria-label="Select text" disabled={preview} className={!objectMode ? "active" : ""} onClick={() => { setObjectMode(false); clearReportObjectSelection(editor); }}>Text</button><button aria-label="Select objects" disabled={preview} className={objectMode ? "active" : ""} onClick={() => { setObjectMode(true); const from = editor.state.selection.$from; selectReportObject(editor, from.depth ? from.before(1) : from.pos); }}>Objects</button></div>
      <span className="report-saved">{saveTarget === "cloud" ? saved ? "Saved to your account" : "Cloud sync pending" : saved ? "Saved on this device" : "Not saved to device"}</span>
    </div>
    <div className="report-desk" onPointerDownCapture={event => {
      if (!canvas || !objectMode || preview || event.button !== 0 || !(event.target instanceof HTMLElement)) return;
      const root = editor.view.dom;
      if (!root.contains(event.target) || event.target === root) return;
      let target: HTMLElement = event.target;
      while (target.parentElement && target.parentElement !== root) target = target.parentElement;
      const index = Array.from(root.children).indexOf(target), block = blocks[index];
      if (!block) return;
      event.preventDefault(); skipCanvasClick.current = true;
      if (event.shiftKey || !selected.includes(block.position)) selectReportObject(editor, block.position, event.shiftKey);
      const chosen = reportSelectionKey.getState(editor.state) || [];
      const items = reportCanvasObjects(editor).filter(item => chosen.includes(item.position));
      if (!items.length || !chosen.includes(block.position)) return;
      event.currentTarget.setPointerCapture(event.pointerId);
      const next = { pointer: event.pointerId, clientX: event.clientX, clientY: event.clientY, dx: 0, dy: 0, objects: items };
      dragRef.current = next; setDrag(next);
    }} onPointerMove={event => {
      const active = dragRef.current; if (!active || active.pointer !== event.pointerId) return;
      const next = { ...active, ...constrainMove(active.objects, event.clientX - active.clientX, event.clientY - active.clientY) };
      dragRef.current = next; setDrag(next);
    }} onPointerUp={event => {
      const active = dragRef.current; if (!active || active.pointer !== event.pointerId) return;
      if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
      dragRef.current = null; setDrag(null);
      if (active.dx || active.dy) setCanvasObjects(editor, active.objects.map(item => ({ position: item.position, x: item.x + active.dx, y: item.y + active.dy })));
    }} onPointerCancel={() => { dragRef.current = null; setDrag(null); }}><article style={canvas ? { ...pageStyle, width: `${canvasWidth + presentation.margin * 8 / 3}px`, maxWidth: "none" } : pageStyle} data-theme={presentation.theme} className={`report-paper ${draft.pageSize === "letter" ? "letter" : ""} ${presentation.orientation} ${objectMode && !preview ? "report-object-mode" : ""}`}>
      {presentation.header && <div className="report-page-header">{presentation.header}</div>}
      {presentation.crest && localReportImage(presentation.crest) && <img className="report-crest" src={presentation.crest} alt="Family crest" />}
      {presentation.watermark && <div className="report-page-watermark" aria-hidden="true">{presentation.watermark}</div>}
      <EditorContent editor={editor} />
      {(presentation.footer || presentation.pageNumbers) && <div className="report-page-footer"><span>{presentation.footer}</span>{presentation.pageNumbers && <span className="report-page-number" aria-label="First page number">1</span>}</div>}
    </article></div>
    <aside className="report-format" aria-label="Report formatting">
      <h2>Format</h2>
      <fieldset disabled={preview}>
        {objectMode && <div className="report-object-controls"><output aria-live="polite">{selected.length} selected</output><div className="report-tools">
          {!canvas && tool("Move selected objects up", <ArrowUp size={17} />, () => changeReportObjects(editor, "up"), false, !selected.length || !blocks.some((b, i) => selected.includes(b.position) && i > 0 && !selected.includes(blocks[i - 1].position)))}
          {!canvas && tool("Move selected objects down", <ArrowDown size={17} />, () => changeReportObjects(editor, "down"), false, !selected.length || !blocks.some((b, i) => selected.includes(b.position) && i < blocks.length - 1 && !selected.includes(blocks[i + 1].position)))}
          {canvas && tool("Bring selected objects to front", <BringToFront size={17} />, () => stackReportCanvas(editor, true), false, !selected.length)}
          {canvas && tool("Send selected objects to back", <SendToBack size={17} />, () => stackReportCanvas(editor, false), false, !selected.length)}
          {tool("Delete selected objects", <Trash2 size={17} />, () => changeReportObjects(editor, "delete"), false, !selected.length)}
        </div><div className="report-object-list" role="group" aria-label="Report objects">{blocks.map((block, i) => <button type="button" key={block.position} aria-pressed={selected.includes(block.position)} className={selected.includes(block.position) ? "active" : ""} title={block.label} onClick={e => selectReportObject(editor, block.position, e.shiftKey)}>{i + 1}. {block.label}</button>)}</div>
        <div className="report-tools" role="group" aria-label="Object alignment">{tool("Align objects left", <AlignLeft size={17} />, () => formatReportObjects(editor, "left"), false, !selected.length)}{tool("Align objects center", <AlignCenter size={17} />, () => formatReportObjects(editor, "center"), false, !selected.length)}{tool("Align objects right", <AlignRight size={17} />, () => formatReportObjects(editor, "right"), false, !selected.length)}</div></div>}
        {canvas && objectMode && firstObject && <div className="report-position-controls">
          <label>X (px)<input aria-label="Object X" type="number" min="0" max={Math.max(0, canvasWidth - firstObject.width)} value={Math.round(firstObject.x)} onChange={e => positionObjects("x", Number(e.target.value))} /></label>
          <label>Y (px)<input aria-label="Object Y" type="number" min="0" max="100000" value={Math.round(firstObject.y)} onChange={e => positionObjects("y", Number(e.target.value))} /></label>
          <label>Width (px)<input aria-label="Object width" type="number" min="24" max={Math.floor(canvasWidth - firstObject.x)} value={Math.round(firstObject.width)} onChange={e => setCanvasObjects(editor, selectedCanvas.map(item => ({ position: item.position, width: Math.min(canvasWidth - item.x, Math.max(24, Number(e.target.value))) })))} /></label>
          <label>Layer<input aria-label="Object layer" type="number" min="0" max="10000" value={firstObject.z} onChange={e => setCanvasObjects(editor, selectedCanvas.map((item, index) => ({ position: item.position, z: Number(e.target.value) + index })))} /></label>
        </div>}
        {!objectMode && image && <div className="report-image-controls"><label>Image width (px)<input aria-label="Selected image width" type="number" min="16" max="2400" value={image.attrs.width || ""} placeholder="Auto" onChange={e => editor.chain().focus().updateAttributes("image", { width: e.target.value ? Math.max(16, Math.min(2400, Number(e.target.value))) : null }).run()} /></label><label>Image height (px)<input aria-label="Selected image height" type="number" min="16" max="2400" value={image.attrs.height || ""} placeholder="Auto" onChange={e => editor.chain().focus().updateAttributes("image", { height: e.target.value ? Math.max(16, Math.min(2400, Number(e.target.value))) : null }).run()} /></label><label>Image alignment<select aria-label="Selected image alignment" value={image.attrs.alignment || "left"} onChange={e => editor.chain().focus().updateAttributes("image", { alignment: e.target.value }).run()}><option value="left">Left</option><option value="center">Center</option><option value="right">Right</option></select></label><label>Image description<input aria-label="Selected image description" value={image.attrs.alt || ""} onChange={e => editor.chain().focus().updateAttributes("image", { alt: e.target.value }).run()} /></label>{tool("Delete selected image", <Trash2 size={17} />, () => { editor.chain().focus().deleteSelection().run(); })}</div>}
        {!objectMode && field && <label>Field label<input aria-label="Selected field label" value={field.label} onChange={e => editor.chain().focus().updateAttributes("reportField", { label: e.target.value }).run()} /></label>}
        <fieldset disabled={objectMode} className="report-text-format">
        <label>Text style<select aria-label="Text style" value={editor.isActive("heading", { level: 1 }) ? "title" : editor.isActive("heading", { level: 2 }) ? "section" : editor.isActive("heading", { level: 3 }) ? "subheading" : "body"} onChange={e => { const level = ({ title: 1, section: 2, subheading: 3 } as const)[e.target.value as "title" | "section" | "subheading"]; level ? editor.chain().focus().setHeading({ level }).run() : editor.chain().focus().setParagraph().run(); }}><option value="body">Body</option><option value="title">Report title</option><option value="section">Section heading</option><option value="subheading">Subheading</option></select></label>
        <label>Font<select aria-label="Report font" value={attrs.fontFamily || "Arial"} onChange={e => editor.chain().focus().setFontFamily(e.target.value).run()}><option>Arial</option><option>Georgia</option><option>Times New Roman</option><option>Verdana</option></select></label>
        <label>Size<select aria-label="Report font size" value={attrs.fontSize || "15pt"} onChange={e => editor.chain().focus().setFontSize(e.target.value).run()}>{[8, 9, 10, 11, 12, 14, 15, 16, 18, 20, 24, 28, 32].map(size => <option key={size} value={`${size}pt`}>{size} pt</option>)}</select></label>
        <label className="report-color">Text color<input aria-label="Report text color" type="color" value={attrs.color || "#202528"} onChange={e => editor.chain().focus().setColor(e.target.value).run()} /></label>
        <div className="report-tools" role="group" aria-label="Text alignment">{tool("Align left", <AlignLeft size={17} />, () => { editor.chain().focus().setTextAlign("left").run(); }, editor.isActive({ textAlign: "left" }))}{tool("Align center", <AlignCenter size={17} />, () => { editor.chain().focus().setTextAlign("center").run(); }, editor.isActive({ textAlign: "center" }))}{tool("Align right", <AlignRight size={17} />, () => { editor.chain().focus().setTextAlign("right").run(); }, editor.isActive({ textAlign: "right" }))}</div>
        <label>Line spacing<select aria-label="Report line spacing" value={attrs.lineHeight || "1.4"} onChange={e => editor.chain().focus().setLineHeight(e.target.value).run()}><option value="1">Single</option><option value="1.4">Regular</option><option value="1.6">Relaxed</option><option value="2">Double</option></select></label>
        </fieldset>
      </fieldset>
      <h2>Insert</h2>
      <fieldset disabled={preview}>
        <label>Label<input aria-label="New object label" value={insertLabel} onChange={e => setInsertLabel(e.target.value)} /></label>
        <div className="report-tools">{tool("Insert field", <TextCursorInput size={17} />, () => insert({ type: "reportField", attrs: { label: insertLabel.trim() || "Field" }, content: [] }))}{tool("Insert section", <Plus size={17} />, () => insert({ type: "reportSection", content: [{ type: "heading", attrs: { level: 2 }, content: textNode(insertLabel.trim() || "Section") }, { type: "paragraph", content: textNode("New section text") }] }))}</div>
        <label>Table rows<input aria-label="New table rows" type="number" min="1" max="20" value={tableRows} onChange={e => setTableRows(Math.max(1, Math.min(20, Number(e.target.value))))} /></label>
        <label>Table columns<input aria-label="New table columns" type="number" min="1" max="8" value={tableColumns} onChange={e => setTableColumns(Math.max(1, Math.min(8, Number(e.target.value))))} /></label>
        {tool("Insert table", <Table2 size={17} />, () => insert({ type: "table", content: Array.from({ length: tableRows }, (_, row) => ({ type: "tableRow", content: Array.from({ length: tableColumns }, (_, col) => ({ type: row ? "tableCell" : "tableHeader", content: [{ type: "paragraph", content: textNode(row ? "" : `Column ${col + 1}`) }] })) })) }))}
      </fieldset>
      <h2>Page</h2>
      <fieldset disabled={preview}>
      <label>Layout<select aria-label="Report layout" value={presentation.layout} onChange={e => changeLayout(e.target.value as "flow" | "canvas")}><option value="flow">Flow</option><option value="canvas">Canvas</option></select></label>
      <label>Paper size<select aria-label="Report paper size" value={draft.pageSize || "a4"} onChange={e => changePage(e.target.value as "a4" | "letter")}><option value="a4">A4</option><option value="letter">US Letter</option></select></label>
      <label>Theme<select aria-label="Report theme" value={presentation.theme} onChange={e => changePresentation({ theme: e.target.value as ReportPresentation["theme"] })}>{Object.keys(REPORT_THEMES).map(theme => <option key={theme} value={theme}>{labelFor(theme)}</option>)}</select></label>
      <label>Orientation<select aria-label="Page orientation" value={presentation.orientation} onChange={e => changePresentation({ orientation: e.target.value as ReportPresentation["orientation"] })}><option value="portrait">Portrait</option><option value="landscape">Landscape</option></select></label>
      <label>Margins (pt)<input aria-label="Page margins" type="number" min="0" max="144" value={presentation.margin} onChange={e => changePresentation({ margin: Math.max(0, Math.min(144, Number(e.target.value))) })} /></label>
      <label>Header<input aria-label="Page header" value={presentation.header} onChange={e => changePresentation({ header: e.target.value })} /></label>
      <label>Footer<input aria-label="Page footer" value={presentation.footer} onChange={e => changePresentation({ footer: e.target.value })} /></label>
      <label className="check"><input type="checkbox" checked={presentation.pageNumbers} onChange={e => changePresentation({ pageNumbers: e.target.checked })} />Page numbers</label>
      <label className="check"><input type="checkbox" checked={presentation.printBackground} onChange={e => changePresentation({ printBackground: e.target.checked })} />Print background</label>
      <label>Watermark<input aria-label="Page watermark" value={presentation.watermark} onChange={e => changePresentation({ watermark: e.target.value })} /></label>
      <button type="button" className="button secondary" onClick={() => crestInput.current?.click()}><ImagePlus size={16} />{presentation.crest ? "Replace crest" : "Upload crest"}</button>
      <input ref={crestInput} type="file" accept="image/png,image/jpeg,image/webp" aria-label="Crest image file" hidden onChange={e => { const file = e.target.files?.[0]; e.target.value = ""; void upload(file, true); }} />
      {presentation.crest && tool("Remove crest", <Trash2 size={17} />, () => changePresentation({ crest: "" }))}
      </fieldset>
      <h2>Export</h2>
      {nativeFolders && <div className="native-folder-panel">
        <strong>KinForge folders</strong>
        <span title={nativeFolders.folders.Reports}>{nativeFolders.folders.Reports}</span>
        <div className="native-folder-actions">
          <button type="button" className="button secondary" onClick={() => void openNativeFolder("Reports")}><FolderOpen size={16} />Reports</button>
          <button type="button" className="button secondary" onClick={() => void openNativeFolder("app")}><FolderOpen size={16} />App folder</button>
        </div>
      </div>}
      <div className="report-exports">
        <button className="button" disabled={busy} onClick={() => void exportPdf()}><Download size={16} />PDF</button>
        <button className="button" disabled={busy} onClick={() => void exportPdf(true)}><Download size={16} />Fillable PDF</button>
        <button className="button secondary" onClick={() => exportText("KinForge-report.txt", editor.getText())}>Text</button>
        <button className="button secondary" disabled={busy} onClick={async () => { setBusy(true); setError(""); try { await exportFormattedRtf(editor.getHTML(), presentation); } catch { setError("RTF export could not finish. Please check the attached images and try again."); } finally { setBusy(false); } }}>RTF</button>
        <button className="button secondary" onClick={() => downloadBlob("KinForge-report.html", htmlFile())}>HTML</button>
        <button className="button secondary" onClick={() => exportCsv("KinForge-report.csv", [["Line", "Report text"], ...editor.getText().split("\n").map((line, i) => [String(i + 1), line])])}>CSV</button>
        <button className="button secondary" onClick={() => window.print()}><Printer size={16} />Print</button>
        {canShare && <button className="button secondary" disabled={busy} onClick={async () => { try { await navigator.share({ title: draft.title, files: [htmlFile()] }); } catch (error) { if (!(error instanceof DOMException && error.name === "AbortError")) setError("The report could not be shared. Download HTML to keep a local copy."); } }}><Share2 size={16} />Share</button>}
      </div>
      {error && <p role="alert" className="report-error">{error}</p>}
    </aside>
  </div>;
}
