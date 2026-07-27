import { EmailNotification } from './types';

export function createWireSubmittedEmail(
  recipientName: string,
  recipientEmail: string,
  amountFormatted: string,
  targetRecipient: string,
  reference: string
): EmailNotification {
  const sentAt = new Date().toLocaleString('fr-FR', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });

  const bodyHtml = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; background-color: #ffffff; border-radius: 12px; overflow: hidden; border: 1px solid #e2e8f0; color: #1e293b;">
      <div style="background: linear-gradient(135deg, #0a0f2d 0%, #1e1b4b 100%); padding: 24px; text-align: center; color: #ffffff;">
        <h1 style="margin: 0; font-size: 24px; font-weight: bold; letter-spacing: -0.5px;">NovaBank</h1>
        <p style="margin: 4px 0 0; opacity: 0.8; font-size: 14px;">Avis de virement transmis</p>
      </div>
      <div style="padding: 32px 24px;">
        <h2 style="font-size: 18px; color: #0f172a; margin-top: 0;">Bonjour ${recipientName},</h2>
        <p style="font-size: 15px; line-height: 1.6; color: #334155;">
          Votre demande de virement d'un montant de <strong>${amountFormatted}</strong> vers <strong>${targetRecipient}</strong> (Réf: <code>${reference}</code>) a été enregistrée avec succès.
        </p>
        <div style="background-color: #f8fafc; border-left: 4px solid #3b82f6; padding: 16px; border-radius: 6px; margin: 20px 0;">
          <p style="margin: 0; font-size: 14px; color: #1e293b;">
            <strong>Statut de conformité :</strong> En cours de vérification manuelle par notre équipe de sécurité.
          </p>
        </div>
        <p style="font-size: 14px; color: #64748b; line-height: 1.5;">
          Conformément à nos exigences de contrôle, votre transaction sera exécutée dès validation des critères de conformité de la banque destinataire.
        </p>
      </div>
      <div style="background-color: #f1f5f9; padding: 16px 24px; text-align: center; font-size: 12px; color: #64748b; border-top: 1px solid #e2e8f0;">
        NovaBank - Sécurité et Conformité bancaire • Ne pas répondre directement à ce message.
      </div>
    </div>
  `;

  return {
    id: `email_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
    recipientName,
    recipientEmail,
    subject: `[NovaBank] Confirmation de demande de virement - ${reference}`,
    previewText: `Votre virement de ${amountFormatted} vers ${targetRecipient} a été pris en compte.`,
    bodyHtml,
    sentAt,
    type: 'wire_submitted',
  };
}

export function createLoanStatusEmail(
  recipientName: string,
  recipientEmail: string,
  loanRef: string,
  stepName: string,
  statusText: string,
  approvedAmount: string
): EmailNotification {
  const sentAt = new Date().toLocaleString('fr-FR', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });

  const bodyHtml = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; background-color: #ffffff; border-radius: 12px; overflow: hidden; border: 1px solid #e2e8f0; color: #1e293b;">
      <div style="background: linear-gradient(135deg, #0a0f2d 0%, #065f46 100%); padding: 24px; text-align: center; color: #ffffff;">
        <h1 style="margin: 0; font-size: 24px; font-weight: bold; letter-spacing: -0.5px;">NovaBank</h1>
        <p style="margin: 4px 0 0; opacity: 0.9; font-size: 14px;">Mise à jour de dossier de prêt</p>
      </div>
      <div style="padding: 32px 24px;">
        <h2 style="font-size: 18px; color: #0f172a; margin-top: 0;">Bonjour ${recipientName},</h2>
        <p style="font-size: 15px; line-height: 1.6; color: #334155;">
          Votre dossier de prêt personnel <strong>${loanRef}</strong> d'un montant approuvé de <strong>${approvedAmount}</strong> a évolué.
        </p>
        <div style="background-color: #f0fdf4; border-left: 4px solid #10b981; padding: 16px; border-radius: 6px; margin: 20px 0;">
          <p style="margin: 0; font-size: 14px; color: #065f46;">
            <strong>Nouvelle étape :</strong> ${stepName} (${statusText})
          </p>
        </div>
        <p style="font-size: 14px; color: #64748b; line-height: 1.5;">
          Vous pouvez suivre l'avancement en temps réel ainsi que la jauge de conformité depuis votre tableau de bord NovaBank.
        </p>
      </div>
      <div style="background-color: #f1f5f9; padding: 16px 24px; text-align: center; font-size: 12px; color: #64748b; border-top: 1px solid #e2e8f0;">
        NovaBank - Département Crédits & Prêts • Cet e-mail est généré automatiquement.
      </div>
    </div>
  `;

  return {
    id: `email_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
    recipientName,
    recipientEmail,
    subject: `[NovaBank] Évolution de votre prêt ${loanRef} : ${stepName}`,
    previewText: `Mise à jour pour votre prêt ${loanRef} (${stepName}).`,
    bodyHtml,
    sentAt,
    type: 'loan_updated',
  };
}

