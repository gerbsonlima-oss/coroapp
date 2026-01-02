import { Toaster } from "@/components/ui/sonner";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider } from "@/hooks/useAuth";
import { TenantProvider } from "@/contexts/TenantContext";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { RouteTracker } from "@/components/RouteTracker";
import { SplashScreen } from "@/components/SplashScreen";
import { lazy, Suspense, useMemo } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
const Home = lazy(() => import("./pages/Home"));
const Auth = lazy(() => import("./pages/Auth"));
const Events = lazy(() => import("./pages/Events"));
const NewEvent = lazy(() => import("./pages/NewEvent"));
const EditEvent = lazy(() => import("./pages/EditEvent"));
const EventDetails = lazy(() => import("./pages/EventDetails"));
const EventQuickEdit = lazy(() => import("./pages/EventQuickEdit"));
const Songs = lazy(() => import("./pages/Songs"));
const SongForm = lazy(() => import("./pages/SongForm"));
const SongDetails = lazy(() => import("./pages/SongDetails"));
const SongTypeDetails = lazy(() => import("./pages/SongTypeDetails"));
const AdminSongTypes = lazy(() => import("./pages/AdminSongTypes"));
const AudioToSheet = lazy(() => import("./pages/AudioToSheet"));
const Rehearsals = lazy(() => import("./pages/Rehearsals"));

const Liturgy = lazy(() => import("./pages/Liturgy"));
const NotFound = lazy(() => import("./pages/NotFound"));

const LoadingFallback = () => (
  <div className="flex items-center justify-center min-h-screen">
    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary" />
  </div>
);

function App() {
  const queryClient = useMemo(() => new QueryClient(), []);

  return (
    <>
      <SplashScreen />
      <BrowserRouter>
      <QueryClientProvider client={queryClient}>
      <TenantProvider>
      <AuthProvider>
        <RouteTracker />
        <Toaster />
        <Suspense fallback={<LoadingFallback />}>
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
            
            <Route path="/liturgy" element={<Liturgy />} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </Suspense>
      </AuthProvider>
      </TenantProvider>
      </QueryClientProvider>
      </BrowserRouter>
    </>
  );
}

export default App;
