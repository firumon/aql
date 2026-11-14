# Shared Utilities Index (Canonical)

## Purpose
This is the canonical catalogue of every reusable helper, utility, and core composable in the AQL frontend. It exists to stop developers and AI agents from re-implementing string helpers, date formatters, color resolvers, or payload builders that already exist.

**Before you add any new utility, helper, core method, or file** — across Layer 1 (Core Infrastructure), Layer 2 (`src/_resource/`), or Layer 3 (`src/_ui/`) — read this index and the source files it points to. The strict rule lives in `AGENTS.md` under **Reuse First & Anti-Duplication Policy (STRICT)**.

### How to use this index
- Each section below names a file and lists its exported functions with a one-line purpose, purity note, and **When to reuse / When to extend** guidance.
- **Purity**: a "pure" function returns the same output for the same input and has no side effects. Prefer pure functions for new logic.
- **Extend, don't duplicate**: if your new capability is a sibling of an existing function, add it to the same file. Do not open a new file unless the capability genuinely belongs to a new domain.
- **Concrete Homes**:
  - String / object transforms → `FRONTENT/src/utils/appHelpers.js`
  - Date / time ops → `FRONTENT/src/utils/dateHelpers.js`
  - Colors / visual → `FRONTENT/src/utils/colorHelpers.js`
  - Sorting / tokens → `FRONTENT/src/utils/sortHelpers.js`, `FRONTENT/src/utils/tokenEvaluator.js`
  - Workflow / audit stamps → `FRONTENT/src/utils/workflowStamp.js`
  - Sheet-row shaping / resource schema / permission checks → `FRONTENT/src/composables/resources/useResourceConfig.js`

- **Layer 1 / core files are READ-ONLY unless the user explicitly asks.** A core file is anything outside a resource's own tier that many modules already depend on: `src/composables/core/`, `src/composables/resources/`, `src/utils/`, `src/stores/`, `src/services/`, `src/router/`, and the shared component bases under `src/components/{abstract,app,sections,contents,actions,shared,_dashboard_widgets}/`.
  - Never add a function, a parameter, a return key, or a "small additive helper" to one of these because a single module needed it. Additive is not harmless: it is how one module's minute need becomes permanent surface area every other module has to read past.
  - A need discovered while building a module belongs in **that module's own tier** — Layer 3 `_ui/` for presentation, Layer 2 `src/_resource/` for domain logic. That is what the three layers are for.
  - If the capability genuinely belongs in core (three or more unrelated modules would each re-implement it), STOP. Report it, show the audit below, and wait for the user to say yes. Proceed only after explicit approval, and quote the approval in your output.
  - This applies to a one-line change as much as a rewrite.

- **Ask BEFORE creating any new file or function — never after.** Creation is not a step you report in a summary; it is a step you request. Before writing a new file, or adding a new exported function to an existing one, post an audit report to the user and wait:
  > *"I need `<function/file>` because `<specific reason>`. I searched `Documents/SHARED_UTILITIES_INDEX.md` and read `<explicit file list>`, and found nothing that accomplishes this. I propose adding it at `<path>` because `<rationale>`. May I create it?"*
  - The `<explicit file list>` must be files you **actually opened** in this session. Naming a file you did not read is a false audit and is worse than no audit at all.
  - The search is not optional and it is not a formality — it is the whole reason the report exists. Read this document and the source files it points at.
  - This covers Layer 1, Layer 2 and Layer 3 alike. A new `_ui/` widget file is cheap and usually approved; a new core helper usually is not. Ask for both.
  - Extending an existing file with a new export counts as creation. Editing the body of an existing function does not.

- **Mandatory Exhaustion Quote**: When an agent DOES create or extend a helper function or file, it MUST explicitly cite in its output:
  > *"Checked existing utilities in [list of files / SHARED_UTILITIES_INDEX.md] and confirmed no existing helper accomplishes <function/feature>. Adding/extending <function_name> in <file_path> because <specific rationale>."*

---

## 1. String & Object Transformations
**File**: `FRONTENT/src/utils/appHelpers.js`

Generic, resource-agnostic string/object shaping. Imported widely by `_ui/` page contracts and JS modifiers. Pure unless noted.

