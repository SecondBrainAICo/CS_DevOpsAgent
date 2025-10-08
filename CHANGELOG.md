# Changelog

All notable changes to s9n-devops-agent will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.4.2] - 2025-10-08

### Fixed
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

### Why
- Client environments with large `coverage/`, `database/`, `migrations/`, and archived worktree directories were hitting system file descriptor limits
- Chokidar was attempting to watch thousands of unnecessary files causing "EMFILE: too many open files" errors
- More comprehensive ignore patterns = better performance and stability across diverse project structures
- Prevents wasted resources watching files that should never trigger commits (lock files, cache, build artifacts, etc.)

## [1.4.1] - 2025-10-08

### Fixed
- 🔍 **Recursive Docker Compose Detection**: Enhanced to search subdirectories like `Infrastructure/docker/` up to 3 levels deep
- 📂 **Infrastructure Folder Support**: Now checks both `Infrastructure/` and `infrastructure/` at project root and parent directory
- 🔄 **Regex Matching**: Uses flexible pattern matching for `docker-compose*.yml/yaml` files
- 🚫 **Smart Directory Exclusion**: Avoids searching `node_modules`, `.git`, `dist`, `build` during recursive search
- 🔁 **Deduplication**: Prevents listing the same Docker compose file multiple times

### Changed
- Added `searchDockerFilesRecursive()` helper function with depth limit and directory exclusions
- Updated `findDockerComposeFiles()` to include recursive search across multiple candidate directories

### Why
- Users were not able to detect Docker compose files nested in subdirectories like `Infrastructure/docker/`
- Previous detection only checked specific top-level files without recursive search
- Better Docker detection = better session setup experience

## [1.4.0] - 2025-10-08

### Added
- 📋 **Interactive House Rules Setup**: First-time setup now prompts for folder structure preference
- 📁 **Folder Structure Choice**: Choose between structured (modular) or flexible organization
- 📄 **Template Files**: Automatically copies `houserules_core.md` or `houserules_structured.md` + `folders.md`
- 🏗️ **Infrastructure Template**: Auto-creates `infrastructure/infrastructure.md` with comprehensive template
- ♾️ **Always Auto-Merge**: New "Always" option (Y/N/A) saves auto-merge settings permanently
- 🤖 **24x7 Operation Support**: Settings persist across sessions for hands-off operation
- 📚 **Multiple House Rules Versions**: Core, structured, traditional, and improved variants
- 📖 **House Rules README**: Complete guide explaining different versions and use cases

### Changed
- House rules setup now integrated into first session creation flow
- Auto-merge prompt enhanced with three options: Yes (session), No, Always (permanent)
- Settings saved to `local_deploy/project-settings.json` when Always selected
- Session coordinator checks for existing house rules before prompting
- House rules manager intelligently detects project root when running as submodule

### Why
- Users need flexibility to choose organizational style that fits their project
- 24x7 running agents require permanent settings to avoid repeated prompts
- Different projects have different needs (new vs existing, small vs large)
- Automatic infrastructure documentation prevents port conflicts and resource collisions
- Always option enables true hands-off operation with automatic daily rollover

## [1.3.3] - 2025-10-03

### Added
- 🐋 **Enhanced Docker Detection**: Now searches parent directory and parent/Infrastructure folder for docker-compose files
- 💬 **User Prompting**: When no Docker config found, prompts user to manually specify docker-compose file path
- 📍 **Location Labels**: Shows where each docker-compose file was found (project/parent/Infrastructure)

### Changed
- `findDockerComposeFiles()` now searches multiple locations for better multi-repo support
- Session coordinator provides helpful guidance when Docker config not auto-detected
- Supports common multi-repo patterns (frontend/backend with shared networking)

### Why
- Multi-repo projects often keep docker-compose at parent level for container networking
- Enables single compose file to orchestrate multiple related projects
- Better user experience with clear prompts instead of silent failures

## [1.3.2] - 2025-10-02

### Changed
- 🎯 **Improved User Experience**: Changed "Instructions for Claude/Cline" to "Instructions for Your Coding Agent" for broader compatibility
- ⏱️ **Better Instruction Flow**: Moved copy-paste instructions to appear AFTER agent initialization and interactive commands  
- 🔍 **House Rules Search**: Enhanced to search repository-wide, excluding DevOpsAgent directories
- 📁 **Backup Organization**: House rules backups now stored in `DevopsAgent_Backups/` folder
- 🏠 **Parent Directory Detection**: Improved detection when running as submodule in `Scripts_Dev` or similar directories

### Fixed
- 🔧 House rules manager now correctly finds parent project's house rules when running as submodule
- 📊 CLI output now returns clean JSON for status commands
- ⏰ Instructions display timing for better user experience
- 🚫 Prevents using DevOpsAgent's own template house rules file

## [1.3.1] - 2025-10-02

### Added
- 🧪 Comprehensive file locking demonstration test (`test-file-locking.sh`)
- 📁 Better script organization - coordination scripts moved to `scripts/coordination/`
- 🔒 Visual demonstration of how file locking prevents conflicts between agents

