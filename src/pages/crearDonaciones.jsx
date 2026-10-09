import { useState } from 'react';
import { Toast } from '../components/Toast';
import { useToast } from '../components/useToast';
import { db, auth } from '../firebase/conifg';
import { collection, addDoc } from "firebase/firestore";
import { useNavigate } from 'react-router-dom';

const CLOUDINARY_CLOUD_NAME = 'dw2nn8dzr';
const CLOUDINARY_UPLOAD_PRESET = 'donaciones_preset';



function CrearDonaciones() {
    const [nombre, setNombre] = useState('');
    const [cantidad, setCantidad] = useState('');
    const [fecha, setFecha] = useState('');
    const [ubicacion, setUbicacion] = useState('');
    const [descripcion, setDescripcion] = useState('');
    const [disponibleHasta, setDisponibleHasta] = useState('');
    const [metodos, setMetodos] = useState({ bicicleta: true, moto: false, carro: false, camion: false });
    const [cargando, setCargando] = useState(false);
    const [imagenArchivo, setImagenArchivo] = useState(null);
    const [previsualizacion, setPrevisualizacion] = useState(null);
    const [coordenadas, setCoordenadas] = useState(null);

    const { toasts, showToast, removeToast } = useToast();
const navigate = useNavigate();

    const seleccionarArchivo = (e) => {
        const archivo = e.target.files[0];
        if (archivo) {
            setImagenArchivo(archivo);
            setPrevisualizacion(URL.createObjectURL(archivo));
        }
    };

    const toggleMetodo = (key) => setMetodos(prev => ({ ...prev, [key]: !prev[key] }));

    const obtenerUbicacionActual = () => {
    if (!navigator.geolocation) {
        showToast('Tu navegador no soporta geolocalización.', 'error');
        return;
    }
    showToast('Obteniendo tu ubicación, espera un momento...', 'warn');
    navigator.geolocation.getCurrentPosition(
        (position) => {
            setCoordenadas({ lat: position.coords.latitude, lng: position.coords.longitude });
            showToast('Las coordenadas GPS se guardaron correctamente.', 'success');
        },
        () => {
            showToast('No se pudo obtener la ubicación. Activa el GPS e intenta de nuevo.', 'error');
        }
    );
};

    const subirImagenCloudinary = async (archivo) => {
        const formData = new FormData();
        formData.append('file', archivo);
        formData.append('upload_preset', CLOUDINARY_UPLOAD_PRESET);

        const response = await fetch(
            `https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD_NAME}/image/upload`,
            { method: 'POST', body: formData }
        );

        if (!response.ok) throw new Error('Error al subir imagen a Cloudinary');

        const data = await response.json();
        return data.secure_url;
    };

    const manejarPublicacion = async () => {
    if (!nombre || !cantidad || !ubicacion) {
        showToast('Por favor completa los campos obligatorios: nombre, cantidad y dirección.', 'warn');
        return;
    }
        setCargando(true);

        try {
            let urlImagen = "https://via.placeholder.com/400x220?text=Sin+Foto";

            if (imagenArchivo) {
                urlImagen = await subirImagenCloudinary(imagenArchivo);
            }

            const user = auth.currentUser;
            const nombreDonador = user?.displayName || user?.email || 'Donante anónimo';

            await addDoc(collection(db, "donaciones"), {
                titulo: nombre.trim(),
                nombre: nombre.trim(),
                cantidad: cantidad.trim(),
                fecha: fecha || new Date().toISOString().split('T')[0],
                ubicacion: ubicacion.trim(),
                descripcion: descripcion.trim(),
                disponibleHasta: disponibleHasta || 'Sin límite',
                fotoUrl: urlImagen,
                imagen: urlImagen,
                donador: nombreDonador,
                donadorNombre: nombreDonador,
                donadorId: user?.uid || '',
                metodos,
                distancia: '—',
                estado: "disponible",
                fecha_creacion: new Date(),
                coordenadas: coordenadas || null,
                lat: coordenadas?.lat || null,
                lng: coordenadas?.lng || null,
            });

        showToast('Tu donación fue publicada con éxito. ¡Gracias por compartir!', 'success');
            setTimeout(() => navigate('/dashboardona'), 1500);
        } catch (error) {
            console.error("Error:", error);
            showToast('No se pudo publicar la donación. Intenta de nuevo.', 'error');        } finally {
            setCargando(false);
        }
    };

    return (
        <div style={s.page}>
            <Toast toasts={toasts} removeToast={removeToast} />


            {/* HEADER — mismo diseño que el dashboard */}
            <div style={s.overlayHeader}>
                <div style={s.headerCircle}></div>
                <button style={s.volverBtn} onClick={() => navigate('/dashboardona')}>←</button>
                <h1 style={s.titulo}>Crear donación</h1>
                <p style={s.subtitulo}>Comparte comida con quienes más lo necesitan</p>
            </div>

            {/* CONTENIDO */}
            <div style={s.overlayContent}>

                {/* FOTO */}
                <div style={s.card}>
                    <h2 style={s.cardTitulo}>Imagen de la donación</h2>
                    <input
                        type="file"
                        id="file-input"
                        accept="image/*"
                        style={{ display: 'none' }}
                        onChange={seleccionarArchivo}
                    />
                    <label htmlFor="file-input" style={s.uploadBox}>
                        {previsualizacion ? (
                            <img src={previsualizacion} alt="preview" style={s.uploadPreview} />
                        ) : (
                            <div style={s.uploadPlaceholder}>
                                <span style={s.emoji}>🍣</span>
                                <h3 style={s.uploadH3}>Subir fotografía</h3>
                                <p style={s.uploadP}>Agrega una imagen clara de la comida que deseas compartir.</p>
                                <span style={s.uploadBtn}>Seleccionar imagen</span>
                            </div>
                        )}
                    </label>
                    {previsualizacion && (
                        <label htmlFor="file-input" style={s.cambiarFoto}>
                            Cambiar foto
                        </label>
                    )}
                </div>

                {/* INFO PRINCIPAL */}
                <div style={s.card}>
                    <h2 style={s.cardTitulo}>Información principal</h2>

                    <label style={s.label}>Nombre de alimento *</label>
                    <input
                        style={s.input}
                        type="text"
                        placeholder="Ejemplo: Comida casera"
                        value={nombre}
                        onChange={e => setNombre(e.target.value)}
                    />

                    <label style={s.label}>Descripción</label>
                    <textarea
                        style={s.textarea}
                        placeholder="Describe brevemente la comida, ingredientes o detalles importantes."
                        value={descripcion}
                        onChange={e => setDescripcion(e.target.value)}
                    />

                    <label style={s.label}>Cantidad aproximada *</label>
                    <input
                        style={s.input}
                        type="text"
                        placeholder="Ejemplo: 5 platos"
                        value={cantidad}
                        onChange={e => setCantidad(e.target.value)}
                    />
                </div>

                {/* UBICACIÓN */}
                <div style={s.card}>
                    <h2 style={s.cardTitulo}>Ubicación y disponibilidad</h2>

                    <label style={s.label}>Dirección *</label>
                    <input
                        style={s.input}
                        type="text"
                        placeholder="Ej: Colonia Escalón, San Salvador"
                        value={ubicacion}
                        onChange={e => setUbicacion(e.target.value)}
                    />

                    <button onClick={obtenerUbicacionActual} style={s.locationBtn}>
                        📍 Usar mi ubicación actual
                    </button>

                    {coordenadas && (
                        <p style={s.locationSuccess}>✅ Ubicación GPS guardada correctamente</p>
                    )}

                    <label style={s.label}>Disponible hasta</label>
                    <input
                       style={s.input}
                        type="time"
                         value={disponibleHasta}
                          onChange={e => setDisponibleHasta(e.target.value)}
                    />

                    <label style={s.label}>Fecha</label>
                    <input
                        style={{ ...s.input, marginBottom: 0 }}
                        type="date"
                        value={fecha}
                        onChange={e => setFecha(e.target.value)}
                    />
                </div>

                {/* MÉTODOS DE ENTREGA */}
                <div style={s.card}>
                    <h2 style={s.cardTitulo}>Métodos de entrega</h2>
                    <p style={s.infoText}>
                        Selecciona los métodos disponibles según la cantidad y tipo de comida que donarás.
                    </p>

                    <div style={s.metodosGrid}>
                        {[
                            { key: 'bicicleta', emoji: '🚲', label: 'Bicicleta' },
                            { key: 'moto', emoji: '🏍️', label: 'Moto' },
                            { key: 'carro', emoji: '🚗', label: 'Carro' },
                            { key: 'camion', emoji: '🚚', label: 'Camión' },
                        ].map(m => (
                            <div
                                key={m.key}
                                style={{ ...s.metodo, ...(metodos[m.key] ? s.metodoActivo : {}) }}
                                onClick={() => toggleMetodo(m.key)}
                            >
                                <span style={s.metodoEmoji}>{m.emoji}</span>
                                <h4 style={s.metodoLabel}>{m.label}</h4>
                            </div>
                        ))}
                    </div>

                    <button
                        style={{ ...s.botonVerde, opacity: cargando ? 0.75 : 1 }}
                        onClick={manejarPublicacion}
                        disabled={cargando}
                    >
                        {cargando ? "Publicando..." : "Publicar donación"}
                    </button>
                </div>

            </div>

            {/* NAV — mismo que el dashboard */}
            <div style={s.nav}>
                <div style={s.navItem} onClick={() => navigate('/dashboardona')}>
                    <span style={s.navIcon}>🏠</span>Inicio
                </div>
                <div style={{ ...s.navItem, color: '#016d3b', fontWeight: 'bold' }}>
                    <span style={s.navIcon}>🔔</span>Mis solicitudes
                </div>
                <div style={s.navItem} onClick={() => navigate('/dashboardona')}>
                    <span style={s.navIcon}>🍱</span>Mis donaciones
                </div>
                <div style={s.navItem} onClick={() => navigate('/dashboardona')}>
                    <span style={s.navIcon}>👤</span>Perfil
                </div>
            </div>
        </div>
    );
}

