# System Design: Threads 1-Click Block Chrome Extension (MVP)

## 1. System Overview
The Threads 1-Click Block Extension streamlines content moderation on https://www.threads.net. By default, blocking a user requires a multi-step workflow (opening the overflow menu, selecting block, and confirming). This extension reduces that friction down to a single click by injecting a custom block button directly into the action tool bar beside each post or comment (adjacent to like, reply, repost, and share icons).

---

## 2. Architecture & Tech Stack

### Architecture Diagram
+-------------------------------------------------------------+
|                      Google Chrome Browser                  |
|                                                             |
|  +-------------------------------------------------------+  |
|  |             Content Script (content.ts)               |  |
|  |  - MutationObserver (Watches for dynamic DOM cards)   |  |
|  |  - DOM Injector (Appends 1-Click Block icon button)   |  |
|  |  - Event Automation (Triggers native menu & block)    |  |
|  +-------------------------------------------------------+  |
|                             |                               |
|                             v                               |
|  +-------------------------------------------------------+  |
|  |                   Threads.net SPA DOM                 |  |
|  |  - Action Row Containers (Like / Reply / Repost / Share)|  |
|  |  - Native Overflow Menu & Modal Interaction Elements  |  |
|  +-------------------------------------------------------+  |
+-------------------------------------------------------------+

### Tech Stack Selection
* Extension Framework: Google Chrome Extensions Manifest V3.
* Language: TypeScript for robust typing and maintainability.
* Bundler: Vite with @crxjs/vite-plugin for fast hot module reloading (HMR) during development.
* Styling: Native CSS injected via content script to match Threads' native button dimensions and dark/light UI modes.

---

## 3. Component Breakdown

### A. Manifest Configuration (manifest.json)
* Defines extension metadata, permissions (activeTab, scripting), and host match patterns restricted to https://www.threads.net/*.
* Injects the compiled content script at document_idle to ensure the DOM is ready for observation.

### B. Content Script Engine (src/content.ts)
1. DOM Observation (MutationObserver): 
   * Threads is a React-driven Single Page Application (SPA) with infinite scroll. 
   * The observer continuously monitors dynamically added nodes to detect incoming post/comment cards.
2. Action Bar Targeting: 
   * Locates the action row container where existing buttons (like, reply, repost, share) reside.
3. Button Injection: 
   * Creates and inserts a custom SVG block button matching your design layout right beside the share/repost action buttons.
4. 1-Click Automation Routine: 
   * When clicked, the script programmatically triggers the native overflow menu (...) corresponding to that exact post container.
   * Instantly locates and clicks the native "Block" option item in the resulting dropdown to execute the block workflow.
