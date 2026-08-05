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

## Agent Instructions for loomo Development

1. **Context Alignment:**
   Keep loomo task updates, bug resolutions, and roadmaps aligned between the codebase and the corresponding Notion databases listed above.
2. **Ticket Referencing:**
   When completing a task or fixing a bug, retrieve it from the **TODOs** or **Bugs** databases and update its status appropriately via the `notion-update-page` tool.
3. **No External Workspaces:**
   Limit Notion read/write activities exclusively to the loomo project hierarchy mapped above. Do not reference, search, or write to databases outside of this structure.
