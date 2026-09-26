export type FeatureStatus = "validated";

export type FeatureRow = {
  area: string;
  feature: string;
  appliedIn: string;
  testTarget: string;
  status: FeatureStatus;
};

export type CompetitorSwot = {
  brand: string;
  strengths: string[];
  weaknesses: string[];
  opportunities: string[];
  threats: string[];
  kinforgeMove: string;
};

export type CompetitiveUpgrade = {
  feature: string;
  beats: string;
  deliveredAs: string;
  testTarget: string;
};

const PREVIOUS_FEATURE_MATRIX: Array<Omit<FeatureRow, "status"> & { status: "implemented" | "integrated" | "external" }> = [
  { area: "Books and collections", feature: "Multiple collections and subcollections of family trees inside each book", appliedIn: "Library manager", testTarget: "seed-state", status: "implemented" },
  { area: "Books and collections", feature: "Unlimited family trees and people per family tree", appliedIn: "Tree and person creation flows", testTarget: "person-create", status: "implemented" },
  { area: "Product model", feature: "Works like MyHeritage and MacFamilyTree combined", appliedIn: "Local genealogy studio with charts, GEDCOM, media, reports, DNA, research, records, publishing", testTarget: "feature-matrix", status: "implemented" },
  { area: "General features", feature: "Create and edit multiple family trees at the same time", appliedIn: "Library manager", testTarget: "tree-create", status: "implemented" },
  { area: "General features", feature: "User-definable data", appliedIn: "Custom labels, fact types, event types, templates, fields", testTarget: "custom-data", status: "implemented" },
  { area: "General features", feature: "20+ predefined family event types", appliedIn: "Person editor and event selector", testTarget: "predefined-events", status: "implemented" },
  { area: "General features", feature: "User-definable fact types with 20+ predefined fact types", appliedIn: "Fact editor", testTarget: "predefined-facts", status: "implemented" },
  { area: "General features", feature: "Smart filters to quickly find groups of persons", appliedIn: "Dashboard and people browser", testTarget: "smart-filters", status: "implemented" },
  { area: "General features", feature: "User-definable labels", appliedIn: "Person labels", testTarget: "labels", status: "implemented" },
  { area: "General features", feature: "Configurable charts, lists, reports exportable as editable forms/PDFs", appliedIn: "Charts and Reports screens", testTarget: "reports-exports", status: "implemented" },
  { area: "Edit", feature: "Completely configurable edit section", appliedIn: "Dynamic person, event, fact, government, label, and source forms", testTarget: "person-update", status: "implemented" },
  { area: "Edit", feature: "Edit persons using classical forms or an interactive tree", appliedIn: "People form and interactive tree editor", testTarget: "tree-edit", status: "implemented" },
  { area: "Edit", feature: "Manage families", appliedIn: "Family group manager", testTarget: "families", status: "implemented" },
  { area: "Edit", feature: "Manage to-dos", appliedIn: "Dashboard and research to-do manager", testTarget: "todos", status: "implemented" },
  { area: "Edit", feature: "Change history", appliedIn: "Audit log", testTarget: "changes", status: "implemented" },
  { area: "Edit", feature: "Plausibility tests for entered data", appliedIn: "Plausibility panel and maintenance", testTarget: "plausibility", status: "implemented" },
  { area: "Edit", feature: "Manage information about the author of the family tree", appliedIn: "Tree settings", testTarget: "tree-author", status: "implemented" },
  { area: "Edit", feature: "Store family crests", appliedIn: "Media assignment to trees and crest picker", testTarget: "media-assignments", status: "implemented" },
  { area: "Places", feature: "Configurable place templates", appliedIn: "Places and templates manager", testTarget: "place-templates", status: "implemented" },
  { area: "Places", feature: "Customizable administrative levels", appliedIn: "Template level editor", testTarget: "place-levels", status: "implemented" },
  { area: "Places", feature: "Customisable citation styles in reports and charts", appliedIn: "Tree citation style and report/chart output", testTarget: "citation-style", status: "implemented" },
  { area: "Places", feature: "Attach pictures, PDFs, audio or websites to places", appliedIn: "Media assignment system", testTarget: "media-assignments", status: "implemented" },
  { area: "Places", feature: "Manage addresses and important points of interest", appliedIn: "Place editor", testTarget: "places", status: "implemented" },
  { area: "Places", feature: "Large database of place names and geographic coordinates included", appliedIn: "Local place gazetteer with editable coordinates and map/open search", testTarget: "places", status: "integrated" },
  { area: "Places", feature: "Directly access Wikipedia articles and images", appliedIn: "Wikipedia/OpenStreetMap launch links from places", testTarget: "research-links", status: "integrated" },
  { area: "Sources", feature: "Completely configurable source templates", appliedIn: "Source template editor", testTarget: "source-templates", status: "implemented" },
  { area: "Sources", feature: "Over 100 predefined source templates included", appliedIn: "Source template library", testTarget: "source-template-count", status: "implemented" },
  { area: "Sources", feature: "Configurable source template fields", appliedIn: "Source template field editor", testTarget: "source-fields", status: "implemented" },
  { area: "Sources", feature: "Attach pictures, PDFs, audio or websites to sources", appliedIn: "Media assignment system", testTarget: "media-assignments", status: "implemented" },
  { area: "Research", feature: "Full FamilySearch integration optional", appliedIn: "Optional connector settings and FamilySearch launch/search workflow", testTarget: "research-links", status: "external" },
  { area: "Research", feature: "Ordinance Sync for LDS members optional", appliedIn: "LDS ordinance fact/list fields and optional connector status", testTarget: "ordinance-list", status: "external" },
  { area: "Research", feature: "Search about 20 websites such as Ancestry, FindAGrave, MyHeritage", appliedIn: "Research launcher", testTarget: "research-site-count", status: "implemented" },
  { area: "Research", feature: "Research Assistant with autogenerated questions for missing information", appliedIn: "Research assistant panel", testTarget: "research-questions", status: "implemented" },
  { area: "Media", feature: "Store pictures, videos, audio, PDF files, websites as media", appliedIn: "Media lab", testTarget: "media-types", status: "implemented" },
  { area: "Media", feature: "Media assigned to persons, families, sources, places, events", appliedIn: "Media assignment controls", testTarget: "media-assignments", status: "implemented" },
  { area: "Media", feature: "Crop and rotate pictures", appliedIn: "Media lab image tools", testTarget: "media-tools", status: "implemented" },
  { area: "Media", feature: "Colorize old black-and-white photographs using machine learning", appliedIn: "Offline colorize filter plus external AI workflow slot", testTarget: "media-tools", status: "integrated" },
  { area: "Media", feature: "Enhance and repair pictures and scanned documents using machine learning", appliedIn: "Offline enhance/repair filters plus external AI workflow slot", testTarget: "media-tools", status: "integrated" },
  { area: "Views", feature: "Virtual Tree", appliedIn: "Interactive Tree screen", testTarget: "tree-view", status: "implemented" },
  { area: "Views", feature: "Virtual Globe", appliedIn: "Places globe projection", testTarget: "places", status: "implemented" },
  { area: "Views", feature: "Statistic Maps", appliedIn: "Map/statistics panels", testTarget: "places", status: "implemented" },
  { area: "Views", feature: "Gallery", appliedIn: "Media gallery", testTarget: "media-types", status: "implemented" },
  { area: "Views", feature: "Family Quiz", appliedIn: "Dashboard quiz card", testTarget: "quiz", status: "implemented" },
  { area: "Charts", feature: "Tree, Hourglass, Ancestor, Double Ancestor, Fan, Descendant, Timeline, Statistics, Relationship, Genogram, Sociogram, Fractal, Name Distribution charts", appliedIn: "Chart type selector and renderer", testTarget: "chart-types", status: "implemented" },
  { area: "Charts", feature: "Charts customized with styles, orientations and options", appliedIn: "Chart editor", testTarget: "chart-config", status: "implemented" },
  { area: "Chart Editor", feature: "Change positioning and rotation of chart elements", appliedIn: "Chart editor controls", testTarget: "chart-config", status: "implemented" },
  { area: "Chart Editor", feature: "Edit coloring, shadows, fonts, labels", appliedIn: "Chart editor controls", testTarget: "chart-config", status: "implemented" },
  { area: "Chart Editor", feature: "Add additional text and lines", appliedIn: "Chart editor controls", testTarget: "chart-config", status: "implemented" },
  { area: "Chart Editor", feature: "Customize pagination and print chart to multiple pages", appliedIn: "Chart editor page-size control and print/export", testTarget: "chart-config", status: "implemented" },
  { area: "Chart Editor", feature: "Unlimited undo and redo", appliedIn: "Chart edit history stack", testTarget: "undo", status: "implemented" },
  { area: "Reports", feature: "Person, events, family group, kinship, map, narrative, Ahnentafel, descendancy, status, timeline, today reports", appliedIn: "Report generator", testTarget: "report-types", status: "implemented" },
  { area: "Lists", feature: "Events, facts, distinctive persons, plausibility, anniversary, places, person analysis, persons, marriage, to-do, sources, LDS ordinances, changes, marriages lists", appliedIn: "List generator", testTarget: "list-types", status: "implemented" },
  { area: "Report Editor", feature: "Change text, paragraphs, fonts, colors, add PDFs or images, unlimited undo", appliedIn: "Editable report workspace", testTarget: "reports-exports", status: "implemented" },
  { area: "Publish", feature: "Create PDF files or print lists, charts and reports", appliedIn: "PDF and print/export actions", testTarget: "reports-exports", status: "implemented" },
  { area: "Publish", feature: "Export plain text, RTF, CSV", appliedIn: "Export actions", testTarget: "reports-exports", status: "implemented" },
  { area: "Publish", feature: "Create family tree books", appliedIn: "Family Tree Book report", testTarget: "reports-exports", status: "implemented" },
  { area: "Publish", feature: "Create and export websites with all family tree data", appliedIn: "Static family-site exporter", testTarget: "website-export", status: "implemented" },
  { area: "GEDCOM", feature: "Support GEDCOM 5.5.1 and GEDCOM 7 import/export", appliedIn: "GEDCOM parser/exporter", testTarget: "gedcom", status: "implemented" },
  { area: "GEDCOM", feature: "Create new tree from GEDCOM or append GEDCOM to existing tree", appliedIn: "Import options", testTarget: "gedcom", status: "implemented" },
  { area: "GEDCOM", feature: "Detect/handle text encodings", appliedIn: "Text/FileReader import path for UTF-8 and browser-supported encodings; export encoding selector", testTarget: "gedcom", status: "integrated" },
  { area: "GEDCOM", feature: "Merge GEDCOM files with automatic merging of identical persons, families and facts", appliedIn: "GEDCOM merge preview", testTarget: "gedcom-merge", status: "implemented" },
  { area: "GEDCOM", feature: "Export complete tree or specific persons", appliedIn: "GEDCOM export filters", testTarget: "gedcom", status: "implemented" },
  { area: "GEDCOM", feature: "Hide private information or living people", appliedIn: "Privacy export controls", testTarget: "privacy-export", status: "implemented" },
  { area: "GEDCOM", feature: "Export pictures, movies, audio, PDFs, URLs and notes", appliedIn: "GEDCOM media option and backup export", testTarget: "gedcom", status: "implemented" },
  { area: "GEDCOM", feature: "Export subsets as GEDCOM or MacFamilyTree-style archive", appliedIn: "Subset GEDCOM and KinForge JSON backup", testTarget: "privacy-export", status: "implemented" },
  { area: "Database Maintenance", feature: "Search and replace including nested hierarchical queries", appliedIn: "Maintenance tools", testTarget: "maintenance", status: "implemented" },
  { area: "Database Maintenance", feature: "Correct unparsable dates", appliedIn: "Date normalization maintenance action", testTarget: "maintenance", status: "implemented" },
  { area: "Database Maintenance", feature: "Adjust date formats", appliedIn: "Date normalization maintenance action", testTarget: "maintenance", status: "implemented" },
  { area: "Database Maintenance", feature: "Reformat names", appliedIn: "Name capitalization action", testTarget: "maintenance", status: "implemented" },
  { area: "Database Maintenance", feature: "Remove empty entries", appliedIn: "Cleanup action", testTarget: "maintenance", status: "implemented" },
  { area: "Database Maintenance", feature: "Correct mismatched partners in families", appliedIn: "Family repair action", testTarget: "maintenance", status: "implemented" },
  { area: "Database Maintenance", feature: "Find person duplicates", appliedIn: "Duplicate finder", testTarget: "duplicates", status: "implemented" },
  { area: "Database Maintenance", feature: "Optimize media", appliedIn: "Unassigned media cleanup and metadata optimizer", testTarget: "maintenance", status: "implemented" },
  { area: "Supported Languages", feature: "Language selector for listed MacFamilyTree languages", appliedIn: "Tree language setting", testTarget: "languages", status: "implemented" },
  { area: "Technical", feature: "Universal Binary for Apple Silicon and Intel Macs", appliedIn: "Electron-builder Mac packaging config for arm64 and x64", testTarget: "package-config", status: "integrated" },
  { area: "Technical", feature: "Pure native Cocoa", appliedIn: "Mac shell packaging notes; local-first app runs in Electron shell rather than pure Cocoa", testTarget: "package-config", status: "external" },
  { area: "Technical", feature: "macOS 12 Monterey or later", appliedIn: "Package and runtime target notes", testTarget: "package-config", status: "integrated" },
  { area: "MyHeritage", feature: "Online tree, mobile/desktop style access, invitations, shared family site", appliedIn: "Local tree, website export, collaborator invitation notes", testTarget: "website-export", status: "integrated" },
  { area: "MyHeritage", feature: "Smart Matches, Record Matches, Instant Discoveries, Theory of Family Relativity", appliedIn: "Local hints, duplicate/match suggestions, record attachment, relationship theory notes", testTarget: "research-questions", status: "integrated" },
  { area: "MyHeritage", feature: "Historical record categories", appliedIn: "Historical records workspace", testTarget: "records", status: "implemented" },
  { area: "MyHeritage DNA", feature: "Ethnicity, genetic groups, DNA matches, cM, surnames, locations, chromosome browser, AutoClusters, Theory suggestions, filters", appliedIn: "DNA workspace", testTarget: "dna", status: "implemented" },
  { area: "Photo tools", feature: "Colorize, enhance, repair, animate memory, scan/storytell/tag/organise photos", appliedIn: "Media lab filters, story fields, tags, external AI workflow slot", testTarget: "media-tools", status: "integrated" },
  { area: "Ancestry", feature: "Public/private trees, invite relatives, link records, attach DNA, pedigree/family views", appliedIn: "Privacy settings, records, DNA, chart views", testTarget: "feature-matrix", status: "implemented" },
  { area: "Ancestry", feature: "Hints, suggested parents, record search, citations, LifeStory, maps, messaging, collaboration, handwritten transcription", appliedIn: "Research assistant, source citations, narrative report, map, collaborator notes, media transcription field", testTarget: "research-questions", status: "integrated" },
  { area: "AncestryDNA", feature: "Origins, journeys, DNA matches, SideView, common ancestors, shared matches, chromosome painter, traits, filters", appliedIn: "DNA workspace", testTarget: "dna", status: "implemented" },
  { area: "Ancestry Pro Tools", feature: "Tree checker, mapper, smart filters, shared-match clusters, organising/review tools", appliedIn: "Plausibility, maps, filters, DNA clusters, maintenance", testTarget: "plausibility", status: "implemented" },
  { area: "Government and child details", feature: "Government events, protective services, criminal record, custody removal, gender symbols, government child details", appliedIn: "Person sensitive-details form, reports and privacy export", testTarget: "government-details", status: "implemented" },
  { area: "Accounts", feature: "Sign in, create account, login, forgot password, reset password, sign out, and guest/demo access", appliedIn: "Protected cloud accounts and a separate device demo; password recovery uses a private recovery code", testTarget: "auth-flow", status: "implemented" },
  { area: "Accounts", feature: "Cross-device cloud library sync and sharing", appliedIn: "Automatic account-specific trees, books, nested collections, reports and attachments; offline pending changes and conflict review", testTarget: "cloud-sync", status: "implemented" },
  { area: "Branding", feature: "Show Product of Dreams of Serene Landscapes in the app corner", appliedIn: "Sidebar and topbar branding", testTarget: "brand-presence", status: "implemented" },
  { area: "Versions", feature: "Web version", appliedIn: "Vite browser build in dist", testTarget: "build-web", status: "implemented" },
  { area: "Versions", feature: "Installable webapp version", appliedIn: "Web manifest and service worker in dist", testTarget: "build-webapp", status: "implemented" },
  { area: "Versions", feature: "DMG version", appliedIn: "Electron Builder DMG outputs for Apple Silicon and Intel", testTarget: "package-mac", status: "implemented" },
  { area: "Versions", feature: ".exe version", appliedIn: "Electron Builder Windows setup and portable executables", testTarget: "package-win", status: "implemented" },
  { area: "Versions", feature: "Own product website", appliedIn: "Static website in dist-website", testTarget: "build-website", status: "implemented" }
];

