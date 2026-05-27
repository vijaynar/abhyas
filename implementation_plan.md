# Implementation Plan: Phase 5 — Upasthiti Mobile Expo App (React Native)

Upasthiti is an AI-powered student management and attendance platform. This document outlines the technical design, screen flow, and file-level implementation plan for **Phase 5: Mobile Expo App (React Native)**.

We will build a visually stunning, premium, dark-themed mobile application (**Deep Slate & Indigo Glow** with sleek glassmorphism, responsive micro-animations, and clean typography) utilizing **Expo v56 (React Native 0.85)** and standard styling engines.

---

## User Review Required

> [!IMPORTANT]
> **Key Architectural Elements for Phase 5:**
> *   **State-Driven Custom Navigation Context:** Rather than installing external routing packages that risk peer-dependency compilation errors on React 19 / React Native 0.85, we will build a premium, state-driven custom Navigation Provider. This gives us complete control over high-fidelity transitions, dynamic route histories, and stunning tab bars.
> *   **Sibling Profile Selection Screen:** If a parent email is mapped to multiple student profiles, the app will redirect them to a dynamic Profile Selector Screen where they choose which student's dashboard to view.
> *   **Expo Camera Integration & Mock HUD Simulator:** We will use `expo-camera` to stream live entrance frames. To ensure 100% execution capability in simulator environments, the Scanner Screen will include a simulation trigger that draws a neon target box, executes glowing scans, computes mock 128-float facial embeddings, and calls the `/api/v1/attendance/match-face` API.
> *   **Payment Proof Upload (Fines Ledger):** Students/parents can view outstanding absentees fines, tap "Pay Fine", select UPI, input transaction ref IDs, and select/simulate receipt screenshots which are uploaded to the Supabase `student-portraits` or `payment-proofs` bucket and logged with status `'pending_verification'`.

---

## Proposed Changes

We group the files to be created and modified under Phase 5 into logical components:

### 1. App Configuration & Root Setup

#### [MODIFY] [app.json](file:///c:/src/Upasthiti/apps/mobile/app.json)
*   Set default interface style to `"dark"`.
*   Add Android/iOS camera permission descriptors:
    ```json
    "plugins": [
      [
        "expo-camera",
        {
          "cameraPermission": "Allow Upasthiti to access your camera for high-speed facial recognition check-in."
        }
      ]
    ]
    ```

#### [MODIFY] [App.tsx](file:///c:/src/Upasthiti/apps/mobile/App.tsx)
*   Wrap the application with our custom `AuthProvider` and `NavigationProvider`.
*   Render the active screen dynamically with smooth transition animations and the glowing global status bar.

---

### 2. State, Context, & API Helpers

#### [NEW] [AuthContext.tsx](file:///c:/src/Upasthiti/apps/mobile/src/context/AuthContext.tsx)
*   Manages user login session using Supabase client auth.
*   Resolves user role: `'admin'`, `'student'`, `'parent'`, or `'superadmin'`.
*   Retrieves all linked student profiles if a parent or student account is logged in (handling multiple sibling accounts).
*   Stores the active selected profile ID, user profile details, and authentication status.

#### [NEW] [NavigationContext.tsx](file:///c:/src/Upasthiti/apps/mobile/src/context/NavigationContext.tsx)
*   Manages a state-based screen stack: `currentScreen` (`'Login' | 'ProfileSelect' | 'AdminDashboard' | 'AdminScanner' | 'AdminStudents' | 'StudentDashboard' | 'StudentFines' | 'StudentCalendar'`).
*   Implements `navigate(screen)` and `goBack()` with historical stacks.
*   Provides animation triggers for screen transition wipes.

#### [NEW] [api.ts](file:///c:/src/Upasthiti/apps/mobile/src/services/api.ts)
*   Configures a lightweight API fetch client using `EXPO_PUBLIC_API_BASE_URL` with auth token injections.
*   Implements `matchFace(batchId, embedding)`: Posts client-side face vectors to `/api/v1/attendance/match-face`.
*   Implements `uploadPaymentProof(fineId, transactionId, method, base64Image)`: Uploads receipt screenshots to Supabase storage and submits verification to backend.

---

### 3. Glassmorphic Component Library

#### [NEW] [GlassCard.tsx](file:///c:/src/Upasthiti/apps/mobile/src/components/GlassCard.tsx)
*   A responsive container using low-opacity dark background (`rgba(15, 23, 42, 0.6)`) and subtle glowing neon-indigo borders (`rgba(99, 102, 241, 0.2)`).
*   Features subtle drop shadows to create high-end visual depth.

