# CampSync Security Overview

This document describes the security measures built into CampSync. It covers how data is encrypted, how passwords are protected, how user sessions work, and how access is controlled across roles.

---

## 1. Medical Record Encryption (Server-Side)

All medical information — allergies, medications, emergency contacts, doctor details, insurance, and notes — is encrypted before it is written to the database and decrypted only when an authorised user requests it. Medical data is **never stored in plaintext**.

| Property | Detail |
|---|---|
| **Algorithm** | AES-256-GCM (authenticated encryption) |
| **Key size** | 256-bit (32 bytes) |
| **Key source** | SHA-256 hash of the `SESSION_SECRET` environment variable |
| **IV (nonce)** | 12 random bytes generated fresh for every record written |
| **Auth tag** | 16-byte GCM authentication tag stored alongside the ciphertext — any tampering with the stored data will cause decryption to fail |
| **Storage format** | Three separate database columns: `medical_encrypted` (Base64), `medical_iv` (hex), `medical_auth_tag` (hex) |

AES-256-GCM provides both **confidentiality** (data cannot be read without the key) and **integrity** (any modification to the stored ciphertext is detected and rejected).

> **Critical:** The `SESSION_SECRET` value must never change after the database has been populated. Changing it makes all existing encrypted medical records permanently unreadable. It is stored as a server environment secret and is never present in source code or version control.

---

## 2. NFC Wristband Encoding (On-Device)

Each camper's wristband contains a small encoded payload that can be read offline by any authorised device — no internet connection required.

| Property | Detail |
|---|---|
| **Algorithm** | XOR cipher with fixed application key `CAMPSYNC_NFC_SECRET_KEY_2024_v1`, output Base64-encoded |
| **Purpose** | Lightweight obfuscation suitable for offline NFC tag reading |
| **Tag size limit** | 540 bytes maximum |
| **Payload format** | Compact JSON with abbreviated key names to minimise size |

### What is stored on the wristband

Only the fields needed in an emergency are written to the tag:

- First name, last name, date of birth
- Allergies, medications, medical conditions
- Blood type
- **Primary emergency contact only** — name and phone number (the first entry in the emergency contacts list; additional contacts are server-side only)

### What is NOT stored on the wristband

The following are kept on the server only and are never written to the NFC tag:

- Additional emergency contacts (contact 2, 3, etc.)
- Emergency contact email addresses
- Doctor name and phone number
- Insurance provider
- Clinical notes

### Size safeguards

Every field has a hard character limit enforced at write time. If a field is too long it is automatically truncated. A final byte-count check runs before writing to the tag; if the payload would still exceed 540 bytes, the operation is rejected with a clear error message.

> **Note:** XOR is a lightweight scheme chosen for compatibility with offline NFC scanning. Full AES-256-GCM encryption is applied to all records stored on the server.

---

## 3. Password Hashing

User passwords are never stored. Only a one-way hash is stored.

| Property | Detail |
|---|---|
| **Algorithm** | scrypt — a memory-hard key derivation function resistant to GPU and ASIC brute-force attacks |
| **Salt** | 16 cryptographically random bytes, unique per password |
| **Output length** | 64 bytes |
| **Stored format** | `<hex_hash>.<hex_salt>` |
| **Comparison** | Node.js `timingSafeEqual()` — prevents timing-based side-channel attacks |

---

## 4. Session Tokens

After a successful login, the server issues a session token that the app presents with every subsequent request.

| Property | Detail |
|---|---|
| **Generation** | 32 cryptographically random bytes (`crypto.randomBytes`), hex-encoded = 64-character string |
| **Lifetime** | 7 days from the time of login |
| **Server validation** | Token and expiry are checked on every API request; expired tokens are rejected |
| **Logout** | The token record is deleted from the database immediately — the token cannot be reused |
| **Transport** | `Authorization: Bearer <token>` HTTP header |
| **Client storage (iOS / Android)** | Expo SecureStore — backed by the device's hardware-protected keychain (iOS Keychain / Android Keystore) |
| **Client storage (web)** | Browser `localStorage` |

### Admin One-Time Reset Codes

Management users can generate a short-lived recovery code for any account without knowing the user's current password.

