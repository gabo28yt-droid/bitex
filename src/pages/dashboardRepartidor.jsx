import { useState, useEffect } from 'react';
import { Toast } from '../components/Toast';
import { useToast } from '../components/useToast';
import { useNavigate } from 'react-router-dom';
import { db, auth } from '../firebase/conifg';
import {
    collection, query, where, onSnapshot,
    getDocs, doc, updateDoc, limit, arrayUnion
} from "firebase/firestore";
import { onAuthStateChanged, signOut } from "firebase/auth";



const VEHICULO_A_METODO = {
    bicicleta:   'bicicleta',
    motocicleta: 'moto',
    auto:        'carro',
    camion:      'camion',
};

const METODO_EMOJI = {
    bicicleta: '🚲',
    moto:      '🛵',
    carro:     '🚗',
    camion:    '🚚',
};

function useIsMobile() {
    const [isMobile, setIsMobile] = useState(window.innerWidth < 640);
    useEffect(() => {
        const handler = () => setIsMobile(window.innerWidth < 640);
        window.addEventListener('resize', handler);
        return () => window.removeEventListener('resize', handler);
    }, []);
    return isMobile;
}

function DashboardRepartidor() {
    const [userData, setUserData] = useState(null);
    const [conectado, setConectado] = useState(false);
    const [loading, setLoading] = useState(true);
    const [uid, setUid] = useState(null);
    const [pedidosHistorial, setPedidosHistorial] = useState([]);
    const [pedidoActivo, setPedidoActivo] = useState(null);
    const [pedidosHoy, setPedidosHoy] = useState(0);
    const [progreso, setProgreso] = useState({ realizados: 0, meta: 12 });
    const [pestana, setPestana] = useState('inicio');
    const [editandoPerfil, setEditandoPerfil] = useState(false);
    const [nuevoNombre, setNuevoNombre] = useState('');
    const [nuevoTelefono, setNuevoTelefono] = useState('');
    const [nuevaDireccion, setNuevaDireccion] = useState('');
    const [nuevoCorreo, setNuevoCorreo] = useState('');
    const [nuevoVehiculo, setNuevoVehiculo] = useState('');
    const [nuevaPlaca, setNuevaPlaca] = useState('');

    const { toasts, showToast, removeToast } = useToast();
    const isMobile = useIsMobile();
    const navigate = useNavigate();

    // EFECTO 1: Autenticación
    useEffect(() => {
        const unsub = onAuthStateChanged(auth, async (user) => {
            if (user) {
                setUid(user.uid);
                try {
                    const q = query(collection(db, "usuarios"), where("uid", "==", user.uid));
                    const snap = await getDocs(q);
                    if (!snap.empty) {
                        const data = snap.docs[0].data();
                        setUserData(data);
                        setConectado(data.disponible || false);
                    }
                } catch (error) {
                    console.error("Error cargando datos:", error);
                } finally {
                    setLoading(false);
                }
            } else {
                navigate('/index');
            }
        });
        return () => unsub();
    }, [navigate]);

    // EFECTO 2: Escuchar pedido activo en tiempo real
    useEffect(() => {
        if (!uid) return;
        const q = query(
            collection(db, 'pedidos'),
            where('repartidorId', '==', uid),
            where('estado', 'in', ['asignado', 'en_camino']),
            limit(1)
        );
        const unsub = onSnapshot(q, (snap) => {
            if (!snap.empty) {
                setPedidoActivo({ id: snap.docs[0].id, ...snap.docs[0].data() });
            } else {
                setPedidoActivo(null);
            }
        });
        return () => unsub();
    }, [uid]);

    // EFECTO 3: Contar pedidos entregados hoy (sin where de fecha para evitar índice)
    useEffect(() => {
        if (!uid) return;
        const hoy = new Date();
        hoy.setHours(0, 0, 0, 0);
        const q = query(
            collection(db, 'pedidos'),
            where('repartidorId', '==', uid),
            where('estado', '==', 'entregado')
        );
        const unsub = onSnapshot(q, (snap) => {
            // Filtrar en el cliente los pedidos de hoy
            const pedidosDeHoy = snap.docs.filter(d => {
                const fecha = d.data().fecha_entrega?.toDate?.();
                return fecha && fecha >= hoy;
            });
            setPedidosHoy(pedidosDeHoy.length);
            setProgreso(prev => ({ ...prev, realizados: pedidosDeHoy.length }));
        }, (error) => {
            console.error('Error contando pedidos de hoy:', error);
        });
        return () => unsub();
    }, [uid]);

    const toggleOnline = async () => {
        if (!uid) return;
        const nuevo = !conectado;
        setConectado(nuevo);
        await updateDoc(doc(db, 'usuarios', uid), {
            disponible: nuevo,
            ultima_conexion: new Date()
        });
        showToast(
            nuevo ? 'Ya puedes recibir pedidos.' : 'No recibirás pedidos nuevos.',
            nuevo ? 'success' : 'warn'
        );
    };

    const activarEdicion = () => {
        setNuevoNombre(userData?.nombre || '');
        setNuevoTelefono(userData?.telefono || '');
        setNuevaDireccion(userData?.direccion || '');
        setNuevoCorreo(userData?.correo || '');
        setNuevoVehiculo(userData?.vehiculo || '');
        setNuevaPlaca(userData?.placa || '');
        setEditandoPerfil(true);
    };

    const guardarCambiosPerfil = async () => {
        try {
            const q = query(collection(db, 'usuarios'), where('uid', '==', uid));
            const snap = await getDocs(q);
            if (!snap.empty) {
                const docId = snap.docs[0].id;
                const datosActualizados = {
                    nombre:    nuevoNombre    || userData?.nombre,
                    telefono:  nuevoTelefono  || userData?.telefono,
                    direccion: nuevaDireccion || userData?.direccion,
                    correo:    nuevoCorreo    || userData?.correo,
                    vehiculo:  nuevoVehiculo  || userData?.vehiculo,
                    placa:     nuevaPlaca     || userData?.placa,
                };
                await updateDoc(doc(db, 'usuarios', docId), datosActualizados);
                setUserData(prev => ({ ...prev, ...datosActualizados }));
                setEditandoPerfil(false);
                    showToast('¡Tus datos se guardaron con éxito!', 'success');
            }
        } catch (error) {
            console.error('Error al actualizar el perfil:', error);
             showToast('No se pudieron guardar los cambios.', 'error');
        }
    };

    const getNombre = () => userData?.nombre?.split(' ')[0] || "Repartidor";
    const porcentaje = Math.min(Math.round((progreso.realizados / progreso.meta) * 100), 100);

    if (loading) return <div style={st.loading}>Cargando dashboard...</div>;

    return (
        <div style={st.container}>
            <Toast toasts={toasts} removeToast={removeToast} />
            <div style={st.dashboard}>
                {pestana === 'inicio' && (
                    <div style={st.header}>
                        <div style={st.headerCircle}></div>
                        <div style={st.headerContent}>
                            <div style={st.textoHeader}>
                                <h1 style={st.titulo}>¡Hola, {getNombre()}!</h1>
                                <p style={st.subtitulo}>
                                    {conectado ? 'Listo para entregar pedidos' : 'Estás desconectado'}
                                </p>
                                <div style={conectado ? st.onlineBtn : st.onlineBtnOffline} onClick={toggleOnline}>
                                    <span style={st.estadoTexto}>{conectado ? "En línea" : "Desconectado"}</span>
                                    <div style={st.switchTrack}>
                                        <div style={{
                                            ...st.switchBall,
                                            background: conectado ? '#00c853' : '#ff4d4d',
                                            right: conectado ? '3px' : '23px'
                                        }}></div>
                                    </div>
                                </div>
                            </div>
                            <img src="https://cdn-icons-png.flaticon.com/512/149/149071.png" alt="Foto" style={st.foto} />
                        </div>
                    </div>
                )}

                {pestana === 'pedidos' && (
                    <div style={st.header}>
                        <div style={st.headerCircle}></div>
                        <button style={st.volverBtn} onClick={() => setPestana('inicio')}>←</button>
                        <div style={{ position: 'relative', zIndex: 2 }}>
                            <h1 style={st.titulo}>Pedidos Disponibles</h1>
                            <p style={st.subtitulo}>Acepta un pedido para comenzar la entrega</p>
                        </div>
                    </div>
                )}

                {pestana === 'historial' && (
                    <div style={st.header}>
                        <div style={st.headerCircle}></div>
                        <button style={st.volverBtn} onClick={() => setPestana('inicio')}>←</button>
                        <div style={{ position: 'relative', zIndex: 2 }}>
                            <h1 style={st.titulo}>Historial de entregas</h1>
                            <p style={st.subtitulo}>Tus últimas 20 entregas completadas</p>
                        </div>
                    </div>
                )}
            </div>

            <div style={st.contenido}>
                {pestana === 'inicio' && (
                    <>
                        <div style={st.tituloSeccion}>
                            <h2 style={st.tituloH2}>Resumen de hoy</h2>
                        </div>

                        {userData?.vehiculo && (
                            <div style={st.vehiculoBadge}>
                                <span style={{ fontSize: '22px' }}>
                                    {METODO_EMOJI[VEHICULO_A_METODO[userData.vehiculo]] || '🚗'}
                                </span>
                                <div>
                                    <p style={{ margin: 0, fontSize: '12px', color: '#555' }}>Tu vehículo registrado</p>
                                    <strong style={{ fontSize: '14px', color: '#006d2f', textTransform: 'capitalize' }}>
                                        {userData.vehiculo}
                                    </strong>
                                </div>
                                <span style={st.vehiculoBadgePill}>Solo ves pedidos compatibles</span>
                            </div>
                        )}

                        <div style={st.tarjetas}>
                            <div style={st.card}>
                                <div style={st.cardTop}>
                                    <div style={{ ...st.icono, ...st.verde }}>📦</div>
                                    <div>
                                        <h3 style={st.cardNumero}>{pedidosHoy}</h3>
                                        <p style={st.cardTexto}>Pedidos realizados</p>
                                    </div>
                                </div>
                            </div>
                            <div style={st.card}>
                                <div style={st.cardTop}>
                                    <div style={{ ...st.icono, ...st.azul }}>⏰</div>
                                    <div>
                                        <h3 style={st.cardNumero}>{conectado ? 'Activo' : 'Inactivo'}</h3>
                                        <p style={st.cardTexto}>Estado actual</p>
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div style={{ ...st.grid, gridTemplateColumns: isMobile ? '1fr' : '2fr 1fr' }}>
                            <div style={st.pedido}>
                                {pedidoActivo ? (
                                    <>
                                        <span style={st.estadoBadge}>
                                            {pedidoActivo.estado === 'en_camino' ? '🛵 En camino' : '📋 Asignado'}
                                        </span>
                                        <h3 style={st.pedidoTitulo}>Pedido #{pedidoActivo.id?.slice(-4).toUpperCase()}</h3>
                                        <p style={st.cliente}>Cliente: {pedidoActivo.nombreCliente}</p>
                                        <div style={st.direccion}>📍 {pedidoActivo.direccionEntrega}</div>
                                        <button
                                            style={st.boton}
                                            onClick={() => navigate('/verpedido', { state: { pedidoId: pedidoActivo.id } })}
                                        >
                                            Ver pedido
                                        </button>
                                    </>
                                ) : (
                                    <>
                                        <span style={st.estadoBadge}>Sin pedido</span>
                                        <h3 style={st.pedidoTitulo}>Sin pedido activo</h3>
                                        <p style={st.cliente}>
                                            {conectado ? 'Esperando un pedido...' : 'Conéctate para recibir pedidos'}
                                        </p>
                                        <button style={st.boton} onClick={() => setPestana('pedidos')}>
                                            Ver pedidos disponibles
                                        </button>
                                    </>
                                )}
                            </div>

                            <div style={st.progreso}>
                                <h3 style={st.progresoTitulo}>Progreso del día</h3>
                                <div style={st.textoProgreso}>
                                    <span>{progreso.realizados} / {progreso.meta} entregas</span>
                                    <span>{porcentaje}%</span>
                                </div>
                                <div style={st.barra}>
                                    <div style={{ ...st.relleno, width: `${porcentaje}%` }}></div>
                                </div>
                            </div>
                        </div>
                    </>
                )}

                {pestana === 'pedidos' && (
    <PedidosDisponibles uid={uid} userData={userData} navigate={navigate} showToast={showToast} conectado={conectado} />
)}

                {pestana === 'historial' && (
    <Historial uid={uid} pedidosHistorial={pedidosHistorial} setPedidosHistorial={setPedidosHistorial} />
)}

                {pestana === 'perfil' && (
                    <Perfil
                        uid={uid}
                        userData={userData}
                        navigate={navigate}
                        showToast={showToast}
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
                        nuevoVehiculo={nuevoVehiculo}
                        setNuevoVehiculo={setNuevoVehiculo}
                        nuevaPlaca={nuevaPlaca}
                        setNuevaPlaca={setNuevaPlaca}
                        activarEdicion={activarEdicion}
                        guardarCambiosPerfil={guardarCambiosPerfil}
                    />
                )}
            </div>

            <div style={st.nav}>
                {[
                    { key: 'inicio',    icon: '🏠', label: 'Inicio' },
                    { key: 'pedidos',   icon: '📦', label: 'Pedidos' },
                    { key: 'historial', icon: '🕘', label: 'Historial' },
                    { key: 'perfil',    icon: '👤', label: 'Perfil' },
                ].map(item => (
                    <div key={item.key} style={{
                        ...st.navItem,
                        color: pestana === item.key ? '#016d3b' : '#888',
                        fontWeight: pestana === item.key ? 'bold' : 'normal',
                    }} onClick={() => setPestana(item.key)}>
                        <span style={st.navIcon}>{item.icon}</span>
                        {item.label}
                    </div>
                ))}
            </div>
        </div>
    );
}

