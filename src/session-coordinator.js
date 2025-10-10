#!/usr/bin/env node

/**
 * ============================================================================
 * SESSION COORDINATOR - Foolproof Claude/Agent Handshake System
 * ============================================================================
 * 
 * This coordinator ensures Claude/Cline and DevOps agents work in sync.
 * It generates instructions for Claude and manages session allocation.
 * 
 * WORKFLOW:
 * 1. Start DevOps agent → generates session & instructions
 * 2. Copy instructions to Claude/Cline
 * 3. Claude follows instructions to use correct worktree
 * 4. Agent monitors that worktree for changes
 * 
 * ============================================================================
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import { execSync, spawn, fork } from 'child_process';
import crypto from 'crypto';
import readline from 'readline';
import { hasDockerConfiguration } from './docker-utils.js';
import HouseRulesManager from './house-rules-manager.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// ============================================================================
// CONFIGURATION
// ============================================================================

const CONFIG = {
  sessionsDir: 'local_deploy/sessions',
  locksDir: 'local_deploy/session-locks',
  worktreesDir: 'local_deploy/worktrees',
  instructionsDir: 'local_deploy/instructions',
  colors: {
    reset: '\x1b[0m',
    bright: '\x1b[1m',
    dim: '\x1b[2m',
    green: '\x1b[32m',
    yellow: '\x1b[33m',
    blue: '\x1b[36m',
    red: '\x1b[31m',
    magenta: '\x1b[35m',
    bgBlue: '\x1b[44m',
    bgGreen: '\x1b[42m',
    bgYellow: '\x1b[43m'
  }
};

// ============================================================================
// SESSION COORDINATOR CLASS
// ============================================================================

class SessionCoordinator {
  constructor() {
    this.repoRoot = this.getRepoRoot();
    this.sessionsPath = path.join(this.repoRoot, CONFIG.sessionsDir);
    this.locksPath = path.join(this.repoRoot, CONFIG.locksDir);
    this.worktreesPath = path.join(this.repoRoot, CONFIG.worktreesDir);
    this.instructionsPath = path.join(this.repoRoot, CONFIG.instructionsDir);
    
    // Store user settings in home directory for cross-project usage
    const homeDir = process.env.HOME || process.env.USERPROFILE;
    this.globalSettingsDir = path.join(homeDir, '.devops-agent');
    this.globalSettingsPath = path.join(this.globalSettingsDir, 'settings.json');
    
    // Store project-specific settings in local_deploy
    this.projectSettingsPath = path.join(this.repoRoot, 'local_deploy', 'project-settings.json');
    
    // Package version
    const packageJsonPath = path.join(__dirname, '../package.json');
    this.currentVersion = fs.existsSync(packageJsonPath) 
      ? JSON.parse(fs.readFileSync(packageJsonPath, 'utf8')).version 
      : '0.0.0';
    
    this.ensureDirectories();
    this.cleanupStaleLocks();
    this.ensureSettingsFile();
    // DO NOT call ensureDeveloperInitials here - it should only be called when creating new sessions
  }

  getRepoRoot() {
    try {
      // Check if we're in a submodule
      const superproject = execSync('git rev-parse --show-superproject-working-tree', { encoding: 'utf8' }).trim();
      if (superproject) {
        // We're in a submodule, use the parent repository root
        console.log(`${CONFIG.colors.dim}Running from submodule, using parent repository: ${superproject}${CONFIG.colors.reset}`);
        return superproject;
      }
      // Not in a submodule, use current repository root
      return execSync('git rev-parse --show-toplevel', { encoding: 'utf8' }).trim();
    } catch (error) {
      console.error('Error: Not in a git repository');
      process.exit(1);
    }
  }

  ensureDirectories() {
    // Ensure local project directories
    [this.sessionsPath, this.locksPath, this.worktreesPath, this.instructionsPath].forEach(dir => {
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
    });
    
    // Ensure file-coordination directory
    const fileCoordinationDir = path.join(this.repoRoot, 'local_deploy', '.file-coordination');
    const activeEditsDir = path.join(fileCoordinationDir, 'active-edits');
    const completedEditsDir = path.join(fileCoordinationDir, 'completed-edits');
    
    [fileCoordinationDir, activeEditsDir, completedEditsDir].forEach(dir => {
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
    });
    
    // Ensure global settings directory in home folder
    if (!fs.existsSync(this.globalSettingsDir)) {
      fs.mkdirSync(this.globalSettingsDir, { recursive: true });
    }
  }

  cleanupStaleLocks() {
    // Clean up locks older than 1 hour
    const oneHourAgo = Date.now() - 3600000;
    
    if (fs.existsSync(this.locksPath)) {
      const locks = fs.readdirSync(this.locksPath);
      locks.forEach(lockFile => {
        const lockPath = path.join(this.locksPath, lockFile);
        const stats = fs.statSync(lockPath);
        if (stats.mtimeMs < oneHourAgo) {
          fs.unlinkSync(lockPath);
          console.log(`${CONFIG.colors.dim}Cleaned stale lock: ${lockFile}${CONFIG.colors.reset}`);
        }
      });
    }
  }
  
  /**
   * Check for newer version on npm registry
   */
  async checkForUpdates() {
    const globalSettings = this.loadGlobalSettings();
    const now = Date.now();
    
    // Only check once per day
    if (globalSettings.lastUpdateCheck && (now - globalSettings.lastUpdateCheck) < 86400000) {
      return;
    }
    
    try {
      // Show checking message
      console.log(`${CONFIG.colors.dim}🔍 Checking for DevOps Agent updates...${CONFIG.colors.reset}`);
      
      // Check npm for latest version
      const result = execSync('npm view s9n-devops-agent version', {
        encoding: 'utf8',
        stdio: ['ignore', 'pipe', 'ignore'],
        timeout: 5000
      }).trim();
      
      // Update last check time
      globalSettings.lastUpdateCheck = now;
      this.saveGlobalSettings(globalSettings);
      
      // Compare versions
      if (result && this.compareVersions(result, this.currentVersion) > 0) {
        console.log(`\n${CONFIG.colors.yellow}▲ Update Available!${CONFIG.colors.reset}`);
        console.log(`${CONFIG.colors.dim}Current version: ${this.currentVersion}${CONFIG.colors.reset}`);
        console.log(`${CONFIG.colors.bright}Latest version:  ${result}${CONFIG.colors.reset}`);
        console.log();
        
        // Ask if user wants to update now
        const rl = readline.createInterface({
          input: process.stdin,
          output: process.stdout
        });
        
        const updateNow = await new Promise((resolve) => {
          rl.question(`${CONFIG.colors.green}Would you like to update now? (Y/n):${CONFIG.colors.reset} `, (answer) => {
            rl.close();
            resolve(answer.toLowerCase() !== 'n');
          });
        });
        
        if (updateNow) {
          console.log(`\n${CONFIG.colors.blue}Updating s9n-devops-agent...${CONFIG.colors.reset}`);
          try {
            execSync('npm install -g s9n-devops-agent@latest', {
              stdio: 'inherit',
              cwd: process.cwd()
            });
            console.log(`\n${CONFIG.colors.green}✓ Update complete! Please restart the agent.${CONFIG.colors.reset}`);
            process.exit(0);
          } catch (err) {
            console.log(`\n${CONFIG.colors.red}✗ Update failed: ${err.message}${CONFIG.colors.reset}`);
            console.log(`${CONFIG.colors.dim}You can manually update with: npm install -g s9n-devops-agent@latest${CONFIG.colors.reset}`);
          }
        } else {
          console.log(`${CONFIG.colors.dim}You can update later with: npm install -g s9n-devops-agent@latest${CONFIG.colors.reset}`);
        }
        console.log();
      } else {
        // Version is up to date
        console.log(`${CONFIG.colors.dim}✓ DevOps Agent is up to date (v${this.currentVersion})${CONFIG.colors.reset}`);
      }
    } catch (err) {
      // Silently fail - don't block execution on update check
      console.log(`${CONFIG.colors.dim}✗ Could not check for updates (offline or npm unavailable)${CONFIG.colors.reset}`);
    }
  }
  
  /**
   * Compare semantic versions
   * Returns: 1 if v1 > v2, -1 if v1 < v2, 0 if equal
   */
  compareVersions(v1, v2) {
    const parts1 = v1.split('.').map(Number);
    const parts2 = v2.split('.').map(Number);
    
    for (let i = 0; i < Math.max(parts1.length, parts2.length); i++) {
      const p1 = parts1[i] || 0;
      const p2 = parts2[i] || 0;
      
      if (p1 > p2) return 1;
      if (p1 < p2) return -1;
    }
    
    return 0;
  }
  
  /**
   * Ensure developer initials are configured globally
   */
  async ensureGlobalSetup() {
    const globalSettings = this.loadGlobalSettings();
    
    // Check if global setup is needed (developer initials)
    if (!globalSettings.developerInitials || !globalSettings.configured) {
      console.log(`\n${CONFIG.colors.yellow}First-time DevOps Agent setup!${CONFIG.colors.reset}`);
      console.log(`${CONFIG.colors.bright}Please enter your 3-letter developer initials${CONFIG.colors.reset}`);
      console.log(`${CONFIG.colors.dim}(These will be used in branch names across ALL projects)${CONFIG.colors.reset}`);
      
      const initials = await this.promptForInitials();
      globalSettings.developerInitials = initials.toLowerCase();
      globalSettings.configured = true;
      
      this.saveGlobalSettings(globalSettings);
      
      console.log(`${CONFIG.colors.green}✓${CONFIG.colors.reset} Developer initials saved globally: ${CONFIG.colors.bright}${initials}${CONFIG.colors.reset}`);
      console.log(`${CONFIG.colors.dim}Your initials are saved in ~/.devops-agent/settings.json${CONFIG.colors.reset}`);
    }
  }
  
  /**
   * Ensure house rules are set up for the project
   */
  async ensureHouseRulesSetup() {
    const houseRulesManager = new HouseRulesManager(this.repoRoot);
    
    // Check if house rules exist
    if (!houseRulesManager.houseRulesPath || !fs.existsSync(houseRulesManager.houseRulesPath)) {
      console.log(`\n${CONFIG.colors.yellow}House rules not found - setting up now...${CONFIG.colors.reset}`);
      await houseRulesManager.initialSetup();
    } else {
      // House rules exist - check if they need updating
      const status = houseRulesManager.getStatus();
      if (status.needsUpdate) {
        console.log(`\n${CONFIG.colors.yellow}House rules updates available${CONFIG.colors.reset}`);
        const updatedSections = Object.entries(status.managedSections)
          .filter(([_, info]) => info.needsUpdate)
          .map(([name]) => name);
        
        if (updatedSections.length > 0) {
          console.log(`${CONFIG.colors.dim}Sections with updates: ${updatedSections.join(', ')}${CONFIG.colors.reset}`);
          const result = await houseRulesManager.updateHouseRules();
          if (result.updated) {
            console.log(`${CONFIG.colors.green}✓${CONFIG.colors.reset} Updated ${result.totalChanges} section(s)`);
          }
        }
      }
    }
  }
  
  /**
   * Ensure project-specific version settings are configured
   */
  async ensureProjectSetup() {
    const projectSettings = this.loadProjectSettings();
    
    // Check if project setup is needed (version strategy)
    if (!projectSettings.versioningStrategy || !projectSettings.versioningStrategy.configured) {
      console.log(`\n${CONFIG.colors.yellow}First-time project setup for this repository!${CONFIG.colors.reset}`);
      console.log(`${CONFIG.colors.dim}Let's configure the versioning strategy for this project${CONFIG.colors.reset}`);
      
      const versionInfo = await this.promptForStartingVersion();
      projectSettings.versioningStrategy = {
        prefix: versionInfo.prefix,
        startMinor: versionInfo.startMinor,
        dailyIncrement: versionInfo.dailyIncrement || 1,
        configured: true
      };
      
      this.saveProjectSettings(projectSettings);
      
      // Set environment variables for the current session
      process.env.AC_VERSION_PREFIX = versionInfo.prefix;
      process.env.AC_VERSION_START_MINOR = versionInfo.startMinor.toString();
      process.env.AC_VERSION_INCREMENT = versionInfo.dailyIncrement.toString();
      
      const incrementDisplay = (versionInfo.dailyIncrement / 100).toFixed(2);
      console.log(`${CONFIG.colors.green}✓${CONFIG.colors.reset} Project versioning configured:`);
      console.log(`  Starting: ${CONFIG.colors.bright}${versionInfo.prefix}${versionInfo.startMinor}${CONFIG.colors.reset}`);
      console.log(`  Daily increment: ${CONFIG.colors.bright}${incrementDisplay}${CONFIG.colors.reset}`);
      console.log(`${CONFIG.colors.dim}Settings saved in local_deploy/project-settings.json${CONFIG.colors.reset}`);
    } else {
      // Project already configured, set environment variables
      process.env.AC_VERSION_PREFIX = projectSettings.versioningStrategy.prefix;
      process.env.AC_VERSION_START_MINOR = projectSettings.versioningStrategy.startMinor.toString();
      process.env.AC_VERSION_INCREMENT = (projectSettings.versioningStrategy.dailyIncrement || 1).toString();
    }
  }
  
  /**
   * Get developer initials from settings (no prompting)
   */
  getDeveloperInitials() {
    const settings = this.loadSettings();
    // Never prompt here, just return default if not configured
    return settings.developerInitials || 'dev';
  }
  
  /**
   * Ensure settings files exist
   */
  ensureSettingsFile() {
    // Create global settings if not exists
    if (!fs.existsSync(this.globalSettingsPath)) {
      const defaultGlobalSettings = {
        developerInitials: "",
        email: "",
        preferences: {
          defaultTargetBranch: "main",
          pushOnCommit: true,
          verboseLogging: false
        },
        configured: false
      };
      fs.writeFileSync(this.globalSettingsPath, JSON.stringify(defaultGlobalSettings, null, 2));
      console.log(`${CONFIG.colors.dim}Created global settings at ~/.devops-agent/settings.json${CONFIG.colors.reset}`);
    }
    
    // Create project settings if not exists
    if (!fs.existsSync(this.projectSettingsPath)) {
      const defaultProjectSettings = {
        versioningStrategy: {
          prefix: "v0.",
          startMinor: 20,
          configured: false
        },
        autoMergeConfig: {
          enabled: false,
          targetBranch: "main",
          strategy: "pull-request"
        }
      };
      const projectDir = path.dirname(this.projectSettingsPath);
      if (!fs.existsSync(projectDir)) {
        fs.mkdirSync(projectDir, { recursive: true });
      }
      fs.writeFileSync(this.projectSettingsPath, JSON.stringify(defaultProjectSettings, null, 2));
    }
  }
  
  /**
   * Load global settings (user-specific)
   */
  loadGlobalSettings() {
    if (fs.existsSync(this.globalSettingsPath)) {
      return JSON.parse(fs.readFileSync(this.globalSettingsPath, 'utf8'));
    }
    return {
      developerInitials: "",
      email: "",
      preferences: {},
      configured: false
    };
  }
  
  /**
   * Load project settings
   */
  loadProjectSettings() {
    if (fs.existsSync(this.projectSettingsPath)) {
      return JSON.parse(fs.readFileSync(this.projectSettingsPath, 'utf8'));
    }
    return {
      versioningStrategy: {
        prefix: "v0.",
        startMinor: 20,
        configured: false
      },
      autoMergeConfig: {}
    };
  }
  
  /**
   * Combined settings loader for compatibility
   */
  loadSettings() {
    const global = this.loadGlobalSettings();
    const project = this.loadProjectSettings();
    return {
      ...global,
      ...project,
      developerInitials: global.developerInitials,
      configured: global.configured
    };
  }
  
  /**
   * Save global settings
   */
  saveGlobalSettings(settings) {
    fs.writeFileSync(this.globalSettingsPath, JSON.stringify(settings, null, 2));
    console.log(`${CONFIG.colors.dim}Global settings saved to ~/.devops-agent/settings.json${CONFIG.colors.reset}`);
  }
  
  /**
   * Save project settings
   */
  saveProjectSettings(settings) {
    const projectDir = path.dirname(this.projectSettingsPath);
    if (!fs.existsSync(projectDir)) {
      fs.mkdirSync(projectDir, { recursive: true });
    }
    fs.writeFileSync(this.projectSettingsPath, JSON.stringify(settings, null, 2));
    console.log(`${CONFIG.colors.dim}Project settings saved to local_deploy/project-settings.json${CONFIG.colors.reset}`);
  }
  
  /**
   * Save settings (splits between global and project)
   */
  saveSettings(settings) {
    // Split settings into global and project
    const globalSettings = {
      developerInitials: settings.developerInitials,
      email: settings.email || "",
      preferences: settings.preferences || {},
      configured: settings.configured
    };
    
    const projectSettings = {
      versioningStrategy: settings.versioningStrategy,
      autoMergeConfig: settings.autoMergeConfig || {}
    };
    
    this.saveGlobalSettings(globalSettings);
    this.saveProjectSettings(projectSettings);
  }
  
  /**
   * Prompt for developer initials
   */
  promptForInitials() {
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout
    });
    
    return new Promise((resolve) => {
      const askInitials = () => {
        rl.question('Developer initials (3 letters): ', (answer) => {
          const initials = answer.trim();
          if (initials.length !== 3) {
            console.log(`${CONFIG.colors.red}Please enter exactly 3 letters${CONFIG.colors.reset}`);
            askInitials();
          } else if (!/^[a-zA-Z]+$/.test(initials)) {
            console.log(`${CONFIG.colors.red}Please use only letters${CONFIG.colors.reset}`);
            askInitials();
          } else {
            rl.close();
            resolve(initials);
          }
        });
      };
      askInitials();
    });
  }
  
  /**
   * Get list of available branches
   */
  getAvailableBranches() {
    try {
      const result = execSync('git branch -a --format="%(refname:short)"', { 
        cwd: this.repoRoot,
        encoding: 'utf8' 
      });
      
      return result.split('\n')
        .filter(branch => branch.trim())
        .filter(branch => !branch.includes('HEAD'))
        .map(branch => branch.replace('origin/', ''));
    } catch (error) {
      return ['main', 'develop', 'master'];
    }
  }
  
  /**
   * Prompt for Docker restart configuration
   */
  async promptForDockerConfig() {
    // Check if Docker setting is already configured with 'Never'
    const projectSettings = this.loadProjectSettings();
    if (projectSettings.dockerConfig && projectSettings.dockerConfig.neverAsk === true) {
      // User selected 'Never' - skip Docker configuration
      return { enabled: false, neverAsk: true };
    }
    
    if (projectSettings.dockerConfig && projectSettings.dockerConfig.alwaysEnabled === true) {
      // User selected 'Always' - use saved configuration
      console.log(`\n${CONFIG.colors.dim}Using saved Docker configuration${CONFIG.colors.reset}`);
      return projectSettings.dockerConfig;
    }
    
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout
    });
    
    console.log(`\n${CONFIG.colors.yellow}═══ Docker Configuration ═══${CONFIG.colors.reset}`);
    console.log(`${CONFIG.colors.dim}Automatically restart Docker containers after each push.${CONFIG.colors.reset}`);
    console.log();
    console.log(`${CONFIG.colors.bright}Options:${CONFIG.colors.reset}`);
    console.log(`  ${CONFIG.colors.green}Y${CONFIG.colors.reset}) Yes - Enable for this session only`);
    console.log(`  ${CONFIG.colors.red}N${CONFIG.colors.reset}) No - Disable for this session`);
    console.log(`  ${CONFIG.colors.blue}A${CONFIG.colors.reset}) Always - Enable and remember settings`);
    console.log(`  ${CONFIG.colors.magenta}Never${CONFIG.colors.reset}) Never ask again (permanently disable)`);
    
    // Ask if they want automatic Docker restarts
    const answer = await new Promise((resolve) => {
      rl.question('\nAuto-restart Docker containers after push? (Y/N/A/Never) [N]: ', (ans) => {
        resolve(ans.trim().toLowerCase());
      });
    });
    
    // Handle 'Never' option
    if (answer === 'never' || answer === 'nev') {
      rl.close();
      // Save 'Never' setting
      projectSettings.dockerConfig = {
        enabled: false,
        neverAsk: true
      };
      this.saveProjectSettings(projectSettings);
      console.log(`${CONFIG.colors.dim}Docker configuration disabled permanently. Edit local_deploy/project-settings.json to change.${CONFIG.colors.reset}`);
      return { enabled: false, neverAsk: true };
    }
    
    const autoRestart = answer === 'y' || answer === 'yes' || answer === 'a' || answer === 'always';
    const alwaysAutoRestart = answer === 'a' || answer === 'always';
    
    if (!autoRestart) {
      rl.close();
      return { enabled: false };
    }
    
    // Ask which compose file to use if multiple
    const dockerInfo = hasDockerConfiguration(process.cwd());
    let selectedComposeFile = null;
    
    if (dockerInfo.composeFiles.length > 1) {
      console.log(`\n${CONFIG.colors.bright}Select docker-compose file:${CONFIG.colors.reset}`);
      dockerInfo.composeFiles.forEach((file, index) => {
        console.log(`  ${index + 1}) ${file.name}`);
      });
      
      const fileChoice = await new Promise((resolve) => {
        rl.question(`Choose file (1-${dockerInfo.composeFiles.length}) [1]: `, (answer) => {
          const choice = parseInt(answer) || 1;
          if (choice >= 1 && choice <= dockerInfo.composeFiles.length) {
            resolve(dockerInfo.composeFiles[choice - 1]);
          } else {
            resolve(dockerInfo.composeFiles[0]);
          }
        });
      });
      
      selectedComposeFile = fileChoice.path;
    } else if (dockerInfo.composeFiles.length === 1) {
      selectedComposeFile = dockerInfo.composeFiles[0].path;
    }
    
    // Ask about rebuild preference
    const rebuild = await new Promise((resolve) => {
      rl.question('\nRebuild containers on restart? (y/N): ', (answer) => {
        resolve(answer.toLowerCase() === 'y' || answer.toLowerCase() === 'yes');
      });
    });
    
    // Ask about specific service
    const specificService = await new Promise((resolve) => {
      rl.question('\nSpecific service to restart (leave empty for all): ', (answer) => {
        resolve(answer.trim() || null);
      });
    });
    
    rl.close();
    
    const config = {
      enabled: true,
      composeFile: selectedComposeFile,
      rebuild: rebuild,
      service: specificService,
      forceRecreate: false,
      alwaysEnabled: alwaysAutoRestart
    };
    
    // Save configuration if 'Always' was selected
    if (alwaysAutoRestart) {
      projectSettings.dockerConfig = config;
      this.saveProjectSettings(projectSettings);
      console.log(`\n${CONFIG.colors.green}✓${CONFIG.colors.reset} Docker configuration saved permanently`);
    }
    
    console.log(`\n${CONFIG.colors.green}✓${CONFIG.colors.reset} Docker restart configuration:`);
    console.log(`  ${CONFIG.colors.bright}Auto-restart:${CONFIG.colors.reset} Enabled${alwaysAutoRestart ? ' (Always)' : ' (This session)'}`);
    if (selectedComposeFile) {
      console.log(`  ${CONFIG.colors.bright}Compose file:${CONFIG.colors.reset} ${path.basename(selectedComposeFile)}`);
    }
    console.log(`  ${CONFIG.colors.bright}Rebuild:${CONFIG.colors.reset} ${rebuild ? 'Yes' : 'No'}`);
    if (specificService) {
      console.log(`  ${CONFIG.colors.bright}Service:${CONFIG.colors.reset} ${specificService}`);
    }
    
    return config;
  }

  /**
   * Prompt for auto-merge configuration
   */
  async promptForMergeConfig() {
    // Check if auto-merge setting is already configured
    const projectSettings = this.loadProjectSettings();
    if (projectSettings.autoMergeConfig && projectSettings.autoMergeConfig.alwaysEnabled !== undefined) {
      // Already configured with 'Always', use saved settings
      if (projectSettings.autoMergeConfig.alwaysEnabled) {
        console.log(`\n${CONFIG.colors.dim}Using saved auto-merge configuration${CONFIG.colors.reset}`);
        return projectSettings.autoMergeConfig;
      }
    }
    
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout
    });
    
    console.log(`\n${CONFIG.colors.yellow}═══ Auto-merge Configuration ═══${CONFIG.colors.reset}`);
    console.log(`${CONFIG.colors.dim}Automatically merge your daily work branches into a target branch.${CONFIG.colors.reset}`);
    console.log();
    console.log(`${CONFIG.colors.bright}How it works:${CONFIG.colors.reset}`);
    console.log(`  • The agent creates dated branches (e.g., ${CONFIG.colors.blue}agent_dev_2025-10-01${CONFIG.colors.reset})`);
    console.log(`  • At the end of each day, your work is automatically merged`);
    console.log(`  • This keeps your target branch (main/develop) up to date`);
    console.log(`  • Prevents accumulation of stale feature branches`);
    console.log();
    console.log(`${CONFIG.colors.bright}Options:${CONFIG.colors.reset}`);
    console.log(`  ${CONFIG.colors.green}Y${CONFIG.colors.reset}) Yes - Enable for this session only`);
    console.log(`  ${CONFIG.colors.red}N${CONFIG.colors.reset}) No - Disable for this session`);
    console.log(`  ${CONFIG.colors.blue}A${CONFIG.colors.reset}) Always - Enable and remember for all sessions (24x7 operation)`);
    
    // Ask if they want auto-merge
    const answer = await new Promise((resolve) => {
      rl.question('\nEnable auto-merge? (Y/N/A) [N]: ', (ans) => {
        resolve(ans.trim().toLowerCase());
      });
    });
    
    const autoMerge = answer === 'y' || answer === 'yes' || answer === 'a' || answer === 'always';
    const alwaysAutoMerge = answer === 'a' || answer === 'always';
    
    if (!autoMerge) {
      rl.close();
      console.log(`${CONFIG.colors.dim}Auto-merge disabled. You'll need to manually merge your work.${CONFIG.colors.reset}`);
      return { autoMerge: false, alwaysEnabled: false };
    }
    
    // Get available branches
    const branches = this.getAvailableBranches();
    const uniqueBranches = [...new Set(branches)].slice(0, 10); // Show max 10 branches
    
    console.log(`\n${CONFIG.colors.bright}Which branch should today's work be merged INTO?${CONFIG.colors.reset}`);
    console.log(`${CONFIG.colors.dim}(e.g., main, develop, v2.0, feature/xyz)${CONFIG.colors.reset}\n`);
    
    console.log(`${CONFIG.colors.bright}Available branches:${CONFIG.colors.reset}`);
    uniqueBranches.forEach((branch, index) => {
      const isDefault = branch === 'main' || branch === 'master' || branch === 'develop';
      const marker = isDefault ? ` ${CONFIG.colors.green}⭐ (recommended)${CONFIG.colors.reset}` : '';
      console.log(`  ${index + 1}) ${branch}${marker}`);
    });
    console.log(`  0) Enter a different branch name`);
    
    // Ask for target branch
    const targetBranch = await new Promise((resolve) => {
      rl.question(`\nSelect target branch to merge INTO (1-${uniqueBranches.length}, or 0): `, async (answer) => {
        const choice = parseInt(answer);
        if (choice === 0) {
          rl.question('Enter custom branch name: ', (customBranch) => {
            resolve(customBranch.trim());
          });
        } else if (choice >= 1 && choice <= uniqueBranches.length) {
          resolve(uniqueBranches[choice - 1]);
        } else {
          resolve('main'); // Default to main if invalid choice
        }
      });
    });
    
    // Ask for merge strategy
    console.log(`\n${CONFIG.colors.bright}Merge strategy:${CONFIG.colors.reset}`);
    console.log(`  1) Create pull request (recommended)`);
    console.log(`  2) Direct merge (when tests pass)`);
    console.log(`  3) Squash and merge`);
    
    const strategy = await new Promise((resolve) => {
      rl.question('Select merge strategy (1-3) [1]: ', (answer) => {
        const choice = parseInt(answer) || 1;
        switch(choice) {
          case 2:
            resolve('direct');
            break;
          case 3:
            resolve('squash');
            break;
          default:
            resolve('pull-request');
        }
      });
    });
    
    rl.close();
    
    const config = {
      autoMerge: true,
      targetBranch,
      strategy,
      requireTests: strategy !== 'pull-request',
      alwaysEnabled: alwaysAutoMerge
    };
    
    console.log(`\n${CONFIG.colors.green}✓${CONFIG.colors.reset} Auto-merge configuration saved:`);
    console.log(`  ${CONFIG.colors.bright}Today's work${CONFIG.colors.reset} → ${CONFIG.colors.bright}${targetBranch}${CONFIG.colors.reset}`);
    console.log(`  Strategy: ${CONFIG.colors.bright}${strategy}${CONFIG.colors.reset}`);
    
    if (alwaysAutoMerge) {
      console.log(`  ${CONFIG.colors.blue}Mode: Always enabled${CONFIG.colors.reset} (24x7 operation - auto rollover)`);
      // Save to project settings
      projectSettings.autoMergeConfig = config;
      this.saveProjectSettings(projectSettings);
    } else {
      console.log(`  ${CONFIG.colors.dim}Mode: This session only${CONFIG.colors.reset}`);
    }
    
    console.log(`${CONFIG.colors.dim}  (Daily branches will be merged into ${targetBranch} at end of day)${CONFIG.colors.reset}`);
    
    return config;
  }
  
  /**
   * Prompt for starting version configuration
   */
  async promptForStartingVersion() {
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout
    });
    
    console.log(`\n${CONFIG.colors.yellow}Version Configuration${CONFIG.colors.reset}`);
    console.log(`${CONFIG.colors.dim}Set the starting version for this codebase${CONFIG.colors.reset}`);
    
    // Ask if inheriting existing codebase
    const isInherited = await new Promise((resolve) => {
      rl.question('\nIs this an existing/inherited codebase? (y/N): ', (answer) => {
        resolve(answer.toLowerCase() === 'y' || answer.toLowerCase() === 'yes');
      });
    });
    
    let prefix = 'v0.';
    let startMinor = 20; // Default v0.20
    let dailyIncrement = 1; // Default 0.01 per day
    
    if (isInherited) {
      console.log(`\n${CONFIG.colors.bright}Current Version Examples:${CONFIG.colors.reset}`);
      console.log('  v1.5  → Enter: v1. and 50');
      console.log('  v2.3  → Enter: v2. and 30');
      console.log('  v0.8  → Enter: v0. and 80');
      console.log('  v3.12 → Enter: v3. and 120');
      
      // Get version prefix
      prefix = await new Promise((resolve) => {
        rl.question('\nEnter version prefix (e.g., v1., v2., v0.) [v0.]: ', (answer) => {
          const cleaned = answer.trim() || 'v0.';
          // Ensure it ends with a dot
          resolve(cleaned.endsWith('.') ? cleaned : cleaned + '.');
        });
      });
      
      // Get starting minor version
      const currentVersion = await new Promise((resolve) => {
        rl.question(`Current version number (e.g., for ${prefix}5 enter 50, for ${prefix}12 enter 120) [20]: `, (answer) => {
          const num = parseInt(answer.trim());
          resolve(isNaN(num) ? 20 : num);
        });
      });
      
      // Next version will be current + 1
      startMinor = currentVersion + 1;
      
      console.log(`\n${CONFIG.colors.green}✓${CONFIG.colors.reset} Next version will be: ${CONFIG.colors.bright}${prefix}${startMinor}${CONFIG.colors.reset}`);
      console.log(`${CONFIG.colors.dim}(This represents ${prefix}${(startMinor/100).toFixed(2)} in semantic versioning)${CONFIG.colors.reset}`);
    } else {
      // New project
      console.log(`\n${CONFIG.colors.green}✓${CONFIG.colors.reset} Starting new project at: ${CONFIG.colors.bright}v0.20${CONFIG.colors.reset}`);
    }
    
    // Ask for daily increment preference
    console.log(`\n${CONFIG.colors.yellow}Daily Version Increment${CONFIG.colors.reset}`);
    console.log(`${CONFIG.colors.dim}How much should the version increment each day?${CONFIG.colors.reset}`);
    console.log('  1) 0.01 per day (v0.20 → v0.21 → v0.22) [default]');
    console.log('  2) 0.1 per day  (v0.20 → v0.30 → v0.40)');
    console.log('  3) 0.2 per day  (v0.20 → v0.40 → v0.60)');
    console.log('  4) Custom increment');
    
    const incrementChoice = await new Promise((resolve) => {
      rl.question('\nSelect increment (1-4) [1]: ', (answer) => {
        const choice = parseInt(answer.trim()) || 1;
        resolve(choice);
      });
    });
    
    switch (incrementChoice) {
      case 2:
        dailyIncrement = 10; // 0.1
        break;
      case 3:
        dailyIncrement = 20; // 0.2
        break;
      case 4:
        dailyIncrement = await new Promise((resolve) => {
          rl.question('Enter increment value (e.g., 5 for 0.05, 25 for 0.25): ', (answer) => {
            const value = parseInt(answer.trim());
            resolve(isNaN(value) || value <= 0 ? 1 : value);
          });
        });
        break;
      default:
        dailyIncrement = 1; // 0.01
    }
    
    const incrementDisplay = (dailyIncrement / 100).toFixed(2);
    console.log(`\n${CONFIG.colors.green}✓${CONFIG.colors.reset} Daily increment set to: ${CONFIG.colors.bright}${incrementDisplay}${CONFIG.colors.reset}`);
    console.log(`${CONFIG.colors.dim}(${prefix}${startMinor} → ${prefix}${startMinor + dailyIncrement} → ${prefix}${startMinor + dailyIncrement * 2}...)${CONFIG.colors.reset}`);
    
    rl.close();
    
    return {
      prefix,
      startMinor,
      dailyIncrement
    };
  }

  generateSessionId() {
    const timestamp = Date.now().toString(36).slice(-4);
    const random = crypto.randomBytes(2).toString('hex');
    return `${timestamp}-${random}`;
  }

  /**
   * Create a new session and generate Claude instructions
   */
  async createSession(options = {}) {
    // Check for updates (once per day)
    await this.checkForUpdates();
    
    // Ensure both global and project setup are complete
    await this.ensureGlobalSetup();     // Developer initials (once per user)
    await this.ensureProjectSetup();    // Version strategy (once per project)
    await this.ensureHouseRulesSetup(); // House rules setup (once per project)
    
    const sessionId = this.generateSessionId();
    const task = options.task || 'development';
    const agentType = options.agent || 'claude';
    const devInitials = this.getDeveloperInitials();
    
    console.log(`\n${CONFIG.colors.bgBlue}${CONFIG.colors.bright} Creating New Session ${CONFIG.colors.reset}`);
    console.log(`${CONFIG.colors.blue}Session ID:${CONFIG.colors.reset} ${CONFIG.colors.bright}${sessionId}${CONFIG.colors.reset}`);
    console.log(`${CONFIG.colors.blue}Task:${CONFIG.colors.reset} ${task}`);
    console.log(`${CONFIG.colors.blue}Agent:${CONFIG.colors.reset} ${agentType}`);
    console.log(`${CONFIG.colors.blue}Developer:${CONFIG.colors.reset} ${devInitials}`);
    
    // Ask for auto-merge configuration
    const mergeConfig = await this.promptForMergeConfig();
    
    // Check for Docker configuration and ask about restart preference
    let dockerConfig = null;
    
    // Check if user has already set "Never ask" preference (ONCE, at the top)
    const projectSettings = this.loadProjectSettings();
    if (projectSettings.dockerConfig && projectSettings.dockerConfig.neverAsk === true) {
      // User selected 'Never' - skip Docker configuration entirely
      dockerConfig = { enabled: false, neverAsk: true };
    } else {
      const dockerInfo = hasDockerConfiguration(process.cwd());
      
      if (dockerInfo.hasCompose || dockerInfo.hasDockerfile) {
        // Docker detected - show what we found and ask about restart preferences
        console.log(`\n${CONFIG.colors.yellow}Docker Configuration Detected${CONFIG.colors.reset}`);
        
        if (dockerInfo.hasCompose) {
          console.log(`${CONFIG.colors.dim}Found docker-compose files:${CONFIG.colors.reset}`);
          dockerInfo.composeFiles.forEach(file => {
            console.log(`  • ${file.name} ${CONFIG.colors.dim}(in ${file.location})${CONFIG.colors.reset}`);
          });
        }
        
        if (dockerInfo.hasDockerfile) {
          console.log(`${CONFIG.colors.dim}Found Dockerfile${CONFIG.colors.reset}`);
        }
        
        // promptForDockerConfig already handles Y/N/A/Never options
        dockerConfig = await this.promptForDockerConfig();
      } else if (projectSettings.dockerConfig && projectSettings.dockerConfig.alwaysEnabled) {
        // Use saved configuration even if Docker not auto-detected
        console.log(`\n${CONFIG.colors.dim}Using saved Docker configuration${CONFIG.colors.reset}`);
        dockerConfig = projectSettings.dockerConfig;
      } else {
        // No Docker detected and no saved preference - ask user
        const rl = readline.createInterface({
          input: process.stdin,
          output: process.stdout
        });
        
        console.log(`\n${CONFIG.colors.yellow}No Docker Configuration Found${CONFIG.colors.reset}`);
        console.log(`${CONFIG.colors.dim}I couldn't find any docker-compose files in:${CONFIG.colors.reset}`);
        console.log(`${CONFIG.colors.dim}  • Project directory${CONFIG.colors.reset}`);
        console.log(`${CONFIG.colors.dim}  • Parent directory${CONFIG.colors.reset}`);
        console.log(`${CONFIG.colors.dim}  • Parent/Infrastructure or parent/infrastructure${CONFIG.colors.reset}`);
        console.log();
        console.log(`${CONFIG.colors.bright}Options:${CONFIG.colors.reset}`);
        console.log(`  ${CONFIG.colors.green}Y${CONFIG.colors.reset}) Yes - I have a Docker setup to configure`);
        console.log(`  ${CONFIG.colors.red}N${CONFIG.colors.reset}) No - Skip for this session`);
        console.log(`  ${CONFIG.colors.magenta}Never${CONFIG.colors.reset}) Never ask again (permanently disable)`);
        
        const answer = await new Promise((resolve) => {
          rl.question(`\nDo you have a Docker setup? (Y/N/Never) [N]: `, (ans) => {
            resolve(ans.trim().toLowerCase());
          });
        });
        
        // Handle 'Never' option
        if (answer === 'never' || answer === 'nev') {
          rl.close();
          projectSettings.dockerConfig = {
            enabled: false,
            neverAsk: true
          };
          this.saveProjectSettings(projectSettings);
          console.log(`${CONFIG.colors.dim}Docker configuration disabled permanently. Edit local_deploy/project-settings.json to change.${CONFIG.colors.reset}`);
          dockerConfig = { enabled: false, neverAsk: true };
        } else {
          const hasDocker = answer === 'y' || answer === 'yes';
        
          if (hasDocker) {
            const dockerPath = await new Promise((resolve) => {
              rl.question(`\nEnter the full path to your docker-compose file: `, (answer) => {
                resolve(answer.trim());
              });
            });
            
            if (dockerPath && fs.existsSync(dockerPath)) {
              console.log(`${CONFIG.colors.green}✓${CONFIG.colors.reset} Found docker-compose file at: ${dockerPath}`);
              
              // Ask about rebuild and service preferences
              const rebuild = await new Promise((resolve) => {
                rl.question('\nRebuild containers on restart? (y/N): ', (answer) => {
                  resolve(answer.toLowerCase() === 'y' || answer.toLowerCase() === 'yes');
                });
              });
              
              const specificService = await new Promise((resolve) => {
                rl.question('\nSpecific service to restart (leave empty for all): ', (answer) => {
                  resolve(answer.trim() || null);
                });
              });
              
              dockerConfig = {
                enabled: true,
                composeFile: dockerPath,
                rebuild: rebuild,
                service: specificService,
                forceRecreate: false
              };
              
              console.log(`\n${CONFIG.colors.green}✓${CONFIG.colors.reset} Docker restart configuration:`);
              console.log(`  ${CONFIG.colors.bright}Auto-restart:${CONFIG.colors.reset} Enabled`);
              console.log(`  ${CONFIG.colors.bright}Compose file:${CONFIG.colors.reset} ${path.basename(dockerPath)}`);
              console.log(`  ${CONFIG.colors.bright}Rebuild:${CONFIG.colors.reset} ${rebuild ? 'Yes' : 'No'}`);
              if (specificService) {
                console.log(`  ${CONFIG.colors.bright}Service:${CONFIG.colors.reset} ${specificService}`);
              }
            } else if (dockerPath) {
              console.log(`${CONFIG.colors.red}✗${CONFIG.colors.reset} File not found: ${dockerPath}`);
              console.log(`${CONFIG.colors.dim}Skipping Docker configuration${CONFIG.colors.reset}`);
            }
          } else {
            console.log(`${CONFIG.colors.dim}Skipping Docker configuration${CONFIG.colors.reset}`);
          }
          
          rl.close();
        }
      }
    }
    // Create worktree with developer initials first in the name
    const worktreeName = `${devInitials}-${agentType}-${sessionId}-${task.replace(/\s+/g, '-')}`;
    const worktreePath = path.join(this.worktreesPath, worktreeName);
    const branchName = `${devInitials}/${agentType}/${sessionId}/${task.replace(/\s+/g, '-')}`;
    
    try {
      // Detect if we're in a submodule and get the parent repository
      let repoRoot = process.cwd();
      let isSubmodule = false;
      let parentRemote = null;
      
      try {
        // Check if we're in a submodule
        execSync('git rev-parse --show-superproject-working-tree', { stdio: 'pipe' });
        const superproject = execSync('git rev-parse --show-superproject-working-tree', { encoding: 'utf8' }).trim();
        
        if (superproject) {
          isSubmodule = true;
          // Get the parent repository's remote
          parentRemote = execSync(`git -C "${superproject}" remote get-url origin`, { encoding: 'utf8' }).trim();
          console.log(`\n${CONFIG.colors.yellow}Detected submodule - will configure worktree for parent repository${CONFIG.colors.reset}`);
          console.log(`${CONFIG.colors.dim}Parent repository: ${superproject}${CONFIG.colors.reset}`);
          console.log(`${CONFIG.colors.dim}Parent remote: ${parentRemote}${CONFIG.colors.reset}`);
        }
      } catch (e) {
        // Not a submodule, continue normally
      }
      
      // Create worktree
      console.log(`\n${CONFIG.colors.yellow}Creating worktree...${CONFIG.colors.reset}`);
      execSync(`git worktree add -b ${branchName} "${worktreePath}" HEAD`, { stdio: 'pipe' });
      console.log(`${CONFIG.colors.green}✓${CONFIG.colors.reset} Worktree created at: ${worktreePath}`);
      
      // If we're in a submodule, set up the correct remote for the worktree
      if (isSubmodule && parentRemote) {
        console.log(`${CONFIG.colors.yellow}Configuring worktree to use parent repository remote...${CONFIG.colors.reset}`);
        // Remove the default origin that points to the submodule
        try {
          execSync(`git -C "${worktreePath}" remote remove origin`, { stdio: 'pipe' });
        } catch (e) {
          // Origin might not exist, continue
        }
        // Add the parent repository as origin
        execSync(`git -C "${worktreePath}" remote add origin ${parentRemote}`, { stdio: 'pipe' });
        console.log(`${CONFIG.colors.green}✓${CONFIG.colors.reset} Worktree configured to push to parent repository`);
      }
      
      // Create session lock
      const lockData = {
        sessionId,
        agentType,
        task,
        worktreePath,
        branchName,
        created: new Date().toISOString(),
        status: 'active',
        pid: process.pid,
        developerInitials: devInitials,
        mergeConfig: mergeConfig,
        dockerConfig: dockerConfig
      };
      
      const lockFile = path.join(this.locksPath, `${sessionId}.lock`);
      fs.writeFileSync(lockFile, JSON.stringify(lockData, null, 2));
      
      // Generate Claude instructions
      const instructions = this.generateClaudeInstructions(lockData);
      
      // Save instructions to file
      const instructionsFile = path.join(this.instructionsPath, `${sessionId}.md`);
      fs.writeFileSync(instructionsFile, instructions.markdown);
      
      // DON'T display instructions here - they will be shown after agent starts
      // to avoid showing them before the agent's interactive commands
      
      // Create session config in worktree
      this.createWorktreeConfig(worktreePath, lockData);
      
      // Store instructions in lockData so createAndStart can access them
      lockData.instructions = instructions;
      
      return {
        sessionId,
        worktreePath,
        branchName,
        lockFile,
        instructionsFile,
        task
      };
      
    } catch (error) {
      console.error(`${CONFIG.colors.red}Failed to create session: ${error.message}${CONFIG.colors.reset}`);
      process.exit(1);
    }
  }

  /**
   * Generate instructions for the coding agent
   */
  generateClaudeInstructions(sessionData) {
    const { sessionId, worktreePath, branchName, task } = sessionData;
    
    const plaintext = `
SESSION_ID: ${sessionId}
WORKTREE: ${worktreePath}
BRANCH: ${branchName}
TASK: ${task}

INSTRUCTIONS:
1. Change to worktree directory: cd "${worktreePath}"
2. Verify branch: git branch --show-current
3. Make your changes for: ${task}
4. Write commit message to: .devops-commit-${sessionId}.msg
5. The DevOps agent will auto-commit and push your changes
`;

    const markdown = `# DevOps Session Instructions

## Session Information
- **Session ID:** \`${sessionId}\`
- **Task:** ${task}
- **Worktree Path:** \`${worktreePath}\`
- **Branch:** \`${branchName}\`

## 🚨 CRITICAL: File Coordination Protocol

**BEFORE editing any files, you MUST:**

1. **Declare your intent** by creating:
   \`\`\`json
   // File: ${path.join(this.repoRoot, 'local_deploy/.file-coordination/active-edits')}/<agent>-${sessionId}.json
   {
     "agent": "<your-name>",
     "session": "${sessionId}",
     "files": ["list", "files", "to", "edit"],
     "operation": "edit",
     "reason": "${task}",
     "declaredAt": "<ISO-8601-timestamp>",
     "estimatedDuration": 300
   }
   \`\`\`

2. **Check for conflicts** - read all files in \`${path.join(this.repoRoot, 'local_deploy/.file-coordination/active-edits')}\`
3. **Only proceed if no conflicts** - wait or choose different files if blocked
4. **Release files when done** - delete your declaration after edits

## Instructions for Your Coding Agent

### Step 1: Navigate to Your Worktree
\`\`\`bash
cd "${worktreePath}"
\`\`\`

### Step 2: Verify You're on the Correct Branch
\`\`\`bash
git branch --show-current
# Should output: ${branchName}
\`\`\`

### Step 3: Declare Files Before Editing
Create your declaration in \`${path.join(this.repoRoot, 'local_deploy/.file-coordination/active-edits')}\`

### Step 4: Work on Your Task
Make changes for: **${task}**

### Step 5: Commit Your Changes
Write your commit message to the session-specific file:
\`\`\`bash
echo "feat: your commit message here" > .devops-commit-${sessionId}.msg
\`\`\`

### Step 6: Release Your File Locks
Delete your declaration from \`${path.join(this.repoRoot, 'local_deploy/.file-coordination/active-edits')}\`

### Step 7: Automatic Processing
The DevOps agent will automatically:
- Detect your changes
- Check for coordination conflicts
- Read your commit message
- Commit and push to the remote repository
- Clear the message file

## Session Status
- Created: ${new Date().toISOString()}
- Status: Active
- Agent: Monitoring

## Important Notes
- All changes should be made in the worktree directory
- Do not switch branches manually
- The agent is watching for changes in this specific worktree
`;

    const shellCommand = `cd "${worktreePath}" && echo "Session ${sessionId} ready"`;

    return {
      plaintext,
      markdown,
      shellCommand,
      worktreePath,
      sessionId
    };
  }

  /**
   * Display instructions in a user-friendly format
   */
  displayInstructions(instructions, sessionId, task) {
    // Get the parent repository root (where the session was started from)
    const parentRepoRoot = process.cwd();
    const houseRulesPath = path.join(parentRepoRoot, 'houserules.md');
    
    console.log(`\n${CONFIG.colors.bgGreen}${CONFIG.colors.bright} Instructions for Your Coding Agent ${CONFIG.colors.reset}\n`);
    
    // Clean separator
    console.log(`${CONFIG.colors.yellow}══════════════════════════════════════════════════════════════${CONFIG.colors.reset}`);
    console.log(`${CONFIG.colors.bright}COPY AND PASTE THIS ENTIRE BLOCK INTO YOUR CODING AGENT BEFORE YOUR PROMPT:${CONFIG.colors.reset}`);
    console.log(`${CONFIG.colors.yellow}──────────────────────────────────────────────────────────────${CONFIG.colors.reset}`);
    console.log();
    
    // The actual copyable content - no colors inside
    console.log(`I'm working in a DevOps-managed session with the following setup:`);
    console.log(`- Session ID: ${sessionId}`);
    console.log(`- Working Directory: ${instructions.worktreePath}`);
    console.log(`- Task: ${task || 'development'}`);
    console.log(``);
    console.log(`Please switch to this directory before making any changes:`);
    console.log(`cd "${instructions.worktreePath}"`);
    console.log(``);
    console.log(`⚠️ FILE COORDINATION (MANDATORY):`);
    console.log(`Shared coordination directory: local_deploy/.file-coordination/`);
    console.log(``);
    console.log(`BEFORE editing ANY files:`);
    console.log(`1. Check for conflicts: ls ../../../local_deploy/.file-coordination/active-edits/`);
    console.log(`2. Create declaration: local_deploy/.file-coordination/active-edits/<agent>-${sessionId}.json`);
    console.log(``);
    console.log(`Example declaration:`);
    console.log(`{`);
    console.log(`  "agent": "claude", "session": "${sessionId}",`);
    console.log(`  "files": ["src/app.js"], "operation": "edit",`);
    console.log(`  "reason": "${task}", "declaredAt": "${new Date().toISOString()}",`);
    console.log(`  "estimatedDuration": 300`);
    console.log(`}`);
    console.log(``);
    console.log(`Write commit messages to: .devops-commit-${sessionId}.msg`);
    console.log(`The DevOps agent will automatically commit and push changes.`);
    console.log();
    
    console.log(`${CONFIG.colors.yellow}══════════════════════════════════════════════════════════════${CONFIG.colors.reset}`);
    console.log();
    
    // Pause before continuing
    console.log(`${CONFIG.colors.dim}Press Enter to start the DevOps agent monitoring...${CONFIG.colors.reset}`);
    
    // Status info
    console.log(`${CONFIG.colors.green}✓ DevOps agent is starting...${CONFIG.colors.reset}`);
    console.log(`${CONFIG.colors.dim}Full instructions saved to: ${CONFIG.instructionsDir}/${sessionId}.md${CONFIG.colors.reset}`);
  }

  /**
   * Create configuration in the worktree
   */
  createWorktreeConfig(worktreePath, sessionData) {
    // NOTE: File coordination now uses shared local_deploy/.file-coordination/
    // No need to create per-worktree coordination directories
    
    // Session config file
    const configPath = path.join(worktreePath, '.devops-session.json');
    fs.writeFileSync(configPath, JSON.stringify(sessionData, null, 2));
    
    // Commit message file
    const msgFile = path.join(worktreePath, `.devops-commit-${sessionData.sessionId}.msg`);
    fs.writeFileSync(msgFile, '');
    
    // VS Code settings
    const vscodeDir = path.join(worktreePath, '.vscode');
    if (!fs.existsSync(vscodeDir)) {
      fs.mkdirSync(vscodeDir, { recursive: true });
    }
    
    const settings = {
      'window.title': `${sessionData.agentType.toUpperCase()} Session ${sessionData.sessionId} - ${sessionData.task}`,
      'terminal.integrated.env.osx': {
        'DEVOPS_SESSION_ID': sessionData.sessionId,
        'DEVOPS_WORKTREE': path.basename(worktreePath),
        'DEVOPS_BRANCH': sessionData.branchName,
        'AC_MSG_FILE': `.devops-commit-${sessionData.sessionId}.msg`,
        'AC_BRANCH_PREFIX': `${sessionData.developerInitials || 'dev'}_${sessionData.agentType}_${sessionData.sessionId}_`
      }
    };
    
    fs.writeFileSync(
      path.join(vscodeDir, 'settings.json'),
      JSON.stringify(settings, null, 2)
    );
    
    // Create a README for the session
    const readme = `# DevOps Session: ${sessionData.sessionId}

## Task
${sessionData.task}

## Session Details
- **Session ID:** ${sessionData.sessionId}
- **Branch:** ${sessionData.branchName}
- **Created:** ${sessionData.created}
- **Agent Type:** ${sessionData.agentType}

## How to Use
1. Make your changes in this directory
2. Write commit message to: \`.devops-commit-${sessionData.sessionId}.msg\`
3. The DevOps agent will handle the rest

## Status
The DevOps agent is monitoring this worktree for changes.
`;
    
    fs.writeFileSync(path.join(worktreePath, 'SESSION_README.md'), readme);
    
    // Update .gitignore in the worktree to exclude session files
    const gitignorePath = path.join(worktreePath, '.gitignore');
    let gitignoreContent = '';
    
    // Read existing gitignore if it exists
    if (fs.existsSync(gitignorePath)) {
      gitignoreContent = fs.readFileSync(gitignorePath, 'utf8');
    }
    
    // Session file patterns to ignore
    const sessionPatterns = [
      '# DevOps session management files',
      '.devops-commit-*.msg',
      '.devops-session.json', 
      'SESSION_README.md',
      '.session-cleanup-requested',
      '.worktree-session',
      '.agent-config',
      '.session-*',
      '.devops-command-*'
    ];
    
    // Check if we need to add patterns
    let needsUpdate = false;
    for (const pattern of sessionPatterns) {
      if (!gitignoreContent.includes(pattern)) {
        needsUpdate = true;
        break;
      }
    }
    
    if (needsUpdate) {
      // Add session patterns to gitignore
      if (!gitignoreContent.endsWith('\n') && gitignoreContent.length > 0) {
        gitignoreContent += '\n';
      }
      gitignoreContent += '\n' + sessionPatterns.join('\n') + '\n';
      fs.writeFileSync(gitignorePath, gitignoreContent);
      console.log(`${CONFIG.colors.green}✓${CONFIG.colors.reset} Updated .gitignore to exclude session files`);
    }
    
    console.log(`${CONFIG.colors.dim}Session files created but not committed (they are gitignored)${CONFIG.colors.reset}`);
    
    // Note: We do NOT commit these files - they're for session management only
    // This prevents the "uncommitted changes" issue when starting sessions
  }

  /**
   * Request a session (for Claude to call)
   */
  async requestSession(agentName = 'claude') {
    console.log(`\n${CONFIG.colors.magenta}[${agentName.toUpperCase()}]${CONFIG.colors.reset} Requesting session...`);
    
    // Check for available unlocked sessions
    const availableSession = this.findAvailableSession();
    
    if (availableSession) {
      console.log(`${CONFIG.colors.green}✓${CONFIG.colors.reset} Found available session: ${availableSession.sessionId}`);
      return this.claimSession(availableSession, agentName);
    } else {
      console.log(`${CONFIG.colors.yellow}No available sessions. Creating new one...${CONFIG.colors.reset}`);
      const task = await this.promptForTask();
      return this.createSession({ task, agent: agentName });
    }
  }

  /**
   * Find an available unclaimed session
   */
  findAvailableSession() {
    if (!fs.existsSync(this.locksPath)) {
      return null;
    }
    
    const locks = fs.readdirSync(this.locksPath);
    
    for (const lockFile of locks) {
      const lockPath = path.join(this.locksPath, lockFile);
      const lockData = JSON.parse(fs.readFileSync(lockPath, 'utf8'));
      
      // Check if session is available (not claimed)
      if (lockData.status === 'waiting' && !lockData.claimedBy) {
        return lockData;
      }
    }
    
    return null;
  }

  /**
   * Claim a session for an agent
   */
  claimSession(session, agentName) {
    session.claimedBy = agentName;
    session.claimedAt = new Date().toISOString();
    session.status = 'active';
    
    const lockFile = path.join(this.locksPath, `${session.sessionId}.lock`);
    fs.writeFileSync(lockFile, JSON.stringify(session, null, 2));
    
    const instructions = this.generateClaudeInstructions(session);
    // Don't display instructions here - they'll be shown after agent starts
    
    return {
      ...session,
      instructions: instructions
    };
  }

  /**
   * Start the DevOps agent for a session
   */
  async startAgent(sessionId, options = {}) {
    const lockFile = path.join(this.locksPath, `${sessionId}.lock`);
    
    if (!fs.existsSync(lockFile)) {
      console.error(`${CONFIG.colors.red}Session not found: ${sessionId}${CONFIG.colors.reset}`);
      return;
    }
    
    const sessionData = JSON.parse(fs.readFileSync(lockFile, 'utf8'));
    
    console.log(`\n${CONFIG.colors.bgYellow}${CONFIG.colors.bright} Starting DevOps Agent ${CONFIG.colors.reset}`);
    console.log(`${CONFIG.colors.blue}Session:${CONFIG.colors.reset} ${sessionId}`);
    console.log(`${CONFIG.colors.blue}Worktree:${CONFIG.colors.reset} ${sessionData.worktreePath}`);
    console.log(`${CONFIG.colors.blue}Branch:${CONFIG.colors.reset} ${sessionData.branchName}`);
    
    // Update session status
    sessionData.agentStarted = new Date().toISOString();
    sessionData.agentPid = process.pid;
    fs.writeFileSync(lockFile, JSON.stringify(sessionData, null, 2));
    
    // Get developer initials from session data or settings (NO PROMPTING HERE)
    const devInitials = sessionData.developerInitials || this.getDeveloperInitials() || 'dev';
    const settings = this.loadSettings();
    const projectSettings = this.loadProjectSettings();
    
    // Start the agent
    const env = {
      ...process.env,
      DEVOPS_SESSION_ID: sessionId,
      AC_MSG_FILE: `.devops-commit-${sessionId}.msg`,
      AC_BRANCH_PREFIX: `${devInitials}_${sessionData.agentType}_${sessionId}_`,
      AC_WORKING_DIR: sessionData.worktreePath,
      // Don't set AC_BRANCH - let the agent create daily branches within the worktree
      // AC_BRANCH would force a static branch, preventing daily/weekly rollover
      AC_PUSH: 'true',  // Enable auto-push for session branches
      AC_DAILY_PREFIX: `${devInitials}_${sessionData.agentType}_${sessionId}_`,  // Daily branches with dev initials first
      AC_TZ: process.env.AC_TZ || 'Asia/Dubai',  // Preserve timezone for daily branches
      AC_DATE_STYLE: process.env.AC_DATE_STYLE || 'dash',  // Preserve date style
      // Apply version configuration if set
      ...(projectSettings.versioningStrategy?.prefix && { AC_VERSION_PREFIX: projectSettings.versioningStrategy.prefix }),
      ...(projectSettings.versioningStrategy?.startMinor && { AC_VERSION_START_MINOR: projectSettings.versioningStrategy.startMinor.toString() })
    };
    
    const agentScript = path.join(__dirname, 'cs-devops-agent-worker.js');
    
    console.log(`\n${CONFIG.colors.green}Agent starting...${CONFIG.colors.reset}`);
    console.log(`${CONFIG.colors.dim}Monitoring: ${sessionData.worktreePath}${CONFIG.colors.reset}`);
    console.log(`${CONFIG.colors.dim}Message file: .devops-commit-${sessionId}.msg${CONFIG.colors.reset}`);
    
    // Use fork for better Node.js script handling
    // Fork automatically uses the same node executable and handles paths better
    const child = fork(agentScript, [], {
      cwd: sessionData.worktreePath,
      env,
      stdio: 'inherit',
      silent: false
    });
    
    // Wait for agent to initialize and display its interactive commands
    // Then show the copy-paste instructions
    setTimeout(async () => {
      console.log('\n'); // Add spacing
      
      // Generate and display instructions
      const instructions = this.generateClaudeInstructions(sessionData);
      this.displayInstructions(instructions, sessionId, sessionData.task);
    }, 3000); // Wait 3 seconds for agent to show interactive commands
    
    child.on('exit', (code) => {
      console.log(`${CONFIG.colors.yellow}Agent exited with code: ${code}${CONFIG.colors.reset}`);
      
      // Update session status
      sessionData.agentStopped = new Date().toISOString();
      sessionData.status = 'stopped';
      fs.writeFileSync(lockFile, JSON.stringify(sessionData, null, 2));
    });
    
    // Handle graceful shutdown
    process.on('SIGINT', () => {
      console.log(`\n${CONFIG.colors.yellow}Stopping agent...${CONFIG.colors.reset}`);
      child.kill('SIGINT');
      setTimeout(() => process.exit(0), 1000);
    });
  }

  /**
   * List all sessions
   */
  listSessions() {
    console.log(`\n${CONFIG.colors.bright}Active Sessions:${CONFIG.colors.reset}`);
    
    if (!fs.existsSync(this.locksPath)) {
      console.log('No active sessions');
      return;
    }
    
    const locks = fs.readdirSync(this.locksPath);
    
    if (locks.length === 0) {
      console.log('No active sessions');
      return;
    }
    
    locks.forEach(lockFile => {
      const lockPath = path.join(this.locksPath, lockFile);
      const session = JSON.parse(fs.readFileSync(lockPath, 'utf8'));
      
      const status = session.status === 'active' ? 
        `${CONFIG.colors.green}●${CONFIG.colors.reset}` : 
        `${CONFIG.colors.yellow}○${CONFIG.colors.reset}`;
      
      console.log(`\n${status} ${CONFIG.colors.bright}${session.sessionId}${CONFIG.colors.reset}`);
      console.log(`  Task: ${session.task}`);
      console.log(`  Agent: ${session.agentType}`);
      console.log(`  Branch: ${session.branchName}`);
      console.log(`  Status: ${session.status}`);
      
      if (session.claimedBy) {
        console.log(`  Claimed by: ${session.claimedBy}`);
      }
      
      if (session.agentPid) {
        console.log(`  Agent PID: ${session.agentPid}`);
      }
    });
  }

  /**
   * Prompt for task name
   */
  promptForTask() {
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout
    });
    
    return new Promise((resolve) => {
      rl.question('Enter task name: ', (answer) => {
        rl.close();
        resolve(answer || 'development');
      });
    });
  }

  /**
   * Create a combined session (both create and start agent)
   */
  async createAndStart(options = {}) {
    const session = await this.createSession(options);
    
    console.log(`\n${CONFIG.colors.yellow}Starting agent for session ${session.sessionId}...${CONFIG.colors.reset}`);
    
    // Start the agent
    await this.startAgent(session.sessionId);
    
    // Wait for agent to initialize and show its interactive commands
    await new Promise(resolve => setTimeout(resolve, 3000));
    
    // NOW display instructions AFTER the agent's interactive commands have been shown
    // Read the lock file to get the stored instructions
    const lockFile = path.join(this.locksPath, `${session.sessionId}.lock`);
    const lockData = JSON.parse(fs.readFileSync(lockFile, 'utf8'));
    
    if (lockData.instructions) {
      console.log('\n'); // Add spacing
      this.displayInstructions(lockData.instructions, session.sessionId, options.task || 'development');
    }
    
    return session;
  }
  
  /**
   * Close a specific session
   */
  async closeSession(sessionId) {
    const lockFile = path.join(this.locksPath, `${sessionId}.lock`);
    
    if (!fs.existsSync(lockFile)) {
      console.error(`${CONFIG.colors.red}Session not found: ${sessionId}${CONFIG.colors.reset}`);
      return false;
    }
    
    const session = JSON.parse(fs.readFileSync(lockFile, 'utf8'));
    console.log(`\n${CONFIG.colors.yellow}Closing session: ${sessionId}${CONFIG.colors.reset}`);
    console.log(`${CONFIG.colors.dim}Task: ${session.task}${CONFIG.colors.reset}`);
    console.log(`${CONFIG.colors.dim}Branch: ${session.branchName}${CONFIG.colors.reset}`);
    
    // Kill agent if running
    if (session.agentPid) {
      try {
        process.kill(session.agentPid, 'SIGTERM');
        console.log(`${CONFIG.colors.green}✓${CONFIG.colors.reset} Agent process stopped`);
      } catch (err) {
        // Process might already be dead
      }
    }
    
    // Check for uncommitted changes
    if (fs.existsSync(session.worktreePath)) {
      try {
        const status = execSync(`git -C "${session.worktreePath}" status --porcelain`, { encoding: 'utf8' });
        if (status.trim()) {
          console.log(`\n${CONFIG.colors.yellow}Warning: Uncommitted changes found${CONFIG.colors.reset}`);
          console.log(status);
          
          const rl = readline.createInterface({
            input: process.stdin,
            output: process.stdout
          });
          
          const answer = await new Promise(resolve => {
            rl.question('Commit these changes before closing? (y/N): ', resolve);
          });
          rl.close();
          
          if (answer.toLowerCase() === 'y') {
            execSync(`git -C "${session.worktreePath}" add -A`, { stdio: 'pipe' });
            execSync(`git -C "${session.worktreePath}" commit -m "chore: final session cleanup for ${sessionId}"`, { stdio: 'pipe' });
            execSync(`git -C "${session.worktreePath}" push origin ${session.branchName}`, { stdio: 'pipe' });
            console.log(`${CONFIG.colors.green}✓${CONFIG.colors.reset} Changes committed and pushed`);
          }
        }
      } catch (err) {
        console.log(`${CONFIG.colors.dim}Could not check git status${CONFIG.colors.reset}`);
      }
      
      // Ask about merging to target branch before cleanup
      let rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout
      });
      
      console.log(`\n${CONFIG.colors.yellow}Worktree Cleanup Options${CONFIG.colors.reset}`);
      
      // Get target branch from merge config or default to 'main'
      let targetBranch = session.mergeConfig?.targetBranch || 'main';
      
      const mergeFirst = await new Promise(resolve => {
        rl.question(`\nMerge ${CONFIG.colors.bright}${session.branchName}${CONFIG.colors.reset} → ${CONFIG.colors.bright}${targetBranch}${CONFIG.colors.reset} before cleanup? (y/N): `, resolve);
      });
      rl.close();
      
      if (mergeFirst.toLowerCase() === 'y') {
        rl = readline.createInterface({
          input: process.stdin,
          output: process.stdout
        });
        
        const confirmTarget = await new Promise(resolve => {
          rl.question(`Target branch [${targetBranch}]: `, resolve);
        });
        rl.close();
        
        if (confirmTarget.trim()) {
          targetBranch = confirmTarget.trim();
        }
        
        try {
          console.log(`\n${CONFIG.colors.blue}Merging ${session.branchName} into ${targetBranch}...${CONFIG.colors.reset}`);
          
          // Check if target branch exists locally
          let branchExists = false;
          try {
            execSync(`git rev-parse --verify ${targetBranch}`, { cwd: this.repoRoot, stdio: 'pipe' });
            branchExists = true;
          } catch (err) {
            // Branch doesn't exist locally
          }
          
          if (!branchExists) {
            // Check if branch exists on remote
            try {
              execSync(`git ls-remote --heads origin ${targetBranch}`, { cwd: this.repoRoot, stdio: 'pipe' });
              // Branch exists on remote, fetch it
              console.log(`${CONFIG.colors.dim}Target branch doesn't exist locally, fetching from remote...${CONFIG.colors.reset}`);
              execSync(`git fetch origin ${targetBranch}:${targetBranch}`, { cwd: this.repoRoot, stdio: 'pipe' });
            } catch (err) {
              // Branch doesn't exist on remote either, create it
              console.log(`${CONFIG.colors.yellow}Target branch '${targetBranch}' doesn't exist. Creating it...${CONFIG.colors.reset}`);
              execSync(`git checkout -b ${targetBranch}`, { cwd: this.repoRoot, stdio: 'pipe' });
              execSync(`git push -u origin ${targetBranch}`, { cwd: this.repoRoot, stdio: 'pipe' });
              console.log(`${CONFIG.colors.green}✓${CONFIG.colors.reset} Created new branch ${targetBranch}`);
            }
          }
          
          // Switch to target branch in main repo
          execSync(`git checkout ${targetBranch}`, { cwd: this.repoRoot, stdio: 'pipe' });
          
          // Pull latest (if branch already existed)
          if (branchExists) {
            try {
              execSync(`git pull origin ${targetBranch}`, { cwd: this.repoRoot, stdio: 'pipe' });
            } catch (err) {
              console.log(`${CONFIG.colors.dim}Could not pull latest changes (may be new branch)${CONFIG.colors.reset}`);
            }
          }
          
          // Merge the session branch
          execSync(`git merge --no-ff ${session.branchName} -m "Merge session ${sessionId}: ${session.task}"`, { 
            cwd: this.repoRoot, 
            stdio: 'pipe' 
          });
          
          // Push merged changes
          execSync(`git push origin ${targetBranch}`, { cwd: this.repoRoot, stdio: 'pipe' });
          
          console.log(`${CONFIG.colors.green}✓${CONFIG.colors.reset} Successfully merged to ${targetBranch}`);
          
          // Delete remote branch after successful merge
          try {
            execSync(`git push origin --delete ${session.branchName}`, { cwd: this.repoRoot, stdio: 'pipe' });
            console.log(`${CONFIG.colors.green}✓${CONFIG.colors.reset} Deleted remote branch ${session.branchName}`);
          } catch (err) {
            console.log(`${CONFIG.colors.dim}Could not delete remote branch${CONFIG.colors.reset}`);
          }
        } catch (err) {
          console.error(`${CONFIG.colors.red}✗ Merge failed: ${err.message}${CONFIG.colors.reset}`);
          console.log(`${CONFIG.colors.yellow}You may need to resolve conflicts manually${CONFIG.colors.reset}`);
        }
      }
      
      // Ask about removing worktree
      rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout
      });
      
      const removeWorktree = await new Promise(resolve => {
        rl.question(`\nRemove worktree at ${session.worktreePath}? (Y/n): `, resolve);
      });
      rl.close();
      
      if (removeWorktree.toLowerCase() !== 'n') {
        try {
          // Remove worktree
          execSync(`git worktree remove "${session.worktreePath}" --force`, { stdio: 'pipe' });
          console.log(`${CONFIG.colors.green}✓${CONFIG.colors.reset} Worktree removed`);
          
          // Delete local branch
          try {
            execSync(`git branch -D ${session.branchName}`, { cwd: this.repoRoot, stdio: 'pipe' });
            console.log(`${CONFIG.colors.green}✓${CONFIG.colors.reset} Deleted local branch ${session.branchName}`);
          } catch (err) {
            console.log(`${CONFIG.colors.dim}Could not delete local branch${CONFIG.colors.reset}`);
          }
          
          // Prune worktree list
          execSync('git worktree prune', { stdio: 'pipe' });
        } catch (err) {
          console.error(`${CONFIG.colors.red}Failed to remove worktree: ${err.message}${CONFIG.colors.reset}`);
        }
      }
    }
    
    // Remove lock file
    fs.unlinkSync(lockFile);
    console.log(`${CONFIG.colors.green}✓${CONFIG.colors.reset} Session closed successfully`);
    
    return true;
  }
  
  /**
   * Interactive session selection and close
   */
  async selectAndCloseSession() {
    if (!fs.existsSync(this.locksPath)) {
      console.log(`${CONFIG.colors.yellow}No active sessions${CONFIG.colors.reset}`);
      return;
    }
    
    const locks = fs.readdirSync(this.locksPath);
    if (locks.length === 0) {
      console.log(`${CONFIG.colors.yellow}No active sessions${CONFIG.colors.reset}`);
      return;
    }
    
    const sessions = [];
    locks.forEach(lockFile => {
      const lockPath = path.join(this.locksPath, lockFile);
      const session = JSON.parse(fs.readFileSync(lockPath, 'utf8'));
      sessions.push(session);
    });
    
    console.log(`\n${CONFIG.colors.bright}Select session to close:${CONFIG.colors.reset}\n`);
    
    sessions.forEach((session, index) => {
      const status = session.status === 'active' ? 
        `${CONFIG.colors.green}●${CONFIG.colors.reset}` : 
        `${CONFIG.colors.yellow}○${CONFIG.colors.reset}`;
      
      console.log(`${status} ${CONFIG.colors.bright}${index + 1})${CONFIG.colors.reset} ${session.sessionId}`);
      console.log(`   Task: ${session.task}`);
      console.log(`   Branch: ${session.branchName}`);
      console.log(`   Created: ${session.created}`);
      console.log();
    });
    
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout
    });
    
    const answer = await new Promise(resolve => {
      rl.question(`Select session (1-${sessions.length}) or 'q' to quit: `, resolve);
    });
    rl.close();
    
    if (answer.toLowerCase() === 'q') {
      return;
    }
    
    const index = parseInt(answer) - 1;
    if (index >= 0 && index < sessions.length) {
      await this.closeSession(sessions[index].sessionId);
    } else {
      console.log(`${CONFIG.colors.red}Invalid selection${CONFIG.colors.reset}`);
    }
  }
  
  /**
   * Clean up all stale sessions and worktrees
   */
  async cleanupAll() {
    console.log(`\n${CONFIG.colors.yellow}Cleaning up stale sessions and worktrees...${CONFIG.colors.reset}`);
    
    // Clean up old lock files (older than 24 hours)
    const oneDayAgo = Date.now() - 86400000;
    let cleanedLocks = 0;
    
    if (fs.existsSync(this.locksPath)) {
      const locks = fs.readdirSync(this.locksPath);
      locks.forEach(lockFile => {
        const lockPath = path.join(this.locksPath, lockFile);
        const stats = fs.statSync(lockPath);
        if (stats.mtimeMs < oneDayAgo) {
          fs.unlinkSync(lockPath);
          cleanedLocks++;
        }
      });
    }
    
    if (cleanedLocks > 0) {
      console.log(`${CONFIG.colors.green}✓${CONFIG.colors.reset} Removed ${cleanedLocks} stale lock files`);
    }
    
    // Prune git worktrees
    try {
      execSync('git worktree prune', { stdio: 'pipe' });
      console.log(`${CONFIG.colors.green}✓${CONFIG.colors.reset} Pruned git worktrees`);
    } catch (err) {
      console.log(`${CONFIG.colors.dim}Could not prune worktrees${CONFIG.colors.reset}`);
    }
    
    // Clean up orphaned worktree directories
    if (fs.existsSync(this.worktreesPath)) {
      const worktrees = fs.readdirSync(this.worktreesPath);
      let cleanedWorktrees = 0;
      
      for (const dir of worktrees) {
        const worktreePath = path.join(this.worktreesPath, dir);
        
        // Check if this worktree is still valid
        try {
          execSync(`git worktree list | grep "${worktreePath}"`, { stdio: 'pipe' });
        } catch (err) {
          // Worktree not in git list, it's orphaned
          try {
            fs.rmSync(worktreePath, { recursive: true, force: true });
            cleanedWorktrees++;
          } catch (err) {
            console.log(`${CONFIG.colors.dim}Could not remove ${dir}${CONFIG.colors.reset}`);
          }
        }
      }
      
      if (cleanedWorktrees > 0) {
        console.log(`${CONFIG.colors.green}✓${CONFIG.colors.reset} Removed ${cleanedWorktrees} orphaned worktree directories`);
      }
    }
    
    console.log(`${CONFIG.colors.green}✓${CONFIG.colors.reset} Cleanup complete`);
  }
}

