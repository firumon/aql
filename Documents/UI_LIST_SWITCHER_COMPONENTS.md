# ListViews - Core, Components, and Overrides

Part of the [ListViews guide](UI_LIST_SWITCHER.md). The [sheet guide](UI_LIST_SWITCHER_SHEET.md)
shows view JSON. The [item guide](UI_LIST_VIEWS_ITEMS.md) covers display, actions, and Target.

## 4.1 Public entry point

```js
import { useListView } from 'src/composables/resources/listViews/useListView'

const { lists, loading, tabs, activeName, activeList, setActiveView } = useListView()
```

Call it in Vue setup or a setup-owned scope below the page providers. It injects
`resourceConfig` and `resourceRecord`. A missing `resourceConfig` throws.

| Return | Meaning |
|---|---|
| `lists` | Results for allowed views, each `{ name, view, rows, itemProps, actionProps, targetState, count, error }` |
| `loading` | Data-engine loading or page-record loading |
| `tabs` | Display props for each result, in view order |
| `activeName` | Selected allowed view name, or `''` |
| `activeList` | The active result, or `null` |
| `resourceName` | Current resource name |
| `page` | Writable page number for the active view. Search uses its own page number. |
| `itemProps` | Active view props with a shared empty state; see the [item guide](UI_LIST_VIEWS_ITEMS.md#8-how-rows-reach-applist) |
| `actionProps` | Props from the active result, or `{}` |
| `setActiveView(name)` | Select an allowed name; an unknown or denied non-empty name is ignored |
| `onRowClick(row)` | Resolve Target, check destination access, and navigate |

These values are Vue refs or computeds except the functions. Read refs
with `.value` in JavaScript. `view` in a result is its effective config after the approved Config override. A bare
string is accepted as a view name. Entries without a name are skipped. Names are
not checked for duplicates; use distinct names for source rules and overrides.

`permission` is checked before a view enters the pipeline. The raw view list stays
unfiltered inside the composable. See [view permissions](UI_LIST_SWITCHER_SHEET.md#view-permission).

Each tab has:

```js
{ item: { name, label, icon, color }, active, label, icon, color, count, showCount }
```

The label defaults to the view name, icon to `null`, and color to `primary`.
`count: true` shows a count, `false` hides it, and a missing or other value shows
it only when `filterTerm` is nonempty after trimming. Count is the final row count.

Selection first uses the allowed name selected on this page or remembered for this
resource in the current session. Otherwise it uses the first allowed `default: true`
view, then the first allowed view, then `''`. A denied active view falls back. A
remembered name becomes active again if access returns and another view was not
selected. A full reload clears the module's remembered names.

Each resource and list view remembers its own page while you move around the app.
A view you have never paged through starts at page 1. If the saved page is past the
end, the list shows the last available page and keeps your saved choice. Paging
controls are disabled while the list loads. A new search starts at page 1. Clearing
it brings back the page for the full list. A full reload clears the saved pages.

One detached scope is shared by callers with the same injected `resourceConfig`
object. Each caller adds a user; disposing the last caller stops that scope.

## 4.2 File map

All paths are relative to `FRONTENT/src/` unless marked GAS.

| File | Job |
|---|---|
| `composables/resources/usePageRecord.js` | Page record, records, relations, loading, reload, and `filterTerm` |
| `composables/resources/listViews/useListView.js` | Public state, permission filter, selection, page memory, and Target click |
| `composables/resources/listViews/useListPipeline.js` | Config overrides after permissions, per-view source, and feature results |
| `composables/resources/listViews/useListEngine.js` | Data module discovery and loading |
| `composables/resources/listViews/useListResolver.js` | Base rows, Data override, and source rule selection |
| `composables/resources/listViews/useListOverride.js` | View feature override lookup and loading |
| `composables/resources/listViews/useTokenOverride.js` | Custom Group token lookup and loading |
| `composables/resources/listViews/useFeatureChain.js` | Discover and run feature files in order |
| `composables/resources/listViews/features/` | Group, Map, Filter, Order, Search, Limit, Props, Target, Content, Meta, Style, Actions |
| `composables/resources/listViews/listItemProps.js` | Display parsing and row template helpers |
| `composables/resources/listViews/useTabFit.js` | Mobile dragging and desktop overflow |
| `components/sections/ListSwitcher.vue` and `ListSwitcherItem.vue` | Switcher and tabs |
| `components/contents/List.vue`, `components/app/AppList.vue`, `components/abstract/List.vue` | Active rows, display, actions, and click |
| `utils/tokenEvaluator.js`, `sortHelpers.js`, `dateHelpers.js` | Conditions, tokens, paths, comparisons, and date math |
| `GAS/listViewsManager.html`, `GAS/appMenu.gs`, `GAS/resourceRegistry.gs` | Manage, save, parse, and send sheet config |

The pipeline uses `Index` as the page when looking up a feature override.

## 4.3 Data source and source rules

### Prepare the row source before the view seed

For each list, choose one base row source:

- Use `Data/useData.js` when the list shows this resource's own records, decorated with calculated facts.
- Use a focused `use<Family>Data.js` when the rows need another resource or form a shared
  cross-resource summary.

Then use the resource's `Data/useList.js` for the list's own filtering or row decoration.
Reuse the same prepared source when several lists need the same grouped or changed rows.
Check the final row set and its field names and values before writing `APP.Resources.ListViews`.
Build the seed from those fields. Keep resource row membership out of the sheet.

The engine directly discovers `Data/useData.js` and `Data/useList.js`. It does not discover a
family data file by itself. When a list uses `use<Family>Data.js`, its resource `useList.js`
must connect that source to the list.

For each allowed view, the engine uses the matching files under
`_resource/{Scope}/{Resource}/Data/`:

1. `useData.js`, if present, default-exports a function with no arguments. It must
   return a ref or computed whose value is an array. It is shared across views.
2. Without a provider, the base is `useRecord().enriched(resource)`.
3. A ready `list{Name}Data.js` override takes precedence over the source rules.
4. Otherwise `useList.js` selects the exact, case-sensitive view name, then
   `default`, then the unchanged base rows.

`useList.js` default-exports an object of synchronous functions. Each receives the
base array and returns an array:

```js
export default {
  default: rows => rows,
  Planned: rows => rows.filter(row => row.Progress === 'PLANNED')
}
```

`preparedRows` is the provider or record base before a Data override or rule.
`rows` is the selected result. The provider is cached per provider and resource;
its ref stays reactive. Provider and module errors are resolved before a Data
override can run. Source rules and Data overrides can already narrow a view before
Group or Filter sees it.

### Filter ownership for resource lists

`useData` prepares facts for this resource's own rows. It keeps rows that other lists may need.

`useList` owns row membership for that resource across its UIs:
- Its default rule defines the shared baseline, such as active rows when that resource uses Status.
- A named rule defines a fixed list purpose, such as Completed meaning Progress = COMPLETED.
- Keep every resource list filter out of `APP.Resources.ListViews`. The sheet holds view names and display settings.
- A list outside the shared baseline needs a clear bypass, such as an Invalidated list that must include inactive rows.
- `useList` may add display facts used by several named ListViews. Keep reusable domain facts in `useData`.
- When only one named view needs a display fact, add it in that view's `list{Name}Map.js` Map override.
- Keep layout and field choices in the seed's `item` settings. Do not keep a ListView-only display wrapper as a second source for those settings.

**Cross-resource rows:** When a list needs rows from related resources, use a focused family
data composable. It must get each source through that resource's own Data or domain API, then
apply the family rule in Layer 2. The resource's `useList` rule connects that result to the
named view. Do not rebuild a source resource's rules or put this work in a `List<Name>.vue`
file. Those old Vue files are useful evidence for the view seed and display, but the shared
List engine does not use them as its row source.

Use one family name for one related domain. `OutletConsumptionQueue` and
`useOutletConsumptionQueueData.js` name the shared pending-consumption projection used by
invoiceable lists. `OutletDeliveryQueue` names the free restock lines grouped for delivery.
Keep unrelated outlet work in separate data sources.

**Target rule flow:** Run the shared default rule first, then the named rule for that view. For example, the default keeps active rows and Completed then keeps rows whose Progress is COMPLETED.

**Current engine limit:** A ready per-view `Data` override replaces the source rules. Otherwise, the resolver chooses the exact named rule or the default rule; it does not run both. The target flow needs a resolver change: choose the row source first, run the common default rule, then the named rule. The common rule must also apply to rows from a `Data` override. A bypass is needed for lists outside the baseline. Until then, each named rule and `Data` override must apply the common rule itself. This is based on `useListResolver.js:130-141` and the Data override path above.

## 4.4 Feature chain and cache

`useFeatureChain` finds `features/*.js` with an eager glob and sorts the paths.
Each file default-exports a synchronous `(records, config) => array` function.
The current order is:

```text
01Group -> 02Map -> 03Filter -> 04Order -> 05Search -> 06Limit
-> 21Props -> 31Target -> 91Content -> 92Meta -> 93Style -> 94Actions
```

Each stage receives the prior stage's array and must return an array. Group and
Search may decorate rows with proxies. The Map stage keeps the row array and calls
its ready override once for each row. That override returns a facts object. The
stage uses `decorateRow(row, facts)` to add or replace fields while keeping source
fields and row order. Props, Target, Content, Meta, Style, and Actions keep the
input rows unchanged.

The pipeline passes `{ view, listName, overrideFor, tokenFor, ctx, term,
masterResources, itemProps, actionProps, targetState }`. `ctx` currently contains
`user`; `term` comes from `resourceRecord.filterTerm`; `masterResources` is the
set of authorized names with Master scope. `tokenFor` is for custom Group tokens.

Results are computed per view and update when tracked data, config, user, or
loader state changes. The source and result computeds are the row cache. Import
promises have their own cache. A view error gives `rows: []`, `count: 0`, empty
props, `targetState: null`, and the error. Other views can still run. `count` is
final rows, not a separate total before Limit.

`loading` covers the Data engine and page record. It does not wait for feature
imports. While a Target override loads, its row clicks are blocked. Other stages
use their documented loading behavior.

## 4.5 Override lookup

A view feature override uses one of these paths, in order:

1. `src/_ui/{Ui}/components/{Scope}/{Resource}/Index/list{Name}{Kind}.js`
2. `src/_ui/{Ui}/components/{Scope}/{Resource}/list{Name}{Kind}.js`

For `AQL`, `Operation`, `OutletVisits`, view `Today`, and kind `Order`, the files
are `.../Index/listTodayOrder.js` and `.../OutletVisits/listTodayOrder.js`.
The first match wins. A failed first match reports its error; the second is not
tried. Use lowercase `list` so the glob finds the file. Resource, view, and kind
names use the shared PascalCase normalization and case-insensitive lookup. Distinct
view names should not normalize to the same file name.

The loader keeps the default export as a raw value. Its reactive state is `none`,
`loading`, `ready`, or `error`. Completing an import updates the computed result.
The current pipeline uses page `Index`. Restart the development server after adding
or renaming a glob-matched override file. Group token files have their own paths
and loader; see [Group tokens](UI_LIST_VIEWS_TOKENS.md#group-token-values-and-custom-files).

## 4.6 Override export shapes

| Kind | Default export | Arguments and result |
|---|---|---|
| Config | Plain object or synchronous function | Function gets `{ listName, view, resourceName, user, term }`; returns a plain config object |
| Data | Function or array | Function gets `baseRows`; return array or ref/computed of array |
| Map | Function | `(row, ctx) => facts object` |
| Group, Filter, Order, Search, Limit | Function | `(afterCoreRows, beforeCoreRows, viewConfig) => array` or ref/computed of array |
| Props | Object only | AppList props merged over root pagination and sheet `props`; values may be functions where AppList supports them |
| Target | Target value or function | Function gets clicked row; returns a supported Target value |
| Layout, MetaLayout | CSV text or array | Slot names |
| Labels, Captions, MetaChip, MetaBadge, MetaLabel, MetaCaption | CSV text, array, or row function | Display templates |
| Content, Meta | Array | Full AppList cell array |
| Icon, IconColor, Color, Highlight, MetaColor, ChipColor, BadgeColor | String or row function | Display value |
| Actions | Plain object | `only`, `exclude`, `dense`, `size` |

The JavaScript Actions override keeps this plain-object shape. It can supply only
`only`, `exclude`, `dense`, and `size`. When root `actions` is missing or `null`,
the current override behavior stays in place. When root `actions` is `false`, the
Actions stage skips the override and leaves `actionProps` empty. The override cannot
add props, restore the slot, or fail that view.
Manage Lists shows a saved `false` as off. Turning it off saves `false`; turning it
on clears `false`.

All row callbacks are synchronous. A Data function may return an array or a ref
of an array; an array can also be exported directly. A bare ref export is not a
Data override. Group, Filter, Order, Search, and Limit overrides return an array
or a ref/computed of one; their stage unwraps it. The Map stage always returns an
array. A missing or loading Map override returns the same input array. A load error
keeps the current error behavior. A Map call error or invalid facts object fails
that view and names the list and row index. A thrown error stays as the cause.
Root `actions: false` skips the Actions override.

Map runs before Filter. Each override call gets one row and this context:
`{ listName, view, user, term, masterResources, readField }`. It must return a
non-null, non-array object. An empty object adds no facts. A fact can add a new
field or replace a field on the source row. Key collisions are allowed. The
`decorateRow` call belongs to the Map stage; it preserves source fields and live
relation getters while adding facts:

```js
export default (row, { user }) => ({
  visitLabel: `${row.Code} / ${row.Progress}`,
  mine: row.CreatedBy === user?.Code
})
```

For Group, `beforeCoreRows` is the source input. For Filter it is the result after
Group and Map; for Order it is after Filter; for Search it is after Order; and for
Limit it is after Search. A callback can return its second argument to replace the
core result. Group can call an override without group rules, with empty-fact proxies
as the first argument. Search calls its override only with explicit search fields.
See [Group, Search, and Limit](UI_LIST_VIEWS_GROUP_SEARCH_LIMIT.md).

Props reads root `paginate` (boolean), `perPage` (integer at least 1), and
`threshold` (integer at least 0), then merges the root `props` object over those keys.
A ready Props object merges over that result. The merge is shallow. Missing or null
sheet `props` adds nothing; another non-object or an array fails the view. The override
export must be an object, not a function. Its values may be functions where AppList
supports them. Later display stages keep their normal order. The [item guide](UI_LIST_VIEWS_ITEMS.md) covers
Target, display values, action props, examples, and their validation.

### Config overrides: use only when required

`list{Name}Config.js` is a rare escape hatch. Use it only when the sheet settings and
focused overrides cannot meet a required need. AI agents must explain that need and get
explicit user permission BEFORE creating such a file. They must not create one on their own.
An explicit user request to create and use a named Config override counts as permission.

The saved view passes its permission check first. Only allowed views reach the pipeline.
A denied view does not load or run its Config override. Config cannot grant access to a view.
The override uses the same two paths and page-first lookup shown above.

A ready export is a plain object, or a synchronous function that returns one. The function
gets `{ listName, view, resourceName, user, term }`. This input is read-only, including the
saved view and nested permission values. It has no row argument. Do not mutate the input.
The function runs once per view-result evaluation, including empty views. Reactive values
read by the function can cause it to run again. It is not a once-per-row Map callback.

Returned `name` or `permission` keys are errors, even when their values match the saved ones.
These keys stay owned by the saved view. Arrays, refs, promises, null, and other non-plain
results are errors. Import and callback errors name the Config file and fail only that view.

The pipeline uses `decorateRow(savedView, patch)` for a shallow, read-only effective view.
Missing keys keep their saved values. Supplied nested objects and arrays replace that whole
value; there is no deep merge. For example, `item` replaces the full saved `item`,
`order` replaces the saved order array, and `actions: false` hides inline action buttons.
The saved object is unchanged. Callers must not write to the effective view either.

Config may change all supported settings except `name` and `permission`: tab label, icon,
color, default selection, count mode, item display, actions, order, search, limit, pagination,
native AppList `props`, and Target. Existing feature checks still apply. Unknown keys do not add engine behavior.
Keep domain row membership in `Data/useList.js`. Action and Target permission checks still run.
Later focused overrides keep their normal precedence over the effective base settings.
Map keeps its existing row contract. Tab settings work even when no rows reach Map.

A missing or loading Config override uses the saved settings. Once ready, the effective
view feeds all stages, tabs, selection, counts, and row clicks. The tab and More menu read
the same resolved values. Config is not an extra row feature stage. Manage Lists still edits
and saves sheet settings; runtime Config results are not written back to the sheet.

The AQL Outlets `NoUpdates` view has an approved `Index/listNoUpdatesConfig.js`.
It reads `operatingRuleDefaults().visitFrequencyDays` from the owning rules domain and
shows `No Updates for {x} Days` (or `Day` for one). No positive configured value gives
`No Updates`. Its domain row rule uses the same configured default. See the
[outlet workflow](WORKFLOW_OUTLET_OPERATIONS.md#31-store-profiles--visit-scheduling-outlets).

## 4.7 Relations

Rows from `useRecord` expose lazy parent, link, and child getters. `_Parents` and
`_Children` show available relation names. For example, a visit can read an outlet
name through `$outlet.Name`. The shared `readField` supports direct keys and dot
paths for Group, Filter, Order, Search, and display templates. An exact key wins
before a dot path. Order requires an aggregate for a path returning many values.

A relation read can ask the existing record system to load an authorized resource
on first access. It returns currently available data and updates when records arrive.
A replacement row must contain the fields and getters its later stages need.

## 4.8 Switcher

`ListSwitcher.vue` binds `tabs` and calls `setActiveView`. `useTabFit({ tabs,
rowRef, moreRef })` returns `{ isDrag, hiddenNames, refit }`. On mobile, all tabs
can be dragged. On desktop, measured tabs fit in the row and the rest appear in
More. The active hidden tab gives More its label, icon, color, and active mark.
Each tab carries its result count and `showCount`. Counts appear on visible tabs,
in each More menu item, and on More while its selected tab is hidden. `showCount`
is true for view `count: true`, false for `count: false`, and otherwise follows
the page search term.

## 4.9 Fault guide

| Symptom | Check |
|---|---|
| No tabs | Config has named views and their `permission` checks pass |
| Fewer rows than expected | Data override and named/default source rules run before the features |
| A view has no rows | Read its error and check fields, Filter, Group, Search, and Limit |
| Search override does not run | Supply explicit search fields |
| Parent field is blank | Check the getter name and whether the related record is available |
| Override is not found | Check the file name, path, UI, scope, resource, and active view name |
| Target click does nothing | Check loading, target shape, code field, destination, and permission |
| Sheet changes do not appear | Refresh auth config; record reload alone does not refresh list settings |

## 4.10 List and display props

`List.vue` reads the active rows, `loading`, `itemProps`, `actionProps`, and
`onRowClick` from the shared state. It passes the rows and item props to AppList.
When root `actions` is `false`, it omits the `btn` slot. AppList stays clickable,
so row clicks still work. Otherwise, it mounts inline `AdditionalActionsButtons`
in the slot and stops those clicks from reaching the row. A failed active view
shows an alert. AppList shows its normal loading and empty states. A transition is
keyed by resource and view.

`21Props` adds view-level AppList settings. `91Content`, `92Meta`, and `93Style`
add display props; `94Actions` adds action props. They keep the row array. See
[item display](UI_LIST_VIEWS_ITEMS.md) for supported sheet keys and overrides.
