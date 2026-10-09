// DashboardBeneficiario.jsx
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Toast } from '../components/Toast';
import { useToast } from '../components/useToast';
import { db, auth } from '../firebase/conifg';
import {
    collection, query, where, onSnapshot,
    addDoc, doc, getDocs, updateDoc, deleteDoc
} from 'firebase/firestore';
import { onAuthStateChanged, signOut } from 'firebase/auth';
import { useNavigate } from 'react-router-dom';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';



/* ── CONFIRM MODAL ── */
function ConfirmModal({ confirm, onCancel, onAccept }) {
    if (!confirm) return null;
    return (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.55)', zIndex: 9998, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <div style={{ background: 'white', borderRadius: '26px', padding: '28px 24px', width: '88%', maxWidth: '360px', textAlign: 'center', boxShadow: '0 20px 50px rgba(0,0,0,0.2)' }}>
                <div style={{ width: '64px', height: '64px', background: '#fff3cd', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 18px', fontSize: '32px' }}>⚠️</div>
                <h3 style={{ fontSize: '18px', color: '#222', marginBottom: '10px' }}>¿Estás seguro?</h3>
                <p style={{ fontSize: '14px', color: '#666', lineHeight: 1.6, marginBottom: '24px' }}>{confirm.message}</p>
                <div style={{ display: 'flex', gap: '12px' }}>
                    <button style={{ flex: 1, padding: '13px', border: 'none', borderRadius: '16px', background: '#f0f0f0', color: '#555', fontSize: '14px', fontWeight: 'bold', cursor: 'pointer' }} onClick={onCancel}>Cancelar</button>
                    <button style={{ flex: 1, padding: '13px', border: 'none', borderRadius: '16px', background: 'linear-gradient(to right,#a00000,#ff3b3b)', color: 'white', fontSize: '14px', fontWeight: 'bold', cursor: 'pointer' }} onClick={onAccept}>Confirmar</button>
                </div>
            </div>
        </div>
    );
}

/* ── LIGHTBOX (visor de imagen en pantalla completa) ── */
// Se muestra cuando "src" tiene un valor (URL de la imagen).
// Al hacer clic en el fondo oscuro o en el botón ✕ se cierra (onClose).
function Lightbox({ src, alt, onClose }) {
    if (!src) return null;
    return (
        <div
            onClick={onClose}
            style={{
                position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
                background: 'rgba(0,0,0,0.85)', zIndex: 10000,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                padding: '20px', cursor: 'zoom-out',
            }}
        >
            <button
                onClick={onClose}
                style={{
                    position: 'absolute', top: '18px', right: '18px',
                    width: '42px', height: '42px', borderRadius: '50%',
                    background: 'rgba(255,255,255,0.15)', border: '1px solid rgba(255,255,255,0.3)',
                    color: 'white', fontSize: '20px', cursor: 'pointer',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}
            >✕</button>
            <img
                src={src}
                alt={alt || ''}
                onClick={(e) => e.stopPropagation()}
                style={{
                    maxWidth: '100%', maxHeight: '90vh',
                    borderRadius: '16px', objectFit: 'contain',
                    boxShadow: '0 20px 60px rgba(0,0,0,0.5)', cursor: 'default',
                }}
            />
        </div>
    );
}

function useIsMobile() {
    const [isMobile, setIsMobile] = React.useState(window.innerWidth < 640);
    React.useEffect(() => {
        const handler = () => setIsMobile(window.innerWidth < 640);
        window.addEventListener('resize', handler);
        return () => window.removeEventListener('resize', handler);
    }, []);
    return isMobile;
}

function DashboardBeneficiario() {
    const [userData, setUserData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [uid, setUid] = useState(null);
    const [pestana, setPestana] = useState('inicio');
    const [pedidosActivos, setPedidosActivos] = useState([]);
    const [notificacionesVistas, setNotificacionesVistas] = useState(new Set());
    const navigate = useNavigate();

    const [contadores, setContadores] = useState({
        total: 0,
        aprobadas: 0,
        rechazadas: 0,
        pendientes: 0,
        entregadas: 0
    });

    const [editandoPerfil, setEditandoPerfil] = useState(false);
    const [nuevoNombre, setNuevoNombre] = useState('');
    const [nuevoTelefono, setNuevoTelefono] = useState('');
    const [nuevaDireccion, setNuevaDireccion] = useState('');
    const [nuevoCorreo, setNuevoCorreo] = useState('');

    const { toasts, showToast, removeToast } = useToast();
    const [confirmData, setConfirmData] = useState(null);

    // Imagen actualmente abierta en el visor (lightbox). null = cerrado.
    const [lightboxSrc, setLightboxSrc] = useState(null);


    const showConfirm = useCallback((message, onConfirm) => {
        setConfirmData({ message, onConfirm });
    }, []);

    const handleConfirmAccept = () => {
        if (confirmData?.onConfirm) confirmData.onConfirm();
        setConfirmData(null);
    };

    useEffect(() => {
        const unsub = onAuthStateChanged(auth, async (user) => {
            if (user) {
                setUid(user.uid);
                const q = query(collection(db, 'usuarios'), where('uid', '==', user.uid));
                const snap = await getDocs(q);
                if (!snap.empty) setUserData(snap.docs[0].data());

                const qPedidos = query(collection(db, 'pedidos'), where('beneficiarioId', '==', user.uid));
                onSnapshot(qPedidos, snap => {
                    const lista = snap.docs.map(d => ({ id: d.id, ...d.data() }));

                    const total = lista.length;
                    const aprobadas = lista.filter(p => ['asignado', 'reservado', 'en_camino', 'entregado'].includes(p.estado)).length;
                    const rechazadas = lista.filter(p => ['cancelado', 'rechazado'].includes(p.estado)).length;
                    const pendientes = lista.filter(p => p.estado === 'pendiente').length;
                    const entregadas = lista.filter(p => p.estado === 'entregado').length;

                    setContadores({ total, aprobadas, rechazadas, pendientes, entregadas });
                    setPedidosActivos(lista);
                });
            } else {
                navigate('/index');
            }
            setLoading(false);
        });
        return () => unsub();
    }, [navigate]);

    const marcarComoVista = (ids) => {
        setNotificacionesVistas(prev => {
            const nuevo = new Set(prev);
            ids.forEach(id => nuevo.add(id));
            return nuevo;
        });
    };

    const guardarCambiosPerfil = async () => {
        try {
            const q = query(collection(db, 'usuarios'), where('uid', '==', uid));
            const snap = await getDocs(q);
            if (!snap.empty) {
                const docId = snap.docs[0].id;
                const datosActualizados = {
                    nombre: nuevoNombre || userData?.nombre,
                    telefono: nuevoTelefono || userData?.telefono,
                    direccion: nuevaDireccion || userData?.direccion,
                    correo: nuevoCorreo || userData?.correo,
                };
                await updateDoc(doc(db, 'usuarios', docId), datosActualizados);
                setUserData(prev => ({ ...prev, ...datosActualizados }));
                setEditandoPerfil(false);
                showToast('¡Tu perfil ha sido actualizado con éxito!', 'success');
            }
        } catch (error) {
            console.error('Error al actualizar el perfil:', error);
            showToast('Hubo un error al guardar los cambios.', 'error');
        }
    };

    const activarEdicion = () => {
        setNuevoNombre(userData?.nombre || '');
        setNuevoTelefono(userData?.telefono || '');
        setNuevaDireccion(userData?.direccion || '');
        setNuevoCorreo(userData?.correo || '');
        setEditandoPerfil(true);
    };

    if (loading) return <div style={s.loading}>Cargando...</div>;

    if (pestana === 'donaciones') return (
        <>
            <Toast toasts={toasts} removeToast={removeToast} />
            <ConfirmModal confirm={confirmData} onCancel={() => setConfirmData(null)} onAccept={handleConfirmAccept} />
            <Lightbox src={lightboxSrc} alt="Imagen de la donación" onClose={() => setLightboxSrc(null)} />
            <Donaciones uid={uid} userData={userData} onVolver={() => setPestana('inicio')} setPestana={setPestana} showToast={showToast} showConfirm={showConfirm} setLightboxSrc={setLightboxSrc} />
        </>
    );
    if (pestana === 'solicitudes') return (
        <>
            <Toast toasts={toasts} removeToast={removeToast} />
            <ConfirmModal confirm={confirmData} onCancel={() => setConfirmData(null)} onAccept={handleConfirmAccept} />
            <Solicitudes uid={uid} onVolver={() => setPestana('inicio')} setPestana={setPestana} contadores={contadores} navigate={navigate} showToast={showToast} showConfirm={showConfirm} />
        </>
    );
    if (pestana === 'perfil') return (
        <>
            <Toast toasts={toasts} removeToast={removeToast} />
            <ConfirmModal confirm={confirmData} onCancel={() => setConfirmData(null)} onAccept={handleConfirmAccept} />
            <PerfilBene
                uid={uid}
                userData={userData}
                onVolver={() => setPestana('inicio')}
                navigate={navigate}
                setPestana={setPestana}
                contadores={contadores}
                editandoPerfil={editandoPerfil}
                setEditandoPerfil={setEditandoPerfil}
                nuevoNombre={nuevoNombre}
                setNuevoNombre={setNuevoNombre}
                nuevoTelefono={nuevoTelefono}
                setNuevoTelefono={setNuevoTelefono}
                nuevaDireccion={nuevaDireccion}
                setNuevaDireccion={setNuevaDireccion}
                nuevoCorreo={nuevoCorreo}
                setNuevoCorreo={setNuevoCorreo}
                activarEdicion={activarEdicion}
                guardarCambiosPerfil={guardarCambiosPerfil}
            />
        </>
    );

    const notifAprobadas = pedidosActivos.filter(p =>
        ['asignado', 'reservado', 'en_camino', 'entregado'].includes(p.estado) && !notificacionesVistas.has(p.id)
    );
    const notifRechazadas = pedidosActivos.filter(p =>
        ['cancelado', 'rechazado'].includes(p.estado) && !notificacionesVistas.has(p.id)
    );

    return (
        <div style={s.page}>
            <Toast toasts={toasts} removeToast={removeToast} />
            <ConfirmModal confirm={confirmData} onCancel={() => setConfirmData(null)} onAccept={handleConfirmAccept} />
            <div style={s.dashboard}>
                <div style={s.header}>
                    <div style={s.headerCircle}></div>
                    <div style={s.headerContent}>
                        <div>
                            <h1 style={s.titulo}>¡Hola, {userData?.nombre?.split(' ')[0]}! 👋</h1>
                            <p style={s.subtitulo}>Estamos aquí para apoyarte</p>
                        </div>
                        <img src="https://cdn-icons-png.flaticon.com/512/149/149071.png" alt="perfil" style={s.foto} />
                    </div>
                </div>

                <div style={s.contenido}>
                    {notifAprobadas.length > 0 && (
                        <div style={s.alertaAprobada} onClick={() => { marcarComoVista(notifAprobadas.map(p => p.id)); setPestana('solicitudes'); }}>
                            <span style={{ fontSize: '24px' }}>✅</span>
                            <div style={{ flex: 1 }}>
                                <strong style={{ color: '#0a5c2e', fontSize: '15px' }}>
                                    {notifAprobadas.length} solicitud{notifAprobadas.length > 1 ? 'es' : ''} aprobada{notifAprobadas.length > 1 ? 's' : ''}
                                </strong>
                                <p style={{ fontSize: '13px', color: '#0c7b3e', marginTop: '2px' }}>Revisa cómo se entregará tu donación</p>
                            </div>
                            <span style={{ color: '#0c7b3e', fontSize: '22px' }}>›</span>
                        </div>
                    )}

                    {notifRechazadas.length > 0 && (
                        <div style={s.alertaRechazada} onClick={() => { marcarComoVista(notifRechazadas.map(p => p.id)); setPestana('solicitudes'); }}>
                            <span style={{ fontSize: '24px' }}>❌</span>
                            <div style={{ flex: 1 }}>
                                <strong style={{ color: '#7a0000', fontSize: '15px' }}>
                                    {notifRechazadas.length} solicitud{notifRechazadas.length > 1 ? 'es' : ''} rechazada{notifRechazadas.length > 1 ? 's' : ''}
                                </strong>
                                <p style={{ fontSize: '13px', color: '#a00000', marginTop: '2px' }}>Puedes buscar otra donación disponible.</p>
                            </div>
                            <span style={{ color: '#a00000', fontSize: '22px' }}>›</span>
                        </div>
                    )}

                    <div style={s.cardPrincipal}>
                        <div style={s.iconoPrincipal}>❤️</div>
                        <div style={{ flex: 1 }}>
                            <h2 style={s.cardH2}>Comida en donación disponible cerca de ti</h2>
                            <p style={s.cardP}>Encuentra alimentos disponibles para ser entregados a personas y familias que lo necesiten.</p>
                            <button style={s.botonPrincipal} onClick={() => setPestana('donaciones')}>
                                Ver donaciones disponibles
                            </button>
                        </div>
                    </div>

                    <h2 style={{ ...s.tituloSeccion, marginTop: '24px' }}>Estadísticas de donaciones</h2>
                    <StatsInicio contadores={contadores} />

                    <div style={s.consejo}>
                        <div style={s.iconoConsejo}>🛡️</div>
                        <div>
                            <h3 style={{ fontSize: '20px', color: '#222', marginBottom: '8px' }}>Tu seguridad es lo primero</h3>
                            <p style={{ color: '#666', lineHeight: 1.6, fontSize: '14px' }}>
                                Verifica el lugar y la hora de entrega. Nunca compartas tu información personal con desconocidos.
                            </p>
                        </div>
                    </div>
                </div>
            </div>

            <Nav pestana={pestana} setPestana={setPestana} />
        </div>
    );
}

/* STATS INICIO */
function StatsInicio({ contadores }) {
    const isMobile = useIsMobile();
    return (
        <div style={{ ...s.grid, gridTemplateColumns: isMobile ? '1fr' : '1.2fr 1fr' }}>
            <div style={s.cardGrande}>
                <div style={s.iconoGrande}>🍱</div>
                <h3 style={{ fontSize: '40px', color: '#00a344', marginBottom: '8px' }}>{contadores.total}</h3>
                <p style={{ color: '#666', fontSize: '15px' }}>Solicitudes totales</p>
            </div>
            <div style={s.lado}>
                <div style={s.cardPequena}>
                    <div style={{ ...s.icono, background: '#e3ffea' }}>✅</div>
                    <div>
                        <h3 style={{ fontSize: '22px', color: '#222' }}>{contadores.aprobadas}</h3>
                        <p style={{ color: '#666', fontSize: '12px' }}>Aprobadas</p>
                    </div>
                </div>
                <div style={s.cardPequena}>
                    <div style={{ ...s.icono, background: '#ffe4e4' }}>❌</div>
                    <div>
                        <h3 style={{ fontSize: '22px', color: '#222' }}>{contadores.rechazadas}</h3>
                        <p style={{ color: '#666', fontSize: '12px' }}>Rechazadas</p>
                    </div>
                </div>
            </div>
        </div>
    );
}

/* DONACIONES */
function Donaciones({ uid, userData, onVolver, setPestana, showToast, showConfirm, setLightboxSrc }) {
    const [donaciones, setDonaciones] = useState([]);
    const [seleccionada, setSeleccionada] = useState(null);

    useEffect(() => {
        const q = query(
            collection(db, 'donaciones'),
            where('estado', '==', 'disponible')
        );
        const unsub = onSnapshot(q, snap => {
            const lista = snap.docs.map(d => ({ id: d.id, ...d.data() }));
            lista.sort((a, b) => {
                const fa = b.fecha_creacion?.toDate ? b.fecha_creacion.toDate() : new Date(b.fecha_creacion);
                const fb = a.fecha_creacion?.toDate ? a.fecha_creacion.toDate() : new Date(a.fecha_creacion);
                return fa - fb;
            });
            setDonaciones(lista);
        });
        return () => unsub();
    }, []);

    if (seleccionada) return <VerDonacion donacion={seleccionada} uid={uid} userData={userData} onVolver={() => setSeleccionada(null)} setPestana={setPestana} showToast={showToast} showConfirm={showConfirm} setLightboxSrc={setLightboxSrc} />;

    return (
        <div style={s.page}>
            <div style={s.overlayHeader}>
                <div style={s.headerCircle}></div>
                <button style={s.volverBtn} onClick={onVolver}>←</button>
                <div style={{ position: 'relative', zIndex: 2 }}>
                    <h1 style={s.titulo}>Donaciones cerca de ti</h1>
                    <p style={s.subtitulo}>Estas son las publicaciones disponibles actualmente</p>
                </div>
            </div>
            <div style={s.overlayContent}>
                {donaciones.length === 0 ? (
                    <div style={s.sinDatos}>No hay donaciones disponibles en este momento</div>
                ) : donaciones.map(d => (
                    <div key={d.id} style={s.donacionCard}>
                        {(d.imagen || d.fotoUrl) && (
                            // Al hacer clic en la imagen, se abre en pantalla completa (Lightbox)
                            <img
                                src={d.imagen || d.fotoUrl}
                                alt={d.titulo || d.nombre}
                                style={{ ...s.donacionImg, cursor: 'zoom-in' }}
                                onClick={() => setLightboxSrc(d.imagen || d.fotoUrl)}
                                onError={e => { e.target.style.display = 'none'; }}
                            />
                        )}
                        <div style={{ padding: '22px' }}>
                            <div style={s.topCard}>
                                <h3 style={{ fontSize: '22px', color: '#222' }}>{d.titulo || d.nombre}</h3>
                                <span style={s.estadoBadge}>Disponible</span>
                            </div>
                            <p style={{ color: '#666', fontSize: '14px', margin: '10px 0 16px', lineHeight: 1.6 }}>{d.descripcion}</p>
                            <div style={s.infoGrid}>
                                <div style={s.datoBox}>
                                    <div style={{ ...s.icono, background: '#dfffe9' }}>📍</div>
                                    <div>
                                        <h4 style={{ color: '#222', fontSize: '14px' }}>Ubicación</h4>
                                        <p style={{ color: '#666', fontSize: '13px' }}>{d.ubicacion}</p>
                                    </div>
                                </div>
                            </div>
                            <button style={s.botonVerde} onClick={() => setSeleccionada(d)}>Ver donación</button>
                        </div>
                    </div>
                ))}
            </div>
            <Nav pestana="donaciones" setPestana={setPestana} />
        </div>
    );
}

/* ── HELPERS para métodos de transporte ── */
const METODOS_INFO = {
    bicicleta: { emoji: '🚲', label: 'Bicicleta' },
    moto:      { emoji: '🛵', label: 'Moto' },
    carro:     { emoji: '🚗', label: 'Carro' },
    camion:    { emoji: '🚚', label: 'Camión' },
};

function getMetodosHabilitados(metodos) {
    if (!metodos) return [];
    return Object.keys(METODOS_INFO).filter(k => metodos[k]);
}

/* VER DONACIÓN */
function VerDonacion({ donacion, uid, userData, onVolver, setPestana, showToast, setLightboxSrc }) {
    const [modo, setModo] = useState('delivery');
    const [motivo, setMotivo] = useState('');
    const [hora, setHora] = useState('');
    const [enviando, setEnviando] = useState(false);

    const metodosHabilitados = getMetodosHabilitados(donacion.metodos);
    const [metodoElegido, setMetodoElegido] = useState(metodosHabilitados[0] || null);
    const [nombreDonador, setNombreDonador] = useState('');

    useEffect(() => {
    const buscarNombre = async () => {
        if (!donacion.donadorId) return;
        const q = query(collection(db, 'usuarios'), where('uid', '==', donacion.donadorId));
        const snap = await getDocs(q);
        if (!snap.empty) {
            setNombreDonador(snap.docs[0].data().nombre || '');
        }
    };
    buscarNombre();
}, [donacion.donadorId]);

    // ── Referencias para el mapa de Leaflet ──
    // mapRef: apunta al <div> del DOM donde se va a "montar" el mapa
    // mapInstanceRef: guarda la instancia del mapa de Leaflet para poder limpiarla/destruirla
    const mapRef = useRef(null);
    const mapInstanceRef = useRef(null);

    const tarifas = {
        bicicleta: { base: 2.00, porKm: 0.18, tiempo: '35-50 min' },
        moto:      { base: 2.80, porKm: 0.22, tiempo: '20-35 min' },
        carro:     { base: 4.50, porKm: 0.28, tiempo: '18-30 min' },
        camion:    { base: 8.00, porKm: 0.45, tiempo: '30-45 min' },
    };

    const distanciaKm = Number(donacion.distancia) || 3.8;

    const precioDelivery = metodoElegido && modo === 'delivery'
    ? Number((tarifas[metodoElegido].base + (distanciaKm * tarifas[metodoElegido].porKm)).toFixed(2))
    : 0;

    const cambiarModo = (nuevoModo) => {
        setModo(nuevoModo);
        const ahora = new Date();
        ahora.setHours(ahora.getHours() + 1);
        setHora(ahora.toTimeString().slice(0, 5));
    };

    // ── Inicializa el mapa de Leaflet con la ubicación de la donación ──
    // Se ejecuta cada vez que cambia "donacion".
    // Crea el mapa, agrega la capa de tiles de OpenStreetMap y un marcador
    // en la ubicación de la donación con un popup mostrando el título y la dirección.
    useEffect(() => {
        if (!mapRef.current) return;
        // Si ya existía un mapa montado (por ejemplo, al re-renderizar), lo eliminamos primero
        if (mapInstanceRef.current) mapInstanceRef.current.remove();

        const coords = donacion.coordenadas?.lat && donacion.coordenadas?.lng
            ? [parseFloat(donacion.coordenadas.lat), parseFloat(donacion.coordenadas.lng)]
            : donacion.lat && donacion.lng
                ? [parseFloat(donacion.lat), parseFloat(donacion.lng)]
                : [13.6929, -89.2182];
        const map = L.map(mapRef.current).setView(coords, 16);
        mapInstanceRef.current = map;

        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { attribution: '© OpenStreetMap' }).addTo(map);

        // ── Pin rojo personalizado para señalar la ubicación de la donación ──
        const iconoDonacion = L.divIcon({
            html: '<div style="background:#ff4d4d;width:36px;height:36px;border-radius:50%;border:3px solid white;display:flex;justify-content:center;align-items:center;font-size:18px;box-shadow:0 2px 8px rgba(0,0,0,0.3)">📍</div>',
            className: '',
            iconSize: [36, 36],
            iconAnchor: [18, 36],
        });

        L.marker(coords, { icon: iconoDonacion })
            .addTo(map)
            .bindPopup(`<b>${donacion.titulo || donacion.nombre}</b><br>${donacion.ubicacion}`)
            .openPopup();

        // Limpieza: al desmontar el componente o cambiar de donación, se destruye el mapa
        return () => { if (mapInstanceRef.current) { mapInstanceRef.current.remove(); mapInstanceRef.current = null; } };
    }, [donacion]);

    const solicitar = async () => {
        if (!motivo) return showToast('Por favor explica tu situación', 'warning');
        if (modo === 'delivery' && !metodoElegido) return showToast('No hay métodos de transporte habilitados para esta donación', 'warning');
        if (modo === 'recoger' && !hora) return showToast('Por favor selecciona una hora para recoger', 'warning');
        setEnviando(true);
        try {
            await addDoc(collection(db, 'pedidos'), {
                beneficiarioId: uid,
                nombreCliente: userData?.nombre,
                direccionEntrega: userData?.direccion || 'Sin dirección',
                donacionId: donacion.id,
                donadorId: donacion.donadorId,
                donadorNombre: nombreDonador || 'Donante',
                donadorCorreo: donacion.donadorNombre || '',
                restaurante: donacion.ubicacion,
                origenLat: donacion.coordenadas?.lat || donacion.lat || null,
                origenLng: donacion.coordenadas?.lng || donacion.lng || null,
                titulo: donacion.titulo || donacion.nombre,
                modo,
                metodo: modo === 'delivery' ? metodoElegido : null,
                precioDelivery,
                distancia: distanciaKm,
                motivo,
                horaRecogida: hora || null,
                estado: 'pendiente',
                fecha_creacion: new Date(),
            });
            showToast('¡Solicitud enviada con éxito!', 'success');
            onVolver();
        } catch (e) {
            console.error(e);
            showToast('Error al enviar la solicitud', 'error');
        } finally {
            setEnviando(false);
        }
    };

    return (
        <div style={s.page}>
            <div style={s.overlayHeader}>
                <div style={s.headerCircle}></div>
                <button style={s.volverBtn} onClick={onVolver}>←</button>
                <div style={{ position: 'relative', zIndex: 2 }}>
                    <h1 style={s.titulo}>Donación disponible</h1>
                    <p style={s.subtitulo}>Decide cómo quieres recibirla</p>
                </div>
            </div>
            <div style={s.overlayContent}>
                <div style={s.card}>
                    <h2 style={s.cardTitulo}>{donacion.titulo || donacion.nombre}</h2>
                    {(donacion.imagen || donacion.fotoUrl) && (
                        // Al hacer clic en la imagen, se abre en pantalla completa (Lightbox)
                        <img
                            src={donacion.imagen || donacion.fotoUrl}
                            alt=""
                            style={{ ...s.donacionImg, marginBottom: '16px', cursor: 'zoom-in' }}
                            onClick={() => setLightboxSrc(donacion.imagen || donacion.fotoUrl)}
                            onError={e => { e.target.style.display = 'none'; }}
                        />
                    )}
                    <p style={{ color: '#555', lineHeight: 1.6, fontSize: '15px' }}>{donacion.descripcion}</p>
                    <div style={s.infoGrid}>
<div style={s.infoBox}>
    <span style={s.infoLabel}>Donador</span>
    <strong>{nombreDonador || '—'}{donacion.donadorNombre ? <span style={{ fontWeight: 'normal', color: '#888' }}> / {donacion.donadorNombre}</span> : ''}</strong>
</div>    <div style={s.infoBox}><span style={s.infoLabel}>Distancia</span><strong>{distanciaKm.toFixed(1)} km</strong></div>
    {donacion.disponibleHasta && donacion.disponibleHasta !== 'Sin límite' && (
        <div style={{ ...s.infoBox, gridColumn: '1 / -1'}}>
            <span style={s.infoLabel}> Disponible hasta</span>
            <strong style={{ fontSize: '16px'}}>{donacion.disponibleHasta}</strong>
        </div>
    )}
</div>

                    {/* ── MAPA: muestra la ubicación exacta de la donación ── */}
                    {/* El div con ref={mapRef} es donde Leaflet "monta" el mapa (ver useEffect arriba) */}
                    <div ref={mapRef} style={s.mapa}></div>
                </div>

                <div style={s.card}>
                    <h2 style={s.cardTitulo}>¿Cómo deseas recibirla?</h2>
                    <div style={s.opcionesGrid}>
                        <div style={{ ...s.opcion, ...(modo === 'delivery' ? s.opcionActiva : {}) }} onClick={() => cambiarModo('delivery')}>
                            <h3 style={{ fontSize: '17px', marginBottom: '6px' }}>🚚 Delivery</h3>
                            <p style={{ fontSize: '13px', color: '#666' }}>El repartidor me la lleva</p>
                        </div>
                        <div style={{ ...s.opcion, ...(modo === 'recoger' ? s.opcionActiva : {}) }} onClick={() => cambiarModo('recoger')}>
                            <h3 style={{ fontSize: '17px', marginBottom: '6px' }}>🙋 Recoger personalmente</h3>
                            <p style={{ fontSize: '13px', color: '#666' }}>Yo paso a recogerla</p>
                        </div>
                    </div>

                    <label style={s.label}>Motivo de la solicitud</label>
                    <textarea style={s.textarea} placeholder="Explica brevemente tu situación..." value={motivo} onChange={e => setMotivo(e.target.value)} />

                    <label style={s.label}>
                        {modo === 'delivery' ? 'Hora aproximada preferida para la entrega' : 'Hora aproximada para recoger'}
                    </label>
                    <input style={s.inputField} type="time" value={hora} onChange={e => setHora(e.target.value)} />

                    {modo === 'delivery' && (
                        <>
                            {/* Banner informativo: el beneficiario solo puede elegir entre los
                                métodos de transporte que el DONANTE habilitó al crear la donación */}
                            <div style={s.metodosBanner}>
                                <div style={s.metodosBannerIcon}>🚦</div>
                                <div>
                                    <p style={s.metodosBannerLabel}>Métodos de transporte habilitados por el donante</p>
                                    <p style={s.metodosBannerSub}>Elige el que prefieras para tu entrega</p>
                                </div>
                            </div>

                            {metodosHabilitados.length === 0 ? (
                                <div style={s.sinMetodos}>
                                    ⚠️ El donante no ha habilitado métodos de transporte para esta donación.
                                </div>
                            ) : (
                                <div style={s.metodosGrid}>
                                    {metodosHabilitados.map(key => {
                                        const info = METODOS_INFO[key];
                                        const tarifa = tarifas[key];
                                        const precio = (tarifa.base + distanciaKm * tarifa.porKm).toFixed(2);
                                        const activo = metodoElegido === key;
                                        return (
                                            <div
                                                key={key}
                                                style={{ ...s.metodo, ...(activo ? s.metodoActivo : {}) }}
                                                onClick={() => setMetodoElegido(key)}
                                            >
                                                <span style={{ fontSize: '28px', display: 'block', marginBottom: '6px' }}>{info.emoji}</span>
                                                <h4 style={{ fontSize: '15px', color: '#222', marginBottom: '4px' }}>{info.label}</h4>
                                                <p style={{ fontSize: '12px', color: '#777', marginBottom: '6px' }}>{tarifa.tiempo}</p>
                                                <p style={{ fontWeight: 'bold', color: '#00a344', fontSize: '15px' }}>${precio}</p>
                                            </div>
                                        );
                                    })}
                                </div>
                            )}

                            {metodoElegido && (
                                <div style={s.resumenMetodo}>
                                    <span style={{ fontSize: '20px' }}>{METODOS_INFO[metodoElegido]?.emoji}</span>
                                    <div style={{ flex: 1 }}>
                                        <p style={{ fontSize: '12px', color: '#555', margin: 0 }}>Método de entrega seleccionado</p>
                                        <strong style={{ fontSize: '15px', color: '#006d2f' }}>{METODOS_INFO[metodoElegido]?.label}</strong>
                                    </div>
                                    <div style={{ textAlign: 'right' }}>
                                        <p style={{ fontSize: '12px', color: '#555', margin: 0 }}>Total a pagar</p>
                                        <strong style={{ fontSize: '22px', color: '#006d2f' }}>${precioDelivery}</strong>
                                    </div>
                                </div>
                            )}
                        </>
                    )}

                    <button style={s.botonVerde} onClick={solicitar} disabled={enviando}>
                        {enviando ? 'Enviando...' : `Solicitar ${modo === 'delivery' ? 'Delivery' : 'Recogida'}`}
                    </button>
                </div>
            </div>
            <Nav pestana="donaciones" setPestana={setPestana} />
        </div>
    );
}

/* SOLICITUDES */
function Solicitudes({ uid, onVolver, setPestana, contadores, navigate, showToast, showConfirm }) {
    const [pedidos, setPedidos] = useState([]);

    useEffect(() => {
        if (!uid) return;
        const q = query(collection(db, 'pedidos'), where('beneficiarioId', '==', uid));
        const unsub = onSnapshot(q, snap => {
            const lista = snap.docs.map(d => ({ id: d.id, ...d.data() }));
            lista.sort((a, b) => new Date(b.fecha_creacion) - new Date(a.fecha_creacion));
            setPedidos(lista);
        });
        return () => unsub();
    }, [uid]);

    const cancelarPedido = async (pedidoId) => {
        showConfirm('¿Seguro que deseas cancelar esta solicitud?', async () => {
            await updateDoc(doc(db, 'pedidos', pedidoId), { estado: 'cancelado' });
            showToast('Solicitud cancelada.', 'error');
        });
    };

    const eliminarPedido = async (pedidoId) => {
        showConfirm('¿Estás seguro de que deseas ELIMINAR permanentemente esta solicitud?', async () => {
            try {
                await deleteDoc(doc(db, 'pedidos', pedidoId));
                showToast('Solicitud eliminada correctamente', 'success');
            } catch (e) {
                console.error(e);
                showToast('Error al eliminar la solicitud', 'error');
            }
        });
    };

    const getEstiloEstado = (estado) => {
        if (estado === 'entregado') return { background: '#e3ffea', color: '#009944' };
        if (['asignado', 'reservado', 'en_camino'].includes(estado)) return { background: '#e3f0ff', color: '#0066cc' };
        if (estado === 'cancelado') return { background: '#ffe4e4', color: '#d60000' };
        return { background: '#fff6d8', color: '#c28a00' };
    };

    const getLabelEstado = (estado, repartidorId) => {
        if (estado === 'entregado')  return 'Completado ✅';
        if (estado === 'reservado')  return 'Entrega Directa ✅';
        if (estado === 'en_camino')  return 'En camino 🛵';
        if (estado === 'cancelado')  return 'Cancelada ❌';
        if (estado === 'asignado') {
            return repartidorId ? 'Aprobada - Con repartidor 🛵' : 'Aprobada - Sin repartidor aún ⏳';
        }
        return 'Pendiente';
    };

    const formatFecha = (ts) => {
        if (!ts) return '';
        const d = ts.toDate ? ts.toDate() : new Date(ts);
        return d.toLocaleDateString('es-SV', { day: '2-digit', month: 'long', hour: '2-digit', minute: '2-digit' });
    };

    const getMetodoLabel = (metodo) => {
        if (!metodo) return '—';
        return `${METODOS_INFO[metodo]?.emoji || ''} ${METODOS_INFO[metodo]?.label || metodo}`;
    };

    return (
        <div style={s.page}>
            <div style={s.overlayHeader}>
                <div style={s.headerCircle}></div>
                <button style={s.volverBtn} onClick={onVolver}>←</button>
                <div style={{ position: 'relative', zIndex: 2 }}>
                    <h1 style={s.titulo}>Solicitudes enviadas</h1>
                    <p style={s.subtitulo}>Revisa el estado de tus solicitudes</p>
                </div>
            </div>
            <div style={s.overlayContent}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px', marginBottom: '20px' }}>
                    <div style={s.statBox}><div style={s.statIcon}>📨</div><div><h3 style={s.statNum}>{contadores.total}</h3><p style={s.statLabel}>Total</p></div></div>
                    <div style={s.statBox}><div style={s.statIcon}>✅</div><div><h3 style={s.statNum}>{contadores.aprobadas}</h3><p style={s.statLabel}>Aprobadas</p></div></div>
                </div>

                {pedidos.length === 0 ? (
                    <div style={s.sinDatos}>No tienes solicitudes aún</div>
                ) : pedidos.map(p => (
                    <div key={p.id} style={s.card}>
                        <div style={s.topCard}>
                            <div>
                                <h2 style={{ fontSize: '20px', color: '#222', marginBottom: '6px' }}>{p.titulo}</h2>
                               <p style={{ fontSize: '14px', color: '#666' }}>
  De: <strong>{p.donadorNombre || 'Donante desconocido'}</strong>
  {p.donadorCorreo && (
    <span style={{ color: '#888', fontWeight: 'normal' }}> / {p.donadorCorreo}</span>
  )}
</p>
                            </div>
                            <span style={{ ...s.estadoBadge, ...getEstiloEstado(p.estado) }}>{getLabelEstado(p.estado, p.repartidorId)}</span>
                        </div>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginTop: '16px' }}>
                            <div style={s.infoBox}><span style={s.infoLabel}>Fecha</span><strong style={{ fontSize: '14px', color: '#222' }}>{formatFecha(p.fecha_creacion)}</strong></div>
                            <div style={s.infoBox}>
                                <span style={s.infoLabel}>Método de entrega</span>
                                <strong style={{ fontSize: '14px', color: '#222' }}>
                                    {p.modo === 'delivery' ? getMetodoLabel(p.metodo) : '🙋 Recogida personal'}
                                </strong>
                            </div>
                            <div style={{ ...s.infoBox, gridColumn: '1 / -1' }}>
                                <span style={s.infoLabel}>Ruta</span>
                                <div style={{ marginTop: '8px' }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                        <div style={{ width: '12px', height: '12px', borderRadius: '50%', background: '#00b85c', flexShrink: 0 }}></div>
                                        <span style={{ fontSize: '13px', color: '#555' }}>{p.restaurante || '—'}</span>
                                    </div>
                                    <div style={{ width: '3px', height: '20px', background: '#d0d0d0', marginLeft: '4px', marginTop: '3px', marginBottom: '3px', borderRadius: '20px' }}></div>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                        <div style={{ width: '12px', height: '12px', borderRadius: '50%', background: '#ff4d4d', flexShrink: 0 }}></div>
                                        <span style={{ fontSize: '13px', color: '#555' }}>{p.direccionEntrega}</span>
                                    </div>
                                </div>
                            </div>
                            <div style={s.infoBox}><span style={s.infoLabel}>Total delivery</span><strong style={{ fontSize: '14px', color: '#222' }}>${p.precioDelivery?.toFixed(2) || '0.00'}</strong></div>
                        </div>

                        <div style={{ display: 'flex', gap: '12px', marginTop: '16px' }}>
                            {p.estado === 'pendiente' && (
                                <>
                                    <button style={{ flex: 1, padding: '13px 22px', border: 'none', borderRadius: '16px', background: 'linear-gradient(to right,#005a28,#00c853)', color: 'white', fontSize: '14px', fontWeight: 'bold', cursor: 'pointer' }} onClick={() => cancelarPedido(p.id)}>Cancelar</button>
                                    <button style={{ flex: 1, padding: '13px 22px', border: 'none', borderRadius: '16px', background: 'linear-gradient(to right,#a00000,#ff3b3b)', color: 'white', fontSize: '14px', fontWeight: 'bold', cursor: 'pointer' }} onClick={() => eliminarPedido(p.id)}>Eliminar</button>
                                </>
                            )}
                            {p.estado === 'cancelado' && (
                                <button style={{ flex: 1, padding: '13px 22px', border: 'none', borderRadius: '16px', background: 'linear-gradient(to right,#a00000,#ff3b3b)', color: 'white', fontSize: '14px', fontWeight: 'bold', cursor: 'pointer' }} onClick={() => eliminarPedido(p.id)}>Eliminar</button>
                            )}
                            {(p.estado === 'en_camino' || p.estado === 'asignado' || p.estado === 'reservado') && (
                                <button
                                    style={{ flex: 1, padding: '13px 22px', border: 'none', borderRadius: '16px', background: 'linear-gradient(to right,#005a28,#00c853)', color: 'white', fontSize: '14px', fontWeight: 'bold', cursor: 'pointer' }}
                                    onClick={() => navigate('/rastreo', { state: { pedidoId: p.id, repartidorId: p.repartidorId } })}
                                >
                                    🗺️ Rastrear pedido
                                </button>
                            )}
                        </div>
                    </div>
                ))}
            </div>
            <Nav pestana="solicitudes" setPestana={setPestana} />
        </div>
    );
}

/* PERFIL BENEFICIARIO */
function PerfilBene({
    userData, onVolver, navigate, setPestana, contadores,
    editandoPerfil, setEditandoPerfil,
    nuevoNombre, setNuevoNombre,
    nuevoTelefono, setNuevoTelefono,
    nuevaDireccion, setNuevaDireccion,
    nuevoCorreo, setNuevoCorreo,
    activarEdicion, guardarCambiosPerfil,
}) {
    const cerrarSesion = async () => { await signOut(auth); navigate('/index'); };

    return (
        <div style={s.page}>
            <div style={{ ...s.overlayHeader, textAlign: 'center' }}>
                <div style={s.headerCircle}></div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', position: 'relative', zIndex: 2 }}>
                    <button style={s.volverBtn} onClick={onVolver}>←</button>
                    <img src="https://cdn-icons-png.flaticon.com/512/149/149071.png" alt="foto" style={{ ...s.foto, width: '90px', height: '90px' }} />
                    <div style={{ width: '44px' }}></div>
                </div>
                <div style={{ position: 'relative', zIndex: 2 }}>
                    <h1 style={{ ...s.titulo, marginTop: '10px' }}>{userData?.nombre}</h1>
                    <p style={s.subtitulo}>Beneficiaria activa en la comunidad solidaria</p>
                </div>
            </div>
            <div style={s.overlayContent}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '14px', marginBottom: '20px' }}>
                    <div style={{ background: 'white', borderRadius: '20px', padding: '20px', textAlign: 'center', boxShadow: '0 6px 18px rgba(0,0,0,0.06)' }}>
                        <div style={{ fontSize: '26px', marginBottom: '8px' }}>📨</div>
                        <h2 style={{ fontSize: '26px', color: '#222', marginBottom: '6px' }}>{contadores.total}</h2>
                        <p style={{ fontSize: '12px', color: '#666' }}>Solicitudes realizadas</p>
                    </div>
                    <div style={{ background: 'white', borderRadius: '20px', padding: '20px', textAlign: 'center', boxShadow: '0 6px 18px rgba(0,0,0,0.06)' }}>
                        <div style={{ fontSize: '26px', marginBottom: '8px' }}>✅</div>
                        <h2 style={{ fontSize: '26px', color: '#222', marginBottom: '6px' }}>{contadores.aprobadas}</h2>
                        <p style={{ fontSize: '12px', color: '#666' }}>Solicitudes aprobadas</p>
                    </div>
                    <div style={{ background: 'white', borderRadius: '20px', padding: '20px', textAlign: 'center', boxShadow: '0 6px 18px rgba(0,0,0,0.06)' }}>
                        <div style={{ fontSize: '26px', marginBottom: '8px' }}>🍱</div>
                        <h2 style={{ fontSize: '26px', color: '#222', marginBottom: '6px' }}>{contadores.entregadas}</h2>
                        <p style={{ fontSize: '12px', color: '#666' }}>Donaciones recibidas</p>
                    </div>
                </div>

                <div style={s.card}>
                    <h3 style={s.cardTitulo}>Información personal</h3>

                    {editandoPerfil ? (
                        <div>
                            <label style={s.label}>Nombre Completo</label>
                            <input style={s.inputField} type="text" value={nuevoNombre} onChange={e => setNuevoNombre(e.target.value)} />
                            <label style={s.label}>Correo Electrónico</label>
                            <input style={s.inputField} type="email" value={nuevoCorreo} onChange={e => setNuevoCorreo(e.target.value)} />
                            <label style={s.label}>Teléfono</label>
                            <input style={s.inputField} type="text" value={nuevoTelefono} onChange={e => setNuevoTelefono(e.target.value)} />
                            <label style={s.label}>Dirección</label>
                            <input style={s.inputField} type="text" value={nuevaDireccion} onChange={e => setNuevaDireccion(e.target.value)} />
                            <div style={{ display: 'flex', gap: '12px', marginTop: '24px' }}>
                                <button style={s.btnCancelar} onClick={() => setEditandoPerfil(false)}>Cancelar</button>
                                <button style={{ ...s.btnGuardar, flex: 1 }} onClick={guardarCambiosPerfil}>Guardar Cambios</button>
                            </div>
                        </div>
                    ) : (
                        <>
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
                                {[
                                    { label: 'Correo electrónico', val: userData?.correo || '—' },
                                    { label: 'Teléfono', val: userData?.telefono || '—' },
                                    { label: 'Dirección', val: userData?.direccion || '—' },
                                    { label: 'Miembro desde', val: userData?.fecha_registro?.toDate ? userData.fecha_registro.toDate().toLocaleDateString('es-SV', { month: 'long', year: 'numeric' }) : '—' },
                                ].map((item, i) => (
                                    <div key={i} style={s.infoBox}>
                                        <span style={s.infoLabel}>{item.label}</span>
                                        <strong style={{ fontSize: '14px', color: '#222' }}>{item.val}</strong>
                                    </div>
                                ))}
                            </div>
                            <button
                                style={{ ...s.botonPrincipal, width: '100%', marginTop: '20px', padding: '15px' }}
                                onClick={activarEdicion}
                            >
                                📝 Editar perfil
                            </button>
                        </>
                    )}

                    <br /><br />
                    <div style={{ ...s.accion }} onClick={cerrarSesion}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                            <span style={{ fontSize: '22px' }}></span>
                            <div>
                                <h4 style={{ fontSize: '15px', color: '#d60000', marginBottom: '3px' }}>Cerrar sesión</h4>
                                <p style={{ fontSize: '13px', color: '#666' }}>Salir de la aplicación</p>
                            </div>
                        </div>
                        <span style={{ fontSize: '20px', color: '#888' }}>›</span>
                    </div>
                </div>
            </div>
            <Nav pestana="perfil" setPestana={setPestana} />
        </div>
    );
}

