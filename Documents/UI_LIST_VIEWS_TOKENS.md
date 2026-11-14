# ListViews - Filter Operators and Tokens

Part of the [ListViews guide](UI_LIST_SWITCHER.md).
It covers `view.filter` and each Order rule's `on`.
[Sheet setup](UI_LIST_SWITCHER_SHEET.md) shows where to enter them.

The shared code is [tokenEvaluator.js](../FRONTENT/src/utils/tokenEvaluator.js).
The same evaluator also serves action `visibleWhen`.

## Condition and group

```json
{
  "type": "group",
  "logic": "AND",
  "items": [
    { "type": "condition", "column": "Progress", "operator": "in", "value": ["PLANNED", "IN_PROGRESS"] },
    { "type": "condition", "column": "CreatedBy", "operator": "eq", "value": "$userCode" }
  ]
}
```

| Node/key | Accepted value | If missing |
|---|---|---|
| Node `type` | `condition` or `group` | Unknown or missing type acts as a match-all node. |
| Condition `column` | Field name or dot path | The condition matches no rows. |
| Filter condition key | `operator` or `op` | Unknown or missing operator matches no rows. |
| Order `on` condition key | `operator` only | Missing or unknown operator makes the Order config invalid. |
| Condition `value` | JSON string, number, boolean, array, or supported token string | Needed for most operators; `empty` and `notEmpty` use only the column. |
| Group `logic` | Exact uppercase `AND` or `OR` | Uses `AND`. |
| Group `items` | Array of condition/group nodes | Uses an empty list, which matches all rows. |

A condition needs `type`, `column`, and `operator`.
Most operators also need `value`.
The shared evaluator accepts `op` for Filter conditions.
Order's own `on` normalizer accepts only `operator`; `op` and `oper` make the Order condition invalid.
Filter requires canonical node types; it does not accept Order's type-less shorthand.
Use uppercase AND/OR. The shared evaluator uses OR only for exact `"OR"`.
Empty groups match all rows. An unknown or missing node type is treated as a
match-all node; inside an OR group, such a node makes the group match.
An unknown Filter operator matches no rows; an unknown Order `on` operator makes the config invalid.

## Operators

Operator names are case-insensitive.

| Operator | Alias | Meaning |
|---|---|---|
| `eq` | | Equal |
| `neq` | `ne` | Not equal |
| `in` | | Row value is in the target list |
| `not_in` | `nin`, `notin` | Row value is not in the target list |
| `gt` | | Greater than |
| `gte` | | Greater than or equal |
| `lt` | | Less than |
| `lte` | | Less than or equal |
| `contains` | | Text contains the target text |
| `empty` | | Undefined, null, or empty string; no value needed |
| `notEmpty` | `not_empty`, `notempty` | Not one of those blank values |

Zero, false, and whitespace-only text are not empty in filters.
This differs from Order's blank handling.

Literal string checks ignore case but do not trim.
Ordered literal checks use numbers if both sides convert to finite numbers;
otherwise they compare lowercase text.
Use a date token when the comparison needs date conversion.
`in` compares one row value with target entries. It is not a child-array query.
In saved JSON, use an array for multiple literal values; the manager converts its
comma-separated input into an array.

Filter and Order's `on` pass `strictColumn: false`.
Field values are read through readField, so scalar parent paths work.
A missing key is read as undefined rather than being rejected at the column check.
The generic evaluator's default is strict; do not confuse that default with these callers.

## How tokens work

Put a token string in `value`, such as `"$date"` or `"$daysIn:7"`.
Names ignore case. Parameters follow colons.
A known token uses its registered default when a parameter is omitted.
An unknown token stays a literal string; it does not cause a validation error.

Each token defines two conversion paths:

- `coerce` converts the row value.
- `coerceToken` converts the resolved token value.
  If absent, it uses `coerce`.

These are lists of names from `COERCES`, not inline functions.
`prepareFilter` resolves tokens once per pass.
`evaluatePreparedFilter` runs the prepared tree for each row.
A token anywhere in a target array governs conversion for the whole condition.
Array-returning tokens are flattened and converted one entry at a time.

## Date and time tokens

| Token | Meaning | Row comparison |
|---|---|---|
| `$now` | Current time | Epoch milliseconds |
| `$dateTime` | Current `YYYY-MM-DD HH:mm:ss`; no offset | Same date-time text |
| `$date[:N]` | Today plus N days; default 0 | `YYYY-MM-DD` |
| `$day` | Day of year, 1-366 | Day of year |
| `$month[:N]` | Month plus N months; default 0 | Two-digit month |
| `$year` | Current year | Year number |
| `$week` | Current ISO week, 1-53 | ISO week number |
| `$startOfDay[:N]` | Day start plus N days; default 0 | Epoch milliseconds |
| `$endOfDay[:N]` | Day end plus N days; default 0 | Epoch milliseconds |
| `$startOfMonth[:N]` | Month start plus N months; default 0 | Epoch milliseconds |
| `$endOfMonth[:N]` | Month end plus N months; default 0 | Epoch milliseconds |
| `$daysAgo[:N]` | Negative absolute N; default 7 | Signed whole days from today |
| `$daysIn[:N]` | Positive absolute N; default 30 | Signed whole days from today |
| `$hoursAgo[:N]` | Negative absolute N; default 24 | Signed whole hours from now |
| `$hoursIn[:N]` | Positive absolute N; default 24 | Signed whole hours from now |