function PedidosDisponibles({ uid, userData, showToast, conectado }) {
    const [pedidos, setPedidos] = useState([]);
    const [cargando, setCargando] = useState(true);

    useEffect(() => {
        if (!conectado) return;

        const claveVehiculo = VEHICULO_A_METODO[userData?.vehiculo];

        const q = query(
            collection(db, 'pedidos'),
            where('estado', '==', 'asignado'),
            where('repartidorId', '==', null)
        );

        const unsub = onSnapshot(q, async (snap) => {
            const todosPedidos = snap.docs.map(d => ({ id: d.id, ...d.data() }));

            // Filtrar pedidos que este repartidor ya ignoró
            const noIgnorados = todosPedidos.filter(p => !(p.ignoradoPor || []).includes(uid));

            if (!claveVehiculo) {
                setPedidos(noIgnorados);
                setCargando(false);
                return;
            }

            const resultados = await Promise.all(
                noIgnorados.map(async (pedido) => {
                    if (pedido.metodo) {
                        return pedido.metodo === claveVehiculo ? pedido : null;
                    }
                    if (!pedido.donacionId) return pedido;
                    try {
                        const donSnap = await getDocs(
                            query(collection(db, 'donaciones'), where('__name__', '==', pedido.donacionId))
                        );
                        if (donSnap.empty) return pedido;
                        const donacion = donSnap.docs[0].data();
                        if (!donacion.metodos) return pedido;
                        return donacion.metodos[claveVehiculo] ? pedido : null;
                    } catch {
                        return pedido;
                    }
                })
            );

            setPedidos(resultados.filter(Boolean));
            setCargando(false);
        });

        return () => unsub();
    }, [uid, userData, conectado]);

    const aceptarPedido = async (pedidoId) => {
        try {
            await updateDoc(doc(db, 'pedidos', pedidoId), {
                estado: 'asignado',
                repartidorId: uid,
                fecha_asignacion: new Date()
            });
            showToast('Ya puedes iniciar la entrega.', 'success');
        } catch {
            showToast('No se pudo aceptar el pedido. Intenta de nuevo.', 'error');
        }
    };

    // Ignorar: oculta el pedido SOLO para este repartidor (otros repartidores aún lo ven)
    const ignorarPedido = async (pedidoId) => {
        try {
            await updateDoc(doc(db, 'pedidos', pedidoId), {
                ignoradoPor: arrayUnion(uid)
            });
            setPedidos(prev => prev.filter(p => p.id !== pedidoId));
            showToast('Pedido ocultado. Otros repartidores aún pueden verlo.', 'success');
        } catch {
            showToast('No se pudo ocultar el pedido. Intenta de nuevo.', 'error');
        }
    };

    const claveVehiculo = VEHICULO_A_METODO[userData?.vehiculo];

    if (!conectado) {
        return (
            <div style={st.sinDatos}>
                <div style={{ fontSize: '52px', marginBottom: '16px' }}>🔌</div>
                Estás desconectado. Conéctate para ver pedidos disponibles.
            </div>
        );
    }

    return (
        <>
            {claveVehiculo && (
                <div style={st.filtroActivo}>
                    <span style={{ fontSize: '20px' }}>{METODO_EMOJI[claveVehiculo]}</span>
                    <p style={{ margin: 0, fontSize: '13px', color: '#374151' }}>
                        Mostrando solo pedidos compatibles con tu <strong style={{ textTransform: 'capitalize' }}>{userData?.vehiculo}</strong>
                    </p>
                </div>
            )}

            {cargando ? (
                <div style={st.sinDatos}>Buscando pedidos...</div>
            ) : pedidos.length === 0 ? (
                <div style={st.sinDatos}>
                    <div style={{ fontSize: '52px', marginBottom: '16px' }}>📭</div>
                    No hay pedidos disponibles para tu vehículo en este momento
                </div>
            ) : pedidos.map(p => (
                <div key={p.id} style={st.pedidoItem}>
                    <div style={st.pedidoItemTop}>
                        <span style={{ fontSize: '18px', fontWeight: 'bold', color: '#222' }}>
                            Pedido #{p.id?.slice(-4).toUpperCase()}
                        </span>
                        <span style={st.estadoBadge}>Disponible</span>
                    </div>

                    <p style={{ color: '#666', fontSize: '14px', margin: '10px 0' }}>
                        Cliente: <strong>{p.nombreCliente}</strong>
                    </p>

                    {p.metodo && (
                        <div style={st.metodoRequerido}>
                            <span style={{ fontSize: '18px' }}>{METODO_EMOJI[p.metodo] || '🚗'}</span>
                            <div>
                                <p style={{ margin: 0, fontSize: '11px', color: '#555' }}>Transporte requerido</p>
                                <strong style={{ fontSize: '13px', color: '#006d2f', textTransform: 'capitalize' }}>
                                    {p.metodo}
                                </strong>
                            </div>
                        </div>
                    )}

                    <div style={st.rutaBox}>
                        <div style={st.puntoRuta}>
                            <div style={{ ...st.circulo, background: '#00b85c' }}></div>
                            <div>
                                <span style={st.rutaLabel}>Recogida</span>
                                <strong style={st.rutaVal}>{p.restaurante || p.ubicacion || '—'}</strong>
                            </div>
                        </div>
                        <div style={st.lineaRuta}></div>
                        <div style={st.puntoRuta}>
                            <div style={{ ...st.circulo, background: '#ff4d4d' }}></div>
                            <div>
                                <span style={st.rutaLabel}>Entrega</span>
                                <strong style={st.rutaVal}>{p.direccionEntrega}</strong>
                            </div>
                        </div>
                    </div>

                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '14px' }}>
                        <span style={{ fontSize: '13px', color: '#777' }}>
                            {METODO_EMOJI[p.metodo] || '🛵'} {p.metodo || 'delivery'}
                        </span>
                        <span style={{ fontSize: '20px', fontWeight: 'bold', color: '#016d3b' }}>
                            ${p.precioDelivery?.toFixed(2) || '0.00'}
                        </span>
                    </div>

                    <div style={st.botonesRow}>
                        <button style={st.btnAceptar} onClick={() => aceptarPedido(p.id)}>✅ Aceptar pedido</button>
                        <button style={st.btnRechazar} onClick={() => ignorarPedido(p.id)}>Ignorar</button>
                    </div>
                </div>
            ))}
        </>
    );
}

