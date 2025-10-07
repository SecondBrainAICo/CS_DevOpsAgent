# House Rules for DevOps Agent

## 🚨 CRITICAL: File Coordination & Infrastructure Protocol (MUST FOLLOW)

**To prevent conflicts with other agents and maintain infrastructure integrity, you MUST follow this protocol:**

### Before Editing ANY Files or Creating Infrastructure:

1. **DECLARE YOUR INTENT FIRST**
   Create a file at `.file-coordination/active-edits/<your-name>-<session>.json` with:
   ```json
   {
     "agent": "<your-name>",
     "session": "<session-id>",
     "files": ["list", "of", "files", "you", "will", "edit"],
     "operation": "edit",
     "reason": "Brief description of what you're doing",
     "declaredAt": "<current-ISO-8601-timestamp>",
     "estimatedDuration": 300
   }
   ```

2. **READ INFRASTRUCTURE DOCUMENTATION**
   - **MUST** read `/infrastructure/infrastructure.md` before creating any servers, instances, or Docker containers
   - This file contains all existing infrastructure details and prevents conflicts
   - Update this file when you create new infrastructure resources

3. **CHECK FOR CONFLICTS**
   - Read ALL files in `.file-coordination/active-edits/`
   - If ANY other agent has declared the same files, you must WAIT or choose different files

4. **ONLY EDIT DECLARED FILES**
   - Never edit files you haven't declared
   - Stay within your declared scope

5. **RELEASE WHEN DONE**
   - Delete your declaration file after completing edits
   - Update `/infrastructure/infrastructure.md` if you created infrastructure

## Essential Folder Requirements

### Infrastructure Documentation
- `/infrastructure/infrastructure.md` - **MUST READ** before creating any infrastructure resources
- Contains all servers, instances, Docker containers, and their configurations
- **MUST UPDATE** when you create new resources

### Local Development Files
- `/local_deploy/` - **(Gitignored)** ALL temporary, debug, and local-only files MUST go here
- This includes: debug logs, session data, worktrees, coordination files, temporary test data
- Never commit files from this folder to git

### Development vs Production Usage

**When developing DevOpsAgent itself (dogfooding):**
- All worktrees go in: `local_deploy/worktrees/`
- All session locks go in: `local_deploy/session-locks/`
- All instructions go in: `local_deploy/instructions/`
- All session data go in: `local_deploy/sessions/`
- This keeps the main repo clean while we develop

**When DevOpsAgent is used on OTHER projects (production):**
- It will create `.worktrees/` in the target project
- It will create `.session-locks/` in the target project
- Those folders should be added to the target project's .gitignore

**Examples:**
```bash
# Good - files in local_deploy/ won't be committed
local_deploy/debug.log
local_deploy/session-traces/
local_deploy/temp-test-data.json
local_deploy/performance-profile.txt
local_deploy/migration-backup/

# Bad - these would be tracked by git
./debug.log
./temp-data.json
./test-output.txt
```

## Session Recovery System (`temp_todo.md`)

**Purpose**: Maintain session continuity across crashes or disconnections.
**Location**: `/temp_todo.md` (project root)

**Format**:
```markdown
# Current Session Context
Last Updated: YYYY-MM-DDTHH:MM:SSZ

## Task Overview
[Brief description of what the user asked for]

## Current Status
[What step we're on, what's completed, what's pending]

## Infrastructure Context
[Any infrastructure being created/modified]

## Execution Plan
- [ ] Step 1: Description
- [x] Step 2: Description (completed)
- [ ] Step 3: Description (in progress)

## Next Steps
[What should happen next if session resumes]
```

## Commit Policy

### Single Commit Message File (`.claude-commit-msg`)

**Location**: Project root `.claude-commit-msg`  
**Format**:
```
type(scope): subject line describing the change (max 72 characters)

[WHY - 2 lines explaining the motivation/reason for these changes]
This change was needed because [specific problem or requirement].
[Additional context about why this approach was chosen].

[WHAT - Each item identifies files changed and what was done]
- File(s): path/to/file1.js, file2.js - Specific change made to these files
- File(s): infrastructure/infrastructure.md - Updated with new server configuration
- File(s): docs/README.md - Related documentation updates
```

**Commit Types**:
- `feat`: New feature or capability
- `fix`: Bug fix or error correction
- `refactor`: Code restructuring without changing functionality
- `docs`: Documentation updates
- `test`: Adding or modifying tests
- `chore`: Maintenance tasks
- `infra`: Infrastructure changes (servers, Docker, deployment)

### Infrastructure Change Requirements

