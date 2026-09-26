import { Edge, EdgeProps } from "@xyflow/react";
import { FamilyLine, LINE_STYLES, LineKind, UNION_STATUS_LABELS, UnionStatus, statusMark } from "./familyLines";

export type FamilyEdge = Edge<{ line: FamilyLine }, "family">;

export function FamilyConnection({ data }: EdgeProps<FamilyEdge>) {
  if (!data) return null;
  const line = data.line;
  return <g className="family-connection" data-line-id={line.id} data-parents={JSON.stringify(line.parentIds)} data-children={JSON.stringify(line.childIds)} data-junction={line.junction ? JSON.stringify(line.junction) : undefined} data-fork={line.fork ? JSON.stringify(line.fork) : undefined}>
    <title>{line.description}</title>
    {line.paths.map(({ kind, d }, index) => <g key={index} data-line-kind={kind}>
      <path d={d} fill="none" stroke="#f8fafb" strokeWidth={6} />
      <path className="react-flow__edge-path" d={d} style={{ fill: "none", stroke: LINE_STYLES[kind].color, strokeWidth: 1.8, strokeDasharray: LINE_STYLES[kind].dash }} />
    </g>)}
    {line.childIds.length > 0 && line.junction && <circle cx={line.junction.x} cy={line.junction.y} r={2.6} fill={LINE_STYLES.descent.color} />}
    {line.status && ["separated", "divorced", "annulled"].includes(line.status) && line.junction && <path d={statusMark(line.status, line.junction)} fill="none" stroke={LINE_STYLES[line.status].color} strokeWidth={2} />}
  </g>;
}

export function RelationshipLegend({ statuses }: { statuses: UnionStatus[] }) {
  return <section className="chart-legend" aria-labelledby="relationship-legend-title">
    <h3 id="relationship-legend-title">Legend</h3>
    <ul>
      {(Object.keys(LINE_STYLES) as LineKind[]).map(kind => <li key={kind} data-legend-kind={kind}>
        <svg viewBox="0 0 64 28" width="48" height="24" aria-hidden="true"><path d={LINE_STYLES[kind].sample} fill="none" stroke={LINE_STYLES[kind].color} strokeWidth={2} strokeDasharray={LINE_STYLES[kind].dash} /></svg>
        <span>{LINE_STYLES[kind].label}</span>
      </li>)}
      {[...new Set(statuses)].filter(status => ["separated", "divorced", "annulled"].includes(status)).map(status => <li key={`mark-${status}`} data-legend-kind={`${status}-mark`}>
        <svg viewBox="0 0 64 28" width="48" height="24" aria-hidden="true"><path d={`M4 14 H60 ${statusMark(status, { x: 32, y: 14 })}`} fill="none" stroke={LINE_STYLES[status].color} strokeWidth={2} strokeDasharray={LINE_STYLES[status].dash} /></svg>
        <span>{UNION_STATUS_LABELS[status]}</span>
      </li>)}
    </ul>
  </section>;
}