function Historial({ uid, pedidosHistorial, setPedidosHistorial }) {

    const [loading, setLoading] = useState(false);

           useEffect(() => {
    console.log('Historial uid:', uid);
    if (!uid) return;
    const q = query(
        collection(db, 'pedidos'),
        where('repartidorId', '==', uid),
        where('estado', '==', 'entregado')
    );
   const unsub = onSnapshot(q, (snap) => {
    console.log('Snap size:', snap.size, 'docs:', snap.docs.length);
    const docs = snap.docs.map(d => ({ id: d.id, ...d.data() }));
        docs.sort((a, b) => {
            const fechaA = a.fecha_entrega?.toDate?.() || new Date(0);
            const fechaB = b.fecha_entrega?.toDate?.() || new Date(0);
            return fechaB - fechaA;
        });
        setPedidosHistorial(docs.slice(0, 20));
setLoading(false);
console.log('pedidos seteados:', docs.length);
    }, (error) => {
        console.error('Error historial:', error);
        setLoading(false);
    });
    return () => unsub();
}, [uid, setPedidosHistorial]);

    const formatFecha = (ts) => {
        if (!ts) return '—';
        const d = ts.toDate ? ts.toDate() : new Date(ts);
        return d.toLocaleDateString('es-SV', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
    };

    const totalGanado = pedidosHistorial.reduce((acc, p) => acc + (p.precioDelivery || 0), 0);

return (
    <>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px', marginBottom: '20px' }}>
    <div style={st.miniCard}>
        <div style={{ fontSize: '28px', marginBottom: '8px' }}>📦</div>
        <h2 style={st.miniCardVal}>{pedidosHistorial.length}</h2>
        <p style={st.miniCardLabel}>Entregas totales</p>
    </div>
    <div style={st.miniCard}>
        <div style={{ fontSize: '28px', marginBottom: '8px' }}>💵</div>
        <h2 style={st.miniCardVal}>${totalGanado.toFixed(2)}</h2>
        <p style={st.miniCardLabel}>Total ganado</p>
    </div>
</div>

            {loading ? (
                <div style={st.sinDatos}>Cargando historial...</div>
            ) : pedidosHistorial.length === 0 ? (
                <div style={st.sinDatos}>
                    <div style={{ fontSize: '52px', marginBottom: '16px' }}>📭</div>
                    Aún no tienes entregas completadas
                </div>
            ) : pedidosHistorial.map(p => (
                <div key={p.id} style={st.pedidoItem}>
                    <div style={st.pedidoItemTop}>
                        <span style={{ fontSize: '16px', fontWeight: 'bold', color: '#222' }}>
                            Pedido #{p.id?.slice(-4).toUpperCase()}
                        </span>
                        <span style={{ ...st.estadoBadge, background: '#e3ffea', color: '#009944' }}>✅ Entregado</span>
                    </div>
                    <p style={{ color: '#666', fontSize: '13px', margin: '8px 0 4px' }}>
                        Cliente: <strong>{p.nombreCliente}</strong>
                    </p>
                    <p style={{ color: '#888', fontSize: '13px', marginBottom: '10px' }}>
                        📅 {formatFecha(p.fecha_entrega)}
                    </p>
                    <div style={st.rutaBox}>
                        <div style={st.puntoRuta}>
                            <div style={{ ...st.circulo, background: '#00b85c' }}></div>
                            <div>
                                <span style={st.rutaLabel}>Recogida</span>
                                <strong style={st.rutaVal}>{p.restaurante || '—'}</strong>
                            </div>
                        </div>
                        <div style={st.lineaRuta}></div>
                        <div style={st.puntoRuta}>
                            <div style={{ ...st.circulo, background: '#ff4d4d' }}></div>
                            <div>
                                <span style={st.rutaLabel}>Entrega</span>
                                <strong style={st.rutaVal}>{p.direccionEntrega}</strong>
                            </div>
                        </div>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '12px' }}>
                        <span style={{ fontSize: '13px', color: '#777' }}>
                            {METODO_EMOJI[p.metodo] || '🛵'} {p.metodo || 'delivery'}
                        </span>
                        <span style={{ fontSize: '20px', fontWeight: 'bold', color: '#016d3b' }}>
                            +${p.precioDelivery?.toFixed(2) || '0.00'}
                        </span>
                    </div>
                </div>
            ))}
        </>
    );
}

