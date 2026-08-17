import type { Metadata } from 'next';
import LegalPageShell from '@/components/legal/LegalPageShell';
import { getRequestBrandSettings } from '@/lib/server/branding';

export const metadata: Metadata = {
  title: 'Conditions d’utilisation',
  description: 'Conditions applicables à l’utilisation du service.',
};

export default async function TermsPage() {
  const supportEmail =
    process.env.NEXT_PUBLIC_SUPPORT_EMAIL ?? 'support@monalyz.com';
  const { bankName } = await getRequestBrandSettings();

  return (
    <LegalPageShell
      title="Conditions générales d’utilisation"
      introduction={`Ces conditions encadrent l’accès et l’utilisation de ${bankName}. En utilisant le service, vous vous engagez à les respecter.`}
    >
      <section>
        <h2>Objet du service</h2>
        <p className="mt-3">
          {bankName} permet à un établissement et à ses utilisateurs autorisés de déclarer, contrôler et suivre des informations d’identité, des positions, des opérations, des demandes et des documents. Le service ne se connecte pas à une infrastructure bancaire tierce et n’exécute pas automatiquement de virement, de prêt ou de mouvement de fonds.
        </p>
      </section>

      <section>
        <h2>Accès et éligibilité</h2>
        <p className="mt-3">
          L’accès est réservé aux personnes autorisées par l’établissement exploitant. Le parcours de vérification d’identité est destiné aux personnes majeures. Vous devez fournir des informations exactes, actuelles et vous concernant, puis protéger vos identifiants et votre appareil contre tout usage non autorisé.
        </p>
      </section>

      <section>
        <h2>Vérification d’identité</h2>
        <p className="mt-3">
          Vous pouvez prendre votre selfie directement avec la caméra ou choisir une photo dans votre galerie. Vous garantissez disposer des droits nécessaires sur les fichiers transmis. Les pièces et le selfie sont contrôlés manuellement ; leur dépôt ne vaut ni acceptation automatique, ni ouverture immédiate d’un service financier.
        </p>
      </section>

      <section>
        <h2>Opérations et documents</h2>
        <p className="mt-3">
          Les soldes, IBAN, virements, prêts et documents affichés reflètent les informations déclarées ou validées par le personnel habilité dans {bankName}. Toute exécution financière réelle intervient dans les procédures externes de l’établissement. Vous devez vérifier les informations avant toute décision et signaler sans délai une anomalie.
        </p>
      </section>

      <section>
        <h2>Usages interdits</h2>
        <ul className="mt-3">
          <li>usurper une identité, transmettre un document falsifié ou accéder au compte d’un tiers ;</li>
          <li>contourner les contrôles d’accès, perturber le service ou rechercher une vulnérabilité sans autorisation ;</li>
          <li>utiliser {bankName} à des fins frauduleuses, illicites ou portant atteinte aux droits d’autrui ;</li>
          <li>extraire, copier ou diffuser des données ou documents sans habilitation.</li>
        </ul>
      </section>

      <section>
        <h2>Disponibilité et responsabilité</h2>
        <p className="mt-3">
          Des interruptions peuvent être nécessaires pour la maintenance, la sécurité ou en cas d’incident chez un prestataire. {bankName} met en œuvre des mesures raisonnables de fiabilité, mais ne garantit pas une disponibilité sans interruption. Aucune disposition de ces conditions ne limite une responsabilité qui ne pourrait l’être selon la loi applicable.
        </p>
      </section>

      <section>
        <h2>Suspension et suppression</h2>
        <p className="mt-3">
          Un accès peut être suspendu en cas de risque de sécurité, d’usage interdit, d’exigence légale ou de fin d’habilitation. Une suppression de compte est soumise aux contrôles d’intégrité et aux obligations de conservation applicables aux informations enregistrées.
        </p>
      </section>

      <section>
        <h2>Évolution et contact</h2>
        <p className="mt-3">
          Ces conditions peuvent évoluer pour refléter le service, la sécurité ou les règles applicables. La date de mise à jour figure en tête de page. Pour toute question ou contestation, contactez{' '}
          <a href={`mailto:${supportEmail}`}>{supportEmail}</a> afin de rechercher une solution amiable avant toute autre démarche disponible.
        </p>
      </section>
    </LegalPageShell>
  );
}
