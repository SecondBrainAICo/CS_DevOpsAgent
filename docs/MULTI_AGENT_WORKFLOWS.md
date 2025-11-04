# Multi-Agent Workflows Guide

**DevOps Agent v2.0**

---

## Overview

Run multiple AI agents simultaneously on the same project without conflicts, leveraging isolated sessions and file coordination.

### Quick Facts

- **Multiple agents:** Claude, Cursor, Copilot, Cline, etc.
- **Isolated workspaces:** Each agent gets own worktree
- **File coordination:** Prevents conflicting edits
- **Automatic merging:** All changes converge to main branch

---

## Why Use Multiple Agents?

### Parallel Development

```
Agent 1 (Claude):  Implements authentication
Agent 2 (Cursor):  Builds API endpoints
Agent 3 (Copilot): Writes unit tests

All working simultaneously, no conflicts!
```

### Specialized Tasks

```
Frontend specialist: Claude works on React components
Backend specialist:  Cursor works on Node.js API
DevOps specialist:   Copilot writes Docker config
```

### Faster Delivery

- **3 agents = 3x throughput** (when properly coordinated)
- **No waiting:** Agents work in parallel
- **Clean merges:** Automated daily branch consolidation

---

## How It Works

### Architecture

```
Main Branch (main)
    ↓
Daily Branch (dev_abc_2025-10-31)
    ↓
Session Branches
    ├── session/implement-auth_abc1 (Agent 1: Claude)
    ├── session/build-api_xyz2 (Agent 2: Cursor)
    └── session/add-tests_def3 (Agent 3: Copilot)
```

### Workflow

1. **Create sessions** for each agent
2. **Assign tasks** (non-overlapping files ideal)
3. **Agents work** in isolated worktrees
4. **Automatic commits** and pushes
5. **Close sessions** when done
6. **Merge to daily branch** automatically
7. **Daily rollover** merges to main

---

## Basic Multi-Agent Workflow

### Step 1: Plan Task Distribution

**Before starting, decide:**
- Who works on which files?
- Any dependencies?
- Coordination points?

**Example plan:**
```
Task: Build authentication system

Agent 1 (Claude):
  - src/auth/login.js
  - src/auth/token.js
  
Agent 2 (Cursor):
  - src/api/auth-routes.js
  - src/middleware/auth.js

Agent 3 (Copilot):
  - tests/auth.test.js
  - docs/auth-api.md
```

### Step 2: Create Sessions

**Terminal 1 (Agent 1 - Claude):**
```bash
s9n-devops-agent start
# Choose: N) Create new session
# Task: implement-auth-core
# Agent: Claude
```

**Terminal 2 (Agent 2 - Cursor):**
```bash
s9n-devops-agent start
# Choose: N) Create new session
# Task: build-auth-api
# Agent: Cursor
```

**Terminal 3 (Agent 3 - Copilot):**
```bash
s9n-devops-agent start
# Choose: N) Create new session
# Task: write-auth-tests
# Agent: Copilot
```

### Step 3: Provide Instructions

**Each agent receives:**
- Session ID (e.g., `abc1-23d4`)
- Worktree path
- House rules
- **File declarations** (critical!)

### Step 4: Agents Work in Parallel

**Agent 1 workspace:**
```
local_deploy/worktrees/abc1-23d4/
├── src/auth/login.js       ← Working here
└── src/auth/token.js       ← And here
```

**Agent 2 workspace:**
```
local_deploy/worktrees/xyz5-67d8/
├── src/api/auth-routes.js  ← Working here
└── src/middleware/auth.js  ← And here
```

**Agent 3 workspace:**
```
local_deploy/worktrees/def9-01gh/
├── tests/auth.test.js      ← Working here
└── docs/auth-api.md        ← And here
```

**No conflicts!** Each agent in own workspace.

### Step 5: Close Sessions

