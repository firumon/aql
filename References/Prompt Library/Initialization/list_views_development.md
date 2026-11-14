# ListViews Development

Use this prompt to implement, update, or fix ListViews data, config, features, overrides, or consumers.
Follow `AGENTS.md` and any active user-named protocol first. Do the requested work only.

## Knowledge and work-step split

The ListViews guides in `Documents/` explain the current feature for people and agents. They own its
sheet shape, GAS path, frontend behavior, use, defaults, effects, limits, and known gaps.
This prompt owns only agent work steps: where to read, how to inspect or change code, and how to
check the result. Link to the guides instead of copying their full feature contract here.
When the code and a guide differ, report the mismatch and treat the current core code as truth.
Update the guide when its current-state knowledge is wrong or missing. Update this prompt when the
work steps or required reads change.

## Read before work

1. Read the [architecture rules](../../../Documents/CORE_ARCHITECTURE_RULES.md), the
   [ListViews hub](../../../Documents/UI_LIST_SWITCHER.md), and its five linked parts:
   [core and overrides](../../../Documents/UI_LIST_SWITCHER_COMPONENTS.md),
   [sheet and manager](../../../Documents/UI_LIST_SWITCHER_SHEET.md),
   [Group, Search, and Limit](../../../Documents/UI_LIST_VIEWS_GROUP_SEARCH_LIMIT.md),
   [tokens](../../../Documents/UI_LIST_VIEWS_TOKENS.md), and
   [item display, actions, and Target](../../../Documents/UI_LIST_VIEWS_ITEMS.md).
2. Read [shared utilities](../../../Documents/SHARED_UTILITIES_INDEX.md) before adding helpers.
   Read the actual owner and affected callers before changing code. The table below identifies the owners.
3. For source work, read [record access](../../../Documents/UI_RECORD_ACCESS.md), the
   [resource-domain hub](../../../Documents/UI_RESOURCE_DOMAIN_LOGIC.md), its relevant parts, and the
   current resource Data files. Use the owning domain as the source of business facts.
4. For switcher UI, read [the switcher work prompt](list_switcher_customization.md). For tokens,
   read [the token work prompt](list_view_tokens.md). For reusable component creation or material
   restructuring, also follow [renderable contract](renderable_contract.md).
5. Read `GAS/listViewsManager.html` for every ListViews task. When changing sheet read or write
   behavior, also read the ListViews functions in `GAS/appMenu.gs` and `parseListViewsCell` in
   `GAS/resourceRegistry.gs`. For navigation and action changes, read `useResourceNav.js`,
   `useResourceConfig.js`, and `useAdditionalActions.js`.

When docs and core code differ, report the exact mismatch to the user. Follow core code.
Use the Quasar MCP for Quasar APIs. Check git status and preserve the user's work.
Run GitNexus impact before changing a function, class, or method. Report direct callers, processes,
and risk; warn before HIGH or CRITICAL changes. If the index has no symbol, say the risk is unknown
and inspect current callers. Follow the repo's audit and approval rules before new files or functions.

## Locate the owner

All paths in the table are under `FRONTENT/src/composables/resources/listViews/` unless stated otherwise.

| Task | Owner |
|---|---|
| Public state, permissions, selection, Target click | `useListView.js` |
| Per-view results, loading, error isolation | `useListPipeline.js` |
| Provider discovery and row-source selection | `useListEngine.js`, `useListResolver.js` |
| List feature and value overrides | `useListOverride.js` |
| Group custom token files | `useTokenOverride.js` |
| Feature discovery and stage contract | `useFeatureChain.js`, `features/` |
| Group, Map, Filter, Order, Search, Limit | `features/01Group.js` through `06Limit.js` |
| View props and click target | `features/21Props.js`, `31Target.js` |
| Row display and action props | `features/91Content.js`, `92Meta.js`, `93Style.js`, `94Actions.js`, `listItemProps.js` |
| Switcher layout and fit | `components/sections/ListSwitcher.vue`, `ListSwitcherItem.vue`, `useTabFit.js`, `css/custom.scss` |
| Active rows and inline actions | `components/contents/List.vue`, `components/app/AppList.vue`, `components/app/AdditionalActionsButtons.vue` |
| Filter values and dates | `utils/tokenEvaluator.js`, `utils/dateHelpers.js`, `utils/sortHelpers.js` |

The sheet path is `APP.Resources.ListViews` -> GAS parsing -> authorized `resource.ui.listViews` ->
`useListView` -> allowed views -> `useListPipeline` -> source -> stages -> shared List and switcher.
Blank or invalid sheet data yields no configured views; an empty array also yields no views.

## Work steps

- Use Config overrides only when a required need cannot be met by sheet settings or focused
  overrides. AI agents MUST explain the need and obtain explicit user permission BEFORE
  creating any `list{Name}Config.js`. Do not create one on your own. A direct user request
  for a named Config file is permission for that file only. Read the linked Config contract.

- Use the missing-key defaults in `Documents/UI_LIST_SWITCHER_SHEET.md`. Leave a seed key out when its intended value is already the frontend default. Check that the frontend applies that default when the key is missing. If it does not, add and document the frontend default before relying on omission.

1. Write down the requested behavior and intended rows. Before drafting the seed, choose the
   row source: `Data/useData.js` for this resource's own records, decorated with calculated facts, or a focused
   `use<Family>Data.js` when another resource is involved. Check the real fields, authorized
   resource names, route, and current view config.
2. Trace the owner and existing helpers. Preserve source rows, relation getters, and reactive state.
   Do not copy resource page implementations or put business logic, stores, requests, or data reads in components.
