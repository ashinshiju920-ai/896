import React from 'react';

export default function CashfreeCheckout() {
  const paymentUrl = "https://payments.cashfree.com/forms/study-portal-buy";
  
  // High-resolution dynamic QR code pointing directly to your Cashfree form
  const qrCodeUrl = `https://api.qrserver.com/v1/create-qr-code/?size=240x240&data=${encodeURIComponent(paymentUrl)}`;

  return (
    <div style={styles.container}>
      <div style={styles.card}>
        <h2 style={styles.heading}>Study Materials Instant Access</h2>
        <p style={styles.subtitle}>Form ID: <code>314009172</code> | Code: <code>study-portal-buy</code></p>

        {/* QR Code Section */}
        <div style={styles.qrWrapper}>
          <p style={styles.qrTitle}>Scan to Pay via UPI / PhonePe / GPay</p>
          <img 
            src={qrCodeUrl} 
            alt="Cashfree Payment QR Code" 
            style={styles.qrImage} 
          />
          <span style={styles.qrSub}>Scan with any UPI app on your mobile</span>
        </div>

        <div style={styles.divider}>
          <span style={styles.dividerText}>OR</span>
        </div>

        {/* Direct Payment Link / Button */}
        <a 
          href={paymentUrl} 
          target="_blank" 
          rel="noopener noreferrer"
          style={styles.payButton}
        >
          Proceed to Pay Online
        </a>

        {/* Embedded Iframe Form */}
        <div style={styles.iframeSection}>
          <h3 style={styles.iframeTitle}>Pay Directly Below</h3>
          <iframe
            src={paymentUrl}
            title="Cashfree Payment Form"
            style={styles.iframe}
            allow="payment"
          />
        </div>
      </div>
    </div>
  );
}

const styles = {
  container: {
    display: 'flex',
    justifyContent: 'center',
    padding: '2rem 1rem',
    backgroundColor: '#f8fafc',
    minHeight: '100vh',
    fontFamily: 'system-ui, -apple-system, sans-serif',
  },
  card: {
    background: '#ffffff',
    padding: '2rem',
    borderRadius: '16px',
    boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.08)',
    maxWidth: '680px',
    width: '100%',
    textAlign: 'center',
  },
  heading: {
    fontSize: '1.5rem',
    fontWeight: '700',
    color: '#0f172a',
    margin: '0 0 0.25rem',
  },
  subtitle: {
    color: '#64748b',
    fontSize: '0.875rem',
    margin: '0 0 1.5rem',
  },
  qrWrapper: {
    display: 'inline-block',
    padding: '1.25rem',
    backgroundColor: '#f1f5f9',
    borderRadius: '12px',
    margin: '0 auto 1.5rem',
  },
  qrTitle: {
    fontSize: '0.9rem',
    fontWeight: '600',
    color: '#334155',
    margin: '0 0 0.75rem',
  },
  qrImage: {
    width: '200px',
    height: '200px',
    borderRadius: '8px',
    border: '4px solid #ffffff',
  },
  qrSub: {
    display: 'block',
    fontSize: '0.75rem',
    color: '#64748b',
    marginTop: '0.5rem',
  },
  divider: {
    position: 'relative',
    margin: '1.5rem 0',
    borderBottom: '1px solid #e2e8f0',
  },
  dividerText: {
    position: 'absolute',
    top: '-10px',
    left: '50%',
    transform: 'translateX(-50%)',
    background: '#ffffff',
    padding: '0 12px',
    color: '#94a3b8',
    fontSize: '0.8rem',
    fontWeight: '600',
  },
  payButton: {
    display: 'inline-block',
    width: '100%',
    boxSizing: 'border-box',
    padding: '0.875rem 1.5rem',
    backgroundColor: '#6366f1',
    color: '#ffffff',
    textDecoration: 'none',
    fontWeight: '600',
    borderRadius: '8px',
    fontSize: '1rem',
    transition: 'background-color 0.2s',
  },
  iframeSection: {
    marginTop: '2rem',
    textAlign: 'left',
  },
  iframeTitle: {
    fontSize: '1.1rem',
    fontWeight: '600',
    color: '#1e293b',
    marginBottom: '0.75rem',
  },
  iframe: {
    width: '100%',
    height: '700px',
    border: '1px solid #e2e8f0',
    borderRadius: '12px',
  },
};
