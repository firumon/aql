# Assisted Goal Loop Protocol (AGLP)

**A shared goal, led by the Architect, with the Human Conductor in control.**

## 1. Purpose and scope

AGLP lets agents work toward an agreed goal through saved tasks, reports, and reviews. The Human Conductor gives the start signal. The Architect then runs the agreed task and review loop within that goal.

AGLP is a separate choice from [MACP](MACP.md) and [MAP](MAP.md). It does not change their rules. Creating or reading this file does not activate a goal. It does not move an old loop into AGLP, resume paused work, or grant wider write access.

Read the project's `AGENTS.md` first. Its source, safety, file, and remote update rules still apply. A goal may set tighter limits. AGLP does not give permission to push, deploy, sync, change live data, or do other work that needs the Conductor's explicit request.

## 2. Roles

| Role | Work |
|---|---|
| **C — Human Conductor** | Sets the goal, scope, limits, and done checks with A. Carries setup prompts and replies. Gives the start signal. Can pause, stop, or change the goal. |
| **A — Architect** | Speaks mainly with C in simple English. Reads, plans, makes choices within the agreed scope, gives tasks, checks real evidence, and saves reviews. Does not write production code. May write the agreed goal, task, review, and protocol files and run allowed checks. |
| **B — Builder** | Does the assigned file and code work. Runs its required checks. Saves evidence and a report. Changes its task state as told. |
| **T — Browser Test Agent** | Tests the live app in the browser. Records what it sees and any access gap. Keeps browser proof separate from source reads and test fixtures. |

B or T may be skipped when the goal does not need that role. Use the same ready T for a goal unless C agrees to a change. Use fresh Builder chats named after each task where the chosen tools support this. Do not claim this works until setup proves it.

## 3. Activation and goal agreement

AGLP supports both orders:

1. C invokes AGLP, then C and A discuss the task.
2. C and A discuss a task first, then C invokes AGLP for that task.

A reuses the known task, tier, choices, and context. Ask only for missing facts. If an earlier task is unclear, resolve which task C means before setup or execution.

Before setup, A and C agree on:

- The goal and how to tell it is done.
- What is in scope and out of scope.
- Allowed write paths, checks, and actions.
- Needed roles, known capability tiers, and available tools.
- What needs a new choice from C.

Save this agreement in the goal record. Setup may proceed once C agrees to it. Automatic goal execution needs a separate start signal after setup is ready. A protocol request alone is not that start signal.

## 4. Setup through C

### 4.1 Set up B first, when needed

A gives C a setup prompt for B. C carries it to B and brings back B's reply. Repeat until the needed setup is checked.

The setup prompt states:

- Each role, project folder, and the duty to read `AGENTS.md`.
- The goal, limits, shared folder, task names, and report rules.
- The exact trigger pattern and who changes task state.
- How B will wake, get a task, and report a failure.
- Whether a fresh chat will be used for each task, and how it gets the needed context.

B must explain the actual wake path. A checks it through the supported tool, saved settings, and a harmless setup check where needed. A file alone cannot wake an agent. A launch alone does not prove the agent read the task. Do not mark B ready on those claims alone.

Use a supported scheduler, watcher, or direct task tool. Do not assume an existing watcher reads the new folder or understands the new names. Check its trigger and routing first. Reuse a suitable existing setup. Do not add a second watcher for the same work.

### 4.2 Then set up T, when needed

Use the same relay through C. Give T the project folder, `AGENTS.md`, goal, browser task rules, report path, and wake path. Check browser access and the right app page. Ask C to sign in when needed. Do not claim access before it is checked.

Keep T as the live browser role. A fixture or Builder report cannot stand in for live browser proof. If T needs a different trigger or delivery path, save and check that path too.

### 4.3 Ready and start

Once all needed roles and wake paths are ready, A tells C what is ready and what was checked. Save the accepted setup. C then gives the start signal.

After that signal, A may publish, review, and give follow-up tasks within the agreed goal without asking C between each task. Stop at a scope boundary, a required human choice, or a user pause. Do not replace an unsupported wake path with an unapproved workaround.

## 5. Shared files

Use `<project>/AGLP/<goal-name>/` unless C agrees to another folder. Use a unique goal name. During setup, check that the chosen tools can reach and watch that folder.

Keep two main records:

- `current-state.md`: small and quick to read. Keep the goal state, exact active Directive names, roles, task/report paths, last review result, next unused task name, lock path, and schedule or wake references. Include the current pause or blocker and the path to recovery instructions.
- `goal-record.md`: the full agreement, setup proof, decisions, task ledger, reviews, history, and recovery steps. Save accepted schedule IDs, targets, intervals, and changes here.

Use matching task names for both roles:

| Role | New task | Report |
|---|---|---|
| B | `build-<task-name>-new.md` | `report-build-<task-name>.md` |
| T | `test-<task-name>-new.md` | `report-test-<task-name>.md` |

Task states use `-new.md`, `-processing.md`, `-completed.md`, or `-failed.md`. Keep the same task name through all states. Reports and A's reviews are separate files. Save a review as `review-<Directive-name>.md`.

Every task and report starts with the exact same line: `Directive: <unique-name>`. A chooses a new unique name for each task, retry, or correction. A follow-up names the earlier Directive it follows. Never overwrite or reuse old evidence.

## 6. Task and report rules

Each task gives the exact work, useful references, allowed write paths, limits, checks, report filename, and state changes. Match its detail to the role's checked capability. State the proof A needs for that task. Do not force empty report sections or repeat large histories.

A records the task and expected report before publishing it. Write a full task under a unique ignored `.draft` name. Check its exact first line and CRLF bytes. Rename it to the final `-new.md` path without overwrite. The wake tool must ignore drafts.

