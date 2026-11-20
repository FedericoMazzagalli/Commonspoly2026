# Security Specification — Commonspoly Global Leaderboard

## 1. Data Invariants
1. **Default-Deny Safety Net**: Every path not explicitly matched under `/databases/{database}/documents` is denied for all reads and writes.
2. **Ownership & Verified Identity**: Only an authenticated, email-verified user (`request.auth != null && request.auth.token.email_verified == true`) may create or update `/leaderboard/{userId}`, and strictly where `userId == request.auth.uid` and `incoming().uid == request.auth.uid`.
3. **Zero PII Exposure**: `/leaderboard/{userId}` documents must strictly contain ONLY the 17 allowlisted public game fields (`keys().hasAll(...)` and `keys().hasOnly(...)`). Fields such as `email`, `phone`, `address`, or arbitrary shadow keys are rejected.
4. **Monotonic Personal Best**: Updates to `/leaderboard/{userId}` are permitted ONLY when the incoming record strictly improves upon the existing personal best (`efficiencyPct` higher, or tied `efficiencyPct` in fewer `round`s, or tied `efficiencyPct` and `round` with more `totalCooperativeActions`), and `uid` + `createdAt` remain immutable.
5. **Server Timestamp Integrity**: Both `createdAt` (on create) and `updatedAt` (on create and update) must equal `request.time`.
6. **Public Non-PII List Query Enforcement**: List queries against `/leaderboard` are restricted to `resource.data.isPublic == true && resource.data.efficiencyPct is int && resource.data.efficiencyPct >= 0 && resource.data.efficiencyPct <= 100`.
7. **Immutable Delete Policy**: Client deletes of leaderboard entries are denied (`allow delete: if false;`) to preserve global record integrity.

## 2. Adversarial "Dirty Dozen" Payloads (Expected: PERMISSION_DENIED)
1. **Unauthenticated Create**: Creating `/leaderboard/user_1` with `request.auth == null`.
2. **Unverified Email Create**: Creating `/leaderboard/user_1` with `email_verified == false`.
3. **UID Spoofing (Path Mismatch)**: User `uid_A` attempting to write `/leaderboard/uid_B` even with `incoming().uid == 'uid_A'`.
4. **UID Spoofing (Payload Mismatch)**: User `uid_A` writing `/leaderboard/uid_A` with `incoming().uid == 'uid_B'`.
5. **Shadow / Ghost Field Injection (PII Leak)**: Adding `{ email: "leak@example.com" }` or `{ isAdmin: true }` to create or update.
6. **Out-of-Bounds Efficiency Score**: Setting `efficiencyPct: 105` or `efficiencyPct: -1` or `efficiencyPct: "99"`.
7. **Invalid Enum Result**: Setting `result: "HACKED"` instead of `'VICTORY' | 'DRAW' | 'DEFEAT'`.
8. **Score Downgrade Attack**: Updating `/leaderboard/uid_A` from `efficiencyPct: 88` down to `efficiencyPct: 75`.
9. **Client-Spoofed Timestamp**: Passing `createdAt` or `updatedAt` different from `request.time`.
10. **Immortal `createdAt` Mutation**: Updating `/leaderboard/uid_A` with a modified `createdAt`.
11. **Resource Exhaustion (1MB String)**: Passing a 500KB string in `displayAlias` or `teamSummary` or an oversized `userId`.
12. **Client Delete Attack**: Attempting `deleteDoc` on `/leaderboard/uid_A`.
