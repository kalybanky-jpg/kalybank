import Link from 'next/link';
import type { ReactNode } from 'react';
import BrandLogo from '@/components/brand/BrandLogo';

export const LEGAL_LAST_UPDATED = '17 août 2026';

interface LegalPageShellProps {
  title: string;
  introduction: string;
  children: ReactNode;
}

export default function LegalPageShell({
  title,
  introduction,
  children,
}: LegalPageShellProps) {
  return (
    <main lang="fr" className="min-h-screen bg-slate-100 px-4 py-8 text-slate-800 sm:px-6 sm:py-12">
      <div className="mx-auto max-w-4xl">
        <header className="mb-8 flex flex-col gap-5 rounded-3xl border border-slate-200 bg-white p-6 shadow-sm sm:flex-row sm:items-center sm:justify-between sm:p-8">
          <Link href="/login" aria-label="Retour à la connexion" className="w-fit rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-4">
            <BrandLogo priority className="h-auto w-[180px]" />
          </Link>
          <Link href="/login" className="w-fit rounded-xl border border-slate-300 px-4 py-2 text-sm font-bold text-slate-700 transition hover:border-blue-300 hover:text-blue-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-2">
            Retour à la connexion
          </Link>
        </header>

        <article className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm sm:p-10">
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-blue-700">
            Informations légales
          </p>
          <h1 className="mt-3 text-3xl font-black tracking-tight text-slate-950 sm:text-4xl">
            {title}
          </h1>
          <p className="mt-4 text-base leading-7 text-slate-600">{introduction}</p>
          <p className="mt-3 text-xs text-slate-500">Dernière mise à jour : {LEGAL_LAST_UPDATED}</p>
          <div className="mt-10 space-y-9 [&_a]:font-semibold [&_a]:text-blue-700 [&_a]:underline [&_a]:underline-offset-2 [&_h2]:text-xl [&_h2]:font-extrabold [&_h2]:text-slate-950 [&_li]:leading-7 [&_p]:leading-7 [&_ul]:list-disc [&_ul]:space-y-2 [&_ul]:pl-6">
            {children}
          </div>
        </article>
      </div>
    </main>
  );
}
