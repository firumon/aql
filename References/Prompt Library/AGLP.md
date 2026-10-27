# Assisted Goal Loop Protocol (AGLP)

**A shared goal, led by the Architect, with the Human Conductor in control.**

## 1. Purpose and scope

AGLP helps agents work toward a goal through saved directives, reports, and reviews. C and A discuss the goal. C agrees to setup and gives the start signal. A then guides the work and checks the results.

Read the project's AGENTS.md first. Its file, permission, and remote update rules still apply. A goal may set tighter limits. AGLP does not grant permission to push, deploy, sync, change live data, or take other actions that need C's explicit request. A and the needed B and T setup chats read this full protocol. A fresh Antigravity B or T task chat follows the reading rule in section 5.

AGLP is separate from [MACP](MACP.md) and [MAP](MAP.md). Reading or editing this file does not start a goal, resume paused work, or change an existing loop. Change an existing goal's wake methods only with C's agreement and a checked handoff.

## 2. Roles

| Role | Work |
|---|---|
| **C — Human Conductor** | Discusses the goal with A. Carries setup messages between A and B, and between A and T when needed. Gives the start signal. May pause, stop, or change the goal. C may change or refuse a proposed setup. |
| **A — Architect** | Keeps the same A chat. Plans work, prepares directives, checks reports and proof, saves reviews, and guides the goal. If C chooses A's own browser, A performs the needed live browser tests. A does not write production code. A may write agreed goal, protocol, state, directive, and review files and run allowed checks. |
| **B — Builder** | Carries out its assigned directive, checks its work, and saves proof and a report. |
| **T — Browser Test Agent** | When needed, tests the live app and reports what it saw and any access gap. Keep live browser proof separate from source, fixture, and compiled-component proof. |

Use B only when needed. Use an external T when the goal needs browser testing and C chooses an external test agent. Keep the same ready T setup for a goal unless C agrees to a change; fresh task chats under that setup are allowed. Each wake names the role. A wake grants no new work or permission; the saved directive sets the work and limits.

## 3. Talk first

C may invoke AGLP before or after discussing the work. Reuse known context and choices. A helps C shape the goal through discussion. Do not begin with a fixed form or ask for a full plan, role list, or limits checklist. Ask about a real missing point when it matters. Do not ask again for a choice C already made.

Save the shared understanding in `goal.md` in the goal folder: the goal, choices, open points, useful next steps, limits, and how to judge completion. The task list can grow or change. A can add, split, join, drop, or reorder work as the goal and proof require.

Begin needed setup once the direction is clear enough and C agrees to setup. Carry on with allowed setup until ready or blocked. A protocol request or discussion alone is not a start signal. If C already gave a clear start signal during setup, save it and use it once setup is ready. Do not ask again.

## 4. Wake methods and setup

There are two wake methods: **CLI** and **polling**. Codex always uses polling for its incoming wake, whether it is A, B, or T; follow section 7.3. A first decides its own incoming wake method from the tools and access available to A. Honor C's stated choice when supported and consistent with the Codex rule. Save A's selected method in `goal.md` before choosing or checking B's method, and tell C the choice. If A cannot use C's chosen method, report the actual gap and discuss a supported choice. Then choose B's incoming wake method. A and B may use different methods. A's selected method tells B how to return its report. Do not add a file watcher as a third method or a second wake path for the same role.

| A wakes by | B wakes by | How A sends work | How B returns a result |
|---|---|---|---|
| CLI | CLI | A calls B's CLI with the directive path. | B calls A's CLI with the report path. |
| Polling | CLI | A calls B's CLI with the directive path. | B updates shared state; A finds the result on its poll. |
| CLI | Polling | A updates shared state; B finds the assignment on its poll. | B updates shared state and calls A's CLI with the report path. |
| Polling | Polling | A updates shared state; B finds the assignment on its poll. | B updates shared state; A finds the result on its poll. |

After choosing A's method, A asks B for its method using the short setup prompt in section 4.1. When B is Antigravity, its method is the CLI path in section 6.1. When B is Codex, its method is polling as in section 7.3. Do not switch an Antigravity B to polling because its new chat's workspace binding or returned ID is unknown. For other roles, use a supported incoming path within C's limits. For A's CLI wake, B needs a way to call A's CLI and continue the exact existing A chat. A CLI that starts B does not prove B can call A. Report actual tool results honestly.

