# DevOps Agent: Branch Management System

**Author:** Manus AI  
**Date:** October 10, 2025

This document provides comprehensive documentation for the enhanced branch management system in the DevOps Agent. It covers the architecture, configuration, and usage of the new features.

## 1. Introduction

The branch management system is designed to automate the lifecycle of branches, from individual work sessions to weekly consolidations. It prevents the proliferation of branches, ensures a clean and organized repository, and provides a clear history of all work done.

## 2. Branching Architecture

The system uses a hierarchical branching model:

- **Session Branches:** `session/<agent-name>/<task-id>`
  - Created for each work session.
  - Short-lived and merged upon session closure.
- **Daily Branches:** `daily/<YYYY-MM-DD>`
  - Consolidate work from multiple sessions for a single day.
  - Act as the default merge target if no other is specified.
- **Weekly Branches:** `weekly/<YYYY-MM-DD_to_YYYY-MM-DD>`
  - Consolidate daily branches from the past week.
  - Provide a stable weekly snapshot of work.
- **Target Branch:** (e.g., `main`, `develop`)
  - The primary line of development, configured by the user.

## 3. Configuration

All branch management settings are stored in `local_deploy/project-settings.json`. You can manage these settings using the `branch-config-manager.js` script.

### 3.1 Configuration Options

| Setting                               | Description                                                                 |
| ------------------------------------- | --------------------------------------------------------------------------- |
| `defaultMergeTarget`                  | The primary branch for merges (e.g., `main`).                               |
| `enableDualMerge`                     | If `true`, merges to both the daily and target branches.                    |
| `enableWeeklyConsolidation`           | If `true`, enables automated weekly rollup of daily branches.               |
| `orphanSessionThresholdDays`          | The number of days of inactivity before a session is considered orphaned.   |
| `mergeStrategy`                       | The order for dual merges (`hierarchical-first`, `target-first`, `parallel`). |
| `autoCleanupOrphans`                  | If `true`, automatically cleans up orphaned sessions without prompting.     |
| `weeklyCleanupDay`                    | The day of the week to run the weekly consolidation (`sunday`, `monday`, etc.). |
| `retainWeeklyBranches`                | The number of weekly branches to keep before cleaning up old ones.          |

### 3.2 Managing Configuration

You can use the `branch-config-manager.js` script to manage these settings:

```bash
# Display current settings
node src/branch-config-manager.js show

# Run the interactive configuration wizard
node src/branch-config-manager.js wizard

# Get a specific setting
node src/branch-config-manager.js get branchManagement.defaultMergeTarget

# Set a specific setting
node src/branch-config-manager.js set branchManagement.enableDualMerge true
```

## 4. Workflows

### 4.1 Closing a Session

When you close a session using `enhanced-close-session.js`, you will be prompted for an action:

- **Merge changes and cleanup:** Merges the session branch and cleans up all related files.
- **Keep session active, just cleanup worktree:** Removes the worktree but keeps the session branch and lock file.
- **Delete session and all changes:** Permanently deletes the session branch and all work.

If you choose to merge, the system will perform a single or dual merge based on your configuration.

### 4.2 Weekly Consolidation

This process runs automatically on the configured `weeklyCleanupDay`. It identifies all daily branches from the past week, merges them into a new weekly branch, and then deletes the daily branches.

You can also run this process manually:

```bash
node src/weekly-consolidator.js consolidate
```

### 4.3 Orphaned Session Cleanup

This process runs daily and identifies sessions that have been inactive for longer than the `orphanSessionThresholdDays`. It will then prompt you to clean them up.

You can also run this process manually:

```bash
node src/orphan-cleaner.js cleanup
```

## 5. Command-Line Interface (CLI)

- **`enhanced-close-session.js`**: Close and manage active sessions.
- **`weekly-consolidator.js`**: Consolidate daily branches into weekly branches.
- **`orphan-cleaner.js`**: Detect and clean up orphaned sessions.
- **`branch-config-manager.js`**: Manage all branch management settings.

