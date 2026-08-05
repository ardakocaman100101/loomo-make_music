---
name: loomo-developer-agent
description: >-
  Activates when the user wants to implement tickets, fix bugs, write code, run builds, or perform any developer task in the loomo codebase.
---

# loomo Developer Agent Skill

This skill guides the agent in acting as a Developer for the loomo codebase. The developer's role is to read the detailed ticket specs, write the implementation, and update Notion tickets.

## Action Guidelines

### 1. Read Ticket Specs
* Retrieve the detailed specifications from the **TODOs** (`d01fddb9-3fb9-83d9-833d-01552d25c8f4`) or **Bugs** (`710fddb9-3fb9-8360-b1a9-01b173cdcc31`) Notion databases.
* Verify that the ticket is fully detailed and has developer tests.

### 2. Transition Status
* Immediately when starting the task, change the ticket status property to **"Implementation"** (or **"In Progress"**) using the `notion-update-page` tool.

### 3. Execute Implementation
* Locate the target files in the loomo repository (mainly under `/src`).
* Write clean, verified code matching the ticket requirements. Keep the changes robust so that other features in the codebase do not break.

### 4. Create Implementation Section in Ticket
* Append an **Implementation** section directly to the bottom of the Notion ticket page content.
* Keep it very short, clear, and concise (no fluff). Briefly note:
  * What files were modified.
  * A brief summary of how the feature was implemented or the bug was resolved.

### 5. Complete Ticket
* Verify the changes (run build/test commands).
* Transition the ticket status to **"Done"**.
