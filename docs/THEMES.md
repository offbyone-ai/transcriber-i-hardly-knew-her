# Theme System Documentation

Complete reference for the 11-theme system with light/dark mode support.

---

## Overview

The theme system uses CSS variables in OKLCH color space for perceptual uniformity. Each theme includes a full color palette with light and dark mode variants.

### Architecture
- **Technology:** CSS custom properties (variables)
- **Color Space:** OKLCH (perceptually uniform)
- **Modes:** Light and Dark per theme
- **Persistence:** localStorage
- **Detection:** System preference fallback
- **Components:** ThemeProvider context + useTheme hook

---

## Theme Presets

### 1. Default
**Description:** Clean, neutral grays with good contrast

**Light Mode:**
- Primary: Slate gray
- Secondary: Zinc gray
- Background: White
- Foreground: Dark gray

**Dark Mode:**
- Primary: Light gray
- Secondary: Gray
- Background: Dark gray
- Foreground: White

**Use Case:** Professional applications, default choice

---

### 2. Forest (Spotify-inspired)
**Description:** Bold green on black, like Spotify branding

**Light Mode:**
- Primary: #1DB954 (Spotify green)
- Secondary: Light green
- Background: White
- Foreground: Dark gray

**Dark Mode:**
- Primary: #1DB954 (Spotify green)
- Secondary: Green accent
- Background: #000000 (pure black)
- Foreground: White

**Use Case:** Music, creative applications

---

### 3. Nature (Ghibli Studio-inspired)
**Description:** Earth tones and nature-inspired colors

**Light Mode:**
- Primary: Forest green
- Secondary: Sage green
- Accent: Clay orange
- Background: Off-white
- Foreground: Dark brown

**Dark Mode:**
- Primary: Light green
- Secondary: Sage accent
- Background: Dark brown
- Foreground: Cream

**Use Case:** Environmental apps, nature-themed projects

---

### 4. America (Marvel-inspired)
**Description:** Bold reds and blues for high contrast

