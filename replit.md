# CampSync - Replit.md

## Overview

CampSync is a React Native (Expo) mobile application for managing summer camp operations. It supports three user roles:

- **Management**: Full access to camper records, sessions, wristband programming, auth code generation, and pending updates dashboard
- **Staff**: Check-in/check-out campers for sessions and read NFC wristbands
- **Parents**: View their linked children's status, check-in history, and update medical information

Key features include:
- Role-based routing (management, staff, parent portals)
- NFC/wristband simulation for camper identification (encrypted wristband data)
- Camper medical records management
- Session-based check-in/check-out tracking
- Auth code system for role-based registration
- Pending wristband update queue
- Apple Liquid Glass design on iOS 26+ via NativeTabs
- Demo auth codes displayed on registration page for presentations
- Reusable DatePicker component (calendar UI for dates, multi-select for session authorized dates)
- Password reset flow (self-service via email+auth code, management override)
- Staff emergency medical lookup (search campers, view medical info without NFC)
- Input validation (email, phone format validation with inline error messages)
- Local notifications on check-in/out events via expo-notifications
- Parent activity feed showing recent check-in/check-out history

The app runs on iOS, Android, and Web via Expo Router, with an Express.js backend that handles authentication and auth code management via a PostgreSQL database.

**Offline mode**: When offline and no session exists (or session expired), the app routes to a wristband-scanner-only screen. Camper data embedded in NFC wristbands (encrypted) can be read without any account or internet connection. All other features require authentication.

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend (React Native / Expo)

The app uses **Expo Router** with file-based routing. The route structure reflects user roles:

- `app/(auth)/` — Login and registration screens
- `app/(management)/` — Management portal with tabs: Dashboard, Campers, Wristband, Pending Updates, More
- `app/(staff)/` — Staff portal with tabs: Check-in, Wristband
- `app/(parent)/` — Parent portal with tabs: My Children, Account
- `app/index.tsx` — Entry point that redirects based on auth state and user role

**Tab layouts** support both iOS native tab bars (`expo-router/unstable-native-tabs` with Liquid Glass effect on compatible iOS) and a classic cross-platform fallback using BlurView on iOS and plain views on Android/Web.

### State Management

- **AuthContext** (`contexts/AuthContext.tsx`): Manages user session, login, register, and logout. Uses `expo-secure-store` on native and `localStorage` on web for persisting the current user ID. Seeds demo data on first launch.
- **DataContext** (`contexts/DataContext.tsx`): Manages all app data (campers, sessions, check-ins, auth codes, pending wristband updates, users). Provides CRUD operations for all entities. Waits for auth to finish loading before fetching data, and re-fetches when user changes.
- **TanStack React Query**: Set up via `QueryClientProvider` for future server-side data fetching. Currently the app is primarily local/offline-first.
- **AsyncStorage** (`lib/storage.ts`): All data is currently stored locally on-device using `@react-native-async-storage/async-storage`. This is the primary data persistence layer — the app is offline-first.

### Data Storage

**Auth data (PostgreSQL)**: User accounts, auth codes, and sessions are stored in the PostgreSQL database via Drizzle ORM. Tables: `cs_users`, `cs_auth_codes`, `cs_user_sessions`.

**App data (local)**: Campers, camp sessions, check-ins, and pending wristband updates remain in `AsyncStorage` on-device for offline-first access.

**Backend**: `server/routes.ts` implements all auth API routes. `server/db.ts` provides the Drizzle connection. Schema is in `shared/schema.ts`.

### Authentication

- Registration requires an **auth code** that determines the user's role (management/staff/parent)
- Demo codes pre-seeded in the DB: `DEMO-ADMIN` (management), `DEMO-STAFF` (staff), `DEMO-PARENT` (parent)
- Additional seed codes: `MGMT-MASTER-2024`, `STAFF-001`, `STAFF-002`
- Passwords are hashed server-side using Node.js `crypto.scrypt` with a random salt
- Session tokens (64-char hex) are stored in `cs_user_sessions` with 7-day TTL, persisted client-side in SecureStore (native) or localStorage (web) via `lib/auth-token.ts`
- API requests include `Authorization: Bearer <token>` header via `lib/query-client.ts`
- **Offline mode**: When the app has no token or the network is unreachable, `offlineMode = true` is set in AuthContext. The app routes to `app/(offline)/index.tsx` — a wristband-scanner-only screen. Signing in requires network access.
- Role-based routing enforced in `app/index.tsx`

### Backend (Express.js)

- `server/index.ts`: Express with CORS (allows Replit dev domains + localhost; Authorization header allowed)
- `server/db.ts`: Drizzle ORM + pg Pool connection using DATABASE_URL
- `server/routes.ts`: Auth API routes (register, login, logout, me, reset-password, admin-reset-password, CRUD for auth codes)

### Wristband/NFC System

