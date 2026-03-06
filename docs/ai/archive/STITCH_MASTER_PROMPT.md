# STITCH LOOP: MASTER DESIGN & APP BUILD PROMPT

## Context & Vision
You are tasked with the end-to-end UI/UX design and component generation for a fundamentally new fitness software platform: **Project Apex** (working title for a hybrid-athleticism app).

This is NOT a standard, cheerful SaaS platform. This is a premium, data-driven, hyper-focused tool for elite fitness enthusiasts who "train for life." The design must feel like a luxury Swiss watch, but grounded in the awe of extreme nature—expansive horizons and misty canyons. When these users stare into a bottomless pit, they don't retreat; they ask for their rope.

**The Aesthetic:**
- **Theme:** "Atmospheric Obsidian & Chrome." Deep, flawless dark modes using charcoal/onyx backgrounds that fade into subtle, atmospheric textures (like midnight fog or dark, rugged rock formations). This is contrasted by high-fidelity silver/metallic borders and sharp, neon accents (Cyan/Blue) for data visualization.
- **Typography:** Editorial, architectural, and striking. Use oversized, high-contrast Serif or distinct geometric Sans-serif fonts for headers. 
- **UX Feel:** High tension, vast, and immersive. Use aggressive negative space to represent "expansive horizons." Every interaction should feel heavy and intentional. Use subtle, deeply nested shadows and ultra-thin borders. 

---

## 🏗️ The Application Architecture
You will be generating the components for this platform iteratively using the Stitch Loop. Below is the exact architecture of the pages you must build.

### 1. The Marketing & Landing Experience (The Hook)
*The goal here is immediate awe. It must visually communicate "This is the most advanced training tool for traversing the extremes."*
- **Hero Section:** Expansive, dark, atmospheric. A massive, striking headline. The background must feature beautiful, dark, misty nature photography or 3D art (e.g., a foggy canyon abyss or an expansive, dark mountain horizon). A single, glowing "Begin Protocol" primary CTA.
- **The Engine Overview (Features):** A horizontally scrolling or sticky-scroll section highlighting the 3 core pillars: 
    1. Dynamic Hypertrophy Programming
    2. Endurance & Conditioning Integration
    3. The AI Backend Coach. Use sleek isometric mockups of the in-app charts hovering over dark, rugged terrain textures.
- **The Data Promise (Social Proof / Credibility):** Minimalist grid displaying "X Million Tonnages Moved" or "Powered by Anthropic." Use stark typography and glowing metric counters.

### 2. The Onboarding Flow (The "Calibration Protocol")
*We are not "signing up." We are calibrating the engine.*
- **Step 1: Bio-Metrics:** A beautiful, centered form. Large input fields with floating labels for Height, Weight, Age, and Training Age.
- **Step 2: Equipment Grid:** A highly visual, multi-select grid of high-fidelity icons (Barbell, Dumbbells, Cables, Rowers). When selected, the icons glow with the brand's neon accent.
- **Step 3: The Benchmark Commitment:** A sleek loading/processing screen that says "Constructing your 7-Day Benchmark Protocol..." with a sophisticated indeterminate progress bar.

### 3. The Core App: The Dashboard ("The Command Center")
*This is the user's home base. It must be data-dense but impeccably clean.*
- **The Top-Level HUD (Heads Up Display):** A horizontal strip at the top showing current week, fatigue status (e.g., a glowing indicator from green to red based on RPE accumulation), and the next scheduled session.
- **The "Today" Card:** The focal point. A large, beautifully styled card detailing today's exact workout. It should not look like a to-do list; it should look like a tactical brief.
- **The Tonnage & Volume Graph:** A stunning, interactive area chart (using Recharts or similar aesthetic) showing this week's volume landmarks (sets per muscle group) vs. MRV (Maximum Recoverable Volume).

### 4. The Core App: The Active Workout Interface
*This must be usable while sweating, with a shaking hand. High contrast, large hit areas.*
- **Current Exercise View:** Massive typography displaying the current lift (e.g., "BACK SQUAT"). 
- **The Output Grid:** A tightly packed table for Set 1, Set 2, Set 3. Large input fields for Reps and Weight.
- **The RIR / RPE Slider:** A custom, tactile-looking slider to rate the difficulty of the set immediately after completing it. It should visually "snap" and change color (e.g., from cool blue at RIR 3 to deep orange at RIR 0/Failure).

### 5. The Core App: The Weekly Review (The AI Coach Report)
*This is where the Anthropic API drops its insights.*
- **The Analyst View:** An editorial-style layout. A large blockquote style component where the AI Coach provides its text synthesis: *"Your pushing volume has outpaced your recovery. RIR dropped by 2 points on sets 3 & 4 of DB Press. For the next microcycle, we are stripping 2 working sets from your Chest allocation."*
- **Before & After Visualizer:** A sleek, glowing diff-chart showing the changes made to the upcoming week's program based on the AI's analysis.

---

## 🛠️ Execution Rules for Stitch
When I ask you to build one of these sections, follow these absolute constraints:
1. **Never use standard Tailwind utility aesthetics.** If you build a card, do not just use `bg-white shadow-md rounded-lg`. Use `bg-[#0c0c0c] border border-[var(--metallic-silver)] shadow-[inset_0_1px_0_rgba(255,255,255,0.1)]`.
2. **Prioritize layout tension.** Use negative space aggressively to draw the eye to the data that matters most.
3. **Assume dark mode is the only mode.**
4. **Interactive by default.** Every button, row, and input must have a distinct, luxurious hover/focus state.

**Start the loop: Whenever you are ready, ask me which of the 5 architectural sections we are building first.**
