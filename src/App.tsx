import { Toaster } from "@/components/ui/sonner";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
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
const TenantSelection = lazy(() => import("./pages/TenantSelection"));
const ChoirMembers = lazy(() => import("./pages/ChoirMembers"));
const ChoirMemberForm = lazy(() => import("./pages/ChoirMemberForm"));
const ChoirMemberDetails = lazy(() => import("./pages/ChoirMemberDetails"));

const Liturgy = lazy(() => import("./pages/Liturgy"));
const NotFound = lazy(() => import("./pages/NotFound"));



// Component that renders all app routes (used both at root and under tenant prefix)
function AppRoutes() {
  return (
    <Routes>
      <Route path="/" element={<Home />} />
      <Route path="/auth" element={<Auth />} />
      <Route path="/public/events/:id" element={<EventDetails />} />
      <Route path="/events" element={<Events />} />
      <Route
        path="/events/new"
        element={
          <ProtectedRoute>
            <NewEvent />
          </ProtectedRoute>
        }
      />
      <Route
        path="/events/edit/:id"
        element={
          <ProtectedRoute>
            <EditEvent />
          </ProtectedRoute>
        }
      />
      <Route path="/events/:id" element={<EventDetails />} />
      <Route
        path="/audio-to-sheet"
        element={
          <ProtectedRoute>
            <AudioToSheet />
          </ProtectedRoute>
        }
      />
      <Route path="/songs" element={<Songs />} />
      <Route path="/songs/type/:type" element={<SongTypeDetails />} />
      <Route
        path="/songs/admin/types"
        element={
          <ProtectedRoute>
            <AdminSongTypes />
          </ProtectedRoute>
        }
      />
      <Route
        path="/songs/new"
        element={
          <ProtectedRoute>
            <SongForm />
          </ProtectedRoute>
        }
      />
      <Route path="/songs/:id" element={<SongDetails />} />
      <Route
        path="/songs/:id/edit"
        element={
          <ProtectedRoute>
            <SongForm />
          </ProtectedRoute>
        }
      />
      <Route
        path="/events/:id/quick-edit"
        element={
          <ProtectedRoute>
            <EventQuickEdit />
          </ProtectedRoute>
        }
      />
      <Route path="/rehearsals" element={<Rehearsals />} />
      <Route path="/events/:eventId/rehearsals" element={<Rehearsals />} />
      <Route
        path="/admin/tenants"
        element={
          <ProtectedRoute>
            <AdminTenants />
          </ProtectedRoute>
        }
      />
      
      <Route path="/liturgy" element={<Liturgy />} />
      <Route path="*" element={<NotFound />} />
    </Routes>
  );
}

