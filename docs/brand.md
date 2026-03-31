# PING Brand Guidelines

## Brand Essence

PING is a premium cognitive instrument for serious teams. The brand feeling is **calm, sharp, high-agency, and trustworthy** — never loud, bloated, or addictive.

Everything we design should reduce cognitive load, protect attention, and help teams act with confidence and less friction.

---

## Logo

### Logomark (Icon)
A 6-dot grid arranged in a cascading triangle — three dots across the top, two in the middle (shifted right), one at the bottom right. Represents signal propagation, intentional communication, and structured clarity.

### Logotype (Icon + Wordmark)
The dot-grid icon followed by "PING" set in **League Gothic** (condensed, bold, uppercase). Tight tracking with clean vertical rhythm.

### Logo Files
| Variant | File | Use |
|---|---|---|
| Logotype on white | `bw_logotype_onwhite_padding.png` | Light backgrounds |
| Logotype on black | `bw_logotype_onbalck_padding.png` | Dark backgrounds |
| Icon on white | `bw_logo_onwhite_padding.png` | Favicons, compact spaces (light) |
| Icon on black | `bw_logo_onbalck_padding.png` | Favicons, compact spaces (dark) |
| PWA 192px | `icon-192.png` | App icons |
| PWA 512px | `icon-512.png` | App icons |

### Logo Usage Rules
- Always use the provided assets — never recreate or approximate the logo
- Maintain clear space equal to the height of one dot around the logomark
- Never rotate, distort, add effects, or change the logo color
- On colored backgrounds, use the appropriate light/dark variant
- Minimum size: 24px height for icon, 80px width for logotype

---

## Typography

### Logo Font
**League Gothic** — Used exclusively for the "PING" wordmark in the logotype. Condensed, bold, uppercase.

### UI Fonts
| Role | Family | Weight Range | Fallback |
|---|---|---|---|
| Sans-serif (primary) | Geist | 100–900 (variable) | Inter, system-ui, sans-serif |
| Monospace | Geist Mono | 100–900 (variable) | JetBrains Mono, ui-monospace, monospace |

### Type Scale
| Token | Size | Line Height |
|---|---|---|
| `2xs` | 11px | 16px |
| `xs` | 12px | 16px |
| `sm` | 13px | 18px |
| `base` | 14px | 20px |
| `md` | 15px | 22px |
| `lg` | 16px | 24px |
| `xl` | 18px | 26px |
| `2xl` | 22px | 30px |
| `3xl` | 26px | 34px |

### Type Rendering
- `-webkit-font-smoothing: antialiased`
- Font feature settings: `"rlig" 1, "calt" 1, "ss01" 1`

---

## Color

### Brand Primary
| Name | Hex | HSL | Use |
|---|---|---|---|
| PING Purple | `#5E6AD2` | `237 56% 60%` | Primary actions, focus rings, brand identity |
| Purple Hover | `#6E79D6` | — | Interactive hover state |
| Purple Muted | `rgba(94,106,210,0.12)` | — | Subtle backgrounds, badges |

### Surface Scale — Light Mode
| Token | HSL | Description |
|---|---|---|
| `surface-0` | `240 20% 100%` | Page background (white) |
| `surface-1` | `237 25% 98.5%` | Cards, elevated surfaces |
| `surface-2` | `237 20% 96%` | Secondary surfaces |
| `surface-3` | `237 14% 93%` | Hover / interaction states |

### Surface Scale — Dark Mode
| Token | HSL | Description |
|---|---|---|
| `surface-0` | `240 7% 6%` | Page background (near-black) |
| `surface-1` | `240 6% 9%` | Cards, elevated surfaces |
| `surface-2` | `240 5% 11%` | Secondary surfaces |
| `surface-3` | `240 4% 15%` | Hover / interaction states |

### Semantic Colors
| Name | Hex | Use |
|---|---|---|
| Foreground (light) | `hsl(240 10% 10%)` | Primary text on light |
| Foreground (dark) | `hsl(240 6% 96%)` | Primary text on dark |
| Muted (light) | `hsl(237 8% 38%)` | Secondary text on light |
| Muted (dark) | `hsl(240 3% 52%)` | Secondary text on dark |
| Border (light) | `hsl(240 6% 88%)` | Dividers, card edges |
| Border (dark) | `hsl(240 4% 14%)` | Dividers, card edges |

