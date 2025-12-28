# UI Components Documentation

Professional shadcn/ui-style components reference.

---

## Button Component

**File:** `client/src/components/ui/button.tsx`

### Overview
Versatile button component with multiple variants and sizes, built using Class Variance Authority for type-safe styling.

### Props
- `variant`: "default" | "destructive" | "outline" | "secondary" | "ghost" | "link"
- `size`: "default" | "sm" | "lg" | "icon"
- `asChild`: boolean (render as child component)
- Standard HTML button attributes

### Variants

**default**
- Background: Theme primary color
- Text: White/dark
- Use for primary actions

**destructive**
- Background: Red/error color
- Text: White
- Use for delete/dangerous actions

**outline**
- Background: Transparent
- Border: Theme color
- Use for secondary actions

**secondary**
- Background: Secondary theme color
- Text: Secondary text
- Use for alternative actions

**ghost**
- Background: Transparent
- Text: Theme color
- Hover: Light background
- Use for less prominent actions

**link**
- Text: Link color
- Underline on hover
- Use for inline actions

### Sizes

**default** - Standard button height (40px)  
**sm** - Small button (32px)  
**lg** - Large button (48px)  
**icon** - Square icon button (40px)

### Example Usage
```typescript
<Button variant="primary" size="lg">
  Save Recording
</Button>

<Button variant="destructive" size="sm">
  Delete
</Button>

<Button variant="ghost" size="icon">
  <ChevronDown />
</Button>
```

---

## Input Component

**File:** `client/src/components/ui/input.tsx`

### Overview
Text input component with theme-aware styling and full HTML5 input support.

### Props
- `type`: "text" | "email" | "password" | "number" | "file" | etc.
- `placeholder`: string
- `disabled`: boolean
- `value`: string
- `onChange`: (e: ChangeEvent<HTMLInputElement>) => void
- All standard HTML input attributes

### Features
- Focus ring styling
- Disabled state styling
- Placeholder color customization
- File input support
- Number input support
- Theme-aware colors

### Example Usage
```typescript
<Input
  type="email"
  placeholder="Enter your email"
  value={email}
  onChange={(e) => setEmail(e.target.value)}
/>

<Input
  type="password"
  placeholder="Password"
  value={password}
  onChange={(e) => setPassword(e.target.value)}
/>

<Input
  type="file"
  accept=".mp3,.wav"
  onChange={handleFileUpload}
/>
```

---

## Label Component

**File:** `client/src/components/ui/label.tsx`

### Overview
Semantic HTML label element with theme-aware styling and peer support.

### Props
- `htmlFor`: string (connects to input id)
- `disabled`: boolean
- Standard HTML label attributes

### Features
- Proper semantic HTML
- Peer-disabled styling (grays out when paired input is disabled)
- Typography styling (medium weight, body size)
- Theme color integration

### Example Usage
```typescript
<div>
  <Label htmlFor="email">Email Address</Label>
  <Input id="email" type="email" />
</div>

<div>
  <Label htmlFor="subject">Subject</Label>
  <Input id="subject" disabled />
</div>
```

---

## Card Component

**File:** `client/src/components/ui/card.tsx`

### Overview
Container component with multiple sub-components for creating structured layouts.

### Sub-Components

**Card**
- Root container with border and background
- Padding and rounded corners
- Theme colors

**CardHeader**
- Header section with bottom border
- Padding and spacing
- Use for titles and metadata

**CardTitle**
- Heading element (h2)
- Bold, larger typography
- Used inside CardHeader

**CardDescription**
- Secondary text
- Muted color
- Used inside CardHeader

**CardContent**
- Main content area
- Standard padding
- Use for main information

**CardFooter**
- Footer section with top border
- Padding and spacing
- Use for actions (buttons)

### Example Usage
```typescript
<Card>
  <CardHeader>
    <CardTitle>Recording Details</CardTitle>
    <CardDescription>Saved on Dec 28, 2025</CardDescription>
  </CardHeader>
  <CardContent>
    <p>Recording duration: 2:30</p>
  </CardContent>
  <CardFooter>
    <Button>Download</Button>
  </CardFooter>
</Card>
```

---

## Dialog/Modal Component

**File:** `client/src/components/ui/dialog.tsx` (154 lines)

### Overview
Accessible modal dialog with context-based state management, backdrop, and keyboard support.

### Sub-Components

**Dialog**
- Root component providing context
- Props: `open`, `onOpenChange`

**DialogTrigger**
- Button/link that opens dialog
- Use as child of Dialog

**DialogContent**
- Main content container
- Props: `children`, `className`
- Features:
  - Backdrop with blur
  - Close button with X icon
  - Centered on screen
  - Responsive padding

**DialogHeader**
- Top section for title
- Use for DialogTitle and DialogDescription

**DialogTitle**
- Main heading (h2)
- Bold, larger typography

**DialogDescription**
- Secondary text below title
- Muted color

**DialogFooter**
- Bottom section for actions
- Typically contains buttons
- Right-aligned content

### Features
- ESC key to close
- Click backdrop to close
- Body scroll lock
- Smooth animations
- Focus management
- Portal rendering (z-index 50)

