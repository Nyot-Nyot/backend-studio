# Storybook setup (notes)

This repository doesn't include Storybook as a dependency by default. To set up Storybook locally:

1. Install Storybook: `npx sb@latest init` or `npm i -D @storybook/react @storybook/addon-essentials`
2. Add a `stories` folder and create stories for the components you want to document (e.g., `components/Button.stories.tsx`).
3. Recommended initial stories: `Button`, `Input`, `Textarea`, `Modal`, `Toast`.
4. Configure Storybook to load `src/theme/tokens.css` in `preview.js` or import the tokens inside stories to ensure theme variables are available.
5. Optional: add Chromatic / Percy / Playwright visual snapshot integration for CI visual regression tests.

Minimal files included here are a starting point and safe to add as documentation; they do not install Storybook automatically.
