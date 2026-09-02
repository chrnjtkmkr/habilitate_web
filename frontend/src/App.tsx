import { lazy, Suspense } from 'react';
import { Routes, Route, Navigate, useParams } from 'react-router-dom';
import { useAuth } from './hooks/useAuth';
import AppShell from './layout/AppShell';
import ToastContainer from './components/Toast';
import RouteErrorBoundary from './components/states/RouteErrorBoundary';
import TourOverlay from './components/tour/TourOverlay';

const SignIn = lazy(() => import('./pages/SignIn'));
const Signup = lazy(() => import('./pages/Signup'));
const ForgotPassword = lazy(() => import('./pages/ForgotPassword'));
const ResetPassword = lazy(() => import('./pages/ResetPassword'));
const Demo = lazy(() => import('./pages/Demo'));
const NoCenter = lazy(() => import('./pages/NoCenter'));
const CreateCenter = lazy(() => import('./pages/CreateCenter'));
const Dashboard = lazy(() => import('./pages/Dashboard'));
const Roster = lazy(() => import('./pages/Roster'));
const Children = lazy(() => import('./pages/Children'));
const ChildNew = lazy(() => import('./pages/ChildNew'));
const ChildDetail = lazy(() => import('./pages/ChildDetail'));
const ChildEdit = lazy(() => import('./pages/ChildEdit'));
const Sessions = lazy(() => import('./pages/Sessions'));
const IntakeWizard = lazy(() => import('./pages/IntakeWizard'));
const CameraDiagnostics = lazy(() => import('./pages/CameraDiagnostics'));
const ChildGoals = lazy(() => import('./pages/ChildGoals'));
const SessionRun = lazy(() => import('./pages/SessionRun'));
const SessionSummary = lazy(() => import('./pages/SessionSummary'));
const ChildProgress = lazy(() => import('./pages/ChildProgress'));
const ChildReports = lazy(() => import('./pages/ChildReports'));
const ReportEditor = lazy(() => import('./pages/ReportEditor'));
const MyWork = lazy(() => import('./pages/MyWork'));
const Account = lazy(() => import('./pages/Account'));

function PageSpinner() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background">
      <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary-200 border-t-primary-600" />
    </div>
  );
}

function RequireAuth({ children }: { children: React.ReactNode }) {
  const { user, isLoading, memberships, membershipsLoading } = useAuth();

  if (isLoading || membershipsLoading) {
    return <PageSpinner />;
  }

  if (!user) return <Navigate to="/signin" replace />;
  if (memberships.length === 0) return <Navigate to="/create-center" replace />;
  return <>{children}</>;
}

function IntakeWizardKeyed() {
  const { id } = useParams<{ id: string }>();
  return <IntakeWizard key={id} />;
}

export default function App() {
  return (
    <>
      <Suspense fallback={<PageSpinner />}>
        <Routes>
          <Route path="/signin" element={<SignIn />} />
          <Route path="/signup" element={<Signup />} />
          <Route path="/forgot-password" element={<ForgotPassword />} />
          <Route path="/reset-password" element={<ResetPassword />} />
          <Route path="/demo" element={<Demo />} />
          <Route path="/no-center" element={<NoCenter />} />
          <Route path="/create-center" element={<CreateCenter />} />
          <Route path="/sessions/:id/run" element={<RequireAuth><RouteErrorBoundary><SessionRun /></RouteErrorBoundary></RequireAuth>} />
          <Route path="/sessions/:id/summary" element={<RequireAuth><RouteErrorBoundary><SessionSummary /></RouteErrorBoundary></RequireAuth>} />
          <Route
            element={
              <RequireAuth>
                <AppShell />
              </RequireAuth>
            }
          >
            <Route index element={<Navigate to="/dashboard" replace />} />
            <Route path="dashboard" element={<RouteErrorBoundary><Dashboard /></RouteErrorBoundary>} />
            <Route path="roster" element={<Roster />} />
            <Route path="children" element={<Children />} />
            <Route path="children/new" element={<ChildNew />} />
            <Route path="children/:id" element={<ChildDetail />} />
            <Route path="children/:id/edit" element={<ChildEdit />} />
            <Route path="children/:id/intake" element={<IntakeWizardKeyed />} />
            <Route path="children/:id/goals" element={<ChildGoals />} />
            <Route path="children/:id/progress" element={<ChildProgress />} />
            <Route path="children/:id/reports" element={<ChildReports />} />
            <Route path="children/:id/reports/:reportId" element={<ReportEditor />} />
            <Route path="sessions" element={<Sessions />} />
            <Route path="my-work" element={<MyWork />} />
            <Route path="account" element={<Account />} />
            <Route path="diagnostics/camera" element={<CameraDiagnostics />} />
          </Route>
        </Routes>
      </Suspense>
      <TourOverlay />
      <ToastContainer />
    </>
  );
}
