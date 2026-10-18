# AI Face Attendance UX Improvements Plan

## Current State Analysis

### Already Implemented (Good Foundation)
- ✅ Stepper UI (3 steps: Chọn thao tác → Quét & xác minh → Kết quả)
- ✅ Camera capture with quality gate (brightness, blur, size)
- ✅ Camera permission handling (denied, unavailable, error states)
- ✅ Face quality analysis (brightness, blur, size)
- ✅ Demo banner for mock provider
- ✅ Liveness check integration (via provider)
- ✅ Verification workflow (liveness → verify 1:1 → record)
- ✅ Fallback PIN with reason
- ✅ Idempotency key for duplicate prevention
- ✅ Error states with retry options
- ✅ Result display with server time, shift info, status
- ✅ Mock provider fixtures (good, blurry, no-match, liveness-fail)
- ✅ Rate limiting
- ✅ Audit logging
- ✅ Mobile responsive (bottom bar, camera preview)

### Missing / Needs Improvement

| Area | Current | Required |
|------|---------|----------|
| **Header** | Simple "Chấm công" | "Chấm công AI" + current time + date + shift |
| **Camera States** | idle/requesting/ready/denied/unavailable/error | + detecting face, no face, multiple faces, face off-center, poor lighting, liveness checking, matching, saving |
| **Face Guide** | Simple oval overlay | Better visual guide with alignment indicators, lighting tips |
| **Verifying State** | Simple spinner | Progress steps: detecting → liveness → matching → saving |
| **Success State** | Basic card | Rich receipt with employee name/code, time, shift, status, event ID |
| **Failure States** | Generic error cards | Specific guidance per error type |
| **Face Detection Feedback** | None | Real-time feedback: face detected, centered, good lighting |
| **Multiple Faces Warning** | None | Warning when multiple faces detected |
| **Face Off-Center Guidance** | None | Visual arrows to center face |
| **Lighting Guidance** | Basic text | Visual indicators for too dark/too bright |
| **Liveness Progress** | None | Step indicator for liveness checks |
| **Mobile Camera** | Basic | Full-screen preview, large buttons, handle orientation |
| **Privacy Notice** | Demo banner only | Clear privacy notice, data handling info |
| **Accessibility** | Basic | Screen reader support, keyboard nav, focus management |

## Implementation Plan

### Phase 1: Core Camera Experience Enhancement
1. **Enhance CameraCapture component** with granular states
2. **Add FaceDetector** (using face-api.js or similar lightweight lib) for real-time face detection feedback
3. **Create FaceGuideOverlay** component with alignment indicators
4. **Add CameraStateManager** for granular state management

### Phase 2: Check-in Flow Enhancement
1. **Redesign CheckInFlow** with improved header (time, date, shift)
2. **Enhance Verifying State** with progress steps
2. **Improve Success State** - rich receipt with all details
3. **Enhance Failure States** - specific guidance per error
4. **Add Face Detection Feedback** in real-time

### Phase 3: Mobile & Accessibility
1. **Mobile Camera Fullscreen** mode
2. **Large Touch Targets** for buttons
3. **Screen Reader Support** (ARIA labels, live regions)
4. **Focus Management** between steps

### Phase 4: Privacy & Polish
1. **Privacy Notice** component
2. **Demo/Production Mode Indicators**
3. **Camera Stream Cleanup** verification
4. **Documentation Updates**

## Technical Approach

### Face Detection (Client-side)
- Use `@vladmandic/face-api` or `face-api.js` (lightweight, ~100KB gzipped)
- Run detection at ~10fps to avoid performance issues
- Only for UI feedback - NOT for verification (that's server-side)

### State Management
- Use a state machine approach for camera states
- Clear transitions between states
- Proper cleanup on unmount

### Components to Create/Modify

**New Components:**
1. `FaceGuideOverlay` - Visual face alignment guide
2. `FaceDetectionFeedback` - Real-time face detection status
3. `CameraProgressIndicator` - Progress during verification
4. `AttendanceReceipt` - Rich success receipt
5. `PrivacyNotice` - Privacy information component

**Modify Existing:**
1. `CameraCapture` - Enhanced states, face detection integration
2. `CheckInFlow` - Better header, progress, success/failure states
3. `CheckInPage` - Improved header with time/date/shift

## Test Scenarios to Cover

### Camera States
- [ ] Camera denied
- [ ] No camera available
- [ ] Camera permission granted
- [ ] Face detected & centered
- [ ] Face off-center (left/right/up/down)
- [ ] Face too close/far
- [ ] Multiple faces detected
- [ ] No face detected
- [ ] Poor lighting (too dark/bright)
- [ ] Blurry image
- [ ] Liveness check in progress
- [ ] Liveness passed/failed
- [ ] Face matching in progress
- [ ] Face matched/failed
- [ ] Saving to server
- [ ] Success
- [ ] Failure with retry

### Error Scenarios
- [ ] Camera permission denied
- [ ] No camera hardware
- [ ] No face enrolled
- [ ] No active shift
- [ ] Already checked in/out
- [ ] Face not matched
- [ ] Liveness failed
- [ ] Provider timeout/unavailable
- [ ] Network error
- [ ] Server error
- [ ] Duplicate submission

### Mobile Specific
- [ ] Portrait orientation camera preview
- [ ] Large touch targets
- [ ] Bottom sheet for fallback
- [ ] Handle orientation change
- [ ] Insecure origin handling (HTTPS requirement)

## Files to Modify/Create

### New Files
```
src/components/face-attendance/
├── FaceGuideOverlay.tsx          # Visual face alignment guide
├── FaceDetectionFeedback.tsx     # Real-time detection status
├── CameraProgressIndicator.tsx   # Verification progress
├── AttendanceReceipt.tsx         # Rich success receipt
├── PrivacyNotice.tsx             # Privacy notice component
├── FaceDetectionProvider.tsx     # Face detection context
└── index.ts                      # Exports
```

### Modified Files
```
src/features/attendance/checkin-flow.tsx    # Enhanced flow
src/app/(protected)/check-in/page.tsx       # Better header
src/features/face-enrollment/camera-capture.tsx  # Enhanced states + face detection
src/components/ui/icon.tsx                  # Additional icons if needed
```

### Test Files
```
tests/face-attendance/
├── checkin-flow.test.tsx           # Flow tests
├── camera-capture.test.tsx         # Camera state tests
├── face-detection.test.tsx         # Face detection tests
├── e2e-checkin.spec.ts             # Playwright E2E tests
```

## Dependencies to Add
```json
{
  "@vladmandic/face-api": "^1.7.15"
}
```

## Configuration
- Face detection runs at ~10fps (100ms interval)
- Only runs when camera is ready and not verifying
- Disabled during verification/saving states
- Cleanup on unmount
- Works on mobile (portrait/landscape)

## Privacy & Security
- Face detection runs entirely client-side
- No face images sent to analytics
- Raw frames never logged
- Camera stream stopped on unmount
- Mock provider clearly labeled
- Privacy notice shown on first visit