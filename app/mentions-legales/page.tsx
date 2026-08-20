import type { Metadata } from 'next';
import LegalPageShell from '@/components/legal/LegalPageShell';
import { getRequestBrandSettings } from '@/lib/server/branding';

export const metadata: Metadata = {
  title: 'Mentions légales',
  description: 'Informations relatives à l’édition et à l’hébergement du service.',
};

export default async function LegalNoticePage() {
  const supportEmail =
    process.env.NEXT_PUBLIC_SUPPORT_EMAIL ?? 'support@monalyz.com';
  const { bankName } = await getRequestBrandSettings();

  return (
    <LegalPageShell
      title="Mentions légales"
      introduction={`Cette page identifie le service ${bankName}, son point de contact et son prestataire d’hébergement.`}
    >
      <section>
        <h2>Éditeur du service</h2>
        <p className="mt-3">
          Le présent service numérique est édité par <strong>2 C FINANCE</strong>, sous le nom commercial <strong>MONALYZ</strong>. Le responsable de publication est joignable à l’adresse{' '}
          <a href={`mailto:${supportEmail}`}>{supportEmail}</a>.
        </p>
        <dl className="mt-4 grid gap-3 rounded-2xl border border-slate-200 bg-slate-50 p-4 sm:grid-cols-[minmax(0,1fr)_minmax(0,2fr)]">
          <dt className="font-semibold text-slate-500">Dénomination</dt>
          <dd>2 C FINANCE</dd>
          <dt className="font-semibold text-slate-500">Nom commercial</dt>
          <dd>MONALYZ</dd>
          <dt className="font-semibold text-slate-500">SIREN</dt>
          <dd>979 247 145</dd>
          <dt className="font-semibold text-slate-500">SIRET du siège social</dt>
          <dd>979 247 145 00019</dd>
          <dt className="font-semibold text-slate-500">Forme juridique</dt>
          <dd>SAS, société par actions simplifiée</dd>
          <dt className="font-semibold text-slate-500">Adresse postale</dt>
          <dd>20 BOULEVARD MONTMARTRE, 75009 PARIS</dd>
        </dl>
      </section>

      <section>
        <h2>Hébergement</h2>
        <p className="mt-3">
          Le site est hébergé par Netlify, Inc., 101 2nd Street, San Francisco, CA 94105, États-Unis. Le domaine de production est{' '}
          <a href="https://bank.monalyz.com">bank.monalyz.com</a>.
        </p>
      </section>

      <section>
        <h2>Nature du service</h2>
        <p className="mt-3">
          {bankName} est un registre numérique utilisé pour déclarer et suivre des informations de comptes, des dossiers d’identité, des intentions de virement, des prêts et des documents. Le service n’est relié à aucune API bancaire tierce et ne déclenche aucun mouvement financier automatique. Les contrôles et exécutions externes relèvent du personnel habilité de l’établissement exploitant.
        </p>
      </section>

      <section>
        <h2>Propriété intellectuelle</h2>
        <p className="mt-3">
          La structure, les textes, les éléments graphiques, les logiciels et les signes distinctifs du service sont protégés par les règles applicables à la propriété intellectuelle. Toute reproduction ou réutilisation non autorisée est interdite, sous réserve des exceptions prévues par la loi.
        </p>
      </section>

      <section>
        <h2>Signalement et contact</h2>
        <p className="mt-3">
          Pour signaler un contenu, une vulnérabilité, une erreur ou une utilisation illicite du service, écrivez à{' '}
          <a href={`mailto:${supportEmail}`}>{supportEmail}</a> en décrivant précisément la page et les faits concernés.
        </p>
      </section>
    </LegalPageShell>
  );
}