| Function | Purpose |
|----------|---------|
| `humanizeString(str)` | Turn `camelCase`/`PascalCase`/snake into a spaced, capitalised label (`purchaseRequisition` → `Purchase Requisition`). Pure. |
| `toPascalCase(str)` | Slug/string → `PascalCase`, treating `-`, `_`, space as separators. Kept byte-compatible with `toActionHeaderSuffix` in `GAS/resourceApi.gs`. Pure. |
| `humanizeSlug(slug)` | Hyphen slug → Title Case (`purchase-requisition-items` → `Purchase Requisition Items`). Pure. |
| `pluralize(word)` | English plural with irregular/exception tables. Preserves leading-case. Pure. |
| `singularize(word)` | Best-effort reverse of `pluralize` (English pluralisation is lossy). Pure. |
| `AUDIT_HEADERS` | `Set` of always-hidden audit columns (`CreatedAt`, `UpdatedAt`, `CreatedBy`, `UpdatedBy`). Constant. |
| `deriveActionStampHeaders(additionalActions)` | From a resource's additionalActions config, build the `Set` of `By`/`At` stamp headers to hide. Pure. |
| `resolveDisplayValue(value, emptyText)` | Default render of a raw cell — flattens relation objects (`{Name, Code}`) and falls back to `emptyText`. Pure. |
| `filterDetailFields(resolvedFields, actionStampHeaders)` | Drop `Code`, audit headers, and action stamps from a detail field list. Pure. |
| `filterParentFields(record, actionStampHeaders)` | Same filtering applied to a raw record object for a parent data card. Pure. |
| `isDisplayableHeader(header, parentResourceName)` | True when a column is meaningful for display (excludes `Code`, parent ref, `*Code`, audit, `By`/`At` stamps). Pure. |
| `filterDisplayableHeaders(headers, parentResourceName)` | Keep only displayable headers. Pure. |
| `filterDisplayableFields(fields, parentResourceName)` | Keep only displayable resolved field objects. Pure. |
| `resolveChildFields(childResourceConfig)` | Resolve a child's display fields (`ui.fields` first, else displayable headers). Pure. |
| `resolveChildEntryFields(childResourceConfig)` | Entry-form counterpart — keeps relation `Code` columns, drops only key/audit/parent. Pure. |
| `resolveChildTitle(childResourceConfig)` | Child display title from `ui.menus[0].pageTitle` else humanized name. Pure. |
| `findParentCodeField(childResource, parentResource)` | Locate the parent reference column (`ParentCode` or `<Parent>Code`). Pure. |
| `getHeaderIndexMap(headers)` | `header → index` map for row arrays. Pure. |
| `mapObjectsToRows(records, headers)` | Records → 2-D array of cell values by header order. Pure. |
| `mapRowsToObjects(rows, headers)` | 2-D array (or objects) → array of header-keyed objects. Pure. |
| `normalizeCursorValue(value)` | Coerce a sync cursor to epoch ms or `null`. Pure. |
| `resolveSyncRows(responseData, headers)` | Normalize a sync response (`rows`/`records`/`data`) to a row array. Pure. |
| `batchRef(path)` | Build a `$ref` object pointing at a value produced earlier in a batched GAS request. **Never stringified client-side.** Pure. |
| `isBatchRef(value)` | True when `value` is a `$ref` object. Pure. |
| `batchRefList(path, codes, separator)` | `$ref` joined to literal codes for a separated-list column; join done server-side. Pure. |
| `textOrRef(value)` | Pass `$ref` through untouched, else trim to string. Pure. |
| `normalizeCodeOrRef(value)` | Alias of `textOrRef`. Pure. |
| `binColumnClass(count)` | Quasar grid class for `count` side-by-side inputs (`col-12`/`col-6`/`col-4`). Pure. |
| `decorateRow(sourceRow, rowFacts)` | Wraps a row object in a proxy exposing added domain facts while preserving enumerable source fields, `in` operator checks, and non-enumerable live relation access. Pure proxy wrapper. |

**When to reuse**: any string shaping, plural/singular, header filtering, row↔object mapping, or batch `$ref` building.
**When to extend**: add a new string/object transform or a new displayable-header rule here. Do not create a sibling `stringHelpers.js`.

