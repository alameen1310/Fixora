# Repository Guidelines

## Project Structure & Module Organization

Product direction lives in root `ABOUT.md` and `DESIGN.md`. The React entry point is `src/main.jsx`; `src/App.jsx` is reserved for the application shell and page composition, while `src/index.css` contains global reset, typography, and design tokens. Add substantial route-level pages to `src/pages/`, reusable UI to `src/components/`, and owned assets to `src/assets/` when those features are designed. Keep component-specific styles alongside their JSX. Do not add empty feature placeholders.

## Build, Test, and Development Commands

- `npm install` — install dependencies from `package-lock.json`.
- `npm run dev` — start the Vite development server.
- `npm run build` — create a production build in `dist/`.
- `npm run lint` — check JavaScript and JSX with ESLint.
- `npm run preview` — preview the production build locally.

No test framework is configured yet. Do not report tests as passing unless tests have been added and run.

## Coding Style & Naming Conventions

Use React, Vite, JavaScript, and JSX; do not introduce TypeScript without an explicit direction change. Use PascalCase for React component names and camelCase for functions and variables. Keep `App.jsx` focused on composition rather than page content. Follow the existing ESLint configuration and use clear, consistent formatting.

## Testing Guidelines

There is no configured test runner or coverage target. When adding substantial behavior, add appropriate tests and document how to run them. Run `npm run lint` and `npm run build` before requesting review.

## Commit & Pull Request Guidelines

Recent history uses short, imperative subjects with a category prefix, such as `docs: define Fixora product and design guidelines`. Continue with focused prefixes such as `docs:`, `feat:`, `fix:`, or `chore:`. Pull requests should explain the change, link related work when applicable, list checks performed, and include screenshots for visual changes. Call out assumptions and known limitations.

## Product and Design Expectations

Treat `ABOUT.md` as product vision, not proof that features exist. Use `DESIGN.md` for visual direction and accessibility expectations. Build incrementally and preserve both customer and professional perspectives. Consult the installed GPT Taste skill directly when relevant to interface work.
