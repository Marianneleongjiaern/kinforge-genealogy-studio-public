import { useEffect, useRef } from "react";
import { matchPath, useLocation, useNavigate } from "react-router-dom";
import { AppState } from "./domain";

export const WORKSPACE_VIEWS = [
  "tree", "my-family-tree", "photos", "import-gedcom", "manage-trees", "print-books", "infographics", "consistency", "timeline", "pedigree-map", "relationship-report", "sources", "backup",
  "people", "families", "dashboard", "library", "places", "research", "kinforge-ai", "ai", "translator-ai", "helpdesk-ai", "contact", "support", "private-access", "media", "glyphs", "accessibility", "ideas", "charts", "reports", "publish", "dna", "maintenance", "strategy", "coverage"
] as const;
export type ViewKey = typeof WORKSPACE_VIEWS[number];
export type WorkspaceRoute = { treeId: string; view: ViewKey; personId?: string; tab?: string };
export const PROFILE_TABS = ["overview", "edit", "timeline", "access", "sources", "media"] as const;

export function workspacePath(route: WorkspaceRoute) {
  const parts = ["trees", route.treeId || "library", route.view];
  if (route.personId) parts.push(route.personId);
  if (route.personId && route.view === "people") parts.push(route.tab || "overview");
  return "/" + parts.map(encodeURIComponent).join("/");
}

export function resolveWorkspaceRoute(path: string, state: AppState): WorkspaceRoute {
  const params = matchPath("/trees/:treeId/:view/:personId?/:tab?", path)?.params;
  const treeId = state.trees.find(tree => tree.id === params?.treeId)?.id ?? state.trees[0]?.id ?? "";
  const view = WORKSPACE_VIEWS.includes(params?.view as ViewKey) ? params!.view as ViewKey : "tree";
  const personId = state.people.find(person => person.id === params?.personId && person.treeId === treeId)?.id;
  const tab = PROFILE_TABS.includes(params?.tab as typeof PROFILE_TABS[number]) ? params?.tab : "overview";
  return { treeId, view, personId, tab: view === "people" && personId ? tab : undefined };
}

export function useWorkspaceNavigation(state: AppState) {
  const location = useLocation();
  const navigate = useNavigate();
  const route = resolveWorkspaceRoute(location.pathname, state);
  const active = useRef(route);
  active.current = route;
  const path = workspacePath(route);
  useEffect(() => {
    if (state.trees.length && location.pathname !== path) navigate(path, { replace: true });
  }, [path, location.pathname, navigate, state.trees.length]);
  useEffect(() => { window.scrollTo(0, 0); }, [route.view, route.treeId, route.tab]);

  const go = (next: WorkspaceRoute) => {
    active.current = next;
    navigate(workspacePath(next));
  };
  return {
    route,
    go,
    setView: (view: ViewKey) => go({ ...active.current, view, personId: view === "people" ? undefined : active.current.personId, tab: undefined }),
    setSelectedPersonId: (personId: string) => go({ ...active.current, personId }),
    setSelectedTreeId: (treeId: string) => go({ treeId, view: "tree" }),
    openPerson: (personId: string, tab = "overview") => go({ treeId: active.current.treeId, view: "people", personId, tab })
  };
}