When making infrastructure changes, your commit MUST:
- Use `infra` type in commit message
- Update `/infrastructure/infrastructure.md` with new resources
- Document resource purpose, configuration, and dependencies
- Include rollback instructions if applicable

## Code Quality Standards

### File Headers
```javascript
/**
 * MODULE NAME - Brief Description
 * 
 * This module handles [main purpose]. Key components:
 * - ComponentA: Does X
 * - ComponentB: Handles Y
 * 
 * Dependencies: library1, module.submodule
 */
```

### Function Comments
```javascript
/**
 * Execute a named operation with the provided input.
 * 
 * @param {string} operationName - Name of operation
 * @param {Object} input - Input data
 * @returns {Promise<Object>} Result with status and output
 * @throws {Error} If operation fails
 */
```

### Error Handling
- Provide meaningful error messages with context
- Use try-catch for risky operations
- Log errors with relevant context
- Never concatenate user input into shell commands

## Testing Policy

**Bug Fix Process**: Create failing test FIRST, then fix the bug.

**Test Structure**:
```javascript
/**
 * Test Case: <human title>
 * - Area: <domain area>
 * - Component: <component/module>
 * - Expected Behavior: <what should happen>
 */
describe('Feature Name', () => {
  it('should handle specific scenario', () => {
    // Arrange, Act, Assert
  });
});
```

## Multi-Agent Coordination

### Session Management
- Use `npm start` or `./start-devops-session.sh` to create sessions
- Each session gets unique ID, dedicated worktree, and isolated branch
- Session files stored in `local_deploy/sessions/`

### Worktree Organization
- Agent branches: `agent/<agent-name>/<task-name>`
- Session branches: `<agent>/<session-id>/<task>`
- Coordination files in `.session-locks/` and `.agent-sessions.json`

## Environment Variables

### Core Settings
```bash
AC_MSG_FILE=".claude-commit-msg"       # Commit message file
AC_BRANCH_PREFIX="dev_sdd_"           # Branch naming prefix
AC_PUSH=true                           # Auto-push after commit
AC_CLEAR_MSG_WHEN="push"              # When to clear message file
```

### Session-Specific
```bash
DEVOPS_SESSION_ID="abc-123"           # Current session ID
AGENT_NAME="claude"                    # Agent identifier
AGENT_WORKTREE="claude-abc-123-task"  # Worktree name
```

## Logging Policy

### Log File Location
**All log files MUST be written to `local_deploy/logs/` directory**

```javascript
const LOG_DIR = './local_deploy/logs';
const LOG_FILE = `${LOG_DIR}/devops-agent-${new Date().toISOString().split('T')[0]}.log`;

// Ensure log directory exists
if (!fs.existsSync(LOG_DIR)) {
  fs.mkdirSync(LOG_DIR, { recursive: true });
}
```

### Log Levels
```javascript
const log = (...args) => {
  const message = `[cs-devops-agent] ${args.join(' ')}`;
  console.log(message);
  // Also write to file in local_deploy
  appendToLogFile(message);
};

const dlog = (...args) => {
  if (DEBUG) {
    const message = `[debug] ${args.join(' ')}`;
    console.log(message);
    appendToLogFile(message);
  }
};

function appendToLogFile(message) {
  const timestamp = new Date().toISOString();
  fs.appendFileSync(LOG_FILE, `${timestamp} ${message}\n`);
}
```

### Log Rotation
- Keep logs in `local_deploy/logs/` organized by date
- Format: `devops-agent-YYYY-MM-DD.log`
- Never commit log files to git

### What to Log
- Session creation/destruction
- Worktree operations
- Git operations (commits, pushes, pulls)
- Infrastructure changes
- Error conditions and recovery attempts
- Agent coordination events

### Security - NEVER Log
- API keys or tokens
- Full file contents
- User credentials
- Sensitive configuration

## Infrastructure Management

### Before Creating Resources

1. **Read Current State**: Always read `/infrastructure/infrastructure.md` first
2. **Check for Conflicts**: Ensure no port conflicts or naming collisions
3. **Plan Integration**: Consider how new resources integrate with existing ones

### Documentation Requirements

When creating infrastructure, document in `/infrastructure/infrastructure.md`:
- **Resource Name**: Clear, descriptive name
- **Type**: Server, container, service, etc.
- **Purpose**: What this resource does
- **Configuration**: Ports, environment variables, volumes
- **Dependencies**: What other resources it needs
- **Access Information**: How to connect or manage it
- **Rollback Plan**: How to safely remove if needed

### Infrastructure Change Process