function App() {
  const queryClient = useMemo(() => new QueryClient(), []);

  return (
    <HelmetProvider>
    <BrowserRouter>
      <QueryClientProvider client={queryClient}>
      <TenantProvider>
        <SplashScreen />
      <AuthProvider>
      <PlayerProvider>
        <RouteTracker />
        <OfflineIndicator />
        <OfflineSyncManager />
        <Toaster />
        <Suspense fallback={<LoadingFallback />}>
          <Routes>
            {/* Simplified event audios - public route */}
            <Route path="/e/:id" element={<SimpleEventAudios />} />
            
            {/* Routes without tenant prefix */}
            <Route path="/auth" element={<Auth />} />
            <Route path="/public/*" element={<EventDetails />} />
            <Route
              path="/admin/tenants"
              element={
                <ProtectedRoute>
                  <AdminTenants />
                </ProtectedRoute>
              }
            />
            
            {/* Routes with optional tenant prefix */}
            <Route path="/:tenantSlug/events" element={<Events />} />
            <Route
              path="/:tenantSlug/events/new"
              element={
                <ProtectedRoute>
                  <NewEvent />
                </ProtectedRoute>
              }
            />
            <Route
              path="/:tenantSlug/events/edit/:id"
              element={
                <ProtectedRoute>
                  <EditEvent />
                </ProtectedRoute>
              }
            />
            <Route path="/:tenantSlug/events/:id" element={<EventDetails />} />
            <Route
              path="/:tenantSlug/events/:id/quick-edit"
              element={
                <ProtectedRoute>
                  <EventQuickEdit />
                </ProtectedRoute>
              }
            />
            <Route path="/:tenantSlug/events/:eventId/rehearsals" element={<Rehearsals />} />
            
            <Route path="/:tenantSlug/songs" element={<Songs />} />
            <Route path="/:tenantSlug/songs/type/:type" element={<SongTypeDetails />} />
            <Route
              path="/:tenantSlug/songs/admin/types"
              element={
                <ProtectedRoute>
                  <AdminSongTypes />
                </ProtectedRoute>
              }
            />
            <Route
              path="/:tenantSlug/songs/new"
              element={
                <ProtectedRoute>
                  <SongForm />
                </ProtectedRoute>
              }
            />
            <Route path="/:tenantSlug/songs/:id" element={<SongDetails />} />
            <Route
              path="/:tenantSlug/songs/:id/edit"
              element={
                <ProtectedRoute>
                  <SongForm />
                </ProtectedRoute>
              }
            />
            
            <Route
              path="/:tenantSlug/audio-to-sheet"
              element={
                <ProtectedRoute>
                  <AudioToSheet />
                </ProtectedRoute>
              }
            />
            <Route path="/:tenantSlug/rehearsals" element={<Rehearsals />} />
            <Route path="/:tenantSlug/liturgy" element={<Liturgy />} />
            
            {/* Choir Members Routes with tenant prefix */}
            <Route
              path="/:tenantSlug/choir-members"
              element={
                <ProtectedRoute>
                  <ChoirMembers />
                </ProtectedRoute>
              }
            />
            <Route
              path="/:tenantSlug/choir-members/new"
              element={
                <ProtectedRoute>
                  <ChoirMemberForm />
                </ProtectedRoute>
              }
            />
            <Route
              path="/:tenantSlug/choir-members/:id"
              element={
                <ProtectedRoute>
                  <ChoirMemberDetails />
                </ProtectedRoute>
              }
            />
            <Route
              path="/:tenantSlug/choir-members/:id/edit"
              element={
                <ProtectedRoute>
                  <ChoirMemberForm />
                </ProtectedRoute>
              }
            />
            
            <Route path="/:tenantSlug" element={<Home />} />
            
            {/* Default routes without tenant prefix */}
            <Route path="/events" element={<Events />} />
            <Route
              path="/events/new"
              element={
                <ProtectedRoute>
                  <NewEvent />
                </ProtectedRoute>
              }
            />
            <Route
              path="/events/edit/:id"
              element={
                <ProtectedRoute>
                  <EditEvent />
                </ProtectedRoute>
              }
            />
            <Route path="/events/:id" element={<EventDetails />} />
            <Route
              path="/events/:id/quick-edit"
              element={
                <ProtectedRoute>
                  <EventQuickEdit />
                </ProtectedRoute>
              }
            />
            <Route path="/events/:eventId/rehearsals" element={<Rehearsals />} />
            
            <Route path="/songs" element={<Songs />} />
            <Route path="/songs/type/:type" element={<SongTypeDetails />} />
            <Route
              path="/songs/admin/types"
              element={
                <ProtectedRoute>
                  <AdminSongTypes />
                </ProtectedRoute>
              }
            />
            <Route
              path="/songs/new"
              element={
                <ProtectedRoute>
                  <SongForm />
                </ProtectedRoute>
              }
            />
            <Route path="/songs/:id" element={<SongDetails />} />
            <Route
              path="/songs/:id/edit"
              element={
                <ProtectedRoute>
                  <SongForm />
                </ProtectedRoute>
              }
            />
            
            <Route
              path="/audio-to-sheet"
              element={
                <ProtectedRoute>
                  <AudioToSheet />
                </ProtectedRoute>
              }
            />
            <Route path="/rehearsals" element={<Rehearsals />} />
            <Route path="/liturgy" element={<Liturgy />} />
            
            {/* Choir Members Routes without tenant prefix */}
            <Route
              path="/choir-members"
              element={
                <ProtectedRoute>
                  <ChoirMembers />
                </ProtectedRoute>
              }
            />
            <Route
              path="/choir-members/new"
              element={
                <ProtectedRoute>
                  <ChoirMemberForm />
                </ProtectedRoute>
              }
            />
            <Route
              path="/choir-members/:id"
              element={
                <ProtectedRoute>
                  <ChoirMemberDetails />
                </ProtectedRoute>
              }
            />
            <Route
              path="/choir-members/:id/edit"
              element={
                <ProtectedRoute>
                  <ChoirMemberForm />
                </ProtectedRoute>
              }
            />
            
            <Route path="/" element={<TenantSelection />} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </Suspense>
      </PlayerProvider>
      </AuthProvider>
      </TenantProvider>
      </QueryClientProvider>
    </BrowserRouter>
    </HelmetProvider>
  );
}

export default App;