### 4.1 Check support through C

Once C agrees to setup, A first chooses its own wake method, prepares the needed settings, and saves the choice. A then prepares a short initialization prompt for B. If C chose an external browser test agent, A also prepares a short prompt for T under section 4.3. Do not ask C to name or choose which agent app will be B or T before giving these prompts. C carries each prompt to the intended agent and brings its reply back; C does not have to research the agents or their methods. The agents identify themselves and report their methods in their replies. A does not assume an agent app or ask C to supply facts A, B, or T can find.

Name the B role, the project, the exact goal folder, the absolute path to this protocol, and A's selected wake method. Ask B to read AGENTS.md and this protocol, identify its agent app, say which wake method it uses, and explain the needed directive and report handoff. Ask B to follow this protocol's setup rules for its own app, including preparing a wake script if it is Antigravity under section 6.1. If A uses CLI, give the known app, executable and exact session target so B can address the callback. If A polls, say B returns results through shared state. Give A's host and goal folder when known. If A needs connection or project details not already known, ask B for those facts in the same prompt. Do not ask for details A already has, a full tool interview, or proof of an actual future launch. Show the full short prompt in a four-backtick code block so C can copy it. After B replies, A uses the reply and known context to complete setup; it does not require a second relay just to repeat details. Reuse a current suitable reply when it already answers the needed points.

A checks and supplies its actual session target before choosing an A CLI wake. B may report any known callback limits in its initialization reply. A gives the exact callback in the task directive and reports an actual callback error if it occurs. If A cannot find the session ID, CLI path, access, or another required fact, record it as unknown and report the gap through C. Do not claim that B verified an unnamed or unreachable A session.

**Antigravity B is a special CLI case.** When B reads this protocol for setup, it identifies CLI as its wake method and prepares a goal-specific wake script under section 6.1. B reports the script path and exact command for A to run with a directive, as well as any real gap. B also explains the need for a complete directive and report. A records the setup and uses B's command for later dispatches. Actual launch success, workspace binding, returned ID, and callback success are separate facts; do not say they are proven before they happen.

When a tool check is needed for a B other than Antigravity, B checks and reports supported, unsupported, or unknown, with command help or other direct evidence:

- Whether A can start B through B's CLI: exact executable, command and arguments, access, project selection, and whether a fresh task chat can be created, named, and identified. Do not assume the working directory selects the chat's project.
- Whether B can call A's CLI from B's environment to continue A's exact existing session: executable, command form, access, and limits. A separately checks its own session target and required access.
- When polling is needed, the available automation tool, exact role and chat or project target, supported interval, and start, status, pause, resume, and stop controls. Check whether it can avoid repeated agent runs while work is active.
- Whether both sides can read and write the needed goal files, use exclusive locks and atomic state replacement, and create the specified report.

For Codex, use polling for every role as in section 7.3. For other roles except Antigravity B, check the needed incoming path and use polling if the CLI path is not supported or is outside C's limits. For Antigravity B, use its initialization reply and section 6.1; do not add an unnecessary tool interview. Do not require demo tasks, trial conversations, or round-trip tests. Setup does not authorize goal work. Report unknown facts as unknown and actual results as they occur.

A chooses and tells C each method and why. C may change or refuse the choice. A records the methods and setup. Send B only the actual settings or actions B still needs, through C. Do not repeat a complete check reply. For a polling role, set up and check its automation and save its actual settings. Follow the tool's supported controls. Do not edit scheduler files by hand. If a required path or access is missing, report the exact gap. Do not claim readiness or silently switch to manual relay; C may choose a manual route.

### 4.2 Setup records and start

Use `<project>/AGLP/<goal-name>/` unless C agrees to another folder. For a new goal, use `goal.md` as its goal record. A saves the absolute project and goal paths, each role's method, exact CLI commands and arguments or schedule settings, session or chat target, owner, access, stop/resume steps, failure and recovery steps, and checked evidence in `goal.md`. For polling, save the automation tool, schedule ID, role, target, interval, state path, and accepted settings. Do not claim a launch or callback succeeded before it happens.

Use one shared `current-state.md` only if any role polls. All roles in that goal update the fields needed by the polling roles, including CLI roles. If no role polls, do not create, read, or update it. Keep goal mode, assignments, results, and reviews in the goal record and reports instead.

