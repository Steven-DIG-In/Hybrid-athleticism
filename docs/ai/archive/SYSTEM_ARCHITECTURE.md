# SYSTEM ARCHITECTURE

*(Note: Agents should update this file as the exact tech stack is solidified during the rebuild.)*

## 1. Frontend
- **Framework:** Next.js (App Router recommended for optimal server/client component splitting).
- **Styling/UI:** Tailwind CSS, utilizing strict custom configuration to adhere to the `DESIGN_SYSTEM.md`. Heavy use of CSS variables for theming (Dark/Light mode, accents).
- **Animations:** Framer Motion or custom Canvas animations for high-end scroll and micro-interactions.
- **Data Viz:** High-end charting libraries (e.g., Recharts, Nivo, Visx).

## 2. Backend & Database
- **Database:** Supabase (PostgreSQL) - utilized for robust relational data mapping (Users -> Workouts -> Sets -> Exercises -> Volume Analytics).
- **Authentication:** Supabase Auth for seamless user login.
- **API/Server Actions:** Next.js Server Actions for tight frontend/backend communication.

## 3. The AI Integration Layer
- **LLM Provider:** Anthropic API (Claude 3.5 Sonnet / Opus depending on task complexity).
- **Agentic Coaching Logic:** 
  - The server runs scheduled cron jobs or edge functions at the end of a user's week to pull all workout data from Supabase.
  - This structured JSON payload is sent to the Anthropic API with a strict system prompt (The "Coach").
  - The Coach returns structured JSON (or function calls) mutating the database records for the next week's prescribed volume/RIR.

## 4. Repository Structure (Suggested)
- `/src/app` - Next.js routing and UI.
- `/src/components` - Reusable UI components built with Stitch adhering to premium design.
- `/src/lib/ai` - Wrapping logic for the Anthropic Coach integration.
- `/src/lib/services` - Database interaction layer.
- `/docs/ai` - This folder, entirely governing AI agent behavior.
