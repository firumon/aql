# 3-Layer UI — Content, Lists & the View Blueprint

> Part of **[3-Layer UI — Resource UI Module Developer Guide](UI_MODULE_DEVELOPER_GUIDE.md)**. ListViews and the View card blueprint.

---

## 7. Content: Lists, Rows, and the View Blueprint

The framework List content uses `useListView` with ListSwitcher on the same page.
The [ListViews guide](UI_LIST_SWITCHER.md) describes sheet settings and the data flow.

### 7.1 Named views and overrides

Each view can choose source rules, row stages, presentation, actions, a click target, and permissions.
Use the [core guide](UI_LIST_SWITCHER_COMPONENTS.md#45-override-lookup) for override paths and exports.

### Resource list rules

For every resource, use its Layer 2 Data files for shared facts and resource list behavior:

- Choose one row source for each list. Use `useData` when the rows are this resource's own records, decorated with calculated facts. Use a focused `use<Family>Data` when rows need another resource or form a shared cross-resource summary.
- `useList` owns row membership across all UIs for that resource. Its default rule is the shared baseline, such as active rows when the resource uses Status. Named rules hold fixed list purposes, such as Completed always meaning Progress = COMPLETED.
- Keep all resource list filters out of `APP.Resources.ListViews`. The sheet names views and sets labels, icons, colors, and the default view.
- A list that must include rows outside the shared baseline needs a clear bypass.
- `useList` applies the list's own rules to the chosen source. Keep shared calculations in that source; keep screen labels, captions, chips, colors, and other display in item settings or a display override.
- When list rows use related resources, put the filter, grouping, and row projection in a focused Layer 2 family data composable. Read each source through its own Layer 2 Data or domain API. Then let the resource's `useList` rule select that row set. For example, `useOutletConsumptionQueueData.js` can provide the shared outlet summary for invoiceable lists. Do not rebuild a source resource's rules or put the projection in `List<Name>.vue`.

Before writing a view seed, check the final rows and their field names and values. Build the
seed's display settings from those fields. If several lists need the same grouped or changed
rows, prepare that shared data first and let each list use it.

**Current engine limit:** A ready per-view `Data` override replaces source rules. Otherwise, the resolver chooses a named rule or the default; it does not run both. It must choose the row source, run the common default, then the named purpose rule. It must apply the common rule to override rows too, with a bypass for lists outside the baseline. Until then, named rules and `Data` overrides must apply the common rule themselves. The [core guide](UI_LIST_SWITCHER_COMPONENTS.md#43-data-source-and-source-rules) records this limit.

### 7.2 Row presentation

The active view supplies AppList props through `useListView`. Use `view.item` and display overrides
for layout, labels, captions, meta, icon, color, and highlight. Use `paginate`, `perPage`,
`threshold`, or a Props override for view-wide props. See the [item guide](UI_LIST_VIEWS_ITEMS.md).

Show the facts a person needs to understand a row. Choose the order with `view.order`.
Use a real ownership field and `$userCode` for personal queues. A list filter is not an access check.
Keep row getters intact when preparing fields.

### 7.3 Row actions

The List mounts inline `AdditionalActionsButtons`. `view.actions` and `list{Name}Actions.js`
select the supported action props. The action system owns permission, visibility, and dispatch.
The view's Target selects row navigation after a destination access check.
See [row actions and Target](UI_LIST_VIEWS_ITEMS.md#9-inline-actions-and-row-navigation).

### 7.4 The View Blueprint — Business-Concept Card Grouping

`contents/ViewRecord.vue` — a generic key-value grid over every header, extensible per
column via `ViewColumn<Col>` — is the right default for a simple, mostly-flat resource. It
stops being the right tool the moment a resource's data has real relational shape: line
items, allocations, a workflow history. Forcing that shape into a flat key-value grid reads
as a data dump instead of a summary.

The alternative: **replace `ViewRecord` outright with custom cards, one per business
concept**, using the base-promotion path (§3.2 step 1.3).

**Applying the blueprint to a new module:**

1. Does the resource have line items, allocations, multi-step workflow, or more than one
   *kind* of related fact (not just more columns)? If not, stay on `ViewRecord` +
   `ViewColumn<Col>` overrides — less code, stays in sync with the schema automatically.
2. If yes, name one card per business concept the record represents. Do not create a card
   that is just "the rest of the columns."
3. Back every card with one page-scoped UI Composable (§6.2), never per-card ad-hoc
   computeds.
4. Build every card on the shared shell (§10.1) and the authoring contract in §7.5.

**Canonical View Card Stacking Order:**

```
1. Action Request Banner   (RevisionRequiredBanner — instruction, only rendered when action is needed)
2. Parent Identity Card    (RestockHeader — who, what, when, current state)
3. Content Summary Card    (Items — what was requested / entered)
4. Operational Breakdown   (AllocationDetails — source bins, where stock is coming from / going)
5. Workflow History Card   (Workflow — chronological timeline of actual events)
```

**One composable, so cards cannot disagree.** All cards inject the same page-scoped UI
Composable, which calls the resource's domain composable (§4) for any derived state, and
read *projections* of one derived tree rather than each re-deriving grouping logic. Two
cards reading the identical derived structure means "what was requested" and "where it's
coming from" can never drift apart on screen.

Four rules the recurring cards each carry:

- **The identity card drops blank rows rather than padding them with em dashes.** A
  detail card reads better short, and a `Note: —` row states nothing while looking like it
  does. The two facts that *identify* the record are shown even when unresolved.
- **The disposition card morphs by phase and explains empty phases.** Before a workflow
  commits anything, there is no source behind any line — the card states each line's position
  and says, in one banner ("Stock is allocated once approved"), when the source will exist.
  After approval, it swaps to detailed warehouse and storage bin rows. The phase test is a
  domain predicate, never a raw `Progress` comparison written in the card.
- **The history timeline is chronological event history, not a checklist.** Order by the
  recorded timestamp (`...At`), not by canonical state order, so a record that went out for
  revision and came back reads in the order it actually happened. Stages never reached are
  **absent, not greyed out.** Which column holds which stamp is a map in the page composable,
  because a stamp prefix and its resulting state genuinely differ (submitting stamps
  `ProgressSubmitted*` but moves the record to `PENDING_APPROVAL`).
- **Pass container gutter tokens to nested section cards.** Compound cards that render
  internal product cards must accept `gutter` from `pageProps.gutter` and space their
  internal children consistently with the outer page rhythm (§5.2).

**Where View cards go in the contract.** A business-concept card set is declared in
`sections`, with `contents: []` — the second named exception to §9.1's
sections-are-not-record-dependent rule, alongside header-adjacent metrics. The trade is
explicit: `sections` render outside `<AqlContentWrapper>`, so **each card self-guards its
own loading, empty and missing-record states** (§10.4) instead of inheriting the wrapper's.
That is why the shared page composable exposes `pending` — every card reads it.

**Order the stack by what the reader must do.** A card that asks for an action leads; cards
that report one follow. A card that renders nothing in most states costs nothing at the top
(§10.4's `v-if` rule), and putting the one instruction on the page below three summaries
buries it.

**That leading card is the one place a page may break the neutral shell.** Exactly one card
per page may carry the UI's accent tint and rail (`accentCardClass` / `accentBorderStyle`,
§10.3), and only the one that asks for an action rather than reporting one — the page is
otherwise uniformly neutral, which is what makes the colour mean something. Two accented
cards on one page means neither is emphasised, and an accented card that merely *reports*
spends the page's only emphasis on a statement. It still uses the standard row grammar and
stagger; only the tint differs, so it reads as emphasis rather than as a differently-built
card.

### 7.5 Custom card authoring contract

Every custom Section/Content card a module adds exposes the same surface, so a later tier
can retitle, retint or re-feed it without a `.vue` override:

```javascript
const props = defineProps({
  // Function-capable, resolved through evaluateProp — a modifier may make it
  // read off the record.
  title:   { type: [String, Function], default: 'Allocation Details' },
  // The tree to render. Defaults to the composable's own projection; supplied
  // only when a caller renders this card against something else.
  items:   { type: Array,  default: null },
  // Horizontal inset (§10.2). Vertical rhythm is the container's.
  padding: { type: String, default: 'sm' },
  // Rhythm BETWEEN this card's own children, when it renders several.
  gutter:  { type: String, default: 'xs' },

  // ── Optional, only when the card needs them ──────────────────────────────
  // The record to render against. Defaults to the injected one; supplied when a
  // caller renders this card for something other than the page's own record.
  record:  { type: Object, default: null },
  // Overrides a state-derived tint. Function-capable: (record, config) => 'positive'.
  color:   { type: [String, Function], default: null }
})
```

Those six are the whole surface. A card needing something outside it is either doing two
jobs or reaching for state its composable should be handing it — check both before adding a
seventh prop.

- **Heading**: `SectionDividerLabel` with the resolved title, so a stack of cards is
  scannable by heading alone.
- **`items` defaulting to `null`, not `[]`**: `null` means "use my own projection", `[]`
  means "a caller handed me nothing" — collapsing them makes the card un-narrowable.
- A card that renders **siblings inside itself** takes `gutter` explicitly from the page
  contract, because `.aql-page-body`'s gutter reaches the *section*, never its children.

**One step is not one card. Scope decides the split:** a control acting on **every row** on
the page gets its own card above them; a control acting on **one row** lives in that row's
card. A select-all, an auto-fill, a running "N of M" total and the setting that determines
what the rows even contain each act on the whole set, so each sits in a card of its own,
ahead of the list — putting them inside the first item's card says they belong to that item.
A step legitimately renders three cards when it asks three differently-scoped questions.

### 7.6 Form and field overrides

Within `Create`/`Update`, three further hierarchies resolve **only** under `_ui/` (no
framework fallback): `FormChild<ChildName>` (one child block), `FormRecord` (the primary
form), `FormField<Header>` (one column's control).

Field **visibility** follows a strict precedence chain — `showFields` > `hideFields` >
`workflowFields` — and `fields` fixes both the set and the order (§13.3).

---


---

⬑ Back to **[3-Layer UI — Resource UI Module Developer Guide](UI_MODULE_DEVELOPER_GUIDE.md)**.
