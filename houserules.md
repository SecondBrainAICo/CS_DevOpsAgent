# House Rules for DevOps Agent

## Project Structure
**Current Directory Layout:**
```
DevOpsAgent/
├── src/                    # All source code
├── test_cases/            # All test files
├── test_scripts/          # Test execution scripts
├── docs/                  # Documentation
├── deploy_test/           # Deployment test scripts
├── local_deploy/          # Local-only files (gitignored) - ALL DEBUG/TEMP FILES GO HERE
└── product_requirement_docs/  # PRDs
```

### Important: Local-Only Files Policy

**ALL temporary, debug, and local-only files MUST be placed in `local_deploy/` folder**

This folder is gitignored and will never be uploaded to the repository. Use it for:
- Debug logs and output files
- Temporary test data
- Local configuration overrides
- Session logs and traces
- Performance profiling results
- Any files containing sensitive data
- Migration scripts for local use only
- Backup files before major changes
- **WORKTREES FOR DEVOPS AGENT'S OWN DEVELOPMENT**
- **SESSION DATA WHEN DOGFOODING THE AGENT**
- **ALL LOCKS AND COORDINATION FILES**

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

## Commit Policy

### 1. Single Commit Message File (`.claude-commit-msg`)

**Location**: Project root `.claude-commit-msg`  
**Action**: WRITE to this file (the DevOps agent will process it)  
**Format**:
```
type(scope): subject line describing the change (max 72 characters)

[WHY - 2 lines explaining the motivation/reason for these changes]
This change was needed because [specific problem or requirement].
[Additional context about why this approach was chosen].

[WHAT - Each item identifies files changed and what was done]
- File(s): path/to/file1.js, file2.js - Specific change made to these files
- File(s): src/module.js - Behavioral change or feature added
- File(s): docs/README.md, config.json - Related updates or side effects
```

**Commit Types**:
- `feat`: New feature or capability added
- `fix`: Bug fix or error correction
- `refactor`: Code restructuring without changing functionality
- `docs`: Documentation updates (README, comments, PRDs)
- `test`: Adding or modifying tests
- `chore`: Maintenance tasks (configs, dependencies, cleanup)

**Rules**:
- Always start with WHY (2 lines): Explain the problem/need that motivated these changes
- For each WHAT item: List the specific files changed, then describe what was done
- Format: "File(s): path/to/file.ext, other.ext - Description of changes"
- Group related file changes together in one bullet point
- Be specific about WHAT changed and WHERE (exact file paths)
- Describe the IMPACT of the change, not just what was done
- Never include bash commands or command-line syntax
- Never attempt to run git commands directly
- Keep the subject line under 72 characters
- Use present tense ("add" not "added", "fix" not "fixed")

**Example Commit Message**:
```
fix(worktree): resolve push-behind error in multi-agent scenarios

The DevOps agent was failing when multiple agents pushed to the same branch simultaneously.
This fix adds retry logic with pull-merge to handle the common "behind remote" scenario.

- File(s): src/cs-devops-agent-worker.js - Add retry logic with git pull --no-rebase on push failures
- File(s): src/utils.js, src/git-helpers.js - Extract common git operations into reusable helper functions  
- File(s): test_cases/worktree/20250929_push_behind_spec.js - Add test case for push-behind scenario
- File(s): docs/README.md - Document the new retry behavior and configuration options
```

### 2. Product Requirement Docs Updates

**When making code changes**: Also update relevant files in the `product_requirement_docs/` folder
- Keep PRDs in sync with implementation
- Document new features and their rationale
- Update affected system components

## Session Recovery and Context Persistence

### Crash Recovery System (temp_todo.md)

**Purpose**: Maintain session continuity across potential crashes or disconnections.

**Location**: `/temp_todo.md` (project root)

**When to Use**:
- Starting any multi-step task
- Before executing complex operations
- When debugging issues that may cause crashes
- Whenever working on tasks that modify multiple files

**Format**:
```markdown
# Current Session Context
Last Updated: YYYY-MM-DDTHH:MM:SSZ

## Task Overview
[Brief description of what the user asked for]

## Current Status
[What step we're on, what's completed, what's pending]

## Execution Plan
- [ ] Step 1: Description
- [x] Step 2: Description (completed)
- [ ] Step 3: Description (in progress)

## Relevant Context
- Key files being modified:
  - file1.js: [what changes]
  - file2.sh: [what changes]
- Important findings:
  - [Any discovered issues or insights]
- Dependencies/Requirements:
  - [Libraries, services needed]

## Current Working State
[Any variables, partial results, or important data to preserve]

## Next Steps
[What should happen next if session resumes]

## Error Log (if any)
[Any errors encountered and their resolution status]
```