Setup is ready when the selected methods, needed paths, commands, targets, rights, and controls are saved and any required setup is done. For Antigravity B, an unknown workspace binding or conversation ID is not a setup blocker; section 6.1 gives the first-task access check. Do not claim those unknown facts are verified. Do not start goal work before C's start signal. After that signal, set the goal active and give the first real directive.

### 4.3 Browser test choice and T setup

If the goal calls for live browser testing, A asks C whether A should use its own built-in browser or an external browser test agent. Reuse C's answer if it is already clear; do not ask again. Save the choice in `goal.md`. If browser testing is added later, ask then if the choice is still unknown. Do not treat source checks, fixtures, or B's report as a live browser test.

If C chooses A's own browser, A performs the needed live tests with its available browser and records what it sees, proof, and any access gap in the goal review. No separate T, T schedule, T directive, or T wake setup is needed. Check browser access and ask C to sign in only when needed. If A's browser is unavailable, report the gap and ask C how to proceed; do not claim the test passed.

If C chooses an external agent, set up and use T. A first selects its own wake method, then prepares a short initialization prompt for T using the same setup flow as B in section 4.1. Do not ask C which agent app should be T before providing the prompt. Name the T role, the project, exact goal folder, protocol path, A's method, and the needed browser work. Ask T to read AGENTS.md and this protocol, identify its agent app, report its wake method, and explain the directive and report handoff. Ask T to follow this protocol's setup rules for its own app, including preparing a wake script if it is Antigravity under section 6.1. Ask for connection or project facts only when A needs them. Show the prompt in a four-backtick block. C carries it to the intended T and brings the reply back; do not ask C to research T's tools.

T can wake by CLI or polling, independently of A and B. A Codex T always uses polling. An Antigravity T uses the same role-specific wake script setup as Antigravity B under section 6.1, with T as the role and a separate T script and directive. For another T, A chooses a supported method from T's reply, as for B, within C's limits. C may change or refuse the choice. If T uses CLI, A saves a complete browser test directive and wakes T through its selected path.

If T polls, C chooses T's interval; do not assume B's interval. After the method and interval are known, A prepares the shared `current-state.md` in `setup` mode with T's slot set to `none`. A then gives C a complete T setup prompt in a four-backtick block. The prompt gives T the exact goal and state paths, its role, selected interval, quiet check, setup-mode rule, and instructions to use T's own supported automation controls. C carries the prompt to T.

**T creates and owns its own polling schedule in T's chat.** A must not create, change, or stop T's schedule. T checks the actual target chat, accepted interval, state path, busy handling, and start, status, pause, resume, and stop controls. T reports the schedule ID, accepted settings, owner, controls, and any gap to A through C. A records T's reply in the goal record and does not mark T ready until the needed settings are confirmed. T does no browser task while the goal is in `setup` mode.

T's setup can proceed while B's reply is pending. A must not stop after saving the interval or wait for B before giving T its schedule setup prompt. If the state file, target, or another required fact is missing, A prepares what it owns and reports the real gap. Follow section 7 for schedule and busy rules.

If any role polls, use the one shared `current-state.md`, with a separate T slot. T follows only its own slot and never claims B's work. A gives T the exact browser target and limits, allowed writes, directive and report paths, proof needed, and A's selected return method. T reports what it actually saw and any access or sign-in gap. Check browser access and ask C for sign-in only when needed. Do not require a demo. Reuse the same ready T setup unless C agrees to change it.

## 5. Files and task rules

A owns `goal.md`. It holds the living goal, version, mode, setup, assignment and launch history, owners, reviews, timing, changes, and recovery. B and T do not edit it. A updates it after every review and agreed goal change.

A chooses a unique, suitable filename for each directive and report in the goal folder. Names do not route work and do not change with status. Never overwrite an earlier directive, report, or review. Each directive, report, and review begins with `Directive: <unique-id>`. A uses a new ID for each task, retry, or correction and links the earlier ID when useful.

Each directive is self-contained for its task. Include the goal version, purpose, scope, steps appropriate to the task, inputs, allowed actions and paths, limits, checks and proof, exact report path and format, selected wake methods, and handoff and failure steps. Give absolute project, goal, directive, report, protocol, and goal file paths. Include the shared state path and role fields when any role polls. A fresh worker must not need memory from setup. For a dedicated Antigravity task chat, list the needed files, canonical docs, and initialization prompts in the directive. Give the full task and handoff steps in section 6. The worker reads AGENTS.md, its directive, the goal record, and the task references it needs. It does not need to read the full AGLP protocol during that task; the setup chat still reads it. The worker must follow all other applicable repo and skill instructions.