**When each agent finishes:**
```bash
s9n-devops-agent close abc1-23d4  # Agent 1
s9n-devops-agent close xyz5-67d8  # Agent 2
s9n-devops-agent close def9-01gh  # Agent 3
```

**Automatic merge flow:**
```
session/implement-auth_abc1 → dev_abc_2025-10-31
session/build-auth-api_xyz5 → dev_abc_2025-10-31
session/write-auth-tests_def9 → dev_abc_2025-10-31
```

---

## Advanced Patterns

### Pattern 1: Sequential Handoff

**Use when:** Agent 2 depends on Agent 1's work

**Flow:**
```
1. Agent 1: Implements core auth logic → closes session
   ↓ (merges to daily branch)
2. Agent 2: Pulls daily branch → starts session → builds API
   ↓
3. Agent 3: Pulls daily branch → starts session → writes tests
```

**Commands:**
```bash
# Agent 1 finishes
s9n-devops-agent close abc1

# Agent 2 starts (on daily branch with Agent 1's work)
git checkout dev_abc_2025-10-31
s9n-devops-agent start
```

### Pattern 2: Concurrent + Coordination

**Use when:** Some files overlap, need coordination

**Setup:**
```
Agent 1: Works on src/auth/login.js
Agent 2: Wants to edit src/auth/login.js too

Coordination:
1. Agent 1 declares and locks login.js
2. Agent 2 sees lock, works on different file first
3. Agent 1 finishes, commits, closes → releases lock
4. Agent 2 declares login.js, continues work
```

**Commands:**
```bash
# Agent 1
cat .file-coordination/active-edits/claude-abc1.json
# Shows: "files": ["src/auth/login.js"]

# Agent 2 checks
ls .file-coordination/active-edits/
# Sees claude-abc1.json → knows login.js is locked

# Agent 2 works on different file, waits for Agent 1
```

### Pattern 3: Fan-Out / Fan-In

**Use when:** One agent creates foundation, many extend it

**Flow:**
```
Agent 1 (Foundation):
  Creates auth framework → closes session
  ↓
Agent 2, 3, 4 (Extensions):
  All pull foundation → create parallel sessions
  Agent 2: Add OAuth
  Agent 3: Add JWT
  Agent 4: Add 2FA
  ↓
All close → merge to daily branch
```

### Pattern 4: Review & Iterate

**Use when:** One agent reviews another's work

**Flow:**
```
1. Agent 1: Implements feature → commits → pauses (don't close!)
2. Agent 2 (Reviewer): Creates new session → reviews code
3. Agent 2: Adds comments, suggestions → closes session
4. Agent 1 (Resumes): Reviews feedback → makes changes → closes
```

**Commands:**
```bash
# Agent 1 pauses (session stays open)
# Just stops working, doesn't close

# Agent 2 reviews
s9n-devops-agent start
# Create new session
# Review Agent 1's worktree files
# Add review comments
s9n-devops-agent close xyz5

# Agent 1 resumes
cd local_deploy/worktrees/abc1-23d4
# Address feedback
# Commit changes
s9n-devops-agent close abc1
```

---

## File Coordination Strategies

### Strategy 1: File-Level Separation

**Best for:** Independent modules

**Example:**
```
Agent 1: src/auth/*
Agent 2: src/api/*
Agent 3: src/utils/*

Zero overlap → no coordination needed!
```

### Strategy 2: Feature-Level Separation

**Best for:** Full-stack features

**Example:**
```
Feature: User Profile

Agent 1 (Frontend):
  - src/components/UserProfile.jsx
  - src/styles/profile.css

Agent 2 (Backend):
  - src/api/user-routes.js
  - src/models/user.js

Agent 3 (Tests):
  - tests/profile.test.js
  - tests/user-api.test.js
```

### Strategy 3: Layer-Level Separation

**Best for:** Architectural layers

**Example:**
```
Agent 1 (Data layer):     src/models/*
Agent 2 (Business logic): src/services/*
Agent 3 (API layer):      src/api/*
Agent 4 (UI layer):       src/components/*
```

