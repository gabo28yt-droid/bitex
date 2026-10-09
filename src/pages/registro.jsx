import { useState, useEffect, useRef, useCallback } from 'react';
import { Toast } from '../components/Toast';
import { useToast } from '../components/useToast';
import { IconUser, IconMail, IconLock, IconPhone, IconPin, IconRole } from '../components/FormIcons';
import { db, auth } from '../firebase/conifg';
import { doc, setDoc } from "firebase/firestore";
import { createUserWithEmailAndPassword } from "firebase/auth";
import { useNavigate } from 'react-router-dom';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import logo from '../assets/logo.png';



function Registro() {
    const [nombre, setNombre] = useState('');
    const [email, setEmail] = useState('');
    const [pass, setPass] = useState('');
    const [rol, setRol] = useState('');
    const [telefono, setTelefono] = useState('');
    const [direccion, setDireccion] = useState('');
    const [coordenadas, setCoordenadas] = useState(null);
    const [gpsEstado, setGpsEstado] = useState('idle'); // idle | cargando | ok | error
    const [loading, setLoading] = useState(false);
    const [isMobile, setIsMobile] = useState(window.innerWidth < 480);

    const mapRef = useRef(null);
    const mapInstanceRef = useRef(null);
    const markerRef = useRef(null);

    const { toasts, showToast, removeToast } = useToast();
    const navigate = useNavigate();

    useEffect(() => {
        const handleResize = () => setIsMobile(window.innerWidth < 480);
        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, []);

    useEffect(() => {
        if (rol === 'repartidor') navigate('/registrorepartidor', { replace: true });
    }, [rol, navigate]);

    const obtenerUbicacion = useCallback((mapInstance) => {
        const map = mapInstance || mapInstanceRef.current;
        if (!map) return;

        if (!navigator.geolocation) {
            setGpsEstado('error');
            showToast('Tu dispositivo no soporta geolocalización.', 'error');
            return;
        }

        setGpsEstado('cargando');

        navigator.geolocation.getCurrentPosition(
            async (pos) => {
                const { latitude, longitude } = pos.coords;
                setCoordenadas({ lat: latitude, lng: longitude });

                // Mover mapa
                map.setView([latitude, longitude], 16);

                // Crear o mover marcador
                const iconoPin = L.divIcon({
                    html: '<div style="background:#016d3b;width:36px;height:36px;border-radius:50%;border:3px solid white;display:flex;justify-content:center;align-items:center;font-size:18px;box-shadow:0 2px 8px rgba(0,0,0,0.3)">📍</div>',
                    className: '',
                    iconSize: [36, 36],
                    iconAnchor: [18, 36],
                });

                if (markerRef.current) {
                    markerRef.current.setLatLng([latitude, longitude]);
                } else {
                    markerRef.current = L.marker([latitude, longitude], { icon: iconoPin })
                        .addTo(map)
                        .bindPopup('Tu ubicación')
                        .openPopup();
                }

                // Geocoding inverso para obtener dirección legible
                try {
                    const res = await fetch(
                        `https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}`
                    );
                    const data = await res.json();
                    if (data?.display_name) {
                        // Simplificar la dirección: tomar las primeras partes relevantes
                        const partes = data.display_name.split(',');
                        const dirSimple = partes.slice(0, 3).join(',').trim();
                        setDireccion(dirSimple);
                    }
                } catch {
                    // Si falla el geocoding, dejar el campo vacío para que lo llene manualmente
                }

                setGpsEstado('ok');
                showToast('Puedes corregir la dirección si es necesario.', 'success');
            },
            () => {
                setGpsEstado('error');
                showToast('No se pudo obtener tu ubicación. Ingresa tu dirección manualmente.', 'error');
            },
            { enableHighAccuracy: true, timeout: 10000 }
        );
    }, [showToast]);

    // Inicializar mapa cuando el rol cambia a beneficiario
    useEffect(() => {
        if (rol !== 'beneficiario') return;

        const timer = setTimeout(() => {
            if (!mapRef.current || mapInstanceRef.current) return;

            const map = L.map(mapRef.current).setView([13.6929, -89.2182], 13);
            mapInstanceRef.current = map;

            L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
                attribution: '&copy; OpenStreetMap'
            }).addTo(map);

            obtenerUbicacion(map);
        }, 100);

        return () => {
            clearTimeout(timer);
            if (mapInstanceRef.current) {
                mapInstanceRef.current.remove();
                mapInstanceRef.current = null;
                markerRef.current = null;
            }
        };
    }, [rol, obtenerUbicacion]);

    const handleClick = () => {
        if (rol === 'repartidor') return;
        if (!nombre.trim() || !email.trim() || !pass.trim() || !rol) {
            showToast('Por favor completa todos los campos obligatorios.', 'warn');
            return;
        }
        if (rol === 'beneficiario' && !direccion.trim()) {
            showToast('Por favor ingresa tu dirección de entrega.', 'warn');
            return;
        }

        setLoading(true);

        createUserWithEmailAndPassword(auth, email, pass)
            .then((credencial) => {
                const user = credencial.user;
                return setDoc(doc(db, "usuarios", user.uid), {
                    uid: user.uid,
                    nombre: nombre.trim(),
                    correo: email.toLowerCase().trim(),
                    rol,
                    telefono: telefono.trim() || null,
                    direccion: rol === 'beneficiario' ? direccion.trim() : null,
                    coordenadas: rol === 'beneficiario' ? coordenadas : null,
                    fecha_registro: new Date()
                });
            })
            .then(() => {
                showToast('¡Bienvenido a BiteX! Tu cuenta fue creada con éxito.', 'success');
                setTimeout(() => navigate('/index'), 1500);
            })
            .catch((error) => {
                if (error.code === 'auth/weak-password')
                    showToast('La contraseña debe tener al menos 6 caracteres.', 'error');
                else if (error.code === 'auth/email-already-in-use')
                    showToast('Este correo ya está registrado. Intenta con otro.', 'error');
                else if (error.code === 'auth/invalid-email')
                    showToast('El correo electrónico no tiene un formato válido.', 'error');
                else
                    showToast(error.message, 'error');            })
            .finally(() => setLoading(false));
    };

    return (
        <div style={styles.fullPageBackground}>
            <Toast toasts={toasts} removeToast={removeToast} />
            <div style={{
                ...styles.whiteCard,
                padding: isMobile ? '40px 20px' : '50px 40px',
                width: isMobile ? '90%' : '440px'
            }}>
                <div style={styles.logoContainer}>
                    <img src={logo} alt="Logo BiteX" style={styles.logo} />
                </div>

                <h1 style={{ ...styles.title, fontSize: isMobile ? '24px' : '30px' }}>Crear cuenta</h1>
                <div style={styles.underline}></div>

                {/* NOMBRE */}
                <div style={styles.inputWrapper}>
                    <label style={styles.floatingLabel}>Nombre de usuario</label>
                    <div style={styles.iconContainer}><IconUser /></div>
                    <input type="text" placeholder="Tu nombre completo" style={styles.input} value={nombre} onChange={(e) => setNombre(e.target.value)} />
                </div>

                {/* CORREO */}
                <div style={styles.inputWrapper}>
                    <label style={styles.floatingLabel}>Correo electrónico</label>
                    <div style={styles.iconContainer}><IconMail /></div>
                    <input type="email" placeholder="ejemplo@correo.com" style={styles.input} value={email} onChange={(e) => setEmail(e.target.value)} />
                </div>

                {/* CONTRASEÑA */}
                <div style={styles.inputWrapper}>
                    <label style={styles.floatingLabel}>Contraseña</label>
                    <div style={styles.iconContainer}><IconLock /></div>
                    <input type="password" placeholder="••••••••" style={styles.input} value={pass} onChange={(e) => setPass(e.target.value)} />
                </div>

                {/* TELÉFONO */}
                <div style={styles.inputWrapper}>
                    <label style={styles.floatingLabel}>Teléfono <span style={{ color: '#aaa', fontWeight: 'normal' }}>(opcional)</span></label>
                    <div style={styles.iconContainer}><IconPhone /></div>
                    <input type="tel" placeholder="+503 7000-0000" style={styles.input} value={telefono} onChange={(e) => setTelefono(e.target.value)} />
                </div>

                {/* ROL */}
                <div style={styles.inputWrapper}>
                    <label style={styles.floatingLabel}>Tipo de usuario</label>
                    <div style={styles.iconContainer}><IconRole /></div>
                    <select style={styles.select} value={rol} onChange={(e) => setRol(e.target.value)}>
                        <option value="" disabled>Selecciona tu tipo de usuario</option>
                        <option value="donante">Donante</option>
                        <option value="beneficiario">Beneficiario</option>
                        <option value="repartidor">Repartidor</option>
                    </select>
                </div>

                {/* SECCIÓN DIRECCIÓN — solo beneficiario */}
                {rol === 'beneficiario' && (
                    <>
                        {/* Estado GPS */}
                        {gpsEstado === 'cargando' && (
                            <div style={{ ...styles.gpsAviso, background: '#fff8e1', color: '#b47a00' }}>
                                ⏳ Obteniendo tu ubicación...
                            </div>
                        )}
                        {gpsEstado === 'ok' && (
                            <div style={{ ...styles.gpsAviso, background: '#e8fff1', color: '#0a5c2e' }}>
                                ✅ Ubicación obtenida. Puedes corregir la dirección si es necesario.
                            </div>
                        )}
                        {gpsEstado === 'error' && (
                            <div style={{ ...styles.gpsAviso, background: '#fff0f0', color: '#a00000' }}>
                                ❌ No se pudo obtener el GPS. Ingresa tu dirección manualmente.
                            </div>
                        )}

                        {/* Mapa */}
                        <div
                            ref={mapRef}
                            style={{ width: '100%', height: '200px', borderRadius: '18px', overflow: 'hidden', marginBottom: '20px', border: '1px solid #e3e3e3' }}
                        ></div>

                        {/* Campo dirección */}
                        <div style={styles.inputWrapper}>
                            <label style={styles.floatingLabel}>Dirección de entrega</label>
                            <div style={styles.iconContainer}><IconPin /></div>
                            <input
                                type="text"
                                placeholder="Tu dirección completa"
                                style={styles.input}
                                value={direccion}
                                onChange={(e) => setDireccion(e.target.value)}
                            />
                        </div>

                        {/* Botón para reintentar GPS */}
                        {(gpsEstado === 'error' || gpsEstado === 'idle') && (
                            <button
                                style={styles.gpsBtn}
                                onClick={() => obtenerUbicacion()}
                                type="button"
                            >
                                📍 Usar mi ubicación actual
                            </button>
                        )}
                    </>
                )}

                {rol === 'repartidor' && (
                    <div style={styles.repartidorNotice}>
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M5 12h14"></path><path d="m12 5 7 7-7 7"></path>
                        </svg>
                        Redirigiendo al formulario especial...
                    </div>
                )}

                <button style={styles.btnSubmit} onClick={handleClick} disabled={loading || rol === 'repartidor'}>
                    {loading ? "Creando cuenta..." : rol === 'repartidor' ? "Redirigiendo..." : "Crear cuenta"}
                </button>

                <div style={styles.dividerContainer}>
                    <div style={styles.line}></div>
                    <span style={styles.dividerText}>¿Ya tienes cuenta?</span>
                    <div style={styles.line}></div>
                </div>

                <div style={styles.registerLinkContainer} onClick={() => navigate('/index')}>
                    <span style={styles.registerText}>Inicia sesión</span>
                    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#101828" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ marginLeft: '10px' }}>
                        <line x1="5" y1="12" x2="19" y2="12"></line>
                        <polyline points="12 5 19 12 12 19"></polyline>
                    </svg>
                </div>
            </div>
        </div>
    );
}

