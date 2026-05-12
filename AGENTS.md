<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.

<!-- END:nextjs-agent-rules -->

# Project Conventions

This project uses **Next.js (App Router) + TypeScript + RSC**.
These are the **core conventions**. Other patterns will be defined as the project grows.
When in doubt, ask before deviating.

---

## 1. Top-Level Directory Architecture

Source code is split into five concerns at the root level. Respect the boundaries.
├── app/ # Next.js App Router (routes, layouts, pages)
├── client/ # Browser-only code (hooks, stores, client utils, providers)
├── server/ # Backend-only code
├── shared/ # Code usable from BOTH client and server (types, constants, pure utils)
└── components/ # React components (UI layer)

### Import Direction Rules

- `client/` MUST NOT import from `server/`.
- `server/` MUST NOT import from `client/` or `components/`.
- `shared/` MUST NOT import from `client/`, `server/`, `components/`, or `app/`.
- `components/` MAY import from `client/`, `shared/`. MUST NOT import from `server/`.
- `app/` orchestrates everything; it MAY import from any layer.

If a utility has no runtime dependency on browser or server APIs → put it in `shared/`.

---

## 2. File Naming

- **Components**: `PascalCase.tsx`
- **Hooks**: `useCamelCase.ts`
- **Other files**: `camelCase.ts`

---

## 3. Server Components vs Client Components

- **Default to Server Components.** Do NOT add `"use client"` unless required.
- Add `"use client"` ONLY when the component needs:
  - React hooks (`useState`, `useEffect`, etc.)
  - Browser APIs
  - Event handlers
  - Client-only libraries (Zustand, TanStack Query hooks, etc.)
- **Push `"use client"` boundaries as deep as possible.** Wrap interactive leaves, not whole pages.
- Initial data fetching → Server Component with `async/await`.
- User-interaction-driven fetching → Client Component with TanStack Query.

✅ Good:

```tsx
// app/chat/page.tsx (Server Component)
export default async function ChatPage() {
  const initial = await fetchMessages();
  return <ChatRoom initial={initial} />;
}

// components/domains/chat/ChatRoom.tsx
("use client");
export function ChatRoom({ initial }) {
  /* ... */
}
```

---

## 4. Components Layer

components/
├── commons/ # Domain-agnostic UI primitives (Button, Input, Card, ...)
└── domains/ # Domain-specific components grouped by feature

### `commons/`

- Reusable, domain-agnostic UI.
- MUST NOT contain business logic or domain state.
- MUST NOT import from `domains/`.

### UI Component Installation Rule

- Basic UI components in `commons/` (Button, Toggle, Switch, Input, etc.) MUST be installed from **shadcn/ui**.
- Before writing a component from scratch, always check if it's available via `npx shadcn@latest add <component>`.
- Only implement custom components when shadcn/ui does not provide one.

### `domains/`

- Feature-specific components, organized by domain folder.
- Composes `commons/` components. May connect to stores and query hooks.
- **Rule**: Never place a single file directly under `domains/`. Always nest inside a domain-named subfolder.
  - ✅ `components/domains/chat/ChatRoom.tsx`
  - ❌ `components/domains/ChatRoom.tsx`

Subfolder structure inside `commons/` and `domains/` evolves with the project — group by concern as needed.

---

## 5. State Management

Strictly separate **server state** and **client state**.

### Server State — TanStack Query

- For data fetching, caching, mutations.
- Use built-in `isLoading`, `isError`, `isPending`. Never mirror them into local state.
- **Query key convention**: hierarchical array, general → specific.

```ts
// ✅ Good
["posts", postId][("user", userId, "reviews")][
  // ❌ Bad
  "getPost"
][`post-${postId}`];
```

### Client State — Zustand

- For UI state (modals, sidebars) and purely client-side global state.
- One store per concern, named `useXxxStore.ts`.
- **Anti-pattern (strictly forbidden)**: Duplicating server state into a Zustand store. The query cache IS the source of truth.

---

## 6. Validation & Types (zod)

- Validation schemas use **zod**.
- Derive TS types via `z.infer<typeof schema>`. Do NOT hand-write types that mirror a schema.
- For non-schema types: prefer `type` over `interface` unless declaration merging is needed.
- Avoid `any`. Use `unknown` and narrow.

---

## 7. General Rules

- **Imports**: Use the `@/*` path alias. No deep relative paths (`../../../`).
- **No barrel files (`index.ts`)** for re-exports unless they materially improve DX.
- **Read `node_modules/next/dist/docs/`** for any Next.js API before using it. Training data may be outdated.

---

## 8. Hooks & Side Effects

### Render must be pure
The render function body is read-only. Never write to refs, mutate external variables, or call APIs directly inside render. All side effects belong in event handlers or effects.

### Effects are for synchronizing with external systems
Do not use effects to cascade React state updates. If you find yourself writing `setState` inside an effect to react to another state change, that is a design smell. Resolve it with derived state, `useReducer`, or by updating both states together in the same event handler.

❌ `useEffect(() => { setB(init); }, [a]);`
✅ `handler = () => { setA(val); setB(init); }`

### Read custom hook implementations before solving a problem they already solve
Before introducing a workaround (e.g. a "latest ref" to avoid stale closures), check whether the hook you are calling already handles it internally. Duplicating a solution the hook owns makes the code harder to follow and introduces subtle bugs.
