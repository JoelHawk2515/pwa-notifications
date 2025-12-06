# Beacon UI Redesign Documentation

## Overview
This document outlines the comprehensive UI/UX remodel for the Beacon PWA Notifications platform. The redesign implements a modern, clean, and accessible design system with consistent components and improved navigation.

## 🎨 Design System

### Design Tokens (`/public/css/tokens.css`)
Centralized design variables for consistency across the application:

- **Color Palette**: Primary (blue), secondary (purple), success, warning, error, info
- **Spacing Scale**: XS (4px) to 3XL (64px)
- **Typography**: System font stack with Inter fallback
- **Font Sizes**: XS (12px) to 4XL (36px)
- **Border Radius**: SM (4px) to Full (rounded)
- **Shadows**: SM to XL elevation levels
- **Z-Index Scale**: Organized stacking contexts
- **Transitions**: Fast (150ms), Base (200ms), Slow (300ms)

### Dark Mode Support
- Automatic theme switching via `data-theme="dark"` attribute
- Optimized color contrast for accessibility
- User preference saved in localStorage

## 📦 Component Library (`/public/css/components.css`)

### Buttons
- **Variants**: Primary, Secondary, Success, Error, Ghost
- **Sizes**: Small, Default, Large
- **States**: Hover, Focus, Disabled
- **Icon Support**: Icon-only and icon+text combinations

### Form Elements
- **Inputs**: Text, textarea, select with consistent styling
- **States**: Default, Focus, Error, Disabled
- **Labels**: Required field indicators
- **Validation**: Error messages and hints

### Cards
- Consistent card structure with header, body, footer
- Shadow elevation for visual hierarchy
- Flexible content areas

### Tables
- Responsive table containers
- Hover states for rows
- Clean borders and spacing

### Badges & Pills
- Color-coded status indicators
- Size variants for different contexts

### Alerts
- Success, Error, Warning, Info variants
- Dismissible options
- Icon support

### Tabs
- Clean tab navigation
- Active state indicators
- Content panels with smooth transitions

### Modals
- Backdrop overlay
- Centered modal with max-width
- Header, body, footer structure
- Accessible focus management

### Utility Classes
- Text utilities (sizes, weights, colors)
- Spacing utilities (margin, padding)
- Flex utilities (layout, alignment)
- Responsive utilities (mobile/desktop visibility)

## 🏗️ Layout System (`/public/css/layout.css`)

### Main App Structure
```
.app-wrapper
├── .sidebar (fixed, left)
└── .main-content
    ├── .topbar (sticky)
    └── .page-container
        ├── .page-header
        └── Page content
```

### Sidebar Navigation
- **Width**: 280px (desktop), collapsible (mobile)
- **Sections**: Organized by function (Main, Notifications, Analytics, Audience, Settings)
- **Active States**: Visual indicators for current page
- **Mobile**: Overlay with backdrop, toggle button
- **User Info**: Footer with avatar and role

### Topbar
- **Height**: 64px
- **Sticky positioning**: Always visible
- **Actions**: Quick access to common tasks
- **Theme Toggle**: Light/dark mode switcher

### Page Container
- **Max Width**: 1280px
- **Responsive Padding**: Adjusts for mobile
- **Header Section**: Page title, description, actions
- **Grid System**: 1-4 column responsive grids

### Stat Cards
- Icon, title, value, change indicator
- Color-coded icons for different metrics
- Positive/negative change indicators

## 📱 Responsive Design

### Breakpoints
- **Mobile**: ≤ 768px
- **Desktop**: > 768px

### Mobile Optimizations
- Sidebar collapses with overlay toggle
- Single-column grids
- Stack page actions vertically
- Reduced padding for better space usage
- Touch-friendly button sizes

## ♿ Accessibility

### WCAG 2.1 AA Compliance
- Color contrast ratios meet AA standards
- Focus indicators on interactive elements
- ARIA labels for icon-only buttons
- Keyboard navigation support
- Screen reader friendly markup

### Best Practices
- Semantic HTML structure
- Clear heading hierarchy
- Descriptive link text
- Form label associations
- Skip navigation links (optional)

## 🎯 Icons

### Lucide Icons
- Modern, consistent icon set
- Loaded via CDN (unpkg.com)
- Inline SVG for customization
- Size and color customizable via CSS

### Implementation
```html
<i data-lucide="icon-name"></i>
<script>
  lucide.createIcons();
</script>
```

## 📄 Page Templates

### Master Layout (`/views/layouts/app.ejs`)
- Unified layout structure
- Includes sidebar, topbar, page container
- Supports page-specific styles and scripts
- Icon initialization

### Partials
- `_head.ejs`: Meta tags, stylesheets, icon library
- `_sidebar.ejs`: Navigation menu with active states
- `_topbar.ejs`: Page header with actions and theme toggle

