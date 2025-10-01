/**
 * Display Utilities for CS DevOps Agent
 * 
 * Provides consistent, clean formatting for all console output
 * Ensures professional appearance across all modules
 */

const COLORS = {
  // Basic colors
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  dim: '\x1b[2m',
  
  // Text colors
  black: '\x1b[30m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
  white: '\x1b[37m',
  orange: '\x1b[38;5;208m',
  
  // Background colors
  bgRed: '\x1b[41m',
  bgGreen: '\x1b[42m',
  bgYellow: '\x1b[43m',
  bgBlue: '\x1b[44m',
  bgMagenta: '\x1b[45m',
  bgCyan: '\x1b[46m'
};

const ICONS = {
  success: '✓',
  error: '✗',
  warning: '⚠',
  info: 'ℹ',
  arrow: '→',
  bullet: '•',
  lock: '🔒',
  unlock: '🔓',
  file: '📄',
  folder: '📁',
  clock: '⏱',
  alert: '🚨',
  orange: '🟧',
  red: '🔴',
  green: '🟢',
  save: '💾',
  copy: '📋',
  robot: '🤖'
};

class DisplayUtils {
  constructor() {
    this.colors = COLORS;
    this.icons = ICONS;
    this.terminalWidth = process.stdout.columns || 80;
  }

  /**
   * Print a clean header box
   */
  header(title, subtitle = '') {
    const width = Math.min(this.terminalWidth, 70);
    const line = '═'.repeat(width);
    const padding = Math.floor((width - title.length) / 2);
    
    console.log();
    console.log(this.colors.cyan + line + this.colors.reset);
    console.log(this.colors.bright + ' '.repeat(padding) + title + this.colors.reset);
    if (subtitle) {
      const subPadding = Math.floor((width - subtitle.length) / 2);
      console.log(this.colors.dim + ' '.repeat(subPadding) + subtitle + this.colors.reset);
    }
    console.log(this.colors.cyan + line + this.colors.reset);
    console.log();
  }

  /**
   * Print a section header
   */
  section(title) {
    const width = Math.min(this.terminalWidth, 70);
    const line = '─'.repeat(width);
    
    console.log();
    console.log(this.colors.blue + this.colors.bright + title + this.colors.reset);
    console.log(this.colors.dim + line + this.colors.reset);
  }

  /**
   * Print a subsection
   */
  subsection(title) {
    console.log();
    console.log(this.colors.cyan + '▸ ' + title + this.colors.reset);
  }

  /**
   * Success message
   */
  success(message, detail = '') {
    console.log(
      this.colors.green + this.icons.success + this.colors.reset + 
      ' ' + message +
      (detail ? this.colors.dim + ' (' + detail + ')' + this.colors.reset : '')
    );
  }

  /**
   * Error message
   */
  error(message, detail = '') {
    console.log(
      this.colors.red + this.icons.error + this.colors.reset + 
      ' ' + message +
      (detail ? this.colors.dim + ' (' + detail + ')' + this.colors.reset : '')
    );
  }

  /**
   * Warning message
   */
  warning(message, detail = '') {
    console.log(
      this.colors.yellow + this.icons.warning + this.colors.reset + 
      ' ' + message +
      (detail ? this.colors.dim + ' (' + detail + ')' + this.colors.reset : '')
    );
  }

  /**
   * Info message
   */
  info(message, detail = '') {
    console.log(
      this.colors.cyan + this.icons.info + this.colors.reset + 
      ' ' + message +
      (detail ? this.colors.dim + ' (' + detail + ')' + this.colors.reset : '')
    );
  }

  /**
   * Step/progress indicator
   */
  step(number, total, message) {
    console.log(
      this.colors.blue + `[${number}/${total}]` + this.colors.reset +
      ' ' + message
    );
  }

  /**
   * Print a list item
   */
  listItem(message, indent = 2) {
    console.log(' '.repeat(indent) + this.icons.bullet + ' ' + message);
  }

  /**
   * Print key-value pair
   */
  keyValue(key, value, indent = 2) {
    console.log(
      ' '.repeat(indent) +
      this.colors.dim + key + ':' + this.colors.reset + ' ' +
      this.colors.bright + value + this.colors.reset
    );
  }

  /**
   * Print a table
   */
  table(headers, rows) {
    // Calculate column widths
    const widths = headers.map((h, i) => {
      const headerWidth = h.length;
      const maxRowWidth = Math.max(...rows.map(r => String(r[i]).length));
      return Math.max(headerWidth, maxRowWidth) + 2;
    });

    // Print headers
    const headerRow = headers.map((h, i) => 
      h.padEnd(widths[i])
    ).join('│ ');
    
    console.log();
    console.log(this.colors.bright + headerRow + this.colors.reset);
    console.log('─'.repeat(headerRow.length));

    // Print rows
    rows.forEach(row => {
      const rowStr = row.map((cell, i) => 
        String(cell).padEnd(widths[i])
      ).join('│ ');
      console.log(rowStr);
    });
    console.log();
  }

