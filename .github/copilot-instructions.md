This project ports a set of static Tailwind HTML mockups (in docs/screens-reference/) into React components. Rules:
- Never invent new colors, spacing, radius, or font sizes — only use the tokens defined in tailwind.config.ts.
- When porting a screen, open its matching folder under docs/screens-reference/ first and match its markup, copy, and structure closely.
- Repeated visual patterns (buttons, cards, modals, chips, inputs) must become shared components in src/components/ui — never copy-paste raw Tailwind class strings across pages.
- This is a frontend-only build: no real backend calls. Use mock data / in-memory state / fake async delays, and mark every stub clearly with `// TODO: connect to backend`.
