import { useState, useEffect, useRef } from 'react';
import { db, auth } from '../firebase/conifg';
import { doc, onSnapshot, updateDoc, setDoc } from 'firebase/firestore';
import { useNavigate, useLocation } from 'react-router-dom';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import 'leaflet-routing-machine/dist/leaflet-routing-machine.css';
import 'leaflet-routing-machine';

function VerPedido() {
    const [pedido, setPedido] = useState(null);
    const [distancia, setDistancia] = useState('Calculando...');
    const [tiempo, setTiempo] = useState('Calculando...');
    const [estadoEntrega, setEstadoEntrega] = useState('asignado');

    const mapRef = useRef(null);
    const mapInstanceRef = useRef(null);
    const marcadorRepartidorRef = useRef(null);
    const watchIdRef = useRef(null);

    const navigate = useNavigate();
    const location = useLocation();
    const pedidoId = location.state?.pedidoId;
    const repartidorId = auth.currentUser?.uid;

    // ── Escuchar pedido en tiempo real ──
    useEffect(() => {
        if (!pedidoId) return navigate('/dashboardrepartidor');
        const unsub = onSnapshot(doc(db, 'pedidos', pedidoId), (snap) => {
            if (snap.exists()) {
                const data = { id: snap.id, ...snap.data() };
                setPedido(data);
                setEstadoEntrega(data.estado);
            }
        });
        return () => unsub();
    }, [pedidoId, navigate]);

    // ── GPS: iniciar rastreo cuando hay pedido activo ──
    useEffect(() => {
        if (!pedido || !repartidorId) return;
        if (pedido.estado === 'entregado') return;

        if (!navigator.geolocation) {
            console.warn('Geolocalización no disponible en este dispositivo');
            return;
        }

        // Inicializar documento en Firestore
        setDoc(doc(db, 'ubicaciones', repartidorId), {
            lat: null,
            lng: null,
            pedidoId,
            activo: true,
            updatedAt: new Date(),
        });

        // Empezar a escuchar posición
        watchIdRef.current = navigator.geolocation.watchPosition(
            async (pos) => {
                const { latitude, longitude } = pos.coords;

                // Actualizar Firestore
                await setDoc(doc(db, 'ubicaciones', repartidorId), {
                    lat: latitude,
                    lng: longitude,
                    pedidoId,
                    activo: true,
                    updatedAt: new Date(),
                });

                // Mover marcador en el mapa si ya existe
                if (marcadorRepartidorRef.current) {
    marcadorRepartidorRef.current.setLatLng([latitude, longitude]);
    mapInstanceRef.current.panTo([latitude, longitude], { animate: true, duration: 1 });
}
            },
            (err) => console.error('Error GPS:', err),
            { enableHighAccuracy: true, maximumAge: 5000, timeout: 10000 }
        );

        return () => {
            // Limpiar watch al desmontar
            if (watchIdRef.current !== null) {
                navigator.geolocation.clearWatch(watchIdRef.current);
            }
        };
    }, [pedido, pedidoId, repartidorId]);

    // ── Mapa: inicializar cuando llega el pedido ──
    useEffect(() => {
        if (!pedido || mapInstanceRef.current) return;

        const map = L.map(mapRef.current).setView([13.6929, -89.2182], 13);
        mapInstanceRef.current = map;

        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            attribution: '&copy; OpenStreetMap',
        }).addTo(map);

        const iconoRepartidor = L.divIcon({
            html: '<div style="background:#016d3b;width:36px;height:36px;border-radius:50%;border:3px solid white;display:flex;justify-content:center;align-items:center;font-size:18px;box-shadow:0 2px 8px rgba(0,0,0,0.3)">🛵</div>',
            className: '',
            iconSize: [36, 36],
            iconAnchor: [18, 18],
        });

        const iconoDestino = L.divIcon({
            html: '<div style="background:#ff4d4d;width:36px;height:36px;border-radius:50%;border:3px solid white;display:flex;justify-content:center;align-items:center;font-size:18px;box-shadow:0 2px 8px rgba(0,0,0,0.3)">📍</div>',
            className: '',
            iconSize: [36, 36],
            iconAnchor: [18, 36],
        });

        const geocode = async (dir) => {
            const res = await fetch(
                `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(dir)}`
            );
            const data = await res.json();
            if (!data.length) return null;
            return [parseFloat(data[0].lat), parseFloat(data[0].lon)];
        };

       const iniciarMapa = async () => {
    // Usar coordenadas exactas si existen, si no intentar geocoding
    const origen = (pedido.origenLat && pedido.origenLng)
        ? [pedido.origenLat, pedido.origenLng]
        : await geocode(pedido.restaurante + ', El Salvador');

    const destino = await geocode(pedido.direccionEntrega + ', El Salvador');

    if (!origen || !destino) return;

            // Marcador destino (fijo)
            L.marker(destino, { icon: iconoDestino })
                .addTo(map)
                .bindPopup(`<b>Entregar en:</b><br>${pedido.direccionEntrega}`);

            // Marcador repartidor (se moverá)
            marcadorRepartidorRef.current = L.marker(origen, { icon: iconoRepartidor })
                .addTo(map)
                .bindPopup('📍 Repartidor');

            // Ruta
            const control = L.Routing.control({
    waypoints: [L.latLng(origen), L.latLng(destino)],
    routeWhileDragging: false,
    draggableWaypoints: false,
    addWaypoints: false,
    show: false,
    lineOptions: { styles: [{ color: '#016d3b', weight: 5, opacity: 0.8 }] },
    createMarker: () => null,
}).on('routesfound', (e) => {
    const km = (e.routes[0].summary.totalDistance / 1000).toFixed(1);
const minutos = Math.round((e.routes[0].summary.totalDistance / 1000) * 6);
 setDistancia(`${km} km`);
    setTiempo(`${minutos} min`);
    const container = control.getContainer();
    if (container) container.style.display = 'none';
}).addTo(map);

            map.fitBounds([origen, destino], { padding: [40, 40] });
        };

        iniciarMapa();
    }, [pedido]);

    // ── Cambiar estado a "en camino" ──
    const marcarEnCamino = async () => {
        await updateDoc(doc(db, 'pedidos', pedidoId), {
            estado: 'en_camino',
            fecha_en_camino: new Date(),
        });
    };

    // ── Marcar como entregado ──
    const marcarEntregado = async () => {
        await updateDoc(doc(db, 'pedidos', pedidoId), {
            estado: 'entregado',
            fecha_entrega: new Date(),
        });


        // Marcar la donación como entregada
        if (pedido.donacionId) {
            await updateDoc(doc(db, 'donaciones', pedido.donacionId), {
                estado: 'entregado',
                fecha_entrega: new Date(),
            });
        }


        // Detener GPS
        if (watchIdRef.current !== null) {
            navigator.geolocation.clearWatch(watchIdRef.current);
        }

        // Desactivar ubicación en Firestore
        await setDoc(doc(db, 'ubicaciones', repartidorId), {
            activo: false,
            pedidoId,
            updatedAt: new Date(),
        });

        navigate('/dashboardrepartidor');
    };

    if (!pedido) return (
        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', fontSize: '18px', color: '#016d3b' }}>
            Cargando pedido...
        </div>
    );

    return (
        <div style={vStyles.page}>
            {/* HEADER */}
            <div style={vStyles.header}>
                <div style={vStyles.circle}></div>
                    <button
    style={{
        ...vStyles.volverBtn,
        opacity: estadoEntrega !== 'entregado' ? 0.4 : 1,
        cursor: estadoEntrega !== 'entregado' ? 'not-allowed' : 'pointer',
    }}
    onClick={() => {
        if (estadoEntrega !== 'entregado') return;
        navigate('/dashboardrepartidor');
    }}
    title={estadoEntrega !== 'entregado' ? 'Completa la entrega primero' : 'Volver'}
>
    ←
</button>
                <h1 style={vStyles.title}>Pedido en Curso</h1>
                <p style={vStyles.sub}>Navegación activa hacia el cliente</p>
            </div>

            <div style={vStyles.contenido}>
                {/* INFO */}
                <div style={vStyles.infoCard}>
                    <h2 style={vStyles.infoTitle}>Ruta del pedido</h2>

                    {/* Estado badge */}
                    <div style={{ marginBottom: '16px' }}>
                        <span style={{
                            ...vStyles.estadoBadge,
                            background: estadoEntrega === 'en_camino' ? '#e3f0ff' : '#dfffe9',
                            color: estadoEntrega === 'en_camino' ? '#0066cc' : '#016d3b',
                        }}>
                            {estadoEntrega === 'en_camino' ? '🛵 En camino' : '📦 Asignado'}
                        </span>
                    </div>

                    {/* Ruta */}
                    <div style={vStyles.rutaBox}>
                        <div style={vStyles.puntoRuta}>
                            <div style={{ ...vStyles.circulo, background: '#00c46a' }}></div>
                            <div>
                                <span style={vStyles.rutaLabel}>Recoger en</span>
                                <strong style={vStyles.rutaVal}>{pedido.restaurante}</strong>
                            </div>
                        </div>
                        <div style={vStyles.lineaRuta}></div>
                        <div style={vStyles.puntoRuta}>
                            <div style={{ ...vStyles.circulo, background: '#ff4d4d' }}></div>
                            <div>
                                <span style={vStyles.rutaLabel}>Entregar en</span>
                                <strong style={vStyles.rutaVal}>{pedido.direccionEntrega}</strong>
                            </div>
                        </div>
                    </div>

                    {/* Métricas */}
                    {/* Métricas */}
                    <div style={vStyles.miniGrid}>
                        <div style={vStyles.mini}>
                            <span style={vStyles.miniLabel}>Distancia</span>
                            <strong style={vStyles.miniVal}>{distancia}</strong>
                        </div>
                        <div style={vStyles.mini}>
                            <span style={vStyles.miniLabel}>Costo delivery</span>
                            <strong style={vStyles.miniVal}>${pedido.precioDelivery?.toFixed(2)}</strong>
                        </div>
                        <div style={vStyles.mini}>
                            <span style={vStyles.miniLabel}>Tiempo estimado</span>
                            <strong style={vStyles.miniVal}>{tiempo}</strong>
                        </div>
                        <div style={vStyles.mini}>
                            <span style={vStyles.miniLabel}>Alimento</span>
                            <strong style={vStyles.miniVal}>{pedido.titulo || '—'}</strong>
                        </div>
                    </div>

                    {/* Cliente */}
                    <div style={vStyles.clienteBox}>
                        <img
                            src="https://cdn-icons-png.flaticon.com/512/3135/3135715.png"
                            alt="cliente"
                            style={vStyles.clienteFoto}
                        />
                        <div>
                            <h3 style={{ margin: 0, color: '#222' }}>{pedido.nombreCliente}</h3>
                            <p style={{ color: '#666', fontSize: '14px', marginTop: '4px' }}>
                                {estadoEntrega === 'en_camino' ? 'Cliente esperando entrega' : 'Pendiente de recogida'}
                            </p>
                        </div>
                    </div>

                    {/* Botones según estado */}
                    <div style={vStyles.botones}>
                        {estadoEntrega === 'asignado' && (
                            <button style={vStyles.btnPrincipal} onClick={marcarEnCamino}>
                                🛵 Iniciar entrega
                            </button>
                        )}
                        {estadoEntrega === 'en_camino' && (
                            <button style={vStyles.btnPrincipal} onClick={marcarEntregado}>
                                ✓ Pedido entregado
                            </button>
                        )}
                    </div>
                </div>

                {/* MAPA */}
                <div ref={mapRef} style={vStyles.mapa}></div>
            </div>
        </div>
    );
}

