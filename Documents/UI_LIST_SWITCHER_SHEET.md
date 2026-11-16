# ListViews - Sheet Setup and Config

Part of the [ListViews guide](UI_LIST_SWITCHER.md).
Use this guide to set up a list in the Resources sheet or the Manage Lists dialog.
The app reads each configured view from the resource login config.

The runtime [Config override](UI_LIST_SWITCHER_COMPONENTS.md#config-overrides-use-only-when-required)
can replace supported view settings after the saved permission check. It cannot replace
`name` or `permission`. Manage Lists edits the saved settings, not that runtime result.
A Config file is allowed only for a required need and with explicit user permission.


## 5.1 Where a view is saved

In the APP spreadsheet, find the resource row in the `Resources` sheet.
Its `Name` identifies the resource. Its `ListViews` cell holds the view array.
This is often written as `APP.Resources.ListViews`.

Use this small test config:
```json
[
  {
    "name": "All",
    "label": "All records"
  }
]
```

Use a unique, stable name for each view. Use letters and digits when possible.
The name also picks the resource source rule and override filenames.
A bare string can name a view; entries with no name are skipped. Duplicate names are not rejected.
The source rule or Data override can narrow rows before Filter runs.

The backend reads these cell shapes:

| Cell | Backend mode | Views sent to the app | Frontend result |
|---|---|---|---|
| Blank | `auto` | `[]` | No configured lists |
| `[]` | `off` | `[]` | No configured lists |
| Non-empty JSON array | `custom` | That array | Each named entry runs through the pipeline |
| Invalid JSON or non-array | `auto` | `[]` | No configured lists |

Do not put the words `auto` or `off` in the cell to choose a mode.
The frontend reads `ui.listViews`; it does not branch on `listViewsMode`.
Feature overrides apply to configured names through a separate loader.

Source: [parseListViewsCell](../GAS/resourceRegistry.gs#L744),
[useListView](../FRONTENT/src/composables/resources/listViews/useListView.js#L38).

## 5.2 Set up a view with Manage Lists

Open **AQL > Resources > Manage Lists**.

Before preparing a seed, first confirm the rows it will display. Use `useData` for this
resource's own records, decorated with calculated facts, or use `use<Family>Data` when the rows need another
resource. Then apply the list's rules in `Data/useList.js`. Check the final row fields and
values. Use those fields when setting the seed's item display. The current engine connects a
family data file through the resource's `useList.js` rules.

1. Pick a resource.
2. Choose an existing view, or click **New view**.
3. Set the view keys in the tabs: **Basic**, **Filter**, **Group**, **Order**,
   **Search & page**, **Target & actions**, and **Item view**. Each field has an `i` hint.
4. In **Basic**, set the code name, tab label, icon, color, count, permission,
   and default flag. Leave a field empty to use its frontend default.
5. Use the **Custom developer keys** box for other root keys. It must contain one
   JSON object. Do not repeat a key that has its own tab field.
6. Click **Done** to add or update the view in this dialog. This does not write the sheet yet.
7. Reorder the views in **List order** by dragging a row, changing its position,
   or using the arrow buttons. The order is the order saved in the cell.
8. Check **ListViews cell preview**, then click **Save to sheet**.

The **Filter** tab edits this view's ListViews `filter` key. For shared resource
row rules, leave it empty and use that resource's `Data/useList.js`.
The **Group** tab supports a list of grouping rules. The **Order** tab supports
sort rules and conditions. The **Search & page** tab can save search fields as
compact comma text or a JSON array. **Item view** holds AppList display settings.
In **Target & actions**, an object target can add URL query names and row field paths.
Blank resource means the current resource. A named resource opens another resource.
The automatic row target turns off row clicks when action buttons show. It opens View
when no buttons show. A chosen View target saves `target: true` and stays explicit.
The **Inline actions** panel has an on/off control. A saved `actions: false` shows
as off. Off saves root `actions: false` and keeps it in the JSON preview. Turning
it on clears `false`; the existing action fields are then available.

Defaults such as the primary color, automatic count, pagination, 25 rows per page,
the 35-row threshold, and 3 action buttons are left out of the saved JSON. A blank
`limit` means no row cap in the current frontend contract. The preview shows these
omitted defaults as omitted, so the cell only stores values that differ from them.

The preview and Save to sheet also leave out redundant layouts. Main `caption,label`
is omitted. A meta layout is omitted when the supplied templates show the same cells,
in the same order, as the ListViews default. This includes a lone chip, badge, label,
or caption. A layout that changes the order, repeats a populated cell, or hides a
supplied value is kept. Explicit hide settings (`[]` or an empty layout string) are
kept, including when the templates are empty. Save and reopen keep that hide choice.

Keep ListViews sheet data small. If the frontend already makes a final display value,
including its fallback, the sheet only links the style key to that field. Do not repeat
that work with a map that sends each value to itself or a second fallback in the sheet.
See [final style values](UI_LIST_VIEWS_ITEMS.md#final-style-values-from-the-frontend).

When a view selects one fixed `Progress` or `Status`, such as Open or Closed, do not
repeat `{Progress}` in `metaChip`, `metaLabel`, or captions. Show useful context,
such as a required or due date, instead. See
[Progress shown by the list name](UI_LIST_VIEWS_ITEMS.md#progress-shown-by-the-list-name).

Pagination starts checked. Checked leaves out `paginate`; unchecked saves `paginate:false`.
Rows per page and threshold start blank. Their placeholders show the frontend defaults:
25 and 35. The Show only and Hide action menus suggest names from the selected resource's
`AdditionalActions` list. A choice adds that name on its own line.

In **Item view**, a field menu adds `{Field}` at the cursor. Labels and captions can have
more than one input. Missing labels and captions use the automatic values in the
[item guide](UI_LIST_VIEWS_ITEMS.md#automatic-labels-and-captions). An empty input that
was saved stays blank. Each `meta*` key shows one input.
The Item view also edits row colors and chip outline. Its **AppList props** box saves
a JSON object at root `props`, beside `item`. For example:

```json
{ "bordered": true, "separator": true, "chipOutline": true }
```

Paste only the props object in this box. Blank, `null`, or `{}` leaves out `props`.
Other JSON values and broken JSON block the view save. The preview and save keep
nested objects, arrays, `false`, zero, and empty text. They do not strip defaults
inside `props`. Sheet values are JSON only; function text is not run.
Root paging values apply first, then `props`, then the JavaScript Props object.
Later item display settings can replace matching display props. See
[AppList props](UI_LIST_VIEWS_ITEMS.md#10-applist-props-overrides) for the full rules.
Each icon or color style has three choices:

- **One value** saves text. A row key with that name takes priority when there is a row.
- **Use field value** saves `column` and an optional `default`. The field holds the result text.
- **Map by field** saves `column`, `map`, and an optional `default`. The field picks a map result.

The cell preview shows the same style shape that Save to sheet writes.
The frontend still accepts arrays for repeated meta slots. Editing a multi-entry value
in this manager saves only the one template shown. Button size offers `xs`, `sm`, `md`,
`lg`, and `xl`; a saved custom size stays available while editing. The action limit
defaults to 3, accepts whole numbers from 0 up, and stays out of JSON when it is 3.

The cell mode selector has three choices:

- **Auto** saves a blank cell when saving the resource.
- **Custom** saves the view array.
- **Off** saves `[]`.

Saving a default view clears the default flag on other views. Removing the last
custom view switches the mode to Off; saving writes `[]`. Choose Auto if you want
the cell to be blank instead.

Save calls `app_saveResourceListViews`. It writes the cell and clears the
server resource-config cache. It does not push code or refresh an open app's auth config.
Sign in again to receive the saved resource config.
A normal record reload is not an auth-config refresh.

`syncAppResourcesFromCode` protects non-empty `ListViews` cells. It treats blank,
`[]`, and `{}` cells as blank, though. If the resource has ListViews in its code
config, a code sync can fill one of those cells from that config. Check the
resource seed before using an empty cell to keep views off.
[Code sync](../GAS/syncAppResources.gs#L2466).

### Manager limits

- The fields help build common values. **Custom developer keys** keeps other root
  JSON keys, but it does not make the frontend read them. Only a frontend feature
  or a custom view override that reads a key gives it behavior.
- The Filter tab is still available for a view-level filter. Resource row filters
  belong in `Data/useList.js`.
- **Inline actions** saves `actions: false` while off. Turning it on clears that
  value; the object fields can then set action selection and style.
- A saved cell is not the same as the app's loaded config. Sign in again after saving.

Source: [manager UI](../GAS/listViewsManager.html#L585),
[manager save](../GAS/listViewsManager.html#L1860),
[server save](../GAS/appMenu.gs#L918).

## 5.3 View keys

| Key | Accepted value | If missing |
|---|---|---|
| `name` | Non-empty text. A view entry may also be a bare string name. Use distinct names. | An object with no name is skipped. |
| `label` | Text shown on the tab. | Uses `name`. |
| `icon` | Icon-name text. The ListViews code does not check it against an icon list. | No tab icon. |
| `color` | A value in [tab color values](#tab-color-values). Other words fall back to `primary`. | `primary`. |
| `default` | JSON `true` or `false`. The first allowed view with `true` is the default. | No marked default; after a remembered choice, selection falls back to the first allowed view. |
| `count` | JSON `true`, JSON `false`, or `"auto"`. | `auto`: show the count only while a search term is present. Other non-boolean values also act as `auto` in current code. |
| `permission` | One action string; a comma-separated action list; an action array; or a resource-to-action(s) map. Lists use `all` unless marked `any`. | No view-level permission gate. |
| `filter` | The current engine accepts a condition or condition/group tree. For resource lists, leave this key out and put row rules in `Data/useList.js`. | No filtering. |
| `group` | Array of rules with `column`, optional `token`, and optional `aggregate`; `null`, `false`, and `[]` also mean no grouping. See [Group](UI_LIST_VIEWS_GROUP_SEARCH_LIMIT.md#group). | No grouping. |
| `order` | Array of rules; `null`, `false`, and `[]` mean no core sort. See [Order](#55-order). | No core sort. |
| `search` | Array of field paths or comma-separated text. The text form is smaller: `"Code,Progress,$outlet.Name"`. `true` searches the field named `true`; it is not a switch. See [Search](UI_LIST_VIEWS_GROUP_SEARCH_LIMIT.md#search). | Missing, `null`, `false`, or `""` uses inferred search fields. |
| `limit` | Whole number `0` or greater. | No cap. `0` returns no core rows. |
| `paginate` | JSON `true` or `false`. | AppList default: `true`. |
| `perPage` | Whole number `1` or greater. | AppList default: `25`. |
| `threshold` | Whole number `0` or greater. | AppList default: `35`. Zero paginates any non-empty list. |
| `props` | Object of native AppList props. See [AppList props](UI_LIST_VIEWS_ITEMS.md#10-applist-props-overrides). | Missing or `null` adds no props. `{}` is valid. |
| `item` | Object. See [item keys](UI_LIST_VIEWS_ITEMS.md#3-item-keys). | Layout is `caption,label`; missing labels and captions use automatic row values. |
| `actions` | `false`, or an object with `only`, `exclude`, `dense`, `size`, and `max`. See [inline actions](UI_LIST_VIEWS_ITEMS.md#9-inline-actions-and-row-navigation). | Missing or `null`: eligible actions, no exclusions, dense buttons, size `md`, max 3. `false`: no action buttons. |
| `target` | `true`, `false`, an action-name string, or an object. See [Target](UI_LIST_VIEWS_ITEMS.md#row-click-target). | Missing key: infer from the final action buttons. No buttons opens View; buttons stop the row click. |

Use JSON booleans and numbers, not quoted values. An omitted key keeps the meaning
shown above. Resource list configs must omit `filter` and put row rules in `Data/useList.js`.
In particular, an omitted `limit` means no cap; it does not mean 50.
Setting a shared frontend default of 50 would change that meaning for views that
need all rows.

ListViews uses the shared [empty state](UI_LIST_VIEWS_ITEMS.md#8-how-rows-reach-applist). Older saved empty text, search text, icon, and icon color keys are ignored and removed on the next save in Manage List Views.

### Nested keys and values

| Parent | Key | Accepted value |
|---|---|---|
| `permission` | Resource entry | A non-empty resource name mapped to one action string, a comma-separated list, or an action array. Resource entries all must pass. |
| `filter` | `type` | `"condition"` or `"group"`. |
| Condition | `column` | Non-empty field name or safe dot path. |
| Condition | `operator` or `op` | `eq`, `neq`, `in`, `not_in`, `gt`, `gte`, `lt`, `lte`, `contains`, `empty`, or `notEmpty`. Aliases: `ne`, `nin`, `notin`, `not_empty`, `notempty`. Names ignore case. |
| Condition | `value` | JSON text, number, boolean, array, or a supported token string. `empty` and `notEmpty` need no value. |
| Group node | `logic`, `items` | `logic`: uppercase `AND` or `OR`; `items`: array of condition/group nodes. |
| `group[]` | `column` | Required non-empty field name or safe dot path. |
| `group[]` | `token` | Optional built-in token or custom token name. Built-in names and limits are in [Group tokens](UI_LIST_VIEWS_TOKENS.md#group-token-values-and-custom-files). |
| `group[]` | `aggregate` | Optional object from field path to one value or an array: `sum`, `min`, `max`, `avg` (case-sensitive). |
| `order[]` | `column`, `order`, `type` | Required field path; `asc` or `desc`; `auto`, `text`, `number`, `date`, `unix`, or `epoch`. Direction and type ignore case. |
| `order[]` | `aggregate` | Optional `min`, `max`, `sum`, or `count` for many values. |
| `order[]` | `on` | Optional `true`, `false`, `null`, condition, group, or array of conditions/groups. Missing/`true` applies to all rows; false-like values apply to none. |
| `item` | `layout`, `metaLayout` | CSV string or array. Main slots: `label`, `caption`; meta slots: `chip`, `badge`, `label`, `caption`. Missing main layout uses `caption,label`; missing meta layout uses `label,caption`, with chip/badge slots added when supplied. |
| `item` | `labels`, `captions`, `metaChip`, `metaBadge`, `metaLabel`, `metaCaption` | CSV string or array of text templates. Use an array when a template contains a comma. |
| `item` | `chipOutline` | JSON `true` or `false`. |
| `item` | `icon`, `iconColor`, `color`, `highlight`, `metaColor`, `chipColor`, `badgeColor` | A string, an object with `column` and optional text `default`, or the same object with a `map` of row values to text results. See [style rules](UI_LIST_VIEWS_ITEMS.md#6-icon-color-and-highlight). |
| `actions` object | `only`, `exclude`, `dense`, `size`, `max` | `only`/`exclude`: arrays of action-key strings or `null`; `dense`: boolean; `size`: non-empty string; `max`: whole number 0 or greater. Missing `max` means 3. Quasar sizes and CSS units are listed in [inline actions](UI_LIST_VIEWS_ITEMS.md#9-inline-actions-and-row-navigation). |
| `target` object | `resource`, `action`, `code`, `query` | Optional destination, action, code field/path, and query map. Each query value is a row field/path. See [Target](UI_LIST_VIEWS_ITEMS.md#row-click-target). |
| `target.query` | Plain object from URL query name to row field/path | Keys and values must be non-empty strings. Values are read from the clicked row with `readField`; missing or null row values are omitted. |

These values are the shared frontend contract. The manager may accept less or use
older shapes; see [manager limits](#manager-limits). The linked guides give the
full rules for tokens, display, actions, and row navigation.

The shared frontend reads the keys in this table. It keeps other JSON keys on the
view, but only a custom code override that reads a key can give it behavior.
The shared frontend does not read `source`, `sort`, `display`, or `processing` as
view keys. Use the resource's Data modules for source selection, `order` for
sorting, and `item` for row display. The Custom developer keys panel can store
other root keys for a code override that reads them.

### Tab color values

The tab uses `resolveCssColor` in the frontend. It accepts:

- Brand names: `primary`, `secondary`, `accent`, `positive`, `negative`, `info`, `warning`, `dark`.
- Palette families: `red`, `pink`, `purple`, `deep-purple`, `indigo`, `blue`, `light-blue`, `cyan`, `teal`, `green`, `light-green`, `lime`, `yellow`, `amber`, `orange`, `deep-orange`, `brown`, `grey`, `blue-grey`. Each family may have a shade from `-1` to `-14`.
- Standalone colors: `white`, `black`.
- CSS strings that start with `#`, `rgb(`, `rgba(`, `hsl(`, `hsla(`, `var(`, or `color-mix(`. The helper passes these strings through; the browser decides whether the CSS value is valid.

Other color words fall back to `primary`. For example, a CSS name such as `tomato`
is not in the helper's list. Source: [color resolver](../FRONTENT/src/utils/colorHelpers.js#L6).

Use the sheet to set up features. An override is a JavaScript file written by a developer.
See [override paths and exports](UI_LIST_SWITCHER_COMPONENTS.md#45-override-lookup).
For row display, read [item keys and usage](UI_LIST_VIEWS_ITEMS.md).
Keep tab icon/color at the view root; put row icon/color inside item.
Root `props` can supply native AppList props from the sheet. A developer-only
`list{Name}Props.js` object merges over those props and can keep function values
where AppList supports them; see [override export shapes](UI_LIST_SWITCHER_COMPONENTS.md#46-override-export-shapes).
Use the **Item view** tab for `item` settings. The Custom developer keys panel
only accepts root keys that do not have a tab field.

### View permission

Put `permission` at the view root. The check uses the existing `resourceConfig.allowed` helper.
Missing or null permission leaves the view unrestricted by this setting.
A single action string checks the current resource. An action array or comma-separated string checks
several actions on the current resource. Lists use `all` by default. Add one reserved `any` or `all`
entry to choose the mode; the marker is removed before actions are checked. The words are matched
without case differences and with surrounding spaces trimmed.

An object maps resource names to action strings, CSV lists, or arrays. Each resource's list has its
own mode, and every resource entry must pass. The frontend turns CSV lists into arrays before checking.
The manager saves action arrays as compact CSV text inside the ListViews JSON cell.

```json
[
  { "name": "Everyone" },
  { "name": "Readers", "permission": "read" },
  { "name": "Editors", "permission": "read,update" },
  { "name": "One of the actions", "permission": "any,send,accept" },
  { "name": "OutletEditors", "permission": { "Outlets": "read,update" } }
]
```

Actions and resource names must be non-empty strings. An empty list or map keeps its current
behavior and passes. A list with only a marker, both markers, or repeated markers is malformed and
hides the view. A malformed permission also hides the view. Denied views do not enter the list pipeline or get tabs.
When access changes, a denied active view falls back to an allowed default or first view.
If none remain, there is no active view. A remembered view can return if access returns.
The ListViews cell keeps all raw settings, including denied views.
These checks do not filter records or replace record or server access checks.

## 5.4 Filter

The current engine reads a `filter` key and runs it after the source rule. For resource
lists, leave the key out. Put shared row rules and fixed-purpose rules in the resource's
`Data/useList.js`, so every UI uses the same meaning. For example, Completed always means
Progress = COMPLETED. The manager's Filter tab can add a view filter; leave it
empty for shared resource row rules.

The condition below shows syntax the current engine accepts. It is not an example to save
in `APP.Resources.ListViews` for a resource list.
```json
{
  "type": "condition",
  "column": "Progress",
  "operator": "eq",
  "value": "PLANNED"
}
```

A resource list entry has no filter key:
```json
[
  {
    "name": "Planned",
    "label": "Planned visits",
    "color": "primary",
    "default": true,
    "order": [{ "column": "Date", "order": "asc", "type": "date" }]
  }
]
```

A group has `type: "group"`, `logic: "AND"` or `"OR"`, and `items: []`.
Each item can be another group or a condition.
An empty group matches all rows.

Filter reads direct keys and dot paths, including prepared fields and $outlet.Name.
Column names are case-sensitive. Plain string values compare without case.
An exact key containing dots wins before path traversal.
For child arrays, the evaluator does not add an any-child rule; use a scalar prepared fact
or a Filter override for that need.

The feature uses `strictColumn: false`.
A missing field is read as undefined; `empty` can match it.
Without a filter, Filter passes its input array through unchanged.
That input may already be reduced to Group's kept rows.
Use valid node types: an unknown node or root array can silently pass rows through.
Saving the sheet does not validate the full filter tree.

See [all operators and tokens](UI_LIST_VIEWS_TOKENS.md).
For a prepared number like `daysUntilVisit`, compare with the number `7`.
`$daysIn:7` expects a date column and converts that date to a day offset.

## 5.5 Order

Order config is an array of rules:
```json
[
  {
    "name": "All",
    "order": [
      { "column": "UpdatedAt", "order": "asc", "type": "epoch" },
      { "column": "RespondDate", "order": "desc", "type": "date" },
      { "column": "Code", "order": "asc", "type": "text" }
    ]
  }
]
```

Multi-rule sorting follows the pair-comparison rules below.
A single-field sort uses its type and direction.
Sorting makes a new array and keeps the same row objects.
It does not remove rows.

| Rule key | Allowed value | Default |
|---|---|---|
| `column` | Field name or dot path | Required |
| `order` | `asc` or `desc` | `asc` |
| `type` | `auto`, `text`, `number`, `date`, `unix`, `epoch` | `auto` |
| `aggregate` | `min`, `max`, `sum`, `count` for many values | None |
| `on` | Condition, group, array of conditions/groups, or boolean/null | Missing or `true`: all rows apply; `false` or `null`: no rows apply |

No `order`, `null`, `false`, or an empty array means no core sort.
An Order override can still run.

### Multi-rule behavior

Multi-rule sorting uses these pair-comparison rules.

1. Each row builds a candidate list. Each rule whose on condition matches adds one value.
   A rule that does not match adds no value.
2. Compare every left candidate with every right candidate: A x B pairs, in candidate order.
   The first non-zero difference decides the order.
3. Use the left candidate's rule direction: asc or desc.
4. Blank/null values sort last in both directions.
5. A row with no candidates sorts after a row with values.
6. A full tie keeps the input order.


### How types are read

No sheet schema is consulted by the sorter.
With `auto`, it looks at non-blank values for the rule's matching rows:

1. Any Date object or a date-shaped string makes the rule a date sort.
2. Otherwise, if all values are numeric, it uses numbers.
3. Otherwise, it uses text.

Date-shaped strings include `2026-11-10` and `10/11/2026`, with optional time.
For other date shapes, set `type: "date"`.
Mixed, dirty values should use an explicit type.

| Type | Meaning |
|---|---|
| `text` | Case-insensitive natural text order; e.g. Item 2 comes before Item 10 |
| `number` | Numeric values and numeric strings; booleans become 0/1 |
| `date` | Shared date parser; numeric magnitudes from 1e9 up to but below 1e11 are treated as seconds |
| `unix` | Numeric values are seconds since the epoch; multiply by 1000 |
| `epoch` | Numeric values are milliseconds since the epoch |
| `auto` | The three checks above |

An all-numeric timestamp field stays a numeric sort in `auto`.
It does not guess seconds versus milliseconds there.
One consistent unit sorts correctly as numbers.
Mixed units need clear data or an explicit type.
Use `epoch` for known milliseconds, including dates whose values could fit the seconds heuristic.

Null, undefined, whitespace-only strings, and non-finite numbers go last in both directions.
Values that cannot be converted under the chosen numeric/date type also go last.
Object-valued fields need a scalar path; they cannot be sorted as objects.

### Parent and child fields

The path is relative to one row:
```json
{
  "order": [
    { "column": "$outlet.Name", "order": "asc", "type": "text" },
    { "column": "$VisitLines.Amount", "order": "desc", "type": "number", "aggregate": "sum" }
  ]
}
```

`$VisitLines` here is an example child getter. Use the real key from `_Children`.
`_Parents` lists parent/link keys.
Use `$VisitLines.0.Amount` for one child, or `$VisitLines.length` for its count.
An exact row key containing dots wins before path traversal.

A path through all children gives many values. Choose:

- `min`: the smallest value.
- `max`: the largest value.
- `sum`: the total; use numeric values and `type: "number"`.
- `count`: the number of array entries, including blank entries.

Empty arrays give 0 for sum/count and a blank for min/max.
Missing parents sort as blank until related data is available.
A relation read can trigger the existing record store to queue an authorized resource on first read.
The list stages do not call the network directly; reactive results update when records arrive.

### Conditional rules with on

```json
{
  "order": [
    {
      "column": "UpdatedAt",
      "order": "desc",
      "type": "epoch",
      "on": {
        "type": "group",
        "logic": "AND",
        "items": [
          { "type": "condition", "column": "Progress", "operator": "eq", "value": "PLANNED" },
          { "type": "condition", "column": "CreatedBy", "operator": "eq", "value": "$userCode" }
        ]
      }
    },
    { "column": "$outlet.Name", "order": "asc", "type": "text" }
  ]
}
```

on is evaluated for each row. A rule that does not match adds no candidate value.
It never removes the row itself.
A row with no active rule values sorts after rows with values.

No `on`, or `on: true`, applies to all rows.
An explicit false, null, zero, empty string, or undefined skips the rule for all rows.
A JSON array in `on` means AND; an empty array matches all.
Nested groups and the shared tokens/operators work here.
Order accepts type-less condition/group objects in `on`; each condition uses `operator`.
Prefer the full filter shape in saved config.
Order's `on` supports scalar dot paths; it does not add "any child matches" logic.
Tokens belong in condition values, not in the column or direction.

## More row features

Read [Group, Search, and Limit](UI_LIST_VIEWS_GROUP_SEARCH_LIMIT.md) for exact config,
default search fields, override gates, and the final count.
Those row features run Group -> Map -> Filter -> Order -> Search -> Limit.
Props and Target run next. Content -> Meta -> Style add the [item display props](UI_LIST_VIEWS_ITEMS.md),
and Actions adds the inline action props.

## 5.6 Check your list

1. Start with an identity source and one view.
2. Put the full array in the ListViews cell.
3. Check the view count and any error shown on the list.
4. Check the rows shown for the active view.
5. Check the shared baseline and named rule in `Data/useList.js`.
6. Check Order with the pair-comparison rules above.
7. Check Group's kept rows and each pass's facts, search term, Limit, overrides, and active-view item display.
8. Save the lasting config in Sheets, then reload the app's auth config.

A count of zero with an error is not an empty successful list.
Counts cover loaded source rows, not every row on the server.
