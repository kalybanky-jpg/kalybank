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
        <h2>Édition et publication</h2>
        <p className="mt-3">
          Le présent service numérique est publié sous la marque {bankName}. Le responsable de publication est l’équipe {bankName}, joignable à l’adresse{' '}
          <a href={`mailto:${supportEmail}`}>{supportEmail}</a>.
        </p>
        <p className="mt-3">
          Aucune forme juridique, adresse de siège ou donnée d’immatriculation distincte n’étant déclarée dans la configuration publique du service, aucune information de cette nature n’est inventée sur cette page. Toute demande d’identification administrative complémentaire peut être adressée au point de contact ci-dessus.
        </p>
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