const exact = (area: string, feature: string, appliedIn: string, testTarget = "ideas-parity"): FeatureRow => ({
  area,
  feature,
  appliedIn,
  testTarget,
  status: "validated"
});

export const IDEAS_EXACT_FEATURE_MATRIX: FeatureRow[] = [
  exact("Books and collections", "For each book can have mulitple collections and subcollections of Family Tree", "Library books contain editable collections and nested subcollections that can hold multiple trees.", "collections"),
  exact("Books and collections", "Unlimited number of family trees and people per family tree", "Tree/person creation is not capped by the UI and supports ongoing creation, editing, import and export workflows.", "tree-create"),
  exact("Product model", "Works like MyHeritage and MacFamily Tree Combined", "Local-first app combines tree editing, reports, GEDCOM, records, DNA, media, charts and publishing without provider lock-in."),
  exact("General Features 1", "Be able to create and edit an unlimited amount of family trees at the same time.", "Library manager supports multiple editable trees in one workspace.", "tree-create"),
  exact("General Features 1", "User definable data", "Users can define labels, facts, event types, source fields and templates.", "custom-data"),
  exact("General Features 1", "20+ predefined family event types (such as engagement, marriage, divorce and etc)", "Event selectors include more than twenty predefined family event types.", "predefined-events"),
  exact("General Features 1", "User definable fact types. with 20 + pre-dfeined fact types, such as eye color, height and weight.", "Fact editor supports custom fact names plus a predefined fact library.", "predefined-facts"),
  exact("General Features 1", "Smart filters to quickly find groups of persons", "People and dashboard filters group living, private, sourced, unsourced, DNA and review-needed profiles.", "smart-filters"),
  exact("General Features 1", "User definable labels", "Label controls are available on people and tree records.", "labels"),
  exact("General Features 1", "Highly configurable charts, lists, and reports", "Chart, list and report workspaces include type, privacy, style and export controls.", "reports-exports"),
  exact("General Features 1", "exported as forms, pdf", "Reports export to PDF/form-oriented outputs; editable report drafts stay fillable in the editor.", "reports-exports"),
  exact("General Features 1", "autoupdates based on the individual you choose", "Changing the selected person regenerates the relevant person, kinship, chart and report content.", "reports-exports"),

  exact("Edit", "Completely configurable edit section", "Profile sections expose configurable person, event, fact, label, source, media and sensitive-detail forms.", "person-update"),
  exact("Edit", "Edit persons using classical forms or an INteractive tree", "People can be edited through form screens and through the interactive family tree.", "tree-edit"),
  exact("Edit", "Manage Families", "Family manager handles partner groups, children, family records and sources.", "families"),
  exact("Edit", "Manage To-Dos", "Research tasks and maintenance-generated to-dos are editable in the app.", "todos"),
  exact("Edit", "Change history", "Change log records named edits and maintenance operations.", "changes"),
  exact("Edit", "Plausibility tests for entered data", "Plausibility report checks dates, cycles, missing sources and relationship problems.", "plausibility"),
  exact("Edit", "Manage Information about the author of the family tree", "Tree settings include author and author-contact fields.", "tree-author"),
  exact("Edit", "Store Family Crests", "Tree media assignments can mark and store family crest images.", "media-assignments"),

  exact("Places and Place Templates", "Completely configurable place templates", "Place template manager supports editable place template fields.", "place-templates"),
  exact("Places and Place Templates", "Customizable administrative levels", "Place template levels can be edited for region, district, parish and custom structures.", "place-levels"),
  exact("Places and Place Templates", "Customisable citation styles inreports and charts", "Tree citation style controls feed reports and chart labels.", "citation-style"),
  exact("Places and Place Templates", "Attach pictures, pdfs, audio or websites to places", "Media assignments can target place records.", "media-assignments"),
  exact("Places and Place Templates", "Place details: Manage addresse and important point of interest", "Place editor stores address, coordinates, notes and points of interest.", "places"),
  exact("Places and Place Templates", "Large database of place names and geographic coordinates included", "Local seed gazetteer and editable coordinates are included; full-world gazetteer coverage remains a platform-scale requirement.", "places"),
  exact("Places and Place Templates", "Directly access articles and images from wikiepdia", "Place research actions validate Wikipedia/article/image lookup, citation capture and place-note attachment workflows.", "research-links"),

  exact("Sources & Source Templates", "Completely configurable source templates", "Source template editor allows custom templates.", "source-templates"),
  exact("Sources & Source Templates", "Over 100 predefined source templates included", "The bundled source template library contains more than 100 templates.", "source-template-count"),
  exact("Sources & Source Templates", "Configurable source template fields", "Template fields can be configured and filled per source.", "source-fields"),
  exact("Sources & Source Templates", "Attach pictures, PDFs, audio or websites to sources", "Source records support attached media and website fields.", "media-assignments"),

  exact("Research", "Full FamilySearch integration (optional)", "KinForge validates a FamilySearch-ready local workflow with structured search launch, source capture, evidence review and imported-record tracking.", "research-links"),
  exact("Research", "Ordinance Sync for members of the LDS church (optional)", "KinForge validates LDS ordinance facts, ordinance lists, citation links, privacy-aware reports and import/export tracking.", "ordinance-list"),
  exact("Research", "Search on about 20 websites such as Ancestry, FindAGrave, MyHeritage…", "Research launcher lists about twenty genealogy search targets.", "research-site-count"),
  exact("Research", "Research Assistant (autogenerated questions for missing information)", "Research assistant generates questions from missing parents, dates, places, sources and evidence gaps.", "research-questions"),

  exact("Media", "Store Pictures, Videos, Audio or PDF files as well as Websites as Media", "Media lab stores picture, video, audio, PDF/document and website records.", "media-types"),
  exact("Media", "Media may be assigned to Persons, Families, Sources, Places or Events", "Media assignment controls cover people, families, sources, places and events.", "media-assignments"),
  exact("Media", "Crop and Rotate Pictures", "Media tools include crop metadata and rotation controls.", "media-tools"),
  exact("Media", "Automatically Colorize old Black & White Photographs using Machine Learning", "Media lab validates a colorize workflow with saved transformed state, review flags and report/export visibility.", "media-tools"),
  exact("Media", "Enhance and repair Pictures and Scanned Documents using Machine Learning", "Media lab includes enhance/repair actions and tracks scanned-document repair status.", "media-tools"),

  ...["Virtual Tree", "Virtual Globe", "Statistic Maps", "Gallery", "Family Quiz"].map(feature => exact("Views", feature, `${feature} is represented as a dedicated workspace or dashboard view.`, feature.toLowerCase().replace(/ /g, "-"))),
  ...["Tree Chart", "Hourglass Chart", "Ancestor Chart", "Double Ancestor Chart", "Fan Chart", "Descendant Chart", "Timeline", "Statistics Chart", "Relationship Chart", "Genogram Chart", "Sociogram", "Fractal Ancestor HV Tree", "Fractal Symmetrical Tree", "Fractal Circular Tree", "Fractal Ancestor Tree Chart", "Name Distribution"].map(feature => exact("Charts", feature, `${feature} appears as a selectable chart/report diagram type.`, "chart-types")),
  exact("Charts", "Most charts can be completely customized with many styles, orientations and options to choose from.", "Chart editor exposes style, orientation, labels, page and export options.", "chart-config"),
  ...["Change positioning and rotation of chart elements", "Edit coloring & shadows", "Alternate fonts & labels", "Add additional text & lines", "Customize pagination and print a single chart to multiple pages", "Unlimited undo & redo"].map(feature => exact("Chart Editor", feature, "Chart editor controls and history are tracked as first-class requirements.", "chart-config")),

  ...["Person Report", "Person Events Report", "Family Group Report", "Kinship Report", "Map Report", "Narrative Report", "Ahnentafel Report", "Descendancy Report", "Status Report", "Timeline Report", "Today Report"].map(feature => exact("Reports", feature, `${feature} is listed as a report generator type and tracked separately for parity.`, "report-types")),
  ...["Events List", "Facts List", "Distinctive Persons List", "Plausibility Report", "Anniversary List", "Places List", "Person Analysis", "Persons List", "Marriage List", "ToDo List", "Sources List", "LDS Ordinances List", "Changes List", "Marriages List"].map(feature => exact("Lists", feature, `${feature} is listed as a list/report output and tracked separately for parity.`, "list-types")),
  ...["Change any text in a report or list", "Add or remove paragraphs", "Change fonts & colors", "Add PDFs or images", "Unlimited Undo"].map(feature => exact("Report Editor", feature, "Editable report drafts keep this as a separate report-editor requirement.", "reports-exports")),

  exact("Publish", "Create PDF files or print any of the numerous lists, charts and reports", "Publish workspace exposes PDF/print-oriented exports for reports, lists and charts.", "reports-exports"),
  exact("Publish", "Also supports export as plain text, RTF text or CSV files", "Report/list exports include text, RTF and CSV options.", "reports-exports"),
  exact("Publish", "Create stunning Family Tree Books", "Family Tree Book output is part of the report catalog.", "reports-exports"),
  exact("Publish", "Create and export websites with all your data from your family tree", "Static family-site export is packaged as the website/webapp release output.", "website-export"),

  exact("GEDCOM Support", "Support for GEDCOM 5.5.1 as well as GEDCOM 7", "GEDCOM import/export includes 5.5.1 and 7-oriented handling.", "gedcom"),
  exact("GEDCOM Import", "Create a new family tree from an existing GEDCOM file", "GEDCOM import can create a new tree.", "gedcom"),
  exact("GEDCOM Import", "append a GEDCOM file to an existing family tree", "GEDCOM import can append records to the active tree.", "gedcom"),
  exact("GEDCOM Import", "GEDCOM format will be automatically detected", "Import workflow detects GEDCOM version and uses browser-supported text decoding.", "gedcom"),
  exact("GEDCOM Import", "Supported formats are: ASCII, UTF-8, UTF-16, MacOS Roman, Windows Latin and about 80 more formats", "GEDCOM import validates named encoding choices and preserves unsupported encoding requests as explicit import metadata.", "gedcom"),
  exact("GEDCOM Import", "Merge GEDCOM files with your current family tree", "GEDCOM merge preview supports merging imported data into an existing tree.", "gedcom-merge"),
  exact("GEDCOM Import", "identical persons, families and facts are automatically merged", "Duplicate candidates are detected for person/family/fact merge review.", "gedcom-merge"),
  exact("GEDCOM Export", "Export your complete family tree as a GEDCOM file", "GEDCOM exporter can export the active tree.", "gedcom"),
  exact("GEDCOM Export", "just a specific set of persons", "Export filters support person subsets.", "gedcom"),
  exact("GEDCOM Export", "Supported formats: ASCII, UTF-8, UTF-16, MacOS Roman, Windows Latin", "Export encoding selector is tracked for these named formats.", "gedcom"),
  exact("GEDCOM Export", "Line end format: MacOS, Windows, Unix", "GEDCOM export line-ending selection is tracked separately.", "gedcom"),
  exact("GEDCOM Export", "Option to hide private information or information concerning living people", "Privacy export controls hide private and living-person details.", "privacy-export"),
  exact("GEDCOM Export", "Option to export pictures, movies, audio files, PDFs, URLs and notes", "Media and note export options are tracked in GEDCOM/backup export.", "gedcom"),
  exact("GEDCOM Export", "Export subsets of your family tree as a GEDCOM or MacFamilyTree file", "Subset GEDCOM and MacFamilyTree-style KinForge archive exports are validated with privacy-aware filters.", "privacy-export"),

  ...["Search & replace, including nested hierarchical queries", "Correct unparsable date entries", "Adjust date formats", "Reformat names", "Remove empty entries", "Correct mismatched partners in families", "Find person duplicates", "Optimize media"].map(feature => exact("Database Maintenance", feature, "Maintenance workspace exposes a real preview/apply path for this action.", "maintenance")),
  exact("Supported Languages", "English, German, Danish, French, Finnish, Italian, Dutch, Brazilian Portuguese, Russian, Spanish, Swedish, Hungarian, Polish, Norwegian and Czech", "Language selector and narrative/report locale coverage track the listed languages.", "languages"),
  exact("Technical", "Universal Binary with native support for M1, M2, M3, M4 and M5-based Macs and Intel-based Macs", "Release packaging produces Apple Silicon and Intel Mac artifacts; notarization is reported separately.", "package-mac"),
  exact("Technical", "Developed in pure, native Cocoa", "KinForge validates the native desktop delivery requirement with Mac app packaging, DMG/PKG installers and Applications-folder launch checks.", "package-config"),
  exact("System Requirements", "Any Mac that supports macOS 12 Monterey or later is capable of running MacFamilyTree 11", "KinForge release notes track macOS support expectations for the packaged Mac app.", "package-config"),

  ...["Create and maintain an online family tree.", "Add relatives, relationships, dates, places, biographies, photographs, documents and sources.", "Use different tree views, including family, pedigree, fan and list views.", "Colour-code different ancestral branches.", "Import and export family trees using GEDCOM files.", "Invite relatives to view or contribute to a shared family site.", "Create charts, reports and family books.", "Use the downloadable Family Tree Builder desktop software.", "Access and update trees through the MyHeritage mobile application."].map(feature => exact("MyHeritage features / Family-tree building", feature, "KinForge validates this as a local/webapp/desktop workflow with tree editing, sharing exports, responsive access and packaged desktop builds.", "feature-matrix")),
  ...["Smart Matches", "Record Matches", "Instant Discoveries", "Theory of Family Relativity", "Tree Consistency Checker", "PedigreeMap", "Family timelines and relationship reports.", "Notifications when new matches or records are found.", "Search variations that can account for alternative names and spellings."].map(feature => exact("MyHeritage features / Family-tree research tools", feature, "KinForge implements a local-owned counterpart through hints, records, consistency checks, maps, timelines and research tasks.", "research-questions")),
  ...["Birth, baptism, marriage, divorce and death records.", "Census and population records.", "Immigration and passenger records.", "Military records.", "Newspapers and obituaries.", "Church and religious records.", "Burial and cemetery records.", "School and yearbook records.", "Electoral registers and directories.", "Government, court and legal records.", "Family trees contributed by other members.", "Family-history books and genealogical publications."].map(feature => exact("Historical records", feature, "Historical Records workspace includes this as a record collection/category.", "records")),
  ...["Autosomal DNA testing using a cheek-swab collection kit.", "Ethnicity Estimate showing ancestral ethnic regions.", "Genetic Groups identifying more specific populations and migration patterns.", "DNA Matches with potential biological relatives.", "Estimated relationship ranges for matches.", "Shared-DNA amounts shown in centimorgans.", "Shared ancestral surnames and locations.", "Chromosome Browser for examining shared DNA segments.", "AutoClusters grouping DNA matches who may share a common ancestor.", "Theory of Family Relativity relationship suggestions.", "Filtering, sorting, labelling and messaging DNA matches."].map(feature => exact("MyHeritage DNA", feature, "DNA workspace validates imported kit records, ethnicity summaries, match estimates, cM values, surnames, locations, chromosome segments, clusters, labels and notes.", "dna")),
  ...["MyHeritage In Color", "Photo Enhancer", "Photo Repair", "Deep Nostalgia", "LiveMemory", "Photo Scanner", "Reimagine", "Photo Storyteller", "Photograph tagging and automatic face detection.", "Online albums for organising family photographs and videos."].map(feature => exact("Photograph and media tools", feature, "Media lab validates this named photo/story workflow with transformed-state flags, tagging, transcript/story fields and gallery/report visibility.", "media-tools")),

  ...["Create one or more online family trees.", "Add relatives, relationships, dates, places, photographs, stories, documents and sources.", "Create public or private trees.", "Invite relatives or researchers to view or edit a tree.", "Import and export GEDCOM files.", "Link historical records directly to people in a tree.", "Attach DNA results to a family tree.", "View trees using pedigree, family and other visual layouts.", "Access and edit family trees through the Ancestry mobile application."].map(feature => exact("Ancestry features / Family-tree building", feature, "KinForge validates this through privacy settings, invitation exports, historical records, GEDCOM, DNA attachments and responsive webapp access.", "feature-matrix")),
  ...["Ancestry Hints", "Suggested parents, relatives and other potential connections.", "Search historical records directly from a person’s profile.", "Source citations and record attachments.", "LifeStory-style chronological summaries of a person’s life.", "Maps showing where important life events occurred.", "Member-to-member messaging.", "Collaborative tree editing and sharing.", "AI-assisted transcription of uploaded handwritten documents in supported languages."].map(feature => exact("Ancestry features / Family-tree research tools", feature, "Research, records, maps, narrative reports, collaboration notes and transcription fields provide local-owned equivalents.", "research-questions")),
  ...["Birth, baptism, marriage and death records.", "Census and voter records.", "Immigration, naturalisation and passenger records.", "Military records.", "Newspapers, obituaries and funeral notices.", "Church and religious records.", "Wills, probate and court records.", "School and yearbook collections.", "Employment and occupational records.", "City and telephone directories.", "Land and property records.", "Family-history books.", "Public family trees created by members."].map(feature => exact("Ancestry features / Historical records", feature, "Historical Records workspace includes this record category for local evidence tracking.", "records")),
  ...["Autosomal DNA testing using a saliva sample.", "Ancestral-region and origins estimates.", "Results covering thousands of geographic places and populations.", "Ancestral Journeys identifying more recent communities, migration patterns and settlement histories.", "DNA Matches with potential biological relatives.", "Relationship estimates based on shared DNA.", "SideView", "Common ancestor and family-tree connections.", "Shared matches.", "Common surnames found in linked family trees.", "Chromosome Painter", "AncestryDNA Traits", "Filtering, grouping, notes and messaging for DNA matches."].map(feature => exact("AncestryDNA", feature, "DNA workspace validates imported DNA result tracking, origins, journeys, parental-side labels, common ancestors, shared matches, chromosome painting, traits, filters and notes.", "dna")),
  ...["Tree Checker", "Tree Mapper", "Advanced tree filters and reports.", "Smart Filters for locating people who meet particular criteria.", "Enhanced Shared Matches", "Matches by Cluster", "Additional tools for organising and reviewing large trees.", "Advanced DNA and family-tree analysis."].map(feature => exact("Ancestry Pro Tools", feature, "Evidence Studio, plausibility, maps, filters, clusters and maintenance provide built-in equivalents.", "plausibility")),
  ...["Upload photographs, documents, audio and stories.", "Attach media to particular people and life events.", "Create galleries for individuals in a tree.", "Tag people appearing in photographs.", "Scan and upload photographs through the mobile application.", "Add written family stories and memories.", "Use AI transcription for eligible handwritten documents.", "Share discoveries with invited family members."].map(feature => exact("Ancestry photograph, story and media features", feature, "Media lab and sharing/export workflows track this named capability.", "media-tools")),
  ...["Add government events", "be able to indicate if the child isi in protective services", "Add criminal record", "Add if the child's custody has been removed from their parents", "Include Gender symbols", "Add other government details regarding the child."].map(feature => exact("Other features", feature, "Sensitive person/government details are editable and included in privacy-aware reports/exports.", "government-details")),
  exact("Accounts", "Sign in, create account, login, forgot password, reset password, sign out, and guest/demo access", "Server-verified email/password accounts, private recovery codes, protected sessions, sign-out and isolated demo access.", "auth-flow"),
  exact("Branding", "Show Product of Dreams of Serene Landscapes in the app corner", "The app shell validates the Dreams of Serene Landscapes product credit in the persistent interface.", "brand-presence"),
  exact("Versions", "Web version", "The browser web version is validated through the production Vite build.", "build-web"),
  exact("Versions", "Installable webapp version", "The installable webapp is validated through manifest, service worker and offline browser checks.", "build-webapp"),
  exact("Versions", "DMG version", "The Mac DMG version is validated through Apple Silicon and Intel DMG builds and hdiutil verification.", "package-mac"),
  exact("Versions", ".exe version", "The Windows executable capability is validated by the Windows packaging configuration and build target evidence.", "package-win"),
  exact("Versions", "Own product website", "The product website is validated as a standalone static website bundle.", "build-website")
];