---

## 2. Date & Time Operations
**File**: `FRONTENT/src/utils/dateHelpers.js`

All date math delegates to `date-fns`; only `parseAnyDate` is hand-rolled because AQL sheets store dates in two shapes (epoch ms in audit columns, ISO strings in business columns). Every helper accepts either shape. Pure.

| Function | Purpose |
|----------|---------|
| `parseAnyDate(value)` | Accept `Date`, epoch ms (number or string), `YYYY-MM-DD`, `YYYY-MM-DDTHH:mm[:ss]`, `YYYY-MM-DD HH:mm[:ss]` → local `Date` (literal calendar date, never UTC-shifted). `null` if unparseable. |
| `startOfDay(value)` | Local midnight of the value's day. |
| `endOfDay(value)` | Local `23:59:59.999` of the value's day. |
| `startOfMonth(value)` | Local midnight of first day of month. |
| `endOfMonth(value)` | Local `23:59:59.999` of last day of month. |
| `toDateOnly(value)` | `YYYY-MM-DD` (or `''`). |
| `toDateTime24(value)` | `YYYY-MM-DD HH:mm:ss` (24-hour) — byte-compatible with GAS `formatDateTime24`. Use for any client-resolved stamp. |
| `addDays(value, amount)` | New `Date` + N whole days. |
| `addMonths(value, amount)` | New `Date` + N whole months. |
| `dayOfYear(value)` | 1–366 (or `NaN`). |
| `isoWeek(value)` | ISO week 1–53 (or `NaN`). |
| `daysFromToday(value)` | Signed whole days from today (future positive, past negative). |
| `hoursFromNow(value)` | Signed whole hours from now (future positive, past negative), truncated toward zero. Keeps the time part, so it can express a sub-day window. |
| `relativeTimeLabel(value)` | How long ago, as a chip string — `'3h ago'` under a day, `'2d ago'` beyond it. `''` when unparseable. |

**When to reuse**: every date parse, format, or arithmetic need in the frontend.
**When to extend**: add new `date-fns`-backed helpers here. Never hand-roll another date parser — extend `parseAnyDate` if a new storage shape appears.

---

## 3. Colors & Visual Helpers
**File**: `FRONTENT/src/utils/colorHelpers.js`

Resolves loosely-typed color keywords to CSS values. Pure (with a palette cache; safe in browser only).

| Export | Purpose |
|--------|---------|
| `BRAND_COLORS` | `Set` of Quasar brand names (`primary`, `secondary`, … `dark`). |
| `resolveCssColor(color, fallback)` | Brand name → `var(--q-primary)` (themable); palette name (`red-10`) → resolved hex via Quasar; raw (`#…`, `rgb(…)`, `var(…)`) → as-is; unknown → `fallback`. |

**When to reuse**: any place that paints a color from config/metadata.
**When to extend**: add a new color family or alias here. Do not inline `colors.getPaletteColor` calls elsewhere.

---

## 4. Sorting & Token Evaluation

### 4a. Sorting
**File**: `FRONTENT/src/utils/sortHelpers.js`

| Function | Purpose |
|----------|---------|
| `sortByDate(items, column, direction)` | Sort rows by a date-ish column **without copying row objects** (preserves non-enumerable relation getters). `column` may be a key string or a reader function. Unparseable dates sink to the end. Pure. |
| `readField(row, path)` | Read a direct field or safe dot path through parent/child getters. Array paths can yield many values. |
| `valueType(values)` / `sortValue(value, type)` / `compareValues(a, b)` | Shared type inference, conversion, and comparison for Order and Group aggregates. |
| `sortRecords(records, rules)` | Sort with types, conditions, child aggregates, and the cross-rule pair comparisons (see the ListViews sheet guide). Makes a new array; keeps row objects. Used by the Order feature. |

**When to reuse**: any list ordering by a date column.
**When to extend**: add resource-agnostic sorters here. Feature-specific sort logic that needs resource knowledge belongs in the resource's `_resource/` layer, not here.

### 4b. Dynamic Token Evaluation
**File**: `FRONTENT/src/utils/tokenEvaluator.js`

