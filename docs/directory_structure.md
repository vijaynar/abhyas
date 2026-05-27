# Upasthiti — Monorepo Directory Structure

> Covers **all 5 phases** of the MVP. Deferred modules (Health Tracker, Payment Queue, Insights, Notifications) are marked `[LATER]` and will NOT be created now.

---

```
c:\src\Upasthiti\
│
├── 📄 package.json                        # Root workspace config (workspaces: apps/*, packages/*)
├── 📄 turbo.json                          # Turborepo pipeline: build, dev, lint caches
├── 📄 tsconfig.base.json                  # Shared TypeScript base config (extended by all apps)
├── 📄 .env.example                        # Template for all environment variables
├── 📄 .gitignore
│
│
├── 📁 supabase/                           # ── PHASE 1: Database ──────────────────────
│   ├── 📄 config.toml                     # Local Supabase Docker config (ports, auth settings)
│   └── 📁 migrations/
│       ├── 📄 0001_initial_schema.sql     # tenants, users, classes, batches, students,
│       │                                  #   parents, parent_student_map, student_face_samples,
│       │                                  #   attendance_logs, tenant_settings, fines
│       ├── 📄 0002_face_matching_rpc.sql  # match_face_embedding() pgvector stored procedure
│       └── 📄 0003_indexes.sql            # Multi-tenant isolation + pgvector IVFFlat indexes
│
│
├── 📁 packages/                           # ── PHASE 2: Shared Packages ────────────────
│   │
│   ├── 📁 database/                       # Shared Supabase client (used by web + mobile)
│   │   ├── 📄 package.json
│   │   ├── 📄 tsconfig.json
│   │   └── 📁 src/
│   │       ├── 📄 index.ts                # Exports createClient for browser + server
│   │       ├── 📄 client.ts              # Browser/client-side Supabase instance
│   │       └── 📄 server.ts              # Server-side Supabase admin instance (service role)
│   │
│   └── 📁 common/                         # Shared TypeScript types & Zod validators
│       ├── 📄 package.json
│       ├── 📄 tsconfig.json
│       └── 📁 src/
│           ├── 📄 index.ts               # Re-exports everything
│           ├── 📄 types.ts               # Core interfaces: Tenant, User, Student, Batch, etc.
│           ├── 📄 schemas.ts             # Zod validation schemas for API payloads
│           └── 📄 constants.ts           # Shared enums: Role, AttendanceStatus, FineStatus
│
│
├── 📁 apps/
│   │
│   ├── 📁 web/                            # ── PHASE 3 & 4: Next.js Admin Portal ──────
│   │   ├── 📄 package.json
│   │   ├── 📄 tsconfig.json
│   │   ├── 📄 next.config.ts
│   │   ├── 📄 tailwind.config.ts
│   │   ├── 📄 postcss.config.js
│   │   ├── 📄 .env.local                  # SUPABASE_URL, SUPABASE_ANON_KEY, SERVICE_ROLE_KEY
│   │   │
│   │   └── 📁 src/
│   │       ├── 📁 app/                    # Next.js App Router
│   │       │   │
│   │       │   ├── 📄 layout.tsx          # Root layout: fonts, metadata, global providers
│   │       │   ├── 📄 page.tsx            # Landing / login redirect
│   │       │   ├── 📄 globals.css         # CSS design tokens, glassmorphism utils, animations
│   │       │   │
│   │       │   ├── 📁 (auth)/             # Auth route group
│   │       │   │   ├── 📁 login/
│   │       │   │   │   └── 📄 page.tsx    # Login form (email + password via Supabase Auth)
│   │       │   │   └── 📁 register/
│   │       │   │       └── 📄 page.tsx    # Initial tenant + admin registration
│   │       │   │
│   │       │   ├── 📁 admin/              # Protected admin pages
│   │       │   │   ├── 📄 layout.tsx      # Admin shell: sidebar + header
│   │       │   │   │
│   │       │   │   ├── 📁 dashboard/
│   │       │   │   │   └── 📄 page.tsx    # KPI cards, live attendance feed, fine summary
│   │       │   │   │
│   │       │   │   ├── 📁 classes/
│   │       │   │   │   ├── 📄 page.tsx    # List all classes
│   │       │   │   │   └── 📁 [classId]/
│   │       │   │   │       ├── 📄 page.tsx         # Class details + batch list
│   │       │   │   │       └── 📁 batches/
│   │       │   │   │           └── 📄 page.tsx      # Batch schedule form
│   │       │   │   │
│   │       │   │   ├── 📁 students/
│   │       │   │   │   ├── 📄 page.tsx    # Student roster (search, filter, invite)
│   │       │   │   │   └── 📁 [studentId]/
│   │       │   │   │       ├── 📄 page.tsx          # Student profile, face status
│   │       │   │   │       └── 📁 enroll-face/
│   │       │   │   │           └── 📄 page.tsx      # Webcam face capture & enrollment
│   │       │   │   │
│   │       │   │   ├── 📁 attendance/
│   │       │   │   │   ├── 📄 page.tsx    # Attendance logs table with date filters
│   │       │   │   │   └── 📁 manual/
│   │       │   │   │       └── 📄 page.tsx          # Manual override: mark absent/present
│   │       │   │   │
│   │       │   │   ├── 📁 fines/
│   │       │   │   │   └── 📄 page.tsx    # Fines ledger (filter by status/student)
│   │       │   │   │
│   │       │   │   └── 📁 settings/
│   │       │   │       └── 📄 page.tsx    # Tenant settings: fine rules, grace periods
│   │       │   │
│   │       │   └── 📁 api/v1/             # ── PHASE 3: Serverless API Routes ──────────
│   │       │       │
│   │       │       ├── 📁 auth/
│   │       │       │   ├── 📁 signup/
│   │       │       │   │   └── 📄 route.ts   # POST: create student/parent user in tenant
│   │       │       │   └── 📁 me/
│   │       │       │       └── 📄 route.ts   # GET: return current authenticated user profile
│   │       │       │
│   │       │       ├── 📁 students/
│   │       │       │   ├── 📁 enroll-face/
│   │       │       │   │   └── 📄 route.ts   # POST: save face embedding vector for a student
│   │       │       │   └── 📄 route.ts       # GET/POST: list or create student profiles
│   │       │       │
│   │       │       ├── 📁 classes/
│   │       │       │   └── 📄 route.ts       # GET/POST: manage classes
│   │       │       │
│   │       │       ├── 📁 batches/
│   │       │       │   └── 📄 route.ts       # GET/POST: manage batch schedules
│   │       │       │
│   │       │       ├── 📁 attendance/
│   │       │       │   ├── 📄 route.ts       # GET: fetch attendance logs with filters
│   │       │       │   └── 📁 match-face/
│   │       │       │       └── 📄 route.ts   # POST: pgvector cosine match, log attendance + fines
│   │       │       │
│   │       │       └── 📁 fines/
│   │       │           └── 📄 route.ts       # GET: list fines; POST: manual fine creation
│   │       │
│   │       ├── 📁 components/
│   │       │   ├── 📁 ui/                    # Reusable primitives
│   │       │   │   ├── 📄 Button.tsx
│   │       │   │   ├── 📄 Card.tsx
│   │       │   │   ├── 📄 Badge.tsx
│   │       │   │   ├── 📄 Input.tsx
│   │       │   │   ├── 📄 Modal.tsx
│   │       │   │   ├── 📄 Table.tsx
│   │       │   │   └── 📄 Avatar.tsx
│   │       │   │
│   │       │   ├── 📁 layout/
│   │       │   │   ├── 📄 Sidebar.tsx        # Admin left navigation panel
│   │       │   │   ├── 📄 Header.tsx         # Top bar with tenant switcher + notifications bell
│   │       │   │   └── 📄 PageShell.tsx      # Page wrapper with header + content area
│   │       │   │
│   │       │   ├── 📁 attendance/
│   │       │   │   ├── 📄 AttendanceFeed.tsx  # Real-time list of recent check-ins
│   │       │   │   ├── 📄 AttendanceTable.tsx # Filterable, paginated attendance log table
│   │       │   │   └── 📄 StatusBadge.tsx     # present / late / absent badge chip
│   │       │   │
│   │       │   ├── 📁 face/
│   │       │   │   ├── 📄 FaceEnrollCamera.tsx  # Webcam face capture with face-api.js overlay
│   │       │   │   └── 📄 FaceMatchOverlay.tsx  # Real-time bounding box visualization
│   │       │   │
│   │       │   └── 📁 dashboard/
│   │       │       ├── 📄 KPICard.tsx         # Single stat card (e.g., "Present Today: 248")
│   │       │       └── 📄 AttendanceChart.tsx # Daily attendance bar chart component
│   │       │
│   │       ├── 📁 hooks/
│   │       │   ├── 📄 useAuth.ts              # Current session + user data
│   │       │   ├── 📄 useTenant.ts            # Active tenant context
│   │       │   └── 📄 useFaceEnroll.ts        # face-api.js loading, embedding extraction
│   │       │
│   │       ├── 📁 lib/
│   │       │   ├── 📄 supabase.ts             # Web Supabase browser client (re-exports package)
│   │       │   ├── 📄 face-api.ts             # face-api.js model loader utility
│   │       │   └── 📄 utils.ts                # Date helpers, currency formatters, etc.
│   │       │
│   │       └── 📁 middleware.ts               # Edge middleware: auth guard + tenant resolver
│   │
│   │
│   └── 📁 mobile/                         # ── PHASE 5: Expo React Native App ─────────
│       ├── 📄 package.json
│       ├── 📄 tsconfig.json
│       ├── 📄 app.json                    # Expo config: bundle ID, permissions, icons
│       ├── 📄 App.tsx                     # Root: Navigation container + auth check
│       ├── 📄 babel.config.js
│       ├── 📄 .env                        # EXPO_PUBLIC_SUPABASE_URL, ANON_KEY
│       │
│       ├── 📁 assets/
│       │   ├── 🖼️ icon.png
│       │   ├── 🖼️ splash.png
│       │   └── 📁 models/                 # Bundled TFLite / TF.js face model weights
│       │       └── 📄 face_model.json
│       │
│       └── 📁 src/
│           ├── 📁 navigation/
│           │   ├── 📄 RootNavigator.tsx   # Auth vs. App stack switcher
│           │   ├── 📄 AdminNavigator.tsx  # Admin tab: Scanner | Dashboard | Students
│           │   └── 📄 StudentNavigator.tsx# Student tab: Dashboard | Attendance | Fines
│           │
│           ├── 📁 screens/
│           │   ├── 📄 LoginScreen.tsx     # Email/password login screen
│           │   │
│           │   ├── 📁 admin/
│           │   │   ├── 📄 ScannerScreen.tsx      # Live camera gate scanner (edge AI)
│           │   │   ├── 📄 AdminDashboard.tsx     # Summary cards for today's session
│           │   │   └── 📄 StudentsListScreen.tsx # Browse + search enrolled students
│           │   │
│           │   └── 📁 student/
│           │       ├── 📄 StudentDashboard.tsx   # Attendance %, upcoming batch, fine summary
│           │       ├── 📄 AttendanceCalendar.tsx # Monthly calendar attendance view
│           │       └── 📄 FinesScreen.tsx        # Pending & paid fines list
│           │
│           ├── 📁 components/
│           │   ├── 📄 CameraScanner.tsx   # expo-camera + TF frame processor core
│           │   ├── 📄 MatchHUD.tsx        # Green/orange/red on-screen match overlay
│           │   ├── 📄 MatchLogList.tsx    # Scrollable list of recent check-ins
│           │   ├── 📄 AttendanceCard.tsx  # Student attendance summary card
│           │   └── 📄 FineCard.tsx        # Single fine entry with status badge
│           │
│           ├── 📁 hooks/
│           │   ├── 📄 useAuth.ts          # Expo auth session hook
│           │   ├── 📄 useCameraPermission.ts  # Camera permission request hook
│           │   └── 📄 useFaceEmbedding.ts     # TensorFlow model loader + embedding extractor
│           │
│           └── 📁 lib/
│               ├── 📄 supabase.ts         # Expo Supabase client
│               └── 📄 utils.ts            # Shared helpers (date formatting, etc.)
│
│
└── 📁 docs/                               # Developer documentation
    ├── 📄 SETUP.md                        # Local environment setup guide
    └── 📄 ARCHITECTURE.md                 # High-level architecture overview
```

