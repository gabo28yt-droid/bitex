// ============================================================
// DashboardDonante.jsx
// ------------------------------------------------------------
// Componente principal del panel de control para donantes.
// Gestiona las donaciones, solicitudes recibidas, pedidos en
// camino y el perfil del usuario autenticado.
// ============================================================

import React, { useState, useEffect, useCallback } from 'react';
import { Toast } from '../components/Toast';
import { useToast } from '../components/useToast';
import { db, auth } from '../firebase/conifg';
import {
    collection, query, where, onSnapshot,
    getDocs, doc, deleteDoc, updateDoc
} from "firebase/firestore";
// onAuthStateChanged → detecta si hay sesión activa
// signOut           → cierra la sesión
import { onAuthStateChanged, signOut } from "firebase/auth";
import { useNavigate, Link } from 'react-router-dom';





// ============================================================
// COMPONENTE: ConfirmModal
// ------------------------------------------------------------
// Modal de confirmación que bloquea la pantalla y pide al
// usuario que confirme o cancele una acción crítica.
//
// Props:
//   confirm   → objeto { message, onConfirm } o null
//               Si es null, el modal no se renderiza
//   onCancel  → función llamada al presionar "Cancelar"
//   onAccept  → función llamada al presionar "Confirmar"
// ============================================================
function ConfirmModal({ confirm, onCancel, onAccept }) {
    // Si no hay datos de confirmación, no renderiza nada
    if (!confirm) return null;

    return (
        // Fondo oscuro semitransparente que bloquea la interfaz
        <div style={{
            position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
            background: 'rgba(0,0,0,0.55)', zIndex: 9998,
            display: 'flex', alignItems: 'center', justifyContent: 'center'
        }}>
            {/* Tarjeta del modal */}
            <div style={{
                background: 'white', borderRadius: '26px', padding: '28px 24px',
                width: '88%', maxWidth: '360px', textAlign: 'center',
                boxShadow: '0 20px 50px rgba(0,0,0,0.2)'
            }}>
                {/* Ícono de advertencia */}
                <div style={{
                    width: '64px', height: '64px', background: '#fff3cd',
                    borderRadius: '50%', display: 'flex', alignItems: 'center',
                    justifyContent: 'center', margin: '0 auto 18px', fontSize: '32px'
                }}>⚠️</div>

                <h3 style={{ fontSize: '18px', color: '#222', marginBottom: '10px' }}>¿Estás seguro?</h3>
                <p style={{ fontSize: '14px', color: '#666', lineHeight: 1.6, marginBottom: '24px' }}>
                    {confirm.message}
                </p>

                {/* Botones de acción */}
                <div style={{ display: 'flex', gap: '12px' }}>
                    <button style={{ flex: 1, padding: '13px', border: 'none', borderRadius: '16px', background: '#f0f0f0', color: '#555', fontSize: '14px', fontWeight: 'bold', cursor: 'pointer' }}
                        onClick={onCancel}>Cancelar</button>
                    <button style={{ flex: 1, padding: '13px', border: 'none', borderRadius: '16px', background: 'linear-gradient(to right,#a00000,#ff3b3b)', color: 'white', fontSize: '14px', fontWeight: 'bold', cursor: 'pointer' }}
                        onClick={onAccept}>Confirmar</button>
                </div>
            </div>
        </div>
    );
}


// ============================================================
// HOOK: useIsMobile
// ------------------------------------------------------------
// Hook personalizado que detecta si el ancho de pantalla es
// menor a 640px (tamaño móvil). Se actualiza automáticamente
// al redimensionar la ventana.
//
// Retorna: boolean → true si es móvil, false si es escritorio
// ============================================================
function useIsMobile() {
    const [isMobile, setIsMobile] = React.useState(window.innerWidth < 640);
    React.useEffect(() => {
        const handler = () => setIsMobile(window.innerWidth < 640);
        window.addEventListener('resize', handler);
        // Limpieza: remueve el listener al desmontar el componente
        return () => window.removeEventListener('resize', handler);
    }, []);
    return isMobile;
}