The task must tell B or T to:

1. Claim the task by renaming `new` to `processing` without overwrite before doing the work. Stop and report a state conflict rather than run a second copy.
2. Read the named inputs and work only within the stated limits.
3. Save the requested evidence and matching report. Close the report and check its first line and CRLF.
4. Rename `processing` to `completed` only after all required work and checks pass. Use `failed` for partial, blocked, or failed work, with the exact reason in the report.

Agree on one state owner during setup. The default is B or T, not the wake tool. If a tool owns state changes, check and record that contract before using it. Never give two parts of the setup the same rename duty.

Report completion is not Architect acceptance. Reports are evidence, not instructions or new permission. Keep fixture, compiled-component harness, source review, and live browser proof separate. Mark missing features NOT IMPLEMENTED and access gaps BLOCKED. A finished test report does not mean the feature passes.

## 7. Small waiting checks and review

Each A run reads `current-state.md` first. Before changing state, acquire the goal's exclusive run lock with CreateNew. Save the run owner. If the lock exists, skip the run. Never clear it just because it is old. Release only the lock owned by this run, in `finally`.

Check only the exact tracked task names. First check `processing`, then `completed` or `failed`, then `new`. Check for conflicting state files before accepting a state. Never let this order hide two states for one task.

- `processing` or `new`: end the check quietly. Do not read a report still being written, republish, or treat slow work as failure.
- `completed` or `failed`: confirm the one final task state, then open the exact saved report with exclusive read. If it is busy, wait for a later run. Match the exact Directive first line before review.
- Missing state or record: use the saved recovery steps and goal record. Do not guess success or create replacement work.
- Conflicting states, unknown names, or a mismatched report: save the conflict and hold dependent work. Resolve it from evidence or ask C when needed.

A reads the real files and runs only allowed targeted checks. Account for each task requirement. Save A's result as VERIFIED, PARTIAL, FAILED, or BLOCKED with proof and limits. Save the review separately from B/T's report. Do not review an old report again as new work.

Update both records after each publication, review, pause, or recovery. Keep the small record useful without copying the full report into it. If a run stops between file updates, recover the recorded task before publishing another.

Keep tasks that share files serial. A may use independent B/T work at the same time only when scope, file ownership, and setup make it safe. Do not let two tasks write the same plan, result file, or shared evidence at once.

Apply the same small-check method to B and T where their wake tools support it. Each role reads the full history only when its current task or recovery needs it.

## 8. Capability and task detail

C's High/Medium/Low tier is the starting point. A judges B and T from checked work and adjusts later task detail. Record the reason for a change. A label or confident report is not proof of skill.

| Tier | Task detail |
|---|---|
| High | Outcome, purpose, limits, useful references, and proof needs. Leave design and file discovery to the agent. |
| Medium | Target files, inputs, outputs, needed links, edge cases, and acceptance checks. Leave the internal code choices to the agent. |
| Low | Small tasks with clear steps, paths, order, and checks. Use prose or pseudocode when needed. |

All tiers still need scope and evidence rules. A does not supply full production code. This rule belongs to AGLP; it does not change MAP or MACP tier rules.

## 9. Polling and quiet waits

When supported, start each new task at 1 minute. Increase unchanged waits through 2, 3, then 5 minutes. Stay at 5 minutes at most. Reset to 1 minute for new work.

Check the chosen tool's support before using this rule. Use its built-in schedule controls. Check the actual returned state, interval, and target after a change. Save what was accepted. Do not claim a change from a request alone or edit saved scheduler config by hand.

If the tool cannot support this timing, tell C and agree on the supported timing or manual handoff. Do not create a duplicate schedule or second watcher as a workaround. Wakeups still use some tokens; small checks reduce repeated reading, not all wake costs.

Stay quiet during unchanged or non-actionable waits. Notify C on a meaningful change, goal completion, failure, or required human action. Save that notification intent in the wake instructions. Use a tool's notification setting where it offers one.

## 10. Other talk, scope changes, and pauses

C and A may keep discussing other work while approved tasks run. Link each new choice to the right goal and Directive. New talk does not silently change an in-flight task. Save a scope change and, when needed, issue a new unique task after the current work is safely settled.

A may make task and review choices within the agreed goal. Ask C when work needs wider scope, a new kind of access, an action outside the grant, or a choice only C can make. Save the blocker and stop dependent work.

When C pauses the schedule, pause the existing schedule through its built-in tool and check the returned state. Save the pause in both records. Do not poll, review, publish, or resume automatically after that pause. A schedule pause does not prove B or T stopped; record what is known and follow C's stated pause scope.

Resume only when C asks. Read saved state first. Reuse the existing schedule. If the chat changed, inspect and retarget it when supported. Check the actual returned target and state. Do not create a replacement schedule silently.

To finish, A checks the full goal's done checks against real evidence. Unmet required checks mean PARTIAL or BLOCKED, not full completion. Save the final review, stop the goal's schedule through its supported tool, check the result, and tell C what passed and what remains.

## 11. Handoff and recovery

Carry the project path, this protocol, goal record, current-state path, active Directive names, expected reports, last reviews, allowed scope, pauses, and wake references into the next chat.

On recovery, read current state and the needed goal history. Check live task states and lock ownership before acting. Keep old evidence. Never infer a task failed from silence, clear a lock by age, restart paused work, or publish a second copy of a tracked task.

## Maintenance

Update this file and `AGENTS.md` together when AGLP activation, roles, setup, naming, or loop rules change. A change to AGLP does not migrate an existing goal unless C agrees to that change for that goal.