---

## Phase-to-File Mapping Summary

| Phase | Scope | Key Files |
|:------|:------|:----------|
| **Phase 1** | Database & Migrations | `supabase/migrations/0001_*.sql`, `0002_*.sql`, `0003_*.sql` |
| **Phase 2** | Monorepo + Shared Packages | `package.json`, `turbo.json`, `packages/database/*`, `packages/common/*` |
| **Phase 3** | Serverless API Routes | `apps/web/src/app/api/v1/**` |
| **Phase 4** | Web Admin Portal | `apps/web/src/app/admin/**`, `components/**`, `hooks/**` |
| **Phase 5** | Mobile Expo App | `apps/mobile/src/**` |

---

## Deferred for Later Phases

The following will NOT be scaffolded during the current implementation:

| Module | Deferred Files |
|:-------|:--------------|
| **Payment Queue** | `api/v1/payments/`, `admin/payment-queue/`, `fine_payments` table |
| **Health Tracker** | `api/v1/sports-metrics/`, `admin/health/`, `sports_metrics` & `medical_reports` tables |
| **AI Insights** | `api/v1/ai/`, `admin/insights/`, `ai_progress_reports` table |
| **Notifications** | `api/v1/notifications/`, Twilio/Resend/WhatsApp integrations, `expo_push_token` usage |
