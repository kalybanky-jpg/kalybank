import Link from 'next/link';

const legalLinks = [
  { href: '/mentions-legales', label: 'Mentions légales' },
  { href: '/confidentialite', label: 'Confidentialité' },
  { href: '/conditions-utilisation', label: 'Conditions d’utilisation' },
  { href: '/cookies', label: 'Cookies' },
] as const;

export default function LegalFooter({ bankName }: { bankName: string }) {
  const supportEmail =
    process.env.NEXT_PUBLIC_SUPPORT_EMAIL ?? 'support@monalyz.com';

  return (
    <footer lang="fr" className="border-t border-slate-800 bg-slate-950 px-4 py-6 text-slate-300">
      <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-4 text-center text-xs sm:flex-row sm:text-left">
        <p>© {new Date().getUTCFullYear()} {bankName}. Tous droits réservés.</p>
        <nav aria-label="Informations légales" className="flex flex-wrap items-center justify-center gap-x-5 gap-y-3">
          {legalLinks.map((link) => (
            <Link key={link.href} href={link.href} className="rounded-sm hover:text-white hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950">
              {link.label}
            </Link>
          ))}
          <a href={`mailto:${supportEmail}`} className="rounded-sm hover:text-white hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950">
            Contact
          </a>
        </nav>
      </div>
    </footer>
  );
}
