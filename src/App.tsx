import { Toaster } from "@/components/ui/sonner";
import { BrowserRouter, Routes, Route, Navigate, useLocation, useParams } from "react-router-dom";
import { AuthProvider } from "@/hooks/useAuth";
import { TenantProvider } from "@/contexts/TenantContext";
import { useTenant } from "@/contexts/TenantContext";
import { PlayerProvider } from "@/contexts/PlayerContext";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { RouteTracker } from "@/components/RouteTracker";
import { useAuth } from "@/hooks/useAuth";

import { OfflineIndicator } from "@/components/OfflineIndicator";
import { OfflineSyncManager } from "@/components/OfflineSyncManager";
import { lazy, Suspense, useMemo } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { LoadingFallback } from "@/components/LoadingFallback";
import { HelmetProvider } from "react-helmet-async";

const Home = lazy(() => import("./pages/Home"));
const Auth = lazy(() => import("./pages/Auth"));
const Events = lazy(() => import("./pages/Events"));
const NewEvent = lazy(() => import("./pages/NewEvent"));
const EditEvent = lazy(() => import("./pages/EditEvent"));
const EventQuickEdit = lazy(() => import("./pages/EventQuickEdit"));
const SimpleEventAudios = lazy(() => import("./pages/SimpleEventAudios"));
const Songs = lazy(() => import("./pages/Songs"));
const SongForm = lazy(() => import("./pages/SongForm"));
const SongDetails = lazy(() => import("./pages/SongDetails"));
const SongTypeDetails = lazy(() => import("./pages/SongTypeDetails"));
const AdminSongTypes = lazy(() => import("./pages/AdminSongTypes"));
const AudioToSheet = lazy(() => import("./pages/AudioToSheet"));
const PublicSongDetails = lazy(() => import("./pages/PublicSongDetails"));
const Rehearsals = lazy(() => import("./pages/Rehearsals"));
const AdminTenants = lazy(() => import("./pages/AdminTenants"));
const AdminBackup = lazy(() => import("./pages/AdminBackup"));
const AdminRestore = lazy(() => import("./pages/AdminRestore"));
const AdminDashboard = lazy(() => import("./pages/AdminDashboard"));
const ChoirMembers = lazy(() => import("./pages/ChoirMembers"));
const ChoirMemberForm = lazy(() => import("./pages/ChoirMemberForm"));
const ChoirMemberDetails = lazy(() => import("./pages/ChoirMemberDetails"));
const PendingApproval = lazy(() => import("./pages/PendingApproval"));
const Liturgy = lazy(() => import("./pages/Liturgy"));
const ChatAssistant = lazy(() => import("./pages/ChatAssistant"));
const ShareTarget = lazy(() => import("./pages/ShareTarget"));
const NotFound = lazy(() => import("./pages/NotFound"));

import { AuthOrTenantSelection } from "@/components/AuthOrTenantSelection";

function getActiveTenantSlug(tenantSlug: string | null): string {
  return tenantSlug || localStorage.getItem("selected_tenant_slug") || "";
}

function RootRedirect() {
  const { user, loading } = useAuth();
  const { tenantSlug, userTenants, loading: tenantLoading } = useTenant();

  if (loading || tenantLoading) return <LoadingFallback />;
  const activeSlug = getActiveTenantSlug(tenantSlug);

  if (!user) {
    if (activeSlug) return <Navigate to={`/${activeSlug}/auth`} replace />;
    return <Navigate to="/auth" replace />;
  }

  if (tenantSlug) return <Navigate to={`/${tenantSlug}`} replace />;

  if (userTenants.length === 1) {
    return <Navigate to={`/${userTenants[0].slug}`} replace />;
  }

  const storedSlug = localStorage.getItem("selected_tenant_slug") || "";
  if (storedSlug && userTenants.some((tenant) => tenant.slug === storedSlug)) {
    return <Navigate to={`/${storedSlug}`} replace />;
  }

  if (storedSlug && !userTenants.some((tenant) => tenant.slug === storedSlug)) {
    localStorage.removeItem("selected_tenant_slug");
  }

  return <Navigate to="/tenant-selection" replace />;
}

function LegacyRouteRedirect() {
  const location = useLocation();
  const { tenantSlug } = useTenant();
  const activeSlug = getActiveTenantSlug(tenantSlug);

  if (!activeSlug) return <Navigate to="/auth" replace />;

  return (
    <Navigate
      to={`/${activeSlug}${location.pathname}${location.search}${location.hash}`}
      replace
    />
  );
}

function LegacyTenantSelectionRedirect() {
  const { slug } = useParams<{ slug: string }>();
  if (!slug) return <Navigate to="/tenant-selection" replace />;
  return <Navigate to={`/${slug}`} replace />;
}

