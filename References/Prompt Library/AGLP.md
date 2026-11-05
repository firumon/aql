# Assisted Goal Loop Protocol (AGLP)

**Revision: 2026-10-29 — selective section reading; current goal and task checklist; implementation-first Builder delegation; platform-owned capability discovery and self-setup; event-driven wake, fixed polling, concise handoff.**

**One current goal, led by the Architect, controlled by the Human Conductor. Agents configure their own wake adapters; A plans and decides; B implements; T tests; A verifies. Prefer checked event delivery over idle AI polling.**

## 0. Read this first — selective protocol index

**Do not load this whole file by default.** Read this section first, then read **only the sections relevant to your role and current action**. The protocol is a reference manual, not a required 400-line prompt. For a routine task, the directive and current goal/control files supply the actual work. Read more AGLP sections only if a rule is relevant, unclear, or conflicts with another instruction.

**Always applicable, even when you skip sections:** Follow project `AGENTS.md` and C's agreed limits; never infer permission to start, commit, push, deploy, sync, change live data or send externally. Check the exact assignment, goal mode and authorization before work; respect exclusive ownership and locks. A Builder report is not Architect acceptance. A notification or wake is not permission. When in doubt, stop the affected action, read the relevant rule and report the gap rather than guessing.

### 0.1 Task and role reading map

