# 3-Layer UI — The Index Page & Operational Metrics

> Part of **[3-Layer UI — Resource UI Module Developer Guide](UI_MODULE_DEVELOPER_GUIDE.md)**. The 4-stage Index hierarchy, the widgets, the work-queue switcher and dynamic lists.

---

## 9. Index Page & Operational Metrics

An Index page is a **worklist**, not a report. Users visit an Index page to handle tasks,
clear backlogs, and review live progress. It answers "what does the signed-in user need to
act on right now" — never "how did this resource trend last quarter." That second question
belongs on the main system dashboard, which aggregates across resources and time.

> [!IMPORTANT]
> **Scope rule.** An Index widget may only summarize records the current user owns or is
> upline for, in **live/open states** — pending queues, today's schedule, in-flight
> workflow. It must never summarize **all-time totals**, **terminal states** (delivered,
> rejected, cancelled) as a running count, or **calendar-aggregated** figures (this month's
> volume). A widget that needs "since X date" to make sense is a dashboard chart, not an
> Index widget.

### 9.1 Sections vs. Contents & The 4-Stage Index Hierarchy

| | `sections` | `contents` |
|---|---|---|
| Scope | **Resource-level / configuration-level.** Operates on resource metadata/config, not an active record instance — page header, static controls, filters. | **Record-dependent.** Operates on `records` (a list) or a single `record` — data lists, detail views. |
| Rendered | Directly inside `.aql-page-body`, outside `<AqlContentWrapper>` | Inside `<AqlContentWrapper>` — loading/empty/missing-record/submission overlay handled automatically |
| Gating | None — must self-guard | Automatic |

**The 4-Stage Index Section Ordering Formula:**
Stack Index sections by descending operational urgency:

```
1. Top / Immediate Action   (MetricCards — what needs my action right now)
2. Middle / Pipeline Health (LinearProgress, WorkflowFunnel — fulfillment rate and moving stage counts)
3. Lower / Backlog Risk     (AgeingBuckets — how long have items sat in bottleneck queues, approver-gated)
4. Bottom / Work Execution  (FilterInput, ListSwitcher, List — the actual work queue items)
```

Every widget section hides itself (`return []`) when it has nothing to report, so a fresh
tenant or a clear backlog presents a clean list rather than a wall of empty zeroes.

### 9.2 Index widgets

An Index widget is any **framework base Section** driven by a resource-specific JS modifier
(§3.3) that supplies `items` as a function-valued prop reading the resource's domain layer
(§4) for live/open-state data. The pattern is open, not a fixed catalogue: whatever queue,
ratio, pipeline or time-based reading a resource's workflow actually needs is a valid
widget, built the same way — find or add a generic base under `src/components/sections/`,
then drive it with a resource-specific modifier. A widget type that doesn't exist yet is
added as a new **generic** section (reusable by any future resource), never a bespoke
component private to one module.