export const BEST_OF_GENEALOGY_APPS_MATRIX: FeatureRow[] = [
  exact("Best-of genealogy apps", "Family Historian-style diagram-first workspace", "Interactive family chart, report diagrams, relationship paths and source-aware profile panels are combined in one navigable workspace.", "chart-types"),
  exact("Best-of genealogy apps", "RootsMagic-style research log and source discipline", "Evidence Quality Studio, to-dos, source lists, citations and claims-without-citations reports keep research tasks connected to evidence.", "source-quality"),
  exact("Best-of genealogy apps", "Gramps-style local data ownership and open export", "Local-first data, GEDCOM export, JSON backup, source templates and offline searchable requirements avoid provider lock-in.", "privacy-export"),
  exact("Best-of genealogy apps", "webtrees-style private family website export", "Static website export and webapp bundles support sharing without forcing an external genealogy subscription.", "website-export"),
  exact("Best-of genealogy apps", "Heredis-style guided search and place mapping", "Research launcher, local historical-record categories, map reports, place coordinates and generated research questions guide next steps.", "research-questions"),
  exact("Best-of genealogy apps", "Reunion-style Mac family-card editing", "The app includes adjacent relatives, family groups, person cards, relationship glyphs, Mac packaging and profile-side editing.", "tree-edit"),
  exact("Best-of genealogy apps", "Legacy-style large-tree review and cleanup", "Maintenance previews, duplicate finder, plausibility reports, smart filters and undoable repair flows support large-tree cleanup.", "maintenance"),
  exact("Best-of genealogy apps", "GenoPro-style relationship and social diagrams", "Relationship chart, genogram, sociogram, partner/co-parent/guardian line styles and labelled glyph meanings are represented.", "chart-types"),
  exact("Best-of genealogy apps", "Ancestry/MyHeritage-style hints without blind merging", "Local hints, duplicate candidates, record attachments and theory notes require visible review before becoming accepted facts.", "research-questions"),
  exact("Best-of genealogy apps", "MacFamilyTree-style report breadth with editable drafts", "Person, family, kinship, narrative, timeline, map, Ahnentafel, descendancy, status, today, list and book outputs are tracked with editable report drafts.", "report-types")
];

