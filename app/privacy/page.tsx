import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Privacy Policy — Agency Group',
  description:
    'Privacy Policy for Agency Group (AMI 22506). How we collect, use, and protect your personal data in compliance with GDPR.',
  robots: { index: false, follow: true },
  alternates: { canonical: 'https://www.agencygroup.pt/privacy' },
}

export default function PrivacyPage() {
  return (
    <main className="mx-auto max-w-3xl px-6 py-16 text-gray-800 dark:text-gray-200">
      <h1 className="mb-2 text-3xl font-bold tracking-tight">Privacy Policy</h1>
      <p className="mb-10 text-sm text-gray-500 dark:text-gray-400">
        Last updated: 6 April 2026
      </p>

      <section className="mb-8">
        <h2 className="mb-3 text-xl font-semibold">1. Controller</h2>
        <p>
          Agency Group — Real Estate, Lda. (AMI 22506), headquartered in Portugal, is the data
          controller responsible for your personal data processed via{' '}
          <a
            href="https://www.agencygroup.pt"
            className="text-blue-600 underline dark:text-blue-400"
          >
            www.agencygroup.pt
          </a>{' '}
          and related services, including our ChatGPT GPT Actions API.
        </p>
        <p className="mt-2">
          Contact:{' '}
          <a
            href="mailto:geral@agencygroup.pt"
            className="text-blue-600 underline dark:text-blue-400"
          >
            geral@agencygroup.pt
          </a>{' '}
          | +351 919 948 986
        </p>
      </section>

      <section className="mb-8">
        <h2 className="mb-3 text-xl font-semibold">2. Data We Collect</h2>
        <ul className="list-disc space-y-1 pl-5">
          <li>
            <strong>API requests:</strong> query parameters sent to our GPT Actions endpoints
            (zone, property type, price range). No personal identifiers are required.
          </li>
          <li>
            <strong>Contact enquiries:</strong> name, email, phone number, and message when you
            contact us via the website or portal.
          </li>
          <li>
            <strong>Portal accounts:</strong> email address, authentication tokens, and activity
            logs when you register on our portal.
          </li>
          <li>
            <strong>Cookies &amp; analytics:</strong> anonymised usage data via first-party
            analytics to improve our services.
          </li>
        </ul>
      </section>

      <section className="mb-8">
        <h2 className="mb-3 text-xl font-semibold">3. Purpose and Legal Basis</h2>
        <ul className="list-disc space-y-1 pl-5">
          <li>
            <strong>Service delivery</strong> (contract performance, Art. 6(1)(b) GDPR): providing
            property search results, market data, and valuations.
          </li>
          <li>
            <strong>Legitimate interests</strong> (Art. 6(1)(f) GDPR): improving our API,
            preventing abuse, and aggregated analytics.
          </li>
          <li>
            <strong>Consent</strong> (Art. 6(1)(a) GDPR): marketing communications, when
            explicitly opted in.
          </li>
          <li>
            <strong>Legal obligations</strong> (Art. 6(1)(c) GDPR): compliance with Portuguese
            real estate regulations (AMI framework) and GDPR.
          </li>
        </ul>
      </section>

      <section className="mb-8">
        <h2 className="mb-3 text-xl font-semibold">4. GPT Actions API</h2>
        <p>
          Our API endpoints (<code>/api/gpt/properties</code>, <code>/api/gpt/market</code>,{' '}
          <code>/api/gpt/avm</code>, <code>/api/gpt/nhr</code>) are publicly accessible and
          designed to return anonymised real estate data. We do not collect or store personal data
          through these endpoints. Query parameters (zone, price range, etc.) are processed in
          memory only and are not persisted.
        </p>
      </section>

      <section className="mb-8">
        <h2 className="mb-3 text-xl font-semibold">5. Data Sharing</h2>
        <p>We do not sell your personal data. We may share data with:</p>
        <ul className="mt-2 list-disc space-y-1 pl-5">
          <li>
            <strong>Service providers:</strong> Supabase (database, EU region), Vercel (hosting,
            EU region), Resend (transactional email), Sentry (error monitoring) — all bound by
            data processing agreements.
          </li>
          <li>
            <strong>Legal authorities:</strong> when required by Portuguese or EU law.
          </li>
        </ul>
      </section>

      <section className="mb-8">
        <h2 className="mb-3 text-xl font-semibold">6. Retention</h2>
        <p>
          Contact and enquiry data is retained for 3 years after last interaction or until you
          request deletion. Portal account data is retained while the account is active plus
          1 year. API request logs (server-level) are retained for 30 days.
        </p>
      </section>

      <section className="mb-8">
        <h2 className="mb-3 text-xl font-semibold">7. Your Rights (GDPR)</h2>
        <p>You have the right to:</p>
        <ul className="mt-2 list-disc space-y-1 pl-5">
          <li>Access, rectify, or erase your personal data</li>
          <li>Restrict or object to processing</li>
          <li>Data portability</li>
          <li>Withdraw consent at any time (without affecting prior lawful processing)</li>
          <li>
            Lodge a complaint with the Portuguese supervisory authority:{' '}
            <a
              href="https://www.cnpd.pt"
              className="text-blue-600 underline dark:text-blue-400"
              target="_blank"
              rel="noopener noreferrer"
            >
              CNPD — Comissão Nacional de Proteção de Dados
            </a>
          </li>
        </ul>
        <p className="mt-3">
          To exercise any right, email{' '}
          <a
            href="mailto:geral@agencygroup.pt"
            className="text-blue-600 underline dark:text-blue-400"
          >
            geral@agencygroup.pt
          </a>
          . We will respond within 30 days.
        </p>
      </section>

      <section className="mb-8">
        <h2 className="mb-3 text-xl font-semibold">8. Security</h2>
        <p>
          We implement industry-standard security measures including HTTPS/TLS encryption,
          access controls, and regular security audits. No transmission over the internet is
          100% secure; we cannot guarantee absolute security but take all reasonable precautions.
        </p>
      </section>

      <section className="mb-8">
        <h2 className="mb-3 text-xl font-semibold">9. Cookies</h2>
        <p>
          We use essential cookies for site functionality and optional analytics cookies to
          improve our services. You may manage cookie preferences via your browser settings.
          No third-party advertising cookies are used.
        </p>
      </section>

      <section>
        <h2 className="mb-3 text-xl font-semibold">10. Changes to This Policy</h2>
        <p>
          We may update this Privacy Policy periodically. Material changes will be notified via
          email (to registered users) or via a notice on our website. Continued use of our
          services after changes constitutes acceptance of the updated policy.
        </p>
      </section>
    </main>
  )
}
