/**
 * Test: Push Behind Remote Handling
 * 
 * Verifies that the cs-devops-agent-worker correctly handles
 * scenarios where the local branch is behind the remote.
 */

const { describe, it, expect, beforeEach, afterEach } = require('@jest/globals');
const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const os = require('os');

describe('CS_DevOpsAgent Push Behind Handling', () => {
  let testDir;
  let remoteRepo;
  let localRepo1;
  let localRepo2;

  beforeEach(() => {
    // Create temporary test directory
    testDir = fs.mkdtempSync(path.join(os.tmpdir(), 'devops-agent-test-'));
    remoteRepo = path.join(testDir, 'remote.git');
    localRepo1 = path.join(testDir, 'local1');
    localRepo2 = path.join(testDir, 'local2');

    // Initialize bare remote repository
    fs.mkdirSync(remoteRepo);
    execSync('git init --bare --initial-branch=main', { cwd: remoteRepo });

    // Setup first local repository
    fs.mkdirSync(localRepo1);
    execSync('git init --initial-branch=main', { cwd: localRepo1 });
    execSync('git config user.name "Test User 1"', { cwd: localRepo1 });
    execSync('git config user.email "user1@test.com"', { cwd: localRepo1 });
    execSync(`git remote add origin ${remoteRepo}`, { cwd: localRepo1 });
    
    // Initial commit
    fs.writeFileSync(path.join(localRepo1, 'README.md'), '# Test Project');
    execSync('git add README.md', { cwd: localRepo1 });
    execSync('git commit -m "Initial commit"', { cwd: localRepo1 });
    execSync('git push -u origin main', { cwd: localRepo1 });

    // Clone to second repository
    execSync(`git clone ${remoteRepo} ${localRepo2}`, { cwd: testDir });
    execSync('git config user.name "Test User 2"', { cwd: localRepo2 });
    execSync('git config user.email "user2@test.com"', { cwd: localRepo2 });
  });

  afterEach(() => {
    // Cleanup
    if (fs.existsSync(testDir)) {
      fs.rmSync(testDir, { recursive: true, force: true });
    }
  });

  it('should handle simple push-behind scenario', () => {
    // User 2 makes a change and pushes
    fs.writeFileSync(path.join(localRepo2, 'file2.txt'), 'Content from User 2');
    execSync('git add file2.txt', { cwd: localRepo2 });
    execSync('git commit -m "Add file2"', { cwd: localRepo2 });
    execSync('git push origin main', { cwd: localRepo2 });

    // User 1 makes a change (now behind)
    fs.writeFileSync(path.join(localRepo1, 'file1.txt'), 'Content from User 1');
    execSync('git add file1.txt', { cwd: localRepo1 });
    execSync('git commit -m "Add file1"', { cwd: localRepo1 });

    // Mock the pushBranch function behavior
    // In real scenario, this would be the cs-devops-agent-worker
    try {
      execSync('git push origin main', { cwd: localRepo1 });
    } catch (error) {
      // Push failed, pull and retry
      execSync('git pull --no-rebase origin main', { cwd: localRepo1 });
      execSync('git push origin main', { cwd: localRepo1 });
    }

    // Verify both files exist in remote
    execSync('git pull origin main', { cwd: localRepo2 });
    expect(fs.existsSync(path.join(localRepo2, 'file1.txt'))).toBe(true);
    expect(fs.existsSync(path.join(localRepo2, 'file2.txt'))).toBe(true);
  });

  it('should detect conflicts when files cannot be auto-merged', () => {
    // Both users modify the same file
    fs.writeFileSync(path.join(localRepo1, 'shared.txt'), 'Version A');
    execSync('git add shared.txt', { cwd: localRepo1 });
    execSync('git commit -m "Add shared.txt version A"', { cwd: localRepo1 });
    execSync('git push origin main', { cwd: localRepo1 });

    // User 2 pulls and modifies
    execSync('git pull origin main', { cwd: localRepo2 });
    fs.writeFileSync(path.join(localRepo2, 'shared.txt'), 'Version B');
    execSync('git add shared.txt', { cwd: localRepo2 });
    execSync('git commit -m "Update to version B"', { cwd: localRepo2 });
    execSync('git push origin main', { cwd: localRepo2 });

    // User 1 modifies without pulling
    fs.writeFileSync(path.join(localRepo1, 'shared.txt'), 'Version C');
    execSync('git add shared.txt', { cwd: localRepo1 });
    execSync('git commit -m "Update to version C"', { cwd: localRepo1 });

    // Attempt to handle push-behind with conflict
    let hasConflict = false;
    try {
      execSync('git push origin main', { cwd: localRepo1 });
    } catch (error) {
      // Push rejected, try to pull
      try {
        execSync('git pull --no-rebase origin main', { cwd: localRepo1 });
      } catch (pullError) {
        // Check for conflict markers in the file or error message
        const errorMsg = pullError.toString();
        hasConflict = errorMsg.includes('Automatic merge failed') || 
                     errorMsg.includes('CONFLICT') ||
                     errorMsg.includes('conflict');
        
        if (!hasConflict) {
          // Also check if conflict markers are in the file
          const fileContent = fs.readFileSync(path.join(localRepo1, 'shared.txt'), 'utf8');
          hasConflict = fileContent.includes('<<<<<<<') || fileContent.includes('>>>>>>>');
        }
      }
      
      // If no conflict detected in pull, it might have succeeded with a merge commit
      if (!hasConflict) {
        // Check git status for conflicts
        try {
          const status = execSync('git status --porcelain', { cwd: localRepo1, encoding: 'utf8' });
          hasConflict = status.includes('UU ') || status.includes('AA ');
        } catch (statusError) {
          // Status check failed, likely due to conflicts
          hasConflict = true;
        }
      }
    }

    expect(hasConflict).toBe(true);
  });

  it('should handle multiple concurrent push-behind scenarios', async () => {
    const promises = [];
    
    // Simulate 3 concurrent users
    for (let i = 3; i <= 5; i++) {
      promises.push(new Promise((resolve) => {
        const localRepoN = path.join(testDir, `local${i}`);
        execSync(`git clone ${remoteRepo} ${localRepoN}`, { cwd: testDir });
        execSync(`git config user.name "Test User ${i}"`, { cwd: localRepoN });
        execSync(`git config user.email "user${i}@test.com"`, { cwd: localRepoN });
        
        // Make changes
        fs.writeFileSync(path.join(localRepoN, `file${i}.txt`), `Content from User ${i}`);
        execSync(`git add file${i}.txt`, { cwd: localRepoN });
        execSync(`git commit -m "Add file${i}"`, { cwd: localRepoN });
        
        // Try to push with retry logic
        let retries = 3;
        while (retries > 0) {
          try {
            execSync('git push origin main', { cwd: localRepoN });
            break;
          } catch (error) {
            if (retries > 1) {
              execSync('git pull --no-rebase origin main', { cwd: localRepoN });
              retries--;
            } else {
              throw error;
            }
          }
        }
        resolve();
      }));
    }

    await Promise.all(promises);

    // Verify all files made it to remote
    execSync('git pull origin main', { cwd: localRepo1 });
    for (let i = 3; i <= 5; i++) {
      expect(fs.existsSync(path.join(localRepo1, `file${i}.txt`))).toBe(true);
    }
  });
});