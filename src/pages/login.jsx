import { useState, useEffect } from 'react';
import { Toast } from '../components/Toast';
import { useToast } from '../components/useToast';
import { auth } from '../firebase/conifg';
import { db } from '../firebase/conifg';
import { signInWithEmailAndPassword } from 'firebase/auth';
import { collection, query, where, getDocs } from "firebase/firestore";
import { useNavigate } from 'react-router-dom';
import logo from '../assets/logo.png';



function Login() {
    const [email, setEmail] = useState('');
    const [pass, setPass] = useState('');
    const [loading, setLoading] = useState(false);
    const [isMobile, setIsMobile] = useState(window.innerWidth < 480);
    const { toasts, showToast, removeToast } = useToast();
    const navigate = useNavigate();

    useEffect(() => {
        const handleResize = () => setIsMobile(window.innerWidth < 480);
        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, []);



    const manejarLogin = async () => {
        if (!email || !pass) {
            return showToast("Por favor ingresa correo y contraseña", "error");
        }

        setLoading(true);

        try {
            const userCredential = await signInWithEmailAndPassword(auth, email, pass);
            const user = userCredential.user;

            // Buscar datos del usuario en Firestore
            const q = query(
                collection(db, "usuarios"),
                where("uid", "==", user.uid)
            );

            const querySnapshot = await getDocs(q);

            if (!querySnapshot.empty) {
                const userData = querySnapshot.docs[0].data();
                const rol = userData.rol?.toLowerCase().trim();

                showToast("¡Bienvenido! Redirigiendo...", "success");

                setTimeout(() => {
                    if (rol === "donante") {
                        navigate('/dashboardona');
                    }
                    else if (rol === "repartidor") {
                        navigate('/dashboardrepartidor');
                    }
                    else if (rol === "beneficiario") {
                        navigate('/dashboardbeneficiario');
                    }
                    else {
                        showToast("Rol no reconocido. Contacta al administrador.", "error");
                        navigate('/index');
                    }
                }, 1200);

            } else {
                showToast("No se encontraron datos completos del usuario.", "error");
                navigate('/index');
            }

        } catch (error) {
            console.error("Error de login:", error);
            showToast("Credenciales incorrectas. Verifica tu correo y contraseña.", "error");
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
                width: isMobile ? '90%' : '440px'
            }}>

                {/* LOGO */}
                <div style={styles.logoContainer}>
                    <img src={logo} alt="Logo BiteX" style={styles.logo} />
                </div>

                <h1 style={{
                    ...styles.title,
                    fontSize: isMobile ? '26px' : '32px'
                }}>Iniciar sesión</h1>
                <div style={styles.underline}></div>

                {/* Correo */}
                <div style={styles.inputWrapper}>
                    <label style={styles.floatingLabel}>Correo electrónico</label>
                    <div style={styles.iconContainer}>
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#168a32" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <rect x="2" y="4" width="20" height="16" rx="2"></rect>
                            <path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7"></path>
                        </svg>
                    </div>
                    <input
                        type="email"
                        placeholder="ejemplo@correo.com"
                        style={styles.input}
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                    />
                </div>

                {/* Contraseña */}
                <div style={styles.inputWrapper}>
                    <label style={styles.floatingLabel}>Contraseña</label>
                    <div style={styles.iconContainer}>
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#168a32" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect>
                            <path d="M7 11V7a5 5 0 0 1 10 0v4"></path>
                            <circle cx="12" cy="16" r="1"></circle>
                        </svg>
                    </div>
                    <input
                        type="password"
                        placeholder="••••••••"
                        style={styles.input}
                        value={pass}
                        onChange={(e) => setPass(e.target.value)}
                    />
                </div>

                <button
                    style={styles.btnSubmit}
                    onClick={manejarLogin}
                    disabled={loading}
                >
                    {loading ? "Iniciando sesión..." : "Iniciar sesión"}
                </button>

                <div style={styles.dividerContainer}>
                    <div style={styles.line}></div>
                    <span style={styles.dividerText}>¿No tienes cuenta?</span>
                    <div style={styles.line}></div>
                </div>

                <div
                    style={styles.registerLinkContainer}
                    onClick={() => navigate('/registro')}
                >
                    <span style={styles.registerText}>Regístrate</span>
                    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#101828" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ marginLeft: '10px' }}>
                        <line x1="5" y1="12" x2="19" y2="12"></line>
                        <polyline points="12 5 19 12 12 19"></polyline>
                    </svg>
                </div>

            </div>
        </div>
    );
}

/* ==================== ESTILOS ==================== */
const styles = {
        fullPageBackground: { width: '100vw', minHeight: '100vh', display: 'flex', justifyContent: 'center', alignItems: 'center', background: 'linear-gradient(180deg, #d3eab4 0%, #ffffff 100%)', fontFamily: "'Segoe UI', Roboto, Helvetica, Arial, sans-serif", margin: 0, padding: '20px', boxSizing: 'border-box' },

    whiteCard: {
        backgroundColor: '#FFFFFF',
        borderRadius: '28px',
        boxSizing: 'border-box',
        textAlign: 'center',
        boxShadow: '0 15px 40px rgba(0,0,0,0.08)',
        outline: 'none',        // 👈
    border: 'none',         // 👈

    },

    logoContainer: { marginBottom: '-20px', display: 'flex', justifyContent: 'center' },
    logo: { width: '200px', height: 'auto' },

    title: {
        color: '#111827',
        margin: '0 0 10px 0',
        fontWeight: '600',
    },
    underline: {
        width: '30px',
        height: '3px',
        backgroundColor: '#168a32',
        margin: '0 auto 40px auto',
        borderRadius: '10px',
    },

    inputWrapper: { position: 'relative', marginBottom: '28px', width: '100%' },
    floatingLabel: {
        position: 'absolute', top: '-10px', left: '15px',
        backgroundColor: '#fff', padding: '0 8px',
        color: '#168a32', fontSize: '13px', fontWeight: 'bold', zIndex: 2,
    },
    iconContainer: {
        position: 'absolute', top: '50%', left: '18px',
        transform: 'translateY(-50%)', display: 'flex', alignItems: 'center', zIndex: 1,
    },
    input: {
        width: '100%', boxSizing: 'border-box',
        padding: '18px 18px 18px 52px',
        borderRadius: '14px', border: '1px solid #d1d5db',
        backgroundColor: '#ffffff', fontSize: '16px', outline: 'none', color: '#333',
    },

    btnSubmit: {
        backgroundColor: '#ff5a00', color: 'white', width: '100%',
        padding: '18px', borderRadius: '14px', border: 'none',
        fontSize: '18px', fontWeight: 'bold', cursor: 'pointer',
        marginTop: '10px', boxShadow: '0 6px 20px rgba(255, 90, 0, 0.25)',
    },

    dividerContainer: { display: 'flex', alignItems: 'center', margin: '35px 0 25px 0' },
    line: { flex: 1, height: '1px', backgroundColor: '#e5e7eb' },
    dividerText: { margin: '0 15px', color: '#6b7280', fontSize: '14px', fontWeight: '500' },

    registerLinkContainer: { display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' },
    registerText: { color: '#168a32', fontWeight: '800', fontSize: '20px' },
};

export default Login;