**Recovery Process**:
When starting a new session:
1. Always check `temp_todo.md` first
2. If it contains data, ask user: "I found a previous session context. Should I continue where we left off?"
3. If continuing, resume from "Next Steps"
4. If not continuing, clear the file and start fresh

## Code Quality & Documentation Standards

### Module/File Headers
Every JavaScript file should start with a comprehensive header:
```javascript
/**
 * ============================================================================
 * MODULE NAME - Brief Description
 * ============================================================================
 * 
 * This module handles [main purpose]. It provides [key functionality].
 * 
 * Key Components:
 * - ComponentA: Does X
 * - ComponentB: Handles Y
 * 
 * Dependencies:
 * - External: library1, library2
 * - Internal: module.submodule
 * 
 * Usage Example:
 *   const { MainClass } = require('./this_module');
 *   const instance = new MainClass();
 *   const result = instance.process();
 * ============================================================================
 */
```

### Function/Method Comments
```javascript
/**
 * Execute a named operation with the provided input.
 * 
 * @param {string} operationName - Name of the operation to execute
 * @param {Object} input - Input data for the operation
 * @param {Object} [context={}] - Optional context for execution
 * @returns {Promise<Object>} Result object with status and output
 * @throws {Error} If operation fails or times out
 * 
 * @example
 * const result = await execute('process', { data: 'test' });
 * if (result.success) {
 *   console.log(result.output);
 * }
 */
```

### Inline Comments
```javascript
// Good inline comments explain WHY, not WHAT
const DEBOUNCE_MS = 3000;  // Longer delay for commit messages to ensure complete writes

// Document complex logic
if (retries > 0) {
  // Pull failed due to behind remote, retry with merge
  // This handles the common case where another agent pushed first
  execSync('git pull --no-rebase origin main');
}

// TODO/FIXME format
// TODO(username, 2025-09-29): Implement parallel worktree creation
// FIXME(username, 2025-09-29): Handle edge case when worktree already exists
```

## Testing Policy

### Core Testing Principles

**Location**: Put tests under `test_cases/<area>/<component>/`
- Example: `test_cases/cs-devops-agent/worker/`
- Example: `test_cases/worktree/manager/`

**Naming Convention**:
- Files: `YYYYMMDD_<short-slug>_spec.js`
- Example: `20250929_push_behind_spec.js`

**Test Structure**:
```javascript
/**
 * Test Case: <human title>
 * - Area: <domain area>
 * - Component: <component/module>
 * - Related Issue/PR: <#id or link>
 * - Repro Summary: <1-3 lines on steps/inputs>
 * - Expected Behavior: <what should happen>
 * - Regression Guard: <what would break if this fails again>
 */

describe('Feature Name', () => {
  beforeEach(() => {
    // Setup
  });

  it('should handle specific scenario', () => {
    // Arrange - set up test data
    const testData = { /* ... */ };
    
    // Act - perform the action
    const result = performAction(testData);
    
    // Assert - verify the result
    expect(result).toBe(expected);
  });
});
```

### Test Execution Strategy

**Run specific area tests**:
```bash
# Working on cs-devops-agent-worker.js?
npm test test_cases/cs-devops-agent/worker/

# Working on worktree management?
npm test test_cases/worktree/

# Just fixed a specific bug?
npm test test_cases/worktree/manager/20250929_detection_spec.js
```

### Bug Fix Test Process (MANDATORY)

1. **Create failing test FIRST (Red phase)**
2. **Fix the bug (Green phase)**
3. **Run area tests (Verification)**
4. **Run full suite only before commit**

## Multi-Agent Coordination

### Session Management

**Starting a new session**:
```bash
# Interactive session starter (recommended)
npm start
# or
./start-devops-session.sh
```

This will:
1. Ask if you want to use an existing session or create new
2. Generate instructions for Claude/Cline
3. Start the DevOps agent monitoring the appropriate worktree

### Worktree Organization

**Branch Naming**:
- Agent branches: `agent/<agent-name>/<task-name>`
- Daily branches: `dev_sdd_YYYY-MM-DD`
- Session branches: `<agent>/<session-id>/<task>`

**Session Files**:
- `.devops-session.json` - Session configuration
- `.devops-commit-<session-id>.msg` - Session-specific commit message file
- `SESSION_README.md` - Session documentation

### Multiple Claude/Cline Sessions

**Each session gets**:
- Unique session ID
- Dedicated worktree
- Own commit message file
- Isolated branch

**Coordination Files**:
- `.session-locks/` - Active session locks
- `.claude-sessions.json` - Session registry
- `.worktrees/` - Agent worktrees

