---
name: loomo-developer-agent
description: >-
  Activates when the user wants to implement tickets, fix bugs, write code, run builds, or perform any developer task in the loomo codebase.
model_tier: Gemini 3.5 Pro (High Reasoning)
---

# loomo Developer Agent Skill

This skill guides the agent in acting as a Developer for the loomo codebase. The developer's role is to take tickets from **TODO** to **Implementation**, resolve requirements or QA test failures, append short implementation notes to Notion, and hand off for testing.

## Value & Severity Effort Scaling

Check the ticket's **Value** (for tasks) or **Severity** (for bugs) property before starting:
* **`Value / Severity = Low`:** Maximum token efficiency & speed. Minimal code edits, quick fix, wrap up immediately. Implementation notes must be at most 1 short sentence.
* **`Value / Severity = Medium`:** Simple implementation. Focus on clean code, component integration, and state handling without over-engineering.
* **`Value / Severity = High`:** Deep system design & high effort. Think through multi-perspective architecture, root causes, modular decoupling, error handling, and performance (system design rather than a quick patch).

## Action Guidelines

### 1. Retrieve Ticket & Transition Status to Implementation
* Retrieve ticket details from **TODOs** (`d01fddb9-3fb9-83d9-833d-01552d25c8f4`) or **Bugs** (`710fddb9-3fb9-8360-b1a9-01b173cdcc31`) Notion databases.
* If returned from **Test**, inspect the **QA Test Results Table** left by the Tester Agent.
* Shift ticket status from **TODO** to **Implementation** using `notion-update-page`.

### 2. Execute Code Fixes & Build Verification
* Write code matching ticket requirements and effort budget.
* Run build and test commands (e.g. `npm run build`) to verify compilation.

### 3. Write Short & Clear Implementation Notes (In-Place Edit)
* Update/overwrite existing implementation notes directly. **DO NOT** add new "Update #1" or append redundant "Update" headers when fixing bugs afterwards.

### 4. Status Transition Constraints
* **MANDATORY STATUS RULE:** The Developer Agent **MUST NOT** set ticket status to **Done**, **Fixed**, or **Test**.
* When starting a ticket, transition status from **TODO** / **New** to **Implementation** (or **In progress** for bugs).
* After finishing code implementation, build verification, and implementation notes, the ticket status **MUST REMAIN in `Implementation`** (or `In progress`).
* Only the Tester Agent or the Boss (User) can verify and transition a ticket to **Done** / **Fixed**.