/* NAV */
function Nav({ pestana, setPestana }) {
    return (
        <div style={s.nav}>
            {[
                { key: 'inicio', icon: '🏠', label: 'Inicio' },
                { key: 'donaciones', icon: '🍱', label: 'Donaciones' },
                { key: 'solicitudes', icon: '📋', label: 'Solicitudes' },
                { key: 'perfil', icon: '👤', label: 'Perfil' },
            ].map(item => (
                <div key={item.key} style={{
                    ...s.navItem,
                    color: pestana === item.key ? '#016d3b' : '#888',
                    fontWeight: pestana === item.key ? 'bold' : 'normal',
                }} onClick={() => setPestana(item.key)}>
                    <span style={s.navIcon}>{item.icon}</span>
                    {item.label}
                </div>
            ))}
        </div>
    );
}

/* ESTILOS */
const s = {
    page: { minHeight: '100vh', background: 'linear-gradient(135deg,#eef2f7,#dfe7f3)', display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '18px', paddingBottom: '120px', fontFamily: 'Arial, Helvetica, sans-serif', boxSizing: 'border-box' },
    loading: { display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', fontSize: '18px', color: '#00a344' },
    dashboard: { width: '100%', maxWidth: '1100px' },
    header: { background: 'linear-gradient(135deg,#006d2f,#00a344)', borderRadius: '28px', padding: '24px', color: 'white', position: 'relative', overflow: 'hidden', boxShadow: '0 15px 35px rgba(0,0,0,0.12)' },
    headerCircle: { position: 'absolute', width: '200px', height: '200px', borderRadius: '50%', background: 'rgba(255,255,255,0.05)', top: '-80px', right: '-50px' },
    headerContent: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '18px', position: 'relative', zIndex: 2 },
    titulo: { fontSize: '28px', fontWeight: 800, margin: 0, color: 'white' },
    subtitulo: { marginTop: '6px', color: '#dcffe9', fontSize: '14px' },
    foto: { width: '88px', height: '88px', borderRadius: '50%', objectFit: 'cover', border: '4px solid white', boxShadow: '0 8px 20px rgba(0,0,0,0.25)' },
    contenido: { marginTop: '22px', width: '100%', maxWidth: '1100px' },
    cardPrincipal: { background: 'white', borderRadius: '28px', padding: '24px', display: 'flex', alignItems: 'center', gap: '22px', boxShadow: '0 8px 25px rgba(0,0,0,0.08)' },
    iconoPrincipal: { width: '90px', height: '90px', borderRadius: '24px', background: '#dfffe9', display: 'flex', justifyContent: 'center', alignItems: 'center', fontSize: '42px', flexShrink: 0 },
    cardH2: { fontSize: '24px', color: '#222', marginBottom: '8px' },
    cardP: { color: '#666', lineHeight: 1.6, fontSize: '14px' },
    botonPrincipal: { marginTop: '16px', padding: '13px 22px', border: 'none', borderRadius: '16px', background: 'linear-gradient(to right,#006d2f,#00a344)', color: 'white', fontSize: '14px', fontWeight: 'bold', cursor: 'pointer' },
    tituloSeccion: { fontSize: '24px', color: '#222', marginBottom: '14px' },
    grid: { display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: '18px' },
    cardGrande: { background: 'white', borderRadius: '26px', padding: '24px', textAlign: 'center', boxShadow: '0 8px 25px rgba(0,0,0,0.08)' },
    iconoGrande: { width: '85px', height: '85px', borderRadius: '24px', background: '#dfffe9', display: 'flex', justifyContent: 'center', alignItems: 'center', fontSize: '42px', margin: 'auto', marginBottom: '16px' },
    lado: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px' },
    cardPequena: { background: 'white', borderRadius: '24px', padding: '18px', display: 'flex', alignItems: 'center', gap: '12px', boxShadow: '0 8px 25px rgba(0,0,0,0.08)' },
    icono: { width: '55px', height: '55px', borderRadius: '18px', display: 'flex', justifyContent: 'center', alignItems: 'center', fontSize: '25px', flexShrink: 0 },
    consejo: { marginTop: '24px', background: 'white', borderRadius: '24px', padding: '22px', display: 'flex', gap: '18px', alignItems: 'flex-start', boxShadow: '0 8px 25px rgba(0,0,0,0.08)' },
    iconoConsejo: { width: '65px', height: '65px', borderRadius: '20px', background: '#dfffe9', display: 'flex', justifyContent: 'center', alignItems: 'center', fontSize: '30px', flexShrink: 0 },
    alertaAprobada: { background: '#e8fff1', border: '1px solid #a0e8c0', borderRadius: '20px', padding: '16px 18px', display: 'flex', alignItems: 'center', gap: '14px', marginBottom: '16px', cursor: 'pointer', boxShadow: '0 4px 14px rgba(0,180,80,0.10)' },
    alertaRechazada: { background: '#fff0f0', border: '1px solid #ffc0c0', borderRadius: '20px', padding: '16px 18px', display: 'flex', alignItems: 'center', gap: '14px', marginBottom: '16px', cursor: 'pointer', boxShadow: '0 4px 14px rgba(220,0,0,0.08)' },
    nav: { position: 'fixed', bottom: '20px', left: '50%', transform: 'translateX(-50%)', width: '92%', maxWidth: '760px', background: 'rgba(255,255,255,0.92)', backdropFilter: 'blur(14px)', borderRadius: '22px', padding: '14px 18px', display: 'flex', justifyContent: 'space-around', alignItems: 'center', boxShadow: '0 10px 30px rgba(0,0,0,0.12)', border: '1px solid rgba(255,255,255,0.5)', zIndex: 999 },
    navItem: { textAlign: 'center', fontSize: '12px', cursor: 'pointer', transition: '0.2s' },
    navIcon: { display: 'block', fontSize: '24px', marginBottom: '4px' },
    overlayHeader: { width: '100%', maxWidth: '1100px', boxSizing: 'border-box', background: 'linear-gradient(135deg,#006d2f,#00a344)', color: 'white', padding: '24px', borderRadius: '28px', marginBottom: '20px', position: 'relative', overflow: 'hidden', boxShadow: '0 15px 35px rgba(0,0,0,0.12)' },
    overlayContent: { width: '100%', maxWidth: '1100px' },
    volverBtn: { width: '44px', height: '44px', border: 'none', borderRadius: '14px', background: 'rgba(255,255,255,0.15)', color: 'white', fontSize: '20px', cursor: 'pointer', marginBottom: '16px', display: 'block', position: 'relative', zIndex: 2 },
    sinDatos: { textAlign: 'center', padding: '40px', color: '#777', fontSize: '16px' },
    donacionCard: { background: 'white', borderRadius: '26px', overflow: 'hidden', boxShadow: '0 10px 25px rgba(0,0,0,0.08)', marginBottom: '18px' },
    donacionImg: { width: '100%', height: '220px', objectFit: 'cover' },
    // ── Estilo del contenedor del mapa de Leaflet en VerDonacion ──
    mapa: { width: '100%', height: '260px', borderRadius: '20px', marginTop: '16px', overflow: 'hidden' },
    topCard: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '10px', marginBottom: '12px' },
    estadoBadge: { display: 'inline-block', background: '#dfffe9', color: '#00853a', padding: '6px 12px', borderRadius: '16px', fontSize: '11px', fontWeight: 'bold', whiteSpace: 'nowrap' },
    infoGrid: { display: 'flex', flexDirection: 'column', gap: '12px', marginTop: '14px' },
    datoBox: { display: 'flex', alignItems: 'center', gap: '12px', background: '#f7f7f7', borderRadius: '16px', padding: '12px' },
    botonVerde: { width: '100%', marginTop: '18px', padding: '14px', border: 'none', borderRadius: '16px', background: 'linear-gradient(to right,#006d2f,#00a344)', color: 'white', fontSize: '14px', fontWeight: 'bold', cursor: 'pointer' },
    card: { background: 'white', borderRadius: '24px', padding: '22px', boxShadow: '0 8px 25px rgba(0,0,0,0.08)', marginBottom: '20px' },
    cardTitulo: { fontSize: '20px', marginBottom: '16px', color: '#222' },
    infoBox: { background: '#f5f5f5', padding: '16px', borderRadius: '18px' },
    infoLabel: { display: 'block', fontSize: '12px', color: '#777', marginBottom: '6px' },
    opcionesGrid: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px', marginBottom: '16px' },
    opcion: { background: '#f5f5f5', padding: '20px', borderRadius: '20px', cursor: 'pointer', border: '3px solid transparent', transition: '0.2s' },
    opcionActiva: { border: '3px solid #016d3b', background: '#eafff2' },
    label: { display: 'block', marginTop: '16px', marginBottom: '8px', fontWeight: 'bold', color: '#333', fontSize: '14px' },
    textarea: { width: '100%', padding: '15px', border: 'none', borderRadius: '18px', background: '#f5f5f5', fontSize: '15px', outline: 'none', height: '120px', resize: 'none', boxSizing: 'border-box' },
    inputField: { width: '100%', padding: '15px', border: 'none', borderRadius: '18px', background: '#f5f5f5', fontSize: '15px', outline: 'none', boxSizing: 'border-box', marginBottom: '4px' },
    metodosBanner: { display: 'flex', alignItems: 'center', gap: '12px', background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: '18px', padding: '14px 16px', marginTop: '18px', marginBottom: '14px' },
    metodosBannerIcon: { fontSize: '24px', flexShrink: 0 },
    metodosBannerLabel: { fontSize: '13px', fontWeight: 'bold', color: '#166534', margin: 0 },
    metodosBannerSub: { fontSize: '12px', color: '#4ade80', margin: '2px 0 0 0' },
    metodosGrid: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px', marginBottom: '16px' },
    metodo: { background: '#f5f5f5', padding: '18px', borderRadius: '20px', cursor: 'pointer', border: '3px solid transparent', transition: '0.2s', textAlign: 'center' },
    metodoActivo: { border: '3px solid #016d3b', background: '#eafff2' },
    resumenMetodo: { display: 'flex', alignItems: 'center', gap: '14px', background: 'linear-gradient(135deg,#e8f5e9,#f0fdf4)', border: '2px solid #86efac', borderRadius: '20px', padding: '16px 20px', marginBottom: '16px' },
    sinMetodos: { background: '#fff7ed', border: '1px solid #fed7aa', borderRadius: '16px', padding: '16px', color: '#9a3412', fontSize: '14px', marginBottom: '16px' },
    statBox: { background: 'white', padding: '18px', borderRadius: '20px', display: 'flex', alignItems: 'center', gap: '14px', boxShadow: '0 6px 18px rgba(0,0,0,0.06)' },
    statIcon: { width: '50px', height: '50px', borderRadius: '16px', background: '#eafff2', display: 'flex', justifyContent: 'center', alignItems: 'center', fontSize: '22px' },
    statNum: { fontSize: '22px', color: '#222' },
    statLabel: { fontSize: '13px', color: '#666', marginTop: '4px' },
    accion: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#f5f5f5', padding: '16px', borderRadius: '18px', cursor: 'pointer', marginBottom: '12px' },
    btnGuardar: { flex: 1, padding: '16px', background: 'linear-gradient(to right,#006d2f,#00a344)', color: 'white', border: 'none', borderRadius: '16px', fontWeight: 'bold', cursor: 'pointer', fontSize: '15px' },
    btnCancelar: { flex: 1, padding: '16px', background: '#f0f0f0', color: '#555', border: 'none', borderRadius: '16px', fontWeight: 'bold', cursor: 'pointer', fontSize: '15px' },
};

export default DashboardBeneficiario;