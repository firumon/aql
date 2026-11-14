# AQL ListViews

ListViews shows named views of a resource's records. The engine supports row filters,
order, search, limits, display, actions, and row clicks. For resource lists, keep all
row filters in the resource's `Data/useList.js`; do not put filter rules in
`APP.Resources.ListViews`. The sheet holds view names and display settings.
The frontend reads the list from the authorized resource config at `ui.listViews`.

## Parts of this document

| Need | Guide |
|---|---|
| Set up view JSON, order, and permissions | [Sheet setup and config](UI_LIST_SWITCHER_SHEET.md) |
| Public API, source rules, pipeline, switcher, and overrides | [Core and overrides](UI_LIST_SWITCHER_COMPONENTS.md) |
| Group, Search, and Limit | [Group, Search, and Limit](UI_LIST_VIEWS_GROUP_SEARCH_LIMIT.md) |
| Filter and Order conditions, tokens, and custom Group tokens | [Filter operators and tokens](UI_LIST_VIEWS_TOKENS.md) |
| Content, meta, colors, actions, Target, and examples | [Item display](UI_LIST_VIEWS_ITEMS.md) |

## Where each section lives

| Section | Location |
|---|---|
| 4.1 | [4.1 Public entry point](UI_LIST_SWITCHER_COMPONENTS.md#41-public-entry-point) |
| 4.2 | [4.2 File map](UI_LIST_SWITCHER_COMPONENTS.md#42-file-map) |
| 4.3 | [4.3 Data source and source rules](UI_LIST_SWITCHER_COMPONENTS.md#43-data-source-and-source-rules) |
| 4.4 | [4.4 Feature chain and cache](UI_LIST_SWITCHER_COMPONENTS.md#44-feature-chain-and-cache) |
| 4.5 | [4.5 Override lookup](UI_LIST_SWITCHER_COMPONENTS.md#45-override-lookup) |
| 4.6 | [4.6 Override export shapes](UI_LIST_SWITCHER_COMPONENTS.md#46-override-export-shapes) |
| 4.7 | [4.7 Relations](UI_LIST_SWITCHER_COMPONENTS.md#47-relations) |
| 4.8 | [4.8 Switcher](UI_LIST_SWITCHER_COMPONENTS.md#48-switcher) |
| 4.9 | [4.9 Fault guide](UI_LIST_SWITCHER_COMPONENTS.md#49-fault-guide) |
| 4.10 | [4.10 List and display props](UI_LIST_SWITCHER_COMPONENTS.md#410-list-and-display-props) |
| 5.1 | [5.1 Where a view is saved](UI_LIST_SWITCHER_SHEET.md#51-where-a-view-is-saved) |
| 5.2 | [5.2 Set up a view with Manage Lists](UI_LIST_SWITCHER_SHEET.md#52-set-up-a-view-with-manage-lists) |
| 5.3 | [5.3 View keys](UI_LIST_SWITCHER_SHEET.md#53-view-keys) |
| 5.4 | [5.4 Filter](UI_LIST_SWITCHER_SHEET.md#54-filter) |
| 5.5 | [5.5 Order](UI_LIST_SWITCHER_SHEET.md#55-order) |
| 5.6 | [5.6 Check your list](UI_LIST_SWITCHER_SHEET.md#56-check-your-list) |
| Item 1 | [1. Where item settings belong](UI_LIST_VIEWS_ITEMS.md#1-where-item-settings-belong) |
| Item 2 | [2. Full OutletVisits example](UI_LIST_VIEWS_ITEMS.md#2-full-outletvisits-example) |
| Item 3 | [3. Item keys](UI_LIST_VIEWS_ITEMS.md#3-item-keys) |
| Item 4 | [4. Layout and cell order](UI_LIST_VIEWS_ITEMS.md#4-layout-and-cell-order) |
| Item 5 | [5. Text templates and field paths](UI_LIST_VIEWS_ITEMS.md#5-text-templates-and-field-paths) |
| Item 6 | [6. Icon, color, and highlight](UI_LIST_VIEWS_ITEMS.md#6-icon-color-and-highlight) |
| Item 7 | [7. Display overrides](UI_LIST_VIEWS_ITEMS.md#7-display-overrides) |
| Item 8 | [8. How rows reach AppList](UI_LIST_VIEWS_ITEMS.md#8-how-rows-reach-applist) |
| Item 9 | [9. Inline actions and row navigation](UI_LIST_VIEWS_ITEMS.md#9-inline-actions-and-row-navigation) |
| Item 10 | [10. AppList Props overrides](UI_LIST_VIEWS_ITEMS.md#10-applist-props-overrides) |
| Group, Search, Limit | [Group, Search, and Limit](UI_LIST_VIEWS_GROUP_SEARCH_LIMIT.md) |
| Conditions, operators, comparison tokens, Group tokens | [Filter operators and tokens](UI_LIST_VIEWS_TOKENS.md) |

## What a view can do

| Area | Current behavior |
|---|---|
| Permission | A root `permission` selects who can use a view. |
| Source | The resource provider and list rules supply rows. A Data override can replace a rule for one view. |
| Group | Keep the first row per group and add counts and aggregates as facts. |
| Map | A JavaScript override adds or replaces facts on each row for one view. |
| Filter | The engine can read a filter key, but resource list configs must leave it out. `Data/useList.js` owns shared and fixed-purpose row filters. |
| Order | Rules support direction, types, conditions, and child-value aggregates. |
| Search | Search explicit or automatic fields using the page search text. |
| Empty state | An empty view shows “No items found.” A search with no matches shows “No results match your search.” |
| Limit | Limit the final matching rows. |
| Pagination | `paginate`, `perPage`, and `threshold` control AppList paging. |
| Content and meta | `item` controls labels, captions, meta chips, and their order. |
| Style | `item` controls icons, colors, and highlights. |
| Actions | Root `actions` can hide inline actions with `false`, or select and style existing Additional Actions with an object. |
| Target | Root `target` and its override choose where a row click goes. |
| Switcher | Tabs show view names, labels, icons, colors, selection, and optional counts. |

The detailed guides define accepted shapes, defaults, paths, and errors. JavaScript
overrides are optional. The list manager's extra JSON box can hold view settings;
see the [manager guide](UI_LIST_SWITCHER_SHEET.md#52-set-up-a-view-with-manage-lists)
for the forms it accepts.

Missing or `null` root `actions` keeps the current behavior. An object keeps the
`only`, `exclude`, `dense`, and `size` settings. Root `actions: false` hides the
inline action slot for that view. The [item guide](UI_LIST_VIEWS_ITEMS.md#9-inline-actions-and-row-navigation)
explains how this interacts with the Actions override.
Manage Lists shows saved `false` as off. Turning it off saves `false`; turning it
on clears `false`.

Keep all resource list row filters in the resource's `Data/useList.js`. Keep the sheet
free of filter rules. The current resolver does not run a shared default rule before a
named rule, so the target common-then-purpose flow needs an engine change. See the
[core guide](UI_LIST_SWITCHER_COMPONENTS.md#43-data-source-and-source-rules).

Before writing a view seed, settle its row source. Use `Data/useData.js` when the rows are
this resource's own records, decorated with calculated facts. Use `use<Family>Data.js` when rows need another
resource. Then use `Data/useList.js` for the list's own row rules. Check the final rows and
their fields and values before setting the seed's display keys. The current engine connects a
family data file through the resource's `useList.js` rules.
## Save and load path

| Step | Current behavior |
|---|---|
| Sheet column | `setupAppSheets.gs` creates the `Resources.ListViews` column. A populated cell holds a JSON array; a blank cell is also valid. |
| Manager | **AQL > Resources > Manage Lists** opens `listViewsManager.html`. `app_getListViewsManagerData` loads each resource; `app_saveResourceListViews` writes the JSON to the cell and clears the server config cache. |
| GAS read | `getResourceRegistryContext` reads the cell. `parseListViewsCell` accepts a JSON array and returns its views. `buildAuthorizedResourceEntry` adds them as `entry.ui.listViews`. |
| Auth response | Login and config responses include authorized resources with UI config. |
| Page setup | The auth store keeps the resource list. `useRouteConfig` selects the route's resource. `Page.vue` provides `resourceConfig` and `resourceRecord`. |
| List UI | `ListSwitcher.vue` and `List.vue` both call `useListView`, so tabs and rows share the same view state. |

The save clears the server cache. It does not refresh an open page's auth config.
Sign in again to receive the saved list settings. A normal record reload is not enough.

Sources: [sheet header](../GAS/setupAppSheets.gs#L57), [manager dialog](../GAS/appMenu.gs#L872),
[manager data](../GAS/appMenu.gs#L883), [server save](../GAS/appMenu.gs#L918),
[cell parser](../GAS/resourceRegistry.gs#L744), [authorized resource entry](../GAS/resourceRegistry.gs#L1123),
[auth response](../GAS/auth.gs#L393), [auth store](../FRONTENT/src/stores/auth.js#L90),
[route config](../FRONTENT/src/composables/resources/useRouteConfig.js#L26),
[page providers](../FRONTENT/src/pages/Page.vue#L86), [List consumer](../FRONTENT/src/components/contents/List.vue#L20),
[switcher consumer](../FRONTENT/src/components/sections/ListSwitcher.vue#L48).

## How data flows

```text
APP.Resources.ListViews
  -> resource.ui.listViews
  -> allowed views
  -> approved Config override (name and permission stay fixed)
  -> resource Data provider / record source
  -> Data override or named/default rule
  -> Group -> Map -> Filter -> Order -> Search -> Limit
  -> Props -> Target -> Content -> Meta -> Style -> Actions
  -> list result -> switcher and List
```

The page's `usePageRecord.records` stays unfiltered. A view's result has its own rows,
count, props, target state, and error. Count is the final number of rows after the
stages. A failure is kept with its view; the other views can still run.

View permissions decide which lists are available. They do not filter records or
replace record and server access checks. Row targets check access before navigation.

## Examples

A view with presentation settings, order, and limit. Its row filter stays in the
resource's `Data/useList.js`:

```json
[
  {
    "name": "Planned",
    "label": "Planned visits",
    "permission": "read",
    "order": [{ "column": "Date", "order": "asc", "type": "date" }],
    "limit": 50
  }
]
```

Use field and resource names that exist in the selected resource. The [item guide](UI_LIST_VIEWS_ITEMS.md)
shows a full example with labels, captions, related fields, icons, colors, and highlights.

Config overrides are for required cases only. AI agents must get explicit user permission
before creating `list{Name}Config.js`. See the [Config contract](UI_LIST_SWITCHER_COMPONENTS.md#config-overrides-use-only-when-required).