If A wakes by CLI, include A's exact existing session ID, the full return prompt, and the checked command with separate arguments. The prompt names the exact goal record and report, and shared state when used. For Antigravity A, include the wake script command and report filename as in section 6.2. Do not use `--last` or unresolved example values. If A polls, tell the worker to update state and not call A by CLI or wake script. Include permission to write the report, owned locks, and temporary files within the agreed scope.

A saves the assignment and launch intent in the goal record before publishing a directive or dispatching work. Write each directive and report to a unique draft, close and check it, then atomically move it to its unique final path without overwrite. Check its Directive line and CRLF. Do not expose a partial report as final. A records the actual launch result and worker ID when available without overwriting a newer review. A launch failure is not a failed build.

B reports the Directive, goal version, owner, start and finish times, result, proof, and unmet work. `completed` means all task checks passed. `failed` includes partial or blocked work. A reviews either result; a worker's result is not acceptance.

## 6. CLI wake

For a role using CLI, the sender calls its selected CLI with a short prompt naming the role and exact directive or report path. For Antigravity B, use its setup reply and the path in section 6.1. For B or T, the prompt states the worker's role and A's selected wake method and says to read the directive and execute it end to end. For A, it says to read the report and goal record, check the assignment, review the result, and take the next needed step. Include the state path in mixed goals. The CLI prompt carries the file location; the directive carries the full task and return instructions.

A launches the assigned B or T in the specified project. Use a launch that lets A end its turn while the worker runs. Release A's run lock before dispatch. Do not launch a second live owner for the same assignment. Save launch intent and result.

The worker reads the directive and goal record, checks the assignment and goal mode, claims the work, and follows the directive. It saves and closes the report, updates its own shared state slot if used, and releases its locks before the return. When A uses CLI, the worker runs the exact checked callback command to continue A's saved session. When A polls, the worker does not also call A.

A callback failure does not mean the build failed. Save the error and pending return in the agreed local dispatch record. Check that A is free and has not reviewed the assignment before retrying only the return. Do not rebuild finished work. If no return path works, tell C the gap. Codex never uses a CLI incoming wake under this protocol; follow section 7.3.

### 6.1 Antigravity B or T: special CLI wake

For an Antigravity T, follow this same setup and dispatch flow with T as the role, a separate T wake script, T directive and report, and T's own shared-state slot when used. The wake prompt names T and its browser test directive. Each directive uses a fresh task chat under the same ready T setup; T reports browser evidence as in section 4.3. Keep B and T assignments and scripts distinct.

After selecting A's method, A sends the short initialization prompt in section 4.1 to B through C. The prompt gives B the exact project folder, goal folder, A's wake method, and permission for the agreed setup work. Antigravity B prepares a goal-specific wake script in that goal folder and replies that it uses CLI. Follow the project's file and code rules and any required approval; reuse permission already given. If B cannot create the script or lacks access, it reports the exact gap rather than claiming it is ready.

B's script accepts the directive **filename** as an argument, not the directive text. It finds that file inside the goal folder and checks that it exists. It uses the actual project, goal, A's selected method, and Antigravity tool settings from setup. It obtains the current connection and project details needed by the installed Antigravity and starts `agentapi new-conversation` with a fresh B chat, a task title, and a wake prompt. The script builds the prompt using the directive's exact absolute path. The prompt names B's role, A's method, project, and AGENTS.md, and tells B to read the directive file and execute it end to end. Do not hard-code one host's server or project values into this protocol. The script must report an actual launch error if it cannot start the chat.

B reports the script's absolute path, the exact runtime and command A should use with a directive filename, any needed setup or access, and what launch results it returns. B checks the script within its available tools without starting a demo or goal task. C carries B's reply to A. A checks and records the script path, command, settings, and reported gaps in `goal.md`. Setup is not ready if the script or required runtime is missing. A does not need to build the wake prompt or connection steps for each task.