const vStyles = {
    page: { background: 'linear-gradient(135deg,#eef2f7,#dfe7f3)', minHeight: '100vh', padding: 'clamp(10px, 4vw, 18px)', paddingBottom: '40px' },
    header: { background: 'linear-gradient(135deg,#006d2f,#00a344)', borderRadius: '28px', padding: '28px', color: 'white', position: 'relative', overflow: 'hidden', boxShadow: '0 15px 35px rgba(0,0,0,0.12)', marginBottom: '20px', width: '100%', maxWidth: '1200px', boxSizing: 'border-box' },
    circle: { position: 'absolute', width: '220px', height: '220px', borderRadius: '50%', background: 'rgba(255,255,255,0.05)', top: '-80px', right: '-50px' },
    volverBtn: { width: '44px', height: '44px', border: 'none', borderRadius: '14px', background: 'rgba(255,255,255,0.15)', color: 'white', fontSize: '20px', cursor: 'pointer', marginBottom: '16px', display: 'block' },
    title: { fontSize: 'clamp(22px, 5vw, 32px)', margin: 0, color: 'white' },
    sub: { marginTop: '8px', color: '#d8ffe5', fontSize: '14px' },
    contenido: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '20px', maxWidth: '1100px', margin: '0 auto', width: '100%' },
    infoCard: { background: 'white', borderRadius: '24px', padding: '24px', boxShadow: '0 8px 25px rgba(0,0,0,0.08)' },
    infoTitle: { fontSize: '24px', color: '#222', marginBottom: '18px' },
    estadoBadge: { display: 'inline-block', padding: '6px 14px', borderRadius: '18px', fontSize: '12px', fontWeight: 'bold' },
    rutaBox: { background: '#f7f7f7', borderRadius: '18px', padding: '18px' },
    puntoRuta: { display: 'flex', alignItems: 'center', gap: '12px' },
    circulo: { width: '14px', height: '14px', borderRadius: '50%', flexShrink: 0 },
    lineaRuta: { width: '3px', height: '30px', background: '#ccc', marginLeft: '5px', marginTop: '4px', marginBottom: '4px', borderRadius: '10px' },
    rutaLabel: { display: 'block', fontSize: '12px', color: '#777', marginBottom: '3px' },
    rutaVal: { color: '#222', fontSize: '14px' },
    miniGrid: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginTop: '18px' },
    mini: { background: '#f7f7f7', borderRadius: '16px', padding: '16px' },
    miniLabel: { display: 'block', fontSize: '12px', color: '#777', marginBottom: '6px' },
    miniVal: { fontSize: '18px', color: '#222' },
    clienteBox: { marginTop: '18px', background: '#f7f7f7', borderRadius: '18px', padding: '16px', display: 'flex', alignItems: 'center', gap: '14px' },
    clienteFoto: { width: '56px', height: '56px', borderRadius: '50%', objectFit: 'cover' },
    botones: { display: 'flex', gap: '12px', marginTop: '18px' },
    btnPrincipal: { flex: 1, padding: '15px', border: 'none', borderRadius: '16px', background: 'linear-gradient(to right,#016d3b,#019c58)', color: 'white', fontSize: '14px', fontWeight: 'bold', cursor: 'pointer' },
    btnSecundario: { flex: 1, padding: '15px', border: 'none', borderRadius: '16px', background: '#ececec', color: '#444', fontSize: '14px', fontWeight: 'bold', cursor: 'pointer' },
    mapa: { height: 'clamp(300px, 50vw, 600px)', borderRadius: '24px', overflow: 'hidden', boxShadow: '0 8px 25px rgba(0,0,0,0.08)', position: 'sticky', top: '20px' },
};

export default VerPedido;