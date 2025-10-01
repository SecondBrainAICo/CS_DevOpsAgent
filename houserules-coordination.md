# House Rules: Multi-Agent File Coordination

## 🎯 Core Principle
**NO TWO AGENTS MAY EDIT THE SAME FILE SIMULTANEOUSLY**

## 📋 Coordination Options (Choose One)

### Option 1: Pre-Edit Declaration (RECOMMENDED)
**Simple, AI-friendly, no OS dependencies**

Before editing any files, agents MUST:

1. **Check availability** first:
   ```bash
   ./check-file-availability.sh src/file1.js src/file2.js
   ```
   
2. **Declare intent** if files are available:
   ```bash
   ./declare-file-edits.sh <agent-name> <session-id> src/file1.js src/file2.js
   ```

3. **Make edits** only to declared files

4. **Release files** when done:
   ```bash
   ./release-file-edits.sh <agent-name> <session-id>
   ```

#### For AI Agents (Claude, Copilot, etc.)
```markdown
Before editing files:
1. Write to `.file-coordination/active-edits/<agent>-<session>.json`:
   - List all files you plan to edit
   - Include operation type and reason
2. Check no other agent has those files in their active-edits
3. Proceed only if files are unclaimed
4. Remove your declaration when done
```

### Option 2: File System Locking (macOS/Linux)
**OS-level enforcement, but platform-specific**

```bash
# Lock a file before editing
flock -n /tmp/myfile.lock -c "edit_file.sh"

# Or use lockfile command
lockfile -r 0 src/file.js.lock || exit 1
# ... edit file ...
rm -f src/file.js.lock
```

### Option 3: Git Worktree Isolation (CURRENT)
**Each agent in separate worktree, merge conflicts later**

- Each session gets unique worktree
- No immediate conflicts
- Conflicts resolved at merge time
- Good for independent features

### Option 4: Watchdog Pattern
**DevOps agent monitors and blocks**

The DevOps agent:
1. Watches `.pending-edits/` directory
2. Agents write intended edits there first
3. DevOps agent checks for conflicts
4. Moves to `.approved-edits/` or `.blocked-edits/`
5. Agent proceeds only if approved

### Option 5: Database/Redis Locking
**Centralized, scalable, requires infrastructure**

```bash
# Using Redis
redis-cli SET "lock:src/file.js" "agent-1" NX EX 300
# Returns OK if lock acquired, nil if already locked
```

## 📝 Implementation Examples

### For Coding Agents (Add to Agent Instructions)

```markdown
## File Coordination Protocol

You MUST follow this protocol to prevent conflicts with other agents:

### Before Making Any Code Changes:

1. First, create a declaration file:
   ```json
   // Write to: .file-coordination/active-edits/claude-<timestamp>.json
   {
     "agent": "claude",
     "session": "<session-id>",
     "files": ["src/main.js", "src/utils.js"],
     "operation": "edit",
     "reason": "Adding authentication feature",
     "declaredAt": "<current-time>",
     "estimatedDuration": 300
   }
   ```

2. Check for conflicts:
   - Read all files in `.file-coordination/active-edits/`
   - Ensure none of your files appear in other declarations
   - If conflict found, wait or choose different files

3. Only proceed if no conflicts exist

4. After completing edits:
   - Move your declaration to `.file-coordination/completed-edits/`
   - Or delete it entirely
```

### For DevOps Agent Enhancement

```javascript
// Add to cs-devops-agent-worker.js

class FileCoordinator {
  constructor(sessionId) {
    this.sessionId = sessionId;
    this.coordDir = '.file-coordination';
    this.activeEdits = `${this.coordDir}/active-edits`;
  }

  async checkFileAvailability(files) {
    const blocked = [];
    const declarations = await this.readActiveDeclarations();
    
    for (const file of files) {
      for (const [agent, decl] of Object.entries(declarations)) {
        if (agent !== this.sessionId && decl.files.includes(file)) {
          blocked.push({ file, blockedBy: agent });
        }
      }
    }
    
    return { available: blocked.length === 0, blocked };
  }

  async declareFiles(files) {
    const declaration = {
      agent: 'devops-agent',
      session: this.sessionId,
      files,
      operation: 'commit',
      declaredAt: new Date().toISOString(),
      estimatedDuration: 60
    };
    
    await fs.writeFile(
      `${this.activeEdits}/devops-${this.sessionId}.json`,
      JSON.stringify(declaration, null, 2)
    );
  }

  async trackActualChanges(changedFiles) {
    // Add files that were actually changed
    const declFile = `${this.activeEdits}/devops-${this.sessionId}.json`;
    if (fs.existsSync(declFile)) {
      const decl = JSON.parse(fs.readFileSync(declFile));
      decl.actualFiles = changedFiles;
      decl.completedAt = new Date().toISOString();
      fs.writeFileSync(declFile, JSON.stringify(decl, null, 2));
    }
  }
}
```

## 🚦 Conflict Resolution Strategies

### When Conflicts Occur:

1. **Wait and Retry**
   - Check every 30 seconds
   - Maximum wait: 5 minutes
   - Then escalate

2. **Alternative Files**
   - Edit related but non-conflicting files
   - Come back to blocked files later

3. **Branch Strategy**
   - Create feature branch for your changes
   - Let Git handle merging

4. **Priority System**
   - Higher priority agents get preference
   - Lower priority agents wait or switch tasks

## 🔍 Monitoring Commands

```bash
# See who's editing what
ls -la .file-coordination/active-edits/

# Check specific file
grep -l "\"src/main.js\"" .file-coordination/active-edits/*.json

# View agent's current edits
cat .file-coordination/active-edits/claude-*.json

# Clean up stale locks (older than 1 hour)
find .file-coordination/active-edits -mmin +60 -delete
```

## ⚠️ Important Rules

1. **Never bypass the coordination system**
2. **Always release files when done**
3. **Don't edit files outside your declaration**
4. **Respect blocked files - wait or choose others**
5. **Clean up your declarations**

## 📊 Metrics to Track

- Conflict frequency
- Average wait times
- Most contested files
- Agent cooperation score

## 🔧 Troubleshooting

### Stale Locks
```bash
# Remove locks older than 1 hour
find .file-coordination/active-edits -name "*.json" -mmin +60 -delete
```

### Deadlocks
```bash
# Clear all locks (emergency only)
rm -rf .file-coordination/active-edits/*
```

### Audit Trail
```bash
# See edit history
ls -la .file-coordination/completed-edits/
```

## 🎯 Best Practices

1. **Small, focused edits** - Declare fewer files
2. **Quick releases** - Don't hold locks unnecessarily  
3. **Clear reasons** - Help others understand your intent
4. **Check before declaring** - Reduce conflicts
5. **Communicate via declarations** - Use the reason field

---

## Quick Start

1. Run setup:
   ```bash
   ./scripts/setup-file-coordination.sh
   ```

2. Test the system:
   ```bash
   # Terminal 1 - Agent 1
   ./declare-file-edits.sh agent1 sess1 src/main.js
   
   # Terminal 2 - Agent 2 (will be blocked)
   ./check-file-availability.sh src/main.js
   ```

3. Add to your agent prompts:
   > "Before editing files, you must declare them using the file coordination system..."

---

**Remember: Coordination prevents conflicts, conflicts waste time!**