const styles = {
        fullPageBackground: { width: '100vw', minHeight: '100vh', display: 'flex', justifyContent: 'center', alignItems: 'center', background: 'linear-gradient(180deg, #d3eab4 0%, #ffffff 100%)', fontFamily: "'Segoe UI', Roboto, Helvetica, Arial, sans-serif", margin: 0, padding: '20px', boxSizing: 'border-box' },



    whiteCard: { backgroundColor: '#FFFFFF', borderRadius: '28px', boxSizing: 'border-box', textAlign: 'center', boxShadow: '0 15px 40px rgba(0,0,0,0.08)' },
    logoContainer: { marginBottom: '-20px', display: 'flex', justifyContent: 'center' },
    logo: { width: '200px', height: 'auto' },
    title: { color: '#111827', margin: '0 0 10px 0', fontWeight: '600' },
    underline: { width: '30px', height: '3px', backgroundColor: '#168a32', margin: '0 auto 36px auto', borderRadius: '10px' },
    inputWrapper: { position: 'relative', marginBottom: '28px', width: '100%' },
    floatingLabel: { position: 'absolute', top: '-10px', left: '15px', backgroundColor: '#fff', padding: '0 8px', color: '#168a32', fontSize: '13px', fontWeight: 'bold', zIndex: 2 },
    iconContainer: { position: 'absolute', top: '50%', left: '18px', transform: 'translateY(-50%)', display: 'flex', alignItems: 'center', zIndex: 1 },
    input: { width: '100%', boxSizing: 'border-box', padding: '18px 18px 18px 52px', borderRadius: '14px', border: '1px solid #d1d5db', backgroundColor: '#ffffff', fontSize: '16px', outline: 'none', color: '#333' },
    select: { width: '100%', boxSizing: 'border-box', padding: '18px 18px 18px 52px', borderRadius: '14px', border: '1px solid #d1d5db', backgroundColor: '#ffffff', fontSize: '16px', outline: 'none', color: '#555', appearance: 'none', cursor: 'pointer' },
    repartidorNotice: { display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '7px', backgroundColor: '#fff3e0', color: '#b84a00', borderRadius: '10px', padding: '9px 14px', fontSize: '13px', fontWeight: '600', marginBottom: '16px' },
    gpsAviso: { borderRadius: '12px', padding: '10px 14px', fontSize: '13px', fontWeight: '600', marginBottom: '14px', textAlign: 'center' },
    gpsBtn: { width: '100%', padding: '14px', background: '#016d3b', color: 'white', border: 'none', borderRadius: '14px', fontWeight: 'bold', cursor: 'pointer', fontSize: '14px', marginBottom: '20px', boxSizing: 'border-box' },
    btnSubmit: { backgroundColor: '#ff5a00', color: 'white', width: '100%', padding: '18px', borderRadius: '14px', border: 'none', fontSize: '18px', fontWeight: 'bold', cursor: 'pointer', marginTop: '10px', boxShadow: '0 6px 20px rgba(255, 90, 0, 0.25)', transition: 'all 0.3s ease' },
    dividerContainer: { display: 'flex', alignItems: 'center', margin: '35px 0 25px 0' },
    line: { flex: 1, height: '1px', backgroundColor: '#e5e7eb' },
    dividerText: { margin: '0 15px', color: '#6b7280', fontSize: '14px', fontWeight: '500' },
    registerLinkContainer: { display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', marginTop: '10px' },
    registerText: { color: '#168a32', fontWeight: '800', fontSize: '20px' },
};

export default Registro;
