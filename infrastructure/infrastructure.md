# Infrastructure Documentation

**Last Updated**: 2025-01-07  
**Maintained By**: DevOps Agent

## Overview

This document tracks all infrastructure resources for this project. **MUST READ** this file before creating any new servers, instances, or Docker containers to prevent conflicts.

## Current Infrastructure

### Servers

| Name | Type | Purpose | Status | Ports | Access |
|------|------|---------|--------|-------|--------|
| main-app-server | EC2 t3.medium | Primary application server | Active | 80, 443, 3000 | SSH via key-pair |
| db-server | RDS PostgreSQL | Primary database | Active | 5432 | VPC internal only |

### Docker Containers

| Container Name | Image | Purpose | Status | Ports | Dependencies |
|----------------|-------|---------|--------|-------|--------------|
| web-app | node:18-alpine | Frontend application | Running | 3000:3000 | Redis, PostgreSQL |
| redis-cache | redis:7-alpine | Session cache | Running | 6379:6379 | None |
| nginx-proxy | nginx:alpine | Reverse proxy | Running | 80:80, 443:443 | web-app |

### Services & APIs

| Service Name | Type | Purpose | Endpoint | Status |
|--------------|------|---------|----------|--------|
| user-api | REST API | User management | /api/users | Active |
| auth-service | OAuth2 | Authentication | /auth | Active |

## Network Configuration

### Port Allocation

| Port Range | Purpose | Assigned To |
|------------|---------|-------------|
| 3000-3099 | Web applications | web-app (3000), admin-panel (3001) |
| 5000-5099 | APIs | user-api (5000), notification-api (5001) |
| 6000-6099 | Databases | Redis (6379), MongoDB (6027) |
| 8000-8099 | Monitoring | Prometheus (8080), Grafana (8081) |

### Reserved Ports
- **3000**: Main web application
- **5432**: PostgreSQL database
- **6379**: Redis cache
- **80/443**: Nginx reverse proxy

## Environment Variables

### Shared Configuration
```bash
NODE_ENV=production
DATABASE_URL=postgresql://user:pass@db-server:5432/appdb
REDIS_URL=redis://redis-cache:6379
```

### Security Notes
- All database connections use SSL
- API keys stored in environment variables
- No hardcoded credentials in configuration files

## Deployment Information

### Docker Compose Services
```yaml
# Key services from docker-compose.yml
services:
  web-app:
    ports: ["3000:3000"]
    depends_on: [redis-cache, db-server]
  
  redis-cache:
    ports: ["6379:6379"]
  
  nginx-proxy:
    ports: ["80:80", "443:443"]
    depends_on: [web-app]
```

### Health Checks
- **web-app**: GET /health (every 30s)
- **user-api**: GET /api/health (every 30s)
- **redis-cache**: PING command (every 60s)

## Rollback Procedures

### Container Rollback
```bash
# Stop current version
docker-compose down

# Restore previous version
docker-compose -f docker-compose.backup.yml up -d
```

### Database Rollback
- Automated backups every 6 hours
- Point-in-time recovery available for last 7 days
- Manual backup before major schema changes

## Monitoring & Alerts

### Metrics Collected
- CPU and memory usage per container
- Database connection pool status
- API response times and error rates
- Disk usage and network I/O

### Alert Thresholds
- CPU > 80% for 5 minutes
- Memory > 90% for 2 minutes
- API error rate > 5% for 1 minute
- Database connections > 80% of pool

## Change Log

### 2025-01-07
- **Added**: nginx-proxy container for SSL termination
- **Modified**: web-app now serves on port 3000 internally
- **Removed**: Direct SSL handling from web-app

### 2025-01-06
- **Added**: Redis cache container for session storage
- **Modified**: Database connection pooling increased to 20 connections

---

## Instructions for Updates

When creating new infrastructure:

1. **Check Conflicts**: Review port allocations and naming conventions
2. **Add Entry**: Document the new resource in the appropriate section above
3. **Update Dependencies**: Note any services that depend on the new resource
4. **Test Integration**: Verify the new resource works with existing infrastructure
5. **Update Monitoring**: Add health checks and alerts if needed
6. **Document Rollback**: Include instructions for safely removing the resource

**Template for New Entries**:
```markdown
### New Resource Name
- **Type**: [Server/Container/Service]
- **Purpose**: [What it does]
- **Configuration**: [Key settings, ports, environment variables]
- **Dependencies**: [What it needs to function]
- **Access**: [How to connect or manage it]
- **Rollback**: [How to safely remove]
```
