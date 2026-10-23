# AGENTS.md — Takt

## Purpose

Takt is a personal, self-hosted calendar and information-display system centered on a small desk device with a monochrome e-paper screen. It is intended to be a polished, practical daily companion: the user can glance at today's schedule, upcoming events and deadlines, brief notes, and other relevant information without opening a phone or computer.

The system is more than an ESP32 firmware project. It includes a backend that owns data and produces images, a browser-based management and preview interface, a reusable declarative screen-description system, and firmware that displays the resulting images. Design the software so that additional screens, templates, devices, and data sources can be introduced without rewriting the fundamentals.

**Project name:** Takt.

## Working principles for coding agents

- Treat this document as project context, not as proof that every described component already exists. Inspect the repository before making changes.
- Prefer a small, coherent, working vertical slice over broad speculative infrastructure.
- Preserve the existing conventions and working implementation unless a change is justified by the task.
- Separate concerns by responsibility, not merely by number of files or packages. Avoid unnecessary packages, frameworks, dependency injection systems, or generic abstractions.
- Keep public APIs straightforward and strongly typed. Use TypeScript generics when they genuinely improve reuse or inference; avoid `any` in public interfaces.
- Explain architectural trade-offs when decisions are non-obvious. Do not silently turn an exploratory design idea into a permanent constraint.
- Do not implement unrelated features while working on a focused task. Ask when a choice would significantly constrain future architecture.
- Do not assume a particular Node.js web framework, frontend framework, database library, canvas library, or build system has been selected unless the repository confirms it.
- Respond to the user in Russian. Code identifiers, comments, and documentation can use English consistently with the repository.

## Product and hardware

### Initial device

- ESP32-S3 DevKitC v1.1, ESP32-S3-N16R8 (16 MB flash, 8 MB PSRAM).
- GDEY075T7 monochrome e-paper display, 800 × 480 pixels, connected over SPI using a DESPI-C02 controller board.
- Firmware uses C and ESP-IDF 6.1 with FreeRTOS.
- A custom 1-bit graphics/display implementation already exists in the broader project work, including full/partial refresh and framebuffer handling; inspect actual files before assuming it is present in this repository.
- The intended display is **black and white only**. Do not introduce red/tri-color display assumptions.
- The initial device is mains/USB powered; a battery is not a current requirement.

### Screen and user experience

- Primary screen: today's events and schedule, with clear time labels and good legibility.
- Secondary information: upcoming deadlines, short notes, and a compact indication of the current week.
- Typical days have roughly four or five events, but layouts should tolerate crowded days.
- Some events intentionally have **no defined end time**; the data model and UI must not assume every event has a duration.
- A small timestamp may indicate **last successful screen update**, not necessarily the current time.
- Typography must remain readable on a monochrome 1-bit e-paper panel. Inter has been a promising choice for rendered layouts; final font strategy remains open.
- Screen layouts are currently prototyped with browser Canvas and bitmap post-processing. Reuse the visual lessons without assuming the prototype is the final rendering architecture.
- A future device may support switching between multiple screens/scenes; the physical device should be able to control its active screen.

## Proposed repository organization

The intended development environment is a **Node.js / TypeScript monorepo using workspaces** for the software packages. The current conceptual boundaries are:

```text
takt/
├── apps/
│   ├── server/           # Backend, API, data, synchronization, scheduling
│   └── web/              # Management UI, editor, screen preview
├── packages/
│   ├── ui/               # JSX runtime, primitives, UI tree, normalization
│   ├── renderer/         # Layout and drawing/rasterization
│   └── templates/        # Project definitions and screen templates
├── firmware/             # ESP-IDF firmware; not an npm workspace
└── ...
```

This is a **direction**, not a mandate to create empty directories or packages. Follow the repository's actual structure. Avoid introducing a separate `core`, `sdk`, `layout`, or renderer-backend package until there is a concrete reason.

### `ui`

`ui` defines **what an interface is**, not how it is painted:

- Custom JSX runtime without React (`jsx`, `jsxs`, `Fragment`).
- JSX element and child types, functional components, and primitive component contracts.
- Basic declarative primitives such as `Text`, `Rect`, `Row`, and `Column`, with additional primitives only when needed.
- Resolution of functional components and fragments into a normalized representation suitable for later processing.
- The resulting resolved tree should be serializable, or explicitly validated/normalized before serialization.

Keep this package independent of Node.js, browser Canvas, SQLite, CalDAV, and concrete calendar data. Prefer typing primitive-specific props at the component boundary rather than accumulating all primitive schemas in a single giant union unless there is a demonstrated need.

