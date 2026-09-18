import { useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '../lib/supabaseClient';

export default function OlvideClave() {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [enviado, setEnviado] = useState(false);
  const [error, setError] = useState('');

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const { error: resetError } = await supabase.auth.resetPasswordForEmail(email.trim(), {
        redirectTo: `${window.location.origin}/restablecer-clave`,
      });
      if (resetError) throw resetError;
      setEnviado(true);
    } catch (err) {
      setError(err.message ?? String(err));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
      <div className="card" style={{ maxWidth: 380, width: '100%' }}>
        <div style={{ textAlign: 'center', marginBottom: 24 }}>
          <div style={{ fontSize: 28, marginBottom: 8 }}>✂️</div>
          <h1 style={{ fontSize: 20 }}>MiPeluquería</h1>
          <p className="hint">Recuperar contraseña</p>
        </div>

        {enviado ? (
          <div className="stack-gap">
            <p>
              Si <strong>{email}</strong> está registrado, te mandamos un email con un link para elegir una
              contraseña nueva.
            </p>
            <Link to="/login" className="btn btn-secondary" style={{ textAlign: 'center' }}>
              Volver al login
            </Link>
          </div>
        ) : (
          <form className="stack-gap" onSubmit={handleSubmit}>
            <div className="field">
              <label>Email</label>
              <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required autoFocus />
            </div>
            {error && <p style={{ color: 'var(--red)', fontSize: 13 }}>{error}</p>}
            <button type="submit" className="btn btn-primary" disabled={loading}>
              {loading ? 'Enviando…' : 'Enviar link de recuperación'}
            </button>
            <Link to="/login" className="hint" style={{ textAlign: 'center' }}>
              Volver al login
            </Link>
          </form>
        )}
      </div>
    </div>
  );
}