function App() {
  const queryClient = useMemo(() => new QueryClient(), []);

  return (
    <HelmetProvider>
    <BrowserRouter>
      <QueryClientProvider client={queryClient}>
      <AuthProvider>
      <TenantProvider>
        
      <PlayerProvider>
        <RouteTracker />
        <OfflineIndicator />
        <OfflineSyncManager />
        <Toaster />
        <Suspense fallback={<LoadingFallback />}>
          <Routes>
            {/* Public routes */}
            <Route path="/auth" element={<Auth />} />
            <Route path="/:slug/auth" element={<Auth />} />
            <Route path="/tenant-selection" element={<AuthOrTenantSelection />} />
            <Route path="/share-target" element={<ShareTarget />} />
            <Route path="/:slug/tenant-selection" element={<LegacyTenantSelectionRedirect />} />
            <Route path="/:slug/tenant-selection/*" element={<LegacyTenantSelectionRedirect />} />
            <Route path="/e/:id" element={<SimpleEventAudios />} />
            <Route path="/s/:id" element={<PublicSongDetails />} />
            <Route path="/:slug/public/events/:id" element={<SimpleEventAudios />} />
            <Route path="/:slug/pending-approval" element={<PendingApproval />} />

            {/* Main app routes */}
            <Route path="/" element={<RootRedirect />} />
            
            <Route path="/:slug" element={<ProtectedRoute><Home /></ProtectedRoute>} />
            
            <Route path="/:slug/events" element={<ProtectedRoute><Events /></ProtectedRoute>} />
            <Route path="/:slug/events/new" element={<ProtectedRoute><NewEvent /></ProtectedRoute>} />
            <Route path="/:slug/events/edit/:id" element={<ProtectedRoute><EditEvent /></ProtectedRoute>} />
            <Route path="/:slug/events/:id" element={<SimpleEventAudios />} />
            <Route path="/:slug/events/:id/edit" element={<ProtectedRoute><EditEvent /></ProtectedRoute>} />
            <Route path="/:slug/events/:id/quick-edit" element={<ProtectedRoute><EventQuickEdit /></ProtectedRoute>} />
            <Route path="/:slug/events/:eventId/rehearsals" element={<ProtectedRoute><Rehearsals /></ProtectedRoute>} />

            <Route path="/:slug/songs" element={<ProtectedRoute><Songs /></ProtectedRoute>} />
            <Route path="/:slug/songs/type/:type" element={<ProtectedRoute><SongTypeDetails /></ProtectedRoute>} />
            <Route path="/:slug/songs/admin/types" element={<ProtectedRoute><AdminSongTypes /></ProtectedRoute>} />
            <Route path="/:slug/songs/new" element={<ProtectedRoute><SongForm /></ProtectedRoute>} />
            <Route path="/:slug/songs/:id" element={<ProtectedRoute><SongDetails /></ProtectedRoute>} />
            <Route path="/:slug/songs/:id/edit" element={<ProtectedRoute><SongForm /></ProtectedRoute>} />

            <Route path="/:slug/rehearsals" element={<ProtectedRoute><Rehearsals /></ProtectedRoute>} />
            <Route path="/:slug/liturgy" element={<ProtectedRoute><Liturgy /></ProtectedRoute>} />
            <Route path="/:slug/chat" element={<ProtectedRoute><ChatAssistant /></ProtectedRoute>} />
            <Route path="/:slug/audio-to-sheet" element={<ProtectedRoute><AudioToSheet /></ProtectedRoute>} />

            {/* Choir Members */}
            <Route path="/:slug/choir-members" element={<ProtectedRoute><ChoirMembers /></ProtectedRoute>} />
            <Route path="/:slug/choir-members/new" element={<ProtectedRoute><ChoirMemberForm /></ProtectedRoute>} />
            <Route path="/:slug/choir-members/:id" element={<ProtectedRoute><ChoirMemberDetails /></ProtectedRoute>} />
            <Route path="/:slug/choir-members/:id/edit" element={<ProtectedRoute><ChoirMemberForm /></ProtectedRoute>} />

            {/* Admin */}
            <Route path="/:slug/admin" element={<ProtectedRoute><AdminDashboard /></ProtectedRoute>} />
            <Route path="/:slug/admin/tenants" element={<ProtectedRoute><AdminTenants /></ProtectedRoute>} />
            <Route path="/:slug/admin/backup" element={<ProtectedRoute><AdminBackup /></ProtectedRoute>} />
            <Route path="/:slug/admin/restore" element={<ProtectedRoute><AdminRestore /></ProtectedRoute>} />

            {/* Legacy path compatibility redirects */}
            <Route path="/public/events/:id" element={<LegacyRouteRedirect />} />
            <Route path="/pending-approval" element={<LegacyRouteRedirect />} />
            <Route path="/events/*" element={<LegacyRouteRedirect />} />
            <Route path="/songs/*" element={<LegacyRouteRedirect />} />
            <Route path="/rehearsals/*" element={<LegacyRouteRedirect />} />
            <Route path="/liturgy/*" element={<LegacyRouteRedirect />} />
            <Route path="/chat/*" element={<LegacyRouteRedirect />} />
            <Route path="/audio-to-sheet/*" element={<LegacyRouteRedirect />} />
            <Route path="/choir-members/*" element={<LegacyRouteRedirect />} />
            <Route path="/admin/*" element={<LegacyRouteRedirect />} />
            <Route path="/tenant-selection/*" element={<AuthOrTenantSelection />} />

            <Route path="*" element={<NotFound />} />
          </Routes>
        </Suspense>
      </PlayerProvider>
      </TenantProvider>
      </AuthProvider>
      </QueryClientProvider>
    </BrowserRouter>
    </HelmetProvider>
  );
}

export default App;
