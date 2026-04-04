# Technical Documentation: Anoon Data Operational System

## 1. System Architecture
The system employs a **Hybrid GAS-Web Architecture**, designed to bridge the gap between Google Workspace's ecosystem and modern web development workflows.

*   **Execution Layer**: Google Apps Script (GAS) serves as the server-side runtime, handling business logic and direct interaction with the Google Workspace API.
*   **Storage Layer**: Google Sheets is utilized as a relational-like database. Data is stratified across functional sheets (e.g., `سجل الزوار`, `طلاب تمكين`, `الاشتراكات`).
*   **Development Layer**: A Next.js-based emulator environment is used for local development, utilizing a bridge (`space-noon-bridge` polyfill in `Index.html`) to proxy `google.script.run` calls to local API routes that interact with the live GAS environment or mock data.
*   **Frontend**: A SPA (Single Page Application) architecture using Vanilla JS, semantic HTML5, and CSS variables for a custom-themed UI.

## 2. Core Data Flow

### Data Fetching (Boot/Secondary)
The system uses a tiered loading strategy to minimize initial Time-to-Interactive (TTI):
1.  **BootData (`getBootData`)**: Fetches critical path data (current visitors, basic options, today's KPI summary).
2.  **SecondaryData (`getSecondaryData`)**: Asynchronous fetch for non-critical datasets (Tamkeen students, full subscription lists) to allow the main UI to render without blocking on heavy sheet reads.

### User Authentication
Authentication is handled via GAS `Session.getActiveUser()`, mapped against an internal permission matrix (`_applyRoleUI`). The local emulator environment mimics this by passing identity headers or using a local login bypass.

### Real-time Sheet Updates
Updates are performed via atomic `google.script.run` calls. The backend uses `appendRow` for transaction logs (Check-ins) and `getRange(...).setValues()` for state updates (Check-outs/Edits) to ensure data integrity.

## 3. Key Modules & Logic

### KPI Engine
The engine calculates metrics in real-time or via cached snapshots:
*   **Total Revenue**: Aggregated from `cost` columns across four datasets: Visitors, Subscriptions (Weekly/Monthly), Hall Bookings, and Tamkeen Snacks.
*   **Operational Hours**: Computed by calculating the delta between `entryTime` and `exitTime` for all active and completed sessions within a specified timezone (`Asia/Gaza`).

### Tamkeen Logic
Tamkeen utilizes a **Single-Sheet Session Strategy**:
*   **Base Students**: Defined as rows in the `طلاب تمكين` sheet where the `DATE` column is null. These represent the student roster.
*   **Attendance Rows**: When a student checks in, a *new* row is appended to the same sheet containing the student's ID/Name and a `timestamped` entry.
*   **Filtering**: The software identifies "checkable" students by filtering out any row that already contains a date, preventing roster duplication.

### Caching & Performance
*   **CacheService**: Heavy-read operations (e.g., historical dashboard data) are stored in the GAS `CacheService` with a sliding expiration.
*   **Client-Side Filtering**: To avoid redundant server round-trips, the UI performs searching and group filtering (`tkGroup`, `vStatusFilter`) locally on the `APP` state object.

## 4. Technical Constraints

*   **GAS Execution Limit**: All backend functions are bound by the **30-second execution timeout**. Heavy operations like sheet consolidation must be optimized or chunked.
*   **Concurrency**: The system lacks native row-locking. It relies on the atomic nature of `appendRow` and client-side UI disabling during transit to prevent race conditions during multi-shift usage.
*   **State Persistence**: Since GAS is stateless, all ephemeral data (active timers, session IDs) must be persisted in Sheets or calculated on-the-fly from the logs.
