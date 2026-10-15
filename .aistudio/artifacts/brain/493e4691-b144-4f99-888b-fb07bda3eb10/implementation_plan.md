# BeamDrop Extension: Persistent Side Panel, Camera Permission Bridge & WebRTC P2P Architecture

This plan establishes a rock-solid, production-grade foundation for the BeamDrop Manifest V3 Chrome Extension and Web App, solving the classic pitfalls of popup lifecycles, camera permissions, and QR capacity limits.

---

## User Review & Critical Decisions

> [!IMPORTANT]
> The architectural directions below were confirmed in Phase 1 clarification:
> - **Extension Presentation**: Full Chrome Side Panel (`chrome.sidePanel`) integration with `openPanelOnActionClick: true` so the extension remains permanently open during file drag-and-drop, connection negotiation, and continuous transfers.
> - **Camera Permissions**: Zero-crash permission management using `navigator.permissions` and an automated helper tab flow for first-time camera grants to avoid popup dismissal.
> - **Data Protocol**: QR codes strictly carry WebRTC signaling metadata (Peer ID, session token, room nonce), while all file, media, and text payload streaming occurs over high-speed WebRTC DataChannels.

- **Confirmed Decision 1**: **Side Panel as Primary Extension Mode** — Replaces fragile popup teardowns with a persistent side panel workflow, while preserving an optional popout window button for multi-monitor setups.
- **Confirmed Decision 2**: **Deterministic Camera Permission Bridge** — Dedicated camera permission check in `popup.js`/`options.js` that launches an approval tab if ungranted, storing the permanent extension origin grant.
- **Confirmed Decision 3**: **Signaling-Only QR with RAM-to-RAM WebRTC Streaming** — Eliminates QR payload limits by streaming up to 512KB chunks directly over WebRTC DataChannels with adaptive backpressure.

---

## 1. Overview & Core Concept

- **What It Does**: BeamDrop bridges desktop browsers and mobile devices via zero-cloud, peer-to-peer WebRTC data channels. Users open the BeamDrop Side Panel, present or scan a signaling QR code, and instantly transfer multi-gigabyte files, folders, screenshots, and live clipboard text directly in RAM without third-party cloud servers.
- **Target Audience / Persona**: Power users, developers, photographers, and mobile-to-PC workers who need instant cross-device transfers between Chrome/Brave/Edge and iOS/Android without logging in, installing desktop drivers, or uploading sensitive files to cloud drives.
- **Key Value**: 
  - **Zero Connection Drop**: Side Panel stays alive across browser navigation, tab switches, and file drag operations.
  - **Zero QR Bloat**: QR codes stay compact, high-contrast, and instantly scannable on any camera resolution.
  - **Zero Permission Frustration**: First-time camera access requests never abort or freeze the extension.

---

## 2. User Experience & Visual Design

### Key User Flows
1. **Side Panel Launch**: Clicking the BeamDrop icon in the browser toolbar smoothly opens the Chrome Side Panel adjacent to active web content.
2. **Device Pairing**:
   - **Send Mode**: User drops files or pastes text; a crisp, high-contrast QR code renders alongside a 1-tap copy link and nearby radar beacons.
   - **Receive Mode**: User toggles to "Receive Vault"; the camera QR scanner or persistent incoming address is displayed.
3. **Camera Permission Granting**:
   - When the user selects camera scanning, the extension checks permission state.
   - If unprompted, an instant one-click permission modal prompts the user or opens `options.html#camera-grant` in a clean tab to approve camera access permanently for the extension origin.
   - The scanner initializes instantly with smooth framing guides and no UI flickers.
4. **Transfer Progress & Vault**:
   - Live transfer velocity (MB/s), ETA countdown, and animated progress fill appear in real-time.
   - Received items automatically write to the chosen directory via File System Access API or trigger direct downloads.

### Visual Identity & Theme
- **Aesthetic Direction**: Contemporary Liquid Glass Sky Blue Light theme with crisp physical borders, subtle frosted glass translucency, and anti-slop typography.
- **Color Palette**:
  - Neutral Canvas: `#F0F9FF` to `#E0F2FE` subtle atmospheric gradient.
  - Structural Surfaces: Pure white `#FFFFFF` with hairline borders (`#BAE6FD` / `rgba(2, 132, 199, 0.15)`).
  - Primary Accent: Precision Electric Sky Blue (`#0284C7` / `#0EA5E9`).
  - Semantic Status: Emerald `#16A34A` (connected / complete), Amber `#D97706` (signaling), Crimson `#DC2626` (interrupted).
- **Typography & Tabular Discipline**:
  - Primary Display & Headings: `Plus Jakarta Sans` or modern neo-grotesque system stack.
  - Data, Telemetry & Speed Counters: Monospace tabular numerals (`font-mono tabular-nums`) to ensure zero visual jitter during streaming.
- **Anti-Slop Restraint**: Zero decorative pulsing dots, zero fake innovation scores, zero nested card sandwiches, and zero pill-box tags on static metadata.

---

## 3. Key Product Decisions & Trade-Offs