function Perfil({
    userData, navigate, showToast,
    editandoPerfil, setEditandoPerfil,
    nuevoNombre, setNuevoNombre,
    nuevoTelefono, setNuevoTelefono,
    nuevaDireccion, setNuevaDireccion,
    nuevoCorreo, setNuevoCorreo,
    nuevoVehiculo, setNuevoVehiculo,
    nuevaPlaca, setNuevaPlaca,
    activarEdicion, guardarCambiosPerfil,
}) {
    const cerrarSesion = async () => {
        try {
            await signOut(auth);
            navigate('/index');
        } catch {
                        showToast('No se pudo cerrar sesión. Intenta de nuevo.', 'error');

        }
    };

    return (
        <>
            <div style={st.perfilHeader}>
                <div style={st.headerCircle}></div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', position: 'relative', zIndex: 2 }}>
                    <button style={st.volverBtn} onClick={() => setEditandoPerfil(false)}>←</button>
                    <img src="https://cdn-icons-png.flaticon.com/512/149/149071.png" alt="foto"
                        style={{ width: '90px', height: '90px', borderRadius: '50%', border: '4px solid white', objectFit: 'cover', boxShadow: '0 8px 20px rgba(0,0,0,0.25)' }} />
                    <div style={{ width: '44px' }}></div>
                </div>
                <h1 style={{ ...st.titulo, marginTop: '10px', textAlign: 'center' }}>{userData?.nombre || 'Repartidor'}</h1>
                <p style={{ ...st.subtitulo, textAlign: 'center' }}>Repartidor activo en la comunidad solidaria</p>
            </div>

            <div style={st.card}>
                <h3 style={st.cardTitulo}>Información personal</h3>

                {editandoPerfil ? (
                    <div>
                        <label style={st.label}>Nombre Completo</label>
                        <input style={st.inputField} type="text" value={nuevoNombre} onChange={e => setNuevoNombre(e.target.value)} />
                        <label style={st.label}>Correo Electrónico</label>
                        <input style={st.inputField} type="email" value={nuevoCorreo} onChange={e => setNuevoCorreo(e.target.value)} />
                        <label style={st.label}>Teléfono</label>
                        <input style={st.inputField} type="text" value={nuevoTelefono} onChange={e => setNuevoTelefono(e.target.value)} />
                        <label style={st.label}>Dirección</label>
                        <input style={st.inputField} type="text" value={nuevaDireccion} onChange={e => setNuevaDireccion(e.target.value)} />
                        <label style={st.label}>Vehículo</label>
                        <select style={st.inputField} value={nuevoVehiculo} onChange={e => setNuevoVehiculo(e.target.value)}>
                            <option value="">Selecciona un vehículo</option>
                            <option value="bicicleta">🚲 Bicicleta</option>
                            <option value="motocicleta">🛵 Motocicleta</option>
                            <option value="auto">🚗 Auto</option>
                            <option value="camion">🚚 Camión</option>
                        </select>
                        <label style={st.label}>Placa</label>
                        <input style={st.inputField} type="text" value={nuevaPlaca} onChange={e => setNuevaPlaca(e.target.value)} />
                        <div style={{ display: 'flex', gap: '12px', marginTop: '24px' }}>
                            <button style={st.btnCancelar} onClick={() => setEditandoPerfil(false)}>Cancelar</button>
                            <button style={{ ...st.btnGuardar, flex: 1 }} onClick={guardarCambiosPerfil}>Guardar Cambios</button>
                        </div>
                    </div>
                ) : (
                    <>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
                            {[
                                { label: 'Correo',    val: userData?.correo || '—' },
                                { label: 'Teléfono',  val: userData?.telefono || '—' },
                                { label: 'Dirección', val: userData?.direccion || '—' },
                                { label: 'Vehículo',  val: userData?.vehiculo
                                    ? `${METODO_EMOJI[VEHICULO_A_METODO[userData.vehiculo]] || ''} ${userData.vehiculo}`
                                    : '—' },
                                { label: 'Placa',     val: userData?.placa || '—' },
                                { label: 'Miembro desde', val: userData?.fecha_registro?.toDate
                                    ? userData.fecha_registro.toDate().toLocaleDateString('es-SV', { month: 'long', year: 'numeric' })
                                    : '—' },
                            ].map((item, i) => (
                                <div key={i} style={st.infoBox}>
                                    <span style={st.infoLabel}>{item.label}</span>
                                    <strong style={{ fontSize: '14px', color: '#222' }}>{item.val}</strong>
                                </div>
                            ))}
                        </div>
                        <button style={{ ...st.boton, marginTop: '20px' }} onClick={activarEdicion}>
                            📝 Editar perfil
                        </button>
                        <br /><br />
                        <div style={{ ...st.accion }} onClick={cerrarSesion}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                                <span style={{ fontSize: '22px' }}></span>
                                <div>
                                    <h4 style={{ fontSize: '15px', color: '#d60000', marginBottom: '3px' }}>Cerrar sesión</h4>
                                    <p style={{ fontSize: '13px', color: '#666' }}>Salir de la aplicación</p>
                                </div>
                            </div>
                            <span style={{ fontSize: '20px', color: '#888' }}>›</span>
                        </div>
                    </>
                )}
            </div>
        </>
    );
}

