#!/bin/bash

#############################################################################
# CS_DevOpsAgent Binary Build Script
#############################################################################
# This script packages the CS_DevOpsAgent into standalone executables
# for macOS, Linux, and Windows using pkg
#############################################################################

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

# Build configuration
BUILD_DIR="dist"
BINARY_NAME="cs-devops-agent"
VERSION=$(node -p "require('./package.json').version")
TARGETS=("node18-macos-x64" "node18-macos-arm64" "node18-linux-x64" "node18-win-x64")

print_header() {
    echo -e "\n${BLUE}══════════════════════════════════════════════════════${NC}"
    echo -e "${CYAN}$1${NC}"
    echo -e "${BLUE}══════════════════════════════════════════════════════${NC}"
}

print_success() {
    echo -e "${GREEN}✓${NC} $1"
}

print_error() {
    echo -e "${RED}✗${NC} $1"
}

print_info() {
    echo -e "${CYAN}ℹ${NC} $1"
}

# Check prerequisites
check_prerequisites() {
    print_header "Checking Prerequisites"
    
    # Check if Node.js is installed
    if ! command -v node &> /dev/null; then
        print_error "Node.js is not installed"
        exit 1
    fi
    print_success "Node.js $(node --version)"
    
    # Check if npm is installed
    if ! command -v npm &> /dev/null; then
        print_error "npm is not installed"
        exit 1
    fi
    print_success "npm $(npm --version)"
    
    # Check/install pkg
    if ! command -v pkg &> /dev/null; then
        print_info "Installing pkg globally..."
        npm install -g pkg
    fi
    print_success "pkg installed"
}

# Clean previous builds
clean_build() {
    print_header "Cleaning Previous Builds"
    
    if [ -d "$BUILD_DIR" ]; then
        rm -rf "$BUILD_DIR"
        print_success "Removed old build directory"
    fi
    
    mkdir -p "$BUILD_DIR"
    print_success "Created clean build directory"
}

# Create binary wrapper
create_wrapper() {
    print_header "Creating Binary Wrapper"
    
    cat > binary-wrapper.js << 'EOF'
#!/usr/bin/env node

/**
 * Binary wrapper for CS_DevOpsAgent
 * This file serves as the entry point for the standalone binary
 */

const path = require('path');
const { spawn } = require('child_process');

// Determine which script to run based on arguments
const args = process.argv.slice(2);
const command = args[0];

let scriptPath;

switch(command) {
    case 'setup':
        scriptPath = path.join(__dirname, 'src', 'setup-cs-devops-agent.js');
        break;
    case 'worktree':
        scriptPath = path.join(__dirname, 'src', 'worktree-manager.js');
        break;
    case 'agent':
        scriptPath = path.join(__dirname, 'src', 'run-with-agent.js');
        break;
    case 'help':
    case '--help':
    case '-h':
        console.log(`
CS_DevOpsAgent v${require('./package.json').version}
A sophisticated multi-agent Git automation system

Usage:
  cs-devops-agent [command] [options]

Commands:
  (default)    Start the DevOps agent worker
  setup        Run interactive setup wizard
  worktree     Manage git worktrees for agents
  agent        Run with specific agent context
  help         Show this help message

Environment Variables:
  AC_BRANCH_PREFIX    Branch prefix for daily branches
  AC_PUSH             Enable auto-push (true/false)
  AC_DEBUG            Enable debug logging (true/false)
  AC_TZ               Timezone for daily rollover

Examples:
  cs-devops-agent                    # Start the worker
  cs-devops-agent setup              # Run setup wizard
  cs-devops-agent worktree create    # Create agent worktree
  AC_DEBUG=true cs-devops-agent      # Start with debug logging
        `);
        process.exit(0);
        break;
    default:
        // Default to running the main worker
        scriptPath = path.join(__dirname, 'src', 'cs-devops-agent-worker.js');
}

// Import and run the selected script
try {
    require(scriptPath);
} catch (error) {
    console.error('Error running CS_DevOpsAgent:', error.message);
    process.exit(1);
}
EOF
    
    print_success "Created binary wrapper"
}

# Create package.json for binary
create_binary_package() {
    print_header "Creating Binary Package Configuration"
    
    cat > binary-package.json << EOF
{
  "name": "cs-devops-agent",
  "version": "$VERSION",
  "description": "CS_DevOpsAgent - Standalone binary",
  "main": "binary-wrapper.js",
  "bin": {
    "cs-devops-agent": "binary-wrapper.js"
  },
  "pkg": {
    "scripts": [
      "src/**/*.js",
      "deploy_test/**/*.sh"
    ],
    "assets": [
      "package.json",
      "docs/**/*",
      "LICENSE"
    ],
    "targets": [
      "node18-macos-x64",
      "node18-macos-arm64", 
      "node18-linux-x64",
      "node18-win-x64"
    ],
    "outputPath": "dist",
    "compress": "GZip"
  },
  "dependencies": {
    "chokidar": "^3.5.3",
    "execa": "^7.1.1"
  }
}
EOF
    
    print_success "Created binary package.json"
}

# Install dependencies
install_deps() {
    print_header "Installing Dependencies"
    
    print_info "Installing production dependencies..."
    npm ci --production 2>/dev/null || npm install --production
    print_success "Dependencies installed"
}

