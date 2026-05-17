import { Routes, Route, Navigate } from "react-router-dom";
import { AppProvider, useApp } from "./store/AppContext.jsx";
import { ToastProvider } from "./components/Toast.jsx";

import TopPage from "./pages/TopPage.jsx";
import LoginPage from "./pages/LoginPage.jsx";
import TabsLayout from "./pages/TabsLayout.jsx";
import HomePage from "./pages/HomePage.jsx";
import LearnPage from "./pages/LearnPage.jsx";
import QuestionSettingsPage from "./pages/QuestionSettingsPage.jsx";
import BooksPage from "./pages/BooksPage.jsx";
import BookDetailPage from "./pages/BookDetailPage.jsx";
import WordbooksPage from "./pages/WordbooksPage.jsx";
import WordDetailPage from "./pages/WordDetailPage.jsx";
import LibraryPage from "./pages/LibraryPage.jsx";
import StatsPage from "./pages/StatsPage.jsx";
import SettingsPage from "./pages/SettingsPage.jsx";
import NotificationsPage from "./pages/NotificationsPage.jsx";
import AdminPage from "./pages/AdminPage.jsx";
import SchedulePage from "./pages/SchedulePage.jsx";
import NotFound from "./pages/NotFound.jsx";

function Guard({ children }) {
  const { state } = useApp();
  if (!state.booted) {
    return (
      <div className="container">
        <div className="card">起動中…</div>
      </div>
    );
  }
  if (!state.session) return <Navigate to="/login" replace />;
  return children;
}

function AppRoutes() {
  const { state } = useApp();
  const showAdmin =
    state.session?.role === "admin" ||
    state.session?.role === "manager" ||
    state.session?.role === "teacher";

  return (
    <Routes>
      <Route path="/" element={<TopPage />} />
      <Route path="/login" element={<LoginPage />} />

      <Route
        path="/app"
        element={
          <Guard>
            <TabsLayout showAdmin={showAdmin} />
          </Guard>
        }
      >
        <Route index element={<Navigate to="home" replace />} />
        <Route path="home" element={<HomePage />} />
        <Route path="learn" element={<LearnPage />} />
        <Route path="question-settings" element={<QuestionSettingsPage />} />
        <Route path="books" element={<BooksPage />} />
        <Route path="books/:bookId" element={<BookDetailPage />} />
        <Route path="wordbooks" element={<WordbooksPage />} />
        <Route path="word/:wordKey" element={<WordDetailPage />} />
        <Route path="library" element={<LibraryPage />} />
        <Route path="stats" element={<StatsPage />} />
        <Route path="settings" element={<SettingsPage />} />
        <Route path="notifications" element={<NotificationsPage />} />
        <Route path="schedule" element={<SchedulePage />} />
        {showAdmin && <Route path="admin" element={<AdminPage />} />}
        <Route path="*" element={<Navigate to="home" replace />} />
      </Route>

      <Route path="*" element={<NotFound />} />
    </Routes>
  );
}

export default function App() {
  return (
    <AppProvider>
      <ToastProvider>
        <AppRoutes />
      </ToastProvider>
    </AppProvider>
  );
}