### New Page Structure
```ejs
<!DOCTYPE html>
<html lang="en" data-theme="light">
<head>
  <title>Page Title - Beacon</title>
  <%- include('partials/_head') %>
</head>
<body>
  <div class="app-wrapper">
    <%- include('partials/_sidebar', { user, currentPath: '/page-url' }) %>
    <main class="main-content">
      <%- include('partials/_topbar', { user, pageTitle: 'Page Title' }) %>
      <div class="page-container">
        <!-- Page content here -->
      </div>
    </main>
  </div>
  <script>
    lucide.createIcons();
  </script>
</body>
</html>
```

## 🚀 Migration Guide

### Phase 1: New Pages
Use the new design system for:
1. `dashboard-new.ejs` - Modern dashboard with stats cards
2. `login-new.ejs` - Split-screen auth page
3. Additional pages as needed

### Phase 2: Gradual Migration
Migrate existing pages one at a time:
1. Wrap content in new layout structure
2. Replace inline styles with component classes
3. Update form elements to use form-* classes
4. Add Lucide icons where appropriate
5. Test responsiveness on mobile

### Phase 3: Deprecation
Once all pages are migrated:
1. Remove old `style.css` and `styles.css`
2. Clean up old sidebar partials (`side-menu.ejs`, `side-menu-admin.ejs`)
3. Update all route handlers to use new templates

## 🔧 CSP Configuration

Updated Content Security Policy in `server.js`:
```javascript
styleSrc: ["'self'", "'unsafe-inline'", "https://cdnjs.cloudflare.com", "https://cdn.jsdelivr.net", "https://fonts.googleapis.com"],
scriptSrc: ["'self'", "'unsafe-inline'", "https://cdn.jsdelivr.net", "https://cdn.quilljs.com", "https://unpkg.com"],
imgSrc: ["'self'", "data:", "https:", "blob:"],
fontSrc: ["'self'", "https://cdnjs.cloudflare.com", "https://cdn.jsdelivr.net", "https://fonts.gstatic.com"],
```

## 🎨 Theme Customization

### Changing Colors
Edit `/public/css/tokens.css`:
```css
:root {
  --color-primary: #2563eb; /* Change primary color */
  --color-secondary: #7c3aed; /* Change secondary color */
  /* ... other variables */
}
```

### Adding New Components
Add to `/public/css/components.css`:
```css
.new-component {
  /* Use design tokens for consistency */
  padding: var(--space-md);
  border-radius: var(--radius-md);
  color: var(--color-text);
}
```

## 📊 Performance

### Optimizations
- CSS variables for instant theme switching
- Minimal external dependencies (Lucide icons only)
- Efficient CSS with no unused rules
- Mobile-first responsive approach

### Loading Strategy
1. Critical CSS inline (tokens, layout)
2. Component library loaded async
3. Icons loaded from CDN with fallback
4. Images lazy-loaded where appropriate

## 🧪 Testing Checklist

- [ ] All pages render correctly in Chrome, Firefox, Safari, Edge
- [ ] Mobile view works on iOS and Android
- [ ] Dark mode toggles properly
- [ ] Sidebar navigation works on mobile
- [ ] Forms validate and submit correctly
- [ ] Icons load and display properly
- [ ] Keyboard navigation works throughout
- [ ] Screen reader announces content correctly
- [ ] Performance metrics are acceptable (Lighthouse score)

## 📝 File Structure

```
public/
├── css/
│   ├── tokens.css          # Design system variables
│   ├── components.css      # Component library
│   └── layout.css          # Layout system
├── style.css               # Legacy (to be deprecated)
└── styles.css              # Legacy (to be deprecated)

views/
├── layouts/
│   └── app.ejs             # Master layout template
├── partials/
│   ├── _head.ejs           # Head with stylesheets
│   ├── _sidebar.ejs        # Navigation sidebar
│   └── _topbar.ejs         # Page header
├── dashboard-new.ejs       # Modern dashboard
├── login-new.ejs           # Modern login page
└── [other views]           # To be migrated
```

## 🤝 Contributing

When creating new pages or components:
1. Use design tokens for all values
2. Follow BEM naming convention for custom components
3. Ensure mobile responsiveness
4. Add ARIA labels for accessibility
5. Test with keyboard navigation
6. Document new patterns in this file

## 📚 Resources

- [Lucide Icons](https://lucide.dev/)
- [WCAG 2.1 Guidelines](https://www.w3.org/WAI/WCAG21/quickref/)
- [CSS Variables MDN](https://developer.mozilla.org/en-US/docs/Web/CSS/Using_CSS_custom_properties)
- [Responsive Design Best Practices](https://web.dev/responsive-web-design-basics/)

---

**Last Updated**: December 2, 2025  
**Version**: 1.0.0  
**Author**: Beacon Development Team