Past offsets are negative. Future offsets are positive.
Days compare calendar days. Hours keep the time and truncate toward zero.
Month and week tokens compare that part only; they do not also check the year.

The shared [date parser](../FRONTENT/src/utils/dateHelpers.js#L28) accepts Date objects,
millisecond timestamps, and supported date text.
Y-M-D text is read as a local calendar date without shifting a trailing Z.
Prefer clear Y-M-D dates; ambiguous fallback formats depend on the parser.
Filter token conversion does not use Order's Unix-seconds conversion.
Do not pass a prepared day-count number to a date token.

A parsed numeric NaN row value never matches a token condition, even `neq`.
String date conversions can produce `""`; those blanks can match `neq` or `lt`.
Add `notEmpty` if blanks must be excluded.

### Date window example

Due today through seven days ahead:
```json
{
  "type": "group",
  "logic": "AND",
  "items": [
    { "type": "condition", "column": "DueDate", "operator": "gte", "value": "$daysIn:0" },
    { "type": "condition", "column": "DueDate", "operator": "lte", "value": "$daysIn:7" }
  ]
}
```

A lone `lte $daysIn:7` also includes every overdue date.
For the last 48 hours, pair `gte $hoursAgo:48` with `lte $hoursIn:0`.
For a number already holding days until due, use literal numeric bounds such as 0 and 7.

## Current-user tokens

These read the auth payload, not sheet header spellings.

| Token | Reads |
|---|---|
| `$userCode` | `user.code ?? user.id` |
| `$userEmail` | `user.email` |
| `$userName` | `user.name` |
| `$userDesignation` | `user.designation.name` |
| `$userRole` | `user.role` |
| `$userRoles` | Role strings or each entry's name in `user.roles` |
| `$userRegion` | `user.accessRegion.code` |
| `$userRegions` | Array with only that same region code, or an empty array |

User token values are trimmed and lowercased.
Use `in` or `not_in` with `$userRoles` or `$userRegions`.
`$userRegions` does not expand the full allowed region tree.
Missing user fields do not throw, but can become blank values.
A list filter is not a permission check.

## Time and reactivity

Tokens resolve when the computed result runs again.
There is no timer that refreshes date tokens at midnight.
A page left open can keep earlier token values until data, config, user state,
or another tracked dependency changes.
Counts only describe the loaded rows.

## Group token values and custom files

Group uses tokenizeValue(value, token), a module export from tokenEvaluator.
It accepts a token name with or without $.
For a built-in token it applies only the registered coerce path to the row value.
It does not resolve the token's current-user/time value, coerceToken, or offset parameters.
For example, $date:1 does not move a Group date one day forward.
An unknown name returns null so Group can try a custom function.

The pipeline supplies tokenFor(name) from useTokenOverrides.
This is separate from list{Name}Group.js.
Lookup is resource-level first, then UI-wide:

1. FRONTENT/src/_ui/{Ui}/composables/{Scope}/{Resource}/token{Name}.js
2. FRONTENT/src/_ui/{Ui}/composables/token{Name}.js

There is no page tier and no list name in these paths.
For AQL / Operation / OutletVisits and token VisitBand, the first file is:
FRONTENT/src/_ui/AQL/composables/Operation/OutletVisits/tokenVisitBand.js.

Default export:
```js
export default (value, ctx) => Number(value) >= 10 ? 'High' : 'Low'
```

Use that file in a Group rule:
```json
{
  "group": [
    { "column": "Amount", "token": "VisitBand" }
  ]
}
```

Return a stable scalar key synchronously.
The callback receives the raw field value and ctx; token parameters are not passed separately.
Group stringifies the returned key. It does not validate a promise or object result.
Keep the function pure; Group can read the value more than once per pass.

A built-in conversion result wins when it is not null/undefined. If that result
is null/undefined and the custom file is missing or loading, Group uses the raw
field value. The computed re-runs when the module is ready. The custom loader is
checked for each named token: an error state or ready non-function throws.
This custom token path is currently used by Group, not Filter or Order conditions.

Registry keys remove the leading `../../../` from each glob path and lowercase the rest.
All path segments and token names are compared without case.
Token names use the shared PascalCase helper before lowercase lookup.
States are reactive: none, loading, ready, or error.
A matching resource file wins over a UI-wide file. A failed resource file surfaces its error.

Source: [useTokenOverride.js](../FRONTENT/src/composables/resources/listViews/useTokenOverride.js#L14)
and [Group](../FRONTENT/src/composables/resources/listViews/features/01Group.js#L110).