### Strategy 4: Time-Boxed Rotation

**Best for:** Overlapping needs

**Example:**
```
Time Block 1 (9am-11am):  Agent 1 works on shared file
Time Block 2 (11am-1pm):  Agent 2 works on shared file
Time Block 3 (1pm-3pm):   Agent 3 works on shared file

Coordination via time slots!
```

---

## Communication Between Agents

### Method 1: Commit Messages

**Agent 1 commits:**
```
feat(auth): implement login flow

- Added login.js with JWT token generation
- TODO: Agent 2, please add API endpoint at /api/login
- Auth logic returns { token, user }
```

**Agent 2 sees commit in daily branch:**
```bash
git log --oneline dev_abc_2025-10-31
# Reads Agent 1's TODO
# Implements /api/login endpoint
```

### Method 2: Code Comments

**Agent 1 leaves comment:**
```javascript
// src/auth/login.js

// @AGENT2: Please create API route handler that:
// 1. Accepts email + password
// 2. Calls this validateCredentials() function
// 3. Returns JWT token on success
export function validateCredentials(email, password) {
  // ...
}
```

**Agent 2 reads and implements:**
```javascript
// src/api/auth-routes.js

// @AGENT1: API route implemented as requested
app.post('/api/login', async (req, res) => {
  const { email, password } = req.body;
  const valid = await validateCredentials(email, password);
  // ...
});
```

### Method 3: Shared Documentation

**Create a coordination doc:**
```bash
# AGENT_COORDINATION.md

## Auth Feature - Agent Assignments

### Agent 1 (Claude) - Core Logic
Status: ✅ Complete
Files: src/auth/login.js, src/auth/token.js
Notes: JWT token generation ready

### Agent 2 (Cursor) - API Routes
Status: 🚧 In Progress
Files: src/api/auth-routes.js
Dependencies: Needs Agent 1's work (complete)
Next: Add /api/refresh endpoint

### Agent 3 (Copilot) - Tests
Status: ⏳ Waiting
Dependencies: Needs Agent 1 and 2 complete
Files: tests/auth.test.js
```

---

## Handling Conflicts

### Scenario: Unintended File Overlap

**What happened:**
```
Agent 1: Edited src/config.js (forgot to declare)
Agent 2: Edited src/config.js (declared properly)
Result: Conflict when merging!
```

**Resolution:**
```bash
# 1. Identify conflicting commits
git log --all --oneline --graph

# 2. Manual merge
git checkout dev_abc_2025-10-31
git merge session/task1_abc1
git merge session/task2_xyz5
# Resolve conflicts in src/config.js

# 3. Commit merge
git commit -m "fix: resolve config.js conflict between agents"
```

### Scenario: Race Condition

**What happened:**
```
Agent 1: Declares src/auth.js at 10:00:00
Agent 2: Declares src/auth.js at 10:00:01
Result: Conflict warning!
```

**Resolution:**
```bash
# System detects, warns Agent 2
# Agent 2 chooses:
# Option A: Work on different file
# Option B: Wait for Agent 1 to finish
# Option C: Coordinate to split the file
```

---

## Monitoring Multiple Agents

### Check Active Sessions

```bash
s9n-devops-agent list
```

**Output:**
```
Active Sessions:
1. abc1-23d4 (claude, implement-auth-core)
   Files: 2 locked
   Last activity: 2 minutes ago

2. xyz5-67d8 (cursor, build-auth-api)
   Files: 3 locked
   Last activity: 1 minute ago

3. def9-01gh (copilot, write-auth-tests)
   Files: 1 locked
   Last activity: 30 seconds ago
```

### Check File Locks

```bash
ls -la .file-coordination/active-edits/
```

**Output:**
```
claude-abc1-23d4.json
cursor-xyz5-67d8.json
copilot-def9-01gh.json
```

### Check Who's Editing What