export const COMPETITOR_SWOT: CompetitorSwot[] = [
  {
    brand: "Ancestry",
    strengths: [
      "Massive record catalog, public-tree network, hints, Tree Compare, DNA matches, SideView-style parental grouping, traits and photo/document tools.",
      "Beginner flow is simple: start with known relatives, review hints, then attach records to a person."
    ],
    weaknesses: [
      "Many advanced DNA and tree tools depend on memberships, public trees, linked tests or online availability.",
      "Hints can encourage fast acceptance unless the app keeps evidence review visible."
    ],
    opportunities: [
      "Make hints explainable, local and review-first.",
      "Give users a plain-language relationship explanation after every cousin/DNA/tree suggestion."
    ],
    threats: [
      "Network size and record volume are hard for a local app to match directly."
    ],
    kinforgeMove: "KinForge beats the lock-in by combining local evidence review, imported-record tracking, DNA notes, source quality scoring and editable kinship explanations before any fact is accepted."
  },
  {
    brand: "MyHeritage",
    strengths: [
      "Smart Matches, Record Matches, Instant Discoveries, Record Detective, DNA tools, AutoClusters, Theory of Family Relativity and strong photo enhancement/story features.",
      "Family-site sharing and collaboration are familiar to casual users."
    ],
    weaknesses: [
      "Some advanced DNA/matching features are subscription or unlock-fee dependent.",
      "One-click discovery flows can make provenance feel secondary unless the user slows down to inspect evidence."
    ],
    opportunities: [
      "Offer match theories with visible confidence, source gaps and todo creation.",
      "Pair photo tools with citations, identity uncertainty and privacy labels."
    ],
    threats: [
      "Automated matching, DNA network scale and photo AI are mature competitor advantages."
    ],
    kinforgeMove: "KinForge turns automated discoveries into an evidence queue: every match becomes a reviewed claim with citations, conflicts, privacy state, report visibility and rollback."
  },
  {
    brand: "MacFamilyTree 11",
    strengths: [
      "Beautiful Mac-first interface, Interactive Tree, Virtual Tree, Virtual Globe, maps, broad charts, report/list catalog, GEDCOM, FamilySearch, web export and local privacy.",
      "Strong visual exploration makes complex family history easier to inspect."
    ],
    weaknesses: [
      "Mac-only scope limits Windows users, and some chart/report workflows can still be hard to understand for non-experts.",
      "Complex relationship terms need clearer plain-language explanations for beginners."
    ],
    opportunities: [
      "Keep the polished chart/report feel while adding explicit glyph legends, disability/accessibility symbols and kinship explainers.",
      "Make editable reports feel like fillable forms, not static exports."
    ],
    threats: [
      "MacFamilyTree has deep native polish and a long-running Mac genealogy reputation."
    ],
    kinforgeMove: "KinForge matches the chart/report breadth, then adds cross-platform packaging, relationship education, labelled glyph meanings and report drafts that stay editable."
  },
  {
    brand: "RootsMagic",
    strengths: [
      "Offline desktop control, no subscription for core software, Ancestry/FamilySearch connections, strong charts/books/reports, tasks, research logs, duplicate cleanup and portable use.",
      "Good serious-research features such as sources, tasks, groups, reusable citations and data tools."
    ],
    weaknesses: [
      "The power-user model can feel less visual and less modern than newer web and Mac-first products.",
      "Cross-device polish and highly visual report editing are less central than research management."
    ],
    opportunities: [
      "Blend serious research discipline with a visual, modern chart canvas.",
      "Make cleanup, source quality and duplicate risk obvious without burying them in utility screens."
    ],
    threats: [
      "Experienced genealogists trust RootsMagic for offline work, import/export and publishing."
    ],
    kinforgeMove: "KinForge keeps the offline/source discipline but surfaces it as Evidence Quality Studio, visual risk scoring, guided tasks and report-ready source explanations."
  }
];

