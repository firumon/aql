# AQL Content Layout & Customization System

This document is the complete reference guide for the AQL Content Customization System. It explains the `contents:` page contract, the `Content.vue` orchestrator, `useContentResolver.js` resolution rules, the built-in `List` content component, and how to create per-resource or per-active-view overrides without rewriting full HTML/Vue templates.

---

---

## Parts of this document

This document is split so each part stays readable on its own. The parts are canonical — this hub does not restate them.

| Part | Covers |
|---|---|
| [Content System — Page Schemas & Content Atomicity](UI_CONTENT_PAGE_SCHEMAS.md) | View/Add/Edit/Action configuration schemas via JS modifiers, and the one-content-one-job rule. |




### Where each section lives

Section numbers are unchanged, so an existing `§N` reference still resolves — find it here.

| § | Section | File |
|---|---|---|
| §5 | Other Page Configuration Schemas (View/Add/Edit/Action — via JS Modifiers) | [UI_CONTENT_PAGE_SCHEMAS.md](UI_CONTENT_PAGE_SCHEMAS.md) |
| §6 | Content Atomicity — one content, one job (STRICT) | [UI_CONTENT_PAGE_SCHEMAS.md](UI_CONTENT_PAGE_SCHEMAS.md) |

## 1. System Architecture

A resource page's Base Page contract (`src/pages/[scope]/[page].js`) declares which content components its body renders via a `contents: [...]` array:

```javascript
// src/pages/Master/index.js
export default {
  sections: ['PageHeader', 'FilterInput', 'PageAction'],
  contents: ['List'],
}
```

