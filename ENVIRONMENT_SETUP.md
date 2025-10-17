# Environment Configuration Guide

## Overview
The application now supports environment-aware data storage to prevent test data from contaminating production data.

## Environment Variables

### Required Environment Variable
Add this to your `.env.local` file:

```bash
# Environment Configuration
# This determines which data files are used for storage
# Options: development, staging, production
ENVIRONMENT=development
```

## File Structure by Environment

### Development (Local)
- **Data File**: `data/brackets-development.json`
- **Environment**: `ENVIRONMENT=development` or `NODE_ENV=development`
- **Use Case**: Local development, testing, feature branches

### Staging (Pre-Production)
- **Data File**: `data/brackets-staging.json`
- **Environment**: `ENVIRONMENT=staging`
- **Use Case**: Pre-production testing, integration testing

### Production (Live)
- **Data File**: `data/brackets-production.json`
- **Environment**: `ENVIRONMENT=production`
- **Use Case**: Live production environment

## Environment Detection Priority

The system detects environment in this order:
1. `ENVIRONMENT` environment variable (highest priority)
2. `NODE_ENV` environment variable
3. Defaults to `development`

## Deployment Examples

### Local Development
```bash
# .env.local
ENVIRONMENT=development
NODE_ENV=development
```

### Staging Deployment
```bash
# .env.staging
ENVIRONMENT=staging
NODE_ENV=production
```

### Production Deployment
```bash
# .env.production
ENVIRONMENT=production
NODE_ENV=production
```

## Data Isolation

- **Development**: All test brackets, experimental features
- **Staging**: Pre-production testing, final validation
- **Production**: Real user submissions, live tournament data

## Benefits

1. **Data Safety**: Test data never contaminates production
2. **Environment Isolation**: Each environment has its own data
3. **Easy Testing**: Switch environments by changing one variable
4. **Deployment Safety**: Staging can test without affecting production

## Current Status

- ✅ Environment-aware file naming implemented
- ✅ Development environment configured
- ✅ Data isolation working
- ✅ Ready for staging and production deployment

