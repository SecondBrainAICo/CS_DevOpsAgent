// package.json must have: { "type": "module" }
// npm i -D chokidar execa

/**
 * ============================================================================
 * DEVOPS-AGENT WORKER WITH INTELLIGENT BRANCH MANAGEMENT
 * ============================================================================
 * 
 * PURPOSE:
 * Automates git commits and branch management for continuous development workflow.
 * Watches for file changes and commit messages, automatically committing and pushing.
 * 
 * KEY FEATURES:
 * 1. Automatic daily branch creation and management
 * 2. Watches for changes and cs-devops-agents when ready
 * 3. Micro-revision versioning (v0.20, v0.21, v0.22...)
 * 4. Intelligent commit message handling from .claude-commit-msg
 * 5. Daily rollover with automatic merging
 * 
 * ============================================================================
 * WORKFLOW OVERVIEW:
 * ============================================================================
 * 
 * STARTUP:
 * 1. Check if new day → trigger rollover if needed
 * 2. Ensure correct branch (create if missing)
 * 3. Check for pending changes and existing commit message
 * 4. Start watching for changes
 * 
 * DURING THE DAY:
 * 1. Watch all files (except .git, node_modules, etc.)
 * 2. When .claude-commit-msg changes → read and validate message
 * 3. Check if day changed (midnight crossed) → handle rollover if needed
 * 4. If message is valid → commit all changes with that message
 * 5. Clear message file after successful push
 * 6. Continue watching...
 * 
 * DAILY ROLLOVER (at midnight or first run of new day):
 * 1. Merge previous version branch → main
 * 2. Create new version branch (increment by 0.01)
 * 3. Merge yesterday's daily branch → new version branch  
 * 4. Create today's daily branch from version branch
 * 5. Push everything to remote
 * 
 * ============================================================================
 * BRANCH STRUCTURE:
 * ============================================================================
 * 
 * main
 *   └── v0.20 (Sept 15)
 *         └── dev_sdd_2025-09-15 (daily work)
 *   └── v0.21 (Sept 16) 
 *         └── dev_sdd_2025-09-16 (daily work)
 *   └── v0.22 (Sept 17)
 *         └── dev_sdd_2025-09-17 (daily work)
 *   ... and so on
 * 
 * Each day:
 * - Version branch created from main (v0.XX)
 * - Daily branch created from version branch (dev_sdd_YYYY-MM-DD)
 * - All commits happen on daily branch
 * - Next day: everything merges forward
 * 
 * ============================================================================
 * CONFIGURATION (via environment variables):
 * ============================================================================
 * 
 * Core Settings:
 *   AC_BRANCH          - Static branch name (overrides daily branches)
 *   AC_BRANCH_PREFIX   - Prefix for daily branches (default: "dev_sdd_")
 *   AC_TZ              - Timezone for date calculations (default: "Asia/Dubai")
 *   AC_PUSH            - Auto-push after commit (default: true)
 * 
 * Message Handling:
 *   AC_MSG_FILE        - Path to commit message file (default: .claude-commit-msg)
 *   AC_REQUIRE_MSG     - Require valid commit message (default: true)
 *   AC_MSG_MIN_BYTES   - Minimum message size (default: 20)
 *   AC_MSG_PATTERN     - Regex for conventional commits (feat|fix|refactor|docs|test|chore)
 * 
 * Behavior:
 *   AC_DEBOUNCE_MS     - Delay before processing changes (default: 1500ms)
 *   AC_MSG_DEBOUNCE_MS - Delay after message file changes (default: 3000ms)
 *   AC_CLEAR_MSG_WHEN  - When to clear message file: "push"|"commit"|"never"
 *   AC_ROLLOVER_PROMPT - Prompt before daily rollover (default: true)
 * 
 * ============================================================================
 * USAGE:
 * ============================================================================
 * 
 * Basic usage:
 *   node cs-devops-agent-worker.js
 * 
 * The worker handles midnight crossovers automatically:
 * - If running when clock hits midnight, next commit triggers rollover
 * - No need to restart the worker for new days
 * - Ensures commits always go to the correct daily branch
 * 
 * With custom branch:
 *   AC_BRANCH=feature-xyz node cs-devops-agent-worker.js
 * 
 * Disable auto-push:
 *   AC_PUSH=false node cs-devops-agent-worker.js
 * 
 * Custom timezone:
 *   AC_TZ="America/New_York" node cs-devops-agent-worker.js
 * 
 * ============================================================================
 */

import fs from "fs";
import path from "path";
import chokidar from "chokidar";
import { execa } from "execa";
import readline from "node:readline";
import { stdin as input, stdout as output } from 'node:process';
import { execSync } from 'child_process';
import { restartDockerContainers } from './docker-utils.js';

// ============================================================================
// CONFIGURATION SECTION - All settings can be overridden via environment vars
// ============================================================================
const STATIC_BRANCH = process.env.AC_BRANCH || null;           // e.g., "v0.2" (otherwise daily dev_sdd_<date>)
const BRANCH_PREFIX = process.env.AC_BRANCH_PREFIX || "dev_sdd_";
const TZ            = process.env.AC_TZ || "Asia/Dubai";
const DATE_STYLE    = process.env.AC_DATE_STYLE || "dash";     // "dash" (YYYY-MM-DD) | "compact" (YYYYMMDD)
const PUSH          = (process.env.AC_PUSH || "true").toLowerCase() === "true";

// legacy quiet scheduler (kept as fallback; set AC_QUIET_MS=0 to disable)
const DEBOUNCE_MS   = Number(process.env.AC_DEBOUNCE_MS || 1500);
const QUIET_MS      = Number(process.env.AC_QUIET_MS || 0);

// message gating
const REQUIRE_MSG   = (process.env.AC_REQUIRE_MSG || "true").toLowerCase() !== "false";
const REQUIRE_MSG_AFTER_CHANGE =
  (process.env.AC_REQUIRE_MSG_AFTER_CHANGE || "false").toLowerCase() !== "false"; // default false to avoid pycache noise
const MSG_MIN_BYTES = Number(process.env.AC_MSG_MIN_BYTES || 20);
const MSG_PATTERN   = new RegExp(process.env.AC_MSG_PATTERN || '^(feat|fix|refactor|docs|test|chore)(\\([^)]+\\))?:\\s', 'm');

// message path + triggering
const MSG_FILE_ENV       = process.env.AC_MSG_FILE || ""; // path relative to git root
const TRIGGER_ON_MSG     = (process.env.AC_TRIGGER_ON_MSG || "true").toLowerCase() !== "false";
const MSG_DEBOUNCE_MS    = Number(process.env.AC_MSG_DEBOUNCE_MS || 3000);

const CONFIRM_ON_START     = (process.env.AC_CONFIRM_ON_START || "true").toLowerCase() !== "false";
const CS_DEVOPS_AGENT_ON_START  = (process.env.AC_CS_DEVOPS_AGENT_ON_START || "true").toLowerCase() === "true";

const USE_POLLING   = (process.env.AC_USE_POLLING || "false").toLowerCase() === "true";
let DEBUG           = (process.env.AC_DEBUG || "true").toLowerCase() !== "false";  // Made mutable for runtime toggle

// clear message when: "push" | "commit" | "never"
const CLEAR_MSG_WHEN = (process.env.AC_CLEAR_MSG_WHEN || "push").toLowerCase();

// --- daily & version rollover ---
const DAILY_PREFIX = process.env.AC_DAILY_PREFIX || "dev_sdd_";
const ROLLOVER_PROMPT = (process.env.AC_ROLLOVER_PROMPT || "true").toLowerCase() !== "false";
const FORCE_ROLLOVER  = (process.env.AC_FORCE_ROLLOVER  || "false").toLowerCase() === "true";

// version branch naming: v0.<minor> -> v0.20, v0.21, v0.22, ... (increments by 0.01)
// Each day gets a micro-revision increment (e.g., v0.2 → v0.21 → v0.22)
const VERSION_PREFIX       = process.env.AC_VERSION_PREFIX || "v0.";
const VERSION_START_MINOR  = Number(process.env.AC_VERSION_START_MINOR || "20");     // Start at v0.20 for micro-revisions
const VERSION_BASE_REF     = process.env.AC_VERSION_BASE_REF || "origin/main";      // where new version branches start
// ------------------------------------------------

const log  = (...a) => console.log("[cs-devops-agent]", ...a);
const dlog = (...a) => { if (DEBUG) console.log("[debug]", ...a); };

