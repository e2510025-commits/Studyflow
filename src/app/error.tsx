'use client';

import { useEffect } from 'react';

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('Application error:', error);
  }, [error]);

  return (
    <div style={{ padding: '2rem', maxWidth: '800px', margin: '0 auto' }}>
      <h2 style={{ color: '#ef4444', marginBottom: '1rem' }}>エラーが発生しました</h2>
      <pre style={{ 
        background: '#1f2937', 
        color: '#f3f4f6', 
        padding: '1rem', 
        borderRadius: '0.5rem',
        overflow: 'auto',
        fontSize: '0.875rem'
      }}>
        {error.message}
        {'\n\n'}
        {error.stack}
      </pre>
      <button
        onClick={reset}
        style={{
          marginTop: '1rem',
          padding: '0.5rem 1rem',
          background: '#3b82f6',
          color: 'white',
          border: 'none',
          borderRadius: '0.375rem',
          cursor: 'pointer'
        }}
      >
        再試行
      </button>
    </div>
  );
}
