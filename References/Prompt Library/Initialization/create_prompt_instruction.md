# Initialization: Prompt & Instruction Creation

> **Scope boundary**: Use this guide only to create or edit a reusable initialization prompt in this folder. Do not use it for one-off prompts for another agent, chat handoffs, or chat-switch prompts. Read source files directly by path during discovery. Do not load other initialization prompts for context.
>
> Initialization prompts are for AI agents. Each prompt must help an agent understand its topic well enough to investigate it, fix bugs, add new features, and update existing behavior. Link the needed AQL knowledge docs and give the agent clear work steps and checks.

Use this guide only when the user asks to create or edit an initialization prompt in this folder.

## Knowledge and work-step split

- `Documents/` holds current AQL knowledge for people and agents: behavior, data shapes, rules, use, effects, limits, and known gaps.
- Initialization prompts hold agent-only work steps: what to read, how to inspect or change code, guardrails, and how to check the result.
- Prompts must link to the matching knowledge docs. Do not copy a full schema or feature guide into a prompt. Add only short facts that an agent needs to follow a step, and point to their source.
- When code or research finds a knowledge gap, update the canonical `Documents/` guide. Update a prompt only if its work steps or required reads also change.

---

## 1. Phase 1: Exhaustive Codebase & Document Discovery (Do Not Skip)

Before writing any instruction or checklist, you must perform a comprehensive inspection of the entire repository to gather every piece of context. Do not rely on memory or partial scans.

### Step 1: Document Scan
1. Read `Documents/README.md` and `Documents/CORE_DOC_ROUTING.md` to identify related documentation.
2. Read the full text of all documents that mention the target task or feature area.
3. If the task touches:
   - **Masters or Operations UI**: Read `Documents/UI_PAGE_AND_SECTION_SYSTEM.md`.
   - **Workflows**: Read the relevant workflow section in `Documents/WORKFLOW_OUTLET_OPERATIONS.md / WORKFLOW_PROCUREMENT.md`.
   - **Sheet Schemas**: Read the relevant structure file (e.g., `Documents/SHEET_OPERATION_STRUCTURE.md`) and `Documents/SCHEMA_RESOURCE_COLUMNS.md`.
   - **Tax/Currency**: Read `Documents/FEATURE_TAX_SYSTEM.md` and check `FRONTENT/src/composables/useCurrency.js`.

### Step 2: Codebase Scan
Search the codebase using ripgrep (`grep_search`) for symbols, resource names, or keywords related to the task:
1. **GAS Backend**:
   - Locate related files in `GAS/` (e.g., `GAS/outletMovements.gs`, `GAS/stockMovements.gs`, `GAS/procurement.gs`).
   - Identify any post-write hooks (`PostAction` mappings) and `AdditionalActions` configured for the resource.
   - Scan `GAS/syncAppResources.gs` config settings for the resource's headers and default values.
2. **Frontend Pages & Composables**:
   - Locate the custom pages in `FRONTENT/src/pages/` (e.g., `Operations/Rfqs/`, `Masters/PriceLists/`).
   - Locate the composables in `FRONTENT/src/composables/` (e.g., `operations/`, `masters/`).
   - Locate any related dashboard items in `FRONTENT/src/_resource/<Scope>/<Resource>/Data/`.
3. **Frontend Registries**:
   - Check `FRONTENT/src/components/REGISTRY.md` and `FRONTENT/src/composables/REGISTRY.md` for reusable files that should be reused or updated.

---

## 2. Phase 2: Structuring the Generated Prompt / Instruction

The generated prompt must be written as a markdown file. It must be structured into the following mandatory sections to ensure the receiving agent is fully equipped:

### A. Title & Scope
Clear description of what task/workflow this prompt governs.

### B. Mandatory Pre-Reads (With Line-Level Links)
List every file the agent must read before writing code.
- Format: `[filename](file:///absolute/path/to/file#LStart-LEnd)`
- Example: Read the `compositeSave` handler in [resourceApi.gs](file:///f:/AQL/GAS/resourceApi.gs#L450-L520).

### C. Current Scope & Knowledge Links
Link the canonical `Documents/` pages that explain the feature, schema, and data flow.
Do not copy their full system description into the prompt. Add only short, task-specific facts
that an agent needs to carry out a work step, and keep the source link beside each fact.

### D. Step-by-Step Implementation Checklist
A sequential, itemized list of steps the agent must follow. Group them logically:
1. **Backend adjustments** (clasp sync, sheet header refactoring, hooks).
2. **State & Orchestration** (composables, stores, batch payload builders).
3. **UI & Components** (Quasar pages, mobile-friendly cards, permission gates).

### E. Explicit Guardrails (DOs and DO NOTs)
List strict repository rules that apply to this specific task:
- **DO NOT** use `QTable` for mobile layouts.
- **DO NOT** write business logic inside page files (must live in composables).
- **DO NOT** trigger redundant `get` requests after saves if write deltas are returned.
- **DO** use `useResourceNav` for routing.
- **DO** wrap multi-resource edits in a single `batch` payload using `$ref` objects for dependencies.

### F. Targeted Verification Plan
Specify exactly how the agent must verify the changes:
- Commands to run (e.g., `npm run gas:push`, `npm --prefix FRONTENT run build`).
- Steps to test the UI flow manually.
- Database checks (e.g., verify that the stock movement updates `WarehouseStorages` through hooks).

---

## 3. Phase 3: Review and Refine

Before saving the generated prompt:
1. Cross-reference the draft against `Documents/CORE_ARCHITECTURE_RULES.md` to ensure zero layer violations are introduced.
2. Confirm all file paths are correct, absolute, and clickable using the `file:///` scheme.
