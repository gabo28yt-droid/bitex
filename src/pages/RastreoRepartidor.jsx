import { useState, useEffect, useRef } from 'react';
import { db } from '../firebase/conifg';
import { doc, onSnapshot } from 'firebase/firestore';
import { useNavigate, useLocation } from 'react-router-dom';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import 'leaflet-routing-machine/dist/leaflet-routing-machine.css';
import 'leaflet-routing-machine';

function RastreoRepartidor() {
    const [ubicacion, setUbicacion] = useState(null);
    const [pedido, setPedido] = useState(null);
    const [loading, setLoading] = useState(true);
    const [distancia, setDistancia] = useState('Calculando...');
    const [tiempo, setTiempo] = useState('Calculando...');

    const mapRef = useRef(null);
    const mapInstanceRef = useRef(null);
    const markerRef = useRef(null);

    const navigate = useNavigate();
    const location = useLocation();

    const pedidoId = location.state?.pedidoId;
    const repartidorId = location.state?.repartidorId;

    // 1 — Escuchar pedido
    useEffect(() => {
        if (!pedidoId) {
            navigate(-1);
            return;
        }
                        const unsub = onSnapshot(doc(db, 'pedidos', pedidoId), (snap) => {
    if (snap.exists()) {
        const data = { id: snap.id, ...snap.data() };
        setPedido(data);
        if (data.estado === 'entregado') {
            setTimeout(() => navigate(-1), 3000);
        }
    }
    setLoading(false);
});
        return () => unsub();
    }, [pedidoId, navigate]);

    // 2 — Inicializar mapa cuando llega el pedido
    useEffect(() => {
        if (!pedido || mapInstanceRef.current) return;

        const map = L.map(mapRef.current).setView([13.6929, -89.2182], 13);
        mapInstanceRef.current = map;

        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            attribution: '&copy; OpenStreetMap'
        }).addTo(map);

        // Marcador de destino fijo


        const iconoDestino = L.divIcon({
            html: '<div style="background:#ff4d4d;width:36px;height:36px;border-radius:50%;border:3px solid white;display:flex;justify-content:center;align-items:center;font-size:18px;box-shadow:0 2px 8px rgba(0,0,0,0.3)">📍</div>',
            className: '',
            iconSize: [36, 36],
            iconAnchor: [18, 36],
        });

       const geocode = async (dir) => {
    try {
        const res = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(dir + ', El Salvador')}`);
        const data = await res.json();
        if (!data.length) return null;
        return [parseFloat(data[0].lat), parseFloat(data[0].lon)];
    } catch { return null; }
};

const dibujarRuta = async () => {
    // Usar coordenadas exactas del pedido si existen
    const origen = (pedido.origenLat && pedido.origenLng)
        ? [pedido.origenLat, pedido.origenLng]
        : await geocode(pedido.restaurante);

    const destino = await geocode(pedido.direccionEntrega);



    if (destino) {
        L.marker(destino, { icon: iconoDestino })
            .addTo(map)
            .bindPopup(`<b>Destino:</b><br>${pedido.direccionEntrega}`);
    }

    if (origen && destino) {
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
    } else if (destino) {
        map.setView(destino, 14);
    }
};

dibujarRuta();
    }, [pedido]);

    // 3 — Escuchar ubicación del repartidor y mover marcador
    useEffect(() => {
        if (!repartidorId || !mapInstanceRef.current) return;

        const iconoRepartidor = L.divIcon({
            html: '<div style="background:#016d3b;width:40px;height:40px;border-radius:50%;border:3px solid white;display:flex;justify-content:center;align-items:center;font-size:20px;box-shadow:0 2px 8px rgba(0,0,0,0.3)">🛵</div>',
            className: '',
            iconSize: [40, 40],
            iconAnchor: [20, 20],
        });

        const unsub = onSnapshot(doc(db, 'ubicaciones', repartidorId), (snap) => {
            if (!snap.exists()) return;
            const data = snap.data();
            setUbicacion(data);

            if (!data.lat || !data.lng || !mapInstanceRef.current) return;

            const latlng = [data.lat, data.lng];

            if (!markerRef.current) {
                // Crear marcador la primera vez
                markerRef.current = L.marker(latlng, { icon: iconoRepartidor })
                    .addTo(mapInstanceRef.current)
                    .bindPopup('🛵 Repartidor en camino');
                mapInstanceRef.current.flyTo(latlng, 15);
            } else {
    // Mover marcador existente
    markerRef.current.setLatLng(latlng);
    mapInstanceRef.current.panTo(latlng, { animate: true, duration: 1 });
}
        });

        return () => unsub();
    }, [repartidorId, pedido]);

    if (loading) return (
        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', fontSize: '18px', color: '#016d3b' }}>
            Cargando rastreo...
        </div>
    );

    if (!pedido) return (
        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', fontSize: '18px', color: '#666' }}>
            Pedido no encontrado
        </div>
    );

    const entregado = pedido.estado === 'entregado';

    return (
        <div style={r.page}>
            {/* HEADER */}
            <div style={r.header}>
                <div style={r.circle}></div>
                <button style={r.volverBtn} onClick={() => navigate(-1)}>←</button>
                <h1 style={r.titulo}>Rastreo en Vivo</h1>
                <p style={r.subtitulo}>
                    {entregado ? '✅ Pedido entregado' : '🛵 Repartidor en camino'}
                </p>
            </div>

            <div style={r.contenido}>
                {/* INFO CARD */}
                <div style={r.infoCard}>
                    <div style={{
                        ...r.estadoBadge,
                        background: entregado ? '#e3ffea' : '#e3f0ff',
                        color: entregado ? '#009944' : '#0066cc',
                        marginBottom: '16px'
                    }}>
                        {entregado ? '✅ Entregado' : '🛵 En camino'}
                    </div>

                    <div style={r.rutaBox}>
                        <div style={r.puntoRuta}>
                            <div style={{ ...r.circulo, background: '#00b85c' }}></div>
                            <div>
                                <span style={r.rutaLabel}>Recogida en</span>
                                <strong style={r.rutaVal}>{pedido.restaurante || '—'}</strong>
                            </div>
                        </div>
                        <div style={r.lineaRuta}></div>
                        <div style={r.puntoRuta}>
                            <div style={{ ...r.circulo, background: '#ff4d4d' }}></div>
                            <div>
                                <span style={r.rutaLabel}>Entregar en</span>
                                <strong style={r.rutaVal}>{pedido.direccionEntrega}</strong>
                            </div>
                        </div>
                    </div>

                   <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginTop: '16px' }}>
                        <div style={r.mini}>
                            <span style={r.miniLabel}>Cliente</span>
                            <strong style={{ fontSize: '14px', color: '#222' }}>{pedido.nombreCliente}</strong>
                        </div>
                        <div style={r.mini}>
                            <span style={r.miniLabel}>GPS repartidor</span>
                            <strong style={{ fontSize: '14px', color: ubicacion?.activo ? '#009944' : '#888' }}>
                                {ubicacion?.activo ? '🟢 Activo' : '⏳ Esperando...'}
                            </strong>
                        </div>
                        <div style={r.mini}>
                            <span style={r.miniLabel}>Distancia</span>
                            <strong style={{ fontSize: '14px', color: '#222' }}>{distancia}</strong>
                        </div>
                        <div style={r.mini}>
                            <span style={r.miniLabel}>Tiempo estimado</span>
                            <strong style={{ fontSize: '14px', color: '#222' }}>{tiempo}</strong>
                        </div>
                        <div style={r.mini}>
                            <span style={r.miniLabel}>Donación</span>
                            <strong style={{ fontSize: '14px', color: '#222' }}>{pedido.titulo || '—'}</strong>
                        </div>
                    </div>

                    {!ubicacion?.activo && (
                        <div style={r.aviso}>
                            📡 Esperando que el repartidor active su ubicación...
                        </div>
                    )}
                </div>

                {/* MAPA */}
                <div ref={mapRef} style={r.mapa}></div>
            </div>
        </div>
    );
}

const r = {
    page: { background: 'linear-gradient(135deg,#eef2f7,#dfe7f3)', minHeight: '100vh', padding: 'clamp(10px, 4vw, 18px)', fontFamily: 'Arial, Helvetica, sans-serif', boxSizing: 'border-box', display: 'flex', flexDirection: 'column', alignItems: 'center' },
    header: { background: 'linear-gradient(135deg,#006d2f,#00a344)', color: 'white', padding: '28px', borderRadius: '28px', marginBottom: '20px', position: 'relative', overflow: 'hidden', boxShadow: '0 15px 35px rgba(0,0,0,0.12)', width: '100%', maxWidth: '1200px', boxSizing: 'border-box' },        circle:     { position: 'absolute', width: '220px', height: '220px', borderRadius: '50%', background: 'rgba(255,255,255,0.05)', top: '-80px', right: '-50px' },
    volverBtn:  { width: '44px', height: '44px', border: 'none', borderRadius: '14px', background: 'rgba(255,255,255,0.15)', color: 'white', fontSize: '20px', cursor: 'pointer', marginBottom: '16px', display: 'block' },
titulo:     { fontSize: 'clamp(22px, 5vw, 32px)', margin: 0, color: 'white', fontWeight: 800 },    subtitulo:  { marginTop: '8px', color: '#d8ffe5', fontSize: '14px' },
contenido: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '28px', maxWidth: '1100px', margin: '0 auto', width: '100%' },    infoCard:   { background: 'white', borderRadius: '24px', padding: '24px', boxShadow: '0 8px 25px rgba(0,0,0,0.08)' },
    estadoBadge:{ display: 'inline-block', padding: '6px 14px', borderRadius: '18px', fontSize: '12px', fontWeight: 'bold' },
    rutaBox:    { background: '#f7f7f7', borderRadius: '18px', padding: '18px' },
    puntoRuta:  { display: 'flex', alignItems: 'center', gap: '12px' },
    circulo:    { width: '14px', height: '14px', borderRadius: '50%', flexShrink: 0 },
    lineaRuta:  { width: '3px', height: '30px', background: '#ccc', marginLeft: '5px', marginTop: '4px', marginBottom: '4px', borderRadius: '10px' },
    rutaLabel:  { display: 'block', fontSize: '12px', color: '#777', marginBottom: '3px' },
    rutaVal:    { color: '#222', fontSize: '14px' },
    mini:       { background: '#f7f7f7', borderRadius: '16px', padding: '16px' },
    miniLabel:  { display: 'block', fontSize: '12px', color: '#777', marginBottom: '6px' },
    aviso:      { marginTop: '16px', background: '#fff3cd', color: '#856404', padding: '14px', borderRadius: '14px', textAlign: 'center', fontSize: '13px', fontWeight: '500' },
    mapa:       { height: 'clamp(300px, 50vw, 550px)', borderRadius: '24px', overflow: 'hidden', boxShadow: '0 8px 25px rgba(0,0,0,0.08)', position: 'sticky', top: '20px' },
};

export default RastreoRepartidor;