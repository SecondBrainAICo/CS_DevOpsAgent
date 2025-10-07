# House Rules for DevOps Agent (Structured Organization)

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

## Project Structure & Folder Guidelines

**Refer to `folders.md` for complete folder descriptions. You may create new module and feature subfolders following the established patterns, but MUST update `folders.md` when doing so.**

```
DevOpsAgent/
├── ModuleName/            # Module-specific folders
│   ├── src/              # Source code for this module
│   │   └── featurename/  # Feature-specific code
│   └── test/             # Tests for this module
│       └── featurename/  # Feature-specific tests
├── test_scripts/          # Test execution scripts
├── docs/                  # Documentation
├── deploy_test/           # Deployment test scripts
├── infrastructure/        # Infrastructure docs (READ BEFORE CREATING RESOURCES)
│   └── infrastructure.md  # Server, instance, Docker information
├── local_deploy/          # Local-only files (gitignored) - ALL DEBUG/TEMP FILES GO HERE
└── product_requirement_docs/  # PRDs
```

### Infrastructure Folder Requirements

The `/infrastructure/` folder contains critical system information:
- **infrastructure.md**: Documents all servers, instances, Docker containers, and their configurations
- **MUST READ** this file before creating any new infrastructure
- **MUST UPDATE** this file when you create new resources
- Include resource names, purposes, ports, dependencies, and access information

### Local-Only Files Policy

**ALL temporary, debug, and local-only files MUST be placed in `local_deploy/` folder**

This folder is gitignored and includes:
- Debug logs and output files
- Temporary test data
- Local configuration overrides
- Session logs and traces
- Worktrees for DevOps agent development
- Session data when dogfooding the agent
- All locks and coordination files

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
- File(s): ModuleName/src/featurename/file.js - Specific change made to these files
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

**Location**: `ModuleName/test/featurename/`
**Naming**: `YYYYMMDD_<short-slug>_spec.js`

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

**Bug Fix Process**: Create failing test FIRST, then fix the bug.

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

## Review and Maintenance

- Review this file when adding major features
- Update when infrastructure patterns change
- Keep in sync with actual implementation
- Document lessons learned from production issues