**The bases already available — `MetricCards`, `LinearProgress`, `WorkflowFunnel`,
`AgeingBuckets`, `FilterInput`, `ListSwitcher` — are catalogued with their full prop
surfaces and hide rules in
[`components/REGISTRY.md`](file:///f:/AQL/FRONTENT/src/components/REGISTRY.md).**
Read that before adding a widget; read it before inventing a base.

Five rules bind every widget, whichever base it drives:

**1. `items` is function-valued.** A JS modifier is invoked once, at resolve time, and its
return is cached. A plain array freezes at whatever the store held on that first tick —
usually empty, since a page resolves its sections before the fetch settles.

**2. Return `[]` when there is nothing to say.** Every widget base has a strict hide rule
and removes itself from the page entirely on an empty `items`. A 0% bar on a workflow that
has not started is a false alarm, not information; a wall of zeroes on a fresh tenant reads
as a broken page. Never zero-fill to keep a widget on screen.

The guard is **all-or-nothing across the whole widget**, and it is the widget's own last
statement before the `return`. A `MetricCards` hides only when *every* card it would render
is zero; a single live figure keeps the whole set on screen, and the zeroes beside it are
then real context rather than noise — that is what per-card grey-vs-alarm colouring is for.
Never hide individual cards out of a rendered set: the row would change width between reads
and the reader loses the fixed position they scan for.

**Test the figure each card actually prints.** A money card is empty when its *amount* is
zero, not when its row count is — an aggregate can return rows that all total nothing, and a
guard written against `.length` alone lets a wall of `AED 0.00` through. Test amounts and
counts together, exactly the set of values the returned items display.

**Empty is not "not yet loaded".** Both look like zero on the first tick, and the widget
correctly renders nothing for both — the distinction costs nothing here *only because* rule 1
keeps `items` function-valued, so the widget appears by itself the moment the fetch settles.
A widget that hides on a cached array never comes back, which reads as permanent emptiness.

**3. Every widget on a page shares one row-eligibility predicate**, exported from the
resource's domain layer and applied identically:

```javascript
for (const row of records) {
  if (!countsForUser(row, me)) continue
  …
}
```

Apply it even where it changes no number today. The point of a shared predicate is that a
widget cannot opt out of the rule by forgetting about it — the moment a new card counts an
earlier state, an unshared rule starts leaking other people's records silently, and the
widget disagrees with the pill beside it.

**4. Count from `records`, never `filteredRecords`.** These widgets are the *reason* to
switch views, so they must not change when a view is switched. A funnel describing only the
view already on screen is a tautology.

**5. Gate a widget on the permission for the action that clears its queue.** "5 requests
have waited over a week" is an instruction to an approver and merely an anxiety to a
requester, who cannot act on it and is often reading their own submission back as a red
number. Return `[]` when unpermitted, so the widget disappears rather than showing empty —
and take the permission read **inside** the closure (§3.3):

```javascript
export default function (props, { resourceRecord, resourceConfig }) {
  return {
    title: 'Approval Queue Ageing',
    items: () => {
      // Inside the closure: the modifier resolves before the auth payload lands,
      // and a permission read taken then would latch a false for the page's life.
      if (resourceConfig?.allowed?.({ OutletRestocks: 'approve' }) !== true) return []
      …
    }
  }
}
```

> [!IMPORTANT]
> **Actionable queue constraint for `MetricCards`.** Metric cards are reserved strictly for
> open, actionable queues owned by active actors (e.g., Pending Approval, Needs Revision,
> Pending Completion). Historical or terminal states (Delivered, Rejected) belong in the
> funnel or reports, not in metric cards.
>
> **Committed obligation denominator for ratios.** A ratio's denominator includes only
> records that incurred a true obligation (e.g. `APPROVED + PARTIALLY_DELIVERED + DELIVERED`).
> Pre-approval drafts and rejections never became delivery commitments; including them would
> let a user falsely improve the fulfillment rate by rejecting requests.
>
> **In-flight funnel boundaries.** Funnel widgets represent moving pipelines and exclude
> terminal states (`DELIVERED`, `REJECTED`) so accumulated history does not compress active
> states into slivers over time.
>
> **Ageing queue selection & timestamp precedence.** Ageing breakdowns apply only to
> queues where elapsed time indicates human friction or delay (such as approval queues), and
> measure elapsed time from the specific queue-entry stamp (`ProgressSubmittedAt`), falling
> back to requested `Date`, rather than creation date (`CreatedAt`).

**The band table is exported from the vocabulary file, not written in the widget.** An
ageing widget's thresholds and the colour a row's own age chip uses are the same scale — if
a row sits in the widget's red band, its chip must be red. Two array literals, one in the
modifier and one in a `ageColor()`-style helper, are a scale that silently splits the first
time either is tuned. Export the bands and derive both from them (§4.5):

```javascript
// domain layer — one definition, read by the widget AND the row chip
export const AGE_BANDS = [
  { label: '0–1 days', caption: 'On track', color: 'positive', max: 1 },
  { label: '2–3 days', caption: 'Watch',    color: 'info',     max: 3 },
  { label: '4–7 days', caption: 'Chase',    color: 'warning',  max: 7 },
  { label: '7+ days',  caption: 'Overdue',  color: 'negative', max: Infinity }
]
export const ageColor = (days) => AGE_BANDS.find((b) => days <= b.max)?.color ?? 'grey-6'
```

**A widget naming a set uses `title`; a widget rendering one figure names it on the item.**
A card row, a funnel and a band scale are *sets*, so the heading belongs to the section
(`title: 'Approval Queue Ageing'`). A single-ratio progress bar has exactly one thing to
name, and naming it twice — once as a section heading and once as the bar's own label —
reads as two headings for one number. Put the name on the item's `label` and omit `title`.

### 9.3 The work-queue switcher

ListSwitcher renders the tabs from `useListView`. View permissions select which tabs are available.
The selected view is shared with List. The switcher also exposes an in-memory config editor,
search input, counts, errors, and a preview of the first allowed list.
See [ListViews](UI_LIST_SWITCHER.md) and its [core guide](UI_LIST_SWITCHER_COMPONENTS.md).

A personal view can filter a real owner field using `$userCode`. A list filter does not grant
record access. View permission controls list availability, not record access.

### 9.4 List rows and display

The List content reads the active rows, item props, action props, and row-click handler from
`useListView`. AppList renders the rows and inline Additional Actions. Configure the view's
`item`, `actions`, and `target`, or use the matching named overrides.
See the [item guide](UI_LIST_VIEWS_ITEMS.md) for the settings and examples.

---

Back to [Resource UI Module Developer Guide](UI_MODULE_DEVELOPER_GUIDE.md).
