# Changelog

All notable changes to s9n-devops-agent are documented here.

This format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/), and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

## [1.7.2] - 2025-01-10

### 🔧 Fixed
- 🔢 **Version Display**: Fixed session-coordinator.js to show correct version (was showing 1.4.8)
- 📝 **README**: Updated header to reflect v1.7.2
- 📦 **Start Script**: Updated version banner to v1.7.2
- ✅ **Consistency**: All components now display matching version numbers

### 💡 Why
- User reported seeing v1.4.8 after updating to v1.7.1
- Old version number was hardcoded in session coordinator CLI banner
- Ensures users see correct version across all entry points

[Full diff →](https://github.com/SecondBrainAICo/CS_DevOpsAgent/compare/v1.7.1...v1.7.2)

---

## [1.7.1] - 2025-01-10

### ✨ Added
- 🔍 **Visible Update Check**: Shows "Checking for DevOps Agent updates..." message when checking npm registry
- ✅ **Up-to-Date Confirmation**: Displays confirmation message when version is current
- ✗ **Offline Handling**: Shows helpful message if update check fails due to network/npm issues

### 🔄 Changed
- Update check now provides transparent feedback instead of running silently
- Users can see when version check happens and its result

### 💡 Why
- Previously update check ran invisibly in background, causing confusion
- Users couldn't tell if check was happening or if they were up to date
- Better transparency builds trust and reduces support questions

[Full diff →](https://github.com/SecondBrainAICo/CS_DevOpsAgent/compare/v1.7.0...v1.7.1)

---

## [1.7.0] - 2025-01-10

### 🚨 CRITICAL FIX
- 🔒 **File Lock Timing**: Fixed critical race condition where locks were released after commit instead of after session close
- ⏱️ **Session-Lifetime Locks**: Locks now held for ENTIRE session until merge/worktree removal
- 🛑 **Stop-and-Ask Protocol**: Agents must explicitly request user permission to edit files locked by other agents
- 💥 **Prevents Merge Conflicts**: Eliminates race conditions where two agents edit same files in parallel sessions

### ✨ Added - Enhanced Branch Management
- 🔀 **Dual Merge Support**: Merges to both daily branch (`manus_MMDD_*`) and main branch
- 📅 **Weekly Consolidation**: Automatic weekly branch cleanup and consolidation
- 🧹 **Orphan Session Cleanup**: Detects and cleans up stale session branches
- 🌳 **Hierarchical Branching**: `session → daily → main` branch structure
- ✅ **Comprehensive Tests**: 7 automated test cases covering all merge scenarios
- 📊 **Enhanced Status Display**: Shows both daily and main merge status

### 🔄 Changed
- House rules updated to clarify file lock lifetime requirements
- Session close now releases locks only after successful merge
- Enhanced-close-session script handles dual merges automatically
- Documentation updated with lock timing best practices

### 🐛 Fixed
- Prevents overlapping edits when agents finish at different times
- Eliminates duplicate work from parallel edits to same files
- Removes race condition in file coordination system

### 💡 Why This Matters
- **Before**: Agent A finishes editing and releases locks → Agent B starts editing same files → Both conflict when merging
- **After**: Agent A holds locks until session merged → Agent B blocked from editing → Zero conflicts
- **Impact**: Enables true parallel multi-agent workflows without manual conflict resolution

### 📚 Documentation
- Updated README with session-lifetime lock behavior
- Added file coordination best practices
- Documented stop-and-ask protocol for conflict resolution
- Created comprehensive test results and analysis documents

[Full diff →](https://github.com/SecondBrainAICo/CS_DevOpsAgent/compare/v1.4.3...v1.7.0)

---

## [1.4.3] - 2025-10-08

### 🔧 Fixed
- 🔒 **Shared File Coordination**: Fixed file-coordination to use `local_deploy/.file-coordination/` instead of per-worktree coordination
- 🤝 **Multi-Agent Lock Visibility**: All agents now see each other's file locks across all worktrees
- 📍 **Repository Root Detection**: Added smart repo root detection that works from worktrees and submodules

### ✨ Added
- 🐋 **Docker Never Option**: Added "Never" option (Y/N/A/Never) to Docker configuration prompts
- 💾 **Persistent Docker Settings**: Docker preferences now saved to `local_deploy/project-settings.json` when using Always/Never
- 🔄 **Automatic Version Check**: Agent now checks npm registry for updates once per day
- 📦 **Update Notifications**: Shows available updates with install command when newer version exists
- 🗂️ **Project Cleanup**: Moved old houserules to `archive/` folder for cleaner root directory
- 📚 **Documentation Organization**: Moved `HOUSERULES_README.md` and `IMPLEMENTATION_SUMMARY.md` to `docs/` folder

### 🔄 Changed
- File coordination instructions now show full path to shared lock directory
- Docker prompt includes "Always" option to remember settings across sessions
- Version checking happens automatically on session creation (with 24-hour cooldown)
- Archive folder excluded from npm package

### 💡 Why
- **File Coordination Fix**: Previously each worktree had its own `.file-coordination/` folder, so agents couldn't see each other's locks. Moving to shared `local_deploy/.file-coordination/` ensures all agents coordinate properly.
- **Docker Settings**: Users were asked about Docker on every session. Now they can choose "Always" to configure once, or "Never" to stop being asked.
- **Version Checking**: Keeps users informed of updates without being intrusive (once per day check).
- **Project Organization**: Cleaner root directory makes it easier to understand project structure.

[Full diff →](https://github.com/SecondBrainAICo/CS_DevOpsAgent/compare/v1.4.2...v1.4.3)

---

## [1.4.2] - 2025-10-08

### 🔧 Fixed
- 🔧 **Comprehensive File Watcher Ignore Patterns**: Massively expanded ignored paths to prevent EMFILE (too many open files) errors
- 📁 **Database and Migrations**: Now ignores `migrations/` and `database/` folders which can contain thousands of files
- 🗄️ **Archived Worktrees**: Ignores `archived_*_worktree/` and `archived_*/**` patterns from DevOpsAgent
- 🐍 **Python Artifacts**: Added `.pytest_cache/`, `.mypy_cache/`, `*.egg-info/`, `*.pyo`, `*.pyd`
- 📦 **Additional Dependencies**: Added `bower_components/` ignore pattern
- 🏗️ **Build Artifacts**: Added `out/`, `.output/`, `public/build/` patterns
- 📊 **Test Coverage**: Added `.nyc_output/`, `htmlcov/`, `.coverage`, `lcov-report/`
- 💾 **Cache Directories**: Added `.parcel-cache/`, `.eslintcache`, `.stylelintcache`
- 🔒 **Lock Files**: Expanded to include `poetry.lock`, `Pipfile.lock`, `Gemfile.lock`, `composer.lock`
- 📝 **IDE Files**: Added `.fleet/`, `.vs/`, `*.swp`, `*.swo`, `*~`
- 🎬 **Media Files**: Ignores video and archive files (`.mp4`, `.avi`, `.mov`, `.pdf`, `.zip`, `.tar`, `.gz`, `.7z`)
- 🍎 **macOS Files**: Added `.Trashes`, `.Spotlight-V100`, `.fseventsd`, `Thumbs.db`
- 🔐 **Environment Files**: Added `.env.local`, `.env.*.local`

### 💡 Why
- Client environments with large `coverage/`, `database/`, `migrations/`, and archived worktree directories were hitting system file descriptor limits
- Chokidar was attempting to watch thousands of unnecessary files causing "EMFILE: too many open files" errors
- More comprehensive ignore patterns = better performance and stability across diverse project structures
- Prevents wasted resources watching files that should never trigger commits (lock files, cache, build artifacts, etc.)

[Full diff →](https://github.com/SecondBrainAICo/CS_DevOpsAgent/compare/v1.4.1...v1.4.2)

---

## [1.4.1] - 2025-10-08

### 🔧 Fixed
- 🔍 **Recursive Docker Compose Detection**: Enhanced to search subdirectories like `Infrastructure/docker/` up to 3 levels deep
- 📂 **Infrastructure Folder Support**: Now checks both `Infrastructure/` and `infrastructure/` at project root and parent directory
- 🔄 **Regex Matching**: Uses flexible pattern matching for `docker-compose*.yml/yaml` files
- 🚫 **Smart Directory Exclusion**: Avoids searching `node_modules`, `.git`, `dist`, `build` during recursive search
- 🔁 **Deduplication**: Prevents listing the same Docker compose file multiple times

### 🔄 Changed
- Added `searchDockerFilesRecursive()` helper function with depth limit and directory exclusions
- Updated `findDockerComposeFiles()` to include recursive search across multiple candidate directories

### 💡 Why
- Users were not able to detect Docker compose files nested in subdirectories like `Infrastructure/docker/`
- Previous detection only checked specific top-level files without recursive search
- Better Docker detection = better session setup experience

[Full diff →](https://github.com/SecondBrainAICo/CS_DevOpsAgent/compare/v1.4.0...v1.4.1)

---

## [1.4.0] - 2025-10-08

### ✨ Added
- 📋 **Interactive House Rules Setup**: First-time setup now prompts for folder structure preference
- 📁 **Folder Structure Choice**: Choose between structured (modular) or flexible organization
- 📄 **Template Files**: Automatically copies `houserules_core.md` or `houserules_structured.md` + `folders.md`
- 🏗️ **Infrastructure Template**: Auto-creates `infrastructure/infrastructure.md` with comprehensive template
- ♾️ **Always Auto-Merge**: New "Always" option (Y/N/A) saves auto-merge settings permanently
- 🤖 **24x7 Operation Support**: Settings persist across sessions for hands-off operation
- 📚 **Multiple House Rules Versions**: Core, structured, traditional, and improved variants
- 📖 **House Rules README**: Complete guide explaining different versions and use cases

### 🔄 Changed
- House rules setup now integrated into first session creation flow
- Auto-merge prompt enhanced with three options: Yes (session), No, Always (permanent)
- Settings saved to `local_deploy/project-settings.json` when Always selected
- Session coordinator checks for existing house rules before prompting
- House rules manager intelligently detects project root when running as submodule

### 💡 Why
- Users need flexibility to choose organizational style that fits their project
- 24x7 running agents require permanent settings to avoid repeated prompts
- Different projects have different needs (new vs existing, small vs large)
- Automatic infrastructure documentation prevents port conflicts and resource collisions
- Always option enables true hands-off operation with automatic daily rollover

[Full diff →](https://github.com/SecondBrainAICo/CS_DevOpsAgent/compare/v1.3.3...v1.4.0)

---

## Earlier Versions

For complete version history including versions 1.3.3 through 1.0.0, see the [full CHANGELOG.md](https://github.com/SecondBrainAICo/CS_DevOpsAgent/blob/main/CHANGELOG.md) on GitHub.

### Quick Links to Major Versions
- [1.3.3](https://github.com/SecondBrainAICo/CS_DevOpsAgent/releases/tag/v1.3.3) - Enhanced Docker Detection
- [1.3.0](https://github.com/SecondBrainAICo/CS_DevOpsAgent/releases/tag/v1.3.0) - File Coordination System
- [1.2.0](https://github.com/SecondBrainAICo/CS_DevOpsAgent/releases/tag/v1.2.0) - Docker Integration
- [1.1.0](https://github.com/SecondBrainAICo/CS_DevOpsAgent/releases/tag/v1.1.0) - Multi-Agent Support
- [1.0.0](https://github.com/SecondBrainAICo/CS_DevOpsAgent/releases/tag/v1.0.0) - Initial Release

---

[← Back to Home](Home)
