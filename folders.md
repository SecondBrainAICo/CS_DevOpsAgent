# Project Folder Structure & Subfolder Policy

This document outlines the standard folder structure for this project. All files **MUST** be placed in their respective folders as described below. You may create new module and feature subfolders following the established patterns, but **MUST** update this document when doing so. Do not create folders in the root directory or deviate from the module/feature structure.

## Root Level Folders

| Folder | Description |
| :--- | :--- |
| `/[ModuleName]` | Module-specific folders containing `src/` and `test/` subfolders for each feature area. |
| `/test_scripts` | Scripts for executing tests across all modules. |
| `/docs` | Project documentation, including design documents and user guides. |
| `/deploy_test` | Scripts and files for testing deployment processes. |
| `/local_deploy` | **(Gitignored)** All temporary, debug, and local-only files. This includes session logs, worktrees, and any other files not intended for the repository. |
| `/product_requirement_docs` | Product Requirement Documents (PRDs) that outline the features and functionality of the application. |
| `/infrastructure` | Contains all infrastructure-related documentation, including `infrastructure.md`, which details servers, instances, and Docker information. **MUST** be read before creating new infrastructure. |

## Subfolder Organization Policy

### Module-Based Structure

All code and tests **MUST** follow this modular organization pattern:

```
/ModuleName/src/featurename/
/ModuleName/test/featurename/
```

This structure makes it easy to connect related code and tests, improving maintainability and navigation.

### Examples of Proper Structure

```
/UserManagement/src/authentication/
/UserManagement/src/profile/
/UserManagement/src/permissions/
/UserManagement/test/authentication/
/UserManagement/test/profile/
/UserManagement/test/permissions/

/PaymentProcessing/src/stripe-integration/
/PaymentProcessing/src/invoice-generation/
/PaymentProcessing/test/stripe-integration/
/PaymentProcessing/test/invoice-generation/

/NotificationSystem/src/email-service/
/NotificationSystem/src/push-notifications/
/NotificationSystem/test/email-service/
/NotificationSystem/test/push-notifications/
```

## Subfolder Creation Protocol

When creating new modules or features, you **MUST**:

1. **Follow the Module/Feature Pattern**: Use `/ModuleName/src/featurename/` or `/ModuleName/test/featurename/`
2. **Check if Module Exists**: If the module doesn't exist, create both `/ModuleName/src/` and `/ModuleName/test/` directories
3. **Create Feature Folders**: Add the specific feature folder within the appropriate module
4. **Update This Document**: Add an entry to the "Current Subfolders" section below explaining the new module/feature
5. **Provide Clear Description**: Explain the module's purpose and what features it contains
6. **Link Related Folders**: Show the connection between src and test folders

## Current Subfolders

### User Management Module
- **Purpose**: Handles all user-related functionality including authentication, profiles, and permissions
- **Source**: `/UserManagement/src/`
  - `authentication/` - Login, logout, session management
  - `profile/` - User profile CRUD operations
  - `permissions/` - Role-based access control
- **Tests**: `/UserManagement/test/`
  - `authentication/` - Authentication flow tests
  - `profile/` - Profile management tests
  - `permissions/` - Permission system tests

### DevOps Agent Core
- **Purpose**: Core DevOps agent functionality for automation and deployment
- **Source**: `/DevOpsCore/src/`
  - `worktree-management/` - Git worktree operations
  - `session-coordination/` - Multi-agent session handling
  - `commit-automation/` - Automated commit processing
- **Tests**: `/DevOpsCore/test/`
  - `worktree-management/` - Worktree operation tests
  - `session-coordination/` - Session management tests
  - `commit-automation/` - Commit automation tests

### Infrastructure Management
- **Purpose**: Infrastructure provisioning, monitoring, and documentation
- **Source**: `/Infrastructure/src/`
  - `docker-management/` - Container orchestration
  - `server-provisioning/` - Server setup and configuration
  - `monitoring/` - Health checks and alerting
- **Tests**: `/Infrastructure/test/`
  - `docker-management/` - Container tests
  - `server-provisioning/` - Provisioning tests
  - `monitoring/` - Monitoring system tests

## Subfolder Naming Conventions

### Module Names
- Use **PascalCase** for module names (e.g., `UserManagement`, `PaymentProcessing`)
- Choose descriptive names that clearly indicate the module's domain
- Keep module names concise but meaningful

### Feature Names
- Use **kebab-case** for feature names (e.g., `user-authentication`, `stripe-integration`)
- Feature names should be specific and action-oriented
- Avoid generic names like `utils` or `helpers`

### File Organization Within Features
```
/ModuleName/src/featurename/
├── index.js              # Main entry point
├── controller.js         # Business logic
├── service.js           # External service interactions
├── model.js             # Data models
├── validation.js        # Input validation
└── config.js            # Feature-specific configuration

/ModuleName/test/featurename/
├── controller.test.js    # Controller tests
├── service.test.js      # Service tests
├── integration.test.js  # Integration tests
└── fixtures/            # Test data
```

## Adding New Modules/Features

When you need to create a new module or feature:

1. **Check Existing Modules**: See if your feature fits into an existing module
2. **Create Module Structure**: If new module needed, create both `/ModuleName/src/` and `/ModuleName/test/` directories
3. **Add Feature Folders**: Create specific feature folders within the module
4. **Update Documentation**: Add entries to this document explaining the new structure
5. **Follow Naming Conventions**: Use PascalCase for modules, kebab-case for features

## Template for New Module Entries

When adding a new module to this document, use this template:

```markdown
### [Module Name]
- **Purpose**: [Brief description of what this module handles]
- **Source**: `/ModuleName/src/`
  - `feature-name/` - [Description of feature]
  - `another-feature/` - [Description of feature]
- **Tests**: `/ModuleName/test/`
  - `feature-name/` - [Description of tests]
  - `another-feature/` - [Description of tests]
```

## Benefits of This Structure

1. **Clear Separation**: Each module has its own domain and responsibilities
2. **Easy Navigation**: Related code and tests are co-located
3. **Scalability**: New features can be added without cluttering existing modules
4. **Maintainability**: Changes to a feature are contained within its folder
5. **Testing**: Test structure mirrors source structure for easy correlation

## Enforcement

- Agents **MUST** follow the `/ModuleName/src/featurename/` and `/ModuleName/test/featurename/` pattern
- New modules and features are allowed but **MUST** update this document
- Any deviation from the module/feature structure is prohibited
- Files **MUST NOT** be placed in the root directory
- Code reviews should verify proper folder placement and documentation updates
- Automated tools may enforce this structure in the future


## Quick Reference for Creating New Folders

### Creating a New Feature in Existing Module
```bash
# If UserManagement module exists, add new feature:
mkdir -p UserManagement/src/password-reset
mkdir -p UserManagement/test/password-reset
# Then update this document with the new feature description
```

### Creating a New Module
```bash
# Create new module with first feature:
mkdir -p EmailService/src/template-engine
mkdir -p EmailService/test/template-engine
# Then update this document with the new module and feature descriptions
```

### What to Update in This Document
When you create new folders, add entries like this:

```markdown
### Email Service Module
- **Purpose**: Handles all email-related functionality including templates and delivery
- **Source**: `/EmailService/src/`
  - `template-engine/` - Email template processing and rendering
  - `delivery-service/` - Email sending and queue management
- **Tests**: `/EmailService/test/`
  - `template-engine/` - Template engine tests
  - `delivery-service/` - Delivery service tests
```