The JSX runtime should remain small. It does **not** need React-style reconciliation, hooks, reactivity, or a virtual DOM lifecycle.

### `renderer`

`renderer` owns **how a prepared scene is laid out and drawn**:

- Calculate geometry, positions, sizes, spacing, and text measurements.
- Render the prepared scene into a suitable output (browser preview, server-side image, and ultimately a monochrome 1-bpp framebuffer).
- Keep layout logic distinct from backend-specific rasterization as an internal design principle; splitting it into more npm packages is optional.
- Preserve deterministic output where practical: same scene, dimensions, fonts, and renderer configuration should produce the same pixels.
- Avoid requiring the renderer to know about calendar events, Nextcloud, database records, or template-specific components.

**Design intent:** the public renderer entry point should accept a *scene* rather than an arbitrary JSX fragment. The exact boundary between scene generation, JSX resolution, layout, and rendering is still under design; keep the public API coherent and avoid prematurely locking it down.

### `templates`

`templates` organizes projects, screen definitions, and concrete screen layouts:

- A **project** groups settings (including screen dimensions) and named scenes.
- A **scene definition** describes how to generate a particular screen from dynamic input.
- A **prepared/renderable scene** is the concrete unit handed to the renderer.
- Dynamic context may include the current date/time, calendar events, notes, locale, timezone, and later additional information.
- Templates should not directly query SQLite or remote services. They receive data supplied by the caller.

An illustrative desired authoring experience is:

```tsx
const project = createProject({
  settings: {
    screen: { width: 800, height: 480 },
  },
  scenes: {
    daily: makeScene((ctx) => (
      <Column>
        <Text>Сегодня</Text>
        <EventList />
      </Column>
    )),
  },
})
```

This is **conceptual API**, not an instruction to implement those exact functions or signatures. The user values the concise declaration and wants externally supplied context. Types for context and extensible settings should be generic where appropriate, with good inference. Do not couple low-level `ui` primitives to a particular project's settings or calendar context.

A React-like context accessor has been considered for deeply nested components, but **no context propagation mechanism has been selected**. Prefer explicit, safe data flow for the MVP. Do not introduce mutable global render context: multiple server-side renders must not leak data between requests.

### `apps/web`

The web application is for managing calendars, notes, screen configuration, and previewing or editing layouts. It may use an established frontend framework for its own interactive interface; the custom JSX runtime is for describing the e-paper screen, not necessarily for building the web app itself. Ideally the preview uses the same screen description and layout rules as production rendering. Exact pixel parity may require shared fonts and a common rasterization strategy.

### `apps/server`

The backend is intended to be independently useful, including when Nextcloud or the home server is temporarily unavailable. Responsibilities include:

- Local storage and API for calendar events, notes, settings, and scene selection/configuration.
- Data synchronization with external calendars.
- Preparing the context for scene generation.
- Scheduling re-renders when data changes or when time-dependent content needs to change.
- Rendering or caching monochrome images and serving them to devices.
- Sending lightweight notifications that a screen revision has changed.

Start as one backend process rather than multiple services. Keep synchronization, storage, scene preparation, rendering, and device notification conceptually separate inside it.

## Device delivery and update protocol

The working transport choice for the MVP is **SSE for change notifications and HTTP for image downloads**:

1. The server prepares a screen and computes a stable revision/hash for its rendered content.
2. When the image actually changes, the server can notify connected ESP32 devices via SSE.
3. A device checks the relevant screen revision and downloads the new image over HTTP if needed.
4. The device updates the e-paper panel only when the content has changed.
5. After SSE reconnection, the device rechecks the current revision. Occasional polling can serve as a fallback.

Possible endpoint shapes discussed: `/api/screen/info` and `/api/screen/image`. These are **illustrative**, not finalized contracts.

Do not transmit full bitmaps over SSE. For an 800 × 480 monochrome 1-bpp screen, the raw pixel payload is approximately 48,000 bytes before transport framing or compression. Choose a documented bit order, stride, polarity, and byte layout that match the firmware. Avoid needless e-paper refreshes.

Screen updates can be triggered both by data mutations and by time boundaries (e.g., a new day or the start of an event). Avoid blindly regenerating the image at high frequency; compare content revisions before notifying or refreshing.

## Calendar data and synchronization

The intended persistence model is **local-first SQLite**, not a read-only cache of Nextcloud:

