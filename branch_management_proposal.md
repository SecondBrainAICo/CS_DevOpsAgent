# DevOps Agent Branch Management System: Architecture and Workflow

This document outlines a comprehensive branch management system for the DevOps Agent, designed to prevent branch proliferation, automate cleanup, and provide a clear, scalable workflow for parallel development sessions.

## 1. Core Objectives

- **Prevent "Spaghetti Junction":** Eliminate the clutter of numerous, long-lived session branches.
- **Automate Merging:** Streamline the process of integrating completed work.
- **Ensure Traceability:** Maintain a clear history of changes from session to weekly aggregates.
- **Handle Inactivity:** Automatically manage and clean up stale or abandoned sessions.
- **User-Friendly Configuration:** Provide simple and clear settings for customization.

## 2. Proposed Branching Strategy

A hierarchical branching model will be adopted to manage the lifecycle of code changes from individual sessions to weekly consolidations.

| Branch Type         | Naming Convention                               | Lifecycle                                                                 | Purpose                                                                                      |
| ------------------- | ----------------------------------------------- | ------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------- |
| **Session Branch**  | `session/<agent-name>/<task-id>`                | Created for a single work session; short-lived (hours to days).           | Isolates work done in a specific session, managed by a single agent for a single task.       |
| **Daily Branch**    | `daily/<YYYY-MM-DD>`                            | Created daily; consolidates work from multiple sessions; short-lived (1 day). | Aggregates all work completed within a single day. Acts as a default merge target.         |
| **Weekly Branch**   | `weekly/<YYYY-MM-DD_to_YYYY-MM-DD>`             | Created weekly; consolidates daily branches; longer-lived (weeks).        | Provides a stable, weekly snapshot of all completed work.                                  |
| **Target Branch**   | User-defined (e.g., `main`, `develop`, `staging`) | Permanent; represents the primary line of development.                    | The ultimate destination for all merged code, configurable by the project owner.             |

## 3. Detailed Workflows

### 3.1. Session Closure and Merging

This workflow addresses the user's primary requirement for cleaning up sessions.

1.  **Trigger:** The user initiates the `s9n-devops-agent close` command.
2.  **User Prompt:** The system will ask the user:
    > "Do you want to merge the changes from this session? (Y/n/d) Yes, (n)o (just cleanup), (d)elete without merging"
3.  **Merge Logic:**
    *   If **'Yes'**: The session branch will be merged into the configured target branch.
        *   The system checks `local_deploy/project-settings.json` for a `branchManagement.defaultMergeTarget` value.
        *   If the setting exists, that branch is the target (e.g., `main`).
        *   If the setting is absent, the merge target defaults to the **current daily branch** (e.g., `daily/2025-10-10`). A new daily branch is created if it doesn't exist.
    *   If **'No'**: The session's work is preserved in its branch, but the local worktree is removed. The session is marked as inactive.
    *   If **'Delete'**: The session branch is deleted, and the worktree is removed. The work is permanently lost.
4.  **Cleanup:** After a successful merge or user's choice to cleanup, the agent will:
    *   Delete the session branch (`git branch -D session/...`).
    *   Remove the git worktree (`git worktree remove ...`).
    *   Delete the session lock file.

### 3.2. Weekly Branch Consolidation

This automated process keeps the repository tidy by rolling up daily branches.

1.  **Trigger:** A scheduled task will run automatically every Sunday at midnight.
2.  **Process:**
    *   The script identifies all `daily/*` branches from the past 7 days (Monday to Sunday).
    *   It creates a new weekly branch, e.g., `weekly/2025-10-06_to_2025-10-12`.
    *   It merges each daily branch into the new weekly branch in chronological order.
    *   Upon successful merging of all daily branches, the script deletes the processed `daily/*` branches.
3.  **Scheduling:** This will be implemented using a `cron` job or a similar scheduling mechanism, managed by a new agent command.

### 3.3. Orphaned Session Cleanup

This workflow prevents the accumulation of abandoned work.

1.  **Trigger:** A scheduled task runs daily to check for orphaned sessions.
2.  **Detection:**
    *   The script scans all session lock files in `local_deploy/session-locks`.
    *   For each active session, it checks the timestamp of the last commit on the session branch.
    *   If the last commit is older than 7 days, the session is flagged as "orphaned."
3.  **User Interaction:**
    *   The system will present a list of orphaned sessions to the user.
    *   It will ask for confirmation:
        > "The following sessions have been inactive for over 7 days. Would you like to close and merge them? (Y/n)"
4.  **Action:**
    *   If the user confirms, the system will execute the **Session Closure and Merging** workflow (Section 3.1) for each orphaned session, merging them to the default target.
    *   If the user declines, the sessions remain active, and the prompt will reappear the next day.

## 4. Configuration Changes

To support this new system, the following additions will be made to the configuration files.

**File:** `local_deploy/project-settings.json`

```json
{
  // ... existing settings
  "branchManagement": {
    "defaultMergeTarget": "main",
    "enableWeeklyConsolidation": true,
    "orphanSessionThresholdDays": 7
  }
}
```

-   **`defaultMergeTarget`**: Specifies the primary branch for merges. If empty or not present, defaults to the daily branch.
-   **`enableWeeklyConsolidation`**: A boolean to enable or disable the automated weekly rollup.
-   **`orphanSessionThresholdDays`**: The number of days of inactivity before a session is considered orphaned.

## 5. Implementation Plan

1.  **Modify `close-session.js`:** Implement the session closure and merging logic described in Section 3.1.
2.  **Create `consolidate-branches.js`:** A new script to handle the weekly consolidation workflow.
3.  **Create `cleanup-orphans.js`:** A new script to detect and manage orphaned sessions.
4.  **Update `session-coordinator.js`:** Integrate the new configuration settings and ensure new sessions follow the `session/<agent-name>/<task-id>` naming convention.
5.  **Update `setup-cs-devops-agent.js`:** Add prompts to the setup wizard for the new `branchManagement` settings.
6.  **Add Scheduling Command:** Create a new command `s9n-devops-agent schedule-cleanup` to set up the cron jobs for weekly consolidation and orphan detection.

## 6. Further Recommendations

Beyond the requested features, the following enhancements would further improve the DevOps Agent:

-   **Remote Coordination Service:** The current file-locking mechanism is local. A lightweight, remote service (e.g., using Redis or a simple REST API) would enable conflict detection for agents working on different machines, preventing merge conflicts before they happen.
-   **Merge Conflict Resolution Assistant:** When a merge fails, the agent could provide a guided process for the user to resolve it. This would involve checking out a new conflict resolution branch, listing the conflicting files, and providing commands to help the user fix them.
-   **Web-Based Dashboard:** A simple web UI could provide a real-time overview of active sessions, branch status, file locks, and recent activity, offering a more intuitive way to monitor the system than the command line.

