# Routing & Pages Documentation

Complete reference for all routes and pages in the Transcriber application.

## Route Hierarchy

```
/                                    → Marketing page
/login                              → Login page
/signup                             → Signup page
/app                                → App layout (protected)
├── /                               → Dashboard
├── subjects                        → Subjects list
├── subjects/:id                    → Subject detail
├── recordings/:id                  → Recording detail
├── record                          → New recording
└── settings                        → Settings
```

---

## Public Pages

### Marketing Page
**File:** `client/src/pages/marketing.tsx`  
**Route:** `/`  
**Access:** Public (no authentication required)

**Features:**
- Hero section with branding
- Feature showcase grid
- Call-to-action buttons for signup/login
- Responsive design with Tailwind CSS
- Theme-aware styling

**Key Components Used:**
- Button (primary/secondary variants)
- Theme variables for styling

---

### Login Page
**File:** `client/src/pages/login.tsx`  
**Route:** `/login`  
**Access:** Public (authenticated users redirected to dashboard)

**Features:**
- Email/password authentication form
- better-auth integration (signIn.email)
- Form validation with error display
- Loading states during submission
- Navigation to `/app` on success
- Link to signup page
- Remember session functionality

**Key Components Used:**
- Card
- Input
- Label
- Button
- Form validation

**State Management:**
- Email and password input state
- Loading state
- Error message state
- Session management via better-auth

---

### Signup Page
**File:** `client/src/pages/signup.tsx`  
**Route:** `/signup`  
**Access:** Public (authenticated users redirected to dashboard)

**Features:**
- User registration form (name, email, password)
- better-auth integration (signUp.email)
- Password validation (minimum 8 characters)
- Name validation (non-empty)
- Comprehensive error handling
- Loading states
- Navigation to `/app` on success
- Link to login page

**Key Components Used:**
- Card
- Input
- Label
- Button

**State Management:**
- Form field inputs (name, email, password)
- Loading state
- Error message state

---

## Protected Application Pages

All pages in `/app` require valid authentication session and are protected by route guards.

### App Layout (Shell)
**File:** `client/src/pages/app/layout.tsx`  
**Route:** `/app`  
**Access:** Protected (requires valid session)

**Features:**
- Session validation on mount
- Responsive sidebar navigation
- Mobile hamburger menu with overlay
- Navigation menu with active state highlighting
- User information display section
- Theme switcher integration
- Sign out functionality
- Main content outlet for nested routes
- Responsive design (mobile-first)

**Navigation Menu Items:**
- Dashboard (icon: LayoutDashboard)
- Subjects (icon: FolderOpen)
- Record (icon: Mic)
- Settings (icon: Settings)

**Key Components Used:**
- Sidebar navigation with links
- Mobile menu toggle
- Theme switcher component
- Button (sign out)
- useSession hook for auth validation

**State Management:**
- Menu open/closed state
- Session state
- Theme context

---

### Dashboard
**File:** `client/src/pages/app/dashboard.tsx`  
**Route:** `/app/`  
**Access:** Protected (requires valid session)

**Features:**
- Statistics cards showing:
  - Total subjects count
  - Total recordings count
  - Total transcriptions count
- Recent subjects list (last 3 items)
  - Click-through to detail pages
  - Subject name and description
- Recent recordings list (last 5 items)
  - Click-through to detail pages
  - Recording title, duration, file size
  - Transcription status indicator
- Empty states with call-to-action buttons
- Loading states
- Responsive grid layouts

**Database Queries:**
- Get count of subjects by userId
- Get count of recordings by userId
- Get count of transcriptions by userId
- Get recent subjects (limit 3, ordered by createdAt)
- Get recent recordings (limit 5, ordered by createdAt)

**Key Components Used:**
- Card
- Button
- Loading spinner (conditional)

---

### Subjects List
**File:** `client/src/pages/app/subjects.tsx`  
**Route:** `/app/subjects`  
**Access:** Protected (requires valid session)

**Features:**
- Grid view of all subjects
- Create new subject dialog
  - Subject name input
  - Subject description textarea
  - Form validation
  - Submit button
- Subject cards displaying:
  - Subject name
  - Subject description
  - Recording count
  - Last modified date
- Delete subject functionality
  - Confirmation dialog
  - Cascade delete (removes all recordings/transcriptions)
- Click-through to detail pages
- Empty state with illustration
- Real-time database integration
- Responsive grid (1-3 columns based on screen size)

**Database Operations:**
- Get all subjects by userId
- Insert new subject
- Delete subject with cascade
- Subscribe to real-time changes

**Key Components Used:**
- Card
- Button
- Input
- Dialog
- Textarea (custom)

**State Management:**
- Dialog open/closed state
- Form field inputs
- Subject list state
- Confirmation dialog state

---

### Subject Detail
**File:** `client/src/pages/app/subjects/[id].tsx`  
**Route:** `/app/subjects/:id`  
**Access:** Protected (requires valid session and subject ownership)

**Features:**
- Subject header displaying:
  - Subject name
  - Subject description
  - Recording count
  - Created/updated timestamps
- List of recordings for subject
  - Recording title
  - Duration
  - File size
  - Source (recorded/uploaded)
  - Transcription status
  - Created timestamp
- Delete recording functionality
  - Confirmation dialog
  - Removes associated transcriptions
- Click-through to recording detail pages
- Back navigation button
- Empty state with call-to-action
- Loading states

**Database Queries:**
- Get subject by ID and userId
- Get all recordings for subject
- Get transcription for each recording
- Subscribe to changes

**Key Components Used:**
- Card
- Button
- Back button
- Dialog (delete confirmation)

---

### Recording Detail
**File:** `client/src/pages/app/recordings/[id].tsx` (341 lines)  
**Route:** `/app/recordings/:id`  
**Access:** Protected (requires valid session and recording ownership)

