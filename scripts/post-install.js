#!/usr/bin/env node

/**
 * Post-install Script for DevOps Agent
 * =====================================
 * 
 * Runs after npm install/update to check and update house rules.
 * Preserves user customizations while updating our managed sections.
 */

import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  dim: '\x1b[2m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[36m',
  red: '\x1b[31m'
};

async function main() {
  try {
    // Check if this is a global install - skip if so
    const isGlobal = process.env.npm_config_global === 'true' ||
                     process.env.npm_config_global === true ||
                     (process.env.npm_config_prefix && 
                      (process.cwd().startsWith(process.env.npm_config_prefix) ||
                       // Windows specific global paths
                       process.cwd().includes('\\npm\\') ||
                       process.cwd().includes('\\npm-cache\\') ||
                       process.cwd().includes('/lib/node_modules/') ||
                       process.cwd().includes('\\node_modules\\')));
    
    if (isGlobal) {
      // Skip post-install for global installations
      return;
    }

    // Find project root (where npm install was run)
    const projectRoot = process.env.INIT_CWD || process.cwd();
    
    // Don't run if we're in the DevOps Agent package itself
    const packageJson = path.join(__dirname, '..', 'package.json');
    if (fs.existsSync(packageJson)) {
      const pkg = JSON.parse(fs.readFileSync(packageJson, 'utf8'));
      if (pkg.name === 's9n-devops-agent') {
        // We're in the package directory itself, not a project using it
        const currentPackageJson = path.join(projectRoot, 'package.json');
        if (fs.existsSync(currentPackageJson)) {
          const currentPkg = JSON.parse(fs.readFileSync(currentPackageJson, 'utf8'));
          if (currentPkg.name === 's9n-devops-agent') {
            // Skip post-install when installing the package itself
            return;
          }
        }
      }
    }

    console.log(`\n${colors.bright}DevOps Agent Post-Install${colors.reset}`);
    console.log(`${colors.dim}Checking house rules...${colors.reset}\n`);

    // Dynamically import HouseRulesManager only when needed
    const { default: HouseRulesManager } = await import('../src/house-rules-manager.js');

    const manager = new HouseRulesManager(projectRoot);
    const status = manager.getStatus();

    if (!status.exists) {
      console.log(`${colors.yellow}No house rules found in your project.${colors.reset}`);
      
      // Check if running in CI or if user wants auto-setup
      const isCI = process.env.CI || process.env.CONTINUOUS_INTEGRATION || 
                   process.env.GITHUB_ACTIONS || process.env.GITLAB_CI ||
                   process.env.JENKINS_URL || process.env.TRAVIS;
      
      const autoSetup = isCI || process.env.DEVOPS_AUTO_SETUP === 'true';
      
      if (autoSetup) {
        console.log(`${colors.blue}Creating house rules automatically...${colors.reset}`);
        const result = await manager.updateHouseRules({ createIfMissing: true });
        if (result.created) {
          console.log(`${colors.green}✓ Created house rules at: ${path.relative(projectRoot, result.path)}${colors.reset}`);
          console.log(`${colors.dim}AI agents will now follow project conventions and coordination protocols.${colors.reset}\n`);
        }
      } else {
        console.log(`${colors.bright}House rules help AI agents understand your project.${colors.reset}`);
        console.log(`\nTo set up house rules, you can:`);
        console.log(`  1. Run ${colors.green}npm start${colors.reset} (recommended - interactive setup)`);
        console.log(`  2. Set ${colors.blue}DEVOPS_AUTO_SETUP=true${colors.reset} before npm install`);
        console.log(`  3. Run ${colors.green}npm run house-rules:update${colors.reset} manually\n`);
      }
      return;
    }

    if (status.needsUpdate) {
      console.log(`${colors.yellow}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${colors.reset}`);
      console.log(`${colors.bright}House Rules Update Available${colors.reset}`);
      console.log(`${colors.yellow}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${colors.reset}\n`);
      
      // Show what will be updated
      const sectionsToUpdate = [];
      const sectionsToAdd = [];
      
      for (const [name, info] of Object.entries(status.managedSections)) {
        if (info.needsUpdate) {
          if (info.installed) {
            sectionsToUpdate.push(`  • ${name} (${info.installedVersion} → ${info.currentVersion})`);
          } else {
            sectionsToAdd.push(`  • ${name} (new)`);
          }
        }
      }
      
      if (sectionsToUpdate.length > 0) {
        console.log('Sections to update:');
        sectionsToUpdate.forEach(s => console.log(s));
      }
      
      if (sectionsToAdd.length > 0) {
        console.log('Sections to add:');
        sectionsToAdd.forEach(s => console.log(s));
      }
      
      console.log(`\n${colors.dim}Your custom rules will be preserved.${colors.reset}`);
      
      // Check if running in CI environment
      const isCI = process.env.CI || process.env.CONTINUOUS_INTEGRATION || 
                   process.env.GITHUB_ACTIONS || process.env.GITLAB_CI ||
                   process.env.JENKINS_URL || process.env.TRAVIS;
      
      if (isCI) {
        // In CI, auto-update without prompting
        console.log(`${colors.blue}CI environment detected - auto-updating...${colors.reset}`);
        const result = await manager.updateHouseRules();
        if (result.updated) {
          console.log(`${colors.green}✓ House rules updated successfully!${colors.reset}`);
          if (result.updatedSections?.length > 0) {
            console.log(`  Updated: ${result.updatedSections.join(', ')}`);
          }
          if (result.addedSections?.length > 0) {
            console.log(`  Added: ${result.addedSections.join(', ')}`);
          }
        }
      } else {
        // In interactive environment, provide instructions
        console.log(`\nTo update, run: ${colors.green}npm start${colors.reset}`);
        console.log(`Or manually: ${colors.green}node node_modules/s9n-devops-agent/src/house-rules-manager.js update${colors.reset}\n`);
      }
    } else {
      console.log(`${colors.green}✓${colors.reset} House rules are up to date.\n`);
    }
  } catch (error) {
    // Silently fail - don't break npm install
    if (process.env.DEBUG) {
      console.error(`${colors.red}Error checking house rules:${colors.reset}`, error.message);
    }
  }
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(() => {
    // Silent fail for post-install
    process.exit(0);
  });
}

export default main;