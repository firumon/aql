# ListView Filters and Tokens Work

Use this prompt for ListViews filter operators, comparison tokens, Group tokens, and their callers.
Follow `AGENTS.md` and any active user-named protocol first. Use the
[ListViews development prompt](list_views_development.md) for the shared workflow.

## Read and trace

1. Read the [architecture rules](../../../Documents/CORE_ARCHITECTURE_RULES.md),
   [ListViews hub](../../../Documents/UI_LIST_SWITCHER.md),
   [token reference](../../../Documents/UI_LIST_VIEWS_TOKENS.md),
   [sheet guide](../../../Documents/UI_LIST_SWITCHER_SHEET.md), and
   [Group, Search, and Limit](../../../Documents/UI_LIST_VIEWS_GROUP_SEARCH_LIMIT.md).
2. Read [shared utilities](../../../Documents/SHARED_UTILITIES_INDEX.md),
   [tokenEvaluator.js](../../../FRONTENT/src/utils/tokenEvaluator.js),
   [dateHelpers.js](../../../FRONTENT/src/utils/dateHelpers.js),
   [sortHelpers.js](../../../FRONTENT/src/utils/sortHelpers.js),
   [03Filter.js](../../../FRONTENT/src/composables/resources/listViews/features/03Filter.js),
   [04Order.js](../../../FRONTENT/src/composables/resources/listViews/features/04Order.js),
   [01Group.js](../../../FRONTENT/src/composables/resources/listViews/features/01Group.js), and
   [useTokenOverride.js](../../../FRONTENT/src/composables/resources/listViews/useTokenOverride.js).
3. For shared comparison changes, inspect action `visibleWhen` in
   [useResourceConfig.js](../../../FRONTENT/src/composables/resources/useResourceConfig.js), plus
   the token/operator controls in [listViewsManager.html](../../../GAS/listViewsManager.html) and
   [actionManager.html](../../../GAS/actionManager.html). Check actual supported choices in each.
4. Run GitNexus impact for each existing symbol to edit. Report direct callers, flows, and risk,
   and warn for HIGH or CRITICAL risk. Check actual callers when the index is missing or stale.
   Follow the reuse and approval rules before adding a helper, function, or file.

## Implement the requested change

- Reuse `prepareFilter` once per pass, `evaluatePreparedFilter` per row, and `evaluateFilter`
  for a single-row check. Filter and Order `on` use `strictColumn: false`; the shared evaluator
  has its own default. Keep field paths and literal comparisons consistent with the token reference.
- `resolveTokenContext()` supplies the current user. Tokens resolve when their computed owner
  recomputes; no clock timer is part of this flow.
- Comparison tokens use the registered column `coerce` pipeline and `coerceToken` for the token
  value. When `coerceToken` is absent, it uses `coerce`. Conversion steps are named `COERCES` entries.
  Keep numeric, string, date, array, missing, and invalid value behavior consistent with the code.
- Group uses `tokenizeValue` on the column side. A custom Group token is separate from a comparison
  token and from a list feature override. Its file default-exports `(value, ctx) => key`; ctx has user.
  The resource path under `_ui/{Ui}/composables/{Scope}/{Resource}/token{Name}.js` wins over
  `_ui/{Ui}/composables/token{Name}.js`. Preserve reactive loading and error behavior.
- When changing a shared token or operator, inspect every affected frontend caller and both GAS
  manager pickers. Update relevant token picker codes, labels, groups, and parameter defaults when
  the change needs them. Do not assume the two pickers currently expose identical operators.
- Action expression seeds have their own grammar. If the requested token also belongs there,
  inspect `GAS/actionTargets.gs` `resolveActionToken` and
  `FRONTENT/src/composables/resources/additionalActionsSchema.js` `prefillExpression`.
- Update the token reference and any affected caller docs to match the checked behavior.

## Verify

Use focused checks against real modules. Cover the changed operators, token parameters and defaults,
row and token conversions, literals, nested groups, array results, missing/bad values, and user data.
For date work, check past/future signs, day and hour bounds, date text, epoch units, and blank values.
For shared comparison changes, check Filter, Order `on`, and action visibility as applicable.
For Group tokens, check built-in conversion, resource/UI lookup priority, missing/loading/ready/error,
and synchronous return behavior. Check the relevant picker UI and parse changed GAS scripts.
Report any browser checks still needed. Save CRLF and verify bytes after every write.
Follow repo rules for builds, remote updates, and deployment.
