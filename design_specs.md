# UI/UX Design Specification: PengAgent Monorepo

## 1. Color Palette & Typography (Shared)
*   **Primary Brand:** `#007AFF` (Vibrant Blue for Primary Buttons, Active States, User Chat Bubbles).
*   **Background (Light Mode):** `#F5F5F5` (App Background), `#FFFFFF` (Card/Container/Bubble Backgrounds).
*   **Text (Primary):** `#333333` (Standard Body Text).
*   **Text (Secondary/Muted):** `#666666` or `#888888` (Timestamps, placeholders, inactive icons).
*   **Borders/Dividers:** `#E0E0E0` (Subtle line separations).
*   **Typography:** System Sans-Serif (Inter on Web, San Francisco on iOS, Roboto on Android).

---

## 2. Mobile App Design (React Native / Android)

### Frame 1: Chat Screen (Main View)
*   **Top App Bar (Header):**
    *   Height: 50px, Background: `#FFFFFF`, Bottom Border: 1px `#E0E0E0`.
    *   Center: "Chat" (Bold, 18px).
    *   Right: Memory Toggle Button (Soft Blue background `#e3f2fd`, Blue Text `#007AFF`, "🧠 Memory").
*   **Body (FlatList/ScrollView):**
    *   Background: `#f5f5f5`.
    *   *AI Message:* Left-aligned bubble. Background: `#FFFFFF`, Border: 1px `#E0E0E0`. Text is rich markdown (formatted code blocks, lists).
    *   *User Message:* Right-aligned bubble. Background: `#007AFF`. Text: `#FFFFFF`.
*   **Memory Overlay (Popup):**
    *   Position: Absolute, Top Right (just below header). Width: 250px.
    *   Background: `#FFFFFF`, Drop Shadow (Elevation 5). Rounded corners (10px).
    *   Content: Title "Memory Page" and a scrollable list of long-term context facts.
*   **Bottom Input Area (Keyboard Avoiding):**
    *   Background: `#FFFFFF`, Top Border: 1px `#E0E0E0`. Padding: 10px.
    *   Input Field: Rounded pill shape (20px radius), Background `#f0f0f0`, auto-expanding height.
    *   Send Button: To the right of the input, pill-shaped button, Background `#007AFF`, Text "Send" (White).

### Frame 2: Bottom Tab Navigation
*   **Container:** Height: 60px, Background: `#FFFFFF`, Border Top: 1px `#E0E0E0`.
*   **Left Tab (Models/Memory):** Icon `M/M`. Pressing triggers the "Models" bottom sheet modal.
*   **Center Tab (Chat):** Prominent Circle floating slightly above the bar. 60x60px. Background `#007AFF`, Drop Shadow. Center Icon `C` in white.
*   **Right Tab (Tools/Profile):** Icon `T/P`. Pressing triggers the "User Profile" bottom sheet modal.

### Frame 3: Modal / Bottom Sheets (Models, RAG, User Profile)
*   **Overlay:** Semi-transparent black background (`rgba(0,0,0,0.5)`).
*   **Sheet Container:** Positioned at the bottom of the screen, extending up 70% of the screen height. Background `#FFFFFF`, Top Left/Right Radius 20px. Drop Shadow.
*   **Sheet Header:** Title on left (e.g. "Models"), Close 'X' button on the right (`#007AFF`).
*   **Sheet Body:** Scrollable list of options (e.g., Radio buttons for Model Selection, File upload buttons for RAG, Input fields for User API keys).

---

## 3. Web App Design (React / Desktop)

### Frame 1: Desktop Chat Layout (Split Pane)
*   **Left Sidebar (Navigation & Tools):**
    *   Width: 250px. Background: `#FFFFFF`, Right Border: 1px `#E0E0E0`.
    *   Top: Branding / Logo.
    *   Middle: Navigation Links (Chat, Models, RAG).
    *   Bottom: User Profile summary and settings gear.
*   **Center Content (Chat Window):**
    *   Flexible Width. Background: `#f5f5f5`.
    *   Header: Current Model Indicator and "Clear Chat" button.
    *   Chat Stream: Auto-scrolling list. Messages have similar bubble styling to mobile, but max-width is constrained to ~800px for readability on large screens. Code syntax highlighting uses `react-syntax-highlighter` (vscDarkPlus theme).
    *   Input Box: Centered at the bottom, max-width 800px. Includes attachment icon (paperclip) for RAG document drops.
*   **Right Sidebar (Memory & Context - Collapsible):**
    *   Width: 300px. Background: `#FFFFFF`, Left Border: 1px `#E0E0E0`.
    *   Title: "Active Memory".
    *   Content: Displays summarized JSON entities from the SQL database representing the agent's long-term memory of the user.

### Frame 2: Authentication / Login
*   **Container:** Full viewport height, centered content. Background: `#f5f5f5`.
*   **Login Card:** 400px wide, Background `#FFFFFF`, Drop shadow.
*   **Content:** Title "Login to PengAgent", Username/Password input fields, Login Button (`#007AFF`), "Sign Up" secondary link.