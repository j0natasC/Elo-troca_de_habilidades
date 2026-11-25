# ELO+ Firestore Security Specification (Phase 0)

## 1. Data Invariants
1. **PII Isolation**: Emails and personal account preferences live exclusively under `/users/{userId}`. Only the owner (`request.auth.uid == userId`) can read or write `/users/{userId}`. Public directory documents under `/publicProfiles/{profileId}` contain zero PII and can only be listed when `privacyPublicProfile == true`.
2. **Verified Identity**: All writes require `request.auth != null && request.auth.token.email_verified == true`. Author/owner fields (`uid`, `senderId`, `proposerId`, `reviewerId`, `userId`) must strictly equal `request.auth.uid`.
3. **Chat Participant Master Gate**: Access to `/chats/{chatId}/messages/{messageId}` strictly validates parent `/chats/{chatId}` membership (`participantA == uid || participantB == uid`) via `get()`, and creating a message atomically synchronizes parent `/chats/{chatId}.updatedAt == request.time` via `getAfter()`.
4. **Exchange State Machine & Terminal Locking**: Newly created exchanges must start with `status == 'PENDENTE'`, `proposerId == request.auth.uid`, `proposerId != receiverId`, and valid referenced profiles. Once an exchange reaches `'CANCELADA'`, no further updates are permitted; once `'CONCLUIDA'`, no status transitions are permitted and reviews can only be posted once per participant in `/exchanges/{exchangeId}/reviews/{reviewerId}`.
5. **Temporal & ID Integrity**: Every `createdAt`, `sentAt`, and `updatedAt` timestamp must equal `request.time`. All document IDs match `^[a-zA-Z0-9_\\-]+$` (`<= 128` chars), and every string and array has bounded `.size()`.

## 2. The "Dirty Dozen" Adversarial Payloads (Expected: PERMISSION_DENIED)
1. **Identity Spoofing on Chat Message**: Authenticated user A writes `/chats/A__B/messages/m1` with `senderId: "B"`.
2. **Shadow Field Injection on PublicProfile**: User A creates `/publicProfiles/A` adding ghost field `isAdmin: true` or `verifiedBadge: true`.
3. **PII Cross-Read Attack**: Authenticated user A tries `get` on `/users/B` to read user B's email/settings.
4. **Private Profile Scraping Attack**: User A tries `list` or `get` on `/publicProfiles/B` when `B.privacyPublicProfile == false`.
5. **Unauthenticated List Query**: Anonymous request issues `list` on `/publicProfiles` or `/chats`.
6. **ID Poisoning Attack**: User sends a 500-character junk document ID containing `/` or `$` to `/exchanges/{exchangeId}`.
7. **Denial-of-Wallet Payload Overflow**: User sends a 10,000-character chat `text` or `skills` array with 50 items to `/publicProfiles/A`.
8. **State Shortcutting on Exchange Creation**: Proposer creates `/exchanges/ex1` directly with `status: "CONFIRMADA"` or `status: "CONCLUIDA"`.
9. **Terminal State Mutation**: Participant attempts to update `/exchanges/ex1` back to `PENDENTE` after `status == "CANCELADA"` or `"CONCLUIDA"`.
10. **Immutable Field Hijack**: User updates `/exchanges/ex1` attempting to rewrite `proposerId` or `createdAt`.
11. **Timestamp Forgery**: User submits a client-supplied past timestamp (`2020-01-01`) instead of `request.time` for `sentAt` or `updatedAt`.
12. **Review Before Completion / Impersonation**: User tries to write `/exchanges/ex1/reviews/otherUid` or review an exchange still in `PENDENTE`.
