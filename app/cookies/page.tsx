import type { Metadata } from 'next';
import LegalPageShell from '@/components/legal/LegalPageShell';
import { getRequestBrandSettings } from '@/lib/server/branding';

export const metadata: Metadata = {
  title: 'Politique relative aux cookies',
  description: 'Informations sur les cookies et stockages utilisés par le service.',
};

export default async function CookiesPage() {
  const supportEmail =
    process.env.NEXT_PUBLIC_SUPPORT_EMAIL ?? 'support@monalyz.com';
  const { bankName } = await getRequestBrandSettings();

  return (
    <LegalPageShell
      title="Politique relative aux cookies"
      introduction={`Cette page présente les cookies, stockages locaux et services tiers susceptibles d’être utilisés pendant votre navigation sur ${bankName}.`}
    >
      <section>
        <h2>Stockages strictement nécessaires</h2>
        <p className="mt-3">
          {bankName} utilise des cookies ou stockages indispensables pour maintenir une session sécurisée, appliquer les protections d’authentification, mémoriser la langue choisie et conserver certaines préférences d’affichage sur l’appareil. Leur désactivation peut empêcher la connexion ou dégrader le fonctionnement du service.
        </p>
      </section>

      <section>
        <h2>Support en ligne et services tiers</h2>
        <p className="mt-3">
          Dans l’espace authentifié, le module de support Tawk.to peut déposer ou lire ses propres cookies afin d’assurer la continuité d’une conversation et la sécurité du chat. Netlify et Supabase peuvent également traiter des identifiants techniques nécessaires à l’hébergement, à la sécurité et à la session. {bankName} n’intègre aucun traceur publicitaire dans son code applicatif.
        </p>
      </section>

      <section>
        <h2>Durée et maîtrise</h2>
        <p className="mt-3">
          La durée varie selon la finalité, la session et le prestataire. Vous pouvez supprimer les données du site depuis les réglages de votre navigateur, refuser les notifications ou bloquer les cookies tiers. Le blocage des stockages essentiels peut interrompre votre session ; le support reste joignable par e-mail.
        </p>
      </section>

      <section>
        <h2>Contact</h2>
        <p className="mt-3">
          Pour obtenir des précisions ou exercer un droit relatif aux données associées à ces technologies, contactez{' '}
          <a href={`mailto:${supportEmail}`}>{supportEmail}</a>.
        </p>
      </section>
    </LegalPageShell>
  );
}
