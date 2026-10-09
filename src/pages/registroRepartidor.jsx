import { useState, useEffect } from 'react';
import { Toast } from '../components/Toast';
import { useToast } from '../components/useToast';
import { IconUser, IconMail, IconLock, IconPhone, IconId, IconCar, IconPlate } from '../components/FormIcons';
import { useNavigate } from 'react-router-dom';
import { db, auth } from '../firebase/conifg';
import { doc, setDoc } from "firebase/firestore";
import { createUserWithEmailAndPassword } from "firebase/auth";
import logo from '../assets/logo.png';



function RegistroRepartidor() {
    const [nombre, setNombre] = useState('');
    const [email, setEmail] = useState('');
    const [pass, setPass] = useState('');
    const [telefono, setTelefono] = useState('');
    const [dui, setDui] = useState('');
    const [vehiculo, setVehiculo] = useState('');
    const [placa, setPlaca] = useState('');
    const [loading, setLoading] = useState(false);
    const [isMobile, setIsMobile] = useState(window.innerWidth < 480);

    const { toasts, showToast, removeToast } = useToast();
    const navigate = useNavigate();

    useEffect(() => {
        const handleResize = () => setIsMobile(window.innerWidth < 480);
        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, []);

    const handleDui = (val) => {
        const solo = val.replace(/\D/g, '').slice(0, 9);
        if (solo.length <= 8) setDui(solo);
        else setDui(solo.slice(0, 8) + '-' + solo.slice(8));
    };

    const manejarRegistroRepartidor = async () => {
        if (!nombre.trim() || !email.trim() || !pass.trim() || !telefono.trim() || !dui.trim() || !vehiculo || !placa.trim()) {
            showToast('Por favor completa todos los campos.', 'error');
            return;
        }
        if (dui.replace(/\D/g, '').length !== 9) {
            showToast('El DUI debe tener 9 dígitos (formato: 00000000-0).', 'error');
            return;
        }

        setLoading(true);
        try {
            const credencial = await createUserWithEmailAndPassword(auth, email, pass);
            const user = credencial.user;

            await setDoc(doc(db, "usuarios", user.uid), {
                uid: user.uid,
                nombre: nombre.trim(),
                correo: email.toLowerCase().trim(),
                telefono: telefono.trim(),
                dui: dui.trim(),
                rol: "repartidor",
                vehiculo,
                placa: placa.toUpperCase().trim(),
                fecha_registro: new Date(),
                estado: "pendiente"
            });

            showToast('¡Registro de repartidor exitoso! Tu cuenta será revisada.', 'success');
            navigate('/index');
        } catch (error) {
            console.error("Error:", error);
            if (error.code === 'auth/weak-password')  showToast('La contraseña debe tener al menos 6 caracteres.', 'error');
            else if (error.code === 'auth/email-already-in-use') showToast('Este correo ya está registrado.', 'error');
            else if (error.code === 'auth/invalid-email')  showToast('El correo no es válido.', 'error');
            else  showToast(`Error al registrar: ${error.message}`, 'error');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div style={styles.fullPageBackground}>
            <Toast toasts={toasts} removeToast={removeToast} />
            <div style={{
                ...styles.whiteCard,
                padding: isMobile ? '40px 20px' : '50px 40px',
                width: isMobile ? '90%' : '460px'
            }}>
                <div style={styles.logoContainer}>
                    <img src={logo} alt="Logo BiteX" style={styles.logo} />
                </div>

                <h1 style={{ ...styles.title, fontSize: isMobile ? '22px' : '28px' }}>Registro de Repartidor</h1>
                <div style={styles.underline}></div>

                {/* NOMBRE */}
                <div style={styles.inputWrapper}>
                    <label style={styles.floatingLabel}>Nombre completo</label>
                    <div style={styles.iconContainer}><IconUser /></div>
                    <input
                        type="text"
                        placeholder="Tu nombre completo"
                        style={styles.input}
                        value={nombre}
                        onChange={(e) => setNombre(e.target.value)}
                        autoComplete="name"
                    />
                </div>

                {/* CORREO */}
                <div style={styles.inputWrapper}>
                    <label style={styles.floatingLabel}>Correo electrónico</label>
                    <div style={styles.iconContainer}><IconMail /></div>
                    <input
                        type="email"
                        placeholder="ejemplo@correo.com"
                        style={styles.input}
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        autoComplete="email"
                    />
                </div>

                {/* CONTRASEÑA */}
                <div style={styles.inputWrapper}>
                    <label style={styles.floatingLabel}>Contraseña</label>
                    <div style={styles.iconContainer}><IconLock /></div>
                    <input
                        type="password"
                        placeholder="••••••••"
                        style={styles.input}
                        value={pass}
                        onChange={(e) => setPass(e.target.value)}
                        autoComplete="new-password"
                    />
                </div>

                {/* TELÉFONO */}
                <div style={styles.inputWrapper}>
                    <label style={styles.floatingLabel}>Teléfono</label>
                    <div style={styles.iconContainer}><IconPhone /></div>
                    <input
                        type="tel"
                        placeholder="+503 7000-0000"
                        style={styles.input}
                        value={telefono}
                        onChange={(e) => setTelefono(e.target.value)}
                        autoComplete="tel"
                    />
                </div>

                {/* DUI */}
                <div style={styles.inputWrapper}>
                    <label style={styles.floatingLabel}>DUI</label>
                    <div style={styles.iconContainer}><IconId /></div>
                    <input
                        type="text"
                        placeholder="00000000-0"
                        style={styles.input}
                        value={dui}
                        onChange={(e) => handleDui(e.target.value)}
                        maxLength={10}
                        autoComplete="off"
                    />
                </div>

                {/* VEHÍCULO */}
                <div style={styles.inputWrapper}>
                    <label style={styles.floatingLabel}>Tipo de vehículo</label>
                    <div style={styles.iconContainer}><IconCar /></div>
                    <select style={styles.select} value={vehiculo} onChange={(e) => setVehiculo(e.target.value)}>
                        <option value="" disabled>Selecciona vehículo</option>
                        <option value="bicicleta">Bicicleta</option>
                        <option value="motocicleta">Motocicleta</option>
                        <option value="auto">Automóvil</option>
                        <option value="camion">Camión</option>
                    </select>
                </div>

                {/* PLACA */}
                <div style={styles.inputWrapper}>
                    <label style={styles.floatingLabel}>Placa / Identificador</label>
                    <div style={styles.iconContainer}><IconPlate /></div>
                    <input
                        type="text"
                        placeholder="ABC-1234 o ID bicicleta"
                        style={styles.input}
                        value={placa}
                        onChange={(e) => setPlaca(e.target.value)}
                        autoComplete="off"
                    />
                </div>

                <button style={styles.btnSubmit} onClick={manejarRegistroRepartidor} disabled={loading}>
                    {loading ? "Registrando..." : "Registrarme como Repartidor"}
                </button>

                <div style={styles.dividerContainer}>
                    <div style={styles.line}></div>
                    <span style={styles.dividerText}>¿Cambiaste de idea?</span>
                    <div style={styles.line}></div>
                </div>

                <div style={styles.registerLinkContainer} onClick={() => navigate('/registro')}>
                    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#101828" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ marginRight: '10px' }}>
                        <line x1="19" y1="12" x2="5" y2="12"></line>
                        <polyline points="12 19 5 12 12 5"></polyline>
                    </svg>
                    <span style={styles.registerText}>Volver al registro</span>
                </div>
            </div>
        </div>
    );
}

const styles = {
    fullPageBackground: { width: '100vw', minHeight: '100vh', display: 'flex', justifyContent: 'center', alignItems: 'center', background: 'linear-gradient(180deg, #d3eab4 0%, #ffffff 100%)', fontFamily: "'Segoe UI', Roboto, Helvetica, Arial, sans-serif", margin: 0, padding: '20px', boxSizing: 'border-box' },
    whiteCard: { backgroundColor: '#FFFFFF', borderRadius: '28px', border: 'none', boxSizing: 'border-box', textAlign: 'center', boxShadow: '0 15px 40px rgba(0,0,0,0.08)' },
    logoContainer: { marginBottom: '-20px', display: 'flex', justifyContent: 'center' },
    logo: { width: '200px', height: 'auto' },
    title: { color: '#111827', margin: '0 0 10px 0', fontWeight: '600' },
    underline: { width: '30px', height: '3px', backgroundColor: '#168a32', margin: '0 auto 36px auto', borderRadius: '10px' },
    inputWrapper: { position: 'relative', marginBottom: '28px', width: '100%' },
    floatingLabel: { position: 'absolute', top: '-10px', left: '15px', backgroundColor: '#fff', padding: '0 8px', color: '#168a32', fontSize: '13px', fontWeight: 'bold', zIndex: 2 },
    iconContainer: { position: 'absolute', top: '50%', left: '18px', transform: 'translateY(-50%)', display: 'flex', alignItems: 'center', zIndex: 1 },
    input: { width: '100%', boxSizing: 'border-box', padding: '18px 18px 18px 52px', borderRadius: '14px', border: '1px solid #d1d5db', backgroundColor: '#ffffff', fontSize: '16px', outline: 'none', color: '#333' },
    select: { width: '100%', boxSizing: 'border-box', padding: '18px 18px 18px 52px', borderRadius: '14px', border: '1px solid #d1d5db', backgroundColor: '#ffffff', fontSize: '16px', outline: 'none', color: '#555', appearance: 'none', cursor: 'pointer' },
    btnSubmit: { backgroundColor: '#ff5a00', color: 'white', width: '100%', padding: '18px', borderRadius: '14px', border: 'none', fontSize: '18px', fontWeight: 'bold', cursor: 'pointer', marginTop: '10px', boxShadow: '0 6px 20px rgba(255, 90, 0, 0.25)' },
    dividerContainer: { display: 'flex', alignItems: 'center', margin: '35px 0 25px 0' },
    line: { flex: 1, height: '1px', backgroundColor: '#e5e7eb' },
    dividerText: { margin: '0 15px', color: '#6b7280', fontSize: '14px', fontWeight: '500' },
    registerLinkContainer: { display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' },
    registerText: { color: '#168a32', fontWeight: '800', fontSize: '20px' },
};

export default RegistroRepartidor;