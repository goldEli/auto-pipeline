# Auto Pipeline

GitLab Pipeline Auto-Trigger Script with interactive and command-line modes.

## Features

- Trigger pipelines for multiple GitLab projects
- Auto-run manual jobs (configurable via `AUTO_RUN_MANUAL_JOBS=true`)
- Interactive project and branch selection
- Command-line argument support for non-interactive usage

## Setup

1. Install dependencies:
   ```bash
   pnpm install
   ```

2. Configure environment variables in `.env`:
   ```bash
   cp .env.example .env
   ```
   
   Required variables:
   - `GITLAB_HOST` - GitLab instance URL (e.g., `https://git.weex.tech`)
   - `GITLAB_PRIVATE_TOKEN` - GitLab personal access token
   
   Optional variables:
   - `AUTO_RUN_MANUAL_JOBS=true` - Auto-trigger manual jobs after pipeline creation

3. Configure projects in `projects.json`:
   ```json
   [
     {
       "id": "39",
       "name": "Web Separation"
     },
     ...
   ]
   ```

## Usage

### Interactive Mode

Run without arguments for interactive project and branch selection:

```bash
pnpm run start
```

### Command-Line Mode

Use `-p` and `-b` flags to skip interactive prompts:

```bash
# Single project
pnpm run start -p "Web Separation"

# Multiple projects (comma-separated)
pnpm run start -p "Web Separation,Web Core,Web Trade"

# With branch specification
pnpm run start -p "Web Separation" -b "develop"

# Multiple projects with branch
pnpm run start -p "Web Separation,Web Core" -b "feature/new"
```

### Options

| Flag | Description |
|------|-------------|
| `-b, --branch <branch>` | Branch name to trigger pipelines (default: `main`) |
| `-p, --project <projects>` | Project names (comma-separated) from `projects.json` |

### Global Command

Add to `~/.zshrc` for global access:

```bash
alias run_pipeline='cd /Users/eli/Documents/github/auto-pipeline && pnpm run start'
```

Then use:

```bash
run_pipeline
run_pipeline -p "Web Separation" -b "develop"
```

## Commands

| Command | Description |
|---------|-------------|
| `pnpm run start` | Run the pipeline trigger script |
| `pnpm run dev` | Run with watch mode for development |
| `pnpm run build` | Compile TypeScript to JavaScript |
| `pnpm run fetch-projects` | Fetch all projects from GitLab API |