#### [NEW] [NeonButton.tsx](file:///c:/src/Upasthiti/apps/mobile/src/components/NeonButton.tsx)
*   High-fidelity, pressable button utilizing linear-like layout styling.
*   Glows with indigo (#6366f1) or neon green (#10b981). Includes micro-scale scaling on press.

#### [NEW] [NeonInput.tsx](file:///c:/src/Upasthiti/apps/mobile/src/components/NeonInput.tsx)
*   Elegant dark input with text inputs, password toggle support, and an active neon focus border that animates from thin grey to bright indigo on focus.

#### [NEW] [TabBar.tsx](file:///c:/src/Upasthiti/apps/mobile/src/components/TabBar.tsx)
*   Sleek bottom tab navigator panel with glowing center camera gate shortcuts for Admins, and smooth navigation toggles between Calendar, Dashboard, and Fines for Students.

---

### 4. Application Screens

#### [NEW] [LoginScreen.tsx](file:///c:/src/Upasthiti/apps/mobile/src/screens/LoginScreen.tsx)
*   Clean, premium dark login card featuring animated glowing background gradients.
*   Provides quick-login toggles for Admin or Student demos.
*   Handles roll-number mappings (`vsXXXXX`) and credentials validation.

#### [NEW] [ProfileSelectScreen.tsx](file:///c:/src/Upasthiti/apps/mobile/src/screens/ProfileSelectScreen.tsx)
*   If a parent or sibling email logs in, displays a beautiful selection grid of active student cards (shows names, batch info, custom roll numbers, and avatars). Clicking a profile locks it and directs to the Student Dashboard.

#### [NEW] [AdminDashboardScreen.tsx](file:///c:/src/Upasthiti/apps/mobile/src/screens/AdminDashboardScreen.tsx)
*   Displays today's check-in metrics (Present, Absent, Late count cards).
*   Contains a glowing float button "Launch Live Gate Scanner" leading to the camera gates.
*   Includes a scrollable real-time activity feed showing live student check-ins.

#### [NEW] [AdminScannerScreen.tsx](file:///c:/src/Upasthiti/apps/mobile/src/screens/AdminScannerScreen.tsx)
*   Fullscreen `expo-camera` streaming feed.
*   Draws a rotating holographic target reticle over the capture viewport.
*   Includes a "Simulate Scan" mechanism for quick offline/local testing.
*   Slides down a neon HUD banner on successful matches:
    *   **GREEN Overlay:** Present check-in confirmation (98.2% similarity).
    *   **AMBER Overlay:** Late Arrival grace threshold indicator.
    *   **RED Overlay:** Unknown face alert trigger.
*   Bottom scrollable feed displaying matched items log.

#### [NEW] [AdminStudentsScreen.tsx](file:///c:/src/Upasthiti/apps/mobile/src/screens/AdminStudentsScreen.tsx)
*   Lists all enrolled students with search filtering, roll number highlights, batch tags, and face registration status badges (Green "Enrolled" / Amber "Missing").

#### [NEW] [StudentDashboardScreen.tsx](file:///c:/src/Upasthiti/apps/mobile/src/screens/StudentDashboardScreen.tsx)
*   Shows a gorgeous custom circular SVG attendance percentage gauge (e.g. 94.6% actual vs 90.0% target).
*   Features active billing widget: "Pending Fines: ₹1,000" in neon pink glow.
*   Displays the personalized monthly Gemini AI Progress Insight block.

#### [NEW] [StudentFinesScreen.tsx](file:///c:/src/Upasthiti/apps/mobile/src/screens/StudentFinesScreen.tsx)
*   Scrollable list of issued fines (amount, issue date, status: unpaid, pending, paid).
*   Clicking an unpaid fine pops up the **Proof of Payment Overlay**:
    *   Input UPI / Bank transaction reference code.
    *   Upload/simulate transaction receipt screenshot from gallery.
    *   Fires submit request to change fine status to `'pending_verification'` and update lists.

#### [NEW] [StudentCalendarScreen.tsx](file:///c:/src/Upasthiti/apps/mobile/src/screens/StudentCalendarScreen.tsx)
*   Customized monthly calendar grid styled in deep slate and glass.
*   Days are color-coded based on attendance logs:
    *   **Bright Neon Green Dot:** Present day.
    *   **Glowing Amber Dot:** Late arrival.
    *   **Neon Pink/Red Dot:** Absent fine issued.
    *   **Muted slate/grey:** Holidays or weekends.

---

## Verification Plan

### Automated Compilation Check
1. **TypeScript Integrity:** Confirm zero compilation errors across mobile source files.
2. **Monorepo Build Hook:** Verify build orchestration executes with `npm run build` from root workspace.

### Manual App Walkthrough & Verification
1. **Parent Multi-Sibling Selector:** Log in with a duplicate parent email, verify the Profile Select Screen loads, select a sibling, and verify the student dashboard maps that child's data.
2. **Camera Scanner HUD Match:** Open the Live Scanner, trigger a simulated match, verify the neon target reticle animations spin, and check that the correct color overlays (Green/Amber/Red) slide down with the correct text, logging the check-in to the DB.
3. **End-to-End Fine Upload & Verification loop:**
    *   Select an active fine card in the Student Fines list.
    *   Trigger "Upload Proof", input transaction ref `REF777999`, choose a simulated screenshot, and submit.
    *   Verify the status indicator changes immediately to "Pending Verification".
    *   Open the Web Admin portal under the `/admin/fines` queue, verify the uploaded screenshot and details appear, and click `APPROVE`.
    *   Check that the mobile dashboard automatically updates the fine card status to `Paid` on the next refresh!