`Page.vue` (`FRONTENT/src/pages/Page.vue`) renders one [Content.vue](file:///f:/AQL/FRONTENT/src/components/Content.vue) per entry inside `AqlContentWrapper`, forwarding the full `pageProps` object (page, scope, resource, uiName, and all orchestrator state) as attributes:

```html
<Content
  v-for="content in contents"
  :key="content"
  :content="content"
  v-bind="pageProps"
/>
```

`Content.vue` is a thin orchestrator: it merges `$attrs` with the `content` identity into `preparedProps` and hands that to [useContentResolver.js](file:///f:/AQL/FRONTENT/src/composables/resources/useContentResolver.js), which performs the actual lookup. While resolving it shows a spinner; if nothing matches it renders a "Content Not Defined" card naming the missing `content`/`page`/`resource`/`scope` combination.

### Registries (built once at startup via `import.meta.glob`)
- **Framework registry**: everything under `src/components/**/*.{vue,js}` (keyed by lowercase path, e.g. `components/contents/list.vue`).
- **Custom UI registry**: everything under `src/_ui/**/*.{vue,js}` (keyed by lowercase path, e.g. `_ui/aql/components/contents/list.vue` or `_ui/aql/components/master/products/index/list.vue`).

### Two-Step Resolution (mirrors the Section resolver, scoped to `contents/`)
1. **Locate the base content component**, in priority order:
   a. Custom UI generic content: `_ui/[uiName]/components/contents/[content].vue`
   b. Framework generic content: `components/contents/[content].vue` (when that base file exists)
   c. If neither exists, the first matching Vue override candidate from step 2 below is promoted to serve as the base.
   d. If still nothing, fall back to the caller-supplied `defaultComponent` (when a caller supplies one).
2. **Locate a page/resource/scope-level override or modifier** for that base — first match wins, most specific first:
   1. `_ui/[uiName]/components/[scope]/[resource]/[page]/[content].vue` (Vue override — resource + page specific)
   2. `_ui/[uiName]/components/[scope]/[resource]/[page]/[content].js` (JS modifier — resource + page specific)
   3. `_ui/[uiName]/components/[scope]/[resource]/[content].vue`
   4. `_ui/[uiName]/components/[scope]/[resource]/[content].js`
   5. `_ui/[uiName]/components/[scope]/[page]/[content].vue`
   6. `_ui/[uiName]/components/[scope]/[page]/[content].js`
   7. `_ui/[uiName]/components/[scope]/[content].vue`
   8. `_ui/[uiName]/components/[scope]/[content].js`
   9. `_ui/[uiName]/components/[content].vue`
   10. `_ui/[uiName]/components/[content].js`

Path segments are lowercased for lookup; `resource` (a slug, e.g. `stock-movements`) is PascalCased then lowercased (`stockmovements`) to match folder naming.

> [!IMPORTANT]
> **This normalization is enforced everywhere a resource slug feeds a glob-registry folder lookup**, not just in `useContentResolver.js` itself — both the `View` system (`ViewRecord.vue`'s `viewrecord.(vue|js)`, `ViewChildren.vue`'s `viewchild*.(vue|js)`, `ViewParent.vue`'s `viewparent*.(vue|js)`, and `useViewColumnResolver.js`'s `viewcolumn*.(vue|js)`) and the `Create`/`Update` system (`FormRecord.vue`, `Create.vue`, `Update.vue`, `FormChild.vue` — see [UI_CREATE_AND_UPDATE_SYSTEM.md](file:///f:/AQL/Documents/UI_CREATE_AND_UPDATE_SYSTEM.md) §9) run every resource slug through `toPascalCase(slug).toLowerCase()` before building a candidate path. A kebab-case slug (`outlet-visits`) becomes `outletvisits`, never `outlet-visits` — hyphens never appear in a glob-registry key because folder names are PascalCase-derived. Resource **menu routes** (`ui.menus[].route`, e.g. `/operation/outlet-visits`) and URL params (`route.params.resourceSlug`) ARE genuinely kebab-case in production — confirmed against live seed data in `GAS/syncAppResources.gs` — which is exactly why this normalization step exists: it converts a real kebab-case slug into the PascalCase-derived glob key. `useResourceNav.js`'s `findScopeBySlug` and `useRouteConfig.js`'s `resourceConfig` fallback correspondingly strip hyphens (`.replace(/-/g, '')`) rather than assume PascalCase input, for the same reason.

### Custom Templates vs. JS Logic Modifiers
- **Vue Template Override (`.vue`)**: must contain a `<template>` block; **replaces the base content entirely**, and props flow through unmodified so the override can read `$attrs` directly.
- **JS Logic Modifier (`.js`)**: exports a default `(props, { pageState, resourceRecord, resourceConfig }) => modifiedProps` (or a plain object) that keeps the base content component but adjusts the props fed into it.

---

## 2. List content

A page contract names `List`; the content resolver mounts [List.vue](../FRONTENT/src/components/contents/List.vue).
List and ListSwitcher share [useListView](UI_LIST_SWITCHER_COMPONENTS.md#41-public-entry-point).
List passes active rows and view-level `itemProps` to AppList. It shows an active-view error banner
and uses AppList's empty and loading display. A keyed transition follows resource and view name.

## 3. AppList and item display

AppList wraps abstract/List and forwards its props and slots. `view.item` and named display
overrides supply layout/content, metaLayout/meta, icon, color, and highlight. Sheet pagination
keys and a Props override supply view-wide props. The List does not pass generic content
modifier props through to AppList. See the [item guide](UI_LIST_VIEWS_ITEMS.md).

## 4. Named view overrides and actions

Use the named ListViews override loader for Data, Group, Map, Filter, Order, Search, Limit,
Props, Target, display values, and Actions. See [paths and exports](UI_LIST_SWITCHER_COMPONENTS.md#45-override-lookup).
Inline AdditionalActionsButtons uses the active view's `actionProps`; its action system owns
dispatch. A row click resolves the active Target and checks destination access. Action-slot
clicks stop before reaching the row. View permission controls which lists are available.

> [!IMPORTANT]
> **Content overrides do not control field rendering.** Individual form controls and detail/table value cells are delegated to the base field subsystem at `src/_fields/<type>/{Add,Edit,View}.vue`, resolved through `resolveFieldComponent(type, mode)` — the content components hold no type branches. Changing how a *field type* looks means editing that type's SFC (which applies to every resource, in add/edit/view); changing how *one column of one resource* looks means a `FormField<Header>` / `ViewColumn<Col>` override. See [UI_CREATE_AND_UPDATE_SYSTEM.md](file:///f:/AQL/Documents/UI_CREATE_AND_UPDATE_SYSTEM.md) §15 and [UI_VIEW_SYSTEM.md](file:///f:/AQL/Documents/UI_VIEW_SYSTEM.md) §4.

---