export function createOtpVerificationEmail(
  recipientEmail: string,
  otpCode: string
): EmailNotification {
  const sentAt = new Date().toLocaleString('fr-FR', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });

  const bodyHtml = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; background-color: #ffffff; border-radius: 12px; overflow: hidden; border: 1px solid #e2e8f0; color: #1e293b;">
      <div style="background: linear-gradient(135deg, #0f172a 0%, #1e3a8a 100%); padding: 24px; text-align: center; color: #ffffff;">
        <h1 style="margin: 0; font-size: 24px; font-weight: bold; letter-spacing: -0.5px;">NovaBank</h1>
        <p style="margin: 4px 0 0; opacity: 0.9; font-size: 14px;">Code de vérification de sécurité</p>
      </div>
      <div style="padding: 32px 24px;">
        <h2 style="font-size: 18px; color: #0f172a; margin-top: 0;">Bonjour,</h2>
        <p style="font-size: 15px; line-height: 1.6; color: #334155;">
          Voici votre code de vérification à 6 chiffres pour votre demande de connexion ou d'onboarding NovaBank :
        </p>
        <div style="background-color: #f1f5f9; border: 2px dashed #2563eb; padding: 20px; border-radius: 12px; margin: 24px 0; text-align: center;">
          <span style="font-size: 32px; font-weight: 800; letter-spacing: 8px; color: #1d4ed8; font-family: monospace;">${otpCode}</span>
        </div>
        <p style="font-size: 13px; color: #64748b; line-height: 1.5; margin: 0;">
          ⏱️ Ce code est à usage unique et reste valide pendant <strong>10 minutes</strong>. Si vous n'avez pas demandé ce code, veuillez ignorer ce message.
        </p>
      </div>
      <div style="background-color: #f8fafc; padding: 16px 24px; text-align: center; font-size: 12px; color: #64748b; border-top: 1px solid #e2e8f0;">
        NovaBank Security Services • Ne partagez jamais votre code OTP avec un tiers.
      </div>
    </div>
  `;

  return {
    id: `email_otp_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
    recipientName: recipientEmail.split('@')[0],
    recipientEmail,
    subject: `[NovaBank] Votre code de vérification : ${otpCode}`,
    previewText: `Votre code OTP NovaBank est : ${otpCode} (Valide 10 min).`,
    bodyHtml,
    sentAt,
    type: 'otp_verification',
  };
}

export function createKycSubmittedEmail(
  recipientName: string,
  recipientEmail: string,
  kycRef: string
): EmailNotification {
  const sentAt = new Date().toLocaleString('fr-FR', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });

  const bodyHtml = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; background-color: #ffffff; border-radius: 12px; overflow: hidden; border: 1px solid #e2e8f0; color: #1e293b;">
      <div style="background: linear-gradient(135deg, #0f172a 0%, #0369a1 100%); padding: 24px; text-align: center; color: #ffffff;">
        <h1 style="margin: 0; font-size: 24px; font-weight: bold; letter-spacing: -0.5px;">NovaBank</h1>
        <p style="margin: 4px 0 0; opacity: 0.9; font-size: 14px;">Confirmation de réception KYC</p>
      </div>
      <div style="padding: 32px 24px;">
        <h2 style="font-size: 18px; color: #0f172a; margin-top: 0;">Bonjour ${recipientName},</h2>
        <p style="font-size: 15px; line-height: 1.6; color: #334155;">
          Nous avons bien reçu votre dossier de vérification d'identité et de création de compte (Réf : <strong>${kycRef}</strong>).
        </p>
        <div style="background-color: #f0f9ff; border-left: 4px solid #0284c7; padding: 16px; border-radius: 6px; margin: 20px 0;">
          <p style="margin: 0; font-size: 14px; color: #0369a1;">
            <strong>Délai de traitement :</strong> Votre dossier est actuellement pris en charge par notre équipe Operations. SLA estimé : <strong>sous 24h ouvrées</strong>.
          </p>
        </div>
        <p style="font-size: 14px; color: #64748b; line-height: 1.5;">
          Un e-mail de confirmation avec l'attribution de votre IBAN vous sera envoyé dès la validation de vos justificatifs.
        </p>
      </div>
      <div style="background-color: #f8fafc; padding: 16px 24px; text-align: center; font-size: 12px; color: #64748b; border-top: 1px solid #e2e8f0;">
        NovaBank Operations & Compliance Division • Support 24/7
      </div>
    </div>
  `;

  return {
    id: `email_kyc_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
    recipientName,
    recipientEmail,
    subject: `[NovaBank] Dossier d'ouverture de compte reçu (${kycRef})`,
    previewText: `Votre dossier d'ouverture de compte est bien reçu et en cours de traitement (24h).`,
    bodyHtml,
    sentAt,
    type: 'kyc_submitted',
  };
}

