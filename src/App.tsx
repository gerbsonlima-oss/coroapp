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
const AdminBackup = lazy(() => import("./pages/AdminBackup"));
const AdminRestore = lazy(() => import("./pages/AdminRestore"));
const AdminDashboard = lazy(() => import("./pages/AdminDashboard"));
const TenantSelection = lazy(() => import("./pages/TenantSelection"));
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
            
            {/* Pending approval page */}
            <Route path="/pending-approval" element={<PendingApproval />} />
            
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
            <Route
              path="/admin/backup"
              element={
                <ProtectedRoute>
                  <AdminBackup />
                </ProtectedRoute>
              }
            />
            <Route
              path="/admin/restore"
              element={
                <ProtectedRoute>
                  <AdminRestore />
                </ProtectedRoute>
              }
            />
            
            {/* Routes with optional tenant prefix */}
            <Route path="/:tenantSlug/events" element={
              <ProtectedRoute>
                <Events />
              </ProtectedRoute>
            } />
            <Route
              path="/:tenantSlug/events/new"
              element={
                <ProtectedRoute>
                  <NewEvent />
                </ProtectedRoute>
              }
            />
            <Route
              path="/:tenantSlug/events/:id/edit"
              element={
                <ProtectedRoute>
                  <EditEvent />
                </ProtectedRoute>
              }
            />
            <Route path="/:tenantSlug/events/:id" element={
              <ProtectedRoute>
                <SimpleEventAudios />
              </ProtectedRoute>
            } />
            <Route
              path="/:tenantSlug/events/:id/quick-edit"
              element={
                <ProtectedRoute>
                  <EventQuickEdit />
                </ProtectedRoute>
              }
            />
            <Route path="/:tenantSlug/events/:eventId/rehearsals" element={
              <ProtectedRoute>
                <Rehearsals />
              </ProtectedRoute>
            } />
            
            <Route path="/:tenantSlug/songs" element={
              <ProtectedRoute>
                <Songs />
              </ProtectedRoute>
            } />
            <Route path="/:tenantSlug/songs/type/:type" element={
              <ProtectedRoute>
                <SongTypeDetails />
              </ProtectedRoute>
            } />
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
            <Route path="/:tenantSlug/songs/:id" element={
              <ProtectedRoute>
                <SongDetails />
              </ProtectedRoute>
            } />
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
            <Route path="/:tenantSlug/rehearsals" element={
              <ProtectedRoute>
                <Rehearsals />
              </ProtectedRoute>
            } />
            <Route path="/:tenantSlug/liturgy" element={
              <ProtectedRoute>
                <Liturgy />
              </ProtectedRoute>
            } />
            
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
            
            {/* Admin Dashboard with tenant prefix */}
            <Route
              path="/:tenantSlug/admin"
              element={
                <ProtectedRoute>
                  <AdminDashboard />
                </ProtectedRoute>
              }
            />
            
            {/* Redirect from old admin/user-approvals route to choir-members */}
            <Route
              path="/:tenantSlug/admin/user-approvals"
              element={<Navigate to="../choir-members" replace />}
            />
            
            <Route path="/:tenantSlug" element={
              <ProtectedRoute>
                <Home />
              </ProtectedRoute>
            } />
            
            {/* Default routes without tenant prefix */}
            <Route path="/events" element={
              <ProtectedRoute>
                <Events />
              </ProtectedRoute>
            } />
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
            <Route path="/events/:id" element={
              <ProtectedRoute>
                <SimpleEventAudios />
              </ProtectedRoute>
            } />
            <Route
              path="/events/:id/quick-edit"
              element={
                <ProtectedRoute>
                  <EventQuickEdit />
                </ProtectedRoute>
              }
            />
            <Route path="/events/:eventId/rehearsals" element={
              <ProtectedRoute>
                <Rehearsals />
              </ProtectedRoute>
            } />
            
            <Route path="/songs" element={
              <ProtectedRoute>
                <Songs />
              </ProtectedRoute>
            } />
            <Route path="/songs/type/:type" element={
              <ProtectedRoute>
                <SongTypeDetails />
              </ProtectedRoute>
            } />
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
            <Route path="/songs/:id" element={
              <ProtectedRoute>
                <SongDetails />
              </ProtectedRoute>
            } />
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
            <Route path="/rehearsals" element={
              <ProtectedRoute>
                <Rehearsals />
              </ProtectedRoute>
            } />
            <Route path="/liturgy" element={
              <ProtectedRoute>
                <Liturgy />
              </ProtectedRoute>
            } />
            
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
            
            {/* Admin Dashboard without tenant prefix */}
            <Route
              path="/admin"
              element={
                <ProtectedRoute>
                  <AdminDashboard />
                </ProtectedRoute>
              }
            />
            
            <Route path="/" element={<AuthOrTenantSelection />} />
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
