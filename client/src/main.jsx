import React, { Component } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.jsx';
import { LanguageProvider } from './translations.js';
import './style.css';

class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error('MediConnect App caught error:', error, errorInfo);
  }

  handleReset = () => {
    try {
      localStorage.clear();
      sessionStorage.clear();
    } catch (e) {}
    window.location.href = '/';
  };

  render() {
    if (this.state.hasError) {
      return (
        <div style={{
          minHeight: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: '#f8fafc',
          padding: 20,
          fontFamily: 'Inter, system-ui, sans-serif'
        }}>
          <div style={{
            maxWidth: 520,
            width: '100%',
            background: '#ffffff',
            borderRadius: 16,
            padding: 32,
            boxShadow: '0 10px 30px rgba(0,0,0,0.08)',
            border: '1px solid #e2e8f0',
            textAlign: 'center'
          }}>
            <div style={{
              width: 56,
              height: 56,
              background: '#fee2e2',
              color: '#dc2626',
              borderRadius: '50%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              margin: '0 auto 16px auto',
              fontSize: 28
            }}>
              ⚠️
            </div>
            <h2 style={{ fontSize: '1.4rem', fontWeight: 800, color: '#0f172a', margin: '0 0 8px 0' }}>
              Application Recovery
            </h2>
            <p style={{ color: '#64748b', fontSize: '0.92rem', margin: '0 0 20px 0', lineHeight: 1.5 }}>
              MediConnect AI encountered an unexpected interface issue. You can safely reload the view or reset your session below.
            </p>
            {this.state.error?.message && (
              <div style={{
                background: '#f1f5f9',
                padding: '10px 14px',
                borderRadius: 8,
                fontSize: '0.82rem',
                color: '#475569',
                fontFamily: 'monospace',
                marginBottom: 20,
                textAlign: 'left',
                overflowX: 'auto'
              }}>
                {this.state.error.message}
              </div>
            )}
            <div style={{ display: 'flex', gap: 10, justifyContent: 'center' }}>
              <button
                type="button"
                onClick={() => window.location.reload()}
                style={{
                  background: '#2563eb',
                  color: '#ffffff',
                  border: 'none',
                  borderRadius: 8,
                  padding: '10px 18px',
                  fontWeight: 700,
                  fontSize: '0.9rem',
                  cursor: 'pointer'
                }}
              >
                Reload Page
              </button>
              <button
                type="button"
                onClick={this.handleReset}
                style={{
                  background: '#f1f5f9',
                  color: '#475569',
                  border: '1px solid #cbd5e1',
                  borderRadius: 8,
                  padding: '10px 18px',
                  fontWeight: 700,
                  fontSize: '0.9rem',
                  cursor: 'pointer'
                }}
              >
                Reset Session & Sign In
              </button>
            </div>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

createRoot(document.getElementById('root')).render(
  <ErrorBoundary>
    <LanguageProvider>
      <App />
    </LanguageProvider>
  </ErrorBoundary>
);