Generic token registry + condition evaluator. Shared by `APP.Resources.ListViews` filter trees and `AdditionalActions[].visibleWhen`. Two-sided coercion contract: every token declares `coerce` (column side) and `coerceToken` (token side). Pipelines are arrays of `COERCES` names so they stay serialisable.

| Export | Purpose |
|--------|---------|
| `COERCES` | Named coercion primitives (`text`, `trim`, `lowercase`, `slug`, `number`, `epoch`, `dateTime24`, `dateOnly`, `dayOfYear`, `month2`, `year`, `week`, `dayNum`, `hourNum`). Composable left-to-right. |
| `TOKENS` | Token registry: date/time (`$now`, `$dateTime`, `$date:N`, `$day`, `$month:N`, `$year`, `$week`, `$startOfDay:N`, `$endOfDay:N`, `$startOfMonth:N`, `$endOfMonth:N`), relative days/hours (`$daysAgo:N`, `$daysIn:N`, `$hoursAgo:N`, `$hoursIn:N`), and current-user (`$userCode`, `$userEmail`, `$userName`, `$userDesignation`, `$userRole`, `$userRoles`, `$userRegion`, `$userRegions`). |
| `OPERATOR_ALIASES` | Legacy `ne`/`nin`/`notin`/`not_empty` folded onto canonical set. |
| `OPERATORS` | Canonical operator set (`eq`, `neq`, `in`, `not_in`, `gt`, `gte`, `lt`, `lte`, `contains`, `empty`, `notEmpty`). |
| `normalizeOperator(op)` | Canonicalise/alias an operator. Pure. |
| `applyCoerces(value, pipeline)` | Run a `COERCES` pipeline. Pure. |
| `parseToken(value)` | `$name` / `$name:p1:p2` → `{ spec, params }`, or `null`. Pure. |
| `tokenizeValue(value, token)` | Apply a built-in token column conversion for Group; null for unknown tokens. No offset/user/time resolution. |
| `isToken(value)` | True when `value` is a registered token. Pure. |
| `prepareCondition(condition, ctx, options)` | Compile one condition (token parse + coercion) once. `options.strictColumn` flips column-missing behaviour (default strict; fresh Filter, Order on, and visibleWhen pass false). |
| `prepareFilter(filter, ctx, options)` | Compile a whole condition/group tree once. |
| `evaluatePreparedFilter(prepared, row)` | Evaluate a compiled tree against a row (no token parsing). |
| `evaluateFilter(filter, row, ctx, options)` | Convenience: prepare + evaluate for a single row. |
| `resolveTokenContext()` | Build `{ user }` from the auth store (safe when store absent). |
| `useTokenEvaluator()` | Composable: same API with the logged-in user pre-bound. |

**When to reuse**: any filter/token evaluation. Keep both admin token pickers in sync. Check GAS/actionTargets and the client action-seed parser only when the token also belongs to that smaller grammar (see `list_view_tokens.md`).
**When to extend**: add a new token to `TOKENS` or a new coercion to `COERCES` here, and run focused checks against the real modules. See `list_view_tokens.md`.
**Strict sync rule**: editing `TOKENS`/`COERCES` requires the matching GAS change and a verification pass.

---

## 5. Workflow & Audit Stamps
**File**: `FRONTENT/src/utils/workflowStamp.js`

| Function | Purpose |
|----------|---------|
| `stampFields(prefix, actorName, comment)` | The ONLY writer of a workflow stamp triple — returns `{ <prefix>At, <prefix>By, <prefix>Comment }` using `toDateTime24` (never ISO). Keeps GAS and client stamps identical. Pure. |

**When to reuse**: every workflow/action that records who/when/why.
**When to extend**: extend the stamp shape only here; do not write stamp columns by hand elsewhere.

---

## 6. Resource Config, Record Access & Row Sanitization
**Files**: `FRONTENT/src/composables/resources/useResourceConfig.js`, `FRONTENT/src/composables/resources/useRecord.js`

The resource's schema, permissions, default values, and data store access.

