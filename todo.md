
# AI Book Studio - Comprehensive Development Roadmap

## 1. Core Stability & Offline Capabilities (Current Focus)
- [x] **Advanced Service Worker**: Implement Cache-First for assets, Network-First for nav.
- [x] **Offline UI**: Add global offline banner/indicator.
- [x] **Sync Logic**: Queue backups when offline and retry on connection.
- [x] **Error Handling**: Fail fast with clear messages for AI features when offline.
- [x] **Conflict Resolution**: Implement logic to handle data conflicts if a user edits on multiple devices while offline (last-write-wins vs merge).
- [x] **Storage Quota Management**: Add alerts when IndexedDB storage usage approaches browser limits.

## 2. Cloud Sync & Collaboration (Expanded)
- [ ] **Advanced Sync Logic**:
    - [ ] **Differential Sync**: Upload only changed parts of the book data instead of the full JSON blob to save bandwidth.
    - [ ] **Auto-Resolve Conflicts**: Implement simple merge strategies for non-conflicting changes (e.g., different chapters edited).
    - [x] **Manual Conflict Resolution UI**: A visual diff tool to let users choose between local and remote versions when a conflict occurs.
- [ ] **Versioning & History**:
    - [ ] **Cloud Snapshots**: Automatically tag daily backups in the cloud provider (e.g., "Book Name - 2023-10-27").
    - [ ] **Restore Points**: UI to browse and restore from historical cloud snapshots.
- [ ] **Collaboration Features (Future)**:
    - [ ] **Shared Folders**: Allow syncing to a shared folder for basic team access.
    - [ ] **Comment Sync**: Sync editor comments/notes separately from content for lighter collaboration.
    - [ ] **Locking Mechanism**: Simple file locking to prevent two users from editing the same chapter simultaneously.

## 3. Editor Experience (The "Google Docs" Feel)
- [ ] **Selection Floating Menu**: Add a context menu that appears on text selection (Bold, Italic, Comment, AI Rewrite).
- [ ] **Slash Commands**: Implement notion-like `/` commands to insert headers, lists, tables, and images quickly.
- [ ] **Real-time Word Count**: Ensure word count updates instantly without lag on large chapters.
- [ ] **Focus Mode Animation**: Smooth transitions when entering/exiting Focus Mode.
- [ ] **Typewriter Scrolling**: Option to keep the cursor centered vertically while typing.
- [ ] **Find & Replace**: Full find/replace functionality within the editor (Ctrl+F).
- [ ] **Spellcheck Toggle**: Allow users to toggle browser spellcheck on/off.

## 4. AI Co-Authoring Enhancements
- [x] **Ghost Text Autocomplete**: Ghost text suggestions as you type (like GitHub Copilot for prose).
- [x] **Character Voice consistency**: AI analysis to ensure character dialogue remains consistent throughout the book.
- [x] **Plot Hole Detector**: Dedicated analysis tool to find logical inconsistencies in the outline vs. content.
- [x] **Lore Consistency Check**: Cross-reference new text against the Knowledge Base in real-time.
- [x] **Custom AI Personas**: Allow users to define different "AI Editor Personas" (e.g., "Ruthless Editor", "Encouraging Coach", "Grammar Nazi").

## 6. Audio & Accessibility
- [ ] **Screen Reader Optimization**: Audit all modals and custom inputs for proper ARIA labels and tab indexing.
- [ ] **Keyboard Navigation**: Ensure the entire app (including the sidebar and modals) is navigatable via keyboard.
- [ ] **High Contrast Theme**: Refine the high-contrast mode for better readability.

## 7. Data Management & Export
- [ ] **Advanced ePUB**: Add support for custom fonts and more granular styling in ePUB export.
- [ ] **Docx Export**: Native export to Microsoft Word format.
- [ ] **Version Diffing**: Visual diff tool to compare two snapshots side-by-side.
- [ ] **Project Statistics**: Dashboard with graphs showing writing velocity (words/day) and progress over time.

## 8. Code Quality & Infrastructure
- [ ] **Unit Tests**: Add Jest/Vitest tests for critical utilities (parsers, formatters, storage logic).
- [ ] **E2E Testing**: Implement Playwright tests for critical user flows (Create Book, Write Chapter, Backup).
- [ ] **Performance Profiling**: Audit re-renders in the main Editor component.
- [ ] **Bundle Optimization**: Analyze chunk sizes and implement code-splitting for heavy libraries (PDF.js, etc.).
- [ ] **Type Safety**: Enable stricter TypeScript rules (`noImplicitAny`, `strictNullChecks`) and fix resulting errors.

## 9. Mobile Experience (PWA)
- [x] **Touch Gestures**: Swipe to open/close sidebar on mobile.
- [x] **Pull-to-Refresh**: Implement pull-to-refresh for syncing status (if applicable).
- [x] **Install Prompts**: Custom UI to encourage users to "Add to Home Screen".
- [x] **Share Target API**: Allow users to "Share" text/links from other apps *into* AI Book Studio.

## 10. Refactoring Candidates
- [ ] `Reader.tsx`: The component is growing large; extract scroll logic and rendering logic into custom hooks.
- [ ] `ChapterEditor.tsx`: Decouple the toolbar logic further to make it reusable for the General Editor.
- [ ] `AppContext.tsx`: Split into smaller contexts (`DataStoreContext`, `UIContext`, `AuthContext`) to prevent unnecessary re-renders.

## 11. Future "Moonshot" Ideas
- [ ] **Multi-user Collaboration**: Real-time co-writing using WebRTC or a lightweight backend (Yjs).
- [ ] **Marketplace**: Share and download Instruction Templates and Macros from a community repo.
- [ ] **Publishing Assistant**: AI tools to generate query letters, synopsis, and Amazon blurbs.

## 12. Data & Sync Optimization (Backup-API)
- [x] **Client-Side Compression**: Implement GZIP compression (via `CompressionStream`) for backup JSON payloads to reduce bandwidth usage by ~80%.
- [x] **Payload Deduplication**: Calculate a local hash (SHA-256) of the backup payload. If it matches the last successfully uploaded hash, abort the upload to save requests.
- [x] **Daily Snapshot Caching**: Cache the existence of today's daily backup locally to prevent querying the list endpoint on every auto-save cycle.
- [x] **Image Exclusion Setting**: Add a "Low Data Mode" to exclude large cover images and inserted assets from the automatic cloud backup.
- [x] **Exponential Backoff**: Improve the retry logic for failed syncs to use exponential backoff instead of immediate/fixed retries.
- [x] **Network Usage Stats**: Visual indicator in Settings showing how much data has been synced in the current session.
