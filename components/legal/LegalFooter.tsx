import Link from 'next/link';
import { getLegalLanguage, getLegalShell } from '@/lib/legal-i18n';
import { localizedLegalPath } from '@/lib/seo';

export default async function LegalFooter({ bankName }: { bankName: string }) {
  const supportEmail =
    process.env.NEXT_PUBLIC_SUPPORT_EMAIL ?? 'support@monalyz.com';
  const language = await getLegalLanguage();
  const copy = getLegalShell(language);
  const legalLinks = [
    { href: localizedLegalPath(language, 'notices'), label: copy.links.notices },
    { href: localizedLegalPath(language, 'privacy'), label: copy.links.privacy },
    { href: localizedLegalPath(language, 'terms'), label: copy.links.terms },
    { href: localizedLegalPath(language, 'cookies'), label: copy.links.cookies },
  ] as const;

  return (
    <footer lang={language} className="border-t border-slate-800 bg-slate-950 px-4 py-6 text-slate-300">
      <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-4 text-center text-xs sm:flex-row sm:text-left">
        <p>© {new Date().getUTCFullYear()} {bankName}. {copy.footerRights}</p>
        <nav aria-label={copy.footerAria} className="flex flex-wrap items-center justify-center gap-x-5 gap-y-3">
          {legalLinks.map((link) => (
            <Link key={link.href} href={link.href} className="rounded-sm hover:text-white hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950">
              {link.label}
            </Link>
          ))}
          <a href={`mailto:${supportEmail}`} className="rounded-sm hover:text-white hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950">
            {copy.links.contact}
          </a>
        </nav>
      </div>
    </footer>
  );
}