```bash
cat .file-coordination/active-edits/*.json | jq '.files[]'
```

**Output:**
```
"src/auth/login.js"
"src/auth/token.js"
"src/api/auth-routes.js"
"src/middleware/auth.js"
"tests/auth.test.js"
```

---

## Best Practices

### 1. Plan Before Starting

- Map out file/feature assignments
- Identify dependencies
- Schedule coordination points

### 2. Clear Communication

- Use commit messages
- Leave code comments
- Update coordination docs

### 3. Declare Files Early

- Always declare before editing
- Update declarations when adding files
- Check for conflicts proactively

### 4. Close Sessions Promptly

- Don't leave sessions open overnight
- Release locks when done
- Merge work to daily branch regularly

### 5. Test Integrations

- When multiple agents finish, test together
- Run full test suite
- Verify no integration issues

---

## Troubleshooting

### Problem: Agents stepping on each other

**Solution:** Better file coordination
```bash
# Review declarations
cat .file-coordination/active-edits/*.json

# Ensure no overlaps
# Reassign files if needed
```

### Problem: Merge conflicts on close

**Solution:** Smaller, frequent merges
```bash
# Close sessions more frequently
# Merge to daily branch regularly
# Reduces conflict surface area
```

### Problem: Lost track of who's doing what

**Solution:** Session monitoring
```bash
# Check active sessions
s9n-devops-agent list

# Review coordination doc
cat AGENT_COORDINATION.md
```

---

## Example: 3-Agent Authentication Feature

### Setup

**Feature:** Complete authentication system  
**Agents:** Claude, Cursor, Copilot  
**Timeline:** 2 hours

### Distribution

```
Agent 1 (Claude) - Core Logic (45 min)
├── src/auth/login.js
├── src/auth/token.js
└── src/auth/validation.js

Agent 2 (Cursor) - API Layer (45 min)
├── src/api/auth-routes.js
├── src/middleware/auth.js
└── src/api/user-routes.js

Agent 3 (Copilot) - Tests & Docs (45 min)
├── tests/auth.test.js
├── tests/api.test.js
└── docs/AUTH_API.md
```

### Execution

**10:00 AM - All agents start**
```bash
# Terminal 1
s9n-devops-agent start  # Claude: implement-auth-core

# Terminal 2
s9n-devops-agent start  # Cursor: build-auth-api

# Terminal 3
s9n-devops-agent start  # Copilot: write-auth-tests
```

**10:45 AM - Agent 1 (Claude) finishes**
```bash
s9n-devops-agent close abc1-23d4
# Merges to: dev_abc_2025-10-31
```

**10:50 AM - Agent 2 (Cursor) finishes**
```bash
s9n-devops-agent close xyz5-67d8
# Merges to: dev_abc_2025-10-31
```

**11:00 AM - Agent 3 (Copilot) finishes**
```bash
s9n-devops-agent close def9-01gh
# Merges to: dev_abc_2025-10-31
```

**11:05 AM - Integration test**
```bash
git checkout dev_abc_2025-10-31
npm test
# All tests pass! ✅
```

**Result:** Complete auth system in 1 hour, 3 agents working in parallel!

---

## Summary

### Key Takeaways

1. **Multiple agents = parallel work** (when coordinated)
2. **File coordination prevents conflicts**
3. **Clear communication is critical**
4. **Plan distribution before starting**
5. **Close sessions promptly**

### Multi-Agent Flow

```
1. Plan task distribution (who does what?)
   ↓
2. Create sessions (one per agent)
   ↓
3. Agents work in parallel (isolated worktrees)
   ↓
4. Coordinate overlaps (file locks + communication)
   ↓
5. Close sessions (merge to daily branch)
   ↓
6. Integration test (verify all works together)
```

---

**Need Help?** Run `s9n-devops-agent help-topics` and select "Workflows"

**Related Guides:**
- File Coordination Guide
- Session Management Guide
- House Rules Guide