| Function | Purpose |
|----------|---------|
| `useResourceConfig(resourceNameOverride?)` | The active (or named) resource's config: headers, fields, required headers, `defaultValues`, `additionalActions`, `allowed`, `exists`, `missing`. |
| `resourceRow(resource, ...sources)` | Merge sources over the backend defaults into one row for `resource`, dropping every key the sheet does not have. `_action` survives. |
| `findResourceConfig(nameOrSlug)` | Look up an authorized resource config by name, tolerant of singular and plural forms. |
| `useRecord()` | Core singleton composable for data store record access. Exposes `rows`, `enrich`, `enriched`, `recordsBy`, `recordBy`, `indexOf`, `relations`, `isLoading`, `remember`. |
| `indexOf(resource, header)` | Exposes the raw `Map` of value → rows from `getIndex`. Read inside a `computed`, it tracks the index. Rows are raw store rows (read-only); blank values are skipped. |

**Node objects are written by hand.** There is no constructor module — `nodePayloads.js`
was deleted on 2026-08-29. The Node shape is specified in
[UI_PAGE_STATE.md](file:///f:/AQL/Documents/UI_PAGE_STATE.md) §5, and
`actionKeyFor` lives in
`FRONTENT/src/composables/resources/pageState/usePageStateActions.js`.

**When to reuse**: any Layer 2 builder that shapes a sheet row, or any code that asks what
the signed-in user may do to a resource, or reads/groups resource rows.
**When to extend**: add row/schema helpers here. Do not re-derive headers or default
values elsewhere — that bypasses sanitization.

---

## 7. Notifications, PWA & Misc Helpers

### 7a. Push Notifications
**File**: `FRONTENT/src/utils/notifications.js`

| Function | Purpose |
|----------|---------|
| `requestNotificationPermission()` | Ask the browser for push permission; resolves boolean. Async, side-effecting. |
| `subscribeToPush(publicVapidKey)` | Subscribe the SW to push (idempotent — returns existing subscription). Async, side-effecting. |

**When to reuse**: any push-subscription flow.
**When to extend**: keep push logic here; do not duplicate VAPID handling.
The app asks for notification permission and subscribes only when the signed-in user has a token and `VITE_VAPID_PUBLIC_KEY` is set.

### 7b. Placeholder Props
**File**: `FRONTENT/src/utils/placeholderProps.js`

| Function | Purpose |
|----------|---------|
| `resolvePlaceholderProps(props, identity, kind)` | Carve a targeted `Props*` block out of the flat `pageProps` bag (case-insensitive, function blocks evaluated live). Returns the merged block or `null`. Pure. |

**When to reuse**: any Section/Content/Action resolver splitting `pageProps` into per-placeholder props.
**When to extend**: extend only if a new placeholder family beyond Section/Content/Action is introduced.

### 7c. IndexedDB Compat
**File**: `FRONTENT/src/utils/idbCompat.js`

| Function | Purpose |
|----------|---------|
| `installIdbCompat(target)` | Shim legacy `IDBTransaction`→`IDBOperation` / `transaction()`→`operation()` naming. Idempotent. Runs once at module load. |

**When to reuse**: only when wrapping a legacy IDB layer that uses the old names.
**When to extend**: rarely. Add a compat shim here rather than patching call sites.

### 7d. PWA Utilities
**Files**: `FRONTENT/src/utils/pwa-utils.js`, `FRONTENT/src/composables/core/usePwaUpdate.js`

| Function | Purpose |
|----------|---------|
| `isStandalone()` | Detect installed/PWA standalone mode. |
| `setDeferredPrompt(e)` / `getDeferredPrompt()` / `clearDeferredPrompt()` | Hold the beforeinstallprompt event. |
| `presentInstallPrompt()` | Trigger the install prompt; resolves `'accepted'` / `'dismissed'` / `'not-available'`. |
| `usePwaUpdate()` | Core PWA update composable providing reactive singleton update state (`isChecking`, `isDownloading`, `isUpdating`, `updateAvailable`), background check/download, single app-level watcher (`initPwaWatcher`), cold-start auto-apply, and `applyUpdate()`. |

**When to reuse**: any PWA install/standalone detection or update lifecycle tracking.
**When to extend**: add PWA helpers here; keep update singleton logic in `usePwaUpdate.js`.

### 7e. Data Utilities & Dashboard Engine
**Files**: `FRONTENT/src/composables/data/useDataContext.js`, `FRONTENT/src/composables/data/useDataControls.js`, `FRONTENT/src/composables/dashboard/useDashboardLayout.js`, `FRONTENT/src/composables/resources/useWidgetResolver.js`

| Function | Purpose |
|----------|---------|
| `useDataContext()` | Stateless pure math utilities for domain data items (`countBy`, `sumBy`, `topN`, `mean`, `countAt`, `inRange`, `rangeLabel`, `daysSince`, `daysAgo`, `hoursBetween`). Functions take lists, never resource names. Pure. |
| `useDashboardLayout(items, columns)` | Manages packed row column widths and visual order from tile size preferences and live empty state. Pure layout logic. |
| `useWidgetResolver(tileProps, uiName)` | Resolves custom widget replacement (.vue) replacing the Frame, and tiered JS prop modifiers (.js) for dashboard tiles. |
| `dataControl(name, { type, options, value, ...rest })` | Builds a data control descriptor for domain composables, preserving caller's own ref in `value` and normalizing options. |
| `useDataControls(controls)` | Transforms a controls list/ref into reactive `ctl` (with box-opening writable computed `value`) and a single `Controls` component mapping control types to `_fields` edit pickers. |

**When to reuse**: any domain data calculations, dashboard tile packing, widget/frame resolution, or domain/frame interactive controls.
**When to extend**: add pure math helpers to `useDataContext.js`; adjust packing algorithms in `useDashboardLayout.js`; customize resolution rules in `useWidgetResolver.js`; add control bindings in `useDataControls.js`.

### 7f. Widget Geometry & Formatting
**File**: `FRONTENT/src/utils/widgetGeometry.js`

| Function | Purpose |
|----------|---------|
| `tierOf(width)` / `tierAtLeast(tier, floor)` | Density tier classification (`micro`, `compact`, `standard`, `wide`). Pure. |
| `polar(cx, cy, r, deg)` | Polar to Cartesian coordinates. Pure. |
| `arcPath(cx, cy, r, a0, a1)` / `wedgePath(...)` | SVG arc and annular wedge path generators. Pure. |
| `truncate(text, maxPx, fontSize)` | SVG label text truncation with ellipsis based on pixel width. Pure. |
| `formatNumber(n)` | Locale number string. Pure. |
| `formatShort(n)` | Compact human number string (`1.2K`, `3.4M`). Pure. |
| `signed(n)` | Formatted number prefixed with true minus sign `−` when negative. Pure. |
| `formatValue(v, valueFormat, fallback)` | Applies custom `valueFormat` function if provided, else falls back to given fallback or `signed(v)`. Pure. |
| `niceScale(min, max, wantedLines)` | Axis ticks rounding outward to human-readable step intervals. Pure. |

**When to reuse**: any SVG geometry, density tier math, tick scaling, or widget number/value formatting.
**When to extend**: add shared widget math and formatters here; do not duplicate SVG calculations in individual widgets.

---

### 7g. Inline SKU Selection
**File**: `FRONTENT/src/composables/useInlineSkuPicker.js`

`useInlineSkuPicker(props, emit, options)` filters caller-provided records by the `searchBy` field or function and sends each checkbox or input change to the parent's `{ [skuCode]: value }` model. The `value` prop is the row input's default. It exposes `searchQuery`, `filteredOptions`, `selectedCodes`, `valueFor`, `setSelected`, and `setValue`.

Reuse it with `components/shared/AqlInlineMasterPicker.vue`; the SKU wrapper supplies the SKU records. SKU options still come from the shared `useSkuResource().skuOptions`; the picker does not join or rebuild resource rows.

The component uses AppList's native checkbox and input props. `inputProps.modelValue` reads the parent's value so unticking and parent resets clear the input too. The default is passed through an `inputValue` function; it must not be the field name `value`, which holds the SKU code in each option. The list has no pages and scrolls within three 56 px rows.

---

## Extension Cheat-Sheet (where a new helper belongs)

| New capability | File to extend |
|----------------|---------------|
| String/object shaping, plural/singular, header filtering, row↔object map, `$ref` | `src/utils/appHelpers.js` |
| Date parse/format/arithmetic | `src/utils/dateHelpers.js` |
| Color resolution | `src/utils/colorHelpers.js` |
| Resource-agnostic sorting | `src/utils/sortHelpers.js` |
| List-view / action token or operator | `src/utils/tokenEvaluator.js` |
| Workflow/audit stamp column | `src/utils/workflowStamp.js` |
| Sheet-row sanitization, resource schema, permission checks | `src/composables/resources/useResourceConfig.js` |
| Push / PWA / placeholder props / IDB compat | the matching file in §7 |

If a capability spans a genuinely new domain with no home above, create a new file ONLY after confirming none of these cover it, and record the new file in this index and in `CORE_DOC_ROUTING.md`.

## ListViews and list source rules

The public component API is resources/listViews/useListView.js.
It shares views, lists, loading, tabs, activeName, activeList, setActiveView, resourceName, itemProps, actionProps, onRowClick, and optional debug helpers.
[The core guide](UI_LIST_SWITCHER_COMPONENTS.md) owns exact signatures and lookup paths.
`itemProps` merges the active view props with the shared [empty state](UI_LIST_VIEWS_ITEMS.md#8-how-rows-reach-applist).
View permission reuses resourceConfig.allowed before the list pipeline; raw debug settings stay intact.

Reuse `useListEngine` and `useListResolver` for Data source discovery and list rules.
`Data/useData` prepares shared resource facts and calculations for list rows.
`Data/useList` owns common and fixed-purpose row filters across UIs. It may also add display
facts shared by named ListViews. Keep view field and layout choices in `item`; use a per-view
Map override for a display fact that only one named view needs. Keep all resource list filters
out of `APP.Resources.ListViews`.
`useRecord` is the only fallback. Keep domain facts in the owning resource.

A ready per-view `Data` override replaces source rules. Otherwise, the current resolver chooses
one `useList` rule: the exact view name or `default`. It does not apply `default` first and then
a named rule. The resolver must choose the source, apply the shared default, then apply the named
rule, including when a `Data` override supplies the rows. It also needs a bypass for lists outside
the common baseline. See `UI_LIST_SWITCHER_COMPONENTS.md` before relying on this behavior.
useFeatureChain finds numbered features automatically.
03Filter reuses tokenEvaluator; 04Order reuses sortHelpers and tokenEvaluator.
01Group keeps first bucket rows in each pass, then adds facts with readField,
sort value helpers, tokenizeValue, and decorateRow.
05Search uses readField/decorateRow. 06Limit caps rows before 21Props and the display stages.
31Target carries the view's target or Target override for onRowClick; it does not decorate rows.
91Content, 92Meta, and 93Style fill view-level itemProps. 94Actions fills actionProps. These stages return input rows unchanged.
useTokenOverride loads Group custom functions from resource-level or UI-wide token files.
Do not duplicate those helpers or start a second pipeline in a component.
The computed result is the row cache.

Search is implemented by `features/05Search.js`.
Reuse useResourceReload().reloadDependencies({ resources }) for checked named-resource reloads.
The default reload still follows route relations. See UI_RECORD_ACCESS.md.

### ListViews item display helpers

File: `FRONTENT/src/composables/resources/listViews/listItemProps.js`.
Use it for the generic display stages. Keep resource facts in their owning domain.
The [item guide](UI_LIST_VIEWS_ITEMS.md) owns the full behavior and accepted shapes.

| Export | Purpose |
|---|---|
| itemPiece | Validate item config and choose a sheet value or ready raw display export; uses the reactive override loader |
| parseList | Parse CSV/array values; trim strings and keep cell positions |
| parseLayout | Validate slot names for the given layout kind |
| parseTemplate | Keep a bare string or compile brace fields using readField |
| parseTemplates | Parse CSV/array templates or one row function; keep the function as one cell without calling it |
| parseCells | Require and preserve a full native AppList array |
| distributeCells | Align each kind's next template to its layout slots |
| parseStyle | Keep a string or build an indexed field-map resolver |
| parseStyleOverride | Require and preserve a string or row function |

The parsers return values or resolver functions. They do not fetch data or mutate rows.
Do not add a second parser in a feature or consumer.
