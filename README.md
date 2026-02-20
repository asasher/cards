# cards

Realtime two-player card game app built with:

- TanStack Start (single app frontend)
- Convex (realtime backend)
- Bun (package manager/runtime)
- Turborepo (runs frontend + Convex together)

## Prerequisites

- Bun 1.3+

## Install

```bash
bun install
```

## Development

Run frontend + Convex backend together:

```bash
bun run dev
```

Run individually:

```bash
bun run dev:web
bun run dev:convex
```

## Game implemented

Game 01 is **Lip Read Sprint**:

1. Create or join a room with 2 players.
2. Add custom cards to the shared stack (defaults are seeded automatically).
3. Start a timed round.
4. Reader sees the current card and mouths it silently.
5. Guesser wears headphones and guesses.
6. Correct guesses add 1 point.
7. Round ends on timer/card exhaustion and turn switches automatically.

## Convex backend

- Schema: `convex/schema.ts`
- Game functions: `convex/lipReading.ts`
- Generated API/types: `convex/_generated/`

Useful commands:

```bash
bun run convex:dev
bun run convex:codegen
```

## Build and checks

```bash
bun run build
bun run lint
bun run test
```
