# File Coordination Guide

**DevOps Agent v2.0**

---

## Overview

File coordination prevents multiple AI agents from editing the same files simultaneously, avoiding conflicts and data loss.

### Quick Facts

- **Purpose:** Prevent concurrent file modifications
- **Mechanism:** JSON-based file locking
- **Scope:** Per-session file declarations
- **Release:** Automatic on session close

---

## How It Works

### The Problem

Without coordination:
```
Agent 1: Edits src/auth.js
Agent 2: Edits src/auth.js (at the same time)
Result: Conflicting changes, merge headaches
```

###With Coordination:
```
Agent 1: Declares src/auth.js → Gets lock
Agent 2: Tries to declare src/auth.js → Blocked, gets warning
Result: Clean, sequential work
```

---

## File Declaration Format

### Location

Each agent creates a declaration file:
```
.file-coordination/active-edits/<agent>-<session-id>.json
```

### Structure

```json
{
  "agent": "claude",
  "session": "abc1-23d4",
  "files": [
    "src/auth/login.js",
    "src/auth/token.js",
    "src/utils/validation.js"
  ],
  "operation": "edit",
  "reason": "implement-authentication",
  "declaredAt": "2025-10-31T12:00:00.000Z"
}
```

### Fields Explained

| Field | Purpose | Example |
|-------|---------|---------|
| `agent` | AI agent type | `claude`, `cursor`, `copilot` |
| `session` | Session identifier | `abc1-23d4` |
| `files` | Array of file paths | `["src/auth.js"]` |
| `operation` | What you're doing | `edit`, `create`, `delete` |
| `reason` | Why (task name) | `implement-auth` |
| `declaredAt` | Timestamp (ISO 8601) | `2025-10-31T12:00:00.000Z` |

---

## Step-by-Step Usage

### 1. Before Editing Any File

**MANDATORY**: Declare files first!

```bash
# Agent creates/updates declaration file
cat > .file-coordination/active-edits/claude-abc1.json << 'EOF'
{
  "agent": "claude",
  "session": "abc1-23d4",
  "files": ["src/auth/login.js"],
  "operation": "edit",
  "reason": "add-authentication",
  "declaredAt": "2025-10-31T12:00:00.000Z"
}
EOF
```

### 2. Check for Conflicts

The system automatically checks for conflicts. If another agent already locked a file:

**Warning displayed:**
```
⚠ Conflict detected!
File: src/auth/login.js
Locked by: cursor (session: xyz5-67d8)
Reason: refactor-authentication

Action: Ask user which agent should proceed
```

### 3. Make Your Changes

Once files are declared (and no conflicts), edit freely:

```bash
# Now safe to edit
vim src/auth/login.js
```

### 4. Release Locks (On Session Close)

When closing your session:

```bash
s9n-devops-agent close abc1-23d4
```

**Automatic cleanup:**
- Removes `.file-coordination/active-edits/claude-abc1.json`
- Releases all locked files
- Merges changes to daily branch

---

## Multi-File Declarations

### Adding More Files

Update your declaration file to include additional files:

```json
{
  "agent": "claude",
  "session": "abc1-23d4",
  "files": [
    "src/auth/login.js",
    "src/auth/token.js",      ← Added
    "src/utils/validation.js"  ← Added
  ],
  "operation": "edit",
  "reason": "implement-authentication",
  "declaredAt": "2025-10-31T12:15:00.000Z"
}
```

### Removing Files

If you're done with a file, remove it from the array:

```json
{
  "files": [
    "src/auth/token.js"  ← login.js removed, now available
  ]
}
```

---

## Conflict Resolution

### Scenario: Two Agents Need Same File

**Agent 1 (Claude):**
```json
{
  "agent": "claude",
  "session": "abc1-23d4",
  "files": ["src/auth.js"],
  "declaredAt": "2025-10-31T10:00:00Z"
}
```

**Agent 2 (Cursor) tries:**
```json
{
  "agent": "cursor",
  "session": "xyz5-67d8",
  "files": ["src/auth.js"],  ← CONFLICT!
  "declaredAt": "2025-10-31T10:05:00Z"
}
```

### Resolution Options

#### Option 1: Wait for Agent 1
```bash
# Agent 2 waits until Agent 1 finishes and closes session
# Then declares and proceeds
```

#### Option 2: Coordinate Different Files
```bash
# Agent 1: Works on src/auth/login.js
# Agent 2: Works on src/auth/token.js
# No overlap, no conflict
```

#### Option 3: Sequential Work
```bash
# Agent 1: Completes work, commits, closes session
# Agent 2: Starts new session, declares files, proceeds
```

#### Option 4: Override (Dangerous!)
```bash
# User manually removes Agent 1's lock (emergency only)
rm .file-coordination/active-edits/claude-abc1.json

# Agent 2 can now declare
# ⚠️ Risk: Agent 1's uncommitted changes may be lost
```

---

## Best Practices

### 1. Declare Early, Declare All

```bash
# ✅ Good: Declare all files upfront
{
  "files": [
    "src/auth/login.js",
    "src/auth/token.js",
    "src/auth/validation.js"
  ]
}

# ❌ Bad: Declare one, edit three
{
  "files": ["src/auth/login.js"]
}
# Then editing token.js and validation.js without declaring
```

### 2. Use Specific Paths

```bash
# ✅ Good: Specific files
"files": ["src/auth/login.js", "src/auth/token.js"]

# ❌ Bad: Wildcards (not supported)
"files": ["src/auth/*.js"]

# ❌ Bad: Directories (declare files, not dirs)
"files": ["src/auth/"]
```