### Example Usage
```typescript
const [open, setOpen] = useState(false)

<Dialog open={open} onOpenChange={setOpen}>
  <DialogTrigger asChild>
    <Button>Open Dialog</Button>
  </DialogTrigger>
  <DialogContent>
    <DialogHeader>
      <DialogTitle>Create New Subject</DialogTitle>
      <DialogDescription>
        Enter details for your new subject
      </DialogDescription>
    </DialogHeader>
    <form>
      <Input placeholder="Subject name" />
    </form>
    <DialogFooter>
      <Button variant="outline" onClick={() => setOpen(false)}>
        Cancel
      </Button>
      <Button onClick={handleCreate}>Create</Button>
    </DialogFooter>
  </DialogContent>
</Dialog>
```

---

## Theme Switcher Component

**File:** `client/src/components/theme-switcher.tsx` (169 lines)

### Overview
Comprehensive theme selection interface with mode toggle and preset previews.

### Sections

**Mode Toggle**
- Light button (sun icon)
- Dark button (moon icon)
- System button (monitor icon)
- One can be active at a time
- Affects all themes

**Theme Preset Dropdown**
- 11 available themes
- Visual preview (4 colored dots)
- Theme name and description
- Emoji indicators for seasonal themes
- Click-outside to close
- Smooth animations

**Theme Presets**
1. **Default** - Neutral grays
2. **Forest** - Spotify green (#1DB954) on black
3. **Nature** - Ghibli-inspired greens
4. **America** - Marvel red and blue
5. **Ocean** - Blues and teals
6. **Sunset** - Warm oranges and yellows
7. **Lavender** - Purple tones
8. **Halloween** 🎃 - Orange and black
9. **Winter** ❄️ - Icy blues and whites
10. **Valentine** 💖 - Reds and pinks
11. **Spring** 🌸 - Pastels and greens

### Features
- Light/Dark mode per theme
- System preference detection
- localStorage persistence
- CSS variables integration
- Smooth transitions
- Mobile-responsive
- Accessibility compliant

### Example Usage
```typescript
// In App.tsx or main layout
import { ThemeSwitcher } from '@/components/theme-switcher'

<header>
  <nav>
    {/* ... other nav items ... */}
    <ThemeSwitcher />
  </nav>
</header>

// Get current theme in any component
const { theme, setTheme } = useTheme()

// Change theme programmatically
setTheme('ocean')

// Change mode
setTheme('dark')
```

### useTheme Hook
Returns theme context with:
- `theme`: Current theme preset
- `mode`: Current mode ('light' | 'dark' | 'system')
- `setTheme()`: Change theme preset
- `setMode()`: Change light/dark mode

---

## Component Patterns

### forwardRef Usage
All components that may need ref access use forwardRef pattern:

```typescript
const Button = React.forwardRef<
  HTMLButtonElement,
  ButtonProps
>(({ variant, size, ...props }, ref) => {
  return <button ref={ref} {...props} />
})

Button.displayName = 'Button'
```

### Class Variance Authority (CVA)
Button uses CVA for type-safe variant combinations:

```typescript
const buttonVariants = cva(
  "inline-flex items-center justify-center",
  {
    variants: {
      variant: {
        default: "bg-primary text-white",
        outline: "border border-primary",
        // ...
      },
      size: {
        default: "h-10 px-4",
        sm: "h-8 px-2",
        // ...
      },
    },
  }
)
```

### Composition Pattern
Cards use composition for flexible layouts:

```typescript
// Instead of prop-based customization
<Card title="..." subtitle="...">
  {children}
</Card>

// Use composition
<Card>
  <CardHeader>
    <CardTitle>Title</CardTitle>
    <CardDescription>Subtitle</CardDescription>
  </CardHeader>
  <CardContent>{children}</CardContent>
</Card>
```

---

## Styling System

All components use:
- **Tailwind CSS** for base styles
- **CSS variables** for theming
- **OKLCH color space** for perceptual uniformity
- **clsx/tailwind-merge** for className merging

### Color Variables
```css
--color-primary: oklch(...)
--color-secondary: oklch(...)
--color-destructive: oklch(...)
--color-muted: oklch(...)
--color-border: oklch(...)
--color-background: oklch(...)
--color-foreground: oklch(...)
```

---

## Accessibility Features

- **Semantic HTML**: Proper use of button, label, dialog elements
- **ARIA labels**: Accessible names for screen readers
- **Keyboard navigation**: Tab support, Enter/Space activation
- **Focus indicators**: Visible focus rings on all interactive elements
- **Color contrast**: WCAG AA compliant color combinations
- **Responsive design**: Touch-friendly target sizes (min 44x44px)

---

## Browser Support

- Chrome/Edge: Full support
- Firefox: Full support
- Safari: Full support (15.2+)
- Mobile browsers: Full support

---

## Usage Checklist

When using components:
- ✅ Use semantic HTML (proper button, input, label elements)
- ✅ Include htmlFor on labels
- ✅ Use aria-labels for icon-only buttons
- ✅ Handle loading states
- ✅ Show error states
- ✅ Test on mobile devices
- ✅ Test keyboard navigation

