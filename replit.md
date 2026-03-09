# CampSync

## Overview

CampSync is a React Native (Expo) mobile application designed to streamline summer camp operations. It caters to three distinct user roles: Management, Staff, and Parents, each with tailored functionalities.

The application aims to:
- Provide a robust platform for managing camper information, including medical records and attendance.
- Facilitate efficient check-in/check-out processes using NFC wristbands.
- Enable effective communication through broadcast systems and emergency alerts.
- Offer a seamless experience for parents to monitor their children's camp activities and manage their profiles.
- Support offline capabilities for critical operations like wristband scanning.

Key capabilities include: role-based access, NFC/wristband simulation with encrypted data, comprehensive medical record management, session-based attendance tracking, secure authentication via auth codes, a pending wristband update queue, a customizable date picker, password reset flows, staff emergency medical lookups, robust input validation, local notifications for events, parent activity feeds, and a broadcast system. Recent enhancements include an emergency mode, parent check-in/out email notifications, a dedicated parent profile tab with notification preferences and dark mode toggle, unread activity badges, staff check-in notes, cabin group summaries, detailed attendance history reports with CSV export, session roster pre-planning, and an AI Medical Lookup for staff. The management view has exactly 5 nav tabs: Dashboard, Campers (with Campers/Cabins sub-tabs), Wristband, Updates, and Manage. Cabins are DB-backed via the `csCabins` table and selected via the `CabinPicker` dropdown component.

The application supports iOS, Android, and Web platforms through Expo Router, backed by an Express.js API and PostgreSQL database for authentication and core data.

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend (React Native / Expo)

The application utilizes **Expo Router** for file-based routing, organizing routes by user role (e.g., `app/(management)/`, `app/(staff)/`, `app/(parent)/`). It features adaptive tab layouts, supporting both native iOS tab bars with Liquid Glass effects (on iOS 26+ via `expo-router/unstable-native-tabs`) and cross-platform fallbacks using `BlurView` on iOS and standard views elsewhere.

**State Management**:
- **AuthContext**: Manages user authentication and session persistence using `expo-secure-store` (native) and `localStorage` (web).
- **DataContext**: Handles all core application data (campers, sessions, check-ins, etc.), providing CRUD operations and managing data fetching.
- **AsyncStorage**: Serves as the primary data persistence layer for all app data, enabling an offline-first experience.
- **TanStack React Query**: Integrated for future server-side data fetching.

**Authentication**:
- Registration is role-based, requiring an **auth code** (management, staff, parent).
- Passwords are hashed server-side using Node.js `crypto.scrypt`.
- Session tokens with a 7-day TTL are stored client-side.
- API requests use `Authorization: Bearer <token>` headers.
- An **offline mode** routes users to a wristband-scanner-only screen when unauthenticated or offline.

**UI/UX**:
- Employs the **Outfit** font family and a forest-green camp theme from `constants/colors.ts`, supporting both light and dark modes (automatic system preference).
- A custom CampSync logo is displayed on the login screen.
- Features like the DatePicker component provide a consistent calendar UI.
- Input validation includes inline error messages for email and phone formats.
- Role-specific dashboards and interfaces are designed for clarity and ease of use.
- Staff check-in screens visually highlight campers with allergies using prominent badges.

### Backend (Express.js)

The backend is an Express.js API server (`server/index.ts`) with CORS configured for development and production environments. It uses **Drizzle ORM** and `pg` for PostgreSQL database interaction.

**Data Storage**:
- **PostgreSQL**: Stores user accounts, auth codes, user sessions (`cs_users`, `cs_auth_codes`, `cs_user_sessions`).
- **Local Storage (`AsyncStorage`)**: Stores most application data (campers, sessions, check-ins) for offline access.

**NFC/Wristband System**:
- Integrates real Apple Core NFC via `react-native-nfc-manager` for reading, writing, and erasing NFC tags.
- Wristbands store XOR+Base64 encrypted `WristbandPayload` as NDEF text records.
- The `NFCScanner` component provides UI for NFC interactions with visual feedback.
- Management features include programming wristbands and tracking "pending wristband updates" when camper data changes.
- Checkout flow involves scanning, confirming, erasing the wristband, and updating the database.
- NFC permissions are configured for both iOS (NFCReaderUsageDescription, TAG entitlement) and Android.

**Camper Management**:
- Provides comprehensive camper management tools for management, including search, add, delete, and detailed profile views (Info, Medical, Status tabs).
- Management can check in/out campers directly from their profiles.
- Parent auth codes can be generated from camper details.

**Feature Specifications**:
- **Broadcast System**: Management can send announcements to specific user roles or all users, with optional email notifications. Broadcasts are stored in `cs_broadcasts`.
- **Emergency Mode**: A critical alert system that bypasses silent mode on devices and displays a red banner across all staff/parent devices.
- **Parent Notifications**: Configurable preferences for check-in/out alerts and broadcasts via `AsyncStorage`.
- **Staff AI Medical Lookup**: A chat-based AI tool for staff to quickly access medical and safety information.
- **Reporting**: Attendance history reports with CSV export and cabin group summaries are available for management.
- **Session Roster Pre-planning**: Management can pre-plan session rosters using dedicated API endpoints and the `csSessionRegistrations` table.

## External Dependencies

### Core Framework
- **Expo SDK ~54**
- **React Native 0.81.5**
- **Expo Router ~6**

### UI and Animation
- **expo-blur**
- **expo-glass-effect**
- **expo-linear-gradient**
- **react-native-reanimated**
- **react-native-gesture-handler**
- **react-native-safe-area-context**
- **expo-haptics**
- **expo-sharing**
- **expo-image**
- **@expo/vector-icons**
- **@expo-google-fonts/outfit**

### Data and Storage
- **@react-native-async-storage/async-storage**
- **expo-secure-store**
- **drizzle-orm + drizzle-zod**
- **pg**
- **@tanstack/react-query**

### Utilities
- **expo-crypto**
- **expo-notifications**
- **react-native-keyboard-controller**
- **zod**

### NFC
- **react-native-nfc-manager**

### Backend
- **express ^5**
- **http-proxy-middleware**
- **tsx / esbuild**