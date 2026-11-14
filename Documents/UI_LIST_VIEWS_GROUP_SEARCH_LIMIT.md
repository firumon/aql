# ListViews - Group, Search, and Limit

Part of [ListViews](UI_LIST_SWITCHER.md).
Read [sheet setup](UI_LIST_SWITCHER_SHEET.md) for the manager.
The row stages run Group -> Map -> Filter -> Order -> Search -> Limit.
[Props and Target](UI_LIST_SWITCHER_COMPONENTS.md#46-override-export-shapes) then prepare view settings.
[Content, Meta, Style, and Actions](UI_LIST_VIEWS_ITEMS.md) prepare display and action props.
These stages keep the input rows unchanged.
Each stage returns a flat row array.

## Group

[01Group.js](../FRONTENT/src/composables/resources/listViews/features/01Group.js#L66)
runs before Filter. Each rule keeps the first row for each group value.
It adds facts to the kept rows. The output is a flat array of those rows.
Group returns row objects without header or bucket objects.

The config is an array of rules:
```json
{
  "group": [
    {
      "column": "CreatedAt",
      "token": "$date",
      "aggregate": { "Amount": ["sum", "min", "max", "avg"] }
    }
  ]
}
```

This rule shows every supported rule key. `column` is required. Leave out `token`
or `aggregate` when the group does not need them.

| Rule key | Accepted value | If missing |
|---|---|---|
| `column` | Required non-blank field name or safe dot path | The rule is invalid. |
| `token` | Built-in token name, with or without `$`, or a custom Group token name. See [Group token values](UI_LIST_VIEWS_TOKENS.md#group-token-values-and-custom-files). | Uses the raw column value. |
| `aggregate` | Object: field path -> one name or an array of names from `sum`, `min`, `max`, `avg`. Names are case-sensitive. | No aggregate facts are added. |

Missing `group`, null, false, or [] does no grouping.
With no ready Group override, this returns the same input array.

### One rule

Rows with the same `String(groupValue)` share a bucket.
Keys are case-sensitive; null and undefined become their string forms.
Each bucket keeps its first member in incoming order.
Bucket order follows the first time each value is seen.
Order runs later, so it cannot change which member Group kept.
For the newest member per group, set the input order in the Data stage or use a Group override.

For input A (PLANNED, Amount 10), B (PLANNED, Amount 20), and C (DONE, Amount 5),
grouping by Progress returns A and C.
B is removed from the array. It still counts in PLANNED's first-pass facts.

Each kept row receives facts for its own bucket:

| Fact key pattern | Value |
|---|---|
| `_group_{column}_{value}_size` | Number of members entering that rule's bucket |
| `_group_{column}_{value}_0` | First member entering that bucket |
| `_group_{column}_{value}_{aggregate}_{aggregateColumn}` | The requested aggregate value |

For the PLANNED bucket above:

- `_group_Progress_PLANNED_size` is 2.
- `_group_Progress_PLANNED_0` points to source row A.
- `_group_Progress_PLANNED_sum_Amount` is 30.
- `_group_Progress_PLANNED_avg_Amount` is 15.

Use the full key in brackets in JS when it contains dots, spaces, or symbols.
The shared readField checks an exact key before walking dots.
Later Filter and Order can use these facts.

### More than one rule

Rule 1 groups the full stage input.
Rule 2 groups only rule 1's kept rows. Rule 3 groups only rule 2's kept rows.
This is not a combined key made from every column.

For example:
```json
{
  "group": [
    { "column": "Progress", "aggregate": { "Amount": "sum" } },
    { "column": "Region", "aggregate": { "Amount": "sum" } }
  ]
}
```

With A (PLANNED, North, 10), B (PLANNED, South, 20), and C (DONE, North, 5):

1. Progress keeps A and C. A has a PLANNED total of 30.
2. Region sees A and C only. It keeps A for North.
3. A has North size 2 and North Amount total 15. B's 20 is not in that second total.
4. The final row A carries its own bucket facts from both passes.

Facts are added after all passes. A later Group rule cannot read a fact just made
by an earlier rule in the same Group feature.
The `_0` values point to the pass's incoming rows, before these facts are added.
If two rules make the same fact key, the later value replaces it.

### Aggregates and later features

Each aggregate reads one scalar from each row entering its bucket.
Type is inferred with valueType; Group has no `type` rule option.
Sum/avg need numeric values. Numeric strings can work.
Min/max use the shared text/number/date comparison.
Blank or unparseable converted values are omitted.
With no usable values, sum is 0; min/max/avg are null.
Child-array aggregates are not supported here; expose a scalar fact first.
This differs from Order's per-row child aggregates.

The output uses decorateRow, which keeps the chosen row's fields and getters.
It does not change source objects. Enabled grouping drops non-object entries.
Filter, Order, Search, and Limit see only the final kept rows.
Their later changes do not rebuild the earlier bucket sizes or totals.
For example, filtering Progress after grouping may remove a whole kept bucket row.
The public count is the final row count after all stages and overrides.

### Group tokens and override

A built-in token uses only its column-side conversion.
For example, `$date` turns a date into YYYY-MM-DD; `$month` gives a month number string.
It does not resolve today's value or apply token offset parameters for grouping.
Thus `$date:1` groups by the same column date as `$date`.

Custom functions use `(value, ctx)`, where ctx currently has user.
See [Group token files](UI_LIST_VIEWS_TOKENS.md#group-token-values-and-custom-files).

The Group override is `list{Name}Group.js`.
It receives `(afterGroupRows, beforeGroupRows, viewConfig)`.
The first array has the kept, decorated rows; the second is the full Group stage input.
Its returned array replaces Group's result. Returning beforeGroupRows restores that input.
It can run without view.group.
In that ready-override case, the current core wraps every row with empty facts first.
Do not rely on the two arguments having the same array or row identity.

### Sheet manager limit

Use direct ListViews cell JSON for lasting Group arrays, or the debug editor for an
in-memory test. The manager does not accept the Group array.

## Search

[05Search.js](../FRONTENT/src/composables/resources/listViews/features/05Search.js)
reads view.search and config.term.
The term comes from usePageRecord.filterTerm through the pipeline.
The debug switcher exposes it as debug.searchTerm.
Raw spine records are never filtered.

An explicit field list:
```json
{
  "search": ["Code", "Progress", "$outlet.Name", "$VisitLines.Remark"]
}
```

Use actual relation names. Child paths can return arrays.
Search flattens those values to text, joins the fields with spaces, and lowercases them.
The term is trimmed and lowercased. One substring check decides each match.
It is not a separate-word, fuzzy, or regular-expression search.
Numbers/dates keep their String(value) form; display formatting and tokens do not run.

The frontend also accepts comma-separated text. This stores fewer characters in the
sheet, so it is the compact form when field names do not contain commas:
```json
{ "search": "Code,Progress,$outlet.Name" }
```

The current sheet manager rejects that string form. It must be updated before it
can save the compact form; direct ListViews cell JSON can use it now. Use an array
if a field name contains a comma because this string form has no quote/escape syntax.
Do not use search: true as a field selector; the current feature treats it as the field name "true".

### Default fields

With no explicit fields and no Search override, the feature chooses fields from
the first object row at this stage.

It skips keys starting with _ or $ and keys ending in At.
It keeps keys ending in Name, Code, Date, or Comment,
starting with Progress, or containing Remark. These name tests ignore case.

It also reads the first row's relation metadata for parent and reference resources
whose auth scope is Master.
It adds matching fields from those available parent objects.
It does not add every child or every related resource.
If the first row lacks a parent, that parent's fields may not enter the default set.
Use explicit paths when the intended field set must be fixed.

Absent search, null, false, and an empty string all mean "no explicit fields".
Without an override, each of these uses default fields.
In particular, search: false does not disable default search in the current code.
An explicit empty array, or a comma list with no fields, throws.

Each prepared row is wrapped with decorateRow and gains _search_filter_term.
Its source fields and relation getters stay available.
An empty search term keeps all prepared rows.
If no default fields are found, a non-empty term matches no row.

### Search override gate

Search differs from the other overrides:

| Config and file | Result |
|---|---|
| No explicit search fields, no override | Default fields and normal search |
| Explicit fields, no override | Search those fields |
| Explicit fields, override loading | Core search result |
| Explicit fields, override ready | Call override with core rows, stage input, view |
| No explicit fields, override loading or ready | Pass input through; do not call override |
| Override load error | Surface the error |

With explicit fields, list{Name}Search.js must default-export a function:
```js
export default (afterSearchRows, beforeSearchRows, viewConfig) => afterSearchRows
```

The first array contains decorated, searched rows.
The second is the stage input after Order.
The three-argument contract does not pass the term as a fourth argument.
Use the prepared result when extending core search.
An override can deliberately restore beforeSearchRows.

Without explicit fields, even a ready invalid export is not checked because of the early return.
The callback requires explicit search fields.

## Limit

[06Limit.js](../FRONTENT/src/composables/resources/listViews/features/06Limit.js)
reads view.limit after Search:

```json
{ "limit": 25 }
```

Omitted or null means no cap. Zero means no core rows.
The value must be an integer of zero or more.
Strings, false, negative numbers, and fractions throw.
There is no separate page size or pagination state here.

Core uses rows.slice(0, limit).
Limit applies to the whole array, not once per group.
The override list{Name}Limit.js receives (afterLimitRows, beforeLimitRows, viewConfig).
It can run without a limit key, and its array can exceed the core cap.
The public count uses the final array after the Limit override and the display stages.
Display stages keep the row count; a display error still fails that view with count 0.
No pre-limit match count is exposed.

## Combined config

Paste this full array in the debug editor or the ListViews cell:
```json
[
  {
    "name": "All",
    "group": [{ "column": "Progress", "aggregate": { "Amount": "sum" } }],
    "order": [{ "column": "UpdatedAt", "order": "desc", "type": "epoch" }],
    "search": ["Code", "Progress", "$outlet.Name"],
    "limit": 25
  }
]
```

Use real fields for the resource.
In the manager's extra settings box, use one object without group.
It can save order, a search array, and limit. Save Group arrays directly in the ListViews cell.

## Override rules shared by these features

See [paths and export shapes](UI_LIST_SWITCHER_COMPONENTS.md#45-override-lookup).
Page-level files win over resource-level files.
Callbacks are synchronous and return an array or a ref/computed of an array.
The feature unwraps the result and returns a plain array to the chain.
Do not mutate the incoming array.
Do not assume the second argument means all source/store rows.
