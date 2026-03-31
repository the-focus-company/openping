# Contributing to PING

Thanks for your interest in contributing to PING! This guide will help you get started.

## Development Setup

```bash
git clone https://github.com/the-focus-company/openping.git
cd openping
pnpm install
```

You'll need:
- Node.js 20+
- pnpm 10+
- A [Convex](https://convex.dev) account (free tier works)

```bash
npx convex dev    # Start Convex backend
pnpm dev          # Start all apps
```

## How to Contribute

### Reporting Bugs

Open an issue with:
- Steps to reproduce
- Expected vs actual behavior
- Screenshots if applicable

### Suggesting Features

Open an issue tagged `enhancement` describing the problem you'd like solved (not just the solution).

### Submitting Code

1. Fork the repo and create a branch from `main`:
   ```bash
   git checkout -b feat/your-feature
   ```
2. Use [conventional commits](https://www.conventionalcommits.org/):
   - `feat:` new feature
   - `fix:` bug fix
   - `chore:` maintenance
   - `docs:` documentation
3. Make sure CI passes:
   ```bash
   pnpm lint
   pnpm typecheck
   pnpm build
   ```
4. Open a PR against `main`

### PR Guidelines

- Keep PRs focused — one feature or fix per PR
- Fill out the PR template
- CI must pass (Lint, Typecheck, Build)

## Project Structure

```
apps/web/          — Next.js frontend
apps/mobile/       — React Native (Expo) mobile app
apps/docs/         — Astro documentation site
convex/            — Convex serverless backend
packages/shared/   — Shared types and utilities
services/          — External services (Knowledge Engine)
```

## Code Style

- TypeScript throughout
- Tailwind CSS for styling
- No Redux/Zustand — use Convex real-time hooks
- Follow existing patterns in the codebase

## License

By contributing, you agree that your contributions will be licensed under the [Apache License 2.0](LICENSE).