## Environment Variables

### Core CS_DevOpsAgent Settings
```bash
AC_MSG_FILE=".claude-commit-msg"       # Commit message file
AC_BRANCH_PREFIX="dev_sdd_"           # Branch naming prefix
AC_PUSH=true                           # Auto-push after commit
AC_CLEAR_MSG_WHEN="push"              # When to clear message file
AC_MSG_DEBOUNCE_MS=3000               # Wait time after message change
```

### Session-Specific Variables
```bash
DEVOPS_SESSION_ID="abc-123"           # Current session ID
AGENT_NAME="claude"                    # Agent identifier
AGENT_WORKTREE="claude-abc-123-task"  # Worktree name
```

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

## Logging Policy

### Log File Location
**IMPORTANT: All log files MUST be written to `local_deploy/logs/` directory**

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

### What to Log
- Session creation/destruction
- Worktree operations
- Git operations (commits, pushes, pulls)
- Error conditions and recovery attempts
- Agent coordination events

### Log Rotation
- Keep logs in `local_deploy/logs/` organized by date
- Format: `devops-agent-YYYY-MM-DD.log`
- Never commit log files to git

### Security
**NEVER log**:
- API keys or tokens
- Full file contents (use hashes or excerpts)
- User credentials
- Sensitive configuration

## Common Workflows

### 1. Starting a New Development Session
```bash
npm start
# Select "N" for new session
# Enter task name
# Copy instructions to Claude/Cline
```

### 2. Handling Push-Behind Scenarios
The agent automatically:
1. Detects push failures
2. Pulls with --no-rebase to merge
3. Retries the push
4. Alerts on conflicts

### 3. Multiple Agent Coordination
```bash
# Terminal 1: Start agent for feature-auth
./start-devops-session.sh
# Creates session abc-123

# Terminal 2: Start agent for api-endpoints  
./start-devops-session.sh
# Creates session def-456

# Each Claude/Cline works in their respective worktree
```

## Review Cadence

- Review this file quarterly
- Update when adding major features
- Keep in sync with actual implementation
- Document lessons learned from production issues

## Additional Development Guidelines

### Error Handling

**Always provide meaningful error messages:**
```javascript
// Bad
if (!file) throw new Error('Error');

// Good
if (!file) {
  throw new Error(`File not found: ${filePath}. Ensure the file exists and you have read permissions.`);
}
```

**Use try-catch appropriately:**
```javascript
try {
  const result = await riskyOperation();
  return result;
} catch (error) {
  // Log the error with context
  console.error(`Failed to perform operation: ${error.message}`, {
    operation: 'riskyOperation',
    context: relevantContext
  });
  
  // Decide whether to recover or propagate
  if (canRecover(error)) {
    return fallbackValue;
  }
  throw error; // Re-throw if unrecoverable
}
```

### Code Organization

**Single Responsibility Principle:**
- Each function should do one thing well
- Each module should have a clear, focused purpose
- If a function is > 50 lines, consider breaking it down

**DRY (Don't Repeat Yourself):**
- Extract common logic into utility functions
- Use configuration objects for repeated patterns
- Create abstractions for repeated workflows

### Performance Considerations

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

### Security Best Practices

**Input Validation:**
```javascript
// Always validate and sanitize inputs
function processPath(userPath) {
  // Prevent directory traversal
  if (userPath.includes('../') || userPath.includes('..\\')) {
    throw new Error('Invalid path: directory traversal detected');
  }
  
  // Ensure path is within allowed directory
  const resolvedPath = path.resolve(userPath);
  if (!resolvedPath.startsWith(ALLOWED_BASE_PATH)) {
    throw new Error('Path outside allowed directory');
  }
  
  return resolvedPath;
}
```

**Command Injection Prevention:**
```javascript
// Never concatenate user input into shell commands
// Bad
execSync(`git checkout ${userBranch}`);

// Good - use array arguments
execSync('git', ['checkout', userBranch]);
```

### Git Workflow Best Practices

**Commit Guidelines:**
- Make atomic commits (one logical change per commit)
- Write clear, descriptive commit messages
- Reference issues/PRs when applicable
- Avoid committing commented-out code

**Branch Management:**
- Keep branches focused on single features/fixes
- Regularly sync with main branch
- Clean up merged branches
- Use meaningful branch names

### Documentation Requirements

**README Updates:**
- Update README when adding new features
- Include usage examples for new functionality
- Document breaking changes prominently
- Keep installation instructions current

**API Documentation:**
- Document all public functions/methods
- Include parameter types and return values
- Provide usage examples
- Note any side effects or prerequisites

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