async function run(cmd, args, opts = {}) {
  try {
    if (DEBUG) console.log("[cmd]", cmd, args.join(" "));
    const { stdout } = await execa(cmd, args, { stdio: "pipe", ...opts });
    return { ok: true, stdout: stdout ?? "" };
  } catch (err) {
    const msg = err?.stderr || err?.shortMessage || err?.message || String(err);
    console.error("[err]", cmd, args.join(" "), "\n" + msg.trim());
    return { ok: false, stdout: "" };
  }
}

function clearMsgFile(p) {
  try {
    fs.writeFileSync(p, "");
    log(`cleared message file ${path.relative(process.cwd(), p)}`);
  } catch (e) {
    dlog("clear msg failed:", e.message);
  }
}

// ============================================================================
// DATE/TIME UTILITIES - Handle timezone-aware date formatting
// ============================================================================

/**
 * Get today's date string in specified timezone and format
 * @param {string} tz - Timezone (e.g., "Asia/Dubai")
 * @param {string} style - "dash" for YYYY-MM-DD or "compact" for YYYYMMDD
 * @returns {string} Formatted date string
 */
function todayStr(tz = TZ, style = DATE_STYLE) {
  const d = new Intl.DateTimeFormat("en-CA", {
    timeZone: tz, year: "numeric", month: "2-digit", day: "2-digit",
  }).format(new Date()); // "YYYY-MM-DD"
  return style === "compact" ? d.replaceAll("-", "") : d;
}
function todayDateStr() { return todayStr(TZ, DATE_STYLE); }
function dailyNameFor(dateStr) { return `${DAILY_PREFIX}${dateStr}`; }

function targetBranchName() {
  // Use a pinned branch if AC_BRANCH is set, otherwise today's daily
  return STATIC_BRANCH || `${BRANCH_PREFIX}${todayDateStr()}`;
}

// ============================================================================
// GIT OPERATIONS - Core git functionality wrapped in async functions
// ============================================================================

/**
 * Get the current git branch name
 * @returns {Promise<string>} Current branch name or empty string on error
 */
async function currentBranch() {
  const { ok, stdout } = await run("git", ["rev-parse", "--abbrev-ref", "HEAD"]);
  return ok ? stdout.trim() : "";
}
/**
 * Check if a git branch exists locally
 * @param {string} name - Branch name to check
 * @returns {Promise<boolean>} True if branch exists
 */
async function branchExists(name) {
  const { ok } = await run("git", ["rev-parse", "--verify", "--quiet", name]);
  return ok;
}
/**
 * Ensure we're on the specified branch (create if needed, switch if exists)
 * @param {string} name - Target branch name
 * @returns {Promise<{ok: boolean, created: boolean, switched: boolean}>} Operation result
 */
async function ensureBranch(name) {
  const cur = await currentBranch();
  dlog("ensureBranch: current =", cur, "target =", name);
  
  // Already on target branch
  if (cur === name) return { ok: true, created: false, switched: false };
  
  // Branch exists, just switch to it
  if (await branchExists(name)) {
    const r = await run("git", ["checkout", name]);
    return { ok: r.ok, created: false, switched: r.ok };
  } else {
    // Branch doesn't exist, create it from current HEAD
    const r = await run("git", ["checkout", "-b", name]);
    return { ok: r.ok, created: r.ok, switched: r.ok };
  }
}
async function hasUncommittedChanges() {
  const r = await run("git", ["status", "--porcelain"]);
  return r.ok && r.stdout.trim().length > 0;
}
/**
 * Get a summary of git status with file counts by type
 * @param {number} maxLines - Maximum preview lines to return
 * @returns {Promise<Object>} Status summary with counts and preview
 */
async function summarizeStatus(maxLines = 20) {
  const r = await run("git", ["status", "--porcelain"]);
  const lines = (r.stdout || "").split("\n").filter(Boolean);
  let added = 0, modified = 0, deleted = 0, untracked = 0;
  
  // Parse git status codes
  for (const l of lines) {
    if (l.startsWith("??")) untracked++;      // Untracked files
    else if (/\bD\b/.test(l)) deleted++;      // Deleted files
    else if (/\bM\b/.test(l)) modified++;     // Modified files  
    else added++;                             // Added files
  }
  
  return { count: lines.length, added, modified, deleted, untracked, preview: lines.slice(0, maxLines).join("\n") };
}
async function stagedCount() {
  const r = await run("git", ["diff", "--cached", "--name-only"]);
  return r.ok ? r.stdout.split("\n").filter(Boolean).length : 0;
}
async function unstageIfStaged(file) {
  await run("git", ["restore", "--staged", file]);
}
async function defaultRemote() {
  const r = await run("git", ["remote"]);
  const remotes = (r.stdout || "").split("\n").map(s => s.trim()).filter(Boolean);
  return remotes.includes("origin") ? "origin" : remotes[0] || null;
}
async function pushBranch(branch) {
  const remote = await defaultRemote();
  if (!remote) {
    console.error("[cs-devops-agent] No git remote configured. Run:");
    console.error("  git remote add origin <git-url>");
    return false;
  }
  
  // First check if remote branch exists
  const remoteExistsResult = await run("git", ["ls-remote", "--heads", remote, branch]);
  const remoteExists = remoteExistsResult.ok && remoteExistsResult.stdout.trim().length > 0;
  
  if (!remoteExists) {
    // Remote branch doesn't exist, create it with -u (set upstream)
    log(`Creating new remote branch ${branch} on ${remote}...`);
    const r = await run("git", ["push", "-u", remote, branch]);
    if (!r.ok) {
      log(`Failed to create remote branch: ${r.stderr}`);
    }
    return r.ok;
  }
  
  // Remote branch exists, attempt normal push
  let r = await run("git", ["push", remote, branch]);
  
  // If push failed, check if it's because we're behind
  if (!r.ok) {
    // Try to pull and merge remote changes
    log("Push failed, attempting to pull remote changes...");
    const pullResult = await run("git", ["pull", "--no-rebase", remote, branch]);
    
    if (pullResult.ok) {
      log("Successfully pulled and merged remote changes, retrying push...");
      // Retry push after successful pull
      r = await run("git", ["push", remote, branch]);
    } else {
      // If pull also failed, try force setting upstream
      // This handles cases where local and remote have diverged
      log("Pull failed, attempting to force set upstream...");
      r = await run("git", ["push", "-u", remote, branch]);
    }
  }
  
  return r.ok;
}

// ============================================================================
// COMMIT MESSAGE HANDLING - Manage .claude-commit-msg file
// ============================================================================

/**
 * Find the commit message file (session-specific or default)
 * Searches in order:
 * 1. Environment variable AC_MSG_FILE path (if set)
 * 2. Session-specific file: .devops-commit-*.msg (for multi-agent sessions)
 * 3. Default: .claude-commit-msg in repository root
 * 4. Common nested locations (MVPEmails/DistilledConceptExtractor/)
 * @param {string} repoRoot - Git repository root path
 * @returns {string} Path to message file (may not exist)
 */
function resolveMsgPath(repoRoot) {
  // Priority 1: Explicit environment variable
  if (MSG_FILE_ENV) {
    const p = path.resolve(repoRoot, MSG_FILE_ENV);
    if (fs.existsSync(p)) {
      log(`Using message file from AC_MSG_FILE: ${MSG_FILE_ENV}`);
      return p;
    }
    // If AC_MSG_FILE is set but doesn't exist yet, use it anyway
    // (it will be created when the agent writes a commit message)
    if (MSG_FILE_ENV.startsWith('.devops-commit-') && MSG_FILE_ENV.endsWith('.msg')) {
      log(`Will watch for session message file: ${MSG_FILE_ENV}`);
      return p;
    }
    dlog("MSG_FILE_ENV set but not found at", p);
  }
  
  // Priority 2: Look for session-specific commit message files
  // Pattern: .devops-commit-*.msg (used by multi-agent sessions)
  try {
    const files = fs.readdirSync(repoRoot);
    const sessionMsgFiles = files.filter(f => 
      f.startsWith('.devops-commit-') && f.endsWith('.msg')
    );
    
    if (sessionMsgFiles.length > 0) {
      // Use the most recently modified session message file
      const mostRecent = sessionMsgFiles
        .map(f => {
          const fullPath = path.join(repoRoot, f);
          const stats = fs.statSync(fullPath);
          return { path: fullPath, mtime: stats.mtime, name: f };
        })
        .sort((a, b) => b.mtime - a.mtime)[0];
      
      log(`Found session message file: ${mostRecent.name}`);
      return mostRecent.path;
    }
  } catch (err) {
    dlog("Error scanning for session message files:", err.message);
  }
  
  // Priority 3: Default .claude-commit-msg in root
  const rootDefault = path.join(repoRoot, ".claude-commit-msg");
  if (fs.existsSync(rootDefault)) return rootDefault;

  // Priority 4: Common nested candidates
  const candidates = [
    path.join(repoRoot, "MVPemails/DistilledConceptExtractor/.claude-commit-msg"),
    path.join(repoRoot, "MVPEmails/DistilledConceptExtractor/.claude-commit-msg"),
  ];
  for (const c of candidates) if (fs.existsSync(c)) return c;

  // Fallback: If AC_MSG_FILE was set but doesn't exist, return it anyway for watching
  if (MSG_FILE_ENV) {
    return path.resolve(repoRoot, MSG_FILE_ENV);
  }
  
  // Final fallback: Default path even if absent
  return rootDefault;
}
function fileMtimeMs(p) { try { return fs.statSync(p).mtimeMs; } catch { return 0; } }
function readMsgFile(p) { try { return fs.readFileSync(p, "utf8").trim(); } catch { return ""; } }
/**
 * Validate commit message follows conventional format
 * Expected format: type(scope): description
 * Types: feat|fix|refactor|docs|test|chore
 * @param {string} msg - Commit message to validate
 * @returns {boolean} True if message is valid
 */
