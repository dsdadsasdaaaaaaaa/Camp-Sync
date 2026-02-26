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

The app runs on iOS, Android, and Web via Expo Router, with an Express.js backend that currently serves as a scaffold for future API routes.

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

**Current state**: All app data (users, campers, sessions, check-ins, auth codes) is stored in `AsyncStorage` on-device using JSON serialization via `lib/storage.ts`. There is no active server-side data persistence.

**Backend scaffold**: The Express server (`server/index.ts`, `server/routes.ts`) exists but has no API routes implemented yet. The `server/storage.ts` has a `MemStorage` class and `IStorage` interface, ready to be replaced with a real database implementation.

**Database schema**: `shared/schema.ts` defines a PostgreSQL `users` table using Drizzle ORM. Drizzle is configured for PostgreSQL (`drizzle.config.ts`), and `db:push` script is available. The schema is minimal (just users with username/password) — the full app data types are defined in `types/index.ts` as TypeScript interfaces (not yet in the DB schema).

**Migration path**: The architecture is set up for PostgreSQL via Drizzle. When adding server-side persistence, expand `shared/schema.ts` to include campers, sessions, check-ins, etc., implement routes in `server/routes.ts`, and migrate the DataContext to use API calls instead of AsyncStorage.

### Authentication

- Registration requires an **auth code** that determines the user's role (management/staff/parent)
- Demo codes seeded on first launch: `DEMO-ADMIN` (management), `DEMO-STAFF` (staff), `DEMO-PARENT` (parent, linked to demo camper "Alex Johnson")
- Additional seed codes: `MGMT-MASTER-2024`, `STAFF-001`, `STAFF-002`
- Demo codes are displayed on the registration page with tap-to-fill functionality for easy demo presentations
- Passwords are hashed using `expo-crypto` (SHA-256 via `lib/crypto.ts`)
- Session persistence uses `expo-secure-store` (native) or `localStorage` (web)
- Role-based routing is enforced at the root `index.tsx` level
- After login/register, app navigates to `/` which redirects to the appropriate role portal

### Wristband/NFC System

- Real Apple Core NFC integration via `react-native-nfc-manager` in `lib/nfc.native.ts` (Metro auto-selects `.native.ts` for native, `.ts` for web)
- Web stub at `lib/nfc.ts` reports NFC as unsupported (no native module imports)
- NFC tags store `CAMPSYNC:` prefix + XOR+Base64 encrypted `WristbandPayload` as NDEF text records
- `NFCScanner` component (`components/NFCScanner.tsx`) handles read and write modes with native iOS NFC overlay, pulse animation, and success/error states
- Wristband programming in camper detail uses real NFCScanner in write mode
- The management portal tracks "pending wristband updates" when camper data changes after wristband programming
- NFC permissions configured in `app.json`: iOS NFCReaderUsageDescription + NDEF entitlements, Android NFC permission

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
