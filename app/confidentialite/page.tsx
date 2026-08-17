import type { Metadata } from 'next';
import LegalPageShell from '@/components/legal/LegalPageShell';
import { getRequestBrandSettings } from '@/lib/server/branding';

export const metadata: Metadata = {
  title: 'Politique de confidentialité',
  description: 'Informations sur les données personnelles traitées par le service.',
};

export default async function PrivacyPage() {
  const supportEmail =
    process.env.NEXT_PUBLIC_SUPPORT_EMAIL ?? 'support@monalyz.com';
  const { bankName } = await getRequestBrandSettings();

  return (
    <LegalPageShell
      title="Politique de confidentialité"
      introduction={`Cette politique explique de façon synthétique les données utilisées par ${bankName}, leurs finalités et les moyens d’exercer vos droits.`}
    >
      <section>
        <h2>Responsable et contact</h2>
        <p className="mt-3">
          L’exploitant de l’instance {bankName} détermine les traitements nécessaires à la gestion des utilisateurs et des opérations enregistrées. Pour toute question ou demande relative à vos données, contactez{' '}
          <a href={`mailto:${supportEmail}`}>{supportEmail}</a>.
        </p>
      </section>

      <section>
        <h2>Données traitées</h2>
        <ul className="mt-3">
          <li>identité, coordonnées, langue, devise de référence et données d’authentification ;</li>
          <li>dossier de vérification d’identité : informations déclarées, pièce d’identité, justificatif de domicile et selfie pris avec la caméra ou choisi dans la galerie ;</li>
          <li>positions, écritures, intentions de virement, demandes de prêt et documents officiels enregistrés par le personnel habilité ;</li>
          <li>messages de support, abonnement facultatif aux notifications et préférences de l’appareil ;</li>
          <li>journaux techniques, événements de sécurité et traces d’audit nécessaires à l’intégrité du service.</li>
        </ul>
      </section>

      <section>
        <h2>Finalités et fondements</h2>
        <ul className="mt-3">
          <li>créer et sécuriser l’accès au compte, fournir le service demandé et assurer le support ;</li>
          <li>vérifier manuellement l’identité et satisfaire les obligations applicables à l’établissement exploitant ;</li>
          <li>tenir un registre fiable des opérations déclarées, produire des documents et prévenir la fraude ou les accès non autorisés ;</li>
          <li>envoyer les messages transactionnels nécessaires au fonctionnement du compte ;</li>
          <li>adresser des notifications Web Push uniquement après l’autorisation donnée dans le navigateur.</li>
        </ul>
        <p className="mt-3">
          Selon le traitement, ces opérations reposent sur l’exécution du service demandé, le respect d’une obligation légale, l’intérêt légitime de sécuriser et d’auditer le service, ou votre consentement lorsqu’il est requis.
        </p>
      </section>

      <section>
        <h2>Destinataires et prestataires</h2>
        <p className="mt-3">
          Les données sont accessibles uniquement aux utilisateurs concernés, au personnel habilité et aux prestataires nécessaires : Supabase pour l’authentification, la base et le stockage privé ; Netlify pour l’hébergement ; Resend ou Brevo pour les e-mails transactionnels ; Tawk.to pour le support en ligne lorsqu’il est disponible. Les taux indicatifs peuvent être récupérés côté serveur auprès de Frankfurter sans transmission de votre dossier bancaire.
        </p>
      </section>

      <section>
        <h2>Conservation et sécurité</h2>
        <p className="mt-3">
          Les données sont conservées pendant la durée nécessaire au compte, aux opérations enregistrées, aux obligations applicables et à la défense de droits. Les durées exactes peuvent varier selon la catégorie de document et les exigences de l’établissement exploitant. Les justificatifs sont placés dans des espaces privés, les accès sont contrôlés par rôle et les opérations sensibles sont journalisées. Une demande de suppression ne peut pas effacer les éléments dont la conservation reste légalement ou opérationnellement requise.
        </p>
      </section>

      <section>
        <h2>Transferts internationaux</h2>
        <p className="mt-3">
          Certains prestataires peuvent traiter des données hors de l’Espace économique européen. L’exploitant doit alors s’appuyer sur les mécanismes de protection applicables, notamment une décision d’adéquation ou des clauses contractuelles types, selon le prestataire et le contexte retenus.
        </p>
      </section>

      <section>
        <h2>Vos droits</h2>
        <p className="mt-3">
          Vous pouvez demander l’accès, la rectification, l’effacement, la limitation ou la portabilité de vos données, et vous opposer à certains traitements. Vous pouvez retirer un consentement sans remettre en cause les traitements déjà réalisés. Écrivez à{' '}
          <a href={`mailto:${supportEmail}`}>{supportEmail}</a>. Vous pouvez également saisir l’autorité de contrôle compétente ; en France, il s’agit de la{' '}
          <a href="https://www.cnil.fr/" target="_blank" rel="noreferrer">CNIL</a>.
        </p>
      </section>

      <section>
        <h2>Cookies</h2>
        <p className="mt-3">
          Les informations relatives aux cookies, au stockage local et aux services tiers figurent dans la{' '}
          <a href="/cookies">politique relative aux cookies</a>.
        </p>
      </section>
    </LegalPageShell>
  );
}