### Changed  
- 📦 Improved commit message format in house rules (includes WHY and file tracking)
- 🔧 Coordination scripts now handle empty directories correctly
- 🎨 Enhanced test output with color-coded results and clear explanations

### Fixed
- 🐛 Fixed glob expansion issues when no JSON files exist in coordination directories
- 🔍 Fixed false positive conflicts in empty active-edits directory
- ✅ All coordination scripts now properly handle edge cases

### Removed
- 🧹 Cleaned up coordination alert files from repository (now properly git-ignored)
- 🗑️ Removed unnecessary test branches and worktrees

## [1.3.0] - 2025-09-30

### Added
- 🟧 Real-time undeclared edit detection with orange alerts
- 🔴 File conflict detection with red alerts for actual conflicts  
- 📋 Copy-paste instructions for correcting agent behavior
- ⚡ 2-second detection interval for near-instant feedback
- 🔒 File-level advisory locks to prevent simultaneous edits
- Enhanced file monitor (`file-monitor-enhanced.cjs`) for real-time detection
- File coordinator (`file-coordinator.cjs`) for managing declarations and conflicts
- Setup script for file coordination system (`setup-file-coordination.sh`)
- Helper scripts: `check-file-availability.sh`, `declare-file-edits.sh`, `release-file-edits.sh`
- Comprehensive test suite for coordination system (`test-file-coordination.sh`)
- Updated house rules with mandatory file coordination protocol
- Session coordinator now includes coordination instructions for agents

### Changed
- House rules now include file coordination protocol at the top
- Session setup instructions now include file declaration requirements
- Alert colors: Orange for undeclared edits, Red for actual conflicts
- Module files renamed to `.cjs` extension for CommonJS compatibility

### Fixed
- Multiple agents can now work safely without file conflicts
- Reduced merge conflicts through proactive coordination
- Prevention of wasted work from simultaneous edits

## [1.2.0] - 2025-09-30

### Added
- Automatic Docker container restart after push
- Docker utilities module for container management
- Session-level Docker configuration options
- Support for docker-compose v1 and v2
- Configurable container rebuild on restart
- Service-specific restart capability
- Non-blocking Docker operations (failures don't affect git workflow)

### Changed
- Session coordinator now detects docker-compose files automatically
- Session creation prompts for Docker restart preferences when compose files detected

## [1.1.0] - 2025-09-30

### Added
- Dynamic agent name display in instructions based on selected AI agent
- Comprehensive repository cloning instructions in README
- Quick Links section in README with repository, NPM, and documentation links
- Publishing guide (PUBLISHING.md) with detailed NPM publishing instructions
- Support for multiple AI development agents (Claude, Cursor, Cline, GitHub Copilot, etc.)

### Changed
- Package renamed from `cs-devops-agent` to `s9n-devops-agent`
- Instructions now agent-agnostic - adapts to any AI development agent
- Improved documentation with clearer installation options
- Updated all references from "Claude/Cline" to generic "AI Development Agent"
- Shell script now extracts and displays actual agent type from session data

### Fixed
- Instructions now properly capitalize agent names
- Session manager displays appropriate agent name instead of hard-coded "Claude"

## [1.0.0] - 2025-09-29

### Initial Release
- Multi-agent support for concurrent development sessions
- Git worktree management for isolated workspaces
- Automatic commit and push functionality
- Session management with create, list, and close operations
- VS Code integration
- Daily version rollover with customizable increments
- Smart branching with configurable naming patterns
- Interactive session manager UI
- Support for Claude, GitHub Copilot, Cursor, and other AI assistants
- Comprehensive test suite
- Binary build support for multiple platforms

[1.4.2]: https://github.com/SecondBrainAICo/CS_DevOpsAgent/compare/v1.4.1...v1.4.2
[1.4.1]: https://github.com/SecondBrainAICo/CS_DevOpsAgent/compare/v1.4.0...v1.4.1
[1.4.0]: https://github.com/SecondBrainAICo/CS_DevOpsAgent/compare/v1.3.3...v1.4.0
[1.3.3]: https://github.com/SecondBrainAICo/CS_DevOpsAgent/compare/v1.3.2...v1.3.3
[1.3.2]: https://github.com/SecondBrainAICo/CS_DevOpsAgent/compare/v1.3.1...v1.3.2
[1.3.1]: https://github.com/SecondBrainAICo/CS_DevOpsAgent/compare/v1.3.0...v1.3.1
[1.3.0]: https://github.com/SecondBrainAICo/CS_DevOpsAgent/compare/v1.2.0...v1.3.0
[1.2.0]: https://github.com/SecondBrainAICo/CS_DevOpsAgent/compare/v1.1.0...v1.2.0
[1.1.0]: https://github.com/SecondBrainAICo/CS_DevOpsAgent/compare/v1.0.0...v1.1.0
[1.0.0]: https://github.com/SecondBrainAICo/CS_DevOpsAgent/releases/tag/v1.0.0