// ============================================================
// COMPONENTE PRINCIPAL: DashboardDonante
// ------------------------------------------------------------
// Raíz del dashboard. Controla la autenticación, carga datos
// de Firestore en tiempo real y decide qué "pestaña" mostrar.
// ============================================================
function DashboardDonante() {

    // ── Estado del usuario ──────────────────────────────────
    const [userData, setUserData]             = useState(null);   // Datos del perfil (nombre, correo, etc.)
    const [uid, setUid]                       = useState(null);   // UID de Firebase Auth

    // ── Estado de donaciones ────────────────────────────────
    const [donaciones, setDonaciones]         = useState([]);     // Lista completa de donaciones del usuario
    const [donacionesCount, setDonacionesCount]     = useState(0); // Total de donaciones
    const [donacionesActivas, setDonacionesActivas] = useState(0); // Solo las en estado 'disponible'

    // ── Estado de solicitudes y pedidos ─────────────────────
    const [solicitudesCount, setSolicitudesCount] = useState(0); // Cantidad de solicitudes pendientes
    const [solicitudes, setSolicitudes]           = useState([]); // Solicitudes pendientes completas
    const [pedidosEnCamino, setPedidosEnCamino]   = useState([]); // Pedidos asignados o en camino

    // ── Estado de UI ────────────────────────────────────────
    const [loading, setLoading]   = useState(true);        // Pantalla de carga
    const [pestana, setPestana]   = useState('inicio');    // Pestaña activa en el nav

    // ── Estado de edición de donación ───────────────────────
    const [editando, setEditando]         = useState(false); // ¿Está abierto el modal de edición?
    const [donacionEdit, setDonacionEdit] = useState(null);  // Copia de la donación que se está editando

    // ── Estado de edición de perfil ─────────────────────────
    const [editandoPerfil, setEditandoPerfil] = useState(false);
    const [nuevoNombre, setNuevoNombre]       = useState('');
    const [nuevoTelefono, setNuevoTelefono]   = useState('');
    const [nuevaDireccion, setNuevaDireccion] = useState('');
    const [nuevoCorreo, setNuevoCorreo]       = useState('');

    // ── Estado de notificaciones ────────────────────────────
    const { toasts, showToast, removeToast } = useToast();
    const [confirmData, setConfirmData] = useState(null); // Datos del modal de confirmación

    const navigate = useNavigate();



    // ──────────────────────────────────────────────────────
    // FUNCIÓN: showConfirm
    // Abre el ConfirmModal almacenando el mensaje y el callback
    // que se ejecutará si el usuario acepta.
    // ──────────────────────────────────────────────────────
    const showConfirm = useCallback((message, onConfirm) => {
        setConfirmData({ message, onConfirm });
    }, []);

    // ──────────────────────────────────────────────────────
    // FUNCIÓN: handleConfirmAccept
    // Ejecuta el callback guardado en confirmData y cierra el modal.
    // ──────────────────────────────────────────────────────
    const handleConfirmAccept = () => {
        if (confirmData?.onConfirm) confirmData.onConfirm();
        setConfirmData(null);
    };


    // ──────────────────────────────────────────────────────
    // EFECTO: Autenticación y carga de datos en tiempo real
    // Se ejecuta una sola vez al montar el componente.
    // Suscribe 3 listeners de Firestore (onSnapshot) que se
    // actualizan automáticamente cuando cambia la base de datos.
    // ──────────────────────────────────────────────────────
    useEffect(() => {
        const unsubAuth = onAuthStateChanged(auth, async (user) => {
            if (user) {
                setUid(user.uid);
                try {
                    // 1. Obtiene el documento del usuario en la colección "usuarios"
                    const qUsuario = query(collection(db, "usuarios"), where("uid", "==", user.uid));
                    const snap = await getDocs(qUsuario);
                    if (!snap.empty) setUserData(snap.docs[0].data());

                    // 2. Listener en tiempo real: donaciones del donador
                    const qDon = query(collection(db, "donaciones"), where("donadorId", "==", user.uid));
                    onSnapshot(qDon, (s) => {
                        const lista = s.docs.map(d => ({ id: d.id, ...d.data() }));
                        setDonaciones(lista);
                        setDonacionesCount(lista.length);
                        setDonacionesActivas(lista.filter(d => d.estado === 'disponible').length);
                    });

                    // 3. Listener en tiempo real: pedidos pendientes hacia este donador
                    const qPedidos = query(
                        collection(db, "pedidos"),
                        where("donadorId", "==", user.uid),
                        where("estado", "==", "pendiente")
                    );
                    onSnapshot(qPedidos, (s) => {
                        setSolicitudesCount(s.size);
                        setSolicitudes(s.docs.map(d => ({ id: d.id, ...d.data() })));
                    });

                    // 4. Listener en tiempo real: pedidos asignados o en camino
                    //    Solo incluye los que ya tienen repartidor asignado
                    const qEnCamino = query(
                        collection(db, "pedidos"),
                        where("donadorId", "==", user.uid),
                        where("estado", "in", ["asignado", "en_camino"])
                    );
                    onSnapshot(qEnCamino, (s) => {
                        const lista = s.docs.map(d => ({ id: d.id, ...d.data() }));
                        setPedidosEnCamino(lista.filter(p => p.repartidorId !== null));
                    });

                } catch (e) {
                    console.error(e);
                } finally {
                    setLoading(false); // Oculta la pantalla de carga pase lo que pase
                }
            } else {
                // Sin sesión activa → redirige al login
                setLoading(false);
                navigate('/index');
            }
        });

        // Limpieza: desuscribe el listener de auth al desmontar
        return () => unsubAuth();
    }, [navigate]);


    // ──────────────────────────────────────────────────────
    // FUNCIÓN: cerrarSesion
    // Llama a signOut de Firebase y redirige al login.
    // ──────────────────────────────────────────────────────
    const cerrarSesion = async () => {
        await signOut(auth);
        navigate('/index');
    };


    // ──────────────────────────────────────────────────────
    // FUNCIÓN: eliminarDonacion
    // Muestra el modal de confirmación antes de borrar el
    // documento de Firestore con el id recibido.
    // ──────────────────────────────────────────────────────
    const eliminarDonacion = async (id) => {
        showConfirm(
            'Esta acción eliminará permanentemente la donación. No podrás deshacer esto.',
            async () => {
                await deleteDoc(doc(db, 'donaciones', id));
                showToast('Donación eliminada correctamente.', 'success');
            }
        );
    };


    // ──────────────────────────────────────────────────────
    // FUNCIÓN: abrirEditar
    // Copia la donación seleccionada en el estado local y
    // activa el modal de edición.
    // ──────────────────────────────────────────────────────
    const abrirEditar = (donacion) => {
        setDonacionEdit({ ...donacion }); // Spread evita mutar el original
        setEditando(true);
    };


    // ──────────────────────────────────────────────────────
    // FUNCIÓN: guardarEdicion
    // Actualiza en Firestore solo los campos editables de
    // la donación. Muestra toast de éxito o error.
    // ──────────────────────────────────────────────────────
    const guardarEdicion = async () => {
        if (!donacionEdit) return;
        try {
            await updateDoc(doc(db, 'donaciones', donacionEdit.id), {
                titulo:          donacionEdit.titulo,
                descripcion:     donacionEdit.descripcion || '',
                cantidad:        donacionEdit.cantidad,
                ubicacion:       donacionEdit.ubicacion,
                disponibleHasta: donacionEdit.disponibleHasta,
            });
            showToast('Donación actualizada correctamente', 'success');
            setEditando(false);
            setDonacionEdit(null);
        } catch (e) {
            console.error(e);
            showToast('Error al guardar los cambios', 'error');
        }
    };


    // ──────────────────────────────────────────────────────
    // FUNCIÓN: getNombre
    // Extrae el primer nombre del usuario para el saludo.
    // Devuelve 'Donante' si no hay datos aún.
    // ──────────────────────────────────────────────────────
    const getNombre = () => userData?.nombre?.split(' ')[0] || 'Donante';


    // ──────────────────────────────────────────────────────
    // FUNCIÓN: guardarCambiosPerfil
    // Busca el documento del usuario en Firestore y actualiza
    // los campos del perfil. Prioriza el nuevo valor; si está
    // vacío, mantiene el valor anterior.
    // ──────────────────────────────────────────────────────
    const guardarCambiosPerfil = async () => {
        try {
            const q = query(collection(db, "usuarios"), where("uid", "==", uid));
            const snap = await getDocs(q);
            if (!snap.empty) {
                const docId = snap.docs[0].id;
                const datosActualizados = {
                    nombre:    nuevoNombre    || userData?.nombre,
                    telefono:  nuevoTelefono  || userData?.telefono,
                    direccion: nuevaDireccion || userData?.direccion,
                    correo:    nuevoCorreo    || userData?.correo
                };
                await updateDoc(doc(db, "usuarios", docId), datosActualizados);
                // Actualiza el estado local para que la UI refleje los cambios sin re-fetch
                setUserData(prev => ({ ...prev, ...datosActualizados }));
                setEditandoPerfil(false);
                showToast('¡Tu perfil de Donador ha sido actualizado con éxito!', 'success');
            }
        } catch (error) {
            console.error("Error al actualizar el perfil:", error);
            showToast('Hubo un error al guardar los cambios.', 'error');
        }
    };


    // ──────────────────────────────────────────────────────
    // FUNCIÓN: activarEdicion
    // Pre-llena los campos de edición con los datos actuales
    // del usuario antes de mostrar el formulario.
    // ──────────────────────────────────────────────────────
    const activarEdicion = () => {
        setNuevoNombre(userData?.nombre    || '');
        setNuevoTelefono(userData?.telefono  || '');
        setNuevaDireccion(userData?.direccion || '');
        setNuevoCorreo(userData?.correo    || '');
        setEditandoPerfil(true);
    };


    // ──────────────────────────────────────────────────────
    // FUNCIÓN: getEstado
    // Devuelve un objeto con color de fondo, color de texto y
    // etiqueta legible según el estado de una donación.
    // Sirve para pintar el badge de estado en las tarjetas.
    // ──────────────────────────────────────────────────────
    const getEstado = (estado) => {
        if (estado === 'disponible') return { bg: '#dff8e8', color: '#0c8a46', label: 'Disponible' };
        if (estado === 'entregado')  return { bg: '#dff8e8', color: '#0c8a46', label: 'Entregada' };
        if (estado === 'cancelado')  return { bg: '#ffe2e2', color: '#d93030', label: 'Cancelada' };
        return { bg: '#fff3d9', color: '#d38a00', label: 'Pendiente' }; // estado desconocido o en_proceso
    };


    // ── Pantalla de carga ────────────────────────────────
    if (loading) return <div style={s.loading}>Cargando...</div>;


    // ── ENRUTAMIENTO POR PESTAÑA ─────────────────────────
    // En lugar de React Router para rutas internas, se usa
    // un estado 'pestana' que decide qué pantalla renderizar.
    // Cada rama pasa Toast y ConfirmModal para que funcionen
    // en cualquier sección.

    if (pestana === 'mis-donaciones') return (
        <>
            <Toast toasts={toasts} removeToast={removeToast} />
            <ConfirmModal confirm={confirmData} onCancel={() => setConfirmData(null)} onAccept={handleConfirmAccept} />
            <MisDonaciones
                donaciones={donaciones} uid={uid}
                onVolver={() => setPestana('inicio')} setPestana={setPestana}
                onEliminar={eliminarDonacion} onEditar={abrirEditar}
                getEstado={getEstado}
                editando={editando} donacionEdit={donacionEdit}
                setDonacionEdit={setDonacionEdit} setEditando={setEditando}
                guardarEdicion={guardarEdicion}
            />
        </>
    );

    if (pestana === 'solicitudes') return (
        <>
            <Toast toasts={toasts} removeToast={removeToast} />
            <ConfirmModal confirm={confirmData} onCancel={() => setConfirmData(null)} onAccept={handleConfirmAccept} />
            <SolicitudesRecibidas
                solicitudes={solicitudes} pedidosEnCamino={pedidosEnCamino}
                onVolver={() => setPestana('inicio')} setPestana={setPestana}
                navigate={navigate} showToast={showToast} showConfirm={showConfirm}
            />
        </>
    );

    if (pestana === 'perfil') return (
        <>
            <Toast toasts={toasts} removeToast={removeToast} />
            <ConfirmModal confirm={confirmData} onCancel={() => setConfirmData(null)} onAccept={handleConfirmAccept} />
            <PerfilDonante
                userData={userData} donacionesCount={donacionesCount}
                donacionesActivas={donacionesActivas}
                onVolver={() => setPestana('inicio')} setPestana={setPestana}
                editandoPerfil={editandoPerfil} setEditandoPerfil={setEditandoPerfil}
                nuevoNombre={nuevoNombre} setNuevoNombre={setNuevoNombre}
                nuevoTelefono={nuevoTelefono} setNuevoTelefono={setNuevoTelefono}
                nuevaDireccion={nuevaDireccion} setNuevaDireccion={setNuevaDireccion}
                nuevoCorreo={nuevoCorreo} setNuevoCorreo={setNuevoCorreo}
                activarEdicion={activarEdicion} guardarCambiosPerfil={guardarCambiosPerfil}
                cerrarSesion={cerrarSesion}
            />
        </>
    );


    // ── VISTA INICIO (pestaña por defecto) ───────────────
    return (
        <div style={s.page}>
            <Toast toasts={toasts} removeToast={removeToast} />
            <ConfirmModal confirm={confirmData} onCancel={() => setConfirmData(null)} onAccept={handleConfirmAccept} />

            <div style={s.dashboard}>
                {/* HEADER verde con saludo y foto de perfil */}
                <div style={s.header}>
                    {/* Círculo decorativo en la esquina del header */}
                    <div style={s.headerCircle}></div>
                    <div style={s.headerContent}>
                        <div>
                            <h1 style={s.titulo}>¡Hola, {getNombre()}! 👋</h1>
                            <p style={s.subtitulo}>Gracias por compartir comida con quienes más lo necesitan</p>
                        </div>
                        {/* Foto de perfil genérica (en el futuro podría ser la foto real del usuario) */}
                        <img src="https://cdn-icons-png.flaticon.com/512/149/149071.png" alt="perfil" style={s.foto} />
                    </div>
                </div>

                <div style={s.contenido}>
                    {/* ALERTA: solicitudes pendientes
                        Solo se muestra si hay al menos una solicitud */}
                    {solicitudes.length > 0 && (
                        <div style={s.alertaSolicitudes} onClick={() => setPestana('solicitudes')}>
                            <span style={{ fontSize: '24px' }}>🔔</span>
                            <div style={{ flex: 1 }}>
                                <strong style={{ color: '#7a4a00', fontSize: '15px' }}>
                                    {solicitudes.length} solicitud{solicitudes.length > 1 ? 'es' : ''} pendiente{solicitudes.length > 1 ? 's' : ''}
                                </strong>
                                <p style={{ fontSize: '13px', color: '#9a6200', marginTop: '2px' }}>
                                    Alguien quiere recibir tu donación. ¡Responde ahora!
                                </p>
                            </div>
                            <span style={{ color: '#9a6200', fontSize: '22px' }}>›</span>
                        </div>
                    )}

                    {/* ALERTA: pedidos en camino
                        Solo se muestra si hay pedidos con repartidor asignado */}
                    {pedidosEnCamino.length > 0 && (
                        <div style={{
                            ...s.alertaSolicitudes,
                            background: '#e3f0ff', border: '1px solid #a0c4ff',
                            boxShadow: '0 4px 14px rgba(0,100,255,0.10)'
                        }} onClick={() => setPestana('solicitudes')}>
                            <span style={{ fontSize: '24px' }}>🛵</span>
                            <div style={{ flex: 1 }}>
                                <strong style={{ color: '#003a8c', fontSize: '15px' }}>
                                    {pedidosEnCamino.length} pedido{pedidosEnCamino.length > 1 ? 's' : ''} en camino
                                </strong>
                                <p style={{ fontSize: '13px', color: '#0050b3', marginTop: '2px' }}>
                                    Toca para rastrear al repartidor en tiempo real
                                </p>
                            </div>
                            <span style={{ color: '#0050b3', fontSize: '22px' }}>›</span>
                        </div>
                    )}

                    {/* CARD PRINCIPAL: invitación a donar */}
                    <div style={s.cardPrincipal}>
                        <div style={s.iconoPrincipal}>🍱</div>
                        <div style={{ flex: 1 }}>
                            <h2 style={s.cardH2}>Alimenta el cambio</h2>
                            <p style={s.cardP}>Tu comida puede ayudar a muchas personas.</p>
                            <Link to="/donaciones" style={{ textDecoration: 'none' }}>
                                <button style={s.botonPrincipal}>Hacer una donación</button>
                            </Link>
                        </div>
                    </div>

                    {/* RESUMEN DE IMPACTO: stats numéricos */}
                    <h2 style={{ ...s.tituloSeccion, marginTop: '24px' }}>Resumen de impacto</h2>
                    <StatsInicio
                        donacionesCount={donacionesCount}
                        donacionesActivas={donacionesActivas}
                        solicitudesCount={solicitudesCount}
                    />

                    {/* DONACIÓN ACTIVA: muestra solo la primera disponible */}
                    {donaciones.filter(d => d.estado === 'disponible').length > 0 && (
                        <>
                            <h2 style={{ ...s.tituloSeccion, marginTop: '24px' }}>Donación activa</h2>
                            {donaciones.filter(d => d.estado === 'disponible').slice(0, 1).map(d => {
                                const est = getEstado(d.estado);
                                // Soporte para múltiples imágenes o imagen única (legado)
                                const imagenes = d.imagenes?.length
                                    ? d.imagenes
                                    : (d.imagen || d.fotoUrl ? [d.imagen || d.fotoUrl] : []);
                                return (
                                    <div key={d.id} style={{ ...s.card, display: 'flex', gap: '16px', alignItems: 'center', padding: '18px', marginBottom: 0 }}>
                                        {imagenes.length > 0 && (
                                            <img src={imagenes[0]} alt={d.titulo || d.nombre}
                                                style={{ width: '110px', height: '100px', borderRadius: '18px', objectFit: 'cover', flexShrink: 0 }}
                                                onError={e => { e.target.style.display = 'none'; }} // Oculta la imagen si falla
                                            />
                                        )}
                                        <div style={{ flex: 1, minWidth: 0 }}>
                                            <span style={{ ...s.estadoBadge, background: est.bg, color: est.color, marginBottom: '8px', display: 'inline-block' }}>{est.label}</span>
                                            <h3 style={{ fontSize: '18px', color: '#222', marginBottom: '6px' }}>{d.titulo || d.nombre}</h3>
                                            <p style={{ color: '#666', fontSize: '13px', marginBottom: '8px', lineHeight: 1.5 }}>{d.descripcion}</p>
                                            <p style={{ color: '#555', fontSize: '13px' }}>📍 {d.ubicacion}</p>
                                        </div>
                                    </div>
                                );
                            })}
                        </>
                    )}

                    {/* Mensaje vacío si no hay donaciones */}
                    {donaciones.length === 0 && (
                        <div style={s.sinDatos}>Aún no has publicado ninguna donación</div>
                    )}
                </div>
            </div>

            {/* BARRA DE NAVEGACIÓN inferior */}
            <Nav pestana={pestana} setPestana={setPestana} />
        </div>
    );
}


