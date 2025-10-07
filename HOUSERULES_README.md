# House Rules Documentation

This repository contains multiple versions of the house rules to accommodate different project structures and needs.

## Available Versions

### 1. Traditional Structure Version
**File**: `houserules_improved_traditional.md`

**Use When**:
- Working with existing projects that use `/src` and `/test_cases` folders
- Migrating from legacy codebases
- Teams prefer traditional folder organization
- Quick setup without restructuring existing code

**Structure**:
```
Project/
├── src/                   # All source code
├── test_cases/           # All test files
├── infrastructure/       # Infrastructure documentation
└── [other folders]
```

### 2. Modular Structure Version
**File**: `houserules_improved.md`

**Use When**:
- Starting new projects
- Want better code organization and scalability
- Working with large, complex applications
- Teams prefer domain-driven design approach

**Structure**:
```
Project/
├── ModuleName/           # Module-based organization
│   ├── src/
│   │   └── featurename/
│   └── test/
│       └── featurename/
├── infrastructure/       # Infrastructure documentation
└── [other folders]
```

**Additional File**: `folders.md` - Detailed folder structure guide for the modular approach

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

| Factor | Traditional | Modular |
|--------|-------------|---------|
| **Existing Codebase** | ✅ Better | ❌ Requires migration |
| **New Projects** | ✅ Good | ✅ Better |
| **Large Applications** | ❌ Can become cluttered | ✅ Excellent |
| **Team Learning Curve** | ✅ Familiar | ❌ Requires training |
| **Long-term Maintainability** | ❌ Harder to scale | ✅ Excellent |
| **Feature Isolation** | ❌ Limited | ✅ Excellent |

## Migration Path

If you want to transition from traditional to modular structure:

1. Start with `houserules_improved_traditional.md`
2. Gradually move features into module-based folders
3. Update to `houserules_improved.md` and `folders.md`
4. Use the migration guide in `local_deploy/folder_structure_migration.md`

## Implementation

1. **Choose your version** based on project needs
2. **Copy the appropriate houserules file** to your project as `houserules.md`
3. **Copy `folders.md`** if using the modular structure
4. **Create `/infrastructure/infrastructure.md`** using the provided template
5. **Train your team** on the new standards and protocols

## Support Files

- `infrastructure/infrastructure.md` - Template for documenting infrastructure
- `folders.md` - Detailed folder structure guide (modular version only)
- `local_deploy/folder_structure_migration.md` - Migration guide
- `local_deploy/improvement_summary.md` - Summary of all changes made

Both versions provide the same level of infrastructure management and coordination features - the only difference is the folder organization approach.