export function createAccountApprovedEmail(
  recipientName: string,
  recipientEmail: string,
  iban: string
): EmailNotification {
  const sentAt = new Date().toLocaleString('fr-FR', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });

  const bodyHtml = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; background-color: #ffffff; border-radius: 12px; overflow: hidden; border: 1px solid #bbf7d0; color: #1e293b;">
      <div style="background: linear-gradient(135deg, #064e3b 0%, #047857 100%); padding: 24px; text-align: center; color: #ffffff;">
        <h1 style="margin: 0; font-size: 24px; font-weight: bold; letter-spacing: -0.5px;">NovaBank</h1>
        <p style="margin: 4px 0 0; opacity: 0.9; font-size: 14px;">🎉 Bienvenue chez NovaBank !</p>
      </div>
      <div style="padding: 32px 24px;">
        <h2 style="font-size: 18px; color: #0f172a; margin-top: 0;">Félicitations ${recipientName},</h2>
        <p style="font-size: 15px; line-height: 1.6; color: #334155;">
          Votre compte bancaire a été <strong>validé avec succès</strong> par notre équipe de conformité. Vos accès sont désormais pleinement actifs.
        </p>
        <div style="background-color: #ecfdf5; border: 2px solid #10b981; padding: 20px; border-radius: 12px; margin: 24px 0; text-align: center;">
          <p style="margin: 0 0 6px 0; font-size: 12px; font-weight: 700; color: #047857; text-transform: uppercase; letter-spacing: 1px;">Votre IBAN Client Officiel</p>
          <p style="margin: 0; font-size: 20px; font-weight: 800; color: #065f46; font-family: monospace;">${iban}</p>
        </div>
        <div style="text-align: center; margin-top: 28px;">
          <a href="/myaccount" style="display: inline-block; background-color: #059669; color: #ffffff; font-weight: bold; padding: 14px 28px; text-decoration: none; border-radius: 10px; font-size: 15px;">Accéder à mon espace bancaire →</a>
        </div>
      </div>
      <div style="background-color: #f8fafc; padding: 16px 24px; text-align: center; font-size: 12px; color: #64748b; border-top: 1px solid #e2e8f0;">
        NovaBank - Votre banque numérique haut de gamme.
      </div>
    </div>
  `;

  return {
    id: `email_appr_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
    recipientName,
    recipientEmail,
    subject: `[NovaBank] Félicitations ! Votre compte est validé - IBAN : ${iban.substring(0, 8)}...`,
    previewText: `Votre compte NovaBank est ouvert. Votre IBAN : ${iban}`,
    bodyHtml,
    sentAt,
    type: 'account_approved',
  };
}