- Takt remains functional without any external calendar service.
- Locally created and edited events persist in Takt's own database.
- Bidirectional CalDAV synchronization is planned, initially with Nextcloud Calendar.
- The design should allow a different CalDAV server or another adapter (e.g., Google Calendar) later, without coupling the whole backend to Nextcloud.
- Notes are initially local Takt data, not necessarily CalDAV resources.

Synchronization considerations:

- Distinguish local event IDs, iCalendar `UID`, remote resource URL/href, and remote ETag.
- Track local pending changes and deletions across outages and restarts; never silently discard unsynced local edits.
- Detect remote changes and use conditional requests/ETags when updating remote resources.
- Conflicts mean **the same event was changed independently on both sides**, not that two distinct events overlap in time.
- Because the expected usage is personal and conflicts should be rare, begin with a conservative, simple conflict policy rather than an elaborate merge UI.
- Calendar recurrence, time zones, exceptions, and deletion semantics require care when implemented; do not invent simplistic rules that corrupt calendar data.
- External synchronization and image rendering should not be tightly coupled. A successful sync may change local data, which then triggers the normal screen update mechanism.

The exact SQLite library, schema, CalDAV client, sync frequency, and conflict-resolution UX are not yet fixed.

## Architecture boundaries and data flow

The conceptual flow is:

```text
Local data / external calendar adapters
                 ↓
        Server prepares context
                 ↓
      Project + scene definition
                 ↓
        JSX generation / resolve
                 ↓
         Prepared scene
                 ↓
       Layout + rasterization
                 ↓
      Revisioned monochrome image
                 ↓
        HTTP + SSE → ESP32
```

Important invariants:

- `ui` does not import `renderer`, server infrastructure, or concrete template definitions.
- `renderer` does not need to import application-specific calendar or storage code.
- Template components should remain deterministic functions of supplied inputs where practical.
- A renderer-facing scene must carry or be accompanied by the settings necessary to draw it (notably screen dimensions), without hidden coupling to an unrelated project instance.
- Keep code-defined scene definitions distinct from resolved, serializable scene data. Function references cannot be JSON-serialized.
- The backend is responsible for obtaining and preparing data; templates are responsible for presentation; firmware is responsible for displaying received frames.

## Development priorities

The intended progression is incremental:

1. Establish a minimal JSX runtime and primitive UI representation.
2. Make JSX resolve to a predictable tree and validate serialization boundaries.
3. Render a small scene with text and basic layout into a browser or server-side image.
4. Recreate the existing daily calendar layout using actual templates and representative test data.
5. Add project/scene management and browser preview as needed.
6. Integrate backend persistence, image generation, revision tracking, and device delivery.
7. Add external calendar synchronization, then expand functionality based on real usage.

These are priorities, not a fixed schedule. If the repository already has functioning implementations, build on them rather than recreating them.

## Decisions already made vs. still open

**Decided or strongly preferred:**

- Product name: Takt.
- Initial device: ESP32-S3 with 800 × 480 monochrome e-paper.
- Node.js/TypeScript workspaces for the software monorepo.
- Separate `ui` and `renderer` packages; `templates`, `web`, and `server` as distinct responsibilities.
- Declarative JSX authoring without React as the screen description runtime.
- Scene-based rendering and project-level settings.
- External dynamic context for scene generation.
- Local-first SQLite and eventual bidirectional CalDAV synchronization.
- SSE notifications with image transfer over HTTP.
- Avoid excessive abstractions and premature framework-building.

**Open / to be validated by implementation:**

- Exact `Project`, `Scene`, scene definition, and context TypeScript interfaces.
- Which package owns the generic project/scene contracts; avoid putting unrelated project metadata into `ui` merely because it imports JSX types.
- Whether context is passed only explicitly or also accessed by nested components through a safe context mechanism.
- Exact normalized UI-tree shape, treatment of text children, and serialization rules.
- Layout algorithm and text measurement strategy.
- Browser vs. Node.js renderer implementation and pixel-parity guarantees.
- Final HTTP routes, payload encoding, authentication, and device registration.
- Database schema, synchronization cadence, recurrence handling, and conflict policy.
- Editing capabilities, persistence format for template configuration, and user-defined templates.

## Definition of good progress

A successful change should move Takt closer to a real, usable desk calendar while leaving understandable boundaries behind. Prefer a small API that makes the current daily screen easy to express and render. Test behavior at the relevant boundary (JSX resolution, layout, image bytes, API, synchronization), and document any new design decision that future contributors or agents need to know. Avoid claiming features are implemented unless they are present and verified in the repository.