1. Read `/infrastructure/infrastructure.md`
2. Declare intent in file coordination
3. Create/modify infrastructure
4. Update `/infrastructure/infrastructure.md`
5. Test the changes
6. Commit with `infra` type

## Security Best Practices

### Input Validation
```javascript
function processPath(userPath) {
  if (userPath.includes('../')) {
    throw new Error('Invalid path: directory traversal detected');
  }
  return path.resolve(userPath);
}
```

### Command Safety
```javascript
// Good - use array arguments
execSync('git', ['checkout', userBranch]);

// Bad - concatenation allows injection
execSync(`git checkout ${userBranch}`);
```

## Common Workflows

### Starting New Development Session
```bash
npm start
# Select "N" for new session
# Enter task name
# Agent creates worktree and begins monitoring
```

### Handling Infrastructure Changes
1. Check existing infrastructure documentation
2. Plan changes to avoid conflicts
3. Create resources with proper naming
4. Update documentation immediately
5. Test integration with existing systems

### Push-Behind Recovery
The agent automatically:
1. Detects push failures
2. Pulls with --no-rebase to merge
3. Retries the push
4. Alerts on conflicts

## Review and Maintenance

- Review this file when adding major features
- Update when infrastructure patterns change
- Keep in sync with actual implementation
- Document lessons learned from production issues


## File Paths and References

### Path Formatting Rules
- Use relative paths for files in same/sub/parent directories
- Use absolute paths for system files or files outside working tree
- Examples:
  - Same directory: `main.js`, `config.yaml`
  - Subdirectory: `src/worker.js`, `test_cases/unit/test.js`
  - Parent directory: `../package.json`, `../../Makefile`
  - Absolute: `/etc/hosts`, `/usr/local/bin/node`

### Code Block Formatting
```javascript path=/absolute/path/to/file.js start=10
// Real code from actual file
```

```javascript path=null start=null
// Example or hypothetical code
```

## Performance Considerations

**File System Operations:**
```javascript
// Use async operations for better performance
const fs = require('fs').promises;

// Good - non-blocking
const data = await fs.readFile(path, 'utf8');

// Avoid - blocking
const data = fs.readFileSync(path, 'utf8');
```

**Git Operations:**
- Batch operations when possible
- Use `--no-pager` for git commands to avoid hanging
- Implement retry logic for network-dependent operations

## Additional Development Guidelines

### Debugging Helpers

**Debug Mode:**
```javascript
// Use environment variable for debug output
const DEBUG = process.env.DEBUG === 'true';
const DEBUG_FILE = process.env.DEBUG_FILE || './local_deploy/debug.log';

function debugLog(...args) {
  if (DEBUG) {
    const timestamp = new Date().toISOString();
    const message = `[DEBUG] ${timestamp} ${args.join(' ')}`;
    console.log(message);
    
    // Also write to debug file in local_deploy
    if (DEBUG_FILE) {
      fs.appendFileSync(DEBUG_FILE, message + '\n');
    }
  }
}
```

**Debug Output Location:**
- All debug files MUST be written to `local_deploy/` directory
- Never write debug output to the project root or src directories
- Example: `local_deploy/debug-${Date.now()}.log`

**Performance Timing:**
```javascript
function timeOperation(name, fn) {
  const start = Date.now();
  const result = fn();
  const duration = Date.now() - start;
  console.log(`[PERF] ${name} took ${duration}ms`);
  return result;
}
```

### Dependency Management

**Package.json Best Practices:**
- Use exact versions for critical dependencies
- Document why each dependency is needed
- Regularly audit for security vulnerabilities
- Keep dependencies up to date

**Import Organization:**
```javascript
// Group imports logically
// 1. Node built-ins
import fs from 'fs';
import path from 'path';

// 2. External dependencies
import express from 'express';
import lodash from 'lodash';

// 3. Internal modules
import { config } from './config';
import { utils } from './utils';
```

### Code Review Checklist

Before committing, verify:
- [ ] Tests pass
- [ ] No console.log() left in production code
- [ ] Error handling is comprehensive
- [ ] Documentation is updated
- [ ] Code follows project style guide
- [ ] No sensitive data in code or comments
- [ ] Performance impact considered
- [ ] Security implications reviewed

### Communication with Users

**Progress Updates:**
- Provide clear status updates for long-running operations
- Use spinners or progress bars where appropriate
- Estimate completion time when possible

**Error Communication:**
- Explain what went wrong in user-friendly terms
- Suggest potential fixes or workarounds
- Provide links to documentation when relevant
- Include error codes for support reference
