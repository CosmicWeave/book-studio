# AI Book Studio — UX/UI & Feature Improvement Report
_Generated: 2026-05-03_

---

## Executive Summary

AI Book Studio is a rich, capable writing tool. The core features — AI generation, brainstorming, the chat co-author, reader, audiobook, series manager — are all present and well-conceived. The friction points are primarily in **discoverability** (powerful features are hidden behind non-obvious UI), **information architecture** (sidebar overloading, duplicate entry points), **feedback loops** (users don't always know what the AI is doing or why), and **missing workflow connectors** (gaps between creation, editing, and publishing).

---

## 1. DASHBOARD & LIBRARY

### 1.1 Writing Progress is Nearly Invisible
The dashboard shows four static stat boxes (In Progress, Complete, Series, Documents) but no writing velocity or chapter-level progress. A user with 10 books in progress has no way to see which book they're actually making progress on.

**Suggested improvements**:
- Add a **per-book progress bar** on each BookCard showing `chapters written / total chapters` and a word count badge (e.g. "14,200 / 50,000 words").
- Add a **"Writing Streak"** widget — consecutive days with at least one save — similar to GitHub's contribution graph. Writers are motivated by streaks.
- Add a **"Last edited"** relative timestamp prominently on each card (currently buried in metadata).

### 1.2 Search Only Matches Book Titles
The dashboard search only filters by `book.topic`. A user looking for a book about a specific character or keyword inside chapters can't find it.

**Suggested improvements**:
- Extend search to match subtitle, author, description, and outline chapter titles.
- Add a **Global Full-Text Search** page (or command palette action) that searches across all chapter content, document content, and knowledge base entries simultaneously.

### 1.3 No Sorting by Genre/Tag
Books can be sorted by updated/created/title/word count but there is no tagging or genre system. A user with 30 books has no way to filter by fiction vs. non-fiction, or by project state.

**Suggested improvements**:
- Add **tags/labels** to the Book model (array of strings, user-defined). Show as colored chips on BookCards.
- Add a tag filter row on the dashboard above the book grid.
- Alternatively, support custom **collections** (like playlists) that books can belong to without being a "series."

### 1.4 Empty State is a Dead End
When a user has no books, the empty state shows a placeholder but doesn't guide the user to create their first book. New users land here with no clear call to action.

**Suggested improvements**:
- Show a prominent **"Create your first book"** card with 3 quick-start paths: "Start from scratch", "Import an existing file", "Let AI brainstorm an idea."
- Link to a short onboarding checklist: set your AI provider → create a book → generate your first chapter.

---

## 2. BOOK CREATION FLOW

### 2.1 No Clear Onboarding Wizard for New Users
The `BookCreationModal` and `BrainstormModal` are powerful but separate. A first-time user sees a creation dialog that asks for a topic and instructions without any guidance on what those mean or how they affect output.

**Suggested improvements**:
- Add a **guided first-book flow**: step 1 picks genre (Fiction / Non-Fiction), step 2 picks a framework (the existing `FRAMEWORKS` constant is perfect), step 3 enters topic with AI-powered suggestions, step 4 reviews and confirms.
- Show a tooltip-driven overlay the first time the editor is opened, pointing to the Brainstorm, Chat Co-Author, and Generate buttons.

### 2.2 Word Count Goal Has No Visual Feedback During Editing
The book has a `wordCountGoal` field, but in the editor there is no persistent indicator showing current word count vs. the goal. The per-chapter word count goal is similarly invisible until generation runs.

**Suggested improvements**:
- Show a **progress ring or bar** in the editor sidebar indicating "14,200 / 50,000 words" for the whole book.
- Show per-chapter word count alongside each chapter tab/entry in the outline sidebar.

### 2.3 Instruction Templates Are Disconnected from Book Creation
The Instructions Manager exists on its own page but is not surfaced during book creation. Users who have pre-saved templates have no shortcut to apply them when creating a new book.

**Suggested improvements**:
- Add a **"Use template"** dropdown to the book creation modal that populates the instructions field from the user's saved `InstructionTemplate` entries.
- Show the 3 most recently used templates as quick-select chips.

---

## 3. BOOK EDITOR

### 3.1 Sidebar Has Too Many Collapsible Panels — No Clear Hierarchy
The editor sidebar can contain up to 14 different collapsible sections (Configuration, Actions, Save Status, AI Assistant, Find & Replace, Research, Knowledge Base, Audiobook, Series, Macros, Image Suggestions, Generation Config, Metadata, Snapshots). Users must scroll and hunt for the panel they need. Power features like the Knowledge Base are buried below several less-used sections.

**Suggested improvements**:
- Replace the flat panel list with a **tabbed sidebar**: a compact icon tab bar (5-6 tabs) each revealing a focused panel. Suggested tabs:
  1. Write (generation controls, save status, actions)
  2. Outline (chapter list, corkboard/outliner toggle)
  3. Research (knowledge base, research panel)
  4. AI Tools (assistant, macros, analysis tools)
  5. Media (images, audiobook)
  6. Settings (metadata, generation config, series)
- This reduces cognitive load and removes the need for constant scroll.

### 3.2 Chapter Navigation is Hidden in a Dropdown
Chapter switching in the editor relies on a dropdown selector. With a 20-chapter book, the user must open the dropdown and scan. The Outliner and Corkboard views are buried inside a view-switcher toggle.

**Suggested improvements**:
- Add a **persistent chapter rail** (thin vertical strip on the left of the writing area, collapsible) showing chapter numbers and written/unwritten status at a glance. Click to jump.
- Show written chapters in a filled color, unwritten ones as hollow — like a storyboard strip.
- Display a word count badge per chapter in the rail.

### 3.3 AI Action Discoverability in the Editor
The Bubble Menu (AIAssistantToolbar) appears on text selection and shows Rephrase, Expand, Summarize, Tone. These are excellent, but users don't know they exist until they stumble on a text selection. The toolbar is also tiny with no labels, only icons.

**Suggested improvements**:
- Add a subtle hint text the first time the editor is opened: *"Select text for AI editing tools."*
- Add tooltips with labels to every icon in the bubble menu.
- Add a **slash command trigger** (`/`) that shows a quick menu for inserting headings, images, tables, and AI actions mid-paragraph (already in todo.md).

### 3.4 Generate All vs. Generate One is Confusing
There are two generation paths: "Generate All Chapters" and per-chapter "Generate/Regenerate." The distinction between Budget Mode and Full Mode (which also polishes) isn't explained to the user. Users don't know what they'll get.

**Suggested improvements**:
- Add a one-line description below the mode toggle: "Budget: fast generation · Full: generation + polish pass (~2× slower, higher quality)."
- Add a **generation queue indicator** showing which chapters are queued/in progress when running "Generate All."
- Show estimated time-to-complete based on chapter count and mode.

### 3.5 No Autosave Visual Confirmation
The `SaveStatusIndicator` exists but it's a small component in the sidebar. On a large screen, users writing in the main area have no assurance that content is being saved without scrolling the sidebar into view.

**Suggested improvements**:
- Show a **subtle floating save pill** (bottom center of the writing area) that fades in when unsaved and fades out once saved — similar to Notion or Google Docs.
- The pill should say "Saving…" → "Saved" (with a checkmark) and disappear after 2 seconds.

### 3.6 Find & Replace Panel is a Full Sidebar Panel
The Find & Replace feature occupies an entire collapsible sidebar panel. This is not how writers expect find/replace to work — they expect `Ctrl+F` to open a small inline bar at the top of the editor.

**Suggested improvements**:
- Trigger Find & Replace via `Ctrl+F` / `Cmd+F`, opening a small floating bar overlaid on the editor (not a sidebar panel).
- The sidebar panel can be removed; the functionality lives in the keyboard shortcut.

### 3.7 Diff Modal Needs a Side-by-Side View
The `DiffModal` shows new content but it's not clear what has changed from the original. For AI rewrites, users want to see exactly which sentences were modified.

**Suggested improvements**:
- Add a **side-by-side diff view** option alongside the current "new content only" view.
- Highlight added/removed/changed sentences with green/red/yellow backgrounds using a diff algorithm (e.g. `diff-match-patch`).

---

## 4. READER

### 4.1 No Chapter-to-Chapter Navigation Swipe
The Reader has touch gesture support for sidebar open/close, but there is no swipe gesture to go to the next/previous chapter. On mobile, users must tap into a menu to navigate chapters.

**Suggested improvements**:
- Add left/right swipe to navigate between chapters (with a short animation).
- Show chapter title as a toast briefly when the chapter changes.

### 4.2 Bookmark UX is a Modal
Opening the bookmark manager opens a full modal. Bookmarks are a quick-reference feature; the heavy modal creates friction.

**Suggested improvements**:
- Replace the bookmark modal with a **slide-in drawer** from the right, showing bookmarks as a list with timestamps and chapter names.
- Allow "jump to bookmark" with a single tap rather than a confirm button.

### 4.3 Reading Progress Not Linked to Writing Progress
The reader tracks reading progress, but this data is siloed from the book's writing context. A user reading their own draft has no way to annotate or leave editorial notes from the reader view.

**Suggested improvements**:
- Add a **"Note while reading"** button that opens a small sticky note tied to the current scroll position.
- These reading notes should be viewable in the editor as contextual feedback for revision.

### 4.4 No "Continue Reading" Link from Dashboard
The "Currently Reading" page exists, but there is no obvious "Continue Reading" shortcut on the main Dashboard for the most recently-read book.

**Suggested improvements**:
- Add a **"Continue Reading"** card at the top of the Dashboard (above the book grid), showing book cover, title, current chapter, and progress percentage.
- This should appear only when a book has active reading progress.

---

## 5. NAVIGATION & INFORMATION ARCHITECTURE

### 5.1 Sidebar Has Too Many Top-Level Items
The sidebar contains 11 navigation links: Dashboard, Documents, Reading, Archived, Trash, Instructions, Macros, Series (via series manager), Settings — plus the backup status indicator. This creates visual noise and doesn't prioritize the core workflow.

**Suggested improvements**:
- Group links into clear sections with separators:
  - **Library**: Dashboard, Currently Reading, Documents
  - **Create**: (Quick Create button)
  - **Manage**: Series, Instructions, Macros
  - **Archive**: Archived, Trash
  - **System**: Settings
- Move the backup status indicator to the Settings page header rather than the sidebar.

### 5.2 "Documents" and "Books" Are Confusing Parallel Concepts
The app has both `Books` (on the Dashboard) and `GeneralDoc` entries (on the Documents page). New users don't understand the difference.

**Suggested improvements**:
- Rename "Documents" to **"Notes & Documents"** and add a subtitle tooltip: "Freeform writing not part of a book."
- Add a contextual explanation on the Documents empty state.

### 5.3 Series Manager is Buried
The Series Manager page is accessible only through clicking on a series from the Dashboard. There is no direct link in the sidebar to "All Series."

**Suggested improvements**:
- Add a **"Series"** entry in the sidebar under the Library section that shows a list of all series.
- The current per-series detail page is fine; the missing piece is the top-level entry point.

---

## 6. NEW FEATURE SUGGESTIONS

### 6.1 Writing Goals & Daily Targets
Writers benefit enormously from daily word count goals. Currently there is no goal-setting or daily tracking.

**New feature**: A **Daily Writing Goal** setting (words/day). The dashboard shows today's progress toward the goal (e.g., a progress bar: "324 / 500 words today"). A gentle notification (browser notification opt-in) when the goal is met.

### 6.2 Chapter Status Workflow
The `ChapterOutline` has a `status` field (`todo`, `in_progress`, `done`) visible in the Corkboard view, but it's not prominent in the main editor workflow. Writers don't know about it.

**New feature**: Surface status as a **visual badge** on each chapter in the chapter rail and on the chapter header in the editor. Allow drag to change status. Add a Kanban-style filter (show only `in_progress` chapters) to the editor.

### 6.3 Revision History Timeline
The `BookSnapshot` system exists, but the Snapshots panel shows a flat list with minimal context. Users can't see what changed between snapshots.

**New feature**: A **Timeline view** in the snapshots panel — a vertical timeline showing snapshots as points, with the word count at each snapshot displayed as a bar chart. Click a point to preview and optionally restore.

### 6.4 Focus Mode
A distraction-free writing mode that hides the sidebar, header, and toolbar, leaving only the text content centered on screen. Writers frequently request this.

**New feature**: A **Focus Mode** toggle (keyboard shortcut: `F11` or `Ctrl+Shift+F`) that:
- Hides sidebar and toolbar
- Centers text in a fixed-width column (60-70 characters)
- Shows only a subtle word count and save indicator at the bottom
- Returns to normal via `Escape`

### 6.5 AI Writing Stats Page
The app has a rich AI call history and generation tracking infrastructure (snapshots, chat history, generation config) but no summary of AI usage.

**New page: "Writing Stats"** (reachable from Settings or Dashboard):
- Total words generated by AI vs. written by hand
- Generation count per book
- Most-used AI features (chat, brainstorm, rephrase, etc.)
- AI model/provider being used
- Storage used by book content, images, and audiobook cache

### 6.6 Template Gallery for Book Outlines
Currently the Brainstorm flow generates outlines from scratch every time. Users who write genre fiction (mystery, romance, thriller) want a starting point.

**New feature**: A **Outline Template Gallery** — a read-only collection of 10-20 pre-written chapter outline templates by genre, selectable at the start of the Brainstorm flow. The AI then personalizes the template to the user's specific topic and instructions.

### 6.7 Inline AI Comments (Not Just Full Rewrites)
The AI can currently rephrase, expand, and summarize selected text. But it can't leave a comment — a suggestion without replacing the text.

**New feature**: An **"AI Suggest"** action in the bubble menu that inserts an inline comment (using TipTap's comment extension or a custom implementation) saying e.g. *"Consider expanding this to show the character's emotional reaction rather than just stating it."* The author can accept, reject, or dismiss it.

### 6.8 Export Queue & Formats
Currently ePUB export opens a single modal. PDF export is via a vendor script. There is no Docx export (noted in todo.md).

**New feature**: An **Export Hub page/modal** with:
- Format selector: ePUB, PDF, Markdown, Plain Text, Docx (new)
- Batch export: select multiple books
- Export history: last 5 exports with re-download links (stored as blobs temporarily)

### 6.9 Character & Entity Quick Reference Panel
The Knowledge Base (per-book and per-series) is powerful, but accessing it requires navigating to a specific sidebar panel and knowing which sheet to look in. While writing a scene, a user can't quickly check character details without interrupting their flow.

**New feature**: A **Quick Reference Popover** — triggered by `@CharacterName` typing in the editor, showing a tooltip card with the character's knowledge sheet summary. This is especially useful when the knowledge base has been auto-filled by the AI.

### 6.10 Reading Mode for Drafts on Mobile
The Reader page is excellent for reading completed books, but writers often want to read through their draft without editing. There is no "Read Mode" accessible from the editor on mobile.

**New feature**: A **"Preview Draft"** button in the editor (mobile toolbar) that opens the current book in a simplified reading view with the reader's font/theme settings but without the full Reader's navigation chrome.

---

## 7. MOBILE UX

### 7.1 Editor is Not Mobile-Optimized
The book editor opens on mobile but the sidebar takes up significant screen space and the toolbar has too many small buttons for touch targets. The chapter selector is a dropdown that requires precision tapping.

**Suggested improvements**:
- On mobile, collapse the sidebar into a bottom sheet activated by a floating button.
- Show only the top 3 most-used toolbar actions on mobile; put the rest in a "More" overflow menu.
- Replace the chapter dropdown with a **horizontal swipeable chapter indicator** at the top of the editor.

### 7.2 Command Palette is Not Touch-Friendly
The Command Palette (`Ctrl+K`) works with a keyboard but has no obvious touch trigger on mobile.

**Suggested improvements**:
- Add a **long-press gesture** on the header logo or a dedicated floating button to open the Command Palette on touch devices.
- Increase the minimum tap target size of Command Palette list items to 44px.

---

## 8. QUICK WINS (LOW EFFORT, HIGH IMPACT)

| Feature | Description | Effort |
|---|---|---|
| Word count on BookCard | Show total word count on each card | Very low |
| "Continue where you left off" | Restore last open book+chapter on app load | Low |
| Quick duplicate book | Duplicate a book to use as a template | Low |
| Chapter word count in chapter list | Show word count next to each chapter name | Low |
| Keyboard shortcut hint in empty editor | "Press / for commands" hint text | Very low |
| Confirmation sound on AI completion | Subtle chime when generation finishes | Very low |
| Dark mode for Reader sync with system | Auto-switch Reader theme with OS preference | Low |
| Drag to reorder chapters in chapter list | Drag handles on the chapter rail | Medium |
| "Mark as complete" from BookCard menu | No need to open the book to mark it done | Very low |
| Show AI persona icon in editor header | Makes active persona visible at a glance | Very low |

---

## Priority Summary

| Priority | Recommendation |
|---|---|
| 🔴 Must-do | Tabbed editor sidebar (replaces 14-panel overload) |
| 🔴 Must-do | Persistent chapter rail in editor |
| 🔴 Must-do | Floating save pill ("Saving... / Saved") in editor |
| 🟠 High | Focus Mode (distraction-free writing) |
| 🟠 High | "Continue Reading" card on Dashboard |
| 🟠 High | Word count progress on BookCard and editor |
| 🟠 High | Daily writing goal widget on Dashboard |
| 🟡 Medium | Inline AI comments / suggestions |
| 🟡 Medium | Outline Template Gallery |
| 🟡 Medium | Side-by-side diff view in DiffModal |
| 🟡 Medium | @CharacterName quick reference popover |
| 🟡 Medium | Ctrl+F for Find & Replace (remove sidebar panel) |
| 🟢 Low | Writing Stats page |
| 🟢 Low | Export Hub (batch + Docx) |
| 🟢 Low | Revision History Timeline view |
