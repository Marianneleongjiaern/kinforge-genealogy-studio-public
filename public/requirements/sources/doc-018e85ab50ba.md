# KinForge: Siblings and Generation Layout

Requested 23 September 2026. Implemented in the 1.1.3 development preview's dynamic Family Tree workspace.

## Family Group Follow-Up

"IT should be grouped by family, so meaning if this child has children, and a husband, then the descendatns and children should branch out from the line that connects the couple to below, the word sibling or spouse, or etc, shouldn't be in the middle of both people cards, and should not be the thing connecting both individuals, it should be a line, however, I also want there to be a legend  to show what each line represents"

The user's latest message requests a visible legend, superseding the preceding request for a QR code. No QR code or external legend service is needed.

- Group each sibling with their own spouse or partner, including when the partner was entered later.
- Join a couple with a line, and branch their recorded shared children downward from a junction on that line.
- Use one child bar for siblings who have the same recorded parent set, with individual stems to their cards.
- Apply the same structure recursively to subsequent generations.
- Do not place relationship words between the person cards. Accessible descriptions remain available to assistive technology, and the inspector retains relationship names.
- Keep a visible legend outside the chart so it does not cover people or connectors. Show line samples for spouses, partners, parents and children, separately recorded siblings, co-parents without a recorded union, and guardianship.
- Reflect explicitly stored separation, divorce and annulment statuses with marks on the union line and matching legend entries. Do not infer these statuses from other facts.
- Preserve single-parent and half-sibling records. A spouse or partner is not automatically a recorded parent.
- Provide Spouse and Other parent choices in Add relative. Creating a child with two selected parents is one undoable action.
- Recalculate connections after adding or unlinking relationships, moving cards, undoing, redoing or reloading. No external service is used.

Tests are in src/familyLines.test.ts, src/treeGraph.test.ts, tests/browser/generations.spec.ts and tests/native-smoke.mjs. Browser checks include separate sibling couples, shared child bars, single-parent preservation, two-parent creation and undo/redo, visible legend entries, no edge text labels, connector/card intersections, mobile layout and persistence.

## Exact Request

Latest centring clarification: "So when the line comes down, it's supposed to be centre, and then branch out, into different branches on the left or right, so branch out on the left or on the right, if there is more than one children connected to the parents"

- The downward stem meets the centre of the children's horizontal branch, midway between its outermost child connections.
- Two children branch left and right from that central stem. Three children can have left, centre and right stems.
- In the ordinary shared-parent layout, the stem drops straight from the couple midpoint to this centred branch.
- Solve card positions and branch centres together, including mixed-parent families and moved cards. Do not use a sideways elbow as the normal solution to an offset. This supersedes the earlier intermediate elbow workaround.
- The screenshot clarification is the regression baseline: "If there is two children, the line should be at the centre, so one on the right or on the left, that's why it's called da family tree as it looks like a tree, you can see the offests in this image".
- Recreate all eleven people and fourteen relationships in that example. June and Taylor's midpoint must align with Lee and Lou's midpoint; Kai must align below June, Kit below Lee, and Sam below Robin and Morgan's midpoint. Do not invent missing parentage to obtain this layout.
- Check the rendered paths and node coordinates for two-child, three-child, mixed-parent and moved-card arrangements; keep the same behaviour in the Mac build.

"IF the relatives are siblings, it should look like next to each other, if they are descendatns, and children, the children, and descendants, should go below the previous generation"

## Layout Rules

- Explicitly recorded siblings sit alongside one another on the same horizontal row, including when their parents have not been entered.
- Children who share a recorded parent, including half siblings, are grouped on the same row.
- Children appear below their parents; grandchildren and further descendants continue downward by generation.
- Shorter branches and cousins retain their generation rather than being pushed down to the lowest descendant row.
- Partners remain together when this does not contradict recorded ancestry. Parent-child direction takes precedence over impossible or cross-generation partner alignment.
- A sibling who is also a guardian remains in the sibling generation. A guardianship link does not invent biological parentage.
- Dragging permits horizontal positioning while preserving generation rows and making room between cards.
- Saved arrangements cannot restore incorrect vertical positions. Older layout caches, or caches for a different relationship structure, are recalculated; person records and relationships are not changed.
- Arrange tree restores the relationship-based layout. The same generation constraints apply on desktop and mobile.

## Evidence and Limits

The implementation retains Dagre for graph ordering and uses a bundled, offline Cassowary solver for simultaneous family centring, card separation and generation constraints. It does not infer or save missing parent relationships merely to align siblings. Impossible imported arrangements retain non-overlapping cards and may need a connector bend; valid tested families have straight centred stems.

Tests are in src/treeGraph.test.ts, tests/browser/generations.spec.ts and tests/native-smoke.mjs. They check explicit siblings, shared-parent siblings, half siblings, uneven branches, cousins, guardian siblings, overlapping cards, saved positions, ancestor insertion and package execution.

Contradictory imported ancestry cannot satisfy every visual relationship simultaneously. The layout avoids collapsing known ancestor-descendant paths into one row and remains renderable; resolving incorrect source records is separate work. This update does not complete the separate named chart/report formats or other outstanding product requirements.

## Person Card Labels

"The relationship type label names, should not be shown on the line but should be shown on the person's info card"

- Display each person's recorded roles on their tree card: Parent, Child, Spouse, Partner, Sibling, Guardian and Ward as applicable. Preserve their existing profile tag.
- Use the correct direction for parent/child and guardian/ward. Do not infer marital status or parentage from another person's records.
- Show the full named relationships and recorded status in the selected person's info pane. Card hover and accessible descriptions also identify the related person.
- Keep cards at stable dimensions with room for two lines of role names. Retain all roles in ancestor/descendant views even when the related person is outside the view.
- Update roles after linking, unlinking, undo and reload. Keep connectors text-free and the separate legend visible.

## Correction Workflow

Latest request: "Can you fix the offset of the branches, and based of your workflow MD file that you have correct it."

Use this layout baseline alongside MacFamilyTree-Feature-Walkthrough.md's acceptance principles: distinct record and presentation changes, correct selected-person context, working controls, and desktop/mobile layouts without overlaps. Earlier walkthrough observations are reference material, not a new live walkthrough.

1. Reproduce the eleven-person screenshot with the original recorded parent sets.
2. Centre card groups structurally and preserve generation rows, spacing and factual records.
3. Verify every family junction against its child-bar midpoint, not just the simplest two-child example.
4. Exercise dragging, saving, reopening and Arrange tree; recheck the same geometry.
5. Check desktop/mobile screenshots, connector/card intersections and relationship-label placement.
6. Run focused and full regression tests, build the preview, and distinguish browser verification from any separately tested packaged Mac release.

Regression files: src/treeCentering.test.ts, src/personRelationships.test.ts, tests/browser/generations.spec.ts and tests/native-smoke.mjs. The existence of a test is not a claim that it has passed on every release surface.