export function createKycRejectedEmail(
  recipientName: string,
  recipientEmail: string,
  rejectionReason: string,
  resubmitUrl = '/register'
): EmailNotification {
  const sentAt = new Date().toLocaleString('fr-FR', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });

  const bodyHtml = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; background-color: #ffffff; border-radius: 12px; overflow: hidden; border: 1px solid #fecaca; color: #1e293b;">
      <div style="background: linear-gradient(135deg, #7f1d1d 0%, #b91c1c 100%); padding: 24px; text-align: center; color: #ffffff;">
        <h1 style="margin: 0; font-size: 24px; font-weight: bold; letter-spacing: -0.5px;">NovaBank</h1>
        <p style="margin: 4px 0 0; opacity: 0.9; font-size: 14px;">Action requise - Correction de dossier KYC</p>
      </div>
      <div style="padding: 32px 24px;">
        <h2 style="font-size: 18px; color: #0f172a; margin-top: 0;">Bonjour ${recipientName},</h2>
        <p style="font-size: 15px; line-height: 1.6; color: #334155;">
          Lors de l'examen de votre dossier de création de compte, notre service de conformité a identifié un élément nécessitant une mise à jour.
        </p>
        <div style="background-color: #fef2f2; border-left: 4px solid #ef4444; padding: 16px; border-radius: 6px; margin: 20px 0;">
          <p style="margin: 0; font-size: 14px; color: #991b1b;">
            <strong>Motif de la demande de correction :</strong> ${rejectionReason}
          </p>
        </div>
        <p style="font-size: 14px; color: #64748b; line-height: 1.5;">
          Pour finaliser l'ouverture de votre compte, merci de re-soumettre le document concerné en cliquant sur le bouton ci-dessous :
        </p>
        <div style="text-align: center; margin-top: 28px;">
          <a href="${resubmitUrl}" style="display: inline-block; background-color: #dc2626; color: #ffffff; font-weight: bold; padding: 14px 28px; text-decoration: none; border-radius: 10px; font-size: 15px;">Mettre à jour mes pièces justificatives →</a>
        </div>
      </div>
      <div style="background-color: #f8fafc; padding: 16px 24px; text-align: center; font-size: 12px; color: #64748b; border-top: 1px solid #e2e8f0;">
        NovaBank Compliance Department • Support direct 24/7
      </div>
    </div>
  `;

  return {
    id: `email_rej_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
    recipientName,
    recipientEmail,
    subject: `[NovaBank Action Requise] Mettre à jour votre dossier KYC (${rejectionReason})`,
    previewText: `Action requise pour votre dossier NovaBank : ${rejectionReason}.`,
    bodyHtml,
    sentAt,
    type: 'action_required',
  };
}

export function createComplianceAlertEmail(
  recipientName: string,
  recipientEmail: string,
  dossierRef: string,
  alertMessage: string
): EmailNotification {
  const sentAt = new Date().toLocaleString('fr-FR', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });

  const bodyHtml = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; background-color: #ffffff; border-radius: 12px; overflow: hidden; border: 1px solid #fed7aa; color: #1e293b;">
      <div style="background: linear-gradient(135deg, #7c2d12 0%, #9a3412 100%); padding: 24px; text-align: center; color: #ffffff;">
        <h1 style="margin: 0; font-size: 24px; font-weight: bold; letter-spacing: -0.5px;">NovaBank</h1>
        <p style="margin: 4px 0 0; opacity: 0.9; font-size: 14px;">Avis de contrôle de conformité</p>
      </div>
      <div style="padding: 32px 24px;">
        <h2 style="font-size: 18px; color: #0f172a; margin-top: 0;">Bonjour ${recipientName},</h2>
        <p style="font-size: 15px; line-height: 1.6; color: #334155;">
          Un contrôle de conformité requiert une attention particulière pour le dossier <strong>${dossierRef}</strong>.
        </p>
        <div style="background-color: #fff7ed; border-left: 4px solid #f97316; padding: 16px; border-radius: 6px; margin: 20px 0;">
          <p style="margin: 0; font-size: 14px; color: #9a3412;">
            <strong>Information du service conformité :</strong> ${alertMessage}
          </p>
        </div>
      </div>
      <div style="background-color: #f1f5f9; padding: 16px 24px; text-align: center; font-size: 12px; color: #64748b; border-top: 1px solid #e2e8f0;">
        NovaBank Security & Compliance Division
      </div>
    </div>
  `;

  return {
    id: `email_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
    recipientName,
    recipientEmail,
    subject: `[NovaBank Alert] Information requise pour le dossier ${dossierRef}`,
    previewText: `Mise à jour concernant le contrôle de conformité de votre dossier ${dossierRef}.`,
    bodyHtml,
    sentAt,
    type: 'compliance_alert',
  };
}