// ============================================================
// COMPONENTE: StatsInicio
// ------------------------------------------------------------
// Muestra 3 métricas del donante en forma de tarjetas:
//   - Total de donaciones (tarjeta grande)
//   - Donaciones activas (tarjeta pequeña)
//   - Solicitudes recibidas (tarjeta pequeña)
//
// Usa useIsMobile para cambiar el layout en pantallas pequeñas.
// ============================================================
function StatsInicio({ donacionesCount, donacionesActivas, solicitudesCount }) {
    const isMobile = useIsMobile();
    return (
        // En móvil: columna única. En escritorio: 2 columnas (1.2fr + 1fr)
        <div style={{ ...s.grid, gridTemplateColumns: isMobile ? '1fr' : '1.2fr 1fr' }}>
            {/* Tarjeta grande: total de donaciones */}
            <div style={s.cardGrande}>
                <div style={s.iconoGrande}>🍱</div>
                <h3 style={{ fontSize: '40px', color: '#00a344', marginBottom: '8px' }}>{donacionesCount}</h3>
                <p style={{ color: '#666', fontSize: '15px' }}>Donaciones realizadas</p>
            </div>

            {/* Columna derecha: dos tarjetas pequeñas apiladas */}
            <div style={s.lado}>
                <div style={s.cardPequena}>
                    <div style={{ ...s.icono, background: '#e3ffea' }}>🟢</div>
                    <div>
                        <h3 style={{ fontSize: '22px', color: '#222' }}>{donacionesActivas}</h3>
                        <p style={{ color: '#666', fontSize: '12px' }}>Activas</p>
                    </div>
                </div>
                <div style={s.cardPequena}>
                    <div style={{ ...s.icono, background: '#fff6d8' }}>📩</div>
                    <div>
                        <h3 style={{ fontSize: '22px', color: '#222' }}>{solicitudesCount}</h3>
                        <p style={{ color: '#666', fontSize: '12px' }}>Solicitudes</p>
                    </div>
                </div>
            </div>
        </div>
    );
}