After C's start signal, A writes and publishes the directive file, records the assignment, and runs the saved script command with the directive filename. A does not pass the directive's contents as the command argument. The script starts a fresh B chat for **every directive**, including each later task, retry, or correction. Never assume a new B remembers an earlier task chat. Use a launch that lets A end its turn while B works. Record the actual launch result and conversation ID when returned. A returned ID means the launch was accepted; it does not prove B claimed or finished the task. Do not dispatch twice when the first owner may still be live. Keep a failed assignment and directive for recovery and report the actual error; do not switch B to polling without a supported setup and C's agreement.
- Set the launch working directory to the project root and name the exact project and absolute directive path in the wake prompt. Use absolute paths in the directive. The exact app workspace binding and a returned conversation ID may be unknown; neither blocks this setup, and A must not claim either is proven. At the start of the real task, B checks access to the named project, directive, goal record, and needed files before any task edits. If access is missing or the wrong project is in use, B stops task edits and reports the actual gap through the directive's failure path. No demo or trial conversation is required.
- The wake prompt states whether A uses CLI or polling and tells B to read AGENTS.md and the exact directive and execute it end to end. Every directive gives B the full task, references, checks, allowed paths, goal record, assignment and mode checks, lock paths and ownership, report draft and final paths, publishing or other file renames needed for that task, and failure steps. If any role polls, include the exact `current-state.md` path, B slot, allowed fields, locks, and steps to set `working` and then `completed` or `failed`. If no role polls, say there is no state file to update. Give A's selected return method and exact callback details when A uses CLI. The fresh worker follows the directive and applicable repo rules without relying on memory from setup. Directive filenames stay fixed; do not rename them for status changes.
- Give B this execution order in the directive: check the assignment and goal mode; claim the task and any shared state under the required locks; do the work and checks; publish the completed or failed report; update shared state when used; release owned locks; then use A's selected return path. If A polls, B does not also call A. If A uses CLI, B runs the exact callback after lock release. Record any handoff failure and do not repeat completed work. The fresh B conversation ends after its task and handoff; B does not need its own polling schedule for this CLI wake.


### 6.2 Antigravity A: return wake

When A is Antigravity, A chooses CLI or polling for its own wake before setting up B. Use the chosen method for B's and T's returns. Keep A in the same chat.

If A uses CLI, prepare a goal-specific wake script for A in the goal folder during setup. A may prepare a setup script, or ask B to prepare it in B's initialization prompt when B has the needed access. Follow project file and code rules and any required approval; reuse permission already given. Record the script's exact path, runtime, command, A's existing conversation ID, and any required connection details in the goal setup. Check the needed tool and access facts; do not claim that a callback succeeded until it happens. If the target or script cannot be prepared, report the actual gap.

The A wake script accepts the report **filename** as an argument, finds the closed report in the goal folder, and builds a return prompt naming A's role, the exact goal record and report paths, and the shared state path when any role polls. The prompt tells A to check the assignment, read and review the report, and take the next permitted step. The script uses the selected Antigravity message method and the exact saved A conversation ID to send that prompt to the same A chat. The local CLI help lists `agentapi send-message <recipient_id> <content>`; check its availability and target for the actual setup. It must not start a new A conversation. Report actual send failures.

Each B or T directive states that A uses CLI and gives the script path, runtime, exact command, and expected report filename. After finishing work, the worker publishes the report, updates its own shared slot if any role polls, releases its locks, and calls A's script with that filename. A message sent does not prove the review happened; A checks and records the review. If the return fails, retain the report and retry only the return after checking A's state and whether the result was already reviewed. Do not repeat finished work.

If A uses polling, set up A's automation and one shared `current-state.md` as in section 7. B or T publishes the report and updates its own slot; A finds the final result on its next poll. The worker does not call an A wake script or another CLI return path. If B uses a CLI wake, B's own wake script is separate and still handles A-to-B dispatch.

## 7. Polling wake and shared state

An automation wakes a polling role at a checked interval. B starts at three minutes when the tool supports it and C has not chosen another interval. If it cannot, tell C the supported choices. C chooses T's interval. Save each accepted interval, role, exact target, and state path. A's interval is chosen from checked support and the needs of the goal; do not assume B's interval applies to A or T. Change schedules only through supported controls and check the accepted result.

A quiet poll reads only `current-state.md`. The wake prompt names the role and the exact state path. If the role has no action, end the turn quietly and wait for the next scheduled wake. Do not scan folders, read the directive, goal record, or reports, or rewrite unchanged state during a quiet poll. Notify C only for a meaningful result, completion, failure, or needed action; use the tool's notification settings when available.