function conventionalHeaderOK(msg) {
  if (!msg || msg.length < MSG_MIN_BYTES) return false;
  return MSG_PATTERN.test(msg);
}
/**
 * Check if commit message is ready to use
 * Considers:
 * - Message requirement settings
 * - Conventional format validation
 * - Whether message was updated after last code change
 * @param {string} msgPath - Path to message file
 * @returns {boolean} True if ready to commit
 */
function msgReady(msgPath) {
  if (!REQUIRE_MSG) return true;  // Messages not required
  
  const msg = readMsgFile(msgPath);
  if (!conventionalHeaderOK(msg)) return false;  // Invalid format
  
  if (!REQUIRE_MSG_AFTER_CHANGE) return true;  // Don't require fresh message
  
  // Check if message was updated after last non-message change
  const mtime = fileMtimeMs(msgPath);
  return mtime >= lastNonMsgChangeTs;
}

// ============================================================================
// DAILY ROLLOVER SYSTEM - Handle day transitions and version increments
// ============================================================================

/**
 * Find the most recent daily branch
 * @param {string} prefix - Branch prefix to search (e.g., "dev_sdd_")
 * @returns {Promise<string|null>} Latest branch name or null
 */
async function latestDaily(prefix = DAILY_PREFIX) {
  const { ok, stdout } = await run("git", [
    "for-each-ref",
    "--format=%(refname:short) %(committerdate:iso-strict)",
    "--sort=-committerdate",
    "refs/heads/" + prefix + "*"
  ]);
  if (!ok) return null;
  const line = stdout.trim().split("\n").filter(Boolean)[0];
  return line ? line.split(" ")[0] : null;
}
/**
 * Calculate the next version branch using configurable increments
 * e.g., v0.20 -> v0.21 -> v0.22 (increments by 0.01 each day)
 * or    v0.20 -> v0.30 -> v0.40 (increments by 0.1 each day)
 * @returns {Promise<string>} Next version branch name
 */
async function nextVersionBranch() {
  const { ok, stdout } = await run("git", ["for-each-ref", "--format=%(refname:short)", "refs/heads"]);
  let maxMinor = -1;
  if (ok) {
    for (const b of stdout.split("\n")) {
      // Match version branches with decimal format (e.g., v0.20, v0.21)
      const m = b.trim().match(/^v0\.(\d+)$/);
      if (m) maxMinor = Math.max(maxMinor, parseInt(m[1], 10));
    }
  }
  // Get the daily increment from environment (default 1 = 0.01)
  const dailyIncrement = parseInt(process.env.AC_VERSION_INCREMENT) || 1;
  // Increment by configured amount
  const next = maxMinor >= 0 ? maxMinor + dailyIncrement : VERSION_START_MINOR;
  return `${VERSION_PREFIX}${next}`;
}

/**
 * Get the latest version branch (for merging into main)
 * @returns {Promise<string|null>} Latest version branch name or null
 */
async function latestVersionBranch() {
  const { ok, stdout } = await run("git", ["for-each-ref", "--format=%(refname:short)", "--sort=-version:refname", "refs/heads/v0.*"]);
  if (!ok) return null;
  const branches = stdout.trim().split("\n").filter(Boolean);
  // Return the first (latest) version branch
  return branches[0] || null;
}
async function mergeInto(target, source) {
  // assumes we are on 'target'
  return run("git", ["merge", "--no-ff", "-m", `rollup: merge ${source} into ${target}`, source]);
}

async function promptYesNo(question) {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  const ans = await new Promise((res) => rl.question(question, res));
  rl.close();
  return /^y(es)?$/i.test((ans || "").trim());
}

/**
 * DAILY ROLLOVER ORCHESTRATOR
 * 
 * This is the heart of the branching strategy. At the start of each new day:
 * 1. Merge yesterday's version branch → main (preserve completed work)
 * 2. Create today's version branch from main (v0.XX+1)
 * 3. Merge yesterday's daily branch → today's version branch (carry forward WIP)
 * 4. Create today's daily branch from version branch (ready for new commits)
 * 
 * Example flow (Sept 16 morning):
 *   main ← merge v0.21 (yesterday's version)
 *   create v0.22 from main (today's version)
 *   v0.22 ← merge dev_sdd_2025-09-15 (yesterday's work)
 *   create dev_sdd_2025-09-16 from v0.22 (today's branch)
 * 
 * NOTE: This function is called:
 *   1. At startup (initial check)
 *   2. Before EVERY commit (to handle midnight crossover)
 * 
 * @param {string} repoRoot - Repository root path
 */
async function rolloverIfNewDay(repoRoot) {
  // Skip if user pinned a static branch
  if (STATIC_BRANCH) return;

  const today = todayDateStr();
  const todayDaily = dailyNameFor(today);

  // If today's daily already exists and not forcing, nothing to do
  // This check prevents multiple rollovers on the same day
  if (await branchExists(todayDaily) && !FORCE_ROLLOVER) {
    // But we still need to ensure we're on the right branch!
    const current = await currentBranch();
    if (current !== todayDaily) {
      log(`Day changed while running - switching to ${todayDaily}`);
      await ensureBranch(todayDaily);
    }
    return;
  }

  // Get necessary branch references
  const yDaily = await latestDaily();           // Yesterday's (latest) daily branch
  const vLast = await latestVersionBranch();    // Last version branch to merge into main
  const vNext = await nextVersionBranch();      // New version branch (micro-revision increment)
  const baseRef = VERSION_BASE_REF;             // origin/main

  // If working tree dirty, avoid merge conflicts
  const dirty = await hasUncommittedChanges();

  let proceed;
  if (FORCE_ROLLOVER) {
    proceed = !dirty;
  } else if (ROLLOVER_PROMPT) {
    const plan = [
      `New day detected. Daily rollover plan with micro-revisions:`,
      vLast ? `  1) merge last version ${vLast} -> main` : `  1) (no previous version to merge into main)`,
      `  2) create new version branch: ${vNext} (increment by 0.01)`,
      yDaily ? `  3) merge ${yDaily} -> ${vNext}` : `  3) (no previous daily to merge)`,
      `  4) push ${vNext}`,
      `  5) create today's branch: ${todayDaily} from ${vNext} and push`,
      dirty ? `\n⚠️  Working tree has uncommitted changes; rollover will be skipped.` : ""
    ].join("\n");
    console.log("\n[cs-devops-agent] " + plan + "\n");
    proceed = !dirty && (await promptYesNo("Proceed with daily rollover? (y/N) "));
  } else {
    // auto-rollover without prompt
    proceed = !dirty;
  }

  if (!proceed) return;

  // Fetch latest changes from remote
  await run("git", ["fetch", "--all", "--prune"]);

  // Step 1: Merge last version branch into main (if exists)
  if (vLast) {
    log(`Merging last version ${vLast} into main...`);
    // Checkout main first
    const r0 = await run("git", ["checkout", "main"]);
    if (!r0.ok) {
      // Try origin/main if local main doesn't exist
      await run("git", ["checkout", "-b", "main", "origin/main"]);
    }
    
    // Pull latest main
    await run("git", ["pull", "origin", "main"]);
    
    // Merge the last version branch into main
    const mergeResult = await mergeInto("main", vLast);
    if (!mergeResult.ok) {
      console.error("[cs-devops-agent] Failed to merge ${vLast} into main. Resolve conflicts and restart.");
      return;
    }
    
    // Push updated main
    await pushBranch("main");
    log(`Merged ${vLast} into main successfully`);
  }

  // Step 2: Create new version branch from updated main
  const r1 = await run("git", ["checkout", "-B", vNext, baseRef]);
  if (!r1.ok) { 
    console.error("[cs-devops-agent] failed to create version branch"); 
    return; 
  }
  log(`Created new version branch: ${vNext} (micro-revision increment)`);

  // Step 3: Merge latest daily into the new version branch (if exists)
  if (yDaily) {
    log(`Merging daily ${yDaily} into ${vNext}...`);
    const r2 = await mergeInto(vNext, yDaily);
    if (!r2.ok) {
      console.error("[cs-devops-agent] merge produced conflicts. Resolve, push, then restart worker.");
      return;
    }
  }

  // Step 4: Push the new version branch
  const pushedV = await pushBranch(vNext);
  console.log(`[cs-devops-agent] push ${vNext}: ${pushedV ? "ok" : "failed"}`);

  // Step 5: Create and push today's daily branch from the new version branch
  const r3 = await run("git", ["checkout", "-B", todayDaily, vNext]);
  if (!r3.ok) { 
    console.error("[cs-devops-agent] failed to create today's branch"); 
    return; 
  }
  const pushedD = await pushBranch(todayDaily);
  console.log(`[cs-devops-agent] push ${todayDaily}: ${pushedD ? "ok" : "failed"}`);
  
  log(`Daily rollover complete: ${vNext} (v0.${vNext.substring(3)/100} in semantic versioning)`);
}

