# ListViews - Item Display

Part of the [ListViews guide](UI_LIST_SWITCHER.md).
This guide is for people and AI agents who set up or change list rows.
It describes Content, Meta, Style, inline action props, and row targets.
For source rows, tabs, and public state, read the [core guide](UI_LIST_SWITCHER_COMPONENTS.md).

## 1. Where item settings belong

Each named view in `APP.Resources.ListViews` can have an `item` object.
It controls how that view's rows look in AppList.
The view's top-level `label`, `icon`, and `color` control its tab.
The nested `item.icon` and `item.color` control its rows.
An approved [Config override](UI_LIST_SWITCHER_COMPONENTS.md#config-overrides-use-only-when-required)
can change the tab keys or replace the whole `item` object before row display stages run.
The existing Labels, Icon, and Color overrides still change rows.

The frontend reads only the item keys listed below.
AppList has more props, but this does not make every AppList prop an item setting.
The manager's **Item view** tab edits these keys and checks their known shapes before save.
It shows one input for each `meta*` key. The frontend also accepts arrays when a layout
repeats a meta slot. Existing multi-entry values stay saved until that field is edited;
editing it saves one template.
See [sheet setup](UI_LIST_SWITCHER_SHEET.md#52-set-up-a-view-with-manage-lists).

### Leads and LeadFollowUps seed settings

The Leads seed has `item` settings for all seven views. LeadFollowUps has them for
all eight views. Layouts, field choices, chips, colors, icons, and highlights live
in `GAS/syncAppResources.gs`. There are no per-view Props files or card helpers for them.
Their existing `Data/useList.js` files keep row selection and add final display fields.
These include joined names, location text, response age, due text, and delay colors.
The sheet links to those fields. It does not repeat their calculations or fallbacks.
The source files list each display field in their required data-file header.

Changing the seed does not update existing sheet cells. The sync protects populated
`ListViews` cells. Existing resources need the new view JSON saved in Manage Lists
before the frontend is deployed without the old display overrides.

### PurchaseRequisitions and RFQs seed settings

All six PurchaseRequisitions views and all four RFQs views have `item` settings in
`GAS/syncAppResources.gs`. They use the existing source fields and add no display fields.
Both use the same `caption,label,caption` main layout, with Code as the main label.
Requisitions show PRDate, Username, Type, Priority, Progress, and RequiredDate.
RFQs show RFQDate, User, PurchaseRequisitionCode, Progress, and QuotationSubmissionDeadline.
The side area uses a progress label above its date caption. Its text color follows the view's progress color.
Row filtering and sorting stay in each resource's existing `Data/useList.js`.

### Other purchase list seed settings

Procurements, SupplierQuotations, PurchaseOrders, and POReceivings also have `item`
settings for all 15 named views in `GAS/syncAppResources.gs`. They use existing source
fields only. Code is the main label. The captions show their existing dates, users,
linked document codes, suppliers, or receiving details. Their side areas use a progress
label and a second caption. Raw Progress maps supply colors where one view has several states.
Filtering stays in each resource's `Data/useList.js`. Procurements uses the shared filter
evaluator for its three row rules, with the same case, missing-value, and source-order
behavior as its former sheet filters. The Procurements seed has no row filters.

## 2. Full OutletVisits example

This is a full ListViews array for one view.
Use the whole array in the ListViews cell.
In the manager's extra JSON box, use an object with just the `item` key and its value.

```json
[
  {
    "name": "All",
    "label": "All visits",
    "icon": "format_list_bulleted",
    "item": {
      "layout": "label,caption,caption",
      "labels": "{$outlet.Name}",
      "captions": [
        "Visit date: {Date}",
        "{ProgressPlannedComment}"
      ],
      "metaLayout": "label,caption,caption",
      "metaLabel": "Progress",
      "metaCaption": ["Code", "Planned by {ProgressPlannedBy}"],
      "icon": {
        "column": "Progress",
        "default": "event",
        "map": {
          "PLANNED": "event",
          "COMPLETED": "check_circle",
          "POSTPONED": "event_repeat",
          "CANCELLED": "cancel"
        }
      },
      "color": {
        "column": "Progress",
        "default": "primary",
        "map": {
          "PLANNED": "primary",
          "COMPLETED": "positive",
          "POSTPONED": "warning",
          "CANCELLED": "negative"
        }
      },
      "highlight": {
        "column": "Progress",
        "default": "grey",
        "map": {
          "PLANNED": "primary",
          "COMPLETED": "positive",
          "POSTPONED": "warning",
          "CANCELLED": "negative"
        }
      }
    }
  }
]
```

The main area shows the outlet name, visit date, and planned note.
The side area shows a progress label, the visit code, and the planner.
The icon, color, and highlight follow Progress. Dates show their stored value.
`All` omits `default`; the first-view fallback selects it. It uses the configured source rules and overrides.
`$outlet` must be a real relation on the source row.

## 3. Item keys

| Key | Accepted sheet value | If missing |
|---|---|---|
| `layout` | CSV string or array of `label`, `caption` | `caption,label`. |
| `labels`, `captions` | CSV string or array of text templates. An array can also hold `false` or `null` for an empty cell. | Automatic row values. An explicitly empty string or array shows a blank cell. |
| `metaLayout` | CSV string or array of `chip`, `badge`, `label`, `caption` | Uses `label,caption`; adds a chip slot when `metaChip` is supplied and a badge slot when `metaBadge` is supplied. |
| `metaChip`, `metaBadge`, `metaLabel`, `metaCaption` | CSV string or array of text templates. An array can also hold `false` or `null` for an empty cell. | No sheet value for that cell type. An explicitly empty string or array shows a blank cell. |
| `chipOutline` | JSON `true` or `false` | AppList default chip style. |
| `icon`, `iconColor`, `color`, `highlight`, `metaColor`, `chipColor`, `badgeColor` | String, direct field object, or map object. See [style rules](#6-icon-color-and-highlight). | AppList default for that style. |

Keys and slot names are case-sensitive. Use the exact camelCase keys above.
Put row icon, color, and highlight settings inside `item`; root icon/color describe the tab.
A missing or null `item` uses the default main layout and automatic labels and captions.
An empty object is valid.
A non-null item value must be an object, not an array.
Missing or null keys add no value for that piece, except labels and captions, which use
their automatic values. Overrides can still supply each piece.
Unknown keys are ignored. Bad known values fail that view with an error and count 0.
The same validation runs when there are no rows.

### Automatic labels and captions

The default main layout is `caption,label`, even when `item` is missing. When `labels`
is absent, each label slot can read an automatic row value. The first available value is:

1. The row's `Name`.
2. The `Name` of the first parent in the row's `_Parents` order, found through its `_Parent` map.
3. The row's `Code`, but only when the row has a `Date` value.

When `captions` is absent, the first available value is:

1. `Username * Date`, when both values are present.
2. `Date`.
3. `Username`.
4. `Progress`.
5. `Code`.

A value is available when it is not `null` and not an empty string. Missing values
leave the cell blank. An explicit template or blank cell wins for its own kind. A
custom layout still gets automatic labels and captions when those keys are absent.
The first parent is chosen by `_Parents` order, not by resource type.

## 4. Layout and cell order

ListViews defaults to `caption,label` for main content and `label,caption` for meta.
These defaults belong to the ListViews display stages. AppList's own defaults are unchanged.
A sheet layout or a ready Layout/MetaLayout override wins. Otherwise a native layout
from a Props override is kept before the ListViews default is used.

With no explicit meta layout, ListViews adds `chip` after the text slots when `metaChip`
is supplied, then `badge` when `metaBadge` is supplied. Native chip/badge props also add
those slots. The same resolved layout sets both cell values and their render types.
Empty cells render nothing. So a lone `metaChip` needs no `metaLayout`, and a
`metaLabel` plus `metaCaption` shows the label first without stating a layout.
Use an explicit layout for a different order or repeated cells.

Content uses `layout` and `content`. Meta uses `metaLayout` and `meta`.
Each pair is aligned by index when built from the per-kind templates.

- A `label` slot takes the next label template. A `caption` takes the next caption.
- A meta `chip`, `label`, or `caption` takes the next template of that kind.
- Repeated slots work. Each uses the next template of its own kind.
- A missing template becomes `false`, so that cell is hidden.
- Extra templates are ignored.

When layout is missing, Content uses `['caption', 'label']`.
Meta uses `['chip', 'caption', 'label']`, or `['chip', 'badge', 'caption', 'label']` when `metaBadge` is set.
Setting only a custom layout still uses automatic labels and captions for any missing
template setting. There is no header-based label or caption inference.

An empty layout string or `[]` gives no slots. A blank entry inside a layout is invalid.
An empty template string or `[]` gives blank cells; it does not restore default content.
CSV entries are trimmed. Blank entries keep their position.
Use an array when a template has a comma. CSV has no quote or escape parser.
Template arrays also accept `false` or `null` for an empty cell.
The sheet layouts accept only the named slot kinds above, not component objects.

### A clean side area with two values

When a row needs two bits of side information, `metaLabel` above `metaCaption` often
lines up more neatly than a chip beside or above plain text. For example:

```json
{
  "metaLabel": "{Progress}",
  "metaCaption": "Required: {RequiredDate}"
}
```

This is a useful design choice, not a required rule. The Recent consumption-invoice
view uses this pattern for progress and age. A single short tag can still use a chip.
Use a chip with other text when it fits the page well. `metaColor` colors the label
and caption; remove chip-only settings when a layout no longer uses a chip.

## 5. Text templates and field paths

| Input | Meaning |
|---|---|
| `Code` | AppList reads the direct Code key; if it is absent, it shows the literal text Code |
| `{Code}` | A field template; a missing or null value becomes empty text |
| `Visit: {Code} on {Date}` | Text joined with two field values |
| `{$outlet.Name}` | Safe path through the row's outlet relation |
| `{{` | A literal opening brace |
| `{}` or `{Date|ago}` | Literal text; these groups have no supported field-path form |

A bare dot path is still a string for AppList. Use braces to read it as a path.
Field names and paths keep their case. They use the shared `readField` helper.
A valid path whose field is missing gives empty text, not a literal brace group.
Unsafe paths such as `__proto__` fail validation.
Templates compile once per feature pass into functions. AppList calls them with each row.
Bare strings stay strings. Features do not precompute a row's display text.
Date, money, and relative-time transforms are outside this template format.
Use `Data/useList.js` for display facts shared by that resource's ListViews. Use a
`list{Name}Map.js` override (stage `02Map.js`) to add or replace row facts for one view.
It runs once per row as `(row, ctx)` and returns a non-null, non-array object. The Map stage
uses `decorateRow(row, facts)` to merge those facts. The `item` settings still choose which
fields display. See [Map overrides](UI_LIST_SWITCHER_COMPONENTS.md#46-override-export-shapes).
Filter/Order comparison tokens and custom Group tokens are separate systems.

## 6. Icon, color, and highlight

All nine [style keys](#3-item-keys) accept these forms:

| Form | Example value for `item.icon` | How it works |
|---|---|---|
| String | `"event"` | AppList uses the exact row key if present. Otherwise it uses the string as written. |
| Direct field | `{ "column": "VisitIcon", "default": "event" }` | Uses the text from the field. |
| Map | `{ "column": "Progress", "map": { "COMPLETED": "check_circle" }, "default": "event" }` | Looks up the field value in the map. |

Both object forms require a non-empty `column`. They use `readField` for field names and
safe dot paths, such as `$outlet.Icon`. Direct fields use the string as read. A missing value,
blank text, or a value of another type uses `default`.

When `map` is present, it must be an object with string results. The row value and map keys
are compared as text after trimming spaces and ignoring case. The first matching key wins.
A missing match uses `default`. In both forms, a non-null `default` must be text. When it is
missing, the row result is an empty string and AppList uses its usual handling for that style.

Use icon names from the app's icon set. Use a Quasar color name for colors, such as
`primary`, `secondary`, `accent`, `dark`, `positive`, `negative`, `info`, or `warning`.
Palette names include `red`, `pink`, `purple`, `deep-purple`, `indigo`, `blue`,
`light-blue`, `cyan`, `teal`, `green`, `light-green`, `lime`, `yellow`, `amber`,
`orange`, `deep-orange`, `brown`, `grey`, and `blue-grey`. Each can take a shade
from `-1` to `-14`. Use a palette name such as `red-6` for highlights. The app can
also define its own color classes. The parser checks the value shape. See the
[Quasar color palette](https://quasar.dev/style/color-palette).

`item.highlight` sets a list-wide flag. An empty string turns it off. A non-empty string
or either object form turns it on. AppList resolves `highlightColor` for each row. An empty
row result still goes through AppList's color handling. The tab's root `color` uses the
[tab color rules](UI_LIST_SWITCHER_SHEET.md#tab-color-values).

### Final style values from the frontend

Keep sheet data small. When a frontend field already holds the final icon or color,
including a fallback for missing data, link the style key straight to that field:

```json
"metaColor": "displayActivityColor"
```

Do not add a map that sends each value to itself. Do not repeat the field's fallback
in the sheet. The frontend code that makes the field owns that fallback. This also
lets new final colors reach the row without a second change to the sheet map.

Keep the field link. Making `displayActivityColor` does not bind it to `metaColor`.
The string form needs an exact row key. For a dot path, keep the `column` object
and leave out `map` and `default` when the frontend already supplies the final text.

Use a map when the input is a raw value, such as `Progress`, that still needs to be
turned into an icon or color. Keep a sheet fallback when the final field is not
always supplied, or when that view needs a different fallback. A field name alone
is not proof that the frontend supplies it. Check its source and all row paths first.

## 7. Display overrides

Use the [same two lookup paths](UI_LIST_SWITCHER_COMPONENTS.md#45-override-lookup) as row overrides.
The current pipeline uses page `Index`. Use lowercase `list` in the filename.
A ready display export replaces only its own piece.

| Kind | Example file | Default export |
|---|---|---|
| `Layout` | `listTodayLayout.js` | CSV string or array of main slot names |
| `Labels`, `Captions` | `listTodayLabels.js`, `listTodayCaptions.js` | CSV string, template array, or function(item) |
| `Content` | `listTodayContent.js` | Full AppList content array |
| `MetaLayout` | `listTodayMetaLayout.js` | CSV string or array of meta slot names |
| `MetaChip`, `MetaLabel`, `MetaCaption` | `listTodayMetaChip.js`, `listTodayMetaLabel.js`, `listTodayMetaCaption.js` | CSV string, template array, or function(item) |
| `Meta` | `listTodayMeta.js` | Full AppList meta array |
| `Icon`, `Color`, `Highlight` | `listTodayIcon.js`, `listTodayColor.js`, `listTodayHighlight.js` | String or function(item) |

These exports are values, not the three-argument row-stage callback.
For example, `listTodayLabels.js` can contain `export default ['{$outlet.Name}']`.
`listTodayIcon.js` can contain `export default row => row.Progress === 'COMPLETED' ? 'check_circle' : 'event'`.
The feature keeps a style function unchanged. AppList calls it per row.
It does not call the function to get a string during the feature pass.

Labels, Captions, MetaChip, MetaLabel, and MetaCaption also accept one row function in JS.
For example, `listTodayLabels.js` can export a function:
```js
export default (r) => `${r.Username} - ${r.Date}`
```
This is treated as `[function]`. AppList calls it with each row at render time.
It fills only the first label slot, even if the layout has more label slots.
Later label slots are hidden; the override replaces the sheet label values.
The same rule applies to captions and each meta cell kind.
For more cells of one kind, export an array of cell values or row functions.
Per-kind template arrays can also hold component definitions, false, or null in JS.
Full Content and Meta arrays pass through unchanged. Their entries are not template-parsed.
Keep those arrays aligned with layout yourself. They take priority over the per-kind templates.
Use a string or a row function for a JavaScript style override.
Display exports do not unwrap refs or call factory functions. Keep row functions synchronous.
The feature does not validate a row function's return value.

When no override exists or its import is loading, the sheet value is used.
A ready import updates the view. A load error or invalid export fails that view and names the file.
Sheet values are validated before overrides. An override does not hide invalid sheet config.
The public loading flag does not wait for display overrides.

## 8. How rows reach AppList

The chain runs `01Group -> 02Map -> 03Filter -> 04Order -> 05Search -> 06Limit` first.
Then `21Props` fills itemProps, `31Target` prepares the row target, and
`91Content -> 92Meta -> 93Style -> 94Actions` prepare the display and action props.
Target inference runs on click, after the final row action list is known.
These stages return their input rows unchanged. They add no row decoration.
The pipeline supplies `itemProps` and `actionProps` output objects on each computed run.
Stages fill those objects. They are returned beside rows, count, and error on each view result.
No row carries AppList props. Group/Search facts and live getters stay on their existing rows.

`listItemProps.js` owns display parsing, safe readField templates, maps, and slot distribution.
Common item props are:
```js
{ paginate, perPage, threshold, layout, content, metaLayout, meta, icon, color, highlight, highlightColor }
```
21Props adds the three pagination keys only when the sheet sets them or the Props
override supplies them; missing keys keep AppList's own defaults (paginate true,
perPage 25, threshold 35).
An explicit Props layout remains when the sheet has no item layout. Props content,
label, or caption also remain when the sheet has no matching item display setting.
Otherwise, the Content stage uses the sheet layout and templates, or its automatic
layout and row values when those settings are absent.
Arrays and row functions keep their references. Functions run at render time.
useListView exposes itemProps and actionProps for activeList.
The List passes itemProps to AppList and actionProps to the inline AdditionalActionsButtons slot.
If root `actions` is `false`, the List omits that slot and keeps AppList row clicks active.
When actions are enabled, clicks in the action slot stop before reaching the row.
All ListViews show “No items found.” and the `inventory_2` icon when a list is empty. A trimmed search with no matches shows “No results match your search.” and the `search_off` icon. Both icons use `grey-4`. AppList keeps its `Code` item key.
An active-view error gets an alert banner, with empty props on that failed result.
A keyed Transition follows resource name and active view name.

## 9. Inline actions and row navigation

`actions` belongs at the named view root, beside `name` and `item`:
```json
{
  "name": "Today",
  "actions": {
    "only": ["Postpone", "Cancel"],
    "exclude": [],
    "dense": true,
    "size": "sm",
    "max": 3
  }
}
```

Use `false` to hide inline action buttons for one view:

```json
{ "name": "Read only", "actions": false }
```

Missing or `null` uses the resource's eligible actions, including the Actions override.
An object keeps the settings below. The Manage Lists **Inline actions** control
shows a saved `false` as off. Turning it off saves `actions: false` in the preview
and JSON. Turning it on clears `false` and makes the action fields available.

94Actions accepts only the five output props below. Other keys are ignored.
The JavaScript Actions override stays a plain object with only those five props.
Root `actions: false` skips that override, leaves no action props, and cannot be
overridden or fail the view. Missing/null root actions keeps the current behavior.
Booleans, strings, arrays, refs, and factory functions are not action-prop objects.

| Prop | Accepted value | Missing value |
|---|---|---|
| only | Array of exact action-key strings, or null | All eligible row actions in AdditionalActions config order; a non-empty list sets their order. |
| exclude | Array of exact action-key strings, or null | Component default: no exclusions |
| dense | Boolean | Component default: true |
| size | Non-empty string. Quasar standard sizes are `xs`, `sm`, `md`, `lg`, `xl`; CSS units such as `16px` and `2rem` also work. | Component default: `md` |
| max | Whole number `0` or greater | `3`; zero shows no buttons |

`size` must be a non-empty string. `max` must be a whole number `0` or greater.
The inline button passes `size` to Quasar [QBtn](https://quasar.dev/vue-components/button).
The manager offers the standard sizes `xs`, `sm`, `md`, `lg`, and `xl`. It keeps a
saved CSS-unit size visible as a current custom value so editing other fields does not hide it.

only/exclude filter the resource's existing AdditionalActions; they do not define new actions.
A non-empty only list also sets button order. Missing, null, or empty only keeps AdditionalActions config order.
Unknown names and ineligible actions are skipped. Repeated names show once. Exclude hides actions
without changing the order of the others. Permissions and visibleWhen still decide eligibility.
The `max` limit applies last, after resource and row matching, permissions, visibility,
only/exclude filtering, and `only` ordering. So `only: ["A", "B", "C", "D", "E", "F"]`,
with A and B denied and `max: 3`, shows C, D, and E.
Mode is always inline. Resource name and the current row are supplied by the List.
AdditionalActionsButtons owns eligibility and dispatch through useAdditionalActions.
Navigate actions route; mutate actions open the existing shared dialog and submit on confirm.
No action handler or dialog logic belongs in the list feature.

Use `listTodayActions.js` to change these props for Today:
```js
export default { dense: false, size: 'lg', max: 5 }
```
Use the normal page-level path first, then the resource-level path:
`_ui/{Ui}/components/{Scope}/{Resource}/Index/list{Name}Actions.js`, then
`_ui/{Ui}/components/{Scope}/{Resource}/list{Name}Actions.js`.
A ready object merges over sheet props by supplied key. A non-empty only array replaces the sheet
list and sets its order. null or [] clears the matching only/exclude filter.
Missing/loading uses sheet props. Root `actions: false` skips the override and its
load error, so it cannot add props or fail that view. Bad sheet values fail before
overrides; bad imports/exports name the file when the override is used.
Action-prop errors fail only that view, including when it has no rows.

### Row click Target

Each view has one root `target`. Explicit `null` or `true` opens View; `false` stops the click.
A string such as `view`, `edit`, `add`, or `approve` names the action on the current resource.
A record action in a string target uses the clicked row's `Code`.

When the `target` key is absent and no ready Target override supplies one, the app checks
the final eligible action list for that row. One or more buttons infer `target: false`;
no buttons infer `target: true`. This includes `actions: false` and `max: 0`. Any explicit
target always wins. In Manage Lists, **Automatic** leaves `target` out of JSON, while
choosing **View** saves `target: true`.

An object can choose a resource, action, source-row field for the target code, and query values:

```json
{
  "target": {
    "action": "add",
    "query": {
      "outletCode": "$outlet.Code",
      "taxApplied": "$tax.Code",
      "currentProgress": "Progress"
    }
  }
}
```

The object accepts `resource`, `action`, `code`, and `query`. Resource defaults to the current
resource; action defaults to `index`. Resource and code must be non-empty strings if supplied.
Action names must start with a letter and contain only letters, digits, `_`, or `-`.
The `code` string is a field name or path on the clicked row, not a fixed code.
If a record action has no code field or its value is not a non-empty string, the click does nothing.
Index and Add do not require a record code. Other named actions open their action page;
they do not run an Additional Action or open its dialog. Target does not support the custom
record/resource page routes.

`query` is an optional plain object. Each key is a URL query name. Each value is a non-empty
field name or path on the clicked row. Keys and paths are trimmed and must not be blank.
Arrays, nested objects, and other value types are invalid. The manager's **Target & actions**
panel lets you add, edit, and remove each name/path pair. A blank resource uses this resource.
The same query controls work for same-resource and cross-resource targets, including Add.
To open another resource, add `resource`. The old `OutletPayments` OverdueInvoices view maps
`outletCode` from `outletCode` and `invoiceCode` from `code`. Its Outlets view maps
`outletCode` from `code`.

At click time, the target reads each path with `readField`. A direct field such as `Progress`
and a relation path such as `$outlet.Code` both work. It sends the values as `params.query` to
`useResourceNav.goTo`; it does not build a URL string. The target must pass the destination
permission check before query values are read or navigation starts. Query data cannot change
the permission check.

String, number, and boolean row values are sent as query values. So `0` and `false` stay valid.
Missing and null values are left out. Empty strings, arrays, objects, and other non-scalar values
are also left out. Existing route handling turns scalar values into URL text.

The optional `list{Name}Target.js` exports an approved target value or a synchronous
function `(row) => target`. The function runs only on click, not once per displayed row.
A ready override replaces the whole sheet target, including when its value is `false`.
A pending import blocks the click. An import failure fails that view. Invalid click targets
and thrown functions are reported to the console and do not navigate. Query checks also apply
to target objects returned by an override.

The handler checks `allowed` on the destination before navigation: index/view use
`read`, add uses `write`, edit uses `update`, and named actions use their own name.
For another resource, it checks the destination code, not the source row as a target row.
If that target record is not loaded, the existing `allowed` helper can pass the
resource-level check without a record-level check. The handler uses that existing result.
Cross-resource navigation needs a destination route in the resource's menu metadata.

The List opts into AppList's explicit clickable behavior alongside its btn slot.
Clicks in that slot stop before reaching the row. When `target` is missing, row clicks
are inferred from the final action buttons for that row. Buttons stop the row click;
no buttons open View. Any explicit target, including `null`, takes precedence.
A target can be `false`, but the row can look clickable before the click.

## 10. AppList Props overrides

The sheet accepts `paginate`, `perPage`, and `threshold` at the view root.
A JavaScript Props override can supply native AppList props for one view:

```js
export default {
  paginate: true,
  perPage: 10,
  threshold: 20
}
```

Use `list{Name}Props.js` in the normal [override paths](UI_LIST_SWITCHER_COMPONENTS.md#45-override-lookup).
It exports a non-null object, not an array. Its keys merge over sheet pagination keys. Display stages then set their own supplied keys.
The current AppList accepts these prop groups:

| Use | Native prop names |
|---|---|
| Data and paging | `items`, `page`, `keepPage`, `paginate`, `perPage`, `threshold`, `itemKey`, `loading` |
| Spacing and cards | `bordered`, `gutter`, `itemBordered`, `separator`, `dense`, `itemClass`, `align`, `tag` |
| Input and selection | `input`, `inputProps`, `inputLabel`, `inputKey`, `inputValue`, `selectable`, `checkbox`, `val`, `trueValue`, `falseValue`, `checkboxColor` |
| Click and button | `clickable`, `btn`, `btnColor` |
| Icon and row color | `icon`, `iconColor`, `color`, `highlight`, `highlightColor` |
| Avatar | `avatar`, `avatarLabel`, `avatarColor`, `avatarSize` |
| Main cells | `layout`, `content`, `label`, `labelClass`, `caption`, `captionClass` |
| Meta cells | `meta`, `metaLayout`, `metaColor`, `metaLabel`, `metaCaption`, `chip`, `chipColor`, `chipOutline`, `chipTextColor`, `badge`, `badgeColor`, `badgeTextColor`, `badgeOutline` |

The List supplies the rows, loading state, row-click handler, and inline action slot.
It also supplies the remembered page and turns on `keepPage` so row changes do not
reset it. A Props override can supply its own `page` or `keepPage`.
A Props override is trusted code: check how its props interact with those bindings.
The renderer defines prop types and defaults in [abstract/List.vue](../FRONTENT/src/components/abstract/List.vue#L205).
ListViews supplies the [shared empty state](#8-how-rows-reach-applist) after merging view props.

Sources: [Content](../FRONTENT/src/composables/resources/listViews/features/91Content.js#L3),
[Meta](../FRONTENT/src/composables/resources/listViews/features/92Meta.js#L3),
[Style](../FRONTENT/src/composables/resources/listViews/features/93Style.js#L3),
[display helpers](../FRONTENT/src/composables/resources/listViews/listItemProps.js#L1),
[List consumer](../FRONTENT/src/components/contents/List.vue#L1),
[AppList renderer](../FRONTENT/src/components/abstract/List.vue#L244).
