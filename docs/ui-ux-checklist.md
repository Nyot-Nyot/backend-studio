# Visual & UX Checklist

Tujuan: menyediakan checklist teknis dan acceptance criteria yang dapat diikuti pengembang dan desainer saat melakukan perbaikan visual / UX.

## 1. Design tokens (wajib)

-   Warna (palette semantic): primary, primary-600, neutral, success, warning, danger, surface, border, text-primary, text-muted.
-   Spacing scale: 4, 8, 12, 16, 24, 32 (gunakan variabel token seperti `--space-4` atau `tokens.spacing[4]`).
-   Typografi: scale (xs, sm, base, lg, xl), font-weight mapping, line-heights.
-   Radii: small (4px), medium (8px), large (12px).
-   Shadow tokens: small, medium, large.

Acceptance criteria:

-   Semua komponen utama membaca nilai dari token (no hardcoded color/spacing for components).
-   Storybook shows token palette and examples for both light/dark themes.

Status: Implemented (initial)

-   Implemented `tokens.css` and `themeUtils` for apply/store/toggle theme.
-   Migrated `Button` -> `components/Button.tsx` and `Dashboard` ActionButton to use it.
-   Added `Input` and `Textarea` components and migrated `EmailExportModal` to use them.
-   Added basic stories for `Button` and `Input` (storybook skeleton).

Next steps:

-   Migrate remaining components (Modal/Toast full refactor, Sidebar, Form controls) to tokens and add Storybook stories.

## 2. Spacing & layout

-   Define consistent margin/padding rules for: page container, section spacing, form row spacing, card padding.
-   Use spacing tokens everywhere; remove direct `px` spacing in components.

Acceptance criteria:

-   Visual diff between old and new styles is acceptable; playbook lists components that need manual tweaks.

## 3. Component checklist (per component)

-   Button
    -   Variants: primary, secondary, ghost, destructive
    -   States: default, hover, active, focus (visible outline), disabled, loading
    -   Accessibility: focusable, has aria-label when icon-only
    -   Acceptance: unit + Storybook stories for each variant & state
-   Input / Select / Textarea
    -   States: default, focus (outline), invalid (error), disabled, readonly
    -   Labels: assoc `label` with `id`; inline help text
    -   Acceptance: keyboard navigation + focus order tests
-   Modal / Dialog
    -   Focus trap implemented; background scrim; accessible title/description
    -   Close via ESC and close button
    -   Acceptance: Playwright a11y check + keyboard navigation test
-   Toast / Notification
    -   Variants: success, error, info
    -   Auto-dismiss with pause-on-hover & accessible announcements (aria-live)
    -   Acceptance: visual snapshot + accessibility live region test
-   Form patterns
    -   Inline validation messages, consistent spacing, primary action placement
    -   Acceptance: unit tests for validation messages + keyboard flows

## 4. Micro-interactions & motion

-   Standardize durations (200ms for hover/press, 300ms for modal entrance)
-   Use `prefers-reduced-motion` to disable non-essential motion
-   Acceptance: ensure motion is smooth & non-blocking; add small unit tests if necessary.

## 5. Icons & imagery

-   Use a single icon set; provide mapping and size tokens (icon-sm, icon-md, icon-lg)
-   Ensure decorative icons have `aria-hidden` and informative icons have accessible labels

## 6. Accessibility (a11y)

-   Run `axe` or `playwright+axe` on main pages; fix top issues: contrast, labels, focus order, modal traps
-   Provide keyboard-only walkthroughs for critical flows
-   Acceptance: CI a11y job passes with no critical/serious violations

## 7. Storybook & visual regression

-   Setup Storybook skeleton; add stories for Button, Input, Modal, Toast, MockEditor small pieces
-   Add Playwright snapshot tests for critical pages (Dashboard, MockEditor, DatabaseView)
-   Acceptance: snapshots committed and CI per-PR visual checks run

## 8. Cross-browser & responsive

-   Test breakpoints (mobile, tablet, desktop) for Dashboard, MockEditor, DatabaseView
-   Acceptance: Playwright responsive checks + manual spot checks on Safari/Firefox/Chrome

## 9. Usability testing

-   Script & checklist for 3–5 users; capture tasks, success rate, time-on-task, and major friction points
-   Acceptance: pre-defined changes from testing prioritized and added to backlog

## 10. Release checklist & acceptance criteria

-   Each visual change must include:
    -   Storybook entry
    -   Unit & e2e/a11y tests (where applicable)
    -   Acceptance criteria in PR description
    -   Visual snapshot approval (if snapshot changed)

---

Next steps:

-   Implement tokens and theme in `src/theme` or `src/styles` and add a minimal Storybook.
-   Convert `Button`, `Input`, `Modal`, `Toast` to use tokens, add stories and tests, one component per PR.