- Real Apple Core NFC integration via `react-native-nfc-manager` in `lib/nfc.ts`
- NFC tags store XOR+Base64 encrypted `WristbandPayload` as NDEF text records
- `NFCScanner` component (`components/NFCScanner.tsx`) handles read, write, and erase modes with native iOS NFC overlay, pulse animation, and success/error states
- Wristband programming in camper detail uses real NFCScanner in write mode
- Checkout flow: scan wristband (read) → confirm camper → erase wristband (erase mode) → check out in DB → unlink wristband
- Management NFC home screen has three options: Program, Scan, and Check Out
- The management portal tracks "pending wristband updates" when camper data changes after wristband programming
- NFC permissions configured in `app.json`: iOS NFCReaderUsageDescription + TAG entitlement only (NDEF entitlement is disallowed by Apple with iOS 26 SDK), Android NFC permission
- `react-native-nfc-manager` config plugin registered in app.json plugins array with `includeNdefEntitlement: false`
- `ensureStarted()` tracks NFC manager state; only silently ignores "already started" errors — all other init failures propagate with descriptive messages
- `requestTechnology` failures wrapped with "Could not start NFC session:" prefix for clear error reporting
- **CRITICAL NFC patterns**: `requestTechnology([NfcTech.Ndef])` (array); `Ndef.text.decodePayload(record.payload as any)` (no Uint8Array wrapping); `writeNdefMessage([])` for erase

### Camper Management

- Camper list (`app/(management)/campers.tsx`) with search, add, and delete functionality
- Camper card uses separated Pressables: main content for navigation, separate delete button (fixes web pointer event conflicts)
- Camper detail profile (`app/(management)/camper/[id].tsx`) with Info/Medical/Status tabs, Edit button in header for inline editing
- Stack navigator in `app/(management)/camper/_layout.tsx` handles [id] and new routes
- Management can check in/out campers at any time from the Status tab (bypasses session restrictions)
- Parent auth code generation from camper detail (single-use, linked to camper)

### Backend (Express.js)

- `server/index.ts`: Sets up Express with CORS handling (allows Replit dev domains and localhost)
- `server/routes.ts`: Empty scaffold — all routes should be prefixed with `/api`
- Serves a static landing page HTML for non-app requests
- Configured to run separately from the Expo bundler; in dev, both run concurrently

### Fonts and Theming

- **Outfit** font family (400/500/600/700) via `@expo-google-fonts/outfit`
- Color system in `constants/colors.ts` with forest-green camp theme, supporting both light and dark mode
- Dark mode is `automatic` (follows system preference)
- CampSync logo at `assets/images/campsync-logo.png` displayed on login screen

## External Dependencies

### Core Framework
- **Expo SDK ~54** — App platform, build tools, and native module access
- **React Native 0.81.5** — Mobile UI rendering
- **Expo Router ~6** — File-based navigation

### UI and Animation
- **expo-blur** — Tab bar blur effects on iOS
- **expo-glass-effect** — Liquid Glass tab bars (iOS 26+)
- **expo-linear-gradient** — Gradient UI elements
- **react-native-reanimated** — Animations (wristband scan pulses)
- **react-native-gesture-handler** — Gesture support
- **react-native-safe-area-context** — Safe area insets
- **expo-haptics** — Haptic feedback on interactions
- **expo-image** — Optimized image rendering (used for logo)
- **@expo/vector-icons** — Ionicons and Feather icon sets
- **@expo-google-fonts/outfit** — Custom font

### Data and Storage
- **@react-native-async-storage/async-storage** — Local data persistence (primary data store)
- **expo-secure-store** — Secure auth token storage
- **drizzle-orm + drizzle-zod** — ORM for PostgreSQL (schema defined, not yet connected to app data)
- **pg** — PostgreSQL driver
- **@tanstack/react-query** — Server state management (scaffolded, not yet used for data fetching)

### Utilities
- **expo-crypto** — Password hashing (SHA-256)
- **expo-notifications** — Local push notifications for check-in/out events and wristband updates
- **expo-location** — Location services (imported, available for future use)
- **expo-image-picker** — Image selection (available for future use)
- **react-native-keyboard-controller** — Keyboard-aware scroll views
- **zod** — Schema validation

### New Components and Libraries
- **DatePicker** (`components/DatePicker.tsx`) — Reusable calendar date picker with single and multi-select modes
- **Validation** (`lib/validation.ts`) — Email, phone, and date validation utilities with formatting helpers
- **Notifications** (`lib/notifications.ts`) — Local notification scheduling for check-in/out and wristband update events

### Backend
- **express ^5** — API server
- **http-proxy-middleware** — Dev proxy
- **tsx / esbuild** — TypeScript server runner and bundler

### Development
- **DATABASE_URL** environment variable required for PostgreSQL connection (Drizzle)
- **EXPO_PUBLIC_DOMAIN** environment variable required for API URL resolution
- **REPLIT_DEV_DOMAIN** / **REPLIT_DOMAINS** used for CORS configuration
