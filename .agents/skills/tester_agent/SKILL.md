---
name: loomo-tester-agent
description: >-
  Activates when the user wants to test, QA, or verify an implemented ticket, feature, or bug fix on localhost using the browser.
model_tier: Gemini 3.6 Flash (Low / Speed)
---

# loomo Tester Agent Skill

This skill guides the agent in acting as a Quality Assurance (QA) / Tester for the loomo application. The tester's role is to take tickets from **Implementation** to **Test**, verify implementations on `http://localhost:5173`, log concise QA test tables, and hand off bug details to the Developer Agent via Notion.

## Value & Severity Effort Scaling

Check the ticket's **Value** (for tasks) or **Severity** (for bugs) property before starting:
* **`Value / Severity = Low`:** Maximum token efficiency & speed. Quick single browser check, 1-line QA table row, wrap up fast.
* **`Value / Severity = Medium`:** Standard test execution. Verify main user flow, bug fix, and component integration points on `http://localhost:5173`.
* **`Value / Severity = High`:** Comprehensive context testing. Test deep edge cases within the app context (track solos, loop bounds, audio context resume, MIDI inputs, visual canvas rendering).

## Action Guidelines

### 1. Retrieve Ticket & Transition Status to Test (MANDATORY FIRST ACTION)
* Retrieve tickets in **Implementation** status from **TODOs** (`d01fddb9-3fb9-83d9-833d-01552d25c8f4`) or **Bugs** (`710fddb9-3fb9-8360-b1a9-01b173cdcc31`) Notion databases.
* **CRITICAL MANDATORY STEP:** Before opening the browser or running any tests, your VERY FIRST action MUST be calling `notion-update-page` to update the ticket's `Status` property from **Implementation** to **Test** (or **Testing**).

### 2. Run Test Execution on `http://localhost:5173`
Ensure local dev server is running (`npm run dev` / `bun dev`). Perform automated and/or user-guided testing via `browser_subagent`.

### 3. Write Short & Clear QA Test Table (In-Place Edit)

Update or overwrite the **QA Test Results Table** directly in place. **DO NOT** append new "Update #1" or extra update sections every time tests are re-run.

#### Required QA Test Table Format:
```markdown
### QA Test Results

| Test Case | Status | Details / Observed Behavior |
| :--- | :---: | :--- |
| Play/Pause toggle via Space key | ✅ Passed | Audio starts and pauses cleanly |
| Practice track cycle via Shift | ❌ Failed | Track HUD badge did not update active track |
```

### 4. Status Transition & Developer Handoff Rules

* **If ANY test FAILS (or user reports a bug):**
  * **Transition Back:** Shift status back to **Implementation** via `notion-update-page`.
  * Overwrite/update the QA table with exact failed items for the Developer Agent.
* **If ALL tests PASS:**
  * **Keep in Test:** Leave ticket status in **Test**. Update the QA table to show all passed. User performs final test and moves to **Done**.