**Features:**
- Recording metadata header
  - Title
  - Duration
  - File size
  - Source (recorded/uploaded)
  - Created timestamp

- Audio Player
  - Play/pause button
  - Seek bar with click-to-seek
  - Current time / total duration display
  - Volume control
  - Download button

- Transcription Interface
  - Start transcription button (if not transcribed)
  - Progress bar with status messages
  - Transcription text display
  - Segments view with timestamps
  - Model used metadata
  - Language detected
  - Copy to clipboard button

- Recording Management
  - Download recording button
  - Delete recording with confirmation

- Error Handling
  - User-friendly error messages
  - Detailed console logging

**Database Operations:**
- Get recording by ID and userId
- Get transcription for recording
- Update transcription on complete
- Delete recording

**External Services:**
- Audio blob retrieval from IndexedDB
- Whisper transcription via Web Worker
- Audio playback via Web Audio API

**Key Components Used:**
- Card
- Button
- Progress bar
- Dialog (delete confirmation)
- Audio element (custom player)

**State Management:**
- Recording data
- Transcription state
- Audio playback state
- Progress state
- Error state
- Loading state

---

### New Recording Page
**File:** `client/src/pages/app/record.tsx` (775 lines)  
**Route:** `/app/record`  
**Access:** Protected (requires valid session)

**Features:**

#### Recording Mode
- MediaRecorder API integration
- Microphone permission handling
- Real-time audio visualizer
  - 40-bar frequency waveform
  - Smooth animations
  - Responsive sizing
- Timer display (HH:MM:SS)
- Recording controls
  - Start button
  - Stop button
  - Pause/resume toggle
- 2-hour auto-stop limit with warnings
- Audio analyzer with frequency data
- Real-time transcription toggle (experimental)
- Stream cleanup on unmount

#### Upload Mode
- Drag-and-drop area
  - Visual feedback on hover
  - Click to select files
- File validation
  - Supported formats: MP3, WAV, M4A, OGG, FLAC, WebM
  - File size limit: 500MB
- Audio duration extraction
  - Timeout protection (5 seconds)
  - Error handling for corrupt files
- File metadata display
- Automatic title suggestion from filename
- File preview before save

#### Common Features
- Subject selection dropdown
  - Load from IndexedDB
  - Create new subject inline
- Optional title field
  - Auto-populated for uploads
  - Customizable for recordings
- Source tracking (recorded/uploaded)
- Save to IndexedDB
- Navigate to recording detail on save
- Comprehensive error handling

**Database Operations:**
- Get all subjects by userId
- Insert new recording
- Insert associated transcription data
- Subscribe to subject changes

**Web APIs Used:**
- MediaRecorder
- getUserMedia
- Web Audio API
- AudioContext
- Blob API

**Key Components Used:**
- Button
- Input
- Dialog (for errors/confirmation)
- Select (custom dropdown)

**State Management:**
- Recording state (active, paused, inactive)
- Audio stream state
- Visualizer state
- Timer state
- Upload file state
- Subject list state
- Form field inputs
- Loading/error states

---

### Settings Page
**File:** `client/src/pages/app/settings.tsx`  
**Route:** `/app/settings`  
**Access:** Protected (requires valid session)

**Features:**
- Whisper model selection
  - tiny.en (~40MB, fastest)
  - base.en (~75MB, recommended)
  - small.en (~250MB, most accurate)
  - Model descriptions
  - Estimated download times
  - Storage recommendations
- Theme preset selector
  - 11 theme options
  - Preview thumbnails
  - Theme descriptions
- Light/Dark/System mode toggle
- How-it-works documentation section
  - Performance expectations
  - Offline capabilities
  - Privacy guarantees
- Model recommendations by use case
- localStorage persistence
- Responsive design

**Database Operations:**
- localStorage for preferences (no IndexedDB queries)
- Preference keys:
  - `whisper-preferred-model`
  - `theme-preset`
  - `theme-mode`

**Key Components Used:**
- Card
- Button (radio buttons for selection)
- Select (dropdown)
- Tooltip (optional)

**State Management:**
- Selected model state
- Selected theme state
- Selected theme mode state
- Saving state

---

## Route Protection

All routes in `/app/*` are protected with session validation:

```typescript
// Session check on app layout mount
const session = await authClient.getSession()
if (!session) {
  // Redirect to login
}
```

---

## Navigation Patterns

### From Public to Protected
- `/` or `/login` → Sign in → `/app` (dashboard)
- `/signup` → Register → `/app` (dashboard)

### Within Protected App
- Dashboard → Click subject → Subject detail
- Subject detail → Click recording → Recording detail
- Recording detail → Back → Subject detail
- Dashboard → Click record → New recording page
- New recording page → Save → Recording detail

### Direct Route Access
- Users can navigate directly to any protected route
- If session invalid, redirected to `/login`

---

## Error Handling

### Page-Level Errors
- Session not found → Redirect to login
- Recording not found → Show error message
- Subject not found → Show error message

### Form Validation Errors
- Empty fields → Show field-specific errors
- Invalid email → Show format error
- Password too short → Show requirement error

### API Errors
- Failed to load data → Show user-friendly message
- Failed to save data → Show user-friendly message
- Network errors → Show connection error

---

## Performance Considerations

- Dashboard queries limited to recent items (3-5)
- Lazy loading of recording details (audio blob)
- Transcription in Web Worker (non-blocking UI)
- Real-time visualization throttling
- List virtualization for large datasets (future)

---

## Accessibility Notes

- Semantic HTML (nav, section, article)
- ARIA labels on interactive elements
- Keyboard navigation support
- Focus indicators on buttons and inputs
- Color contrast compliance
- Form validation with accessible error messages

