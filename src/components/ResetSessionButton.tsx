import React from 'react';

const ResetSessionButton = () => {
  if (!import.meta.env.DEV) return null; // show only in dev

  const handleReset = () => {
    localStorage.clear();
    location.reload();
  };

  return (
    <button
      onClick={handleReset}
      style={{
        position: 'fixed',
        bottom: 16,
        right: 16,
        padding: '8px 12px',
        background: 'crimson',
        color: 'white',
        borderRadius: '4px',
        zIndex: 1000,
        cursor: 'pointer',
      }}
      title="Reset session and reload app"
    >
      🔄 Reset Session
    </button>
  );
};

export default ResetSessionButton;