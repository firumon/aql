---
name: AQL Content & Page Customization Agent
description: Specialized initialization prompt for creating, inspecting, or modifying content components (List and other `contents:` entries), named-list display, form layouts, details cards, and collapsible form sections under Content.
---

# Scope Boundary

This document defines initialization parameters for agents tasked with resource-level Content overrides, `List` customization, or JS layout modifications.

## Required Pre-Reads
Before creating or modifying any local Content components:
1. **System Specifications**: Read [UI_CONTENT_SYSTEM.md](file:///f:/AQL/Documents/UI_CONTENT_SYSTEM.md) to review the `contents:` page contract, the `Content.vue` / `useContentResolver.js` resolution chain, the current List consumer and the generic content resolver. For list work, also read [list_views_development.md](list_views_development.md).
2. **Architecture Constraints**: Read [CORE_ARCHITECTURE_RULES.md](file:///f:/AQL/Documents/CORE_ARCHITECTURE_RULES.md) for strict formatting rules (e.g. no `<style>` blocks in local components).
3. **If the task CREATES or restructures a content component** (rather than overriding one for a resource): also read [UI_RENDERABLE_CONTRACT.md](file:///f:/AQL/Documents/UI_RENDERABLE_CONTRACT.md) and load [renderable_contract.md](file:///f:/AQL/References/Prompt%20Library/Initialization/renderable_contract.md). Every overridable cell must route through `abstract/Renderable.js`, or the new component is closed to `_ui/` customization from day one.

> [!IMPORTANT]
> **Field rendering is out of scope for this prompt.** Individual form controls and detail/table value cells are NOT rendered by the content components — they are delegated to the base field subsystem at `src/_fields/<type>/{Add,Edit,View}.vue`, resolved through `resolveFieldComponent(type, mode)`. If the task is "make this column render as a link / currency / status chip", or "change how a field type looks", stop and route to the right prompt instead:
> - Form-side (`Create`/`Update`/`FormRecord`/`FormChild`) → [content_create_and_update_customization.md](file:///f:/AQL/References/Prompt%20Library/Initialization/content_create_and_update_customization.md) §0
> - View-side (`ViewRecord`/`ViewChildCompact`) → [view_customization.md](file:///f:/AQL/References/Prompt%20Library/Initialization/view_customization.md) §0
> - The subsystem itself → [`FRONTENT/src/_fields/README.md`](file:///f:/AQL/FRONTENT/src/_fields/README.md)
>
> A change to one field type there applies to **every** resource, in add, edit, and view — which is usually what is actually wanted, and is never achievable through a per-resource content override.

---

> [!IMPORTANT]
> **Shared pure helpers live in `FRONTENT/src/utils/` — look there before writing one.**
>
> | File | Owns |
> |---|---|
> | [`dateHelpers.js`](file:///f:/AQL/FRONTENT/src/utils/dateHelpers.js) | `parseAnyDate`, `startOfDay`/`endOfDay`, `startOfMonth`/`endOfMonth`, `toDateOnly`, `toDateTime24`, `addDays`/`addMonths`, `dayOfYear`, `isoWeek`, `daysFromToday`. Handles BOTH sheet storage shapes (epoch ms in audit columns, ISO strings in business date columns). **Never hand-roll date parsing or day maths.** |
> | [`sortHelpers.js`](file:///f:/AQL/FRONTENT/src/utils/sortHelpers.js) | `sortByDate(items, column, direction)` — `column` may be a key or a reader function. Sorts without copying rows (a `{ ...row }` spread would strip the non-enumerable relation getters `$outlet` / `_Parents`); unparseable dates sink to the end in both directions. |
> | [`appHelpers.js`](file:///f:/AQL/FRONTENT/src/utils/appHelpers.js) | String/identity helpers used by every resolver — `toPascalCase` and friends. |
> | [`colorHelpers.js`](file:///f:/AQL/FRONTENT/src/utils/colorHelpers.js) | `resolveCssColor(value, fallback)` — Quasar brand names, Material palette names and raw CSS all resolve to one inline custom property. |
> | [`placeholderProps.js`](file:///f:/AQL/FRONTENT/src/utils/placeholderProps.js) | `resolvePlaceholderProps(props, identity, kind)` — the `Props<Identity>` merge. Call it in a resolver; never re-implement it inline. |
>
> **The rule this enforces**: a pure helper that is not resource knowledge belongs in `src/utils/`. It must NOT be duplicated into a `_ui/` composable, and a `_ui/` composable must NEVER import another resource's composable to borrow one — `_ui/**/OutletRestocks/**` reaching into `_ui/**/OutletVisits/**` is exactly the cross-resource dependency [CORE_ARCHITECTURE_RULES.md](file:///f:/AQL/Documents/CORE_ARCHITECTURE_RULES.md) §5 forbids. Promote the helper to `src/utils/` and re-export it from the composable if the old import path must keep working.

## 1. Context Tracing Protocol

To custom-tailor content layouts:
1. **Locate Metadata**: Read the target resource schema file under `src/metadata/schemas/` or fetch headers in `src/pages/resource/` page context.
2. **Confirm the page contract**: Check `src/pages/[scope]/[page].js` for `contents: [...]` (e.g. `contents: ['List']`) to know which content name(s) render on that page.
3. **Find Target Override Paths**: Check if overrides already exist under `src/_ui/[UiName]/components/[scope]/[ResourceName]/[page]/`.
4. **Analyze Overriding Strategy**:
   - For generic content, start with a `Props<Identity>` block only when the base component consumes those props. A JS modifier can adjust resolver props. List gets display from ListViews item config and display overrides.
   - For other content bases, prefer JS logic modifiers when their declared props cover the change. For List, follow the item guide and its per-kind display exports.
   - Use **Vue Template SFC Overrides** (`[Content].vue` under custom UI) ONLY if the page requires complex non-standard UI elements, custom slots, or specialized inputs.
     > Before reaching for a `.vue` override, check whether the component accepts a **component-valued prop** from a `.js` modifier — `btn: VisitActionButtons`, `metaCaption: SomePill`. Any prop routed through `abstract/Renderable.js` accepts a component definition, which replaces that one cell without swapping component identity (a `.vue` override remounts the list and kills its row transitions). See [UI_RENDERABLE_CONTRACT.md](file:///f:/AQL/Documents/UI_RENDERABLE_CONTRACT.md) §1. A `.vue` override is correct only when the **structure** changes — row arrangement, extra sections, a different wrapper.
   - Use Data, Group, Map, Filter, Order, Search, or Limit overrides for rows. These are ListViews overrides, not content modifiers.

---

## 2. Implementation Rules

### 2.1 Content modifiers and List

A content modifier receives the resolver props and returns adjusted props.
Read the actual base component before choosing a prop.
AppList and abstract/List still support caller-provided rows and their own render props.

The components/contents/List.vue shares useListView with the switcher.
Read [item display](../../../Documents/UI_LIST_VIEWS_ITEMS.md) for all accepted settings and exports.
For List changes, follow [list_views_development.md](list_views_development.md).
Use view.item or a matching display override; a PropsList/content modifier does not replace its bag.
Use the named view and its feature or display override for per-view work.

### 2.2 Writing Vue Template Overrides
- Vue overrides must contain a `<template>` block. Components without a template block are **never allowed**.
- Bind all values using the page-provided state injection tokens (`resourceConfig`, `resourceRecord`, `pageState`) — these are passed to JS modifier functions as the second argument, and available via `inject()` in Vue overrides.
- Props flow through unmodified to a Vue override, so read values via `$attrs` / declared props rather than assuming a fixed shape.
- **NEVER** use inline style blocks. Use Quasar utility classes (e.g. `q-pa-md`, `row`, `col`, `q-gutter-sm`) for spacing, grids, and alignments.

### 2.3 Named-list display

- Use the view's item object for sheet-driven display.
- Use list{Name}{Kind}.js for one display piece. Read the core paths and item export table first.
- Select per-view behavior with the ListViews override loader.
- Keep the current List consumer thin. Change a Vue base only when the user asks for a structural change.

### 2.4 List context

The current public useListView uses injected page contexts.
Use the injected resource context and the named view source rules.

### 2.5 Verification & Safety
- Run target checks or verify paths to confirm no compilation issues before ending your turn.
- Make sure to document custom modifications in the project's walkthrough.md.
