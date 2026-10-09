export function Toast({ toasts, removeToast }) {
    return (
        <div style={{
            position: 'fixed', top: '20px', left: '50%',
            transform: 'translateX(-50%)', zIndex: 9999,
            display: 'flex', flexDirection: 'column', gap: '10px',
            width: '92%', maxWidth: '420px'
        }}>
            {toasts.map(t => {
                const isSuccess = t.type === 'success';
                const isError   = t.type === 'error';
                const color     = isSuccess ? '#22c55e' : isError ? '#ef4444' : '#f59e0b';
                const textColor = isSuccess ? '#16a34a' : isError ? '#dc2626' : '#d97706';
                const icon      = isSuccess ? '✅' : isError ? '❌' : '⚠️';
                const titulo    = isSuccess ? '¡Éxito!' : isError ? '¡Error!' : 'Aviso';

                return (
                    <div key={t.id} style={{
                        background: 'white', border: `2px solid ${color}`,
                        borderRadius: '18px', padding: '14px 16px',
                        display: 'flex', alignItems: 'center', gap: '12px',
                        boxShadow: '0 8px 28px rgba(0,0,0,0.13)',
                        animation: 'slideIn 0.25s ease', position: 'relative',
                    }}>
                        <div style={{
                            width: '38px', height: '38px', background: color,
                            borderRadius: '10px', display: 'flex', alignItems: 'center',
                            justifyContent: 'center', fontSize: '20px', flexShrink: 0
                        }}>{icon}</div>

                        <div style={{ flex: 1 }}>
                            <p style={{ fontWeight: 700, fontSize: '14px', color: textColor, margin: '0 0 2px' }}>
                                {titulo}
                            </p>
                            <p style={{ fontSize: '13px', color: '#555', margin: 0, lineHeight: 1.4 }}>
                                {t.message}
                            </p>
                        </div>

                        <button onClick={() => removeToast(t.id)} style={{
                            position: 'absolute', top: '8px', right: '10px',
                            width: '22px', height: '22px', background: color,
                            border: 'none', borderRadius: '50%', cursor: 'pointer',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            padding: 0, fontSize: '13px', color: 'white', fontWeight: 'bold',
                        }}>✕</button>
                    </div>
                );
            })}
            <style>{`@keyframes slideIn { from { opacity:0; transform: translateY(-12px); } to { opacity:1; transform: translateY(0); } }`}</style>
        </div>
    );
}