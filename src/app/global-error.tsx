'use client';

export default function GlobalError({ reset }: { error: Error; reset: () => void }) {
  return (
    <html lang="en">
      <body style={{ fontFamily: 'system-ui, sans-serif', padding: '2rem' }}>
        <h1>Something went wrong</h1>
        <p>The application could not start. Please reload the page.</p>
        <button type="button" onClick={reset}>
          Reload
        </button>
      </body>
    </html>
  );
}