const s = {
    // — página y layout — exactamente igual al dashboard
    page: {
        minHeight: '100vh',
        background: 'linear-gradient(135deg,#eef2f7,#dfe7f3)',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        padding: '18px',
        paddingBottom: '120px',
        fontFamily: 'Arial, Helvetica, sans-serif',
        boxSizing: 'border-box',
    },

    // — header igual al overlayHeader del dashboard
    overlayHeader: {
        width: '100%',
        maxWidth: '1100px',
        boxSizing: 'border-box',
        background: 'linear-gradient(135deg,#006d2f,#00a344)',
        color: 'white',
        padding: '24px',
        borderRadius: '28px',
        marginBottom: '20px',
        position: 'relative',
        overflow: 'hidden',
        boxShadow: '0 15px 35px rgba(0,0,0,0.12)',
    },
    headerCircle: {
        position: 'absolute',
        width: '200px',
        height: '200px',
        borderRadius: '50%',
        background: 'rgba(255,255,255,0.05)',
        top: '-80px',
        right: '-50px',
    },
    volverBtn: {
        width: '44px',
        height: '44px',
        border: 'none',
        borderRadius: '14px',
        background: 'rgba(255,255,255,0.15)',
        color: 'white',
        fontSize: '20px',
        cursor: 'pointer',
        marginBottom: '16px',
        display: 'block',
        position: 'relative',
        zIndex: 2,
    },
    titulo: { fontSize: '28px', fontWeight: 800, margin: 0, color: 'white' },
    subtitulo: { marginTop: '6px', color: '#dcffe9', fontSize: '14px' },

    overlayContent: { width: '100%', maxWidth: '1100px' },

    // — cards igual al dashboard
    card: {
        background: 'white',
        borderRadius: '24px',
        padding: '22px',
        boxShadow: '0 8px 25px rgba(0,0,0,0.08)',
        marginBottom: '20px',
    },
    cardTitulo: { fontSize: '20px', marginBottom: '16px', color: '#222', marginTop: 0 },

    // — upload foto
    uploadBox: {
        display: 'block',
        border: '2px dashed #c8e6c9',
        borderRadius: '20px',
        overflow: 'hidden',
        background: '#f9fff9',
        cursor: 'pointer',
    },
    uploadPlaceholder: {
        padding: '30px 20px',
        textAlign: 'center',
    },
    uploadPreview: {
        width: '100%',
        height: '200px',
        objectFit: 'cover',
        display: 'block',
    },
    emoji: { fontSize: '48px', display: 'block' },
    uploadH3: { marginTop: '10px', fontSize: '18px', color: '#222' },
    uploadP: { marginTop: '6px', color: '#888', fontSize: '13px', lineHeight: 1.5 },
    uploadBtn: {
        display: 'inline-block',
        marginTop: '14px',
        background: 'linear-gradient(to right,#006d2f,#00a344)',
        color: 'white',
        padding: '12px 22px',
        borderRadius: '14px',
        fontSize: '13px',
        fontWeight: 'bold',
    },
    cambiarFoto: {
        display: 'block',
        textAlign: 'center',
        marginTop: '10px',
        color: '#016d3b',
        fontWeight: 'bold',
        cursor: 'pointer',
        fontSize: '13px',
    },

    // — formulario — igual al dashboard
    label: {
        display: 'block',
        marginBottom: '8px',
        marginTop: '14px',
        color: '#333',
        fontWeight: 'bold',
        fontSize: '14px',
    },
    input: {
        width: '100%',
        padding: '15px',
        border: 'none',
        borderRadius: '18px',
        background: '#f5f5f5',
        fontSize: '15px',
        outline: 'none',
        boxSizing: 'border-box',
        marginBottom: '4px',
        color: '#333',
    },
    textarea: {
        width: '100%',
        padding: '15px',
        border: 'none',
        borderRadius: '18px',
        background: '#f5f5f5',
        fontSize: '15px',
        outline: 'none',
        height: '110px',
        resize: 'none',
        boxSizing: 'border-box',
        color: '#333',
    },
    locationBtn: {
        width: '100%',
        padding: '14px',
        background: 'linear-gradient(to right,#006d2f,#00a344)',
        color: 'white',
        border: 'none',
        borderRadius: '16px',
        fontWeight: 'bold',
        cursor: 'pointer',
        fontSize: '14px',
        marginTop: '14px',
        marginBottom: '14px',
        boxSizing: 'border-box',
    },
    locationSuccess: {
        color: '#016d3b',
        textAlign: 'center',
        fontSize: '13px',
        margin: '0 0 14px 0',
    },
    infoText: {
        fontSize: '13px',
        color: '#777',
        lineHeight: 1.5,
        marginBottom: '16px',
        marginTop: 0,
    },

    // — métodos de transporte — igual al dashboard
    metodosGrid: {
        display: 'grid',
        gridTemplateColumns: '1fr 1fr',
        gap: '14px',
        marginBottom: '20px',
    },
    metodo: {
        background: '#f5f5f5',
        border: '3px solid transparent',
        borderRadius: '20px',
        padding: '18px 12px',
        textAlign: 'center',
        cursor: 'pointer',
        transition: '0.2s',
    },
    metodoActivo: {
        border: '3px solid #016d3b',
        background: '#eafff2',
    },
    metodoEmoji: { display: 'block', fontSize: '30px', marginBottom: '8px' },
    metodoLabel: { color: '#222', fontSize: '14px', margin: 0 },

    // — botón publicar — igual al botonVerde del dashboard
    botonVerde: {
        width: '100%',
        padding: '15px',
        border: 'none',
        borderRadius: '16px',
        background: 'linear-gradient(to right,#006d2f,#00a344)',
        color: 'white',
        fontSize: '15px',
        fontWeight: 'bold',
        cursor: 'pointer',
        boxSizing: 'border-box',
    },

    // — nav — exactamente igual al dashboard
    nav: {
        position: 'fixed',
        bottom: '20px',
        left: '50%',
        transform: 'translateX(-50%)',
        width: '92%',
        maxWidth: '760px',
        background: 'rgba(255,255,255,0.92)',
        backdropFilter: 'blur(14px)',
        borderRadius: '22px',
        padding: '14px 18px',
        display: 'flex',
        justifyContent: 'space-around',
        alignItems: 'center',
        boxShadow: '0 10px 30px rgba(0,0,0,0.12)',
        border: '1px solid rgba(255,255,255,0.5)',
        zIndex: 999,
    },
    navItem: {
        textAlign: 'center',
        fontSize: '12px',
        cursor: 'pointer',
        transition: '0.2s',
        color: '#888',
    },
    navIcon: { display: 'block', fontSize: '24px', marginBottom: '4px' },
};

export default CrearDonaciones;