// Silence debug output during tests
process.env.AC_DEBUG = 'false';
process.env.DEBUG = 'false';

// Mock console methods if needed for cleaner test output
const originalConsoleLog = console.log;
console.log = (...args) => {
  // Filter out debug messages
  const message = args.join(' ');
  if (!message.includes('[debug]') && !message.includes('watcher:')) {
    originalConsoleLog(...args);
  }
};