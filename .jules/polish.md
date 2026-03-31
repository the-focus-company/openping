## 2025-05-18 - Improve Command Palette Readability
**Learning:** The command palette UI text has poor contrast and readability against the background, particularly in dark mode. The placeholder text and hints are too subtle, leading to a degraded UX when searching for agents or chat.
**Action:** Enhance the styling of the command palette input and hints in `apps/web/components/command-palette/CommandPalette.tsx` to improve text contrast, increase the size slightly, and provide clearer visual hierarchy without departing from the existing design system.

## 2025-05-18 - Improved Focus Visibility in Composer
**Learning:** Some elements in the rich text composer lacked clear focus states for keyboard navigation, making it hard for users who rely on keyboards to navigate the app. Roving tab index patterns require explicit focus-visible states on the buttons since they receive programmatic focus.
**Action:** Added `focus-visible:ring-1 focus-visible:ring-ring focus-visible:outline-none` to interactive elements in the composer toolbar to ensure they have visible focus states.
