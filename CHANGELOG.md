# Changelog

All notable changes to s9n-devops-agent will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

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

[1.2.0]: https://github.com/SecondBrainAICo/CS_DevOpsAgent/compare/v1.1.0...v1.2.0
[1.1.0]: https://github.com/SecondBrainAICo/CS_DevOpsAgent/compare/v1.0.0...v1.1.0
[1.0.0]: https://github.com/SecondBrainAICo/CS_DevOpsAgent/releases/tag/v1.0.0