### Decision 1: Chrome Side Panel (`chrome.sidePanel`) over Standard Popup
- **Chosen Approach**: Configure `chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true })` in `background.js` and designate `popup.html` as the default side panel view in `manifest.json`.
- **Why**: Standard MV3 popups close immediately whenever the user drags a file from outside the browser or clicks another window, terminating in-flight WebRTC connections. The Side Panel persists indefinitely.
- **Trade-Off**: Side panels occupy ~360px–420px of lateral screen space, requiring responsive, compact layout design.

### Decision 2: Permission Bridge Tab vs. Inline getUserMedia
- **Chosen Approach**: Test `navigator.permissions.query({ name: 'camera' })`. If status is `prompt` or `denied`, open a dedicated, focused permission helper tab (`options.html?grant=camera`) that safely requests camera access and immediately redirects back to the panel.
- **Why**: Manifest V3 extension popups and side panels frequently fail when rendering system dialogs over the active web page. An explicit tab grant is 100% reliable and permanent across browser sessions.

### Decision 3: WebRTC Chunk Sizing & Backpressure Management
- **Chosen Approach**: Dynamic adaptive chunking (64KB baseline up to 512KB for local high-speed LAN) with `bufferedAmountLowThreshold` throttling.
- **Why**: Pushing multi-gigabyte binary files into WebRTC `RTCDataChannel` without backpressure monitoring exhausts browser buffer memory and crashes the tab. Adaptive backpressure keeps transfers at maximum wire speed.

---

## 4. Technical Architecture & Data Strategy

### System Architecture Diagram

```
┌────────────────────────────────────────────────────────────────────────┐
│                        BEAMDROP MV3 ARCHITECTURE                       │
└────────────────────────────────────────────────────────────────────────┘
                                    │
           ┌────────────────────────┴────────────────────────┐
           ▼                                                 ▼
┌──────────────────────────────────────┐  ┌──────────────────────────────────────┐
│       BACKGROUND SERVICE WORKER      │  │         PERSISTENT SIDE PANEL        │
│  - chrome.sidePanel.setPanelBehavior │  │  - Full-height UI (popup.html)       │
│  - Context menu beam triggers        │  │  - WebRTC DataChannel engine         │
│  - Clipboard sync listener           │  │  - Camera QR scanner & canvas reader │
│  - Alarm-driven OTA update checker   │  │  - Staging area & File drop target   │
└──────────────────────────────────────┘  └──────────────────────────────────────┘
           │                                                 │
           │                                                 │ WebRTC Signaling
           ▼                                                 ▼ (PeerJS / STUN / TURN)
┌──────────────────────────────────────┐  ┌──────────────────────────────────────┐
│       CAMERA PERMISSION BRIDGE       │  │           PEER CONNECTION            │
│  - options.html / permission tab     │  │  - Micro QR code (< 200 bytes)       │
│  - navigator.mediaDevices grant      │  │  - Direct RAM-to-RAM DataChannel     │
│  - Permanent origin authorization    │  │  - Adaptive chunk stream (64k-512k)  │
└──────────────────────────────────────┘  └──────────────────────────────────────┘
```

### Component & File Implementation Blueprint

1. **`extension/manifest.json` & `public/extension/manifest.json`**:
   - Ensure `"side_panel": { "default_path": "popup.html" }` and `"permissions": [..., "sidePanel"]` are declared.
   - Configure `"action"` to support side panel triggering.
2. **`extension/background.js` & `public/extension/background.js`**:
   - Register `chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true })` on install and runtime startup.
   - Support messaging to open side panel or fallback popup.
3. **`extension/popup.js` & `public/extension/popup.js`**:
   - Detect whether running inside `chrome.sidePanel` or floating popup.
   - Implement Camera Permission Helper:
     - Check `navigator.permissions.query({ name: 'camera' })`.
     - Provide direct button "Enable Camera Access" that opens helper if permission is missing.
   - Optimize WebRTC signaling QR generation:
     - Keep QR payload minimal (Peer ID + nonce).
     - Wire QR camera scanner to html5-qrcode / jsQR with throttled frame extraction to preserve CPU.
4. **`extension/options.html` & `extension/options.js`**:
   - Add explicit Camera Permission granting card with real-time permission status indicator.
5. **Sync & Packaging (`scripts/pack-extension.cjs`)**:
   - Mirror all enhancements into `public/extension/` and repackage `public/extension.zip`.

---

## 5. Verification Plan

### Automated Verification
- Run `npm run lint` (`tsc --noEmit`) to verify zero TypeScript errors.
- Run `compile_applet` to verify the frontend and server bundles build cleanly.
- Validate JSON syntax in `manifest.json`.

### Manual & Behavioral Verification Scenarios
1. **Side Panel Activation**:
   - Click extension action icon; verify Side Panel opens directly without popup dismissals.
   - Click outside the panel on web pages; verify the Side Panel stays open and transfer continues.
2. **Camera Permission Flow**:
   - Click Camera Scan mode in receiver vault.
   - Verify permission state check cleanly prompts or opens the permission tab without throwing unhandled exceptions.
   - Verify scanner starts video feed and decodes test QR codes accurately.
3. **WebRTC P2P Data Streaming**:
   - Generate transfer QR with staged files; verify QR size remains minimal and legible.
   - Connect receiver via QR scan; verify DataChannel opens and streams payload with live progress meters.
