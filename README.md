# GitLab Auto-Trigger Pipeline Script

A TypeScript-based script to automatically trigger GitLab pipelines using the GitLab API. This script is compatible with ES modules, uses pnpm as the package manager, and stores sensitive information in environment variables.

## Features

- ✅ ES Module compatibility
- ✅ TypeScript for type safety
- ✅ pnpm as package manager
- ✅ Environment variables for sensitive information
- ✅ User-friendly CLI output
- ✅ Proper error handling
- ✅ GitLab API integration for pipeline triggering
- ✅ Support for pipeline variables

## Prerequisites

- Node.js 18+ 
- pnpm package manager
- GitLab account with API access
- GitLab private token with `api` scope

## Setup

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd auto-pipeline
   ```

2. **Install dependencies**
   ```bash
   pnpm install
   ```

3. **Configure environment variables**
   - Copy the example environment file:
     ```bash
     cp .env.example .env
     ```
   - Edit `.env` and add your GitLab configuration:
     ```env
     GITLAB_HOST=https://gitlab.com
     GITLAB_PROJECT_ID=your-project-id
     GITLAB_PRIVATE_TOKEN=your-private-token
     REF_NAME=main
     ```

4. **Build the project** (optional)
   ```bash
   pnpm run build
   ```

## Usage

### Run the script

```bash
pnpm start
```

### Run in development mode (with watch)

```bash
pnpm run dev
```

### Run with custom environment variables

```bash
GITLAB_PROJECT_ID=12345 REF_NAME=develop pnpm start
```

## Configuration

### Required Environment Variables

| Variable | Description | Example |
|----------|-------------|---------|
| `GITLAB_HOST` | GitLab instance URL | `https://gitlab.com` |
| `GITLAB_PROJECT_ID` | GitLab project ID | `12345` |
| `GITLAB_PRIVATE_TOKEN` | GitLab private token with API scope | `glpat-xxxxxxxxxxxx` |
| `REF_NAME` | Branch or tag to trigger pipeline on | `main` or `v1.0.0` |

### Optional Environment Variables

| Variable | Description | Example |
|----------|-------------|---------|
| `BRANCH` | Alias for `REF_NAME` (deprecated) | `main` |
| `VARIABLE_<KEY>` | Pipeline variables (prefix with `VARIABLE_`) | `VARIABLE_ENV=production` |

## Pipeline Variables

To pass variables to your GitLab pipeline, simply add them to your `.env` file with the prefix `VARIABLE_`:

```env
VARIABLE_ENV=production
VARIABLE_VERSION=1.0.0
VARIABLE_DEPLOY_TYPE=blue-green
```

These variables will be automatically included in the pipeline trigger request.

## GitLab API Reference

This script uses the GitLab API endpoint:
- [Trigger a pipeline](https://docs.gitlab.com/ee/api/pipelines.html#trigger-a-pipeline)

## Project Structure

```
auto-pipeline/
├── src/
│   └── index.ts          # Main script entry point
├── .env.example          # Environment variables template
├── .gitignore            # Git ignore rules
├── package.json          # Project configuration
├── tsconfig.json         # TypeScript configuration
└── README.md             # This file
```

## Script Output

The script provides user-friendly output:

```
🚀 Triggering GitLab pipeline...
📋 Project: https://gitlab.com/projects/12345
🔀 Branch: main
📝 Pipeline Variables:
   - ENV: production
   - VERSION: 1.0.0
✅ Pipeline triggered successfully!
📌 Pipeline ID: 123456
🌐 Pipeline URL: https://gitlab.com/group/project/-/pipelines/123456
📊 Status: pending
🔍 SHA: a1b2c3d4e5f6g7h8i9j0
```

## Error Handling

The script includes comprehensive error handling for:
- Missing environment variables
- Invalid GitLab credentials
- Project not found
- Invalid branch name
- API rate limiting

## License

ISC
