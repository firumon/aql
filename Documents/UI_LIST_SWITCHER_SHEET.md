# List Switcher — Sheet Integration

> Part of **[AQL Frontend List Switcher Architecture](UI_LIST_SWITCHER.md)**. `APP.Resources.ListViews`: schema, filters and tokens.

---

## 5. Sheet Integration (`APP.Resources.ListViews`)

The list view items and filtering are derived dynamically from Google Sheets database configurations.

### 5.1. Sheet Config Relationship
* **Spreadsheet Setup**: Managed under the `ListViews` column of the `APP.Resources` sheet. See the [AQL Menu Admin Guide](file:///f:/AQL/Documents/SHEET_TOOLBAR_MENU_GUIDE.md#L219-L234).
* **Admin Dialog**: The `AQL 🚀 → Manage Lists` dialog ([`GAS/listViewsManager.html`](file:///f:/AQL/GAS/listViewsManager.html)) configures this cell. Its **Chip Color** field is a free-text input backed by a `colorSuggestions` datalist — pick a brand/palette suggestion or type any Quasar palette name or Hex code. See [Section 4.4 in UI_LIST_SWITCHER_COMPONENTS.md](UI_LIST_SWITCHER_COMPONENTS.md#44-dynamic-color-resolution) for accepted formats.
* **JSON Array Structure**: In custom mode, the cell contains a JSON array of item objects:
  ```json
  [
    {
      "name": "Inactive",
      "default": true,
      "color": "positive",
      "icon": "check_circle",
      "filter": {
        "type": "group",
        "logic": "AND",
        "items": [
          { "type": "condition", "column": "Status", "operator": "eq", "value": "Inactive" }
        ]
      }
    }
  ]
  ```
  Every item in the array shares the item object schema detailed in [Section 4.3 in UI_LIST_SWITCHER_COMPONENTS.md](UI_LIST_SWITCHER_COMPONENTS.md#43-list-view-item-object-schema).

#### 5.1.0. Single-Cell Mode Contract (`parseListViewsCell`)
The backend parser ([`GAS/resourceRegistry.gs`](file:///f:/AQL/GAS/resourceRegistry.gs#L823-L852)) determines `listViewsMode` and `listViews` from the raw cell shape:

| Cell Content / Shape | Resolved Mode (`listViewsMode`) | Views Array (`listViews`) | Description |
| :--- | :--- | :--- | :--- |
| **Blank** (`""`, `null`, `undefined`, whitespace) | `"auto"` | `[]` | Uses scope-aware auto-views generated at runtime. |
| **`[]`** (empty JSON array) | `"off"` | `[]` | Explicitly disables list views for this resource. |
| **`[ ... ]`** (non-empty JSON array) | `"custom"` | `[...]` | Uses the authored custom views array. |
| **Invalid JSON or non-array** (e.g. `"off"`, `{}`) | `"auto"` | `[]` | Safe fallback. Defaults to auto-views. |

> [!IMPORTANT]
> These modes are determined by **cell shape** (empty cell, empty array, non-empty array). Literal strings such as `"off"` or `"auto"` do **not** select a mode; because they are not valid JSON arrays, they fail the array check and fall back to `"auto"`.

#### 5.1.0a. Auto-View Derivation Rules (`useListViews.js`)
When `listViewsMode` is `"auto"` and no custom views are configured, [`useListViews.js`](file:///f:/AQL/FRONTENT/src/composables/useListViews.js#L162-L193) automatically constructs views using resource metadata:

1. **Master Scope (`scope === 'master'`)**:
   - If the resource has a `Status` column in `resourceHeaders`, it generates two standard views:
     - **Active** (`default: true`, `color: 'positive'`, filter: `Status eq 'Active'`)
     - **Inactive** (`color: 'grey'`, filter: `Status eq 'Inactive'`)
   - If the resource does not have a `Status` column, **no views** are produced (`[]`).
2. **Other Scopes (`operation`, `accounts`, etc.)**:
   - Tries the **`Progress`** column first if present in `resourceHeaders`.
   - If `Progress` is absent or yields no values, tries the **`Type`** column next.
   - **Value Resolution for Progress and Type (`resolveColumnValues`)**:
     - Checks configured options from `useResourceConfig().options(column)` first.
     - If no options are configured, falls back to scanning live rows (`items`) for distinct, order-preserving values using `uniqueColumnValues()`.
   - **Candidate Option Column Search (`findAppOptionColumn`)**:
     - If both `Progress` and `Type` yield no views, searches for the first header that has configured options in `useResourceConfig().options()`.
     - Unlike `Progress` and `Type`, this step **requires configured options** and does not fall back to live rows.
     - Skips excluded headers (`AUTO_VIEW_EXCLUDED_HEADERS`: `Code`, `Name`, `Status`, `Progress`, `Type`, `CreatedAt`, `UpdatedAt`, `Revision`, `CreatedBy`, `UpdatedBy`, `AccessRegion`, as well as headers ending in `Code` except `Code`).
   - **No Views Produced**: If no candidate column exists or candidate columns yield no option values (and no live-row values for `Progress`/`Type`), **no views** are produced (`[]`).
   - **Item Formatting**: Each distinct value becomes a view where `name` is humanized (`humanizeToken`, e.g. `"IN_PROGRESS"` → `"In Progress"`), `default: true` is assigned to the first item, `color` is picked via `colorForToken` (`positive`, `negative`, `warning`, `primary`, or `grey`), and a condition filter checks `column eq value`.

### 5.1.1. Filter JSON Schema Reference
The root of the `filter` property must be either a **Group Object** or a **Condition Object**. A raw array at the root is **not a valid filter schema** (even though permissive evaluator fallback treats unrecognized nodes as matching all rows).

#### A. Group Object (`type: "group"`)
Used to join multiple conditions or nested groups with logical operators:
- `type`: Must be `"group"`.
- `logic`: Either `"AND"` or `"OR"` (defaults to `"AND"`).
- `items`: An array of filter objects. Can recursively contain nested group objects or condition objects.

#### B. Condition Object (`type: "condition"`)
Represents a single query comparison:
- `type`: Must be `"condition"`.
- `column`: String matching the exact Google Sheet header column name.
- `operator` (or alias `op`): String operator mapping to comparison logic.
- `value`: The target comparison value. Can be a string, number, array (for `in`/`not_in`), or a **dynamic token** such as `"$startOfMonth"`, `"$daysIn:7"` or `"$userRoles"` — see [Section 5.2](#52-dynamic-tokens-date-time--current-user). Not required for `empty` and `notEmpty`.

#### C. Supported Comparison Operators & Aliases
The evaluator ([`FRONTENT/src/utils/tokenEvaluator.js`](file:///f:/AQL/FRONTENT/src/utils/tokenEvaluator.js#L356-L380)) normalizes operator strings (case-insensitively) and supports the following canonical operators and aliases:

| Canonical Operator | Accepted Aliases | Description & Behavior |
| :--- | :--- | :--- |
| `eq` | | Equal to. Case-insensitive string comparison or exact token comparison. |
| `neq` | `ne` | Not equal to. Case-insensitive string comparison or exact token comparison. |
| `in` | | Checks if row value is in target list (case-insensitive strings or coerced values). |
| `not_in` | `nin`, `notin` | Checks if row value is NOT in target list. |
| `gt` | | Greater than. Evaluates numerically if both sides are finite numbers, otherwise falls back to lowercase string comparison. |
| `gte` | | Greater than or equal to (numeric-then-string ordered comparison). |
| `lt` | | Less than (numeric-then-string ordered comparison). |
| `lte` | | Less than or equal to (numeric-then-string ordered comparison). |
| `contains` | | Substring match. Checks if row value string contains search string (case-insensitive). |
| `empty` | | Checks if column is blank. Takes no target `value`. |
| `notEmpty` | `not_empty`, `notempty` | Checks if column is not blank. Takes no target `value`. |

#### D. Evaluation Mechanics
- **Exact Column Lookup (`column in row`)**: In list views (`strictColumn: true`, the default), the column must be present in the row (`column in row`). If the column is missing from the row, the condition immediately evaluates to `false` before checking any operator — including `empty` and `notEmpty`. (Only lenient evaluation with `strictColumn: false`, used by action `visibleWhen`, evaluates a missing column as an empty value).
- **What Counts as Empty**: When the column exists on the row, an empty value (`isBlank`) is strictly `undefined`, `null`, or empty string `""`. Zero (`0`) and `false` are considered non-empty values.
- **Ordered Comparisons (`gt`, `gte`, `lt`, `lte`)**:
  - **Plain (Literal) Values**: Evaluates numerically if both sides are finite numbers (`Number.isFinite`), otherwise falls back to case-insensitive string comparison (`toLowerCase()`).
  - **Token Values**: Does not use literal numeric-then-text fallback. The column and token are converted into the token's defined comparison space using their declared `coerce` / `coerceToken` pipelines (e.g. epoch ms, signed days, signed hours, ISO strings), and then compared directly.
- **Operator Key**: Conditions can specify the operator via either `operator` or `op`.

---

## 5.2. Dynamic Tokens (Date/Time & Current User)

A condition `value` may be a **token string** instead of a literal. Tokens resolve at evaluation
time against the clock and the logged-in user, so one sheet-authored view stays correct as the
date rolls over or a different user signs in.

Registry: [`src/utils/tokenEvaluator.js`](file:///f:/AQL/FRONTENT/src/utils/tokenEvaluator.js).
Token names are **case-insensitive** (`$startofmonth` works). In the **Manage Lists** admin
dialog they appear in the grouped `Token...` dropdown next to each condition's value input.

The same registry backs an action's `visibleWhen` (**Manage Actions** → *Visible When*), which is
evaluated by the same module — so `Date` / `lte` / `$startOfDay:0` hides an action on
future-dated records and `OwnerCode` / `eq` / `$userCode` shows one only to its owner.

### 5.2.1. Two-Sided Coercion

A token can only be compared against a sheet column when both sides sit in the same space. AQL
sheets store dates in two shapes — audit columns (`CreatedAt`/`UpdatedAt`) hold **epoch
milliseconds**, business date columns (`Date`, `DueDate`, `VisitDate`) hold **ISO strings**,
sometimes with a time component.

Each token therefore declares two pipelines of named primitives from `COERCES`:

| Field | Applies to | Default |
| :--- | :--- | :--- |
| `coerce` | the **column** value | — (required) |
| `coerceToken` | the **resolved token** value | falls back to `coerce` |

Most tokens are symmetric, so `coerce` alone covers both sides. The relative-day tokens are
deliberately asymmetric: the column is converted to *signed days from today* while the token
stays a plain number.

Because both pipelines run, **the same token works against either storage format** —
`gte $startOfMonth` behaves identically on `CreatedAt` (epoch ms) and `VisitDate` (ISO string).

> [!NOTE]
> **Numeric NaN Guard vs String Date Tokens:**
> When a token uses numeric coercion (epoch ms, dayNum, hourNum, year), an unparseable or blank column resolves to `NaN`. The evaluator explicitly guards against this (`typeof left === 'number' && Number.isNaN(left) return false`), so unparseable column values never match under any comparison, including `neq` / `not_in`.
> In contrast, tokens with string pipelines (`$dateTime`, `$date`, `$month`) coerce unparseable/blank values to an empty string `""` (or empty month). They do not trigger the NaN guard, so `neq` or `lt` can match blank rows against string date tokens. Pair string comparisons with a `notEmpty` condition when blank rows must be excluded.

> [!NOTE]
> **Calendar dates are read literally.** A trailing `Z` on a column value does not shift the day —
> `2026-08-02T20:00:00.000Z` buckets as 2 Aug regardless of the viewer's timezone. This matches
> the long-standing `.slice(0, 10)` behaviour in `useOutletVisits` and keeps day buckets stable
> across regions. Date arithmetic itself is delegated to `date-fns`; only the parse/dispatch step
> in [`dateHelpers.js`](file:///f:/AQL/FRONTENT/src/utils/dateHelpers.js) is AQL-specific.

### 5.2.2. Date & Time Tokens

| Token | Resolves to | Column is compared as |
| :--- | :--- | :--- |
| `$now` | Current timestamp (13-digit ms) | epoch ms (numeric) |
| `$dateTime` | Current instant as `YYYY-MM-DD HH:mm:ss` (24-hour) — the shape GAS stamps into `...At` / `RespondDate`. Takes **no** `:N` offset | `YYYY-MM-DD HH:mm:ss` (string) |
| `$date[:N]` | Today as `YYYY-MM-DD` (or N-day offset: `$date:0` = today, `$date:1` = tomorrow, `$date:-1` = yesterday) | `YYYY-MM-DD` (string) |
| `$day` | Day of year, `1`-`366` | day of year (numeric) |
| `$month[:N]` | Current month as `"01"`-`"12"` (or N-month offset: `$month:0` = current, `$month:1` = next month, `$month:-1` = previous month) | zero-padded month string `"01"`-`"12"` |
| `$year` | Current year, `YYYY` | 4-digit year (numeric) |
| `$week` | Current ISO week, `1`-`53` | ISO week number (numeric) |
| `$startOfDay[:N]` | Day 00:00:00.000 ms with N-day offset (default N=0 for today) | epoch ms (numeric) |
| `$endOfDay[:N]` | Day 23:59:59.999 ms with N-day offset (default N=0 for today) | epoch ms (numeric) |
| `$startOfMonth[:N]` | 1st of month 00:00:00.000 ms with N-month offset (default N=0 for this month) | epoch ms (numeric) |
| `$endOfMonth[:N]` | Last of month 23:59:59.999 ms with N-month offset (default N=0 for this month) | epoch ms (numeric) |

> ISO weeks run 1-53, not 1-52 — week 53 exists in years whose first Thursday falls late
> (e.g. 2026-12-31 is week 53).

> [!NOTE]
> **`$dateTime` is a full instant, so `eq` against it effectively never matches** — the
> seconds have already moved on. The useful comparisons are the ordered ones, which work
> because the format sorts lexicographically: `lt $dateTime` means "already in the past".
> For day-granularity buckets use `$date:N` or `$daysIn:N` instead. Its real job is the
> **action expression** grammar — seeding a `...At` column from an `AdditionalActions`
> target, where `$now`'s epoch ms would land an unreadable number in a cell a human reads.
>
> Its coercion pipeline is **string-valued**, so it follows the `$date` family rather than
> the epoch family on a blank or unparseable column: the NaN guard does not fire, the
> column reads as `""`, and `lt`/`neq` therefore still match those rows. Pair it with a
> `notEmpty` condition when blanks must be excluded.

### 5.2.3. Relative-Day Tokens (Parameterised)

Omitting `:N` uses the registered runtime default (`paramDefault`). For example, `$daysAgo` is equivalent to `$daysAgo:7`, and `$daysIn` is equivalent to `$daysIn:30`. Explicit parameters (such as `$daysIn:0`, negative values, or decimals) take precedence.

| Token | Resolves to |
| :--- | :--- |
| `$daysAgo[:N]` | `-N` (past, negative number; runtime default N=7) |
| `$daysIn[:N]` | `+N` (future, positive number; runtime default N=30) |

The column is converted to **signed whole days from today** — future positive, past negative,
today `0`. Both are floored to local midnight, so a time component on the column is ignored.

> [!WARNING]
> **Rolling windows need both edges.** A single `lte $daysIn:7` also matches every overdue
> record, because an invoice due 90 days ago has an offset of `-90` and `-90 <= 7`. Always pair
> the bounds:
> ```json
> { "type": "group", "logic": "AND", "items": [
>   { "type": "condition", "column": "DueDate", "operator": "gte", "value": "$daysIn:0" },
>   { "type": "condition", "column": "DueDate", "operator": "lte", "value": "$daysIn:7" }
> ]}
> ```

Common single-sided patterns that are correct as-is:

| Intent | Condition |
| :--- | :--- |
| Overdue | `DueDate` `lt` `$daysIn:0` |
| Due today | `DueDate` `eq` `$daysIn:0` |
| Aged 30+ days | `DueDate` `lt` `$daysAgo:30` |

### 5.2.3a. Relative-Hour Tokens (Parameterised)

Omitting `:N` uses the registered runtime default (`paramDefault`). For example, `$hoursAgo` is equivalent to `$hoursAgo:24`, and `$hoursIn` is equivalent to `$hoursIn:24`.

| Token | Resolves to |
| :--- | :--- |
| `$hoursAgo[:N]` | `-N` (past, negative number; runtime default N=24) |
| `$hoursIn[:N]` | `+N` (future, positive number; runtime default N=24) |

The column is converted to **signed whole hours from now** — future positive, past negative,
truncated toward zero (90 minutes ago reads as `-1`). Unlike the day family the column is **not**
floored to local midnight, so its time component is what makes the comparison. Use these only for
sub-day windows; anything measured in days belongs to `$daysAgo` / `$daysIn`, which are stable
across a clock that keeps moving.

Because the column keeps its time part, these are the right tokens for the datetime stamps GAS
writes — `RespondDate`, `ProgressCompletedAt` and the rest of the `...At` family — and they work
equally on an epoch-ms audit column.

> [!WARNING]
> **Rolling windows need both edges here too.** `gte $hoursAgo:48` alone also matches anything
> dated in the future, whose offset is positive. Pair the bounds:
> ```json
> { "type": "group", "logic": "AND", "items": [
>   { "type": "condition", "column": "RespondDate", "operator": "gte", "value": "$hoursAgo:48" },
>   { "type": "condition", "column": "RespondDate", "operator": "lte", "value": "$hoursIn:0" }
> ]}
> ```

### 5.2.4. Current-User Tokens

| Token | Resolves to | Coercion Pipeline |
| :--- | :--- | :--- |
| `$userCode` | `user.code ?? user.id` (GAS maps `UserID` → `id`) | trimmed lowercase (`slug`) |
| `$userEmail` | `user.email` | trimmed lowercase (`slug`) |
| `$userName` | `user.name` | trimmed lowercase (`slug`) |
| `$userDesignation` | `user.designation.name` | trimmed lowercase (`slug`) |
| `$userRole` | `user.role` (primary role) | trimmed lowercase (`slug`) |
| `$userRoles` | **Array** of all role names (`user.roles`) | trimmed lowercase (`slug`) per element |
| `$userRegion` | `user.accessRegion.code` | trimmed lowercase (`slug`) |
| `$userRegions` | **Array** with user region code (`[user.accessRegion.code]`) | trimmed lowercase (`slug`) per element |

All are compared case-insensitively and trimmed via `slug`.

#### Array-Valued Tokens
Array-valued tokens (`$userRoles` and `$userRegions`) declare `array: true`. When evaluated in `prepareCondition`, they coerce each element individually so they can be matched with `in` or `not_in`:

```json
{ "type": "condition", "column": "Role", "operator": "in", "value": "$userRoles" }
```

> [!NOTE]
> **Current Limitation of `$userRegions`**:
> While `$userRoles` extracts all assigned role names from the user's roles list, `$userRegions` currently wraps only the user's single primary region code: `[user.accessRegion.code]`. It resolves to an array of one item (the same region as `$userRegion`).

A literal list may also mix tokens and plain values — `["Viewer", "$userRoles"]` flattens each entry, allowing compound permission checks.

### 5.2.5. Worked Example — "My Open Visits This Week"

```json
{
  "name": "My Week",
  "color": "primary",
  "filter": {
    "type": "group",
    "logic": "AND",
    "items": [
      { "type": "condition", "column": "AssignedTo", "operator": "eq",  "value": "$userCode" },
      { "type": "condition", "column": "Progress",   "operator": "in",  "value": ["PLANNED", "IN_PROGRESS"] },
      { "type": "condition", "column": "VisitDate",  "operator": "gte", "value": "$daysIn:0" },
      { "type": "condition", "column": "VisitDate",  "operator": "lte", "value": "$daysIn:7" }
    ]
  }
}
```

### 5.2.6. Adding a Token

1. Add the entry to `TOKENS` in [`tokenEvaluator.js`](file:///f:/AQL/FRONTENT/src/utils/tokenEvaluator.js), with `value(params, ctx)` as a plain extractor plus its `coerce` / `coerceToken` pipelines. Add a new primitive to `COERCES` only if no composition of the existing ones fits.
2. Mirror it in the `TOKENS` array in [`GAS/listViewsManager.html`](file:///f:/AQL/GAS/listViewsManager.html) so admins can pick it from the dropdown. Parameterised tokens set `param` to the seeded default.
3. Document it in the tables above.

Pipeline names are validated at module load — an unknown `COERCES` key throws immediately
rather than silently producing an empty tab.

### 5.2.7. Runtime Notes

- **Filters are compiled once per pass.** `prepareFilter(filter, ctx)` walks the tree once and resolves every token (`spec.value` + the `coerceToken` pipeline) plus the normalised forms of literal values into a prepared node; `evaluatePreparedFilter(prepared, row)` then runs per row and does no token parsing at all. `viewCounts` / `viewFilteredItems` use this pair, so token cost is O(conditions) rather than O(conditions × rows). `evaluateFilter(filter, row, ctx)` remains as the single-row entry point and simply prepares-then-evaluates.
- **Date tokens resolve when the view recomputes**, not on a timer. `viewCounts` / `viewFilteredItems` re-run when the records or the view set change, which covers normal navigation and refresh. A session left open across local midnight keeps the previous day's buckets until the next reload or data refresh. All rows in one pass therefore see the *same* token values — a pass can no longer straddle a midnight rollover.
- **Filtering is client-side.** Tokens evaluate against the rows already loaded, so counts reflect the fetched set, not the whole sheet.
- **Non-token conditions are unchanged** — literals still use the original numeric-then-string coercion.

---

### 5.3. Sheet Modes vs. UI Component Overrides

Understanding how sheet configuration interacts with frontend customization requires distinguishing between **domain view calculation** (`useListViews.js`) and **UI section rendering** (`useSectionResolver.js` / `ListSwitcher.vue`):

#### 5.3.1. How Sheet Modes Affect Domain Views (`effectiveViews`)
The sheet's `ListViews` cell governs the default domain views computed by `useListViews.js`:
1. **`"off"` Mode (`[]` in cell)**:
   - `effectiveViews` computes to empty `[]`.
   - By default, no views or tabs exist for this resource.
2. **`"custom"` Mode (`[...]` non-empty array in cell)**:
   - `effectiveViews` returns the sheet-authored custom views.
3. **`"auto"` Mode (blank cell or non-array fallback)**:
   - `effectiveViews` dynamically generates auto-views based on scope and column metadata (e.g. Active/Inactive for master resources with `Status`, or Progress/Type for operation resources).

#### 5.3.2. Rendering & Resolution Path (`ListSwitcher`)
The standard UI component that renders list views is [`ListSwitcher.vue`](file:///f:/AQL/FRONTENT/src/components/sections/ListSwitcher.vue) (mounted via `<Section section="ListSwitcher" />`).

Section resolution is handled by [`useSectionResolver.js`](file:///f:/AQL/FRONTENT/src/composables/resources/useSectionResolver.js). The section resolver resolves UI component overrides (`_ui/.../ListSwitcher.vue`) and JS modifiers (`_ui/.../ListSwitcher.js`) based solely on file lookup candidates. **The sheet's `ListViews` cell mode does not block or disable `useSectionResolver` from resolving custom Vue overrides or JS modifiers.**

#### 5.3.3. Items Precedence in `ListSwitcher.vue`
When `ListSwitcher.vue` renders, it determines its items through [`finalAttrs.value.items`](file:///f:/AQL/FRONTENT/src/components/sections/ListSwitcher.vue#L101-L104):
1. **Explicit `items` Prop / JS Modifier**:
   - If a JS modifier (`ListSwitcher.js`) or parent template provides an explicit `items` property (array or function), that explicit items array is rendered directly.
   - An explicit `items` override completely replaces the views displayed in `ListSwitcher`, bypassing whatever `effectiveViews` computed.
2. **Fallback to `resourceRecord.effectiveViews`**:
   - If `items` is not provided (or is `null`/`undefined`), `ListSwitcher.vue` falls back to `resourceRecord.effectiveViews.value`.
   - In this case, the switcher displays the views produced by the sheet mode (`auto`, `custom`, or `off`). If `effectiveViews` is empty (such as in `"off"` mode), `ListSwitcher.vue` renders nothing (`v-if="finalAttrs.items && finalAttrs.items.length"`).

---

⬑ Back to **[AQL Frontend List Switcher Architecture](UI_LIST_SWITCHER.md)**.