# Build binaries
build_binaries() {
    print_header "Building Binaries"
    
    for target in "${TARGETS[@]}"; do
        print_info "Building for $target..."
        
        # Extract platform and arch
        platform=$(echo $target | cut -d'-' -f2)
        arch=$(echo $target | cut -d'-' -f3)
        
        # Determine output name
        case $platform in
            macos)
                output_name="${BINARY_NAME}-macos-${arch}"
                ;;
            linux)
                output_name="${BINARY_NAME}-linux-${arch}"
                ;;
            win)
                output_name="${BINARY_NAME}-windows-${arch}.exe"
                ;;
        esac
        
        # Build the binary
        if pkg binary-wrapper.js \
            --target=$target \
            --output="${BUILD_DIR}/${output_name}" \
            --compress=GZip \
            --config=binary-package.json; then
            
            print_success "Built ${output_name}"
            
            # Make executable on Unix systems
            if [[ "$platform" != "win" ]]; then
                chmod +x "${BUILD_DIR}/${output_name}"
            fi
        else
            print_error "Failed to build for $target"
        fi
    done
}

# Create distribution archives
create_archives() {
    print_header "Creating Distribution Archives"
    
    cd "$BUILD_DIR"
    
    for file in cs-devops-agent-*; do
        if [ -f "$file" ]; then
            archive_name="${file}-v${VERSION}.tar.gz"
            tar -czf "$archive_name" "$file"
            print_success "Created $archive_name"
            rm "$file"  # Remove uncompressed binary
        fi
    done
    
    cd ..
}

# Generate checksums
generate_checksums() {
    print_header "Generating Checksums"
    
    cd "$BUILD_DIR"
    
    # Create checksum file
    echo "# CS_DevOpsAgent v${VERSION} Checksums" > checksums.txt
    echo "# Generated on $(date)" >> checksums.txt
    echo "" >> checksums.txt
    
    for file in *.tar.gz; do
        if [ -f "$file" ]; then
            if command -v sha256sum &> /dev/null; then
                sha256sum "$file" >> checksums.txt
            elif command -v shasum &> /dev/null; then
                shasum -a 256 "$file" >> checksums.txt
            fi
            print_success "Generated checksum for $file"
        fi
    done
    
    cd ..
}

# Create README for distribution
create_dist_readme() {
    print_header "Creating Distribution README"
    
    cat > "${BUILD_DIR}/README.md" << EOF
# CS_DevOpsAgent Binary Distribution

Version: ${VERSION}
Built: $(date)

## Installation

### macOS (Intel)
\`\`\`bash
tar -xzf cs-devops-agent-macos-x64-v${VERSION}.tar.gz
chmod +x cs-devops-agent-macos-x64
sudo mv cs-devops-agent-macos-x64 /usr/local/bin/cs-devops-agent
\`\`\`

### macOS (Apple Silicon)
\`\`\`bash
tar -xzf cs-devops-agent-macos-arm64-v${VERSION}.tar.gz
chmod +x cs-devops-agent-macos-arm64
sudo mv cs-devops-agent-macos-arm64 /usr/local/bin/cs-devops-agent
\`\`\`

### Linux
\`\`\`bash
tar -xzf cs-devops-agent-linux-x64-v${VERSION}.tar.gz
chmod +x cs-devops-agent-linux-x64
sudo mv cs-devops-agent-linux-x64 /usr/local/bin/cs-devops-agent
\`\`\`

### Windows
\`\`\`powershell
# Extract the archive
tar -xzf cs-devops-agent-windows-x64-v${VERSION}.tar.gz
# Move to a directory in your PATH
Move-Item cs-devops-agent-windows-x64.exe "C:\\Program Files\\cs-devops-agent.exe"
\`\`\`

## Usage

\`\`\`bash
# Run setup wizard
cs-devops-agent setup

# Start the agent
cs-devops-agent

# Start with debug logging
AC_DEBUG=true cs-devops-agent

# Show help
cs-devops-agent help
\`\`\`

## Verify Installation

\`\`\`bash
cs-devops-agent --version
\`\`\`

## Checksums

See \`checksums.txt\` for SHA256 checksums to verify file integrity.

## Support

Repository: https://github.com/SecondBrainAICo/CS_DevOpsAgent
Issues: https://github.com/SecondBrainAICo/CS_DevOpsAgent/issues
EOF
    
    print_success "Created distribution README"
}

# Main build process
main() {
    print_header "CS_DevOpsAgent Binary Build System"
    print_info "Version: $VERSION"
    
    check_prerequisites
    clean_build
    create_wrapper
    create_binary_package
    install_deps
    build_binaries
    create_archives
    generate_checksums
    create_dist_readme
    
    print_header "Build Complete!"
    print_success "Binaries available in: $BUILD_DIR"
    print_info "Files created:"
    ls -lh "$BUILD_DIR"/*.tar.gz
    
    echo ""
    print_info "To test a binary locally:"
    echo "  tar -xzf dist/cs-devops-agent-macos-arm64-v${VERSION}.tar.gz -C /tmp"
    echo "  /tmp/cs-devops-agent-macos-arm64 help"
}

# Run if not sourced
if [ "${BASH_SOURCE[0]}" == "${0}}" ]; then
    main "$@"
fi