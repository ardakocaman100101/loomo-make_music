# loomo Project Workspace Rules

This file defines the project-scoped instructions and context for Antigravity agents working on the **loomo** codebase and Notion integration.

## loomo Notion Workspace Mapping

When interacting with Notion for task management, bug tracking, roadmaps, or feature requests, use the following direct page and database IDs. Always prioritize using these specific endpoints.

### Root Page
* **loomo Root Dashboard:**
  * **URL:** `https://app.notion.com/p/22afddb93fb9820b962e81e87a752d7b`
  * **ID:** `22afddb9-3fb9-820b-962e-81e87a752d7b`

### Navigation & Sub-Pages
* **Features:**
  * **URL:** `https://app.notion.com/p/7c6fddb93fb983b6b5bf01c89cd09cec`
  * **ID:** `7c6fddb9-3fb9-83b6-b5bf-01c89cd09cec`
* **Bugs:**
  * **URL:** `https://app.notion.com/p/710fddb93fb98360b1a901b173cdcc31`
  * **ID:** `710fddb9-3fb9-8360-b1a9-01b173cdcc31`
* **Library:**
  * **URL:** `https://app.notion.com/p/cedfddb93fb9836a84f68140705b9b17`
  * **ID:** `cedfddb9-3fb9-836a-84f6-8140-705b9b17`
* **Databases Hub:**
  * **URL:** `https://app.notion.com/p/719fddb93fb9828194020145a1508fc9`
  * **ID:** `719fddb9-3fb9-8281-9402-0145a1508fc9`

### Databases
* **Product Roadmap:**
  * **URL:** `https://app.notion.com/p/1cffddb93fb98219911801e8f2b0bb3b`
  * **ID:** `1cffddb9-3fb9-8219-9118-01e8f2b0bb3b`
* **TODOs:**
  * **URL:** `https://app.notion.com/p/d01fddb93fb983d9833d01552d25c8f4`
  * **ID:** `d01fddb9-3fb9-83d9-833d-01552d25c8f4`
* **User Feedback:**
  * **URL:** `https://app.notion.com/p/220fddb93fb983c3913781d0d40b3d30`
  * **ID:** `220fddb9-3fb9-83c3-9137-81d0d40b3d30`

---

## Value & Severity Effort Scaling Rules for All Agents

All agents MUST adapt their thinking depth, token expenditure, and execution effort based on the ticket's **Value** property (for Tasks/Features) or **Severity** property (for Bugs):

1. **`Value = Low` or `Severity = Low` (Maximum Token Efficiency & Speed):**
   - Simple & easy tasks/bugs.
   - **PM:** Proactively ask targeted clarifying questions to the boss to eliminate ambiguity; keep requirements and test steps crisp and clear.
   - **Figma:** 1-2 sentence UI/layout or token adjustment note. Wrap up fast.
   - **Developer:** Minimal code edit, quick fix, wrap up immediately. Implementation notes must be at most 1 short sentence.
   - **Tester:** Fast check of primary target and immediate parent; audit core data count integrity; wrap up fast.

2. **`Value = Medium` or `Severity = Medium` (Balanced Integration & Proper Implementation):**
   - Standard tasks/bugs requiring proper attention to integration and clean implementation.
   - **PM:** Engage in back-and-forth clarifying Q&A with the boss on UX, edge cases, and interactions; write clear, concise requirements ensuring clean integration.
   - **Figma:** Clean component UI/UX specs, token mapping, layout structure, and essential interaction states.
   - **Developer:** Clean implementation focusing on proper component integration and state handling.
   - **Tester:** Query Gitlab Orbit for 1st and 2nd-degree dependents; standard browser test execution covering main flow, transitive views, and data inventory integrity (e.g. song counts, soundfont presence).

3. **`Value = High` or `Severity = High` (Deep Systemic Architecture & Thorough Testing):**
   - Critical system features / high-severity bugs requiring multi-perspective analysis and thorough execution.
   - **PM:** Deep back-and-forth collaboration with the boss covering product vision, user journey, architecture, and edge cases; write holistic requirements.
   - **Figma:** Comprehensive design architecture, responsive breakpoints, audio DAW aesthetic standards, micro-interactions, and accessibility.
   - **Developer:** Design carefully as a system architecture (not a quick patch), considering root causes, performance, error handling, and clean modularity.
   - **Tester:** Deep edge-case testing within full app context (track solos, loop bounds, audio context resume, MIDI inputs, visual state, data source schema & manifest integrity).

---

## Universal Ticket Writing Rules for All Agents

1. **Short But Clear:** Write all ticket content in short, clear, and direct sentences. Zero fluff.
2. **In-Place Edits (No Update Section Accumulation):** Do **NOT** append new "Update #1", "Update #2", or separate "Update" headers every time new info is added. Update existing sections directly in place.
3. **Context Alignment:** Keep loomo task updates, bug resolutions, and roadmaps aligned between the codebase and the corresponding Notion databases listed above.
4. **No External Workspaces:** Limit Notion read/write activities exclusively to the loomo project hierarchy mapped above.
5. **Pure Functional Framing & Concise Response:** The PM Agent must specify requirements purely from a product/UX perspective without code-level root cause leaks, and keep chat responses short—asking clarifying questions if needed or replying with a single clear sentence summary rather than re-stating full ticket contents.

---

## Universal Status Transition & Lifecycle Rules

1. **PM Agent:** Sets/maintains tickets in **`TODO`** (Features) or **`New`** (Bugs). Must NOT transition tickets to `Implementation`, `Test`, or `Done`.
2. **Developer Agent:** Transitions tickets from `TODO` / `New` to **`Implementation`** (or `In progress`). After writing code, running builds, and adding implementation notes, the ticket **MUST REMAIN in `Implementation` / `In progress`**. The Developer Agent **MUST NEVER** set ticket status to **`Done`**, **`Fixed`**, or **`Test`**.
3. **Tester Agent:** Transitions tickets from `Implementation` to **`Test`** when starting QA. If all tests pass, leaves in `Test` (or user marks `Done` / `Fixed`). If any test fails, transitions status back to `Implementation`.
4. **Done / Fixed Status:** `Done` and `Fixed` are reserved exclusively for post-QA signoff or the Boss (User). Developer agents never complete tickets as `Done` or `Fixed`.
