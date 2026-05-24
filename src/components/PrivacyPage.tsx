export default function PrivacyPage() {
  return (
    <div
      className="flex-1 overflow-y-auto"
      style={{ background: 'var(--color-base)', color: 'var(--color-text)', padding: '40px' }}
    >
      <div style={{ maxWidth: '800px', margin: '0 auto' }}>
        <h1 style={{ fontSize: '2rem', fontWeight: 700, marginBottom: '24px' }}>Privacy</h1>
        <p style={{ marginBottom: '20px', lineHeight: 1.6, color: 'var(--color-text-muted)' }}>
          The Data Modeling Lab runs entirely in your browser. No account, no backend, no telemetry of your editor content.
        </p>
        <p style={{ marginBottom: '20px', lineHeight: 1.6, color: 'var(--color-text-muted)' }}>
          What we do collect: anonymous, privacy-respecting page-view analytics via{' '}
          <a href="https://plausible.io/data-policy" target="_blank" rel="noopener noreferrer" style={{ color: 'var(--color-accent-orange)' }}>
            Plausible
          </a>
          . No cookies, no fingerprinting, no personal data leaves your machine.
        </p>
        <p style={{ marginBottom: '20px', lineHeight: 1.6, color: 'var(--color-text-muted)' }}>
          Lesson progress, your theme choice, and the contents of your SQL editor are stored locally in your browser via
          {' '}<code>localStorage</code>. Clearing your browser data wipes them — they never leave your device.
        </p>
        <p style={{ lineHeight: 1.6, color: 'var(--color-text-muted)' }}>
          Contact: <a href="mailto:info@datagym.io" style={{ color: 'var(--color-accent-orange)' }}>info@datagym.io</a>.
        </p>
      </div>
    </div>
  )
}
