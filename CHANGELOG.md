# Changelog

## [1.1.0] - 2026-04-01

### Added
- **Workspace guest role** — new `guest` role for workspace members with restricted access:
  - Guests can only see channels they are explicitly assigned to
  - Guests cannot create new channels or DMs
  - Guests have restricted access to search, member directory, and settings
  - Settings navigation hides Knowledge Graph, Email, and API Keys for guests
  - Backend enforcement via `requireAuth` and `getGuestVisibleUserIds` middleware
- Guest role support in team settings UI (admin can assign guest role)

## [1.0.1] - 2026-03-28

### Fixed
- Refactored chat UI: extracted components, added meetings & sidebar DnD (#128)
- Added workspace switcher to mobile profile screen
- Fixed implicit `any` typecheck errors across web app
- Added convex codegen step to CI workflows
- Fixed knowledge-graph page lint errors
- Synced mobile bundle ID with Xcode project

## [1.0.0] - 2026-03-15

- Initial release
