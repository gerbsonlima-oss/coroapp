---
description: Repository Information Overview
alwaysApply: true
---

# CantoSacro Information

## Summary
CantoSacro is a management system for choirs and liturgy, designed as a Progressive Web App (PWA). It enables repertoire organization, event scheduling, member management, and provides tools for audio recording, chord viewing, and PDF/ZIP exporting. The project is built with React, Vite, and Supabase.

## Structure
- **src/**: Main application source code.
  - **components/**: Reusable UI components (shadcn/ui, audio players, viewers).
  - **pages/**: Application views (Events, Songs, Liturgy, Admin).
  - **hooks/**: Custom React hooks for business logic and data fetching.
  - **contexts/**: Global state management for Auth, Player, and Multi-tenancy.
  - **utils/**: Utilities for PDF generation, image processing, and exports.
  - **integrations/**: Supabase client and auto-generated types.
- **supabase/**: Backend configuration and resources.
  - **functions/**: Edge Functions for image proxying, OG images, and data operations.
  - **migrations/**: Database schema and RLS policy versions.
- **public/**: Static assets, service workers, and PWA manifest.

## Language & Runtime
**Language**: TypeScript  
**Version**: ^5.8.3  
**Build System**: Vite (v5.4.19)  
**Package Manager**: npm

## Dependencies
**Main Dependencies**:
- **Framework**: `react` (^18.3.1), `react-router-dom` (^6.30.1)
- **Backend**: `@supabase/supabase-js` (^2.86.2), `@tanstack/react-query` (^5.83.0)
- **UI/Styling**: `tailwindcss` (^3.4.17), `shadcn/ui` (Radix UI primitives), `lucide-react`, `sonner`
- **Forms/Validation**: `react-hook-form` (^7.61.1), `zod` (^3.25.76)
- **Utilities**: `jspdf`, `pdf-lib`, `chordsheetjs`, `html2canvas`, `jszip`, `qrcode`

**Development Dependencies**:
- `@vitejs/plugin-react-swc`, `eslint`, `typescript-eslint`, `postcss`, `autoprefixer`

## Build & Installation
```bash
# Install dependencies
npm install

# Start development server
npm run dev

# Build for production
npm run build

# Lint the project
npm run lint
```

## Main Files & Resources
- **Entry Point**: `src/main.tsx`
- **Main App**: `src/App.tsx`
- **HTML Template**: `index.html`
- **Supabase Config**: `supabase/config.toml`
- **PWA Manifest**: `public/manifest.json`

## Testing
No automated testing framework (Jest/Vitest) is currently configured in `package.json`.

## Usage & Operations
- **Development**: Run `npm run dev` for a local development server with HMR.
- **Edge Functions**: Managed via Supabase CLI in `supabase/functions/`.
- **Database**: Migrations are tracked in `supabase/migrations/` and can be applied via Supabase CLI.
- **Deployment**: Integrated with Lovable.dev; can be published via their platform or standard static hosting.
