# CLAUDE.md
Public open-source project by Zaqi Silverano. Spec: docs/superpowers/specs/. Prototype reference: docs/reference/prototype/.
## Boundary rule
engine/, lib/llm, lib/agents, lib/export, lib/sample import nothing from react, next or db/. engine/layout.ts must not import three.
## Commands
npm run dev · npm run typecheck · npm run lint · npm test · npm run test:e2e · npm run db:migrate
## Git
Plain commit messages. No Co-Authored-By trailer, no "generated with" line. Never commit .env files.