| You are doing... | Read only these AGLP sections (in addition to this index) |
|---|---|
| Just identifying what AGLP is | [§1 Purpose](#1-purpose-and-scope) and [§2 Roles](#2-roles-and-authority) if needed |
| Architect discussing, writing, or revising the goal | [§3 Goal](#3-define-and-maintain-the-goal); [§10 Changes](#10-changes-pause-resume-and-completion) when work is active |
| Architect starting agent setup | [§4.1–4.4 Setup](#4-agent-discovery-self-setup-and-wake-selection); [§4.5 Browser choice](#45-browser-test-choice) if T is needed |
| Builder or Tester receiving the **one-time setup prompt** | [§2 Roles](#2-roles-and-authority), [§4.2–4.3 Self-setup](#42-one-short-conductor-relayed-capability-handshake); [§6.1 Antigravity](#61-antigravity-fresh-buildertest-task-chat) only for Antigravity, [§6.2 Direct](#62-direct-messages-and-event-driven-bridge) for messages/bridge, [§7 Polling](#7-lightweight-fixed-polling-and-shared-state) only if polling is selected; T also reads [§4.5](#45-browser-test-choice) |
| Architect investigating and preparing a Builder directive | [§5.1–5.5 Execution-first](#5-implementation-first-delegation-directives-and-reports); [§9 Tiers](#9-worker-capability-and-directive-detail) when setting detail |
| Builder executing an assigned directive | Its **complete directive**, goal and project rules first; consult [§5.2](#52-bundle-complete-coherent-implementation-work), [§5.5](#55-directive-publication-and-execution-report), [§6 Dispatch](#6-dispatch-direct-return-and-acknowledgment) and [§7](#7-lightweight-fixed-polling-and-shared-state) **only as applicable**. Fresh task chats do not reread the full protocol |
| Browser Tester executing a test directive | Its directive first; [§4.5](#45-browser-test-choice), [§5.5](#55-directive-publication-and-execution-report), applicable [§6](#6-dispatch-direct-return-and-acknowledgment) or [§7](#7-lightweight-fixed-polling-and-shared-state) |
| Architect receiving a completed/failed report | [§8 Review](#8-architect-review-and-progress) and [§9 Tiers](#9-worker-capability-and-directive-detail); [§5.4 Guard](#54-nonproductive-delegation-guard) if there is no useful progress |
| Configuring or troubleshooting direct delivery | [§4.1–4.3](#4-agent-discovery-self-setup-and-wake-selection) and [§6.2–6.3](#62-direct-messages-and-event-driven-bridge) |
| Configuring or troubleshooting polling | [§7 Polling](#7-lightweight-fixed-polling-and-shared-state) only; during a **quiet poll**, read **only `current-state.md`**, not this index or AGLP |
| Pausing, resuming or finishing a goal | [§10](#10-changes-pause-resume-and-completion) and applicable [§6–7](#6-dispatch-direct-return-and-acknowledgment) |
| Recovering a failed dispatch, lock, return or review | [§11.1 Recovery](#111-recovery-without-conversation-history), and the affected [§6](#6-dispatch-direct-return-and-acknowledgment) or [§7](#7-lightweight-fixed-polling-and-shared-state) |
| Architect changing to a new chat | [§11.2–11.5 Handoff](#112-context-awareness-and-deciding-when-to-hand-off), plus [§7](#7-lightweight-fixed-polling-and-shared-state) **if A polls** |
| Rewriting or auditing **this protocol itself** | Read the **entire** document and check cross-section consistency |

### 0.2 How to read a portion without loading the rest

- Locate the needed heading with your file tool's **heading search** (for example, `rg -n '^#{2,3} ' AGLP.md` or equivalent). Then request only the matching line range, **ending at the next heading of the same or higher level**. On a Markdown viewer, follow the section links above. Do not run an unrestricted `cat`, `Get-Content`, or full-file read just to locate one section.
- For a subsection (such as §4.3), read that subsection's paragraphs and any explicitly referenced prerequisites. For a whole numbered section (such as §7), read through the next `##` heading. Keep required scope-specific checks intact; **selective reading changes token use, not safety or authority**.
- On an active wake, load only the necessary sections and named files. On a quiet poll, the scheduled prompt and `current-state.md` are sufficient; **do not read AGLP at all**. If a tool automatically injects the entire document, this index cannot prevent that cost—use a range-capable file read or a separate lightweight entry prompt instead.

---

## 1. Purpose and scope

AGLP coordinates a Human Conductor (C), Architect (A), Builder (B), and optional Browser Test Agent (T) to achieve an agreed outcome. C and A define the goal; C authorizes setup and gives the start signal; A investigates and makes technical decisions, assigns implementation-ready work, and independently reviews; B implements and self-checks; T verifies live behavior where required. An ordinary Builder handoff should deliver concrete code or another expressly assigned artifact, **not a cycle of delegated research and reports**. A wake or notification is not itself permission to do work.

The project's `AGENTS.md` applies first, including its permissions, file rules, and remote-operation restrictions. A goal may impose tighter limits. AGLP never independently authorizes a commit, push, deployment, sync, production or live-data change, external message, or other action requiring C's approval. A and each role's setup chat follow the selective-reading map in section 0, rather than loading this entire protocol by default. Fresh task chats read the files required by their directive, as in section 5.

AGLP is separate from [MACP](MACP.md) and [MAP](MAP.md). Reading or revising AGLP does **not** start, resume, migrate, or reconfigure a running goal. An existing goal adopts a new protocol or wake arrangement only through C's agreement and a checked transition.

## 2. Roles and authority

| Role | Responsibility |
|---|---|
| **C — Human Conductor** | Defines and changes the intended outcome with A, approves setup and starting, chooses permitted connections and limits, monitors the need for Architect handoff, and can pause, stop, or decline a proposal. |
| **A — Architect** | Owns the complete current goal, ordered checklist, codebase and dependency investigation, bug/root-cause analysis, technical decisions, implementation approach, cohesive directives, independent review, operational control, and safe handoffs. Resolves **what, where, and how** before delegating, within the available tools and authorization. Does not write production code. May write agreed coordination files and run allowed checks. |
| **B — Builder** | Primarily implements the specified file changes, performs routine within-scope decisions, runs checks and self-corrections, and publishes one concise final report and proof. Does not routinely perform Architect-owned discovery, broad audits, redesign or major decision-making. Reports true blockers and may give a bounded second opinion when A explicitly requests it. |
| **T — Browser Test Agent** | When selected, performs the assigned real-browser cases and reports observed behavior, evidence, and access gaps. Source mocks are not browser proof. |

Use one B assignment at a time. A normal assignment may cover **all related files required for one coherent deliverable**; do not split by file count or worker tier. Setup capability discovery is a **one-time coordination step**, not a series of Builder goal tasks. Use a separate T only if C chooses external browser testing; otherwise A may test with its own accessible browser. B and T may perform independent non-conflicting work concurrently only when the wake method and ownership controls safely support it. Keep A in one chat until a checked, C-approved session handoff.

## 3. Define and maintain the goal

### 3.1 Discuss first

C and A may discuss before or after invoking AGLP, including while work is under way. Reuse established choices. Ask only about material unknowns; do not begin with a lengthy form or treat an idea as an approved change. A speaks to C in simple English, usually giving a concise progress update after a dispatch or review. Quiet polls make no progress announcement.

### 3.2 `goal.md` is the destination

The goal file is the **single authoritative, complete A-to-Z statement of the currently agreed final outcome**. Include applicable purpose, features, workflows, business rules, data model and relationships, permissions, integrations, architecture and constraints, UI/UX, edge cases, agreed limits, genuine unresolved decisions, acceptance conditions, and ordered goal tasks. A large specification is acceptable when the product is complex; historical narration is not.

When C and A finalize a decision, A evaluates its effects throughout the **entire** goal, including dependencies, rules, tests and tasks. A rewrites and atomically republishes the whole `goal.md` as one coherent current specification. Replace obsolete decisions wherever they appear, preserve unaffected requirements, and remove contradictions. If a material choice is not resolved, label it as open and hold dependent work; do not invent an answer.

**Never turn `goal.md` into an execution log.** Do not append conversations, old designs, what one agent told another, dispatch/launch attempts, schedule changes, per-directive progress, reports, reviews, context handoffs, or error diaries. Do not create a substitute chronological execution-log file. Retain only the operational facts necessary for safety in `control.md` and task-specific evidence files.

### 3.3 Ordered outcome checklist

Keep one concise ordered checklist of **results required to reach the current goal**. Goal-task IDs remain stable for surviving work; they are independent of directive IDs. Example only:

```markdown
## Tasks to reach the goal
- [x] G01 — Establish the storage contract; verified against the agreed schema.
- [x] G02 — Read RFQ items through the linked PR; affected readers verified.
- [ ] G03 — Complete quotation saving; passes validation and reload checks.
- [ ] G04 — Verify the complete live-browser workflow; required cases pass.
```

The checklist is not an assignment history. Each item describes an outcome and how completion is judged; **a goal task is not the same as a Builder directive**. Prefer one cohesive execution directive when the task is ready; more directives are justified only by real dependencies, meaningful risk boundaries, discovered defects or other material reasons. A may reorder, split, merge, add, or remove goal tasks when the goal changes. Do not preserve obsolete tasks just to show what used to be planned. Mark `[x]` only after A independently accepts proof for the **current** completion criteria. Reopen a previously completed task if a later agreed requirement invalidates it. Show a short `blocked` or `in progress` annotation only when useful; no attempt history.

A owns `goal.md`. B and T do not edit it. A atomically rewrites the specification after agreed changes and atomically updates its checklist after accepted evidence. Do not rewrite it for a quiet poll, an agent message, a launch, or a temporary error.

## 4. Agent discovery, self-setup and wake selection

### 4.1 Two directions; choose the method only after discovery

AGLP has **two distinct communication directions**: **A → worker** (dispatch a directive) and **worker → A** (return a completed report). Each role also has an **incoming wake method**, which is how a message or scheduled run reaches that role. A CLI that launches B does not establish that B can return to A. Likewise, two agents using Codex, Antigravity or the same host does not prove a usable direct-message link.

For each role, prefer supported and authorized methods in this order:

1. **Direct agent message or checked existing-session CLI return** to the exact intended chat, where both sender and recipient are verified. A Codex role uses a supported Codex-to-Codex messaging action or fixed polling for its incoming wake; do not assume Codex accepts an incoming CLI wake.
2. **Checked event-driven adapter/bridge** when native cross-app delivery is unavailable. A small local PowerShell/Node process or supported event hook may notify an existing target chat without invoking an AI model while idle. It must be approved by C and actually tested for the specified direction; a file watcher is allowed only as part of that explicit checked adapter.
3. **Fixed-interval AI polling** when neither direct delivery nor an event bridge is currently supported and authorized. Use minimal prompts, one slim state file and the verified fixed interval from section 7; never adaptive polling.

**During setup, the methods may be provisional.** A first identifies its **actual platform and incoming/outgoing capabilities**, exact current chat/session target if discoverable, host and limits, distinguishing **verified**, **reported**, and **unknown** facts. Record these provisional facts in `control.md` without scheduling a poll or declaring an untested return ready. A sends the short handshake of section 4.2; the worker checks its own platform and returns the exact supported dispatch and return options. A then verifies each needed sender → recipient link, selects **one incoming wake per role**, tells C the decision and why, obtains any required C authorization, and records the final choices. If direct return to A becomes viable, do not retain an unnecessary provisional A polling schedule.

For the selected arrangement, check the exact executable/tool and invocation, project/workspace selection, chat/session ID and host, permission, authorized sender, report path and file access, busy/queued behavior, and how receipt or review will be confirmed. **One role has exactly one active incoming wake path**; outgoing dispatch to another role does not count as its own incoming path. Do not simultaneously use direct notification and AI polling as competing normal ways to wake A. Switch methods only through C-approved or explicitly pre-authorized, checked handoff: settle pending notifications and owners, disable the old incoming route, then verify the replacement. A non-AI checker may detect a missing acknowledgment and signal only through the chosen route.

### 4.2 One short Conductor-relayed capability handshake

After C approves setup, A prepares **one concise initialization prompt** per needed B or external T, displayed in a four-backtick code block for C to copy. C carries it to the chosen agent and brings back the answer. **C does not have to identify the agent's software, research its command-line options, configure its environment, or relay one missing environment variable at a time.** A gives information it already has, including its own checked communication capabilities; it must not pretend a method is verified because it is theoretically supported.

The prompt identifies: role A and its platform, known/unknown outgoing methods, A's currently available return methods (provisional when necessary), the receiving role, exact project root, goal folder, `AGENTS.md` and absolute AGLP path, permitted setup writes, and a request for the recipient to self-identify and self-configure. It asks for **one complete reply** with (1) the worker's platform and capabilities, (2) the selected/available A → worker wake and its exact command/target, (3) a checked worker → A return method or gap, (4) prepared setup scripts and preflight evidence, and (5) all remaining blockers together. Ask only for needed unknowns; do not request a generic tool interview, a sample code task or a demonstration chat. **Setup is not a start signal.**

**Initialization prompt template** (A replaces placeholders with checked facts; remove unsupported claims):

````text
AGLP SETUP ONLY — no goal implementation.
I am Architect (A), using <A agent app> in <A host/chat if known>.
My checked outgoing methods: <actual methods or unknown>.
My possible incoming returns: <actual methods and checked status>.
You are <Builder B OR Browser Test Agent T> for this project.
Project: <absolute project root>
Goal folder: <absolute goal folder>
Protocol: <absolute AGLP.md>
Project rules: <absolute AGENTS.md>

Read AGENTS.md, AGLP section 0 and the setup sections relevant to your platform; do not load all of AGLP.
Identify your app and check which incoming wakes you support
(CLI, direct message, event bridge, fixed polling).
Set up the best supported A-to-you path for your app;
check how you can return results to this exact Architect chat.
Use your platform-specific AGLP setup, including an adapter
or wake script where required. Collect all setup gaps together.

Reply once with your exact invocation command/tool and args,
selected return path, checked evidence, remaining unknowns,
and the settings/actions I must perform. No secrets.
Do not start a demo conversation or goal task.
````

The receiving agent **owns discovering and preparing its platform-specific setup** within C's approved file, permission and tool limits. It reads its own installed tool help, checks supported access and prepares the reusable adapter or goal-specific script as needed. If it cannot perform a check, reports `unknown` or the exact failure rather than guessing. It may not install software, change global environment settings, deploy, push, commit, or launch a real task unless separately authorized. B/T can write approved setup scripts or scratch files in the goal folder and report them; they do not edit `goal.md` or `control.md`.

**Expected compact setup reply** (all reported facts still require A's verification):

```text
Role / app / host: ...
Incoming wake: CLI | message | bridge | polling | unsupported
A -> worker: exact command/tool, argument form, target and project
Worker -> A: exact checked return path, or unresolved reason
Setup files / preflight: paths, status, relevant non-secret evidence
Needs from A/C: only outstanding permission/access or action
Ready: yes | conditional (specific check) | blocked (reason)
```

A verifies the reported configuration from **A's own actual invocation environment**, not merely the worker's shell. Check both directions separately; examine the script and non-secret probe results, real target IDs, and permission/access requirements. Confirm that the stated project and goal paths match the current goal. A may ask for **one targeted follow-up** when evidence exposes a real gap; do not restart a broad questionnaire or troubleshoot missing settings one by one. If the reply already supplies all needed facts, complete setup without additional relay. Record the currently selected methods, real commands and controls in `control.md` and tell C what is ready, what still requires first-task verification, and what genuinely blocks setup.

### 4.3 Platform-owned adapters and one-pass preflight

**Antigravity B or T (special CLI case).** The Antigravity setup agent follows section 6.1 and prepares its **own goal-specific wake script**, using any approved reusable Antigravity bootstrap. The script accepts a directive **filename**, resolves the exact goal-folder directive and uses the supported installed `agentapi new-conversation` method to launch a **fresh task chat**. The setup agent, not A, resolves the platform-specific invocation details and supplies A with the exact executable/runtime, command and argument form. Prepare distinct B and T scripts if both use Antigravity.

The Antigravity bootstrap/preflight must check the entire connection chain **in one diagnostic pass** before saying `ready`:

- Find the actually available `agentapi` executable/runtime in the sender's environment, including PATH handling **inside the launcher** when appropriate; do not require a permanent global PATH modification.
- Identify the documented/supported runtime connection method. If the installed implementation requires `ANTIGRAVITY_LS_ADDRESS`, obtain it through a supported runtime environment or checked local connection loader. It may change after app restarts: **refresh it when dispatch requires it**, not as a permanently hardcoded secret.
- Resolve the **exact intended Antigravity project ID** and confirm its relationship to the user's project/workspace. If the runtime uses `ANTIGRAVITY_PROJECT_ID`, supply the verified ID to the launch process. Do not silently fall back to another selected project. A path or working directory alone does not prove project binding.
- Check the supported CLI syntax, project and file-path access, permissions, ability to publish reports, and local lock/atomic-write support. Provide one consolidated report listing **all** failures, unknowns and remedial actions rather than repeated single-variable conversations.
- Offer a **non-launching `-Probe`/equivalent** that verifies the settings it actually can check. The script must distinguish `configuration checked` from `first real task conversation/workspace not yet verified`. Do not start a demo or trial conversation. Never print connection tokens or sensitive environment values.

The bootstrap may be a reusable project-independent utility with a **goal-specific wrapper**, or a self-contained goal script. Reuse a previously **checked** adapter rather than creating duplicate launchers for every goal. The setup agent reports both its bootstrap/preflight and normal wake commands, any project ID needed, actual checked results and remaining first-task checks. **A must check the script from its own runtime before dispatch**; a worker-local success is not proof that A can launch it. The first authorized task checks the actual returned conversation metadata/workspace, project and directive access before edits; stop and report a mismatch. A successful CLI exit or returned conversation ID alone does not prove this binding or the task's completion.

**Codex B or T.** Inspect the installed supported in-app chat-message actions, access to the exact chat ID and host, sender permissions and C's explicit authorization for the particular link. If checked, prefer direct Codex → Codex messaging in both directions. Do not use unverified CLI incoming wakes, invent chat IDs, or assume a readable chat name is a send target. If direct messaging is unavailable, check an approved event bridge; otherwise use a fixed polling role and its checked schedule. A message accepted is not proof that the recipient acted.

**Other platforms or mixed platforms.** The receiving agent identifies its actual supported incoming path, produces the appropriate adapter invocation and return instructions, and checks what it can. A independently verifies the needed cross-app send route. For example, Codex A → Antigravity B may use a checked Antigravity CLI launcher, while B → Codex A uses an independently verified direct bridge or fixed polling. **Do not force A to poll merely because B launches through CLI.** If no supported link can notify A's exact existing session, record that limit and select polling with C's agreement. Never claim a bridge is working just because it can see report files.

**External T schedule ownership.** If T polls, it creates, confirms and manages **its own** schedule in its own chat using its supported controls. A does not create, stop, pause, resume or retarget it. T checks the actual target, accepted fixed interval, run status, busy suppression or safe pause/resume, and reports exact settings through C. T does no test task in setup mode. If T uses direct messaging or CLI instead, do not create a T polling schedule. The same self-discovery prompt and one consolidated reply apply to T as to B.

### 4.4 Goal folder and operational records

Use `<project>/AGLP/<goal-name>/` unless C agrees otherwise. Required or conditional files:

| File | Purpose |
|---|---|
| **`goal.md`** | Full current final specification and ordered outcome-task checklist. No logs. |
| **`control.md`** | Compact **current** operational snapshot: mode, start authorization, exact paths, roles, checked worker platforms and invocation settings, selected wake methods and verified targets, active assignments, task ownership, pending returns/reviews, current schedule settings, locks and recovery controls. Replace stale facts; do not append history. |
| **Unique directives, reports and reviews** | Immutable instructions and independent task-specific proof. |
| **`current-state.md`** | At most ten lines, **only while a role uses polling**; see section 7. |
| **Task-specific claim/dispatch/return records and locks** | Only minimal verified records needed for concurrency and recovery, not a general journal. |
| **Approved agent adapters / wake scripts** | Goal-specific invocation wrappers and optional reusable platform setup helpers, with non-secret config only. |

Save the exact absolute paths, method/adapter ownership, approved settings, commands, scheduler IDs when applicable, target IDs, access/authorization evidence, first-task checks, stop/resume controls and known gaps in `control.md`. Record what was **actually verified** and what remains unknown; no secrets. A owns `goal.md` and `control.md`; B/T do not edit them. Adapters and scripts may be written only under C's permitted scope and project file rules.

Setup is ready when needed paths, methods, executable/adapters, access, checked return targets, rights and controls are verified. For Antigravity B, **actual new-chat workspace binding** may be deferred to the first real task, clearly marked conditional, provided that all prerequisites and a safe stop/report path are checked. A provisional method is not readiness. No setup starts work: C's start signal is required, and its authorization belongs in `control.md`, not the goal specification.

### 4.5 Browser test choice

If live browser testing is required, A asks C whether A tests with its own available browser or an external T; reuse C's existing answer. Source, fixtures, mocks and compiled components never count as live browser proof. If A tests, save actual observations in its review. If C chooses external T, apply the same platform-owned handshake and setup rules; its exact target, dummy/production data, allowed writes, sign-in/access, test scope and report path go in each directive. Never infer permission for real data changes.

A Codex T can use checked direct messages or fixed polling. An Antigravity T uses its own checked CLI task wake script and a separate T assignment. T owns any schedule in its chat and confirms its status and controls to A through C. A must not control a T-owned schedule except a specifically authorized, checked operation permitted by the protocol. T's setup may proceed independently of B; do not wait on B's reply when T setup can safely advance.

## 5. Implementation-first delegation, directives and reports

### 5.1 Architect owns investigation and implementation planning

**Before dispatching normal Builder work, A must make it implementation-ready.** A investigates the current code, relevant canonical documentation, existing patterns, exact target files/functions, callers and dependencies, actual bugs or missing behavior, architecture rules, data contracts, migration effects, likely edge cases, and appropriate verification. A makes the required technical decisions and determines **what to change, where, and how**, within its available access, without writing production code. Use existing project tools and checks when useful; record genuine unknowns as unknown rather than inventing proof.

A should aim to resolve related questions in **one preparation pass**, then delegate a real deliverable. Do not ask B to perform a broad audit, inventory, options study or repeated recommendation cycle merely because A has not finished its own investigation. A may ask C only for a material business choice, authorization, or access A and B cannot establish. Setup/permissions checks and evidence-based safety reviews remain valid and are not treated as waste.

Every normal B directive must have a **concrete implementation outcome**: specified files changed, integrated behavior, correction applied, tests supplied, or another explicitly approved deliverable. If the work is ready to implement, the next B directive must implement it—not merely review it. The directive must identify the relevant current goal-task ID and the verifiable result sought. B reads what is needed to execute safely but is not responsible for independently redesigning the solution.

### 5.2 Bundle complete, coherent implementation work

**One cohesive goal outcome should normally be delivered in one B directive and one A review**, even if it modifies several files. Group related schema, backend, frontend, tests and documentation edits when they form one safe, bounded change with clear acceptance checks. A small two-file change must not become a chain of separate discovery, confirmation and approval assignments without a real blocker.

Split only when there is a concrete reason: a dependent step requires unavailable data or C authorization; a high-risk migration needs an independently verified checkpoint; separate work has conflicting ownership; a required test environment is not ready; or scope is too broad to implement and verify safely in one assignment. **A Low capability tier means more precise instructions, not automatically a smaller change or more handoffs.** Avoid artificial task fragmentation to simplify the report count.

After claiming, B implements the **entire authorized directive**, runs relevant checks, and corrects routine defects discovered within scope before returning. B reports one closed final result; do not seek A's approval for each file, routine fix or internal step. B must still stop or ask when instructions conflict with `AGENTS.md`, permissions, the current goal, safety constraints, or a material unapproved decision. B never expands scope or performs an unauthorized external action just to avoid a handoff.

### 5.3 Exceptional advice or research from B

A may explicitly use B for a **narrow second opinion, specialized investigation or bounded technical suggestion** when A lacks an accessible tool, has a genuine unresolved technical question, or has verified that B's capability and available context make that delegation useful. Such work must name the exact unanswered question, A's prior findings, expected evidence, allowed reads/writes, and whether implementation is authorized. A retains responsibility for accepting any recommendation and all major architecture/business decisions; C retains required approvals. High capability does not transfer general authority to redesign the goal.

A may permit a proven B broader **routine implementation discretion** within a decided design—for example, choosing between equivalent local refactors—but the directive defines the decision boundary and required reporting. Do not confuse this with giving B ownership of requirements, architecture or risk acceptance. An exceptional read-only research directive must be identified as such and justified by a specific blocker or benefit, not issued as the normal first step of coding.

### 5.4 Nonproductive delegation guard

After each B report, A asks: **What concrete accepted implementation or blocked dependency changed?** A verified implementation, a genuinely needed safety finding, or resolution of a previously blocking uncertainty counts as progress; repeated generic reviews and unverified suggestions do not. A short factual progress note to C should identify the outcome, not the number of agent exchanges.

If **two consecutive B directives** produce no accepted implementation or necessary blocker resolution, A must reassess **before any further B dispatch**. A performs the missing investigation itself where permitted, identifies the specific obstacle, and then either (a) issues one implementation-ready directive, (b) seeks the one essential decision/access from C, or (c) declares the affected work blocked with evidence. Do not issue another substantially identical research task or retry a failed instruction under unchanged conditions. This guard detects waste; it does **not** override essential security checks, user approval gates, legitimate access limitations or a required staged migration.

Correction cycles are evidence-driven: A verifies all detectable defects, consolidates related corrections into **one targeted follow-up directive**, and does not require B to rediscover the same defects. If B reports a real unapproved design question, A settles it before the next implementation dispatch. Do not automatically penalize B for A's incomplete directive or outside tool failure.

### 5.5 Directive publication and execution report

Every Builder or Test directive begins with an immutable unique `Directive: <id>` first line. A publishes each as a closed file at a unique final path; never overwrite or rename it for status changes. A retry, correction or changed task gets a new Directive ID. Link to its current goal-task ID and any earlier Directive only when necessary. Reports and reviews also start with the matching Directive line and use unique closed, checked files.

A directive is self-contained: concrete deliverable, current goal-task outcome, implementation approach and exact affected files/functions as appropriate, purpose, relevant inputs and canonical references, allowed paths/actions, business/architecture limits, worker-tier-specific execution guidance, checks and proof, exact report draft/final paths, selected wake/return method, locks, claim steps, error handling, confirmation and failure recovery. Include absolute project, protocol, goal, control, directive and report paths, plus state path and owned slot **if polling is active**. Do not require a fresh task chat to remember prior discussion. The worker reads `AGENTS.md`, current `goal.md`, `control.md`, its directive and relevant task references; it uses the section 0 index for any applicable AGLP rule and does not reread the full protocol in a fresh task chat.

A saves the current assignment and dispatch intent in `control.md` under A's lock **before** publishing or sending. Write a unique draft, close and validate it, then atomically publish without overwriting. Check the Directive line, CRLF and complete content. After dispatch, A takes its lock again, re-reads current control, and saves the actual accepted/failed result; if it cannot, retain that fact in its unique dispatch record for recovery. Do not dispatch twice merely because the save failed. An accepted launch means a launch was accepted, not that B/T claimed or completed work.

B/T publish concise reports: Directive and owner, start/finish times, `completed` or `failed`, **implemented outcome**, changed files when applicable, checks/results, actual proof, unmet work, blockers and access gaps. Do not use the report as a design essay or narrate every code change. Report **every encountered error**, including resolved errors, with action/conditions, exact relevant output, time, effect, attempted remedies/results, checked cause or `unknown`, final status and proof path. Say `no errors` if none occurred. Errors after report publication go in the limited task-specific return/recovery record; never rewrite a closed report. A checks actual files/proof before acceptance.

For T, a directive gives exact real-browser cases, test data, expected outcomes and write limits appropriate to T's tier. T tests; it does not invent implementation tasks or make the Architect's root-cause decision. Browser proof remains distinct from source and mock proof.

## 6. Dispatch, direct return and acknowledgment

### 6.1 Antigravity fresh Builder/Test task chat

Following the self-setup handshake and one-pass preflight in sections 4.2–4.3, **Antigravity B or T prepares its own** goal-specific wake script in the goal folder. This is a setup deliverable, **not** a research directive during the implementation loop. The script takes a directive **filename**, checks that the file exists in the goal folder, refreshes runtime-dependent connection settings and resolves the **exact verified intended project ID** (without a fallback to another project), then starts a fresh task conversation through the locally supported `agentapi new-conversation` method. It checks and reports CLI errors without leaking credentials. Its short wake prompt names role, project root, `AGENTS.md`, exact directive path and A's selected return method. Never assume the launch working directory or prompt alone binds the correct project; verify binding on the first authorized real launch.

A independently runs the adapter's non-launching preflight from **A's own invocation environment**, records its exact path, checked launch syntax and unresolved first-task access checks in `control.md`. The preflight must identify missing executable, address, project ID and permissions together wherever observable. For each real directive, A passes **the directive filename as a separate argument**, dispatches with checked connection/project settings, and records the actual launch result. Each directive uses a fresh task chat; no new B/T chat remembers an earlier one. The worker first verifies actual chat project/workspace, goal, directive and source access before edits; if missing or wrong, stop edits and report through the assigned failure path. A probe or CLI exit does not prove the first chat is bound correctly. No demo launch is required. Do not launch another owner while the first may be live.

Each directive tells the fresh worker, in order: check active mode and exact assignment; take its run lock; claim under shared-state lock or per-task lock as applicable; **implement the complete authorized scope, self-check and correct routine within-scope defects**; publish one final report; mark result in shared state when polling exists; release owned locks; perform **only** A's selected return/acknowledgment flow. If a return fails, do not repeat the build.

### 6.2 Direct messages and event-driven bridge

When A's incoming method is direct, a worker sends one **short completion notification** only **after** publishing a closed report, updating any required state, and releasing locks. The message names its role, Directive, report and `control.md` paths. A then checks exact ownership, already-saved review and actual report before reviewing. Similarly, A dispatches workers with short messages naming the exact directive, not the entire task text.

For Codex-to-Codex messaging, require the supported app tool, access to the exact **chat ID and host**, and C's explicit authorization for the sender and target. A chat name alone is not a destination; resolve it through a checked listing or a checked ID from C. A message from one agent is not evidence that C authorized another link. Do not create an unrequested chat or assume that two Codex chats can reach one another merely because they share an app. Save the verified target, permission scope and controls in `control.md`. A Codex incoming wake is messaging or fixed polling, never an assumed CLI incoming method.

For an Antigravity A, a checked existing-session message such as `agentapi send-message <recipient_id> <content>` may be used if supported and authorized; use the **exact saved A conversation**, never a new Architect chat. Its goal-specific return script accepts the report filename and builds a short path-only message. Check actual availability, target and callback access. Starting B successfully does not prove B can wake A.

A cross-app event bridge may be a checked local Node/PowerShell service, explicit process callback, or filesystem notification reacting to a closed report. It runs without an AI model while idle. It must know the exact authorized target and verified send method; have checked project/path permissions; ignore unfinished files; use the matching Directive/claim and current mode; avoid duplicate/busy messages; preserve a pending notification on failure; and never create a second independent execution owner. **A bridge that cannot address the existing recipient chat is not ready.** AGLP does not prescribe a particular bridge implementation or grant permission to install a daemon.

### 6.3 Confirmation and fallback

An accepted notification **does not prove review**. Before a send, save a unique pending-return record for that Directive. Confirm completion only from the exact review saved by A and acknowledged in `control.md`. If unconfirmed, check the target's real availability, current assignment, queued/running wake and ownership before retrying **only the same notification** through its selected path. Use the checked delay/limit in the directive; do not spam a busy chat, repeat finished work, or infer success from an unlocked file. A lightweight non-AI watchdog can check a pending return without repeatedly calling a model.

If delivery/confirmation cannot be checked or a direct link fails, preserve report, pending return and evidence, and inform C of the actual gap. Activate a pre-authorized fixed-poll fallback **only after** a checked switch that disables the direct incoming path and reconciles claims, return targets and pending results. If not pre-authorized, obtain C's decision. Do not allow both live incoming paths to consume the same completion concurrently.

### 6.4 Claim protection without polling

When **no role polls**, there is no live shared `current-state.md` requirement. Each Directive gets a brief exclusive task lock and separate immutable claim record. Under the role run lock and `CreateNew` task lock, the worker re-reads `control.md`, checks `active` mode, exact assignment, no hold and no prior claim, publishes its claim, then releases the task lock and proceeds. If a check fails, release locks and do not start.

To withdraw or change an unclaimed task, A takes A's run lock then that task lock, reads the latest control and claim, and saves a hold/withdrawal **while locked**. A confirmed absent claim prevents the worker from starting afterward; an existing or racing claim is live work and must follow section 10. Never wait on a worker's run lock while holding the short task lock; never hold it throughout the task. Missing/conflicting records require recovery, not guesses. Release only owned locks and never clear one merely by age.

## 7. Lightweight fixed polling and shared state

### 7.1 Fixed interval, no adaptive rounds

**Remove all escalating, halving, temporary fast-poll and automatic per-round schedule changes.** A polling role has a single supported, C-approved **fixed** interval, checked at setup. It remains constant across quiet and actionable polls. Change it only for an explicit C-approved configuration change or a required pause, resume, retarget, stop or recovery; verify the tool's accepted settings. If the requested interval is unsupported, offer the actual supported choices rather than inventing a fallback. Record the accepted interval, schedule ID, owner, exact target and controls in `control.md`, not as an ever-changing counter in the state file.

A quiet poll reads **only** `current-state.md`, checks its own role's actionable condition and mode, and exits silently when there is nothing to do. It does not read `goal.md`, `control.md`, `AGENTS.md`, AGLP, directives, reports or other project files; it does not scan folders, change schedules, update unchanged state, or run reviews. A scheduled prompt is a short pointer and condition, **not** a copy of AGLP. Only an actionable wake loads the needed full instructions and exact work files. A broken/missing/malformed state is not interpreted as idle: stop dependent work and raise the actual gap.

**Sample Architect scheduled prompt** (replace the path with the checked real path):

```text
AGLP A heartbeat. Read only <absolute-current-state.md>.
If mode != active, exit silently.
If no B/T slot is completed or failed, exit silently.
Otherwise follow AGLP review rules for the exact finished Directive;
verify ownership and review once. No unrelated work.
```

**Sample Test scheduled prompt:**

```text
AGLP T heartbeat. Read only <absolute-current-state.md>.
If mode != active or T-task != new, exit silently.
Otherwise claim and execute only that Directive under AGLP;
report and return by the selected method.
```

These are **templates**, not proof that a product's scheduler permits such prompts or suppresses context costs. Short prompts reduce instructions supplied at each wake but may not remove the cost of reloading a long conversation, project instructions or tool context. If an AI scheduler still consumes excessive usage, use direct events or a non-AI checker rather than shortening the interval.

### 7.2 State format and ownership

Use one `current-state.md` only when at least one role **actively uses polling**. Keep it to **at most 10 lines** and minimal current facts, never a log, report, task instructions or history. Other roles update their own needed task slot if the mixed setup depends on it. Example:

```text
mode: active
A: polling
B: cli
B-task: new | id: task-1 | directive: build-1.md | report: report-1.md
T: polling
T-task: none | id: none | directive: none | report: none
```

Methods may be `cli`, `message`, `bridge`, or `polling`, matching the **actually selected incoming methods**; a method still being set up may be `pending`. Modes: `setup`, `ready`, `active`, `paused`, `blocked`, `done`. Task statuses: `none`, `new`, `working`, `completed`, `failed`. Each worker changes only its own task status; its ID and paths remain fixed while assigned. A controls mode, methods and assignments, and clears only an accepted exact finished slot. Do not duplicate the fixed interval in this slim file unless a checked implementation genuinely requires it; `control.md` and the scheduler are authoritative for schedule settings.

B/T polling acts only on its own `new` slot. A polling acts only on a required `completed` or `failed` slot. For `none`, `working` or a previously reviewed result, exit or finish the minimal pending reconciliation without repeating work. No goal work begins in non-active modes except explicitly approved recovery.

### 7.3 Publish, claim and finish with polling

A publishes a closed directive and saves the matching assignment in `control.md`, then under `state.lock` sets the exact role slot to `new`. The worker on its next scheduled wake takes its exclusive run lock then `state.lock`, rereads state, confirms `active`, exact ID/paths and `new`, changes its own slot to `working`, releases `state.lock`, then checks directive/goal/control and performs only the claimed work. A run lock prevents a second owner; an invalid claim stops task work.

Prevent recurring polling from launching duplicate runs while the worker is busy: use a checked scheduler busy-suppression capability, or let the worker's schedule owner pause and **verify** its own schedule after claim and before task work, then resume and verify only when the goal permits it. If neither works, report the gap; a run lock alone is not evidence that expensive overlapping wakes are suppressed. For T, only T owns these schedule controls.

The worker atomically publishes its report, then under `state.lock` confirms its exact assignment and still-held run-lock ownership and sets only its slot to `completed` or `failed` with the exact report path; release owned locks. If its schedule was paused, its owner resumes it only when permitted, verifies the result and records any pending failure in the task-specific record. A polling detects the final slot on its next **fixed** poll; there is no temporary faster interval, no extra direct wake, and no second incoming method. Before another assignment to a polling worker, check its schedule actually runs for the right target and has no unresolved resume.

### 7.4 Safe state and schedule operations

Each role uses an exclusive `CreateNew` run lock for its active work; A uses A's run lock for control, review, and owned schedule changes. For every shared-state write, take a short `CreateNew` `state.lock`, re-read the latest state, validate mode, assignment, writer/transition, and 10-line format, preserve other slots, write a complete CRLF temporary copy, then atomically replace. Release the short lock in `finally`; never hold it during task work, review or scheduler calls. A similarly writes complete `goal.md` and `control.md` under A's run lock through checked atomic replacement. If safe locking/replacement is unavailable, stop and report the gap.

Only the designated schedule owner may pause, resume, stop, retarget or change its schedule. Confirm accepted status and target before relying on a scheduler operation. Serialize concurrent controls of the same schedule with an exclusive target-schedule lock where actual access requires it; do not hold `state.lock` during scheduler calls. A second run seeing a held run lock exits; locks are never cleared by age. Never resume a schedule for a paused or completed goal. A quiet poll does not check or modify the scheduler.

## 8. Architect review and progress

On a completed/failed slot or checked direct return, A acquires its run lock, reads `control.md`, checks the exact Directive and whether the review is already confirmed, waits for a released worker run lock, and examines the **closed** report and actual modified files/evidence. Run permitted targeted checks. Distinguish source, fixtures, compiled components and real-browser observations. A worker's `completed` status is not acceptance.

A records a unique review with `VERIFIED`, `PARTIAL`, `FAILED`, or `BLOCKED`, specific proof and limits. Missing functionality is `NOT IMPLEMENTED`; missing access is `BLOCKED`. Check errors and their actual causes where evidence permits; never repeat the same failed instruction under unchanged conditions. Save a confirmed review pointer and current pending/cleared assignment in `control.md`. Update `goal.md` **only** for revised accepted requirements or checklist completion/reopening. Clear the matching final state slot under lock when applicable. A repeated notification must not produce a second review.

After review, A may accept the cohesive deliverable and proceed, issue **one consolidated defect-specific correction** if evidence requires it, ask C for a material decision, or finish. Do not delegate a fresh exploratory audit of work that A can directly inspect, or turn a verified two-file change into several review-only Builder directives. Apply the nonproductive delegation guard in section 5.4. Parallel work is allowed only for independent scopes with checked conflict, tool and return handling. If any active delivery system cannot queue concurrent returns safely, dispatch serially. Never start dependent browser tests before required implementation is available. Give C a concise outcome-based progress update, not an agent-launch history.

## 9. Worker capability and directive detail

C chooses B and T starting tiers independently: **High**, **Medium**, or **Low**. After each independently reviewed report, A decides whether the worker's tier stays, rises, falls, or requires more proof, based on actual implementation quality, ability to follow the directive and task difficulty. An access/tool gap, an unclear Architect directive, a mid-task requirement change or a required stop is **not** evidence of poor capability. Save the short assessment in the specific review and the **current** tier in `control.md`, not `goal.md`; tell C in one line.

| Tier | How A specifies the **same coherent deliverable** |
|---|---|
| **High** | Complete outcome, intent, decided boundaries, relevant references, constraints and required evidence; allow routine implementation flexibility within the agreed design. |
| **Medium** | Also specify affected files/functions, interfaces, inputs/outputs, important edge cases and exact checks. |
| **Low** | Also specify concrete ordered edits, exact paths, affected logic, acceptable examples and targeted checks; **do not automatically shrink the deliverable into file-by-file directives**. |

Capability affects **instruction precision and permitted routine discretion**, not the default number of handoffs. A is still responsible for investigation, bug diagnosis, business/architecture decisions, and review. B implements and self-corrects within scope. A may request B's bounded second opinion or specialized help only as in section 5.3, with evidence and a stated decision boundary. T's tier affects browser case detail and proof requirements; T cannot be judged incapable merely because browser or schedule access fails.

## 10. Changes, pause, resume and completion

C may revise the goal at any time. After a **finalized** A–C decision, A assesses its full impact, holds conflicting new claims, rebuilds the complete current goal specification, reconciles goal-task statuses, and **replans affected cohesive implementation deliverables before the next B directive**. For polling, set `blocked` mode under `state.lock` while conflicting work is unsettled; otherwise hold unclaimed tasks under their task locks. Save the **current** affected assignment/owner disposition in `control.md`, not as a story of the change.

An unclaimed directive can be withdrawn only after checking dispatch and claims. A claimed live worker may finish or stop only according to a saved, safe, authorized disposition; do not rewrite its published directive or assume it has stopped. Reconcile its report and release before issuing replacement work with a new Directive ID. Restore `active` only when goal, control, mode and ownership agree. Ordinary finalized changes inside the same active goal do not require a new start signal.

To pause, save `paused` in control and in shared state when used; prevent new claims and pause **only A-owned** schedules, verifying the result. C relays pause instructions to other schedule owners; T controls T's own schedule. Live workers check their directive's safe-boundary stop rules. A paused schedule does not prove work stopped. Resume only on C's request, after reconciling exact owner and wake target; resume only schedules owned by the acting role.

To finish, A verifies all current goal-task completion checks, publishes final proof, marks `done` in control/state, stops its owned wake path and asks other owners to stop theirs. Verify actual scheduler/bridge results; tell C if anything remains running. If required proof is incomplete, leave appropriate checklist tasks pending/blocked and report `PARTIAL` or `BLOCKED`, never full completion.

## 11. Recovery and Architect session handoff

### 11.1 Recovery without conversation history

A continuing Architect reads `AGENTS.md`, the AGLP section 0 index and applicable recovery/wake/review sections, the current `goal.md`, and `control.md`, plus **only** the exact active directive/report/review and `current-state.md` when polling applies. `goal.md` is sufficient to understand the present complete intended result and outstanding outcome tasks; `control.md` is sufficient to locate current owners, wake methods, targets, holds and recovery details. Do not reconstruct old chats or execution history unless a specific gap requires evidence.

If dispatch, claim, return or review is uncertain, inspect actual assignments, locks, closed reports, pending notification records, target availability and specific reviews. Never infer failure from silence, repeat completed work, or clear a lock by age. Confirm the previous owner is inactive before repair. If a report exists but the review/notification failed, finish only the return/review. If a review exists but the checklist/control confirmation was not completed, finish that exact step against **current** criteria. If schedules or bridge targets disagree, hold dependent work and check actual settings. Missing/corrupt/conflicting records trigger recovery and a report to C, not guessed success.

### 11.2 Context awareness and deciding when to hand off

Long-running Architect chats can grow costly as context accumulates. **C periodically checks with A about the session's context** and decides when a new Architect chat is needed. If C uses a tool or indicator called *CNI*, treat its readings as evidence only when its meaning and access are verified; AGLP does not assume an independently available CNI capability. If a supported tool shows actual context utilization reaching **60%** (unless C sets another threshold), A briefly informs C and recommends handoff once per session. Do not guess utilization from message count, elapsed time, or account quota. If no measurement exists, say `context usage unknown`; C may request handoff at any time.

A handoff occurs **only when C requests or agrees**. It is a transfer of **one Architect owner**, not a fresh goal, a new start signal, or a copy of the conversation. Do not hand off because a quiet poll ran, and do not copy the full goal specification into the handoff prompt.

### 11.3 Prepare the old session and its incoming wake

A saves the **current handoff snapshot** in `control.md` under its run lock: present mode, paths, selected A incoming method, exact old target, live assignments/owners, settled reviews, pending returns, applicable schedule/bridge information, and the intended new Architect chat title. Do not append handoff history to `goal.md`.

Stop new assignments. Reconcile or safely hold any unclaimed work; allow claimed work and its return/review to finish, or settle it through an explicitly verified safe handoff path. An already-issued CLI callback or direct Codex message may still target the old A; **do not silently invalidate it**. Confirm there are no ambiguous live returns before replacing the target. If a worker is still active or its return cannot be safely redirected, leave the handoff pending and report that fact to C.

If the old A has an active polling schedule, its **owner** pauses or stops it through supported controls and checks that it is no longer waking the old chat. If the old A uses a direct/bridge target, hold new incoming deliveries and preserve pending notifications while the target changes. Do not pause or retarget B's or T's own schedules merely because A is moving. The old A remains the recorded owner until the successor's target and takeover are verified; it must not dispatch new work during the handoff.

### 11.4 Short handoff prompt and new chat name

Use a predictable, recognizable title: **`A — <goal-name> — Architect <sequence>`**, with a new sequence for each chat, for example `A — rfq-suppliers — Architect 02`. A gives C the exact title and a short prompt in a four-backtick block; C creates and names the new chat. **Do not copy the goal, past chat summary, completed directives or schedule history into the prompt.** The saved files already hold those facts.

The prompt needs only: (1) A role and agreed chat title, (2) absolute project root, (3) `AGENTS.md`/AGLP, `goal.md` and `control.md` paths, (4) the state path **only if polling applies**, and (5) a command to verify and complete the one-owner wake takeover before continuing. Suggested complete template:

````text
You are Architect (A) continuing an existing AGLP goal.
Chat title: <agreed-A-chat-title>
Project: <absolute-project-root>
Protocol: <absolute-AGLP.md>
Goal: <absolute-goal.md>
Control: <absolute-control.md>
State: <absolute-current-state.md OR none>

Read project AGENTS.md, goal.md, control.md, and AGLP section 0 plus the relevant handoff/wake rules only.
The goal and ordered tasks are already fully defined in goal.md.
Reconcile the saved handoff, pending owners and return targets.
Verify the old A wake is disabled and establish exactly one
checked incoming wake for this new chat; if polling is selected,
use its fixed accepted interval. Save this takeover in control.md.
Do not dispatch or review twice, resume a paused goal without C,
or change any other role's schedule. Continue only when safe.
````

A may omit the `State` line when no polling role exists. Do not include unresolved placeholder values in an actual handoff; report any missing absolute path or destination instead of inventing it. Keep secrets and long instructions out of the prompt.

### 11.5 Activate the successor and retire the old wake

New A obtains/validates its **actual new chat ID, host, access, and selected incoming method**. It re-reads `control.md` under ownership protection and checks that old A's schedule/direct-delivery route is disabled or safely held and that no stale worker return still targets old A. It must not treat the human-readable chat title as a checked message destination.

If polling was selected, **prefer retargeting the existing verified, paused A schedule** to the new chat when the scheduler supports it; verify exact target, accepted fixed interval and active status **before** claiming takeover. If retargeting is unsupported, check that the old A schedule is fully stopped, then create **one** new schedule for new A and verify it; never let both run. If the new incoming method is direct or bridge, update and verify its exact target and authorization; leave recurring AI polling off. If the required scheduler or sender controls are unavailable, ask C or the designated owner to perform the checked step; do not claim success.

Under A's run lock, save the completed takeover, new exact recipient, ownership and wake settings in `control.md`. For goals using polling, reconcile the one slim `current-state.md` without creating another state or altering live worker assignments. Recheck outstanding report/claim/review before work resumes. Respect the previously saved mode: a paused goal stays paused until C separately requests resume. Only after verification may old A be treated as retired. If takeover fails, preserve pending state, inform C and **do not** start a second active Architect or silently restart old polling.

## Maintenance and adoption

Section 0 is the required lightweight reading map; routine agents select the relevant sections, while protocol audits read all sections. `goal.md` always expresses the latest agreed destination and one ordered outcome checklist—**never an execution log**. **Execution-first delegation is the default:** A investigates, makes decisions and prepares one coherent implementable scope; B implements and self-tests it; A independently verifies. Research-only Builder loops are exceptional, and worker tier changes directive detail rather than automatically increasing task count. **Agent-owned discovery and self-setup are the default:** A sends a short capability handshake through C; B/T configures its own supported incoming path, prepares its adapter, and returns one consolidated invocation/return report; A independently verifies both directions. Antigravity performs a one-pass executable/address/project preflight, refreshing runtime connection data when necessary. `control.md` stores only current operational facts; immutable directives, reports and reviews store task-specific evidence. Direct, checked event-driven notification is preferred. A non-AI watchdog may monitor failed acknowledgments. AI polling, when necessary, uses short scheduled prompts, minimal state and a **constant checked interval**, without adaptive or fast-poll adjustments. Only one incoming wake path per role is active at a time.

An edit to AGLP does not automatically migrate an active goal. C must approve a checked migration: reconcile owners, claims and pending returns; rebuild the current complete goal and task checklist from agreed decisions and verified proof; establish `control.md`; choose and verify wake methods and exact targets; safely pause/retarget/stop old schedules; update task instructions and recovery paths where necessary; and preserve prior immutable evidence. No duplicate owner or dependent work while transition is unsettled. Begin real goal execution only after authorized setup and C's start signal.