**Light Mode:**
- Primary: Marvel red (#E23838)
- Secondary: Marvel blue (#0047AB)
- Background: White
- Foreground: Dark gray

**Dark Mode:**
- Primary: Bright red
- Secondary: Bright blue
- Background: Dark blue
- Foreground: White

**Use Case:** Comic-related, high-contrast interfaces

---

### 5. Ocean
**Description:** Cool blues and teals for aquatic feel

**Light Mode:**
- Primary: Ocean blue (#0066CC)
- Secondary: Teal (#00A8A8)
- Accent: Light blue
- Background: White
- Foreground: Dark blue

**Dark Mode:**
- Primary: Cyan
- Secondary: Teal
- Background: Deep blue
- Foreground: Light cyan

**Use Case:** Water-related apps, tech companies, calm interfaces

---

### 6. Sunset
**Description:** Warm oranges, yellows, and pinks

**Light Mode:**
- Primary: Warm orange (#FF6B35)
- Secondary: Golden yellow
- Accent: Coral pink
- Background: White
- Foreground: Dark brown

**Dark Mode:**
- Primary: Bright orange
- Secondary: Gold
- Background: Dark orange
- Foreground: Cream

**Use Case:** Creative apps, warm-feeling interfaces

---

### 7. Lavender
**Description:** Soft purples and pastels

**Light Mode:**
- Primary: Lavender purple
- Secondary: Periwinkle
- Accent: Lilac
- Background: Off-white
- Foreground: Dark purple

**Dark Mode:**
- Primary: Light purple
- Secondary: Lavender
- Background: Dark purple
- Foreground: White

**Use Case:** Creative tools, wellness apps, elegant interfaces

---

### 8. Halloween 🎃 (Seasonal)
**Description:** Orange and black for spooky season

**Light Mode:**
- Primary: Pumpkin orange
- Secondary: Spooky purple
- Accent: Dark orange
- Background: Cream
- Foreground: Dark gray

**Dark Mode:**
- Primary: Bright orange
- Secondary: Purple
- Background: Black
- Foreground: Orange accent

**Use Case:** Seasonal theme, Halloween period

**Rotation:** Active October 1-31

---

### 9. Winter ❄️ (Seasonal)
**Description:** Icy blues and whites for winter feel

**Light Mode:**
- Primary: Icy blue
- Secondary: Light cyan
- Accent: Snowflake white
- Background: Off-white
- Foreground: Dark blue

**Dark Mode:**
- Primary: Cyan
- Secondary: Light blue
- Background: Deep blue
- Foreground: Bright cyan

**Use Case:** Seasonal theme, winter period

**Rotation:** Active December 1 - February 28

---

### 10. Valentine 💖 (Seasonal)
**Description:** Reds and pinks for romantic theme

**Light Mode:**
- Primary: Rose red
- Secondary: Pink
- Accent: Light pink
- Background: White
- Foreground: Dark red

**Dark Mode:**
- Primary: Bright red
- Secondary: Hot pink
- Background: Dark red
- Foreground: Light pink

**Use Case:** Seasonal theme, Valentine's Day period

**Rotation:** Active February 1-14

---

### 11. Spring 🌸 (Seasonal)
**Description:** Pastels and fresh greens for spring renewal

**Light Mode:**
- Primary: Fresh green
- Secondary: Cherry blossom pink
- Accent: Light yellow
- Background: Off-white
- Foreground: Dark green

**Dark Mode:**
- Primary: Bright green
- Secondary: Pink accent
- Background: Dark green
- Foreground: Cream

**Use Case:** Seasonal theme, spring period

**Rotation:** Active March 21 - May 21

---

## Color Variables

All themes use these CSS variables:

```css
/* Primary Colors */
--color-primary: oklch(...)      /* Main brand color */
--color-primary-hover: oklch(...) /* Hover state */
--color-primary-foreground: oklch(...)

/* Secondary Colors */
--color-secondary: oklch(...)
--color-secondary-hover: oklch(...)
--color-secondary-foreground: oklch(...)

/* Semantic Colors */
--color-destructive: oklch(...)   /* Danger/delete */
--color-destructive-foreground: oklch(...)
--color-muted: oklch(...)         /* Disabled/secondary text */
--color-muted-foreground: oklch(...)

/* UI Elements */
--color-border: oklch(...)        /* Borders */
--color-background: oklch(...)    /* Page background */
--color-foreground: oklch(...)    /* Main text */

/* Accents */
--color-accent: oklch(...)        /* Highlights */
--color-accent-foreground: oklch(...)

/* Surface */
--color-surface: oklch(...)       /* Cards, panels */
--color-surface-foreground: oklch(...)
```

---

## Implementation

### ThemeProvider Component
**File:** `client/src/components/theme-provider.tsx`

```typescript
interface ThemeContextType {
  theme: string              // Current theme preset
  mode: 'light' | 'dark' | 'system'  // Color mode
  setTheme: (theme: string) => void
  setMode: (mode: 'light' | 'dark' | 'system') => void
}

const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({
  children
}) => {
  // Initialize from localStorage
  // Apply theme on change
  // Listen to system preference changes
  // Provide context to children
}
```

### useTheme Hook

```typescript
const { theme, mode, setTheme, setMode } = useTheme()

// Change theme preset
setTheme('ocean')

// Change light/dark mode
setMode('dark')

// Reset to system preference
setMode('system')
```

### CSS Application

Themes are applied via data attributes on root element:

```html
<html data-theme="ocean" data-theme-mode="dark">
  <!-- Application content -->
</html>
```

CSS variables are scoped per theme:

```css
html[data-theme="ocean"][data-theme-mode="dark"] {
  --color-primary: oklch(0.5 0.2 250);
  --color-secondary: oklch(0.6 0.15 200);
  /* ... other variables ... */
}
```

---

## Theme Switcher Component

**File:** `client/src/components/theme-switcher.tsx`

### Sections

**Mode Toggle**
```
☀️ Light   🌙 Dark   💻 System
```
- Click to toggle between modes
- System mode uses browser/OS preference
- Persisted in localStorage

**Theme Dropdown**
- Click to open preset list
- Shows 4-color preview dots
- Theme name and description
- Seasonal themes have emoji indicators
- Click to select theme

### Features
- Smooth theme transitions
- Visual feedback on selection
- Mobile-responsive dropdown
- Click-outside to close
- Keyboard accessible
- No page reload needed

---

## Using Themes in Components

### Access Theme Context

```typescript
import { useTheme } from '@/components/theme-provider'

function MyComponent() {
  const { theme, mode, setTheme } = useTheme()
  
  return (
    <div>
      <p>Current theme: {theme}</p>
      <p>Current mode: {mode}</p>
      <button onClick={() => setTheme('ocean')}>
        Switch to Ocean
      </button>
    </div>
  )
}
```

### Use CSS Variables in Tailwind

```tsx
// In component
<div className="bg-primary text-primary-foreground">
  Primary color
</div>

<button className="bg-secondary hover:bg-secondary-hover">
  Secondary button
</button>
```

### Use CSS Variables Directly

```css
.custom-element {
  background-color: var(--color-primary);
  color: var(--color-primary-foreground);
  border: 1px solid var(--color-border);
}
```

---

## Adding Custom Theme

To add a new theme preset:

1. **Define Colors** in theme data:
```typescript
const themes = {
  'my-theme': {
    light: {
      primary: 'oklch(0.5 0.2 45)',
      secondary: 'oklch(0.6 0.15 200)',
      // ... other colors
    },
    dark: {
      primary: 'oklch(0.7 0.25 45)',
      secondary: 'oklch(0.8 0.2 200)',
      // ... other colors
    }
  }
}
```

2. **Add to ThemeSwitcher**:
```typescript
const themePresets = [
  // ... existing themes
  {
    id: 'my-theme',
    name: 'My Theme',
    description: 'Description of your theme',
    colors: ['#FF6B35', '#00A8A8', '#FFFFFF', '#333333']
  }
]
```

3. **Create CSS** for the theme:
```css
html[data-theme="my-theme"][data-theme-mode="light"] {
  --color-primary: oklch(0.5 0.2 45);
  /* ... all variables ... */
}

html[data-theme="my-theme"][data-theme-mode="dark"] {
  --color-primary: oklch(0.7 0.25 45);
  /* ... all variables ... */
}
```

---

## Color Selection Guidelines

### OKLCH Color Space

OKLCH is used for perceptual uniformity:
- **O:** Lightness (0 = black, 1 = white)
- **K:** Chroma (color intensity)
- **L:** Hue (0-360 degrees)

### Picking Colors

1. **Lightness:** Use 0.4-0.6 for readable text
2. **Chroma:** Use 0.15-0.25 for natural colors
3. **Hue:** Choose any 0-360 range

### Contrast Requirements

- Foreground text on background: 4.5:1 contrast minimum
- Large text: 3:1 contrast minimum
- Use WebAIM contrast checker to verify

### Light vs. Dark Mode

**Light Mode:**
- Darker colors for text (L: 0.3-0.4)
- Lighter backgrounds (L: 0.95+)
- Maintain contrast

**Dark Mode:**
- Lighter colors for text (L: 0.8-0.9)
- Darker backgrounds (L: 0.1-0.2)
- Maintain contrast

---

## Seasonal Theme Rotation

Seasonal themes automatically activate based on date:

| Theme | Active | Duration |
|-------|--------|----------|
| Halloween 🎃 | Oct 1-31 | 31 days |
| Winter ❄️ | Dec 1 - Feb 28 | ~90 days |
| Valentine 💖 | Feb 1-14 | 14 days |
| Spring 🌸 | Mar 21 - May 21 | ~61 days |

**Implementation:**
```typescript
function getActiveTheme() {
  const today = new Date()
  const month = today.getMonth() + 1
  const date = today.getDate()
  
  if (month === 10) return 'halloween'        // October
  if (month === 12 || month === 1 || month === 2) return 'winter'  // Dec-Feb
  if (month === 2 && date <= 14) return 'valentine'  // Feb 1-14
  if (month >= 3 && month <= 5) return 'spring'     // Mar-May
  
  return userPreferredTheme
}
```

---

## Accessibility

### Contrast Ratios
All themes meet WCAG AA standards:
- Text: 4.5:1 contrast minimum
- Large text: 3:1 contrast minimum
- Interactive elements: Distinct focus states

### Color Blindness
- Avoid red-green as only distinction
- Use patterns or text labels
- Test with color blindness simulator

### Respect User Preference
```typescript
// React to system preference changes
const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)')
mediaQuery.addEventListener('change', (e) => {
  if (e.matches) setMode('dark')
  else setMode('light')
})
```

### Motion
- Theme transitions are smooth but respect prefers-reduced-motion
- Avoid animated theme changes for accessibility

---

## Performance

### CSS Variable Updates
- Changing theme updates all variables at once
- Browsers efficiently apply changes
- No significant performance impact
- No page reload needed

### Caching
- localStorage stores user preference
- Loaded synchronously on app start
- ~100 bytes per stored preference

### Bundle Size
- Theme data: ~5KB
- CSS variables: ~10KB total
- Total overhead: ~15KB (gzipped: ~4KB)

---

## Troubleshooting

### Theme Not Applied
1. Check localStorage: `localStorage.getItem('theme')`
2. Check HTML data attributes: `document.documentElement.dataset`
3. Check CSS variables loaded: `getComputedStyle(document.documentElement).getPropertyValue('--color-primary')`

### Flashing Wrong Theme
1. Ensure theme provider wraps app
2. Load theme from localStorage before render
3. Add script tag in HTML to prevent flash

### Colors Look Wrong
1. Check OKLCH values in CSS
2. Verify contrast ratio with WebAIM
3. Test in different browsers
4. Check for CSS specificity issues

### Seasonal Theme Not Changing
1. Check system date
2. Verify theme data has seasonal theme
3. Check ThemeSwitcher component logic
4. Manual override via setTheme() works

---

## Browser Support

- Chrome/Edge: Full support
- Firefox: Full support  
- Safari: Full support (15+)
- Mobile: Full support

CSS custom properties (variables) supported in all modern browsers.