Keep `current-state.md` to **at most 10 lines**, with the fewest practical tokens. It is one file for the whole goal, not one file per role. It holds current facts, not task text, report contents, history, full commands, or check instructions. Paths may be relative to the goal folder. The wake prompt supplies the role; do not infer it from a ready task. The following is a shape, not a live assignment:

```text
mode: active
version: 1
A: polling
B: polling
B-task: new | id: task-1 | directive: build-task.md | report: report-task.md
```

Use `mode` values `setup`, `ready`, `active`, `paused`, `blocked`, or `done`. Use task status `none`, `new`, `working`, `completed`, or `failed`. When T is used, add `T: <method>` and a separate `T-task` line with the same fields. A and B methods are always present when B is used; a fresh worker can see the return method. During setup, a method not yet known may be `pending`, and an unassigned slot uses `none` for its status, ID, directive, and report. A replaces `pending` with the chosen method before the goal becomes active. Keep each slot's ID and paths unchanged while assigned. A directive is not renamed when status changes.

In an active goal, B acts only when its own task is `new`. T also reads only its own slot and acts only when `T-task` is `new`. For `none`, `working`, `completed`, or `failed`, a polling worker ends quietly. T claims its own task under the T run lock and state lock, sets only `T-task` to `working`, reads the named directive, and tests within its limits. T publishes its report, sets only `T-task` to `completed` or `failed`, releases its locks, and uses A's selected return path. T does not poll during the test; follow the schedule and busy rules in section 7.1.

A leaves the quiet poll when a needed B or T slot is `completed` or `failed`. It then checks the goal record under its run lock to see whether that exact Directive was already reviewed. If neither slot has a final result, A ends quietly. A's scheduled prompt must not treat a missing or malformed state, unknown role, or unknown status as `none`; stop dependent work and report or recover the gap.

Do not start goal work in setup, ready, paused, blocked, or done mode. In blocked mode only a named recovery wake may do the permitted recovery. A new assignment or a goal change needing A's planning is handled on an explicit wake or the normal result review, not by making idle polls scan other files.

### 7.1 Publish, claim, and finish

A records the assignment and intent in the goal record, publishes the closed directive, then writes the exact task ID, paths, and `new` status to the assigned B or T slot under the state lock. Only after that may the assigned worker claim it. If that worker uses CLI, A launches it after its slot is ready. If it polls, it finds its own slot on its next wake. Do not use both wake paths for the same worker.

A worker that sees `new` takes its exclusive role run lock, then takes the short state lock. Re-read state under that lock. Confirm active mode, the same goal version, exact assignment and `new` status, and no hold. Set only its own slot to `working`, then release the state lock. If the check fails or another owner holds the run lock, do not start a duplicate. Read the exact directive and goal record and execute only the assigned work.

While working, a polling worker does not poll. Setup must name the schedule owner and a checked way to prevent repeated wakes while the worker is busy. This may be a tool that suppresses overlapping wakes or a schedule paused and resumed through supported controls. If neither is supported, report the gap; a run lock prevents duplicate work but does not stop extra wakes.

If pausing is needed, the designated owner pauses the worker's own schedule and checks the result after claiming the task and before doing task work. The directive gives the exact controls and who runs them. If the pause fails, do not start task work. Save a failed report, finish the assignment as failed, and report the schedule gap. After any completed or failed work, the schedule owner resumes the schedule only if the goal still permits it, using the saved controls, and checks the result. Save a pause or resume error and the pending action in the agreed dispatch record; notify C when it needs action. Do not restart a schedule while the goal is paused or done. If the worker cannot run its own controls, C must carry the needed instruction to the owner; record the pending step and do not claim it happened. A CLI worker has no worker poll to pause.

After work and checks, close and publish the report first. Then take the state lock, re-read and confirm the matching assignment. Confirm ownership from the worker's still-held role run lock: its owner and Directive must match this run. The owner is not required in the slim state file. Set the slot to `completed` or `failed` with its exact report path. Release the state lock and owned run lock.

After lock release, the schedule owner resumes a schedule paused for this task if the goal still permits it. Record a failed or pending resume without changing the task result or repeating the work. If A uses CLI, send the callback even if schedule resume failed, and include the gap in the report or return prompt. If A polls, it finds the final state on its next wake; record and report the schedule gap separately. A failed task still gets a report and wakes A by its selected method.