### 3. Update Declarations

```bash
# If you realize you need another file:
# 1. Update your declaration JSON
# 2. Check for conflicts on the new file
# 3. If clear, proceed
```

### 4. Release Promptly

```bash
# Don't keep sessions open indefinitely
# Close when done to release locks for others

s9n-devops-agent close abc1-23d4
```

---

## Troubleshooting

### Problem: "File already locked" error

**Cause:** Another agent declared the file first

**Solution:**
1. Check active declarations:
   ```bash
   ls -la .file-coordination/active-edits/
   cat .file-coordination/active-edits/*.json
   ```

2. Identify the locking agent and session
3. Coordinate with that agent's user
4. Wait or work on different files

### Problem: Stale lock (agent crashed)

**Cause:** Session closed improperly, lock file remains

**Solution:**
```bash
# List all locks
ls .file-coordination/active-edits/

# Check if session is actually active
s9n-devops-agent list

# If session not in list, safe to remove lock
rm .file-coordination/active-edits/claude-abc1.json
```

### Problem: Forgot to declare file before editing

**Cause:** Edited file without declaring it first

**Solution:**
1. **Immediately declare** the file (retroactively)
2. Check if anyone else declared it meanwhile
3. If conflict, coordinate resolution
4. Commit your changes ASAP
5. Close session to release lock

**Prevention:** Always declare before editing!

### Problem: Need to edit same file as another agent

**Cause:** Legitimate need for both agents to work on same file

**Solutions:**
1. **Sequential:** Agent 1 finishes → commits → closes → Agent 2 starts
2. **Split work:** Divide file into sections, each agent works on different functions
3. **Different files:** Agent 1 works on login.js, Agent 2 on token.js
4. **Manual merge:** Both work, manually merge changes later (advanced)

---

## Advanced Scenarios

### Scenario: Partial File Lock

**Want:** Lock only specific functions in a large file

**Reality:** File coordination locks entire files

**Workaround:**
1. Refactor: Split large file into smaller files
2. Each agent locks their target files
3. Cleaner, more manageable

### Scenario: Read-Only Access

**Want:** Agent 1 writes, Agent 2 reads (no lock needed for reading)

**Solution:**
```json
{
  "operation": "read",  ← Read-only, doesn't lock
  "files": ["src/config.js"]
}
```

**Note:** Reading doesn't require locks, but declaring helps track dependencies.

### Scenario: Emergency Override

**When:** Production issue, need immediate access

**Steps:**
1. **Communicate:** Notify other agent's user
2. **Backup:** Copy current state
3. **Remove lock:** `rm .file-coordination/active-edits/agent-session.json`
4. **Declare:** Your agent declares the file
5. **Work fast:** Minimize overlap window
6. **Coordinate merge:** Manually merge any parallel changes

---

## Directory Structure

```
.file-coordination/
├── active-edits/
│   ├── claude-abc1-23d4.json       # Claude's session abc1-23d4
│   ├── cursor-xyz5-67d8.json       # Cursor's session xyz5-67d8
│   └── copilot-def9-01gh.json      # Copilot's session def9-01gh
└── history/
    ├── claude-abc1-23d4-closed.json
    └── cursor-xyz5-67d8-closed.json
```

### Files Explained

- **active-edits/**: Current active file locks
- **history/**: Archived locks from closed sessions (for audit)

---

## Integration with Sessions

### Session Creation

1. Session created: `abc1-23d4`
2. Worktree created: `local_deploy/worktrees/abc1-23d4/`
3. Declaration file ready: `.file-coordination/active-edits/claude-abc1.json`

### During Session

1. Agent declares files in declaration JSON
2. Makes changes in worktree
3. Commits with `.devops-commit-abc1.msg`
4. Auto-push to GitHub

### Session Close

1. All changes committed and pushed
2. Declaration file moved to history/
3. Locks released
4. Worktree merged to daily branch
5. Worktree removed

---

## FAQ

**Q: Do I need to declare config files?**  
A: Yes, if you're editing them. Read-only doesn't require locks.

**Q: Can I declare files retroactively?**  
A: Yes, but risky. Better to declare before editing.

**Q: What if two agents declare simultaneously?**  
A: System detects conflict when second agent tries to declare. First declarer wins.

**Q: Can I lock an entire directory?**  
A: No. Declare individual files. Use wildcards in your local script, but declaration must list specific files.

**Q: How long do locks last?**  
A: Until session closes. Close sessions promptly!

**Q: Can I transfer a lock to another agent?**  
A: No. Close current session (releases lock), then new agent creates session and declares.

---

## Summary

### Key Takeaways

1. **Always declare files before editing**
2. **Check for conflicts** (.file-coordination/active-edits/)
3. **Update declarations** when adding files
4. **Release locks** by closing sessions promptly
5. **Coordinate** with other agents when conflicts arise

### File Coordination Flow

```
1. Start session
   ↓
2. Declare files (.file-coordination/active-edits/<agent>-<session>.json)
   ↓
3. Check conflicts (system alerts if any)
   ↓
4. Edit files (safe, locks held)
   ↓
5. Commit changes (.devops-commit-<session>.msg)
   ↓
6. Close session (releases locks, merges)
```

---

**Need Help?** Run `s9n-devops-agent help-topics` and select "File Coordination"

**Related Guides:**
- Session Management Guide
- Multi-Agent Workflows
- House Rules Guide