// ============================================================
// COMPONENTE: Galeria
// ------------------------------------------------------------
// Carrusel de imágenes para una donación. Permite navegar
// entre fotos con botones anterior/siguiente y puntos de
// paginación clicables.
//
// Props:
//   imagenes → array de URLs de imágenes
//
// Estado interno:
//   idx → índice de la imagen actualmente visible
// ============================================================
function Galeria({ imagenes }) {
    const [idx, setIdx] = useState(0); // Índice de la imagen activa

    // Si no hay imágenes, no renderiza nada
    if (!imagenes || imagenes.length === 0) return null;

    // Navega a la imagen anterior (con loop al final)
    const prev = () => setIdx(i => (i - 1 + imagenes.length) % imagenes.length);
    // Navega a la imagen siguiente (con loop al inicio)
    const next = () => setIdx(i => (i + 1) % imagenes.length);

    return (
        <div style={{ position: 'relative', width: '100%', borderRadius: '20px 20px 0 0', overflow: 'hidden' }}>
            {/* Imagen activa */}
            <img src={imagenes[idx]} alt={`foto-${idx}`} style={s.donacionImg}
                onError={e => { e.target.style.display = 'none'; }} />

            {/* Controles solo si hay más de 1 imagen */}
            {imagenes.length > 1 && (
                <>
                    <button onClick={prev} style={{ ...galeriaBtn, left: '10px' }}>‹</button>
                    <button onClick={next} style={{ ...galeriaBtn, right: '10px' }}>›</button>

                    {/* Puntos de paginación: el activo es más ancho */}
                    <div style={{ position: 'absolute', bottom: '10px', left: '50%', transform: 'translateX(-50%)', display: 'flex', gap: '6px' }}>
                        {imagenes.map((_, i) => (
                            <div key={i} onClick={() => setIdx(i)} style={{
                                width: i === idx ? '18px' : '8px', height: '8px',
                                borderRadius: '99px',
                                background: i === idx ? 'white' : 'rgba(255,255,255,0.55)',
                                cursor: 'pointer', transition: '0.2s'
                            }} />
                        ))}
                    </div>
                </>
            )}
        </div>
    );
}

// Estilos compartidos de los botones de la galería (prev/next)
const galeriaBtn = {
    position: 'absolute', top: '50%', transform: 'translateY(-50%)',
    background: 'rgba(0,0,0,0.45)', color: 'white', border: 'none',
    borderRadius: '50%', width: '36px', height: '36px', fontSize: '22px',
    cursor: 'pointer', display: 'flex', alignItems: 'center',
    justifyContent: 'center', zIndex: 2, lineHeight: 1,
};


