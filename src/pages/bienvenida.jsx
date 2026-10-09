import { useNavigate } from 'react-router-dom';
import logo from '../assets/logo.png'; // Asegúrate de que la ruta y el nombre sean correctos
import fondo from '../assets/fondo.png'; // Tu imagen de vegetales de fondo

function Welcome() {
    const navigate = useNavigate();

    return (
        <div style={styles.container}>
            {/* Imagen de fondo */}
            <div style={{...styles.backgroundImage, backgroundImage: `url(${fondo})`}}></div>

            {/* Capa oscura opcional para que el centro resalte más */}
            <div style={styles.overlay}></div>

            {/* Contenedor central blanco con forma de gota/círculo */}
            <div style={styles.contentCard}>
                <img src={logo} alt="BiteX Logo" style={styles.logo} />



                <p style={styles.tagline}>"Alimenta el cambio"</p>

                <p style={styles.subtext}>
                    Juntos podemos<br /> combatir el hambre.
                </p>

                <button
                    style={styles.btnStart}
                    onClick={() => navigate('/index')} // O a donde quieras dirigir al usuario
                >
                    Comenzar
                </button>
            </div>
        </div>
    );
}

const styles = {
    container: {
        position: 'relative', // Para posicionar el fondo y el contenido
        width: '100%',
        height: '100vh',
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        overflow: 'hidden',
        fontFamily: "'Segoe UI', Roboto, sans-serif",
    },
    backgroundImage: {
        position: 'absolute', // Para que el fondo esté detrás del contenido
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundSize: 'cover',
        backgroundPosition: 'center',
        zIndex: 1,
    },
    overlay: {
        position: 'absolute', // Capa oscura para mejorar la legibilidad del texto
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(0,0,0,0.2)', // Oscurece un poco el fondo
        zIndex: 2, // Asegura que esté entre el fondo y el contenido
    },
    contentCard: {
        position: 'relative',
        zIndex: 3,
        backgroundColor: 'rgba(255, 255, 255, 0.9)', // Blanco con ligera transparencia
        width: '85%',
        maxWidth: '320px',
        padding: '40px 20px',
        borderRadius: '50% 50% 50% 50% / 40% 40% 60% 60%', // Forma ovalada orgánica
        textAlign: 'center',
        boxShadow: '0 10px 25px rgba(0,0,0,0.2)',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
    },
    logo: {
        width: '200px',
        height: 'auto',
        marginBottom: '10px', // Ajusta el tamaño del logo según sea necesario
    },
    brandName: {
        fontSize: '42px',
        margin: '0',
        color: '#333',
        fontWeight: 'bold',
    },
    tagline: { // "Alimenta el cambio"
        color: '#00c853',
        fontSize: '18px',
        fontWeight: '600',
        margin: '10px 0',
    },
    subtext: { // "Juntos podemos combatir el hambre"
        color: '#555',
        fontSize: '14px',
        lineHeight: '1.4',
        marginBottom: '30px',
    },
    btnStart: { // Botón de "Comenzar"
        backgroundColor: '#ef6c00', // Naranja del botón
        color: 'white',
        border: 'none',
        padding: '12px 50px',
        borderRadius: '25px',
        fontSize: '18px',
        fontWeight: 'bold',
        cursor: 'pointer',
        boxShadow: '0 4px 10px rgba(239, 108, 0, 0.3)',
        transition: 'transform 0.2s',
    }
};

export default Welcome;