### 7.2 Safe writes

Each acting role holds its own exclusive run lock, created with `CreateNew`, during task or review work. Save the owner and Directive in the lock. A second run for that role leaves while the lock is held. Never clear a lock by age. Release only owned locks, including on failure.

For every shared state change, also take a short exclusive `state.lock` with `CreateNew`. Re-read the latest file under the lock. Check goal mode, version, assignment, allowed transition, and owner as needed. Change only the writer's allowed fields, keep other slots and methods intact, write a full temporary copy, check its format, 10-line limit, and CRLF bytes, then atomically replace the state file. Release the state lock in `finally`. Do not hold it during task work, report writing, or review. A owns mode, version, methods, and assignments; B and T change only their own task status and keep assigned IDs and paths intact.

A writes the goal record under A's run lock using a checked temporary copy and atomic replacement. If safe locking or replacement is unsupported, stop setup and tell C. Do not use unchecked overwrite. A conflict, missing or corrupt file, wrong assignment, or unknown owner needs recovery, not a guessed state.

### 7.3 Codex: polling for every role

When a role is Codex, its incoming wake is always **polling**, whether the role is A, B, or T. This applies even if Codex has a CLI. Do not select or call a Codex CLI to wake that role. Set up polling for that Codex role and record its exact schedule, target chat, state path, interval, and owner in `goal.md`. A sets up its own schedule. A Codex T sets up and owns its own schedule in its T chat under section 4.3; A sends the setup prompt through C and does not create or manage T's schedule. Use the supported automation controls and confirm the accepted settings. If a supported schedule, target, or needed access is unavailable, report the gap and do not claim that role is ready or silently use CLI instead.

Because Codex polls, the goal uses one shared `current-state.md` even when the other roles use CLI. All participants update the needed slots. Each polling prompt names its role and reads only that file during quiet waits. A Codex B or T reports polling in its setup reply and follows only its own slot; it does not poll while carrying out a task. A Codex A reads final B or T slots and reviews the named report. Follow the claim, report, state, lock, and busy rules in sections 7 and 8.

When Codex is A, B or T returns a result by publishing its report and updating its shared slot. A's next poll finds it; the worker does not send a CLI callback. When Codex is B or T, A publishes a directive and sets that role's slot to `new`; the worker finds it on its next poll. After reporting, that worker follows A's selected return method: update state for a polling A, or call the specified callback for a non-Codex CLI A. A role's outgoing action does not change its own polling wake method.

## 8. Review and progress

After a final state or CLI callback, A takes its run lock and reads the goal record. First match the exact Directive and check whether a review is already saved. If the worker still holds its run lock, leave the result pending; a later poll or a checked CLI return retry handles it after lock release. Do not read a report while its owner is still working. Check the exact closed report against the saved assignment, goal version, and Directive. Inspect real files and run allowed targeted checks. A report is proof to check, not new permission. Keep source, fixture, compiled-component, and live browser proof separate.

A saves a unique review with `VERIFIED`, `PARTIAL`, `FAILED`, or `BLOCKED`, proof, and limits. Mark a missing feature `NOT IMPLEMENTED` and an access gap `BLOCKED`. Save the exact reviewed Directive, goal progress, and review link in the goal record before clearing the matching state slot or assigning more work. Clear only that matching final slot under the state lock. A `completed` worker report alone does not make the goal complete. If A performs the browser test itself, record the actual live observations, proof, and any gap in the review, separate from source and fixture proof. Keep unmet work pending or blocked.

If A wakes again while the final slot still names a Directive whose review is already recorded, do not review it again. Under the state lock, confirm that the slot still names the same Directive and final status, then finish the pending slot clear and next step from the goal record. If the review file exists but the goal record does not yet record it, use recovery to finish the saved review step before clearing the slot. Do not add review history to the slim state file.

After reviewing a final result, A may assign the next useful task, finish the goal, or report a real blocker to C. Never review the same result twice as new work. Normally do tasks one by one. Work sharing files stays serial. Independent B and T work may overlap only when scope, ownership, and setup make it safe; A reviews final slots without changing another role's live slot.

## 9. Task detail and help

C's High, Medium, or Low tier is the starting point. A judges B or T from checked work and records why task detail changes. A label or confident report is not proof.

