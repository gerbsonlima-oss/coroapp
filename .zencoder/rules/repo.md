---
description: Repository Information Overview
alwaysApply: true
---

# Coro Quixadá Information

## Repository Summary
Coro Quixadá is a multi-platform application designed for choir management. It features a React-based web frontend, a Supabase backend for data and edge logic, and a mobile presence via Capacitor. The project integrates advanced features like audio playback, recording, liturgical calendar integration, and PWA support.

## Repository Structure
- **src/**: Main React application source code, including components, hooks, contexts, and pages.
- **supabase/**: Backend configuration, including SQL migrations and Deno-based Edge Functions.
- **android/**: Native Android project files managed by Capacitor.
- **public/**: Static assets, service worker, and web manifest for PWA.
- **assets/**: Global design assets like logos and splash screens.

### Main Repository Components
- **Frontend**: A Vite-powered React application using TypeScript and Tailwind CSS.
- **Backend**: Supabase-hosted PostgreSQL database and Deno Edge Functions.
- **Mobile**: Capacitor-wrapped Android application for mobile access.

## Projects

### Web Frontend (Core App)
**Configuration File**: `package.json`, `vite.config.ts`, `tsconfig.json`

#### Language & Runtime
**Language**: TypeScript  
**Version**: ^5.8.3 (TypeScript)  
**Build System**: Vite  
**Package Manager**: npm / bun

#### Dependencies
**Main Dependencies**:
- `@supabase/supabase-js`: Backend integration.
- `@tanstack/react-query`: Data fetching and state management.
- `react-router-dom`: Client-side routing.
- `recharts`: Data visualization.
- `radix-ui/*`: Accessible UI components.
- `lucide-react`: Iconography.
- `sonner`: Toast notifications.

**Development Dependencies**:
- `tailwindcss`: Styling framework.
- `eslint`: Linting.
- `vite-plugin-pwa`: Progressive Web App support.
- `@capacitor/assets`: Mobile asset management.

#### Build & Installation
```bash
# Install dependencies
npm install

# Start development server
npm run dev

# Build for production
npm run build

# Preview production build
npm run preview
```

### Supabase Backend
**Configuration File**: `supabase/config.toml`, `supabase/functions/*/deno.json`

#### Language & Runtime
**Language**: SQL (Migrations), TypeScript (Edge Functions)  
**Version**: Deno (Edge Functions runtime)  
**Build System**: Supabase CLI

#### Key Resources
- **Migrations**: SQL files in `supabase/migrations/` defining the database schema and RLS policies.
- **Edge Functions**: TypeScript logic in `supabase/functions/`, notably `copy-tenant-data`.

#### Usage & Operations
```bash
# Deploy edge functions (requires Supabase CLI)
supabase functions deploy [function-name]

# Apply migrations
supabase db push
```

### Android Mobile App
**Configuration File**: `android/app/src/main/assets/capacitor.config.json`

#### Language & Runtime
**Language**: Java/Kotlin (Android), JavaScript (Web bridge)  
**Package Manager**: Gradle (Android)

#### Build & Installation
```bash
# Sync web assets to Android project
npx cap sync

# Open Android Studio to build the APK
npx cap open android
```

#### Docker
No Docker configuration was found in the repository.

#### Testing
No formal testing framework (Jest, Vitest, etc.) was identified in the project configuration.