3. The provider is shared: `Data/useData.js` default-exports a no-argument function returning a
   ref/computed of an array. If absent, `useRecord().enriched(resource)` supplies rows.
   `Data/useList.js` supplies an exact-name rule, then `default`, then base rows. A ready Data
   override replaces that rule. A family data file is not discovered by the engine itself;
   connect it through the resource's `useList.js`. Check the final rows and their fields before
   writing the seed. Use the resolved rows; do not bypass source selection.
4. The chain runs `01Group -> 02Map -> 03Filter -> 04Order -> 05Search -> 06Limit ->
   21Props -> 31Target -> 91Content -> 92Meta -> 93Style -> 94Actions`.
   Every stage is synchronous and returns an array. Preserve stage input/output semantics.
5. Group keeps first representatives and attaches bucket facts before Filter. The Map feature stage
   receives and returns an array, but its ready override runs once per row and returns a facts object.
   The stage merges facts with `decorateRow`; it keeps row order and source fields, and facts may
   replace a source value. Filter and Order conditions use the shared evaluator with `strictColumn: false`.
   Keep Order's documented pair-comparison rules. Search has an explicit-fields override gate;
   Limit caps the post-Search rows. Count is the final output length.
6. Preserve the shared `itemProps`, `actionProps`, and `targetState` output objects. The Props,
   Target, display, and Actions stages return rows unchanged. Keep display parsing in `listItemProps.js`.
   Bind active view props in List; do not attach UI prop bags to rows.
7. Check `permission` with `resourceConfig.allowed` before views enter the pipeline. Keep the raw
   saved views unchanged. Apply Config only inside the allowed-view pipeline. Tabs and active selection use allowed pipeline results.
   Never load or run a denied view's Config. Reject returned name and permission keys.
   Use decorateRow for the shallow merge and read-only callback inputs.
   An unavailable selection falls back to the allowed default or first view, or empty when none exist.
8. Target is a view-level value or synchronous row callback. Resolve it only on click; check the
   destination permission before `useResourceNav`. Do not navigate while the override loads.
   Keep the action-slot click separate from the row click.
9. Keep each result reactive. The pipeline isolates a view's errors; do not replace computed results
   with copied watcher state. Keep the shared scope alive while either List or switcher uses it.
10. Update the matching knowledge docs and registries after code changes. Every ListViews change
    must include a review of `GAS/listViewsManager.html`. Update the manager in the same task when
    a changed structure, key, default, validation rule, preview, or behavior affects its editor or
    saved JSON. For other changes, confirm that the manager still matches the current contract.
    Preserve the manager's resource -> view selection -> tabbed editor -> order and preview -> save
    flow when editing it. Keep sheet keys and frontend behavior aligned with the ListViews guides.
    Explain the Data/useList filter boundary and the sign-in refresh needed after saving config.

## Overrides and tokens

List override paths, in order, start at `FRONTENT/src/`:

1. `_ui/{Ui}/components/{Scope}/{Resource}/Index/list{Name}{Kind}.js`
2. `_ui/{Ui}/components/{Scope}/{Resource}/list{Name}{Kind}.js`

The loader uses the current view name, case-normalized lookup, and a lowercase `list` file prefix.
Use the matching contract; do not apply one callback signature to all kinds.

| Kind | Default export and use |
|---|---|
| Config | Plain object or synchronous context function; see the [Config contract](../../../Documents/UI_LIST_SWITCHER_COMPONENTS.md#config-overrides-use-only-when-required) |
| Data | Array, or `baseRows => array/ref` |
| Map | `(row, ctx) => facts object`; ctx includes listName, view, user, term, masterResources, readField |
| Group, Filter, Order, Search, Limit | `(afterCoreRows, beforeCoreRows, viewConfig) => array/ref` |
| Props | Non-null, non-array AppList props object, merged over supplied sheet pagination props |
| Target | Approved sheet target value, or `(row) => target`; evaluated at click |
| Layout, Labels, Captions, Content, MetaLayout, MetaChip, MetaLabel, MetaCaption, Meta | Supported display value; see the item guide |
| Icon, Color, Highlight | String or synchronous row function |
| Actions | Plain object with only, exclude, dense, and size |

Feature imports are reactive and cached. Preserve each stage's `none`, `loading`, `ready`, and
`error` rules, including Group and Search exceptions. Target blocks a click while loading.
Custom Group token files use the separate token loader; read the token prompt for their paths and
`(value, { user })` contract. New glob-matched files need a dev-server restart for discovery.

## Verify and report

- Run focused checks against the changed real modules. Check syntax for changed JS and compile
  changed Vue scripts/templates. Do not replace behavioral checks with a syntax check.
- Select cases for the task: empty, missing and invalid config; override loading/ready/error;
  Config missing/loading/ready/error; denied-view load prevention; protected keys and mutation;
  shallow nested replacement; empty-row tab changes; reactive data and permission changes; active fallback; Group facts; Order comparisons; Search
  gates; Limit counts; slot alignment; action clicks; Target destination and denied access.
- For every ListViews change, confirm that `GAS/listViewsManager.html` matches the current contract.
  When updating the manager, test JSON round-trip, edit/reopen, defaults, and empty mode. A sheet
  save needs explicit user authorization; a local code change does not deploy GAS.
- For UI behavior, check the local screen at relevant widths and state changes. Check tabs and More after live labels change.
  Report any browser check still needed.
- Verify working-tree CRLF bytes after every write, except the `.sh`/`.bash` LF exception. Keep
  files within repo limits. Use the repo's targeted-check and frontend-build rules.
- Do not commit, push, deploy, or save remote config unless the user explicitly requests it.
