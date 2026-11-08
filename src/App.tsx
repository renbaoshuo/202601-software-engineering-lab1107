import { Route, Routes } from "react-router";
import AppLayout from "./components/AppLayout";
import About from "./pages/About";
import Budget from "./pages/Budget";
import Calendar from "./pages/Calendar";
import Dashboard from "./pages/Dashboard";
import DataManagement from "./pages/DataManagement";
import NotFound from "./pages/NotFound";
import Reports from "./pages/Reports";
import Savings from "./pages/Savings";
import Transactions from "./pages/Transactions";

export default function App() {
  return (
    <Routes>
      <Route element={<AppLayout />}>
        <Route element={<Dashboard />} path="/" />
        <Route element={<Transactions />} path="/transactions" />
        <Route element={<Calendar />} path="/calendar" />
        <Route element={<Reports />} path="/reports" />
        <Route element={<Budget />} path="/budget" />
        <Route element={<Savings />} path="/savings" />
        <Route element={<DataManagement />} path="/data" />
        <Route element={<About />} path="/about" />
        <Route element={<NotFound />} path="*" />
      </Route>
    </Routes>
  );
}
