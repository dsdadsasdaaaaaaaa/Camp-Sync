# CampSync Security Documentation

## 1. Medical Record Encryption (Server-Side)
- **Algorithm**: AES-256-GCM (Authenticated Encryption with Associated Data).
- **Key Derivation**: SHA-256 hash of the `SESSION_SECRET` environment variable, producing a 32-byte (256-bit) key.
- **Initialization Vector (IV)**: 12 bytes of cryptographically strong pseudo-random data, generated fresh for every encryption operation.
- **Authentication Tag**: 16-byte GCM tag generated during encryption and verified during decryption to detect any tampering with the ciphertext.
- **Storage**: Encrypted data is stored in the PostgreSQL database across three columns:
  - `medical_encrypted`: The base64-encoded ciphertext.
  - `medical_iv`: The hex-encoded IV.
  - `medical_auth_tag`: The hex-encoded authentication tag.
- **Security Property**: Medical data is never stored in plaintext on the server's persistent storage.

## 2. NFC Wristband Encryption (On-Device)
- **Algorithm**: XOR cipher with a fixed key (`CAMPSYNC_NFC_SECRET_KEY_2024_v1`), followed by base64 encoding.
- **Purpose**: Provides lightweight, offline obfuscation for emergency-critical data accessible by staff without a network connection.
- **Capacity**: Limited to 540 bytes to fit standard NDEF records on most common NFC tags.
- **Data Subset**: Only essential emergency fields are stored on the physical tag (allergies, medications, chronic conditions, emergency contacts, blood type). Non-critical data (insurance details, doctor info) remains server-side only.
- **Integrity**: Character limits and truncation are enforced to ensure predictable tag writes.

## 3. Password Hashing
- **Algorithm**: `scrypt`, a memory-hard password-based key derivation function.
- **Salt**: 16 random bytes generated per user.
- **Output**: 64-byte derived key (hash).
- **Verification**: Uses `timingSafeEqual` to compare hashes, preventing side-channel timing attacks.
- **Storage Format**: Stored as `<hex_hash>.<hex_salt>` in the `cs_users` table.

## 4. Session Management
- **Token Generation**: 32 cryptographically random bytes, hex-encoded to a 64-character string.
- **Lifecycle**: Tokens expire after 7 days of inactivity. Expired sessions are invalidated server-side.
- **Client Storage**: 
  - **Mobile**: Uses Expo `SecureStore`, which utilizes the iOS Keychain and Android Keystore (hardware-backed security).
  - **Web**: Fallback to `localStorage`.
- **Transport**: Transmitted via the `Authorization: Bearer <token>` HTTP header.

## 5. Role-Based Access Control (RBAC)
- **Roles**: `management`, `staff`, and `parent`.
- **Enforcement**: Role checks are performed server-side for every protected API route.
- **Management**: Full administrative access to all system entities.
- **Staff**: Restricted to camper lookups and check-in/out operations. Cannot manage users, sessions, or invite codes.
- **Parent**: Strictly isolated to data pertaining only to their linked children.

## 6. Invite & Registration System
- **Closed Registration**: Accounts cannot be created without a pre-generated invite code.
- **Auth Codes**: Role-specific codes created by Management.
- **Parent-Child Linking**: Parent invite codes are cryptographically linked to a specific camper ID at the time of generation, ensuring automatic and secure data isolation upon signup.
- **Usage Tracking**: Codes support `maxUses` limits to prevent unauthorized sharing.

## 7. Environment & Infrastructure
- **Secrets Management**: Sensitive keys like `SESSION_SECRET` are managed via Replit environment secrets and are never committed to version control.
- **Data Isolation**: All database tables use the `cs_` namespace.
- **Communication**: All client-server traffic is encrypted via TLS/SSL.

## 8. Development & Security Warnings
- **Secret Rotation**: Changing the `SESSION_SECRET` will rotate the master encryption key, rendering all previously encrypted medical records unreadable. This should only be done as part of a planned data migration.
- **NFC Security**: While the XOR scheme protects against casual snooping, physical possession of the wristband grants access to the emergency data stored on it. Staff should treat wristbands as sensitive items.
