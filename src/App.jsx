import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';

// Páginas públicas
import Splash from './pages/Splash';
import Login from './pages/login';
import Registro from './pages/registro';
import RegistroRepartidor from './pages/registroRepartidor';
import Bienvenida from './pages/bienvenida';

// Páginas privadas (sin Navbar por ahora)
import DashboardDonante from './pages/dasboarDonante';
import DashboardBeneficiario from './pages/dashboardbeneficiario';
import DashboardRepartidor from './pages/dashboardRepartidor';
import CrearDonaciones from './pages/crearDonaciones';
import VerPedido from './pages/verPedido';
import RastreoRepartidor from './pages/RastreoRepartidor';

function App() {
  return (
    <Router>
      <Routes>
        {/* Rutas Públicas */}
        <Route path="/" element={<Splash />} />
        <Route path="/index" element={<Login />} />
        <Route path="/registro" element={<Registro />} />
        <Route path="/registrorepartidor" element={<RegistroRepartidor />} />
        <Route path="/Bienvenida" element={<Bienvenida />} />

        {/* Rutas Privadas (sin Navbar temporalmente) */}
        <Route path="/dashboardona" element={<DashboardDonante />} />
        <Route path="/dashboardbene" element={<DashboardBeneficiario />} />
        <Route path="/dashboardbeneficiario" element={<DashboardBeneficiario />} />
        <Route path="/dashboardrepartidor" element={<DashboardRepartidor />} />
        <Route path="/donaciones" element={<CrearDonaciones />} />
        <Route path="/verpedido" element={<VerPedido />} />
        <Route path="/rastreo" element={<RastreoRepartidor />} />

        {/* 404 */}
        <Route path="*" element={
          <div style={{ padding: "40px", textAlign: "center", fontSize: "18px" }}>
            404 - Página no encontrada
          </div>
        } />
      </Routes>
    </Router>
  );
}

export default App;