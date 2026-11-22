# Security Specification — Commonspoly Online Services

## 1. Data Invariants
1. **Default-Deny Safety Net**: Every path not explicitly matched under `/databases/{database}/documents` is denied for all reads and writes.
2. **Ownership & Verified Identity**: Writes to `/leaderboard/{userId}`, `/dailyChallenges/{challengeDate}/entries/{userId}`, `/rooms/{roomId}`, and `/rooms/{roomId}/actions/{actionId}` require `request.auth != null && request.auth.token.email_verified == true`.
3. **Zero PII Exposure**: Public leaderboard and multiplayer collections contain strictly allowlisted non-PII gameplay keys (`keys().hasAll(...)` + `keys().hasOnly(...)`).
4. **Monotonic Personal Best (Global & Daily)**: Updates to `/leaderboard/{userId}` and `/dailyChallenges/{challengeDate}/entries/{userId}` are permitted only when strictly improving `efficiencyPct`, or faster `round`, or higher `totalCooperativeActions`, keeping `uid`, `challengeDate` (for daily), and `createdAt` immutable.
5. **Multiplayer Room Host Authority & Terminal State Locking**:
   - Room IDs must match `^room_[A-Z0-9]{4,8}$`.
   - Once a room reaches `status == 'FINISHED'`, all subsequent updates are rejected (`existing().status != 'FINISHED'`).
   - Only `hostUid` may advance `stateVersion`, `phase`, `round`, `activePlayerIndex`, `tileStates`, `playersSummary`, `speculatorsSummary`, or `gameResult`.
   - Non-host guests may only join a `WAITING` room with capacity (`memberUids.size() < maxPlayers`), update their own `members` ready/character selection while `WAITING`, or leave a non-finished room.
6. **Master Gate & Zero-Get List Queries on Room Actions**:
   - Creating or reading an action under `/rooms/{roomId}/actions/{actionId}` verifies `request.auth.uid in room.memberUids` and `incoming().hostUid == room.hostUid` via `get()`.
   - Updating an action is restricted solely to the room `hostUid` flipping `processed` from `false` to `true`.
   - `list` queries on `/rooms/{roomId}/actions` enforce `resource.data.hostUid == request.auth.uid` with `limit <= 25` and zero `get()` calls.
7. **Server Timestamp Integrity & Non-Deletable Logs**: All `createdAt`/`updatedAt` timestamps must match `request.time`. Client deletes are denied across all collections.

## 2. Adversarial "Dirty Dozen" Payloads (Expected: PERMISSION_DENIED)
1. **Unauthenticated Create**: Writing `/leaderboard/user_1`, `/dailyChallenges/2026-11-22/entries/user_1`, or `/rooms/room_ABC123` with `request.auth == null`.
2. **Unverified Email Create**: Creating any record with `request.auth.token.email_verified == false`.
3. **UID Spoofing (Daily/Global Path Mismatch)**: User `uid_A` writing `/dailyChallenges/2026-11-22/entries/uid_B`.
4. **Shadow / Ghost Field Injection**: Adding `{ email: "leak@example.com" }` or `{ isAdmin: true }` to leaderboard or room documents.
5. **Daily Challenge Date Poisoning**: Writing `/dailyChallenges/not-a-date/entries/uid_A` or mismatching `incoming().challengeDate`.
6. **Daily Score Downgrade Attack**: Updating `/dailyChallenges/2026-11-22/entries/uid_A` with lower `efficiencyPct`.
7. **Multiplayer Room Host Hijack**: Guest member attempting to update `hostUid` or `tileStates` during `PLAYING`.
8. **Terminal State Mutation**: Attempting to update `/rooms/room_ABC123` after `status == 'FINISHED'`.
9. **Capacity Overflow Join**: A 5th player attempting to join a `maxPlayers == 4` room.
10. **Non-Member Action Injection**: A user not in `room.memberUids` attempting to create `/rooms/room_ABC123/actions/act_1`.
11. **Guest Marking Action Processed**: A non-host room member attempting `updateDoc` `{ processed: true }` on `/rooms/room_ABC123/actions/act_1`.
12. **Client-Spoofed Timestamp & Delete Attack**: Passing `createdAt != request.time` or calling `deleteDoc` on any collection.