| Tier | Task detail |
|---|---|
| High | Outcome, purpose, limits, useful references, and proof needs. |
| Medium | Also give target files, inputs, outputs, edge cases, and checks. |
| Low | Give small tasks with clear steps, paths, order, and checks. |

All tiers need scope and proof rules. A does not supply full production code. When B has a tool, access, skill, or useful second opinion A lacks, A may give B a normal directive for help. State the question, what A checked, the gap, proof needed, and whether B may change files. Default to read and test only apart from the report and permitted state, lock, and scratch files. A still checks the answer and owns the decision.

## 10. Changes, pause, and completion

C may change the goal or work at any time. A question or idea is not automatically a change; clarify only when intent is unclear. Save an agreed change, reason, effects, and new goal version in the goal record. If any role polls, update the version and any needed hold in shared state under the state lock. Keep history and proof.

Before changing assigned work, hold new claims. When state is used, A sets mode to `blocked` under the state lock while the change is unsettled and saves the hold and recovery steps in the goal record. Restore `active` only after the change is settled and permitted work is ready. For unclaimed work, check the actual dispatch and owner before withdrawing it; treat a racing claim as live until checked. For live work, save whether the worker may finish or must stop at a safe boundary. Do not rewrite a live directive or assume it stopped. The worker checks the saved change at safe boundaries and reports its actual result. A reviews what remains useful. A replacement gets a new Directive. Do not publish dependent work until the change is settled. Normal changes within the agreed goal do not need a new start signal.

For a pause, save paused mode in the goal record and, when used, shared state. Stop new work. Pause schedules A owns through supported controls; C carries pause instructions to B or T for tools they own. T manages its own schedule; A does not pause it directly. Check and save actual results and C's pause scope. A live worker checks at safe boundaries and follows that scope; a paused schedule does not prove work stopped. Report any tool that could not be paused. Do not resume a paused goal until C asks.

On resume, read the goal record and state when used. Reconcile saved assignments and owners before restarting the existing wake paths. A resumes only the paths it owns; C carries the resume instruction to T, and T resumes its own schedule and reports the actual result. If C moves A to a new chat, check and retarget its wake path first. Save the target. Do not silently start a second A.

When the goal's done checks pass, A saves the final review and progress, sets done mode in the goal record and shared state when used, and stops wake paths it owns. C carries stop instructions for B or T tools they own. T stops its own schedule; A does not stop it directly. Check results and tell C what passed and any tool still running. If required checks remain unmet, report `PARTIAL` or `BLOCKED`; do not claim full completion.

## 11. Recovery and handoff

A continuing session reads AGENTS.md, this protocol, the goal record, and the exact directive, report, or review needed. Existing goals keep their recorded goal file path, including `goal-record.md` when already in use. Do not rename it or create a second goal record unless C agrees to a checked handoff that updates all affected paths. Read shared state only when a role polls. Carry the goal, mode, version, assignment, owners, paths, methods, targets, schedule or CLI details, locks, and recovery steps forward. Reuse checked setup. A new chat does not resume a paused goal.

Check the goal record, shared state when used, exact files, live owner, locks, launch intent, and any unfinished publish or review step. Do not infer failure from silence or clear a lock by age. Confirm an old process is no longer active before any permitted lock repair; otherwise ask C.

- If dispatch is unclear, reconcile the actual owner and report before retrying. Do not launch from file existence alone.
- If a report exists but return or review did not finish, check the closed report and assignment; retry only the selected return or finish the saved review. Do not repeat the build.
- If a review exists but progress was not saved, finish that saved step instead of reviewing again. If the goal record already records the review but the final slot remains, verify the matching Directive and clear that slot under the state lock before the next assignment.
- If a schedule pause or resume was not confirmed, check its actual status and the goal mode before using its saved controls. Do not resume a paused or done goal or repeat finished task work. Report an unresolved tool or owner gap to C.
- If state and files disagree, an owner is unknown, or a required record is missing or corrupt, hold dependent work and recover from checked records. Never guess that a slot is idle.
- If a wake fails, retry through the selected checked path only after checking ownership. Keep old proof. Use a new Directive for a new repair task.

## Maintenance

Update this file and AGENTS.md together when activation, roles, setup, naming, or loop rules change. Protocol edits do not migrate an existing goal. AGLP has two wake methods, CLI and polling, chosen per role. Any polling role requires one shared state file of at most 10 lines. Directives keep their names. Real goal work starts only after setup and C's start signal.
