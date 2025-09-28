# Claude House Rules for AutoCommit

## Testing Policy (Required)

Goal: Every bug fix and feature ships with an executable test.

Location: test_cases/<area>/<component>/.

DoD: (1) failing test reproduces bug (red), (2) fix makes it pass (green), (3) tests wired into CI and local runner.

Naming: YYYYMMDD_<short-slug>_spec.(py|ts|js|go|rb|java)

Non-duplication: Extend existing tests for the same bug.

Determinism: No flaky/random tests; use seeds and fake timers.

## Test Generation Rules (for Claude / code assistants)

Always write the failing test first.

Infer <area>/<component> from changed paths.

Stub external services; avoid real I/O unless explicitly needed.

Use native runners per language (pytest, vitest/jest, go test, rspec, JUnit).

Add short "why it failed before the fix" note in the test.

## Test Case Template
```
# Test Case: <human title>
- Area: <e.g., worktree>
- Component: <e.g., manager>
- Related Issue/PR: <#id or link>
- Repro Summary: <steps/inputs>
- Expected Behavior: <should happen>
- Regression Guard: <what breaks if it fails again>
```

<code block with the actual test file content>

## Partial Test Execution (Targeted Runs)

By default, local runs and CI only execute tests for changed areas (files in the PR/branch).

Areas are inferred from changed file paths and mapped to test_cases/<area>/<component> directories.

If we can't infer a mapping, we fallback to full suite.

You can override the scope:

scripts/run-tests --all → full suite

scripts/run-tests --changed → only changed areas (default)

scripts/run-tests test_cases/<area>/<component> → specific folder

## Logging Policy

All test scripts log with UTC timestamps, levels (INFO/WARN/ERROR/DEBUG), and grouping for CI.

Set LOG_LEVEL to debug|info|warn|error (default info).

Enable deep tracing with TRACE=1 (verbose commands, environment, and selection decisions).

## Auto-Run on Bugfix Workflow

If the current branch name or latest commit message contains fix: or bug:, targeted tests for the affected areas run first; if they pass, we run the rest of that language's suite.

CI blocks merge if: tests fail or a bugfix PR lacks an associated test.

## Code Style Guidelines for AutoCommit

### Comment Style
- Use descriptive header comments for major sections
- Include purpose and key features at the top of files
- Document complex logic inline
- Keep comments concise but informative

### Module Structure
- Group related functionality together
- Use clear section separators
- Export modules properly for reuse
- Maintain consistent naming conventions

### Error Handling
- Always handle errors gracefully
- Log errors with appropriate levels
- Provide useful error messages
- Clean up resources on failure

### Worktree Management Specifics
- Always check if running in AutoCommit repo itself
- Detect agent from environment variables
- Create isolated worktrees per agent
- Maintain agent configuration files
- Handle branch naming consistently

## Usage Examples

Run only changed areas (default):
```bash
scripts/run-tests --changed
```

Force full suite:
```bash
scripts/run-tests --all
```

Force a folder (e.g., during triage):
```bash
scripts/run-tests test_cases/worktree/manager
```

Increase logs:
```bash
LOG_LEVEL=debug scripts/run-tests --changed
TRACE=1 scripts/run-tests --changed
```

## Infrastructure Documentation Policy (NEW)

### Purpose
Track all infrastructure changes in a centralized location for team visibility and compliance.

### Location
`/Documentation/infrastructure.md` - Created automatically if it doesn't exist.

### What to Document
- **Configuration Changes**: Environment variables, settings files, config updates
- **Dependency Updates**: New packages, version changes, removals
- **Build System Changes**: Scripts, build configs, CI/CD updates
- **Architecture Changes**: New services, components, integrations
- **Database Changes**: Schema updates, migrations, indexes
- **API Changes**: Endpoints, authentication, rate limits
- **Security Changes**: Auth updates, certificates, permissions

### Format
```markdown
## [Date] - [Agent/Developer Name]
### Category: [Config|Dependencies|Build|Architecture|Database|API|Security]
**Change Type**: [Added|Modified|Removed|Fixed]
**Component**: [Affected component/service]
**Description**: Brief description of the change
**Reason**: Why this change was necessary
**Impact**: Potential impacts or considerations
**Files Changed**: 
- file1.js
- config/settings.json
```

### Auto-Detection Rules
1. Monitor for changes in:
   - `package.json`, `package-lock.json`
   - `.env`, `.env.*` files
   - `*config*.js`, `*config*.json`
   - `Dockerfile`, `docker-compose.yml`
   - `.github/workflows/*`
   - Database migration files
   - API route definitions

2. Auto-generate entry when detected
3. Include in commit message: `infra:` prefix when infrastructure changes detected

### Commit Message Enhancement
When infrastructure changes are detected:
```
infra(category): description

- Updated /Documentation/infrastructure.md
- [List of infrastructure changes]
```

Example:
```
infra(deps): add worktree management dependencies

- Updated /Documentation/infrastructure.md
- Added chokidar@3.5.3 for file watching
- Added execa@6.1.0 for process management
- Modified package.json scripts
```

## Environment Variables for Worktree Management

- `AGENT_NAME` or `AI_AGENT`: Identifies the AI agent
- `AGENT_TASK` or `AI_TASK`: Task or feature being worked on
- `AC_USE_WORKTREE`: Enable/disable worktree creation (true/false/auto)
- `AC_MSG_FILE`: Path to agent-specific commit message file
- `AC_BRANCH_PREFIX`: Prefix for agent branches
- `AC_TRACK_INFRA`: Enable infrastructure tracking (default: true)
- `AC_INFRA_DOC_PATH`: Path to infrastructure doc (default: /Documentation/infrastructure.md)