// ============================================================================
// CLI INTERFACE
// ============================================================================

async function main() {
  // Display copyright and license information immediately
  console.log();
  console.log("=".repeat(70));
  console.log();
  console.log("  CS_DevOpsAgent - Intelligent Git Automation System");
  console.log("  Version 1.4.8 | Build 20251008.1");
  console.log("  ");
  console.log("  Copyright (c) 2024 SecondBrain Labs");
  console.log("  Author: Sachin Dev Duggal");
  console.log("  ");
  console.log("  Licensed under the MIT License");
  console.log("  This software is provided 'as-is' without any warranty.");
  console.log("  See LICENSE file for full license text.");
  console.log("=".repeat(70));
  console.log();
  
  const args = process.argv.slice(2);
  const command = args[0] || 'help';
  
  const coordinator = new SessionCoordinator();
  
  switch (command) {
    case 'create': {
      // Create a new session
      const task = args.includes('--task') ? 
        args[args.indexOf('--task') + 1] : 
        await coordinator.promptForTask();
      
      const agent = args.includes('--agent') ? 
        args[args.indexOf('--agent') + 1] : 
        'claude';
      
      await coordinator.createSession({ task, agent });
      break;
    }
    
    case 'start': {
      // Start agent for a session
      const sessionId = args[1];
      if (!sessionId) {
        console.error('Usage: start <session-id>');
        process.exit(1);
      }
      await coordinator.startAgent(sessionId);
      break;
    }
    
    case 'create-and-start': {
      // Create session and immediately start agent
      const task = args.includes('--task') ? 
        args[args.indexOf('--task') + 1] : 
        await coordinator.promptForTask();
      
      const agent = args.includes('--agent') ? 
        args[args.indexOf('--agent') + 1] : 
        'claude';
      
      await coordinator.createAndStart({ task, agent });
      break;
    }
    
    case 'request': {
      // Request a session (for Claude to call)
      const agent = args[1] || 'claude';
      await coordinator.requestSession(agent);
      break;
    }
    
  case 'list': {
    coordinator.listSessions();
    break;
  }
  
  case 'close': {
    // Close a session and clean up
    const sessionId = args[1];
    if (sessionId) {
      await coordinator.closeSession(sessionId);
    } else {
      // Interactive selection
      await coordinator.selectAndCloseSession();
    }
    break;
  }
  
  case 'cleanup': {
    // Clean up stale sessions and worktrees
    await coordinator.cleanupAll();
    break;
  }
  
  case 'help':
  default: {
      console.log(`
${CONFIG.colors.bright}DevOps Session Coordinator${CONFIG.colors.reset}

${CONFIG.colors.blue}Usage:${CONFIG.colors.reset}
  node session-coordinator.js <command> [options]

${CONFIG.colors.blue}Commands:${CONFIG.colors.reset}
  ${CONFIG.colors.green}create${CONFIG.colors.reset}              Create a new session and show instructions
  ${CONFIG.colors.green}start <id>${CONFIG.colors.reset}          Start DevOps agent for a session
  ${CONFIG.colors.green}create-and-start${CONFIG.colors.reset}    Create session and start agent (all-in-one)
  ${CONFIG.colors.green}request [agent]${CONFIG.colors.reset}     Request a session (for Claude to call)
  ${CONFIG.colors.green}list${CONFIG.colors.reset}                List all active sessions
  ${CONFIG.colors.green}close [id]${CONFIG.colors.reset}          Close session and clean up worktree
  ${CONFIG.colors.green}cleanup${CONFIG.colors.reset}             Clean up all stale sessions
  ${CONFIG.colors.green}help${CONFIG.colors.reset}                Show this help

${CONFIG.colors.blue}Options:${CONFIG.colors.reset}
  --task <name>       Task or feature name
  --agent <type>      Agent type (claude, cline, copilot, etc.)

${CONFIG.colors.blue}Examples:${CONFIG.colors.reset}
  ${CONFIG.colors.dim}# Workflow 1: Manual coordination${CONFIG.colors.reset}
  node session-coordinator.js create --task "auth-feature"
  ${CONFIG.colors.dim}# Copy instructions to Claude${CONFIG.colors.reset}
  node session-coordinator.js start <session-id>

  ${CONFIG.colors.dim}# Workflow 2: All-in-one${CONFIG.colors.reset}
  node session-coordinator.js create-and-start --task "api-endpoints"

  ${CONFIG.colors.dim}# Workflow 3: Claude requests a session${CONFIG.colors.reset}
  node session-coordinator.js request claude

${CONFIG.colors.yellow}Typical Workflow:${CONFIG.colors.reset}
1. Run: ${CONFIG.colors.green}node session-coordinator.js create-and-start${CONFIG.colors.reset}
2. Copy the displayed instructions to Claude/Cline
3. Claude navigates to the worktree and starts working
4. Agent automatically commits and pushes changes
`);
    }
  }
}

// Run the CLI
main().catch(err => {
  console.error(`${CONFIG.colors.red}Error: ${err.message}${CONFIG.colors.reset}`);
  process.exit(1);
});