| Property | Detail |
|---|---|
| **Format** | 8 alphanumeric characters |
| **Expiry** | 60 minutes from generation |
| **Usage** | Single-use — consumed immediately on first use |
| **Purpose** | Allows a manager to hand a code to a user verbally or on paper so they can set a new password themselves |
| **Server storage** | Persisted in the `cs_reset_codes` database table — survives server restarts; only one active code exists per user at a time (generating a new code replaces any existing one) |
| **Endpoint** | `POST /api/auth/use-reset-code` — accepts the code and a new password; validates expiry and single-use constraint before applying the change |

---

## 5. Role-Based Access Control

Every API request is authenticated and the caller's role is verified before any data is returned or modified.

| Role | What they can access |
|---|---|
| **Management** | Full access — campers, medical records, sessions, check-ins, users, auth codes, and AI assistant |
| **Staff** | Can read camper profiles and full medical records (including via NFC wristband offline scan); can check campers in and out by list or wristband; cannot manage users, invite codes, or program new wristbands |
| **Parent** | Can only see the specific camper(s) linked to their account — enforced server-side by filtering on `linked_camper_ids`; can update their child's medical information |

Role is not trusted from the client. It is read from the database on every request after the session token is validated.

### Checkout Permissions

| Role | Checkout Method |
|---|---|
| **Management** | Can scan and erase the camper's NFC wristband (normal flow), **or** use Manual Override to check a camper out without a scan — for situations where a wristband is lost or unavailable. |
| **Staff** | Must always scan and erase the camper's NFC wristband to complete a checkout. No bypass or override option is available. If a camper has no wristband, staff must contact a manager. |

---

## 6. Invite-Code Registration

There is no open registration. A new account can only be created by entering a valid invite code issued by a management user.

| Property | Detail |
|---|---|
| **Code types** | Management, Staff, or Parent — each code grants exactly one role |
| **Max uses** | Configurable per code; a code can be set to single-use or multi-use |
| **Parent codes** | Linked to a specific camper ID at creation time — the new parent account is automatically connected to that camper on registration |
| **Audit trail** | Each code records who used it and when |
| **Management** | Only management-role users can create, edit, or revoke codes |

---

## 7. Environment Secrets

| Secret | Purpose | Risk if lost or changed |
|---|---|---|
| `SESSION_SECRET` | Derives the AES-256 key used to encrypt all medical records | All existing encrypted medical records become permanently unreadable |

The secret is stored as a server environment variable managed by Replit's secret store. It is never committed to source code or version control. In development, a fallback placeholder is used if the variable is not set — this placeholder is **not safe for production use**.

---

## 8. AI Assistant Security

The AI assistant (`POST /api/ai/query`) is available to management-role users only and is designed so that sensitive data never leaves the server.

- The client sends only a natural-language question (plain text).
- The server fetches all camper and medical records, decrypts them in memory, and constructs a context payload that is sent directly to the AI model server-side.
- The client receives only a plain-text answer — no raw medical records, no encrypted blobs.
- A role check (`management` only) is enforced before any data is fetched or any AI call is made; a `403` is returned immediately for all other roles.
- Medical data used in the AI context is held in server memory only for the duration of the request and is not logged or persisted.

---

## 9. Change Password

All users (management, staff, and parent) can change their own password from the account screen.

- The current password is verified with `timingSafeEqual()` before the new password is accepted.
- The new password is hashed with scrypt (see Section 3) before being stored.
- A minimum length of 8 characters is enforced server-side regardless of client-side validation.
- Endpoint: `POST /api/auth/change-password` — requires a valid session token.

---

## 10. Data Isolation

- All database tables are namespaced with a `cs_` prefix.
- Parent users receive only their linked camper's data — filtering is applied server-side before any response is sent; the client cannot bypass it.
- Medical data is decrypted on-demand and exists in plaintext only in server memory during the lifetime of a single request. It is never cached in plaintext.
- Database cascade rules ensure that deleting a user account also deletes their session tokens.

---

## Summary

| Layer | Protection |
|---|---|
| Medical records at rest | AES-256-GCM encryption, unique IV per record, integrity-verified with auth tag |
| NFC wristband data | XOR + Base64 obfuscation, emergency fields only, primary contact only, hard size limits |
| Passwords | scrypt with random salt, timing-safe comparison |
| Password changes | Current password verified with timing-safe comparison before accepting new password |
| Session tokens | 32-byte random, 7-day TTL, server-side invalidation on logout |
| API access | Bearer token + role check on every request |
| New account creation | Invite codes only, role-specific, audit-logged |
| Parent data access | Server-enforced filtering to linked campers only |
| AI assistant | Management-only; all data processed server-side; client receives text only |
