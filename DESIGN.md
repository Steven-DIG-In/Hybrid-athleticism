# DESIGN SYSTEM: The Arctic Observatory

## 1. Vision
**The Arctic Observatory** is a high-end, atmospheric design concept for the Hybrid Athleticism platform. It combines the raw, uncompromising awe of extreme nature (misty canyons, vast horizons) with the clinical precision of high-end mechanical instrumentation (Audemars Piguet, Superlist).

## 2. Atmospheric Principles
- **Vast & Deep:** Backgrounds must feel like an endless night sky or a misty canyon. Avoid flat colors.
- **Organic Movement:** Incorporate slow-moving, subtle "mist" layers (radial glows) to create environmental depth.
- **Precision Glass:** Use heavy backdrop blurs (20px+) and ultra-thin borders (0.5px) to simulate high-end instrumentation panels.

## 3. Color Palette (Arctic)
- **Primary Background:** `#010101` (Deep Obsidian)
- **Primary Accent:** `#0DB9F2` (Arctic Cyan) - Used for active protocols, calibration status, and primary CTAs.
- **Secondary Accent:** `#00FF94` (Performance Neon Green) - Used for positive data deltas and recovery peaks.
- **Text Primary:** `#FFFFFF` (Pure White) - For high-contrast headers.
- **Text Secondary:** `#888888` (Slate Gray) - For metadata and descriptions.
- **Borders:** `rgba(255, 255, 255, 0.1)` - Ultra-thin (0.5px).

## 4. Typography
- **Headlines:** 'Plus Jakarta Sans' or 'Outfit'. Use Light (200) for elegance and SemiBold (600) for impact. Wide tracking (-0.02em).
- **Technical/Data:** 'JetBrains Mono'. Used for status badges, protocol codes, and numerical instrumentation.
- **Body:** 'Inter' for data-dense readability.

## 5. UI Components
- **Calibration Badges:** Monospace status tags with subtle borders and "pulse" animations.
- **Instrumentation Cards:** Glassmorphic panels with sharp corners and impeccable spacing.
- **Atmospheric Charts:** High-contrast, glowing charts in Arctic Cyan and Neon Green.

## 6. Design System Notes for Stitch Generation (REQUIRED)
Copy the following block into your Stitch prompts to ensure consistency:

```markdown
**DESIGN SYSTEM (REQUIRED):**
- Platform: Web, Desktop-first
- Theme: Dark, High-End Gloss, Atmospheric Depth
- Background: Deep Obsidian (#010101) with subtle fractal noise grain (opacity 0.04)
- Primary Accent: Arctic Cyan (#0DB9F2) for status and primary CTAs
- Secondary Accent: Performance Neon Green (#00FF94) for data peaks
- Typography: 
    - Headlines: 'Plus Jakarta Sans' (Light/Thin weights) with wide tracking
    - Technical: 'JetBrains Mono' for status badges and data labels
- Atmosphere: Slow-moving, cyan-tinted radial glows (#0DB9F2 at 10% opacity) at the bottom of sections to simulate "mist" rolling through a canyon.
- Borders: Ultra-thin (0.5px) using rgba(255, 255, 255, 0.1)
- Cards: Glassmorphic with heavy backdrop blur (20px) and sharp corners
```