// ============================================================
// COMPONENTE: MisDonaciones
// ------------------------------------------------------------
// Lista todas las donaciones del donante. Por cada una muestra
// la galería de imágenes, estado, fecha, ubicación y descripción.
// Si la donación no está entregada ni cancelada, muestra botones
// de "Editar" y "Eliminar".
// Incluye el modal de edición al activarse.
//
// Props recibidas desde DashboardDonante (ver arriba)
// ============================================================
function MisDonaciones({
    donaciones, onVolver, setPestana, onEliminar, onEditar,
    getEstado, editando, donacionEdit, setDonacionEdit,
    setEditando, guardarEdicion
}) {
    return (
        <div style={s.page}>
            {/* Header con botón volver */}
            <div style={s.overlayHeader}>
                <div style={s.headerCircle}></div>
                <button style={s.volverBtn} onClick={onVolver}>←</button>
                <div style={{ position: 'relative', zIndex: 2 }}>
                    <h1 style={s.titulo}>Mis donaciones</h1>
                    <p style={s.subtitulo}>Consulta las comidas que has compartido</p>
                </div>
            </div>

            <div style={s.overlayContent}>
                <h2 style={{ fontSize: '22px', color: '#222', marginBottom: '16px' }}>Donaciones recientes</h2>

                {/* Estado vacío */}
                {donaciones.length === 0 ? (
                    <div style={s.extraBox}>
                        <div style={{ fontSize: '48px' }}>🍣</div>
                        <h3 style={{ marginTop: '14px', fontSize: '22px', color: '#222' }}>¿Deseas compartir más comida?</h3>
                        <p style={{ marginTop: '10px', color: '#666', lineHeight: 1.6, fontSize: '14px' }}>
                            Cada donación puede ayudar muchísimo a personas que necesitan apoyo alimenticio.
                        </p>
                        <Link to="/donaciones" style={{ textDecoration: 'none' }}>
                            <button style={s.botonPrincipal}>Crear nueva donación</button>
                        </Link>
                    </div>
                ) : (
                    <>
                        {/* Lista de tarjetas de donación */}
                        {donaciones.map(d => {
                            const est = getEstado(d.estado);
                            // Compatibilidad con diferentes estructuras de imagen en Firestore
                            const imagenes = d.imagenes?.length
                                ? d.imagenes
                                : (d.imagen || d.fotoUrl ? [d.imagen || d.fotoUrl] : []);
                            return (
                                <div key={d.id} style={s.donacionCard}>
                                    {/* Carrusel de imágenes */}
                                    <Galeria imagenes={imagenes} />
                                    <div style={{ padding: '22px' }}>
                                        <div style={s.topCard}>
                                            <h3 style={{ fontSize: '22px', color: '#222' }}>{d.titulo || d.nombre}</h3>
                                            <span style={{ ...s.estadoBadge, background: est.bg, color: est.color }}>{est.label}</span>
                                        </div>
                                        <p style={{ color: '#777', fontSize: '13px', marginBottom: '6px' }}>{d.fecha || '—'}</p>
                                        <p style={{ color: '#555', fontSize: '13px', marginBottom: '8px' }}>📍 {d.ubicacion}</p>
                                        {d.descripcion && <p style={{ fontSize: '13px', color: '#666', lineHeight: 1.5 }}>{d.descripcion}</p>}

                                        {/* Acciones: Editar/Eliminar solo si la donación está activa */}
                                        {d.estado !== 'entregado' && d.estado !== 'cancelado' ? (
                                            <div style={{ display: 'flex', gap: '12px', marginTop: '16px' }}>
                                                <button
                                                    style={{ flex: 1, padding: '13px 22px', border: 'none', borderRadius: '16px', background: 'linear-gradient(to right,#005a28,#00c853)', color: 'white', fontSize: '14px', fontWeight: 'bold', cursor: 'pointer' }}
                                                    onClick={() => onEditar(d)}
                                                >Editar</button>
                                                <button
                                                    style={{ flex: 1, padding: '13px 22px', border: 'none', borderRadius: '16px', background: 'linear-gradient(to right,#a00000,#ff3b3b)', color: 'white', fontSize: '14px', fontWeight: 'bold', cursor: 'pointer' }}
                                                    onClick={() => onEliminar(d.id)}
                                                >Eliminar</button>
                                            </div>
                                        ) : (
                                            // Etiqueta de estado final (entregado o cancelado)
                                            <div style={{
                                                marginTop: '16px', padding: '14px', borderRadius: '16px',
                                                background: d.estado === 'entregado' ? '#e3ffea' : '#fff0f0',
                                                textAlign: 'center',
                                                color: d.estado === 'entregado' ? '#0c8a46' : '#d93030',
                                                fontWeight: 'bold', fontSize: '14px'
                                            }}>
                                                {d.estado === 'entregado' ? '✅ Donación entregada exitosamente' : '❌ Donación cancelada'}
                                            </div>
                                        )}
                                    </div>
                                </div>
                            );
                        })}

                        {/* Invitación a crear más donaciones al final de la lista */}
                        <div style={s.extraBox}>
                            <div style={{ fontSize: '48px' }}>🍣</div>
                            <h3 style={{ marginTop: '14px', fontSize: '22px', color: '#222' }}>¿Deseas compartir más comida?</h3>
                            <p style={{ marginTop: '10px', color: '#666', lineHeight: 1.6, fontSize: '14px' }}>
                                Cada donación puede ayudar muchísimo.
                            </p>
                            <Link to="/donaciones" style={{ textDecoration: 'none' }}>
                                <button style={s.botonPrincipal}>Crear nueva donación</button>
                            </Link>
                        </div>
                    </>
                )}
            </div>

            <Nav pestana="mis-donaciones" setPestana={setPestana} />

            {/* MODAL DE EDICIÓN: visible solo cuando editando === true */}
            {editando && donacionEdit && (
                <div style={s.modalOverlay}>
                    <div style={s.modal}>
                        <div style={s.modalHeader}>
                            <button style={s.volverBtnModal} onClick={() => { setEditando(false); setDonacionEdit(null); }}>←</button>
                            <h1 style={{ ...s.titulo, fontSize: '22px' }}>Editar Donación</h1>
                        </div>
                        <div style={s.modalBody}>
                            {/* Campos editables — cada onChange actualiza solo el campo en donacionEdit */}
                            <label style={s.label}>Título *</label>
                            <input style={s.inputField} value={donacionEdit.titulo || ''}
                                onChange={e => setDonacionEdit({ ...donacionEdit, titulo: e.target.value })} />

                            <label style={s.label}>Descripción</label>
                            <textarea style={s.textarea} value={donacionEdit.descripcion || ''}
                                onChange={e => setDonacionEdit({ ...donacionEdit, descripcion: e.target.value })} />

                            <label style={s.label}>Cantidad aproximada</label>
                            <input style={s.inputField} value={donacionEdit.cantidad || ''}
                                onChange={e => setDonacionEdit({ ...donacionEdit, cantidad: e.target.value })} />

                            <label style={s.label}>Ubicación *</label>
                            <input style={s.inputField} value={donacionEdit.ubicacion || ''}
                                onChange={e => setDonacionEdit({ ...donacionEdit, ubicacion: e.target.value })} />

                            <label style={s.label}>Disponible hasta</label>
                            <input style={s.inputField} value={donacionEdit.disponibleHasta || ''}
                                onChange={e => setDonacionEdit({ ...donacionEdit, disponibleHasta: e.target.value })} />
                        </div>
                        <div style={s.modalFooter}>
                            <button style={s.btnCancelar} onClick={() => { setEditando(false); setDonacionEdit(null); }}>Cancelar</button>
                            <button style={s.btnGuardar} onClick={guardarEdicion}>Guardar Cambios</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}


// ============================================================
// COMPONENTE: SolicitudesRecibidas
// ------------------------------------------------------------
// Muestra en dos secciones:
//   1. "En camino" → pedidos ya asignados a un repartidor,
//      con opción de rastreo en tiempo real.
//   2. "Pendientes" → solicitudes esperando respuesta del donante,
//      con botones de Aceptar / Rechazar.
//
// Props:
//   solicitudes     → pedidos con estado 'pendiente'
//   pedidosEnCamino → pedidos con repartidor asignado
//   showToast       → función para mostrar notificaciones
//   showConfirm     → función para mostrar modal de confirmación
// ============================================================
function SolicitudesRecibidas({
    solicitudes, pedidosEnCamino, onVolver, setPestana,
    navigate, showToast, showConfirm
}) {

    // ──────────────────────────────────────────────────────
    // FUNCIÓN: aceptarSolicitud
    // Cambia el estado del pedido según el modo de entrega:
    //   - 'delivery' → 'asignado' (esperará un repartidor)
    //   - cualquier otro → 'reservado' (recogida personal)
    // También marca la donación relacionada como 'en_proceso'.
    // ──────────────────────────────────────────────────────
    const aceptarSolicitud = async (pedido) => {
        if (pedido.modo === 'delivery') {
            await updateDoc(doc(db, 'pedidos', pedido.id), {
                estado: 'asignado',
                repartidorId: null,       // Se asignará cuando un repartidor lo tome
                fecha_aprobacion: new Date()
            });
        } else {
            await updateDoc(doc(db, 'pedidos', pedido.id), {
                estado: 'reservado',
                fecha_aprobacion: new Date()
            });
        }
        // Bloquea la donación para que no reciba más solicitudes
        if (pedido.donacionId) {
            await updateDoc(doc(db, 'donaciones', pedido.donacionId), { estado: 'en_proceso' });
        }
        showToast('Solicitud aceptada correctamente.', 'success');
    };

    // ──────────────────────────────────────────────────────
    // FUNCIÓN: rechazar
    // Pide confirmación y luego cambia el estado del pedido
    // a 'cancelado', registrando la fecha de rechazo.
    // ──────────────────────────────────────────────────────
    const rechazar = async (pedidoId) => {
        showConfirm('¿Seguro que deseas rechazar esta solicitud?', async () => {
            await updateDoc(doc(db, 'pedidos', pedidoId), {
                estado: 'cancelado',
                fecha_rechazo: new Date()
            });
            showToast('Solicitud rechazada.', 'success');
        });
    };

    // ──────────────────────────────────────────────────────
    // FUNCIÓN: formatFecha
    // Convierte un Timestamp de Firestore (o fecha JS) a una
    // cadena legible en español salvadoreño.
    // ──────────────────────────────────────────────────────
    const formatFecha = (ts) => {
        if (!ts) return '';
        // ts.toDate() → si es Timestamp de Firestore
        // new Date(ts) → si ya es un Date o string
        const d = ts.toDate ? ts.toDate() : new Date(ts);
        return d.toLocaleDateString('es-SV', { day: '2-digit', month: 'long', hour: '2-digit', minute: '2-digit' });
    };

    return (
        <div style={s.page}>
            <div style={s.overlayHeader}>
                <div style={s.headerCircle}></div>
                <button style={s.volverBtn} onClick={onVolver}>←</button>
                <div style={{ position: 'relative', zIndex: 2 }}>
                    <h1 style={s.titulo}>Solicitudes recibidas</h1>
                    <p style={s.subtitulo}>Personas que quieren tu donación</p>
                </div>
            </div>

            <div style={s.overlayContent}>
                {/* SECCIÓN: Pedidos en camino */}
                {pedidosEnCamino.length > 0 && (
                    <>
                        <h2 style={{ fontSize: '18px', color: '#222', marginBottom: '12px' }}>En camino</h2>
                        {pedidosEnCamino.map(p => (
                            <div key={p.id} style={s.card}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '16px' }}>
                                    <div>
                                        <strong style={{ fontSize: '18px', color: '#222', display: 'block', marginBottom: '4px' }}>{p.titulo}</strong>
                                        <p style={{ fontSize: '14px', color: '#666', margin: 0 }}>Para: <strong>{p.nombreCliente}</strong></p>
                                    </div>
                                    <span style={{ background: '#e3f0ff', color: '#0050b3', padding: '6px 13px', borderRadius: '14px', fontSize: '11px', fontWeight: 'bold', whiteSpace: 'nowrap', flexShrink: 0 }}>🛵 En camino</span>
                                </div>

                                {/* Visualización de ruta: punto verde (origen) → punto rojo (destino) */}
                                <div style={{ ...s.infoBox, marginBottom: '12px' }}>
                                    <span style={s.infoLabel}>Ruta</span>
                                    <div style={{ marginTop: '8px' }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                            <div style={{ width: '12px', height: '12px', borderRadius: '50%', background: '#00b85c', flexShrink: 0 }}></div>
                                            <span style={{ fontSize: '13px', color: '#555' }}>{p.restaurante || '—'}</span>
                                        </div>
                                        {/* Línea vertical conectora */}
                                        <div style={{ width: '3px', height: '20px', background: '#d0d0d0', marginLeft: '4px', marginTop: '3px', marginBottom: '3px', borderRadius: '20px' }}></div>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                            <div style={{ width: '12px', height: '12px', borderRadius: '50%', background: '#ff4d4d', flexShrink: 0 }}></div>
                                            <span style={{ fontSize: '13px', color: '#555' }}>{p.direccionEntrega}</span>
                                        </div>
                                    </div>
                                </div>

                                {/* Navega a la pantalla de rastreo pasando los IDs necesarios */}
                                <button
                                    style={{ width: '100%', padding: '13px', border: 'none', borderRadius: '16px', background: 'linear-gradient(to right,#005a28,#00c853)', color: 'white', fontSize: '14px', fontWeight: 'bold', cursor: 'pointer' }}
                                    onClick={() => navigate('/rastreo', { state: { pedidoId: p.id, repartidorId: p.repartidorId } })}
                                >Rastrear</button>
                            </div>
                        ))}
                        {solicitudes.length > 0 && (
                            <h2 style={{ fontSize: '18px', color: '#222', marginBottom: '12px', marginTop: '20px' }}>Pendientes</h2>
                        )}
                    </>
                )}

                {/* Estado vacío: sin solicitudes ni pedidos */}
                {solicitudes.length === 0 && pedidosEnCamino.length === 0 ? (
                    <div style={s.sinDatos}>
                        <div style={{ fontSize: '52px', marginBottom: '16px' }}>🔔</div>
                        No tienes solicitudes pendientes
                    </div>
                ) : solicitudes.map(p => (
                    // TARJETA DE SOLICITUD PENDIENTE
                    <div key={p.id} style={{ background: 'white', borderRadius: '26px', padding: '22px', boxShadow: '0 10px 25px rgba(0,0,0,0.08)', marginBottom: '18px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '14px' }}>
                            <div>
                                <strong style={{ fontSize: '18px', color: '#222', display: 'block', marginBottom: '4px' }}>{p.titulo}</strong>
                                <p style={{ fontSize: '13px', color: '#666', margin: 0 }}>De: <strong>{p.nombreCliente}</strong></p>
                            </div>
                            <span style={{ background: '#fff3d9', color: '#d38a00', padding: '6px 13px', borderRadius: '14px', fontSize: '11px', fontWeight: 'bold', whiteSpace: 'nowrap', flexShrink: 0 }}>⏳ Pendiente</span>
                        </div>

                        {/* Info rápida: fecha y modo de entrega */}
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '14px' }}>
                            <div style={s.infoBox}>
                                <span style={s.infoLabel}>Fecha</span>
                                <strong style={{ fontSize: '14px', color: '#222' }}>{formatFecha(p.fecha_creacion)}</strong>
                            </div>
                            <div style={s.infoBox}>
                                <span style={s.infoLabel}>Método de entrega</span>
                                <strong style={{ fontSize: '14px', color: '#222' }}>
                                    {p.modo === 'delivery' ? '🛵 Moto' : '🙋 Recogida personal'}
                                </strong>
                            </div>
                        </div>

                        {/* Detalle visual tipo "ruta" */}
                        <div>
                            <div style={{ background: '#f7f7f7', borderRadius: '18px', padding: '16px', marginBottom: '14px' }}>
                                <span style={{ display: 'block', fontSize: '12px', color: '#777', marginBottom: '10px' }}>Detalle de la solicitud</span>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                    <div style={{ width: '12px', height: '12px', borderRadius: '50%', background: '#00b85c', flexShrink: 0 }}></div>
                                    <div>
                                        <span style={{ fontSize: '11px', color: '#888' }}>Donación</span>
                                        <strong style={{ display: 'block', fontSize: '14px', color: '#222' }}>{p.titulo}</strong>
                                    </div>
                                </div>
                                <div style={{ width: '3px', height: '20px', background: '#d0d0d0', marginLeft: '4px', marginTop: '3px', marginBottom: '3px', borderRadius: '20px' }}></div>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                    <div style={{ width: '12px', height: '12px', borderRadius: '50%', background: '#ff4d4d', flexShrink: 0 }}></div>
                                    <div>
                                        <span style={{ fontSize: '11px', color: '#888' }}>
                                            {p.modo === 'delivery' ? 'Entregar en' : 'Recogida personal'}
                                        </span>
                                        <strong style={{ display: 'block', fontSize: '14px', color: '#222' }}>
                                            {p.modo === 'delivery' ? (p.direccionEntrega || '—') : '🙋 El receptor recogerá la donación'}
                                        </strong>
                                    </div>
                                </div>
                            </div>

                            {/* Motivo de la solicitud (opcional) */}
                            {p.motivo && (
                                <div style={{ background: '#f5f5f5', borderRadius: '18px', padding: '14px', marginBottom: '16px' }}>
                                    <span style={s.infoLabel}>Motivo de la solicitud</span>
                                    <p style={{ fontSize: '14px', color: '#444', lineHeight: 1.6, marginTop: '6px', margin: 0 }}>"{p.motivo}"</p>
                                </div>
                            )}

                            {/* Botones de acción */}
                            <div style={{ display: 'flex', gap: '12px' }}>
                                <button
                                    style={{ flex: 1, padding: '13px 22px', border: 'none', borderRadius: '16px', background: 'linear-gradient(to right,#005a28,#00c853)', color: 'white', fontSize: '14px', fontWeight: 'bold', cursor: 'pointer' }}
                                    onClick={() => aceptarSolicitud(p)}
                                >Aceptar</button>
                                <button
                                    style={{ flex: 1, padding: '13px 22px', border: 'none', borderRadius: '16px', background: 'linear-gradient(to right,#a00000,#ff3b3b)', color: 'white', fontSize: '14px', fontWeight: 'bold', cursor: 'pointer' }}
                                    onClick={() => rechazar(p.id)}
                                >Rechazar</button>
                            </div>
                        </div>
                    </div>
                ))}
            </div>
            <Nav pestana="solicitudes" setPestana={setPestana} />
        </div>
    );
}


// ============================================================
// COMPONENTE: PerfilDonante
// ------------------------------------------------------------
// Muestra el perfil del donante con sus estadísticas y datos
// personales. Puede entrar en modo edición para actualizar
// los datos directamente en Firestore.
// También contiene el botón de "Cerrar sesión".
//
// Todos los estados de edición se manejan en el padre
// (DashboardDonante) para no perderlos al cambiar de pestaña.
// ============================================================
function PerfilDonante({
    userData, donacionesCount, donacionesActivas, onVolver, setPestana,
    editandoPerfil, setEditandoPerfil, nuevoNombre, setNuevoNombre,
    nuevoTelefono, setNuevoTelefono, nuevaDireccion, setNuevaDireccion,
    nuevoCorreo, setNuevoCorreo, activarEdicion, guardarCambiosPerfil, cerrarSesion
}) {
    return (
        <div style={s.page}>
            {/* Header centrado con foto de perfil */}
            <div style={{ ...s.overlayHeader, textAlign: 'center' }}>
                <div style={s.headerCircle}></div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', position: 'relative', zIndex: 2 }}>
                    <button style={s.volverBtn} onClick={onVolver}>←</button>
                    <img src="https://cdn-icons-png.flaticon.com/512/149/149071.png" alt="foto"
                        style={{ ...s.foto, width: '90px', height: '90px' }} />
                    <div style={{ width: '44px' }}></div> {/* Espaciador para centrar la foto */}
                </div>
                <div style={{ position: 'relative', zIndex: 2 }}>
                    <h1 style={{ ...s.titulo, marginTop: '10px' }}>{userData?.nombre}</h1>
                    <p style={s.subtitulo}>Donante activo en la comunidad solidaria</p>
                </div>
            </div>

            <div style={s.overlayContent}>
                {/* Estadísticas del perfil */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px', marginBottom: '20px' }}>
                    <div style={{ background: 'white', borderRadius: '20px', padding: '20px', textAlign: 'center', boxShadow: '0 6px 18px rgba(0,0,0,0.06)' }}>
                        <div style={{ fontSize: '26px', marginBottom: '8px' }}>🍱</div>
                        <h2 style={{ fontSize: '26px', color: '#222', marginBottom: '6px' }}>{donacionesCount}</h2>
                        <p style={{ fontSize: '12px', color: '#666' }}>Donaciones realizadas</p>
                    </div>
                    <div style={{ background: 'white', borderRadius: '20px', padding: '20px', textAlign: 'center', boxShadow: '0 6px 18px rgba(0,0,0,0.06)' }}>
                        <div style={{ fontSize: '26px', marginBottom: '8px' }}>🟢</div>
                        <h2 style={{ fontSize: '26px', color: '#222', marginBottom: '6px' }}>{donacionesActivas}</h2>
                        <p style={{ fontSize: '12px', color: '#666' }}>Donaciones activas</p>
                    </div>
                </div>

                <div style={s.card}>
                    <h3 style={s.cardTitulo}>Información personal</h3>

                    {/* Vista de edición vs. vista de solo lectura */}
                    {editandoPerfil ? (
                        <div>
                            {/* Formulario de edición */}
                            <label style={s.label}>Nombre Completo</label>
                            <input style={s.inputField} type="text" value={nuevoNombre} onChange={e => setNuevoNombre(e.target.value)} />

                            <label style={s.label}>Correo Electrónico</label>
                            <input style={s.inputField} type="email" value={nuevoCorreo} onChange={e => setNuevoCorreo(e.target.value)} />

                            <label style={s.label}>Teléfono</label>
                            <input style={s.inputField} type="text" value={nuevoTelefono} onChange={e => setNuevoTelefono(e.target.value)} />

                            <label style={s.label}>Dirección</label>
                            <input style={s.inputField} type="text" value={nuevaDireccion} onChange={e => setNuevaDireccion(e.target.value)} />

                            <div style={{ display: 'flex', gap: '12px', marginTop: '24px' }}>
                                <button style={{ ...s.btnCancelar, flex: 1 }} onClick={() => setEditandoPerfil(false)}>Cancelar</button>
                                <button style={{ ...s.btnGuardar, flex: 1 }} onClick={guardarCambiosPerfil}>Guardar Cambios</button>
                            </div>
                        </div>
                    ) : (
                        <>
                            {/* Vista de solo lectura: grid de datos del perfil */}
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
                                {[
                                    { label: 'Correo electrónico', val: userData?.correo || '—' },
                                    { label: 'Teléfono',           val: userData?.telefono || '—' },
                                    { label: 'Dirección',          val: userData?.direccion || '—' },
                                    {
                                        label: 'Miembro desde',
                                        // Convierte Timestamp de Firestore a fecha legible
                                        val: userData?.fecha_registro?.toDate
                                            ? userData.fecha_registro.toDate().toLocaleDateString('es-SV', { month: 'long', year: 'numeric' })
                                            : '—'
                                    },
                                ].map((item, i) => (
                                    <div key={i} style={s.infoBox}>
                                        <span style={s.infoLabel}>{item.label}</span>
                                        <strong style={{ fontSize: '14px', color: '#222' }}>{item.val}</strong>
                                    </div>
                                ))}
                            </div>

                            {/* Botón que activa el modo edición */}
                            <button style={{ ...s.botonPrincipal, width: '100%', marginTop: '20px', padding: '15px' }} onClick={activarEdicion}>
                                📝 Editar perfil
                            </button>
                        </>
                    )}

                    <br /><br />
                    {/* Botón de cerrar sesión con estilo de "acción peligrosa" */}
                    <div style={s.accion} onClick={cerrarSesion}>
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


// ============================================================
// COMPONENTE: Nav (Barra de navegación inferior)
// ------------------------------------------------------------
// Barra fija en la parte inferior que permite cambiar entre
// las 4 secciones del dashboard. La pestaña activa se resalta
// en verde y con negrita.
//
// Props:
//   pestana    → key de la sección activa
//   setPestana → función para cambiar de sección
// ============================================================
function Nav({ pestana, setPestana }) {
    return (
        <div style={s.nav}>
            {[
                { key: 'inicio',          icon: '🏠', label: 'Inicio' },
                { key: 'solicitudes',     icon: '🔔', label: 'Solicitudes' },
                { key: 'mis-donaciones',  icon: '🍱', label: 'Mis donaciones' },
                { key: 'perfil',          icon: '👤', label: 'Perfil' },
            ].map(item => (
                <div key={item.key} style={{
                    ...s.navItem,
                    // Color verde y negrita en la pestaña activa
                    color:      pestana === item.key ? '#016d3b' : '#888',
                    fontWeight: pestana === item.key ? 'bold' : 'normal',
                }} onClick={() => setPestana(item.key)}>
                    <span style={s.navIcon}>{item.icon}</span>
                    {item.label}
                </div>
            ))}
        </div>
    );
}


// ============================================================
// ESTILOS (objeto `s`)
// ------------------------------------------------------------
// Todos los estilos inline están centralizados aquí para
// facilitar el mantenimiento. Se usan como style={s.clave}.
//
// ORGANIZACIÓN POR SECCIONES:
// ──────────────────────────────────────────────────────────
// LAYOUT GENERAL
//   page          → contenedor raíz de toda la app (fondo degradado, columna centrada)
//   loading       → pantalla de carga centrada verticalmente
//   dashboard     → ancho máximo del contenido en pantalla inicio
//   contenido     → área de contenido debajo del header en inicio
//
// HEADER / OVERLAY HEADER
//   header        → header verde de la pantalla inicio (con foto de perfil)
//   overlayHeader → header verde usado en sub-vistas (mis donaciones, perfil, etc.)
//   headerCircle  → círculo decorativo semitransparente en la esquina del header
//   headerContent → fila flex del header: texto a la izquierda, foto a la derecha
//   titulo        → h1 blanco en el header
//   subtitulo     → párrafo aclaratorio debajo del título (blanco suave)
//   foto          → imagen de perfil redonda con borde blanco
//   overlayContent→ área de contenido debajo del overlayHeader
//   volverBtn     → botón "←" flotante en el header de sub-vistas
//
// CARDS
//   cardPrincipal → card grande de "Alimenta el cambio" con ícono lateral
//   iconoPrincipal→ cuadro verde claro con emoji (dentro de cardPrincipal)
//   cardH2        → título dentro de cardPrincipal
//   cardP         → descripción dentro de cardPrincipal
//   card          → tarjeta blanca genérica (solicitudes, perfil, etc.)
//   cardGrande    → tarjeta grande centrada del resumen de impacto
//   iconoGrande   → ícono cuadrado grande (dentro de cardGrande)
//   cardPequena   → tarjeta pequeña con ícono lateral (stats)
//   icono         → cuadro de ícono pequeño con fondo de color
//   cardTitulo    → h3 de título en una card genérica
//
// DONACIONES
//   donacionCard  → tarjeta completa con imagen + datos de donación
//   donacionImg   → imagen de cabecera de la tarjeta de donación
//   topCard       → fila flex título + badge de estado
//   estadoBadge   → pill/badge de estado coloreado según getEstado()
//   extraBox      → caja de invitación a crear más donaciones
//
// ALERTAS
//   alertaSolicitudes → banner amarillo de solicitudes pendientes
//                        (se extiende con spread para el banner azul de pedidos)
//
// INFORMACIÓN
//   infoBox       → caja gris redondeada para mostrar un dato
//   infoLabel     → etiqueta pequeña gris encima del valor
//
// GRID DE STATS
//   grid          → contenedor CSS Grid del resumen de impacto
//   lado          → columna derecha con 2 tarjetas pequeñas apiladas
//
// FORMULARIOS
//   label         → etiqueta de campo de formulario
//   inputField    → input de texto estilizado (fondo gris, sin borde)
//   textarea      → área de texto estilizada (altura fija, sin resize)
//
// MODAL DE EDICIÓN
//   modalOverlay  → fondo oscuro semitransparente que cubre toda la pantalla
//   modal         → contenedor blanco de la modal
//   modalHeader   → franja verde superior de la modal
//   volverBtnModal→ botón "←" dentro del header de la modal
//   modalBody     → cuerpo scrollable de la modal
//   modalFooter   → fila de botones al pie de la modal
//   btnGuardar    → botón primario verde
//   btnCancelar   → botón secundario gris
//
// ACCIONES
//   botonPrincipal→ botón verde principal (gradiente)
//   accion        → fila tipo "lista" clicable (ej. cerrar sesión)
//
// MENSAJES VACÍOS
//   sinDatos      → texto centrado cuando no hay contenido que mostrar
//
// NAVEGACIÓN
//   nav           → barra fija inferior con efecto glassmorphism
//   navItem       → ítem individual del nav (ícono + texto)
//   navIcon       → ícono emoji en el nav (bloque centrado)
// ============================================================
const s = {
    // LAYOUT GENERAL
    page:             { minHeight: '100vh', background: 'linear-gradient(135deg,#eef2f7,#dfe7f3)', display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '18px', paddingBottom: '120px', fontFamily: 'Arial, Helvetica, sans-serif', boxSizing: 'border-box' },
    loading:          { display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', fontSize: '18px', color: '#00a344' },
    dashboard:        { width: '100%', maxWidth: '1100px' },
    contenido:        { marginTop: '22px', width: '100%', maxWidth: '1100px' },

    // HEADER / OVERLAY HEADER
    header:           { background: 'linear-gradient(135deg,#006d2f,#00a344)', borderRadius: '24px', padding: '28px', color: 'white', position: 'relative', overflow: 'hidden', boxShadow: '0 15px 35px rgba(0,0,0,0.12)' },
    overlayHeader:    { width: '100%', maxWidth: '1070px', boxSizing: 'border-box', background: 'linear-gradient(135deg,#006d2f,#00a344)', color: 'white', padding: '24px', borderRadius: '28px', marginBottom: '20px', position: 'relative', overflow: 'hidden', boxShadow: '0 15px 35px rgba(0,0,0,0.12)' },
    headerCircle:     { position: 'absolute', width: '200px', height: '200px', borderRadius: '50%', background: 'rgba(255,255,255,0.05)', top: '-80px', right: '-50px' }, // Decoración: círculo semitransparente fuera de borde
    headerContent:    { display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '18px', position: 'relative', zIndex: 2 },
    titulo:           { fontSize: '28px', fontWeight: 800, margin: 0, color: 'white' },
    subtitulo:        { marginTop: '6px', color: '#dcffe9', fontSize: '14px' },
    foto:             { width: '88px', height: '88px', borderRadius: '50%', objectFit: 'cover', border: '4px solid white', boxShadow: '0 8px 20px rgba(0,0,0,0.25)' },
    overlayContent:   { width: '100%', maxWidth: '1100px', padding: '0 18px', boxSizing: 'border-box' },
    volverBtn:        { width: '44px', height: '44px', border: 'none', borderRadius: '14px', background: 'rgba(255,255,255,0.15)', color: 'white', fontSize: '20px', cursor: 'pointer', marginBottom: '16px', display: 'block', position: 'relative', zIndex: 2 },

    // CARDS
    cardPrincipal:    { background: 'white', borderRadius: '28px', padding: '24px', display: 'flex', alignItems: 'center', gap: '22px', boxShadow: '0 8px 25px rgba(0,0,0,0.08)' },
    iconoPrincipal:   { width: '90px', height: '90px', borderRadius: '24px', background: '#dfffe9', display: 'flex', justifyContent: 'center', alignItems: 'center', fontSize: '42px', flexShrink: 0 },
    cardH2:           { fontSize: '24px', color: '#222', marginBottom: '8px' },
    cardP:            { color: '#666', lineHeight: 1.6, fontSize: '14px' },
    card:             { background: 'white', borderRadius: '24px', padding: '22px', boxShadow: '0 8px 25px rgba(0,0,0,0.08)', marginBottom: '20px' },
    cardGrande:       { background: 'white', borderRadius: '26px', padding: '24px', textAlign: 'center', boxShadow: '0 8px 25px rgba(0,0,0,0.08)' },
    iconoGrande:      { width: '85px', height: '85px', borderRadius: '24px', background: '#dfffe9', display: 'flex', justifyContent: 'center', alignItems: 'center', fontSize: '42px', margin: 'auto', marginBottom: '16px' },
    cardPequena:      { background: 'white', borderRadius: '24px', padding: '18px', display: 'flex', alignItems: 'center', gap: '12px', boxShadow: '0 8px 25px rgba(0,0,0,0.08)' },
    icono:            { width: '55px', height: '55px', borderRadius: '18px', display: 'flex', justifyContent: 'center', alignItems: 'center', fontSize: '25px', flexShrink: 0 },
    cardTitulo:       { fontSize: '20px', marginBottom: '16px', color: '#222' },

    // DONACIONES
    donacionCard:     { background: 'white', borderRadius: '26px', overflow: 'hidden', boxShadow: '0 10px 25px rgba(0,0,0,0.08)', marginBottom: '18px' },
    donacionImg:      { width: '100%', height: '160px', objectFit: 'cover' }, // Imagen que ocupa todo el ancho de la card
    topCard:          { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '10px', marginBottom: '12px' },
    estadoBadge:      { display: 'inline-block', background: '#dfffe9', color: '#00853a', padding: '6px 12px', borderRadius: '16px', fontSize: '11px', fontWeight: 'bold', whiteSpace: 'nowrap' },
    extraBox:         { marginTop: '10px', background: '#f7f9fb', borderRadius: '24px', padding: '24px', textAlign: 'center', border: '1px solid #ededed', marginBottom: '18px' },

    // ALERTAS
    alertaSolicitudes:{ background: '#fff8e8', border: '1px solid #ffe0a0', borderRadius: '20px', padding: '16px 18px', display: 'flex', alignItems: 'center', gap: '14px', marginBottom: '16px', cursor: 'pointer', boxShadow: '0 4px 14px rgba(255,180,0,0.12)' },

    // INFORMACIÓN
    infoBox:          { background: '#f5f5f5', padding: '16px', borderRadius: '18px' },
    infoLabel:        { display: 'block', fontSize: '12px', color: '#777', marginBottom: '6px' },

    // GRID DE STATS
    grid:             { display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: '18px' },
    lado:             { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px' }, // Solo en escritorio; en móvil queda en columna

    // FORMULARIOS
    label:            { display: 'block', marginTop: '16px', marginBottom: '8px', fontWeight: 'bold', color: '#333', fontSize: '14px' },
    inputField:       { width: '100%', padding: '15px', border: 'none', borderRadius: '18px', background: '#f5f5f5', fontSize: '15px', outline: 'none', boxSizing: 'border-box', marginBottom: '4px' },
    textarea:         { width: '100%', padding: '15px', border: 'none', borderRadius: '18px', background: '#f5f5f5', fontSize: '15px', outline: 'none', height: '120px', resize: 'none', boxSizing: 'border-box' },

    // MODAL DE EDICIÓN
    modalOverlay:     { position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.7)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 1000 },
    modal:            { background: 'white', width: '92%', maxWidth: '430px', borderRadius: '28px', overflow: 'hidden' },
    modalHeader:      { background: 'linear-gradient(135deg,#006d2f,#00a344)', padding: '24px', color: 'white', display: 'flex', alignItems: 'center', gap: '14px' },
    volverBtnModal:   { width: '44px', height: '44px', border: 'none', borderRadius: '14px', background: 'rgba(255,255,255,0.15)', color: 'white', fontSize: '20px', cursor: 'pointer', flexShrink: 0 },
    modalBody:        { padding: '20px', maxHeight: '60vh', overflowY: 'auto' }, // Scroll si el contenido del formulario es largo
    modalFooter:      { padding: '20px', display: 'flex', gap: '12px' },
    btnGuardar:       { flex: 1, padding: '16px', background: 'linear-gradient(to right,#006d2f,#00a344)', color: 'white', border: 'none', borderRadius: '16px', fontWeight: 'bold', cursor: 'pointer', fontSize: '15px' },
    btnCancelar:      { flex: 1, padding: '16px', background: '#f0f0f0', color: '#555', border: 'none', borderRadius: '16px', fontWeight: 'bold', cursor: 'pointer', fontSize: '15px' },

    // ACCIONES
    botonPrincipal:   { marginTop: '16px', padding: '13px 22px', border: 'none', borderRadius: '16px', background: 'linear-gradient(to right,#006d2f,#00a344)', color: 'white', fontSize: '14px', fontWeight: 'bold', cursor: 'pointer' },
    accion:           { display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#f5f5f5', padding: '16px', borderRadius: '18px', cursor: 'pointer', marginBottom: '12px' },

    // MENSAJES VACÍOS
    sinDatos:         { textAlign: 'center', padding: '40px', color: '#777', fontSize: '16px' },

    // NAVEGACIÓN INFERIOR
    nav:              { position: 'fixed', bottom: '20px', left: '50%', transform: 'translateX(-50%)', width: '92%', maxWidth: '760px', background: 'rgba(255,255,255,0.92)', backdropFilter: 'blur(14px)', borderRadius: '22px', padding: '14px 18px', display: 'flex', justifyContent: 'space-around', alignItems: 'center', boxShadow: '0 10px 30px rgba(0,0,0,0.12)', border: '1px solid rgba(255,255,255,0.5)', zIndex: 999 },
    navItem:          { textAlign: 'center', fontSize: '12px', cursor: 'pointer', transition: '0.2s' },
    navIcon:          { display: 'block', fontSize: '24px', marginBottom: '4px' },
};

export default DashboardDonante;