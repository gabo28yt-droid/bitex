import { lazy, Suspense } from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';

// Paginas publicas
const Splash = lazy(() => import('./pages/Splash'));
const Login = lazy(() => import('./pages/login'));
const Registro = lazy(() => import('./pages/registro'));
const RegistroRepartidor = lazy(() => import('./pages/registroRepartidor'));
const Bienvenida = lazy(() => import('./pages/bienvenida'));

// Paginas privadas
const DashboardDonante = lazy(() => import('./pages/dasboarDonante'));
const DashboardBeneficiario = lazy(() => import('./pages/dashboardbeneficiario'));
const DashboardRepartidor = lazy(() => import('./pages/dashboardRepartidor'));
const CrearDonaciones = lazy(() => import('./pages/crearDonaciones'));
const VerPedido = lazy(() => import('./pages/verPedido'));
const RastreoRepartidor = lazy(() => import('./pages/RastreoRepartidor'));

function App() {
  return (
    <Router>
      <Suspense fallback={<div style={{ padding: '40px', textAlign: 'center' }}>Cargando BiteX...</div>}>
      <Routes>
        {/* Rutas publicas */}
        <Route path="/" element={<Splash />} />
        <Route path="/index" element={<Login />} />
        <Route path="/registro" element={<Registro />} />
        <Route path="/registrorepartidor" element={<RegistroRepartidor />} />
        <Route path="/Bienvenida" element={<Bienvenida />} />

        {/* Rutas privadas */}
        <Route path="/dashboardona" element={<DashboardDonante />} />
        <Route path="/dashboardbene" element={<DashboardBeneficiario />} />
        <Route path="/dashboardbeneficiario" element={<DashboardBeneficiario />} />
        <Route path="/dashboardrepartidor" element={<DashboardRepartidor />} />
        <Route path="/donaciones" element={<CrearDonaciones />} />
        <Route path="/verpedido" element={<VerPedido />} />
        <Route path="/rastreo" element={<RastreoRepartidor />} />

        {/* 404 */}
        <Route path="*" element={
          <div style={{ padding: '40px', textAlign: 'center', fontSize: '18px' }}>
            404 - Pagina no encontrada
          </div>
        } />
      </Routes>
      </Suspense>
    </Router>
  );
}

export default App;