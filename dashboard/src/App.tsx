import { Routes, Route } from 'react-router-dom';
import { Layout } from './components/Layout';
import { RequireAuth } from './routes/RequireAuth';
import { LoginPage } from './pages/LoginPage';
import { LiveEmployeesPage } from './features/live-employees/LiveEmployeesPage';
import { EmployeeProfilePage } from './features/employee-profile/EmployeeProfilePage';
import { ReportsPage } from './features/reports/ReportsPage';
import { SettingsPage } from './features/settings/SettingsPage';
import { AdminUsersPage } from './features/admin-users/AdminUsersPage';

export function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route
        element={
          <RequireAuth>
            <Layout />
          </RequireAuth>
        }
      >
        <Route path="/" element={<LiveEmployeesPage />} />
        <Route path="/employees/:employeeId" element={<EmployeeProfilePage />} />
        <Route path="/reports" element={<ReportsPage />} />
        <Route path="/settings" element={<SettingsPage />} />
        <Route path="/admin-users" element={<AdminUsersPage />} />
      </Route>
    </Routes>
  );
}
