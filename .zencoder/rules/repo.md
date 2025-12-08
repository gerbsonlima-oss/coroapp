---
description: Repository Information Overview
alwaysApply: true
---

# Coro Quixad - Repertório Coral Information

## Summary
Coro Quixad is a Progressive Web App (PWA) built with modern frontend technologies for managing choir (coral) repertoire. The application handles event management, song cataloging, audio playback, and sheet music notation. It includes Supabase integration for authentication and data persistence, with features like audio recording, QR code generation, and PDF export capabilities.

## Structure
```
coro-quixad/
├── src/
│   ├── pages/           # Route-based page components (Auth, Events, Songs, EventDetails, SongDetails, etc.)
│   ├── components/      # Reusable components (UI, AudioPlayer, SheetViewer, etc.)
│   │   └── ui/         # shadcn/ui component library
│   ├── lib/            # Utility functions
│   ├── hooks/          # Custom React hooks (useAuth, etc.)
│   ├── App.tsx         # Main routing component
│   ├── main.tsx        # React entry point with PWA service worker registration
│   └── index.css       # Global styles
├── public/             # PWA assets
│   ├── manifest.json   # PWA manifest
│   ├── sw.js          # Service worker
│   └── icons/         # App icons (192x512 PNG)
├── index.html         # HTML entry point
└── [config files]     # Vite, TypeScript, ESLint, Tailwind configs
```

## Language & Runtime
**Language**: TypeScript 5.8.3  
**Runtime**: Node.js (implied, npm/bun package managers)  
**Build System**: Vite 5.4.19  
**Package Managers**: npm (package-lock.json), bun (bun.lockb)

## Dependencies
**Main Dependencies**:
- **React**: 18.3.1 (UI framework)
- **React Router**: 6.30.1 (client-side routing)
- **Supabase**: @supabase/supabase-js 2.86.2 (auth & backend)
- **TanStack Query**: @tanstack/react-query 5.83.0 (data fetching/caching)
- **Forms**: react-hook-form 7.61.1, zod 3.25.76 (schema validation)
- **UI Components**: shadcn/ui (via @radix-ui components), 24 Radix UI modules
- **Styling**: Tailwind CSS 3.4.17, class-variance-authority 0.7.1
- **Audio/Media**: recharts 2.15.4 (charts), jspdf 3.0.3, pdf-lib 1.17.1, pdfjs-dist 5.4.394 (PDF)
- **Utilities**: date-fns 3.6.0, qrcode 1.5.4, lucide-react 0.462.0 (icons)
- **Drag & Drop**: @dnd-kit/core 6.3.1, @dnd-kit/sortable 10.0.0
- **PWA**: vite-plugin-pwa 1.1.0, next-themes 0.3.0
- **Notifications**: sonner 1.7.4
- **Panels**: react-resizable-panels 2.1.9

**Development Dependencies**:
- TypeScript, @vitejs/plugin-react-swc 3.11.0, ESLint with plugins
- Tailwind CSS 3.4.17, PostCSS 8.5.6, Autoprefixer 10.4.21
- Type definitions (@types/react, @types/react-dom, @types/node)
- lovable-tagger 1.1.11 (Lovable component tagging)

## Build & Installation
```bash
npm install              # Install dependencies
npm run dev             # Start dev server (Vite on :8080)
npm run build           # Production build
npm run build:dev       # Development build
npm run preview         # Preview production build
npm run lint            # Run ESLint
```

## Main Entry Points
- **HTML**: `index.html` - Root HTML template
- **React**: `src/main.tsx` - Bootstraps React app, registers PWA service worker
- **App Component**: `src/App.tsx` - Main routing and layout component with BrowserRouter

## Application Routes
- `/auth` - Authentication page
- `/events` - Event listing (default route)
- `/events/new` - Create event (protected)
- `/events/:id` - Event details
- `/events/:id/edit` - Edit event (protected)
- `/events/:id/quick-edit` - Quick edit event (protected)
- `/songs` - Song catalog
- `/songs/new` - Add song (protected)
- `/songs/:id` - Song details
- `/songs/:id/edit` - Edit song (protected)
- `/songs/type/:type` - Songs by type
- `/songs/admin/types` - Manage song types (protected)
- `/audio-to-sheet` - Convert audio to sheet music (protected)
- `/public/events/:id` - Public event view

## Configuration Files
- **vite.config.ts**: Vite build config with React SWC plugin, PWA plugin, path aliases
- **tsconfig.json**: TypeScript config with `@/*` → `src/*` path alias, relaxed strict mode
- **tailwind.config.ts**: Tailwind CSS customization
- **eslint.config.js**: ESLint rules for code quality
- **postcss.config.js**: PostCSS plugins (Tailwind, Autoprefixer)
- **components.json**: shadcn/ui configuration
- **.env**: Environment variables (e.g., Supabase credentials)

## PWA Features
- **Service Worker**: Auto-updating strategy, cached up to 10MB
- **Manifest**: Located at `public/manifest.json` with app metadata
- **Start URL**: `/events`
- **Display Mode**: Standalone (app-like experience)
- **Icons**: 192x192 and 512x512 PNG for different screen sizes
- **Cache Strategy**: Injects manifest for offline support

## Key Technologies & Features
- **Authentication**: Supabase auth with ProtectedRoute component
- **Audio Processing**: Audio player, recorder, pitch visualization
- **Sheet Music**: Sheet music viewer and notation components
- **PDF Export**: Generate and handle PDF documents
- **QR Codes**: Generate QR codes for events/songs
- **Drag & Drop**: Reorderable lists using dnd-kit
- **Theming**: next-themes for light/dark mode
- **Responsive Design**: Mobile-first UI with Tailwind CSS

## Notes
- No traditional test framework configured (Jest/Vitest)
- No Docker configuration
- Built with Lovable (AI-assisted development platform)
- TypeScript strict mode partially disabled for flexibility
- App emphasizes offline-first PWA experience
