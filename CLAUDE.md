# Cadence course platform

## Commands

- npm run dev: start the app
- npm run typecheck / npm test: check work
- npm run db:migrate: apply migrations
- npm run db:seed: WIPES and rebuilds data.db. Never run without asking.

## Project Rules

- Database code in services, called from loaders/actions, never in components.
- Validate all form input on server. Never trust values from browser.
- The user id always comes from the session.
- Only commit when asked. Show git status first.
- Delete replaced code; never leave it commented out.
- Don't change the schema unless the task says so.
- No changes outside the task (config, .gitignore) without asking first.
- Before saying “done”: npm run typecheck and npm test pass.