  /**
   * Print emoji-based alert boxes (keeping the visual impact)
   */
  alertBox(type, title, message, instructions = null) {
    const width = Math.min(this.terminalWidth, 70);
    let borderChar, icon;
    
    switch(type) {
      case 'conflict':
        borderChar = '🔴';
        icon = '🔴';
        break;
      case 'warning':
        borderChar = '🟧';
        icon = '🟧';
        break;
      default:
        borderChar = '⚠️';
        icon = '⚠️';
    }

    // Emoji border (much more eye-catching!)
    console.log();
    console.log(borderChar.repeat(30));
    console.log(borderChar + '  ' + title);
    console.log(borderChar.repeat(30));
    
    // Message
    console.log();
    if (Array.isArray(message)) {
      message.forEach(line => console.log(line));
    } else {
      console.log(message);
    }
    
    // Instructions
    if (instructions) {
      console.log();
      console.log('📋 COPY THIS TO YOUR AGENT:');
      console.log('─'.repeat(width));
      console.log(instructions);
      console.log('─'.repeat(width));
    }
    
    console.log();
    console.log(borderChar.repeat(30));
    console.log();
  }

  /**
   * Print a progress bar
   */
  progressBar(current, total, label = '') {
    const width = 30;
    const percentage = Math.round((current / total) * 100);
    const filled = Math.round((current / total) * width);
    const empty = width - filled;
    
    const bar = 
      this.colors.green + '█'.repeat(filled) + 
      this.colors.dim + '░'.repeat(empty) + this.colors.reset;
    
    console.log(
      `${label} ${bar} ${percentage}% (${current}/${total})`
    );
  }

  /**
   * Clear line and rewrite (for updating status)
   */
  updateLine(message) {
    process.stdout.clearLine(0);
    process.stdout.cursorTo(0);
    process.stdout.write(message);
  }

  /**
   * Print session info in a clean format
   */
  sessionInfo(sessionData) {
    this.section('Session Information');
    this.keyValue('Session ID', sessionData.sessionId);
    this.keyValue('Task', sessionData.task || 'General development');
    this.keyValue('Branch', sessionData.branchName);
    this.keyValue('Status', sessionData.status);
    if (sessionData.worktreePath) {
      this.keyValue('Worktree', sessionData.worktreePath);
    }
    if (sessionData.claimedBy) {
      this.keyValue('Agent', sessionData.claimedBy);
    }
  }

  /**
   * Print a clean menu
   */
  menu(title, options) {
    this.section(title);
    options.forEach((option, index) => {
      const key = option.key || (index + 1);
      const label = option.label || option;
      const desc = option.description || '';
      
      console.log(
        '  ' +
        this.colors.cyan + '[' + key + ']' + this.colors.reset + ' ' +
        this.colors.bright + label + this.colors.reset +
        (desc ? '\n      ' + this.colors.dim + desc + this.colors.reset : '')
      );
    });
    console.log();
  }

  /**
   * Print instructions for agents
   */
  agentInstructions(sessionId, worktreePath, task) {
    const width = Math.min(this.terminalWidth, 70);
    const line = '═'.repeat(width);
    
    console.log();
    console.log(this.colors.bgCyan + this.colors.black + ' INSTRUCTIONS FOR AI AGENT ' + this.colors.reset);
    console.log(this.colors.cyan + line + this.colors.reset);
    console.log();
    console.log('I\'m working in a DevOps-managed session with the following setup:');
    console.log(`• Session ID: ${sessionId}`);
    console.log(`• Working Directory: ${worktreePath}`);
    console.log(`• Task: ${task || 'development'}`);
    console.log();
    console.log('Please switch to this directory before making any changes:');
    console.log(this.colors.yellow + `cd "${worktreePath}"` + this.colors.reset);
    console.log();
    console.log(this.colors.bright + 'IMPORTANT: File Coordination Protocol' + this.colors.reset);
    console.log('Before editing ANY files, you MUST:');
    console.log('1. Declare your intent by creating .file-coordination/active-edits/<agent>-' + sessionId + '.json');
    console.log('2. List all files you plan to edit in that JSON file');
    console.log('3. Check for conflicts with other agents\' declarations');
    console.log('4. Only proceed if no conflicts exist');
    console.log('5. Release the files when done');
    console.log();
    console.log('Write commit messages to: ' + this.colors.yellow + `.devops-commit-${sessionId}.msg` + this.colors.reset);
    console.log('The DevOps agent will automatically commit and push changes.');
    console.log();
    console.log(this.colors.cyan + line + this.colors.reset);
  }
}

module.exports = new DisplayUtils();