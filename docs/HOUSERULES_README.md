# House Rules Documentation

This repository contains two versions of the house rules to accommodate different project organization preferences.

## Available Versions

### 1. Core Version (Structure-Agnostic)
**File**: `houserules_core.md`

**Use When**:
- Want essential coordination and infrastructure features only
- Team prefers to organize folders their own way
- Working with existing projects with established structure
- Quick setup without opinionated folder organization

**What You Get**:
- Infrastructure coordination and documentation requirements
- File coordination protocol for multi-agent work
- Essential DevOps agent features
- `local_deploy/` folder for temporary files
- No specific folder structure requirements

### 2. Structured Version (Full Organization)
**File**: `houserules_structured.md`

**Use When**:
- Want comprehensive folder organization system
- Starting new projects that will scale
- Team wants opinionated structure for consistency
- Working with large, complex applications

**What You Get**:
- Everything from the core version
- Complete modular folder structure (`/ModuleName/src/featurename/`)
- Detailed folder creation and management rules
- Reference to `folders.md` for structure guidance

**Additional File**: `folders.md` - Detailed folder structure guide and creation protocols

## Key Features (Both Versions)

Both versions include the same core improvements:

### ✅ Infrastructure Management
- **MUST** read `/infrastructure/infrastructure.md` before creating servers, instances, or Docker containers
- Prevents port conflicts and resource naming collisions
- Comprehensive documentation requirements for new infrastructure

### ✅ Enhanced File Coordination
- Multi-agent coordination protocol to prevent conflicts
- Declaration system for file edits and infrastructure changes
- Session management and recovery systems

### ✅ Improved Organization
- Better structured sections and clear navigation
- Comprehensive commit message standards
- Enhanced testing policies and code quality guidelines

### ✅ Security & Best Practices
- Input validation requirements
- Command injection prevention
- Logging policies and security guidelines

## Choosing the Right Version

| Factor | Core (Structure-Agnostic) | Structured (Full Organization) |
|--------|---------------------------|--------------------------------|
| **Existing Codebase** | ✅ Perfect - No changes needed | ❌ May require restructuring |
| **New Projects** | ✅ Good - Quick start | ✅ Excellent - Scales well |
| **Team Flexibility** | ✅ Maximum freedom | ❌ Must follow structure |
| **Learning Curve** | ✅ Minimal | ❌ Requires training |
| **Long-term Maintainability** | ❌ Depends on team discipline | ✅ Excellent |
| **Large Applications** | ❌ Can become disorganized | ✅ Excellent |
| **Infrastructure Features** | ✅ Full support | ✅ Full support |

## Migration Path

If you want to transition from traditional to modular structure:

1. Start with `houserules_improved_traditional.md`
2. Gradually move features into module-based folders
3. Update to `houserules_improved.md` and `folders.md`
4. Use the migration guide in `local_deploy/folder_structure_migration.md`

## Implementation

### Automatic Setup (Recommended)
The DevOps agent will ask during setup:
- "Do you want structured folder organization? (Y/N)"
- **Y**: Copies `houserules_structured.md` and `folders.md` to your project
- **N**: Copies `houserules_core.md` to your project
- Always creates `/infrastructure/infrastructure.md` template

### Manual Setup
1. **Choose your version** based on project needs
2. **Copy the appropriate houserules file** to your project as `houserules.md`
3. **Copy `folders.md`** if using the structured version
4. **Create `/infrastructure/infrastructure.md`** using the provided template
5. **Train your team** on the new standards and protocols

## Support Files

- `infrastructure/infrastructure.md` - Template for documenting infrastructure
- `folders.md` - Detailed folder structure guide (modular version only)
- `local_deploy/folder_structure_migration.md` - Migration guide
- `local_deploy/improvement_summary.md` - Summary of all changes made

Both versions provide the same level of infrastructure management and coordination features - the only difference is the folder organization approach.