### Status Colors
| Status | Hex | Use |
|---|---|---|
| Online / Success | `#22C55E` | Presence dots, success states |
| Danger | `#EF4444` | Errors, destructive actions |
| Warning | `#F59E0B` | Warnings, attention needed |
| Info | `#3B82F6` | Informational, links |
| Merged | `#A855F7` | Git merged states |

### Eisenhower Priority Colors
| Quadrant | Hex | Label |
|---|---|---|
| Urgent + Important | `#EF4444` | Do Now |
| Important | `#F59E0B` | Schedule |
| Urgent | `#3B82F6` | Delegate |
| Neither | `#5E6AD2` | Eliminate / FYI |

### Chart Palette
1. `hsl(237 56% 60%)` — Primary (purple)
2. `hsl(142 71% 45%)` — Green
3. `hsl(47 96% 53%)` — Yellow
4. `hsl(217 91% 60%)` — Blue
5. `hsl(271 91% 65%)` — Violet

---

## Spacing & Layout

### Fixed Dimensions
| Element | Size |
|---|---|
| Top bar height | 48px |
| Sidebar width | 240px (resizable 180–400px) |
| Thread panel width | 400px |
| Max content width | 1400px |

### Border Radius
| Token | Value |
|---|---|
| `sm` | 2px |
| `md` | 3px |
| `lg` | 4px (base `--radius`) |
| `xl` | 8px |

### Border Patterns
- Card borders: 1px solid, using `--border` token
- Subtle dividers in dark mode: `rgba(255, 255, 255, 0.06)`
- Hover borders: slightly brighter (`rgba(255, 255, 255, 0.1)`)

---

## Motion

### Principles
Motion is functional, not decorative. Animations feel swift and natural — confirming actions, guiding attention, never blocking.

### Standard Animations
| Name | Duration | Easing | Use |
|---|---|---|---|
| `fade-in` | 160ms | ease | Content appearing |
| `slide-up` | 200ms | ease | Modals, panels entering |
| `slide-in-right` | 200ms | ease | Side panels |
| `accordion` | 200ms | ease-out | Expanding/collapsing |

### Spring Physics (Framer Motion)
- Damping: 20–30
- Stiffness: 250–300

### Interactive Feedback
- Hover transitions: `transition-colors` (200ms default)
- Button press: `active:scale-[0.98]`
- Focus ring: 2px solid `--ring` color, 2px offset

---

## Visual Effects

### Backdrop Blur
- Sticky headers: `backdrop-blur-xl` with `bg-background/80`
- Modal overlays: `backdrop-blur-sm` with `bg-black/60`

### Glow & Gradient
- Hero glow: `filter: blur(120px)` on accent color at 10–15% opacity
- Card hover glow: radial gradient following cursor, `rgba(94, 106, 210, 0.06)`
- Gradient text: `linear-gradient(135deg, #5E6AD2, #818CF8)` with `background-clip: text`

### Grid Background
- 32px x 32px dot grid at 3.5% opacity
- Masked with radial fade: `radial-gradient(ellipse 80% 60% at 50% 40%, black 20%, transparent)`

---

## Dark Mode

Dark mode is the **default**. The app ships dark-first and stores the preference in `localStorage` as `ping-theme`.

- Surface colors use the dark surface scale (`surface-0` through `surface-3`)
- Text is light on dark (`hsl(240 6% 96%)`)
- Borders use white at 6% opacity (`rgba(255, 255, 255, 0.06)`)
- The brand purple (`#5E6AD2`) remains constant across themes

---

## Voice & Tone

Derived from the [Founder Brand Manifesto](./founder_brand_manifesto.md):

- **Clear over clever** — Say what you mean. No jargon, no filler.
- **Calm over urgent** — The product reduces noise; the brand should too.
- **Precise over exhaustive** — One sharp sentence beats three vague ones.
- **Human over corporate** — Direct, respectful, never robotic.
- **Confident, not arrogant** — State facts. Let the product speak.

### PWA Metadata
- App name: **PING**
- Theme color: `#5E6AD2`
- Background color: `#0e0f11`
- Display: standalone
