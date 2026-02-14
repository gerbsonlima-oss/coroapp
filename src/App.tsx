import { Toaster } from "@/components/ui/sonner";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "@/hooks/useAuth";
import { TenantProvider } from "@/contexts/TenantContext";
import { PlayerProvider } from "@/contexts/PlayerContext";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { RouteTracker } from "@/components/RouteTracker";
import { SplashScreen } from "@/components/SplashScreen";
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
const EventDetails = lazy(() => import("./pages/EventDetails"));
const EventQuickEdit = lazy(() => import("./pages/EventQuickEdit"));
const SimpleEventAudios = lazy(() => import("./pages/SimpleEventAudios"));
const Songs = lazy(() => import("./pages/Songs"));
const SongForm = lazy(() => import("./pages/SongForm"));
const SongDetails = lazy(() => import("./pages/SongDetails"));
const SongTypeDetails = lazy(() => import("./pages/SongTypeDetails"));
const AdminSongTypes = lazy(() => import("./pages/AdminSongTypes"));
const AudioToSheet = lazy(() => import("./pages/AudioToSheet"));
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
const NotFound = lazy(() => import("./pages/NotFound"));

import { AuthOrTenantSelection } from "@/components/AuthOrTenantSelection";

function App() {
  const queryClient = useMemo(() => new QueryClient(), []);

  return (
    <HelmetProvider>
    <BrowserRouter>
      <QueryClientProvider client={queryClient}>
      <AuthProvider>
      <TenantProvider>
        <SplashScreen />
      <PlayerProvider>
        <RouteTracker />
        <OfflineIndicator />
        <OfflineSyncManager />
        <Toaster />
        <Suspense fallback={<LoadingFallback />}>
          <Routes>
            {/* Public routes */}
            <Route path="/auth" element={<Auth />} />
            <Route path="/e/:id" element={<SimpleEventAudios />} />
            <Route path="/pending-approval" element={<PendingApproval />} />
            <Route path="/public/events/:id" element={<EventDetails />} />

            {/* Main app routes */}
            <Route path="/" element={<AuthOrTenantSelection />} />
            
            <Route path="/events" element={<ProtectedRoute><Events /></ProtectedRoute>} />
            <Route path="/events/new" element={<ProtectedRoute><NewEvent /></ProtectedRoute>} />
            <Route path="/events/edit/:id" element={<ProtectedRoute><EditEvent /></ProtectedRoute>} />
            <Route path="/events/:id" element={<ProtectedRoute><SimpleEventAudios /></ProtectedRoute>} />
            <Route path="/events/:id/edit" element={<ProtectedRoute><EditEvent /></ProtectedRoute>} />
            <Route path="/events/:id/quick-edit" element={<ProtectedRoute><EventQuickEdit /></ProtectedRoute>} />
            <Route path="/events/:eventId/rehearsals" element={<ProtectedRoute><Rehearsals /></ProtectedRoute>} />

            <Route path="/songs" element={<ProtectedRoute><Songs /></ProtectedRoute>} />
            <Route path="/songs/type/:type" element={<ProtectedRoute><SongTypeDetails /></ProtectedRoute>} />
            <Route path="/songs/admin/types" element={<ProtectedRoute><AdminSongTypes /></ProtectedRoute>} />
            <Route path="/songs/new" element={<ProtectedRoute><SongForm /></ProtectedRoute>} />
            <Route path="/songs/:id" element={<ProtectedRoute><SongDetails /></ProtectedRoute>} />
            <Route path="/songs/:id/edit" element={<ProtectedRoute><SongForm /></ProtectedRoute>} />

            <Route path="/rehearsals" element={<ProtectedRoute><Rehearsals /></ProtectedRoute>} />
            <Route path="/liturgy" element={<ProtectedRoute><Liturgy /></ProtectedRoute>} />
            <Route path="/audio-to-sheet" element={<ProtectedRoute><AudioToSheet /></ProtectedRoute>} />

            {/* Choir Members */}
            <Route path="/choir-members" element={<ProtectedRoute><ChoirMembers /></ProtectedRoute>} />
            <Route path="/choir-members/new" element={<ProtectedRoute><ChoirMemberForm /></ProtectedRoute>} />
            <Route path="/choir-members/:id" element={<ProtectedRoute><ChoirMemberDetails /></ProtectedRoute>} />
            <Route path="/choir-members/:id/edit" element={<ProtectedRoute><ChoirMemberForm /></ProtectedRoute>} />

            {/* Admin */}
            <Route path="/admin" element={<ProtectedRoute><AdminDashboard /></ProtectedRoute>} />
            <Route path="/admin/tenants" element={<ProtectedRoute><AdminTenants /></ProtectedRoute>} />
            <Route path="/admin/backup" element={<ProtectedRoute><AdminBackup /></ProtectedRoute>} />
            <Route path="/admin/restore" element={<ProtectedRoute><AdminRestore /></ProtectedRoute>} />

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
