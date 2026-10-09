import { useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import videoSplash from '../assets/intro.mp4';

function Splash() {
    const navigate = useNavigate();
    const videoRef = useRef(null);

    useEffect(() => {
        const video = videoRef.current;
        video.onended = () => navigate('/index');
    }, [navigate]);

    return (
    <div style={{
    width: '100vw',
    height: '100vh',
    background: 'white',  // 👈
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden'
}}>
        <video
            ref={videoRef}
            src={videoSplash}
            autoPlay
            muted
            playsInline
            style={{
                width: '100%',
                height: '100%',
                objectFit: 'contain'
            }}
        />
    </div>
);
}

export default Splash;