// ============================================================================
// COMMIT ORCHESTRATION - Handle the actual commit/push workflow
// ============================================================================

// Timing tracking for debouncing and quiet periods
let lastAnyChangeTs = 0;      // Last time ANY file changed
let lastNonMsgChangeTs = 0;   // Last time a NON-message file changed
let timer, busy = false;       // Debounce timer and busy flag

function isQuietNow() {
  return Date.now() - lastAnyChangeTs >= QUIET_MS;
}

/**
 * MAIN COMMIT FUNCTION
 * 
 * Executes a single commit cycle:
 * 1. CHECK FOR DAY ROLLOVER (handle if we crossed midnight)
 * 2. Ensure we're on correct branch
 * 3. Detect infrastructure changes
 * 4. Stage all changes (except message file)
 * 5. Read and validate commit message
 * 6. Update infrastructure documentation if needed
 * 7. Commit with message (enhanced if infra changes)
 * 8. Push to remote (if enabled)
 * 9. Clear message file (if configured)
 * 
 * @param {string} repoRoot - Repository root path
 * @param {string} msgPath - Path to commit message file
 */
async function commitOnce(repoRoot, msgPath) {
  if (busy) return;  // Prevent concurrent commits
  busy = true;
  try {
    // IMPORTANT: Check for day rollover before EVERY commit
    // This handles the case where the worker has been running past midnight
    await rolloverIfNewDay(repoRoot);
    const BRANCH = STATIC_BRANCH || `${BRANCH_PREFIX}${todayDateStr()}`;
    const ensured = await ensureBranch(BRANCH);
    log(`branch target=${BRANCH} ensured ok=${ensured.ok} created=${ensured.created} switched=${ensured.switched}`);
    if (!ensured.ok) return;

    // Get list of changed files for infrastructure detection
    const { stdout: changedFiles } = await run("git", ["diff", "--name-only", "HEAD"]);
    const changedFilesList = changedFiles ? changedFiles.split('\n').filter(f => f) : [];
    
    // Detect infrastructure changes
    const infraChanges = detectInfrastructureChanges(changedFilesList);
    if (infraChanges.hasInfraChanges) {
      log(infraChanges.summary);
    }

    await run("git", ["add", "-A"]);
    await unstageIfStaged(path.relative(repoRoot, msgPath));

    const n = await stagedCount();
    log(`staged files=${n}`);
    if (n === 0) return;

    let msg = readMsgFile(msgPath);
    const header = (msg.split("\n")[0] || "").slice(0, 120);
    dlog("msgPath:", path.relative(repoRoot, msgPath), "size:", msg.length, "header:", header);

    // Enhance commit message if infrastructure changes detected
    if (infraChanges.hasInfraChanges && !msg.startsWith('infra')) {
      const originalMsg = msg;
      const [firstLine, ...rest] = msg.split('\n');
      
      // If the message doesn't already have infra prefix, add it
      if (!firstLine.match(/^(feat|fix|docs|style|refactor|test|chore|infra)/)) {
        msg = `infra: ${firstLine}`;
      } else {
        msg = firstLine.replace(/^(\w+)/, 'infra');
      }
      
      // Add infrastructure details to commit body
      const infraDetails = `\n\nInfrastructure changes:\n${infraChanges.files.map(f => `- ${f.file} (${f.category})`).join('\n')}`;
      msg = rest.length > 0 ? `${msg}\n${rest.join('\n')}${infraDetails}` : `${msg}${infraDetails}`;
    }

    let committed = false;
    if (REQUIRE_MSG && conventionalHeaderOK(msg)) {
      // Update infrastructure documentation before commit
      if (infraChanges.hasInfraChanges) {
        await updateInfrastructureDoc(infraChanges, msg);
        // Re-stage to include the documentation update
        await run("git", ["add", "Documentation/infrastructure.md"]);
      }
      
      // Handle worktrees: .git might be a file pointing to the actual git dir
      let gitDir = path.join(repoRoot, ".git");
      if (fs.existsSync(gitDir) && fs.statSync(gitDir).isFile()) {
        // In a worktree, .git is a file containing the path to the actual git directory
        const gitFileContent = fs.readFileSync(gitDir, 'utf8');
        const match = gitFileContent.match(/gitdir: (.+)/);
        if (match) {
          gitDir = match[1].trim();
        }
      }
      
      const tmp = path.join(gitDir, ".ac-msg.txt");
      fs.writeFileSync(tmp, msg + "\n");
      committed = (await run("git", ["commit", "-F", tmp])).ok;
      try { fs.unlinkSync(tmp); } catch {}
    } else if (!REQUIRE_MSG) {
      committed = (await run("git", ["commit", "-m", "chore: cs-devops-agent"])).ok;
    } else {
      log("message not ready; skipping commit");
      return;
    }

    if (!committed) { log("commit failed"); return; }
    if (CLEAR_MSG_WHEN === "commit") clearMsgFile(msgPath);

    const sha = (await run("git", ["rev-parse", "--short", "HEAD"])).stdout.trim();
    log(`committed ${sha} on ${await currentBranch()}`);

    if (PUSH) {
      const ok = await pushBranch(BRANCH);
      log(`push ${ok ? "ok" : "failed"}`);
      if (ok) {
        if (CLEAR_MSG_WHEN === "push") clearMsgFile(msgPath);
        
        // Handle Docker restart if configured
        await handleDockerRestart();
      }
    }
  } finally {
    busy = false;
  }
}

function schedule(repoRoot, msgPath) {
  if (QUIET_MS <= 0) return; // disabled
  clearTimeout(timer);
  timer = setTimeout(async () => {
    if (!isQuietNow()) return;
    if (!msgReady(msgPath)) {
      dlog("not committing: message not ready or updated yet");
      return;
    }
    await commitOnce(repoRoot, msgPath);
  }, QUIET_MS);
}

// ============================================================================
// DOCKER CONTAINER MANAGEMENT
// ============================================================================

/**
 * Handle Docker container restart if configured in session
 */
async function handleDockerRestart() {
  // Check if we're in a session with Docker configuration
  const sessionConfigPath = path.join(process.cwd(), '.devops-session.json');
  if (!fs.existsSync(sessionConfigPath)) {
    return; // Not in a managed session
  }
  
  try {
    const sessionConfig = JSON.parse(fs.readFileSync(sessionConfigPath, 'utf8'));
    
    // Check if Docker restart is enabled
    if (!sessionConfig.dockerConfig || !sessionConfig.dockerConfig.enabled) {
      return;
    }
    
    log('🐋 Docker restart configured - initiating container restart...');
    
    const dockerOptions = {
      projectPath: process.cwd(),
      composeFile: sessionConfig.dockerConfig.composeFile,
      serviceName: sessionConfig.dockerConfig.service,
      rebuild: sessionConfig.dockerConfig.rebuild,
      forceRecreate: sessionConfig.dockerConfig.forceRecreate || false,
      detach: true
    };
    
    const result = await restartDockerContainers(dockerOptions);
    
    if (result.success) {
      log('✅ Docker containers restarted successfully');
    } else {
      log(`⚠️ Docker restart failed: ${result.error}`);
    }
  } catch (error) {
    // Don't fail the commit/push if Docker restart fails
    dlog('Docker restart error:', error.message);
  }
}

