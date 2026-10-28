import { Routes, Route } from "react-router-dom";
import StorePage from "@/pages/Store";
import AdminLogin from "@/pages/AdminLogin";
import AdminDashboard from "@/pages/AdminDashboard";
import { Toaster } from "@/components/ui/sonner";
import { CartProvider } from "@/lib/cart";

// One <Route> per page in src/pages; BrowserRouter already wraps this in main.tsx.
export default function App() {
  return (
    <CartProvider>
      <Routes>
        <Route path="/" element={<StorePage />} />
        <Route path="/admin" element={<AdminLogin />} />
        <Route path="/admin/painel" element={<AdminDashboard />} />
        <Route path="*" element={<StorePage />} />
      </Routes>
      <Toaster richColors position="bottom-right" mobileOffset={{ bottom: 96 }} duration={2200} />
    </CartProvider>
  );
}
