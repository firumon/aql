# ListSwitcher UI Work

Use this prompt for the ListSwitcher section, pills, counts, overflow, and selection bindings.
Follow `AGENTS.md` and any active user-named protocol first. Use the
[ListViews development prompt](list_views_development.md) for shared work and verification rules.

## Read and trace

1. Read the [architecture rules](../../../Documents/CORE_ARCHITECTURE_RULES.md),
   [ListViews hub](../../../Documents/UI_LIST_SWITCHER.md), and
   [core and switcher guide](../../../Documents/UI_LIST_SWITCHER_COMPONENTS.md).
2. Read [ListSwitcher.vue](../../../FRONTENT/src/components/sections/ListSwitcher.vue),
   [ListSwitcherItem.vue](../../../FRONTENT/src/components/sections/ListSwitcherItem.vue),
   [useTabFit.js](../../../FRONTENT/src/composables/resources/listViews/useTabFit.js),
   [useListView.js](../../../FRONTENT/src/composables/resources/listViews/useListView.js),
   [List.vue](../../../FRONTENT/src/components/contents/List.vue), and the relevant rules in
   [custom.scss](../../../FRONTENT/src/css/custom.scss).
3. Read the relevant page/section doc part. If creating or materially restructuring a component,
   also follow [renderable contract](renderable_contract.md). Read the current Quasar docs via
   the Quasar MCP for components, props, events, or directives used in the change.
4. Run GitNexus impact for each existing symbol to edit and report the callers, flows, and risk.
   Verify current callers directly if the index is missing or stale. Follow the reuse and approval
   rules before adding a helper, function, or file.

## Make the change

- Use `useListView().tabs` and `setActiveView`; do not rebuild counts or selection in the template.
  A tab corresponds to one allowed pipeline result. View permissions are checked before the pipeline.
- Keep `activeName`, `activeList`, fallback, and remembered selection in the shared ListViews state.
  The List and switcher share the same scope. Do not create a second selection state.
- Keep the selected/default/first/empty behavior when views or permissions change.
  Keep the debug editor's original view config, including views hidden by permission.
- Keep desktop width measurement and the More menu in `useTabFit`; mobile uses the drag layout.
  Preserve measurable hidden pills, count balloons, shared spacing, and active More styling.
- Use the current shared CSS and design system. Keep business logic, store access, and API calls
  out of the Vue components. Preserve the action-slot stop and List's active error and empty states.
- Use the section resolver for section overrides. List feature and display overrides use the
  separate list override loader described in the core guide.

## Verify

- Test all-fit and overflow widths, mobile drag, resize, More selection, and active hidden tabs.
- Check count modes, search changes, view errors, permission grant/revocation, and no allowed views.
- Check selection sharing across List and switcher, disposal of one caller, and navigation between pages.
- Compile changed Vue files and run focused checks. Perform a mouse test for the affected layout.
  State clearly when the browser test has not been done.
- Update the matching knowledge doc and registry entries for changed public behavior.
  Save CRLF and verify bytes after every write. Follow the repo's targeted-check and remote-update rules.