// ============================================================================
// INFRASTRUCTURE CHANGE DETECTION
// ============================================================================

/**
 * Detect if changes include infrastructure files
 * @param {string[]} changedFiles - Array of changed file paths
 * @returns {object} - Infrastructure change details
 */
function detectInfrastructureChanges(changedFiles) {
  const infraPatterns = [
    { pattern: /package(-lock)?\.json$/, category: 'Dependencies' },
    { pattern: /\.env(\..*)?$/, category: 'Config' },
    { pattern: /.*config.*\.(js|json|yml|yaml)$/, category: 'Config' },
    { pattern: /Dockerfile$/, category: 'Build' },
    { pattern: /docker-compose\.(yml|yaml)$/, category: 'Build' },
    { pattern: /\.github\/workflows\//, category: 'Build' },
    { pattern: /migrations?\//, category: 'Database' },
    { pattern: /(routes?|api)\//, category: 'API' },
    { pattern: /\.gitlab-ci\.yml$/, category: 'Build' },
    { pattern: /webpack\.config\.js$/, category: 'Build' },
    { pattern: /tsconfig\.json$/, category: 'Build' },
    { pattern: /jest\.config\.js$/, category: 'Build' },
    { pattern: /\.eslintrc/, category: 'Build' },
    { pattern: /\.prettierrc/, category: 'Build' }
  ];
  
  const detected = {
    hasInfraChanges: false,
    categories: new Set(),
    files: [],
    summary: ''
  };
  
  for (const file of changedFiles) {
    for (const { pattern, category } of infraPatterns) {
      if (pattern.test(file)) {
        detected.hasInfraChanges = true;
        detected.categories.add(category);
        detected.files.push({ file, category });
        break;
      }
    }
  }
  
  if (detected.hasInfraChanges) {
    detected.summary = `Infrastructure changes detected in: ${Array.from(detected.categories).join(', ')}`;
  }
  
  return detected;
}

/**
 * Update infrastructure documentation
 * @param {object} infraChanges - Infrastructure change details
 * @param {string} commitMsg - Commit message
 */
async function updateInfrastructureDoc(infraChanges, commitMsg) {
  const TRACK_INFRA = (process.env.AC_TRACK_INFRA || "true").toLowerCase() !== "false";
  if (!TRACK_INFRA || !infraChanges.hasInfraChanges) return;
  
  const docPath = path.join(
    process.cwd(),
    process.env.AC_INFRA_DOC_PATH || 'Documentation/infrastructure.md'
  );
  
  // Ensure Documentation directory exists
  const docDir = path.dirname(docPath);
  if (!fs.existsSync(docDir)) {
    fs.mkdirSync(docDir, { recursive: true });
  }
  
  // Create file if it doesn't exist
  if (!fs.existsSync(docPath)) {
    const template = `# Infrastructure Change Log

This document tracks all infrastructure changes made to the project.

---

<!-- New entries will be added above this line -->`;
    fs.writeFileSync(docPath, template);
  }
  
  // Prepare entry
  const date = new Date().toISOString().split('T')[0];
  const agent = process.env.AGENT_NAME || process.env.USER || 'System';
  const categories = Array.from(infraChanges.categories).join(', ');
  
  const entry = `
## ${date} - ${agent}

### Category: ${categories}
**Change Type**: Modified
**Component**: ${infraChanges.files[0].category}
**Description**: ${commitMsg.split('\n')[0]}
**Files Changed**: 
${infraChanges.files.map(f => `- ${f.file}`).join('\n')}

---
`;
  
  // Read current content and insert new entry
  let content = fs.readFileSync(docPath, 'utf8');
  const insertMarker = '<!-- New entries will be added above this line -->';
  
  if (content.includes(insertMarker)) {
    content = content.replace(insertMarker, entry + '\n' + insertMarker);
  } else {
    content += '\n' + entry;
  }
  
  fs.writeFileSync(docPath, content);
  log(`Updated infrastructure documentation: ${docPath}`);
}

// ============================================================================
// WORKTREE DETECTION AND MANAGEMENT
// ============================================================================

/**
 * Detect if we're running CS_DevOpsAgent on another repository and should use worktrees
 * @param {string} repoRoot - The root of the target repository
 * @returns {object} - Worktree info or null
 */
async function detectAndSetupWorktree(repoRoot) {
  // Check if we're in the CS_DevOpsAgent repo itself - never use worktrees here
  const autoCommitMarkers = ['worktree-manager.js', 'cs-devops-agent-worker.js', 'setup-cs-devops-agent.js'];
  const isCS_DevOpsAgentRepo = autoCommitMarkers.every(file => 
    fs.existsSync(path.join(repoRoot, file))
  );
  
  if (isCS_DevOpsAgentRepo) {
    dlog("Running in CS_DevOpsAgent repository - worktrees disabled");
    return null;
  }
  
  // Check environment variables for agent identification
  const agentName = process.env.AGENT_NAME || process.env.AI_AGENT || null;
  const agentTask = process.env.AGENT_TASK || process.env.AI_TASK || 'development';
  const useWorktree = (process.env.AC_USE_WORKTREE || "auto").toLowerCase();
  
  // Skip worktree if explicitly disabled
  if (useWorktree === "false" || useWorktree === "no") {
    dlog("Worktree usage disabled via AC_USE_WORKTREE");
    return null;
  }
  
  // If no agent name provided, try to detect from environment
  let detectedAgent = agentName;
  if (!detectedAgent) {
    // Check for common AI agent indicators
    if (process.env.COPILOT_API_KEY || process.env.GITHUB_COPILOT_ENABLED) {
      detectedAgent = 'copilot';
    } else if (process.env.ANTHROPIC_API_KEY || process.env.CLAUDE_API_KEY) {
      detectedAgent = 'claude';
    } else if (process.env.CURSOR_API_KEY || process.env.CURSOR_ENABLED) {
      detectedAgent = 'cursor';
    } else if (process.env.AIDER_API_KEY || process.env.OPENAI_API_KEY) {
      detectedAgent = 'aider';
    } else if (process.env.USER && process.env.USER.includes('agent')) {
      detectedAgent = process.env.USER.replace(/[^a-zA-Z0-9]/g, '');
    }
  }
  
  // Only proceed if we have an agent name or it's explicitly requested
  if (!detectedAgent && useWorktree !== "true") {
    dlog("No agent detected and worktrees not explicitly requested");
    return null;
  }
  
  // Generate agent name if needed
  if (!detectedAgent) {
    detectedAgent = `agent-${Date.now().toString(36)}`;
    log(`Generated agent name: ${detectedAgent}`);
  }
  
  // Check if we're already in a worktree
  const { stdout: worktreeList } = await run("git", ["worktree", "list", "--porcelain"]);
  const currentPath = process.cwd();
  const isInWorktree = worktreeList.includes(currentPath) && 
                       !worktreeList.startsWith(`worktree ${currentPath}\n`);
  
  if (isInWorktree) {
    log(`Already running in worktree: ${currentPath}`);
    return { isWorktree: true, path: currentPath, agent: detectedAgent };
  }
  
  // Try to use existing worktree manager if available
  const worktreeManagerPath = path.join(repoRoot, '.worktrees', 'worktree-manager.js');
  const hasWorktreeManager = fs.existsSync(worktreeManagerPath) || 
                             fs.existsSync(path.join(repoRoot, 'worktree-manager.js'));
  
  if (hasWorktreeManager) {
    log(`Found worktree manager - creating worktree for ${detectedAgent}`);
    const { ok, stdout } = await run("node", [
      worktreeManagerPath,
      "create",
      "--agent", detectedAgent,
      "--task", agentTask
    ]);
    
    if (ok) {
      const worktreePath = path.join(repoRoot, '.worktrees', `${detectedAgent}-${agentTask}`);
      log(`Worktree created at: ${worktreePath}`);
      return { isWorktree: true, path: worktreePath, agent: detectedAgent, created: true };
    }
  }
  
  // Fallback: Create simple worktree without manager
  const worktreesDir = path.join(repoRoot, '.worktrees');
  const worktreeName = `${detectedAgent}-${agentTask}`;
  const worktreePath = path.join(worktreesDir, worktreeName);
  const branchName = `agent/${detectedAgent}/${agentTask}`;
  
  if (!fs.existsSync(worktreePath)) {
    log(`Creating worktree for ${detectedAgent} at ${worktreePath}`);
    
    // Ensure worktrees directory exists
    if (!fs.existsSync(worktreesDir)) {
      fs.mkdirSync(worktreesDir, { recursive: true });
    }
    
    // Create worktree with new branch
    const { ok } = await run("git", [
      "worktree", "add", 
      "-b", branchName,
      worktreePath,
      "HEAD"
    ]);
    
    if (ok) {
      // Create agent config file
      const agentConfig = {
        agent: detectedAgent,
        worktree: worktreeName,
        branch: branchName,
        task: agentTask,
        created: new Date().toISOString(),
        autoCommit: {
          enabled: true,
          prefix: `agent_${detectedAgent}_`,
          messagePrefix: `[${detectedAgent.toUpperCase()}]`
        }
      };
      
      fs.writeFileSync(
        path.join(worktreePath, '.agent-config'),
        JSON.stringify(agentConfig, null, 2)
      );
      
      log(`Worktree created successfully for ${detectedAgent}`);
      return { isWorktree: true, path: worktreePath, agent: detectedAgent, created: true };
    } else {
      log(`Failed to create worktree for ${detectedAgent}`);
    }
  } else {
    log(`Using existing worktree at: ${worktreePath}`);
    return { isWorktree: true, path: worktreePath, agent: detectedAgent };
  }
  
  return null;
}

// ============================================================================
// SETTINGS MANAGEMENT - Interactive settings editor
// ============================================================================

/**
 * Load and manage settings interactively
 */
async function handleSettingsCommand() {
  const homeDir = process.env.HOME || process.env.USERPROFILE;
  const globalSettingsPath = path.join(homeDir, '.devops-agent', 'settings.json');
  const projectSettingsPath = path.join(process.cwd(), 'local_deploy', 'project-settings.json');
  
  // Load current settings
  let globalSettings = {};
  let projectSettings = {};
  
  try {
    if (fs.existsSync(globalSettingsPath)) {
      globalSettings = JSON.parse(fs.readFileSync(globalSettingsPath, 'utf8'));
    }
  } catch (err) {
    log("Could not load global settings: " + err.message);
  }
  
  try {
    if (fs.existsSync(projectSettingsPath)) {
      projectSettings = JSON.parse(fs.readFileSync(projectSettingsPath, 'utf8'));
    }
  } catch (err) {
    log("Could not load project settings: " + err.message);
  }
  
  console.log("\n" + "=".repeat(60));
  console.log("CONFIGURATION SETTINGS");
  console.log("=".repeat(60));
  
  console.log("\nGLOBAL SETTINGS (applies to all projects):");
  console.log("  1) Developer initials: " + (globalSettings.developerInitials || "[not set]"));
  console.log("  2) Email: " + (globalSettings.email || "[not set]"));
  
  console.log("\nPROJECT SETTINGS (this repository only):");
  const vs = projectSettings.versioningStrategy || {};
  console.log("  3) Version prefix: " + (vs.prefix || "v0."));
  console.log("  4) Starting version: " + (vs.startMinor || "20"));
  const increment = vs.dailyIncrement || 1;
  const incrementDisplay = (increment / 100).toFixed(2);
  console.log("  5) Daily increment: " + incrementDisplay + " (" + increment + ")");
  
  console.log("\nOptions:");
  console.log("  Enter number (1-5) to edit a setting");
  console.log("  Enter 'v' to view all settings in detail");
  console.log("  Enter 'r' to reset project settings");
  console.log("  Enter 'q' or press Enter to return");
  
  const rl = readline.createInterface({
    input: input,
    output: output
  });
  
  const choice = await new Promise(resolve => {
    rl.question("\nYour choice: ", resolve);
  });
  
  rl.close();
  
  switch (choice.trim().toLowerCase()) {
    case '1':
      await editDeveloperInitials(globalSettings, globalSettingsPath);
      break;
    case '2':
      await editEmail(globalSettings, globalSettingsPath);
      break;
    case '3':
      await editVersionPrefix(projectSettings, projectSettingsPath);
      break;
    case '4':
      await editStartingVersion(projectSettings, projectSettingsPath);
      break;
    case '5':
      await editDailyIncrement(projectSettings, projectSettingsPath);
      break;
    case 'v':
      console.log("\nFull Settings:");
      console.log("\nGlobal (~/.devops-agent/settings.json):");
      console.log(JSON.stringify(globalSettings, null, 2));
      console.log("\nProject (local_deploy/project-settings.json):");
      console.log(JSON.stringify(projectSettings, null, 2));
      break;
    case 'r':
      const confirmRl = readline.createInterface({ input, output });
      const confirm = await new Promise(resolve => {
        confirmRl.question("Reset project settings to defaults? (y/N): ", resolve);
      });
      confirmRl.close();
      if (confirm.toLowerCase() === 'y') {
        projectSettings = {
          versioningStrategy: {
            prefix: "v0.",
            startMinor: 20,
            dailyIncrement: 1,
            configured: false
          }
        };
        saveProjectSettings(projectSettings, projectSettingsPath);
        console.log("Project settings reset to defaults.");
      }
      break;
    case 'q':
    case '':
      // Return to main prompt
      break;
    default:
      console.log("Invalid choice.");
  }
}

async function editDeveloperInitials(settings, settingsPath) {
  const rl = readline.createInterface({ input, output });
  const initials = await new Promise(resolve => {
    rl.question("Enter 3-letter developer initials: ", resolve);
  });
  rl.close();
  
  if (initials.length === 3 && /^[a-zA-Z]+$/.test(initials)) {
    settings.developerInitials = initials.toLowerCase();
    settings.configured = true;
    saveGlobalSettings(settings, settingsPath);
    console.log("Developer initials updated to: " + initials.toLowerCase());
  } else {
    console.log("Invalid initials. Must be exactly 3 letters.");
  }
}

async function editEmail(settings, settingsPath) {
  const rl = readline.createInterface({ input, output });
  const email = await new Promise(resolve => {
    rl.question("Enter email address: ", resolve);
  });
  rl.close();
  
  settings.email = email.trim();
  saveGlobalSettings(settings, settingsPath);
  console.log("Email updated to: " + email.trim());
}

async function editVersionPrefix(settings, settingsPath) {
  const rl = readline.createInterface({ input, output });
  const prefix = await new Promise(resolve => {
    rl.question("Enter version prefix (e.g., v0., v1., v2.): ", resolve);
  });
  rl.close();
  
  const cleaned = prefix.trim();
  if (cleaned) {
    if (!settings.versioningStrategy) settings.versioningStrategy = {};
    settings.versioningStrategy.prefix = cleaned.endsWith('.') ? cleaned : cleaned + '.';
    saveProjectSettings(settings, settingsPath);
    console.log("Version prefix updated to: " + settings.versioningStrategy.prefix);
    process.env.AC_VERSION_PREFIX = settings.versioningStrategy.prefix;
  }
}

async function editStartingVersion(settings, settingsPath) {
  const rl = readline.createInterface({ input, output });
  const version = await new Promise(resolve => {
    rl.question("Enter starting version number (e.g., 20 for v0.20): ", resolve);
  });
  rl.close();
  
  const num = parseInt(version.trim());
  if (!isNaN(num) && num >= 0) {
    if (!settings.versioningStrategy) settings.versioningStrategy = {};
    settings.versioningStrategy.startMinor = num;
    saveProjectSettings(settings, settingsPath);
    console.log("Starting version updated to: " + num);
    process.env.AC_VERSION_START_MINOR = num.toString();
  } else {
    console.log("Invalid version number.");
  }
}

async function editDailyIncrement(settings, settingsPath) {
  const rl = readline.createInterface({ input, output });
  console.log("\nDaily increment options:");
  console.log("  1) 0.01 per day (v0.20 → v0.21 → v0.22)");
  console.log("  2) 0.1 per day  (v0.20 → v0.30 → v0.40)");
  console.log("  3) 0.2 per day  (v0.20 → v0.40 → v0.60)");
  console.log("  4) Custom value");
  
  const choice = await new Promise(resolve => {
    rl.question("Select option (1-4): ", resolve);
  });
  
  let increment = 1;
  switch (choice.trim()) {
    case '1':
      increment = 1;
      break;
    case '2':
      increment = 10;
      break;
    case '3':
      increment = 20;
      break;
    case '4':
      const custom = await new Promise(resolve => {
        rl.question("Enter increment value (e.g., 5 for 0.05): ", resolve);
      });
      const customNum = parseInt(custom.trim());
      if (!isNaN(customNum) && customNum > 0) {
        increment = customNum;
      } else {
        console.log("Invalid value, using default (0.01).");
      }
      break;
    default:
      console.log("Invalid choice, using default (0.01).");
  }
  
  rl.close();
  
  if (!settings.versioningStrategy) settings.versioningStrategy = {};
  settings.versioningStrategy.dailyIncrement = increment;
  saveProjectSettings(settings, settingsPath);
  const display = (increment / 100).toFixed(2);
  console.log("Daily increment updated to: " + display);
  process.env.AC_VERSION_INCREMENT = increment.toString();
}

function saveGlobalSettings(settings, settingsPath) {
  const dir = path.dirname(settingsPath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  fs.writeFileSync(settingsPath, JSON.stringify(settings, null, 2));
}

function saveProjectSettings(settings, settingsPath) {
  const dir = path.dirname(settingsPath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  settings.versioningStrategy.configured = true;
  fs.writeFileSync(settingsPath, JSON.stringify(settings, null, 2));
}

// ============================================================================
// MAIN ENTRY POINT - Initialize and start the cs-devops-agent worker
// ============================================================================

// Display copyright and license information immediately
console.log("\n" + "=".repeat(70));
console.log("  CS_DevOpsAgent - Intelligent Git Automation System");
console.log("  Version 2.4.0 | Build 20240930.1");
console.log("  \n  Copyright (c) 2024 SecondBrain Labs");
console.log("  Author: Sachin Dev Duggal");
console.log("  \n  Licensed under the MIT License");
console.log("  This software is provided 'as-is' without any warranty.");
console.log("  See LICENSE file for full license text.");
console.log("=".repeat(70));
console.log();

/**
 * MAIN EXECUTION FLOW:
 * 1. Setup: Find git root, change to it
 * 2. Worktree Detection: Check if we should use worktrees for agent isolation
 * 3. Daily Rollover: Check if new day, handle merges if needed
 * 4. Message File: Locate .claude-commit-msg file
 * 5. Startup Commit: Commit pending changes if message exists
 * 6. File Watcher: Monitor all files for changes
 * 7. Message Trigger: Auto-commit when message file updates
 * 8. Loop forever...
 */
(async () => {
  const { stdout: toplevel } = await run("git", ["rev-parse", "--show-toplevel"]);
  const repoRoot = toplevel.trim() || process.cwd();
  
  // Check if we should use a worktree for this agent
  const worktreeInfo = await detectAndSetupWorktree(repoRoot);
  
  if (worktreeInfo && worktreeInfo.created) {
    // If we just created a worktree, we need to switch to it
    log(`Switching to worktree at: ${worktreeInfo.path}`);
    process.chdir(worktreeInfo.path);
    
    // Update environment variables for the worktree context
    process.env.AGENT_NAME = worktreeInfo.agent;
    process.env.AC_BRANCH_PREFIX = `agent_${worktreeInfo.agent}_`;
    process.env.AC_MSG_FILE = `.${worktreeInfo.agent}-commit-msg`;
  } else if (worktreeInfo && worktreeInfo.isWorktree) {
    // Already in a worktree, just ensure we're using it
    process.chdir(worktreeInfo.path);
  } else {
    // No worktree, proceed normally
    process.chdir(repoRoot);
  }

  log(`repo=${repoRoot}`);
  log(`node=${process.version} cwd=${process.cwd()}`);
  log(`prefix=${BRANCH_PREFIX}, tz=${TZ}, style=${DATE_STYLE}, push=${PUSH}`);
  log(`static branch=${STATIC_BRANCH ?? "(dynamic daily)"}`);

  // Rollover at start (new day -> version branch bump + today's daily)
  await rolloverIfNewDay(repoRoot);

  const msgPath = resolveMsgPath(repoRoot);
  const msgExists = fs.existsSync(msgPath);
  const msgSize = msgExists ? fs.statSync(msgPath).size : 0;
  log(`message file=${path.relative(repoRoot, msgPath)} exists=${msgExists} size=${msgSize}`);
  dlog("env.AC_MSG_FILE =", MSG_FILE_ENV, " TRIGGER_ON_MSG =", TRIGGER_ON_MSG, " MSG_DEBOUNCE_MS =", MSG_DEBOUNCE_MS);

  // Startup commit (if pending + message already present + allowed)
  // Note: rolloverIfNewDay already ensured we're on the right branch
  const BRANCH = STATIC_BRANCH || `${BRANCH_PREFIX}${todayDateStr()}`;
  await ensureBranch(BRANCH);
  const pending = await hasUncommittedChanges();
  const hasMsg = msgExists && readMsgFile(msgPath).length > 0;

  if (pending && hasMsg && (!REQUIRE_MSG || msgReady(msgPath))) {
    const { count, added, modified, deleted, untracked, preview } = await summarizeStatus();
    log(`pending changes: files=${count} (A=${added}, M=${modified}, D=${deleted}, ?=${untracked}) on ${await currentBranch()}`);
    dlog("status preview:\n" + preview);
    const header = readMsgFile(msgPath).split("\n")[0].slice(0, 120);
    log(`message header: ${header}`);

    let proceed = CS_DEVOPS_AGENT_ON_START;
    if (!CS_DEVOPS_AGENT_ON_START && CONFIRM_ON_START) {
      proceed = await promptYesNo("Commit these changes now using the message file? (y/N) ");
    }
    if (proceed) await commitOnce(repoRoot, msgPath);
    else log("startup commit skipped; watching…");
  } else {
    log("watching…");
  }

  // ============================================================================
  // FILE WATCHER SETUP - Monitor for changes and trigger commits
  // ============================================================================
  
  // Canonicalize message path (resolves symlinks & correct casing on disk)
  const msgReal = fs.existsSync(msgPath) ? fs.realpathSync(msgPath) : msgPath;
  const relMsg = path.relative(repoRoot, msgReal);
  
  // Helper to compare paths (case-insensitive for compatibility)
  const samePath = (a, b) =>
    path.resolve(repoRoot, a).toLowerCase() === path.resolve(repoRoot, b).toLowerCase();
  
  let msgTimer;  // Debounce timer for message file changes
  
  // Start watching all files (except ignored patterns)
  chokidar
    .watch(["**/*", "!node_modules/**", "!.git/**"], {
    ignoreInitial: true,
    usePolling: USE_POLLING,
    interval: 500,
    ignored: ["**/__pycache__/**", "**/*.pyc", "**/.DS_Store", "**/logs/**"],
  })
  .on("all", async (evt, p) => {
    const now = Date.now();
    const isMsg = samePath(p, relMsg);
    
    // Track timing of non-message changes
    if (!isMsg) {
      lastAnyChangeTs = now;
      lastNonMsgChangeTs = now;
    }
    dlog(`watcher: ${evt} ${p}`);
    
    // ========== SPECIAL HANDLING FOR MESSAGE FILE ==========
    // When .claude-commit-msg changes, wait a bit then commit
    if (TRIGGER_ON_MSG && isMsg) {
      clearTimeout(msgTimer);
      msgTimer = setTimeout(async () => {
        if (msgReady(msgReal)) {
          await commitOnce(repoRoot, msgReal);
        } else {
          dlog("message changed but not ready yet");
        }
      }, MSG_DEBOUNCE_MS);
      return;
    }
    
    // ========== LEGACY QUIET MODE (if configured) ==========
    // Wait for quiet period before committing (no-op if AC_QUIET_MS=0)
    schedule(repoRoot, msgReal);
  });

  // ============================================================================
  // INTERACTIVE COMMAND INTERFACE - Handle user commands during execution
  // ============================================================================
  
  // Extract session ID from branch name or message file
  const sessionId = (() => {
    const branch = STATIC_BRANCH || BRANCH;
    const match = branch.match(/([a-z0-9]{4}-[a-z0-9]{4})/i);
    if (match) return match[1];
    
    // Try to get from message file name
    const msgFileName = path.basename(msgPath);
    const msgMatch = msgFileName.match(/\.devops-commit-([a-z0-9]{4}-[a-z0-9]{4})\.msg/);
    if (msgMatch) return msgMatch[1];
    
    return null;
  })();
  
  console.log("\n" + "=".repeat(60));
  console.log("[cs-devops-agent] INTERACTIVE COMMANDS AVAILABLE:");
  console.log("  help     - Show available commands");
  console.log("  status   - Show current session status");
  console.log("  settings - View and edit configuration settings");
  console.log("  verbose  - Toggle verbose/debug logging");
  console.log("  commit   - Force commit now");
  console.log("  push     - Push current branch");
  console.log("  exit     - Cleanly close session and exit");
  if (sessionId) {
    console.log(`\nSession ID: ${sessionId}`);
    console.log(`To close from another terminal: echo "CLOSE_SESSION" > .devops-command-${sessionId}`);
  }
  console.log("=".repeat(60) + "\n");
  
  // Create readline interface for interactive commands
  const rl = readline.createInterface({
    input: input,
    output: output,
    prompt: '[agent] > ',
    terminal: true
  });
  
  // Command handler
  rl.on('line', async (line) => {
    const cmd = line.trim().toLowerCase();
    
    switch (cmd) {
      case 'help':
      case 'h':
      case '?':
        console.log("\nAvailable commands:");
        console.log("  help/h/?        - Show this help");
        console.log("  status/s        - Show session status and uncommitted changes");
        console.log("  settings/config - View and edit configuration settings");
        console.log("  verbose/v       - Toggle verbose/debug logging (currently: " + (DEBUG ? "ON" : "OFF") + ")");
        console.log("  commit/c        - Force commit now (stages all changes)");
        console.log("  push/p          - Push current branch to remote");
        console.log("  exit/quit/q     - Cleanly close session and exit");
        console.log("  clear/cls       - Clear the screen");
        break;
        
      case 'status':
      case 's':
        const currentBranchName = await currentBranch();
        console.log(`\nSession Status:`);
        console.log(`  Branch: ${currentBranchName}`);
        console.log(`  Working directory: ${process.cwd()}`);
        console.log(`  Message file: ${path.basename(msgPath)}`);
        console.log(`  Auto-push: ${PUSH ? "enabled" : "disabled"}`);
        console.log(`  Debug mode: ${DEBUG ? "ON" : "OFF"}`);
        
        const statusSummary = await summarizeStatus(10);
        if (statusSummary.count > 0) {
          console.log(`\n  Uncommitted changes: ${statusSummary.count} files`);
          console.log(`    Added: ${statusSummary.added}, Modified: ${statusSummary.modified}, Deleted: ${statusSummary.deleted}, Untracked: ${statusSummary.untracked}`);
          if (statusSummary.preview) {
            console.log("\n  Preview:");
            statusSummary.preview.split('\n').forEach(line => console.log(`    ${line}`));
          }
        } else {
          console.log("\n  No uncommitted changes");
        }
        break;
        
      case 'settings':
      case 'config':
        await handleSettingsCommand();
        break;
        
      case 'verbose':
      case 'v':
        DEBUG = !DEBUG;
        console.log(`\nVerbose/Debug logging: ${DEBUG ? "ENABLED" : "DISABLED"}`);
        if (DEBUG) {
          console.log("Debug output will now be shown for all operations.");
        } else {
          console.log("Debug output disabled. Only important messages will be shown.");
        }
        break;
        
      case 'commit':
      case 'c':
        console.log("\nForcing commit...");
        const hasChanges = await hasUncommittedChanges();
        if (hasChanges) {
          // Check for message file
          let commitMsg = readMsgFile(msgPath);
          if (!commitMsg) {
            console.log("No commit message found. Enter message (or 'cancel' to abort):");
            rl.prompt();
            const msgInput = await new Promise(resolve => {
              rl.once('line', resolve);
            });
            if (msgInput.trim().toLowerCase() === 'cancel') {
              console.log("Commit cancelled.");
              break;
            }
            commitMsg = msgInput.trim() || "chore: manual commit from interactive mode";
            fs.writeFileSync(msgPath, commitMsg);
          }
          await commitOnce(repoRoot, msgPath);
        } else {
          console.log("No changes to commit.");
        }
        break;
        
      case 'push':
      case 'p':
        const branchName = await currentBranch();
        console.log(`\nPushing branch ${branchName}...`);
        const pushResult = await pushBranch(branchName);
        if (pushResult) {
          console.log("Push successful!");
        } else {
          console.log("Push failed. Check the logs above for details.");
        }
        break;
        
      case 'exit':
      case 'quit':
      case 'q':
        console.log("\nInitiating clean shutdown...");
        
        // Check for uncommitted changes
        const uncommitted = await hasUncommittedChanges();
        if (uncommitted) {
          console.log("You have uncommitted changes. Commit them before exit? (y/n)");
          rl.prompt();
          const answer = await new Promise(resolve => {
            rl.once('line', resolve);
          });
          
          if (answer.toLowerCase() === 'y' || answer.toLowerCase() === 'yes') {
            console.log("Committing changes...");
            const exitMsg = "chore: session cleanup - final commit before exit";
            fs.writeFileSync(msgPath, exitMsg);
            await commitOnce(repoRoot, msgPath);
          }
        }
        
        // Push any unpushed commits
        if (PUSH) {
          const branch = await currentBranch();
          console.log("Pushing final changes...");
          await pushBranch(branch);
        }
        
        // Clean up message file
        if (fs.existsSync(msgPath)) {
          fs.unlinkSync(msgPath);
        }
        
        // Handle worktree cleanup if in a session
        if (sessionId) {
          const currentDir = process.cwd();
          const isWorktree = currentDir.includes('local_deploy/worktrees');
          
          if (isWorktree) {
            console.log("\n" + "=".repeat(60));
            console.log("WORKTREE CLEANUP");
            console.log("=".repeat(60));
            console.log("\nThis session is running in a worktree:");
            console.log(`  ${currentDir}`);
            console.log("\nWould you like to remove this worktree now?");
            console.log("  y/yes - Remove worktree and close session");
            console.log("  n/no  - Keep worktree for later use");
            console.log("  (You can remove it later with: node src/session-coordinator.js close " + sessionId + ")");
            
            rl.prompt();
            const cleanupAnswer = await new Promise(resolve => {
              rl.once('line', resolve);
            });
            
            if (cleanupAnswer.toLowerCase() === 'y' || cleanupAnswer.toLowerCase() === 'yes') {
              console.log("\nRemoving worktree...");
              
              // Get the main repo root (parent of worktree)
              const repoRoot = path.resolve(currentDir, '../../../');
              
              try {
                // Switch to main repo directory first
                process.chdir(repoRoot);
                
                // Remove the worktree
                execSync(`git worktree remove "${currentDir}" --force`, { stdio: 'inherit' });
                console.log("✓ Worktree removed successfully");
                
                // Remove session lock file
                const lockFile = path.join(repoRoot, 'local_deploy', 'session-locks', `${sessionId}.lock`);
                if (fs.existsSync(lockFile)) {
                  fs.unlinkSync(lockFile);
                  console.log("✓ Session closed");
                }
              } catch (err) {
                console.error("\nCould not remove worktree automatically.");
                console.error("Error: " + err.message);
                console.log("\nTo remove it manually, run from the main repo:");
                console.log(`  git worktree remove "${currentDir}" --force`);
                console.log("  OR");
                console.log(`  node src/session-coordinator.js close ${sessionId}`);
              }
            } else {
              // Create cleanup marker for later
              const cleanupMarker = path.join(currentDir, '.session-cleanup-requested');
              fs.writeFileSync(cleanupMarker, JSON.stringify({
                sessionId: sessionId,
                timestamp: new Date().toISOString(),
                branch: await currentBranch(),
                worktree: currentDir
              }, null, 2));
              console.log("\n✓ Session marked for later cleanup.");
              console.log("To remove the worktree later, run from the main repo:");
              console.log(`  node src/session-coordinator.js close ${sessionId}`);
            }
          } else {
            console.log("\n✓ Session cleanup complete.");
          }
        }
        
        console.log("\nGoodbye!");
        rl.close();
        process.exit(0);
        break;
        
      case 'clear':
      case 'cls':
        console.clear();
        console.log("[cs-devops-agent] Interactive mode - Type 'help' for commands");
        break;
        
      case '':
        // Empty line, just show prompt again
        break;
        
      default:
        if (cmd) {
          console.log(`Unknown command: '${cmd}'. Type 'help' for available commands.`);
        }
        break;
    }
    
    rl.prompt();
  });
  
  // Show initial prompt
  rl.prompt();
  
  // Handle Ctrl+C gracefully
  rl.on('SIGINT', () => {
    console.log("\n\nReceived SIGINT. Type 'exit' for clean shutdown or Ctrl+C again to force quit.");
    rl.prompt();
    
    // Allow force quit on second Ctrl+C
    rl.once('SIGINT', () => {
      console.log("\nForce quitting...");
      process.exit(1);
    });
  });

})();