const st = {
    container:        { minHeight: '100vh', background: 'linear-gradient(135deg,#eef2f7,#dfe7f3)', display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '18px', paddingBottom: '140px', fontFamily: 'Arial, Helvetica, sans-serif', boxSizing: 'border-box' },
    loading:          { display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', fontSize: '18px', color: '#00a344' },
    dashboard:        { width: '100%', maxWidth: '1100px' },
    header:           { background: 'linear-gradient(135deg,#006d2f,#00a344)', borderRadius: '28px', padding: '24px', color: 'white', position: 'relative', overflow: 'hidden', boxShadow: '0 15px 35px rgba(0,0,0,0.12)' },
    perfilHeader:     { width: '100%', maxWidth: '1100px', boxSizing: 'border-box', background: 'linear-gradient(135deg,#006d2f,#00a344)', color: 'white', padding: '28px 28px 60px 28px', minHeight: '220px', borderRadius: '28px', marginBottom: '20px', marginTop: '-22px', position: 'relative', overflow: 'hidden', textAlign: 'center' },
    headerCircle:     { position: 'absolute', width: '200px', height: '200px', borderRadius: '50%', background: 'rgba(255,255,255,0.05)', top: '-80px', right: '-50px' },
    headerContent:    { display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '18px', position: 'relative', zIndex: 2 },
    textoHeader:      { flex: 1 },
    titulo:           { fontSize: '28px', fontWeight: 800, margin: 0, color: 'white' },
    subtitulo:        { marginTop: '6px', color: '#dcffe9', fontSize: '14px' },
    onlineBtn:        { marginTop: '15px', background: 'rgba(255,255,255,0.15)', border: '1px solid rgba(255,255,255,0.25)', width: 'max-content', padding: '8px 16px', borderRadius: '25px', display: 'flex', alignItems: 'center', gap: '10px', fontSize: '13px', cursor: 'pointer' },
    onlineBtnOffline: { marginTop: '15px', background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.15)', width: 'max-content', padding: '8px 16px', borderRadius: '25px', display: 'flex', alignItems: 'center', gap: '10px', fontSize: '13px', cursor: 'pointer' },
    estadoTexto:      { fontWeight: '600', color: 'white' },
    switchTrack:      { width: '42px', height: '22px', background: 'white', borderRadius: '20px', position: 'relative' },
    switchBall:       { position: 'absolute', width: '16px', height: '16px', borderRadius: '50%', top: '3px', transition: '0.25s' },
    foto:             { width: '88px', height: '88px', borderRadius: '50%', objectFit: 'cover', border: '4px solid white', boxShadow: '0 8px 20px rgba(0,0,0,0.25)' },
    contenido:        { marginTop: '22px', width: '100%', maxWidth: '1100px' },
    tituloSeccion:    { marginBottom: '14px' },
    tituloH2:         { fontSize: '24px', color: '#222', margin: 0 },
    tarjetas:         { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px', marginBottom: '18px' },
    card:             { background: 'white', borderRadius: '24px', padding: '22px', boxShadow: '0 8px 25px rgba(0,0,0,0.08)', marginBottom: '16px' },
    cardTop:          { display: 'flex', alignItems: 'center', gap: '12px' },
    icono:            { width: '55px', height: '55px', borderRadius: '18px', display: 'flex', justifyContent: 'center', alignItems: 'center', fontSize: '25px', flexShrink: 0 },
    verde:            { background: '#dfffe9' },
    azul:             { background: '#dfefff' },
    cardNumero:       { fontSize: '22px', color: '#222', margin: 0 },
    cardTexto:        { marginTop: '5px', color: '#777', fontSize: '13px' },
    cardTitulo:       { fontSize: '20px', color: '#222', marginBottom: '14px' },
    grid:             { display: 'grid', gap: '18px', marginTop: '24px' },
    pedido:           { background: 'white', borderRadius: '24px', padding: '22px', boxShadow: '0 8px 25px rgba(0,0,0,0.08)' },
    estadoBadge:      { display: 'inline-block', background: '#dfffe9', color: '#00853a', padding: '6px 12px', borderRadius: '16px', fontSize: '11px', fontWeight: 'bold', whiteSpace: 'nowrap' },
    pedidoTitulo:     { marginTop: '14px', fontSize: '22px', color: '#222' },
    cliente:          { marginTop: '5px', color: '#666', fontSize: '14px' },
    direccion:        { marginTop: '15px', background: '#f5f5f5', borderRadius: '16px', padding: '16px', color: '#444', lineHeight: '1.5', fontSize: '13px' },
    boton:            { width: '100%', marginTop: '18px', padding: '14px', border: 'none', borderRadius: '16px', background: 'linear-gradient(to right,#006d2f,#00a344)', color: 'white', fontSize: '14px', fontWeight: 'bold', cursor: 'pointer' },
    progreso:         { background: 'white', borderRadius: '24px', padding: '22px', boxShadow: '0 8px 25px rgba(0,0,0,0.08)' },
    progresoTitulo:   { fontSize: '18px', color: '#222', marginBottom: '15px' },
    textoProgreso:    { display: 'flex', justifyContent: 'space-between', marginBottom: '10px', color: '#444', fontWeight: 'bold', fontSize: '13px' },
    barra:            { width: '100%', height: '12px', background: '#e0e0e0', borderRadius: '20px', overflow: 'hidden' },
    relleno:          { height: '100%', background: 'linear-gradient(to right,#00a344,#006d2f)', transition: 'width 0.5s' },
    nav:              { position: 'fixed', bottom: '20px', left: '50%', transform: 'translateX(-50%)', width: '92%', maxWidth: '760px', background: 'rgba(255,255,255,0.92)', backdropFilter: 'blur(14px)', borderRadius: '22px', padding: '14px 18px', display: 'flex', justifyContent: 'space-around', alignItems: 'center', boxShadow: '0 10px 30px rgba(0,0,0,0.12)', border: '1px solid rgba(255,255,255,0.5)', zIndex: 999 },
    navItem:          { textAlign: 'center', fontSize: '12px', cursor: 'pointer', transition: '0.2s' },
    navIcon:          { display: 'block', fontSize: '24px', marginBottom: '4px' },
    sinDatos:         { textAlign: 'center', padding: '40px', color: '#777', fontSize: '16px' },
    pedidoItem:       { background: 'white', borderRadius: '26px', padding: '22px', boxShadow: '0 10px 25px rgba(0,0,0,0.08)', marginBottom: '18px' },
    pedidoItemTop:    { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' },
    rutaBox:          { marginTop: '16px', background: '#f7f7f7', borderRadius: '18px', padding: '16px' },
    puntoRuta:        { display: 'flex', alignItems: 'center', gap: '12px' },
    circulo:          { width: '14px', height: '14px', borderRadius: '50%', flexShrink: 0 },
    lineaRuta:        { width: '3px', height: '28px', background: '#d0d0d0', marginLeft: '5px', marginTop: '4px', marginBottom: '4px', borderRadius: '20px' },
    rutaLabel:        { display: 'block', fontSize: '12px', color: '#777', marginBottom: '2px' },
    rutaVal:          { color: '#222', fontSize: '14px' },
    botonesRow:       { display: 'flex', gap: '12px', marginTop: '18px' },
    btnAceptar:       { flex: 1, padding: '14px', border: 'none', borderRadius: '16px', background: 'linear-gradient(to right,#006d2f,#00a344)', color: 'white', fontSize: '14px', fontWeight: 'bold', cursor: 'pointer' },
    btnRechazar:      { flex: 1, padding: '14px', border: 'none', borderRadius: '16px', background: '#ececec', color: '#555', fontSize: '14px', fontWeight: 'bold', cursor: 'pointer' },
    miniCard:         { background: 'white', borderRadius: '20px', padding: '20px', textAlign: 'center', boxShadow: '0 6px 18px rgba(0,0,0,0.06)' },
    miniCardVal:      { fontSize: '26px', color: '#00a344', marginBottom: '4px' },
    miniCardLabel:    { color: '#666', fontSize: '13px' },
    infoBox:          { background: '#f5f5f5', padding: '16px', borderRadius: '18px' },
    infoLabel:        { display: 'block', fontSize: '12px', color: '#777', marginBottom: '6px' },
    accion:           { display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#f5f5f5', padding: '16px', borderRadius: '18px', cursor: 'pointer', marginBottom: '12px' },
    vehiculoBadge:    { display: 'flex', alignItems: 'center', gap: '12px', background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: '18px', padding: '12px 16px', marginBottom: '16px' },
    vehiculoBadgePill:{ marginLeft: 'auto', background: '#dcfce7', color: '#166534', fontSize: '11px', fontWeight: 'bold', padding: '4px 10px', borderRadius: '20px' },
    filtroActivo:     { display: 'flex', alignItems: 'center', gap: '10px', background: '#fffbeb', border: '1px solid #fde68a', borderRadius: '16px', padding: '12px 16px', marginBottom: '16px' },
    metodoRequerido:  { display: 'flex', alignItems: 'center', gap: '10px', background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: '14px', padding: '10px 14px', margin: '10px 0' },
    label:            { display: 'block', marginTop: '16px', marginBottom: '8px', fontWeight: 'bold', color: '#333', fontSize: '14px' },
    inputField:       { width: '100%', padding: '15px', border: 'none', borderRadius: '18px', background: '#f5f5f5', fontSize: '15px', outline: 'none', boxSizing: 'border-box', marginBottom: '4px' },
    btnGuardar:       { flex: 1, padding: '16px', background: 'linear-gradient(to right,#006d2f,#00a344)', color: 'white', border: 'none', borderRadius: '16px', fontWeight: 'bold', cursor: 'pointer', fontSize: '15px' },
    btnCancelar:      { flex: 1, padding: '16px', background: '#f0f0f0', color: '#555', border: 'none', borderRadius: '16px', fontWeight: 'bold', cursor: 'pointer', fontSize: '15px' },
    volverBtn:        { width: '44px', height: '44px', border: 'none', borderRadius: '14px', background: 'rgba(255,255,255,0.15)', color: 'white', fontSize: '20px', cursor: 'pointer', marginBottom: '16px', display: 'block', position: 'relative', zIndex: 2 },
};

export default DashboardRepartidor;