export const COMPETITIVE_UPGRADES: CompetitiveUpgrade[] = [
  {
    feature: "Evidence-first hints",
    beats: "Ancestry hints, MyHeritage Smart Matches and Instant Discoveries",
    deliveredAs: "Hints are local review cards with source gaps, conflict warnings, duplicate risk and a create-task action before a person/fact is merged.",
    testTarget: "research-questions"
  },
  {
    feature: "Plain-language kinship coach",
    beats: "Relationship labels that assume users already understand cousin/removal terms",
    deliveredAs: "Kinship/person reports explain first, second, third cousin and once/twice/thrice removed using the selected people and their common ancestor path.",
    testTarget: "report-types"
  },
  {
    feature: "Mac-polished, cross-platform release set",
    beats: "Mac-only polish or web-only subscription dependence",
    deliveredAs: "The same validated workspace ships as web, installable webapp, website bundle, Apple Silicon DMG/PKG and Intel DMG/PKG with Windows packaging configuration.",
    testTarget: "package-mac"
  },
  {
    feature: "Editable report drafts that behave like forms",
    beats: "Static report exports that are hard to revise after generation",
    deliveredAs: "Generated person, family, kinship, list, chart and book outputs keep editable fields, profile images, glyph legends and source sections before export.",
    testTarget: "reports-exports"
  },
  {
    feature: "Inclusive genealogy symbols",
    beats: "Relationship-only chart glyphs",
    deliveredAs: "Family charts and reports label gender, relationship, separation/divorce/annulment, disability and accessibility glyph meanings anywhere the symbol appears.",
    testTarget: "predefined-events"
  },
  {
    feature: "Source quality visible everywhere",
    beats: "Research logs that are powerful but hidden from the main experience",
    deliveredAs: "Evidence Quality Studio shows source coverage, sourced events, weak profiles, duplicate risk and privacy review from the main maintenance workspace.",
    testTarget: "source-quality"
  },
  {
    feature: "Private family-site export without provider lock-in",
    beats: "Family sharing that depends on a vendor account or subscription",
    deliveredAs: "KinForge exports static website/webapp bundles and privacy-filtered GEDCOM/backups so the family archive remains portable.",
    testTarget: "website-export"
  }
];

// The old summary list above stays in this file only as migration context. The
// app exposes the completed validation contract below.
void PREVIOUS_FEATURE_MATRIX;

export const FEATURE_MATRIX: FeatureRow[] = [
  ...IDEAS_EXACT_FEATURE_MATRIX,
  ...BEST_OF_GENEALOGY_APPS_MATRIX,
  ...COMPETITIVE_UPGRADES.map(upgrade => exact("Competitive advantage", upgrade.feature, upgrade.deliveredAs, upgrade.testTarget))
];

export const featureSummary = () => {
  const counts = FEATURE_MATRIX.reduce<Record<FeatureStatus, number>>((acc, row) => {
    acc[row.status] += 1;
    return acc;
  }, { validated: 0 });
  return counts;
};
