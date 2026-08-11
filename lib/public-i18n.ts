import type { Language } from './types';

interface PublicMessages {
  languageSelector: string;
  login: {
    title: string;
    subtitle: string;
    email: string;
    password: string;
    emailPlaceholder: string;
    passwordPlaceholder: string;
    showPassword: string;
    hidePassword: string;
    forgotPassword: string;
    submit: string;
    submitting: string;
    newUser: string;
    register: string;
    genericError: string;
    errors: Record<string, string>;
  };
  register: {
    title: string;
    subtitle: string;
    displayName: string;
    email: string;
    baseCurrency: string;
    password: string;
    confirmPassword: string;
    displayNamePlaceholder: string;
    emailPlaceholder: string;
    baseCurrencyPlaceholder: string;
    baseCurrencyHint: string;
    passwordPlaceholder: string;
    confirmPasswordPlaceholder: string;
    passwordHint: string;
    showPassword: string;
    hidePassword: string;
    submit: string;
    submitting: string;
    baseCurrencyRequiredError: string;
    passwordPolicyError: string;
    passwordMismatchError: string;
    genericError: string;
    checkEmailTitle: string;
    checkEmailBody: string;
    otpLabel: string;
    otpPlaceholder: string;
    otpHint: string;
    otpSubmit: string;
    otpSubmitting: string;
    otpInvalidError: string;
    otpVerificationError: string;
    resendPrompt: string;
    resendAction: string;
    resending: string;
    resendCooldown: string;
    resendSuccess: string;
    resendError: string;
    backToLogin: string;
    resetAccess: string;
  };
  adminLogin: {
    restricted: string;
    email: string;
    password: string;
    emailPlaceholder: string;
    passwordPlaceholder: string;
    showPassword: string;
    hidePassword: string;
    submit: string;
    submitting: string;
    backToUser: string;
    forgotPassword: string;
    updatedEmail: string;
    updatedPassword: string;
    forbidden: string;
    genericError: string;
    errors: Record<string, string>;
  };
  resetPassword: {
    requestTitle: string;
    updateTitle: string;
    email: string;
    password: string;
    confirmPassword: string;
    emailPlaceholder: string;
    passwordPlaceholder: string;
    confirmPasswordPlaceholder: string;
    passwordHint: string;
    adminPasswordHint: string;
    showPassword: string;
    hidePassword: string;
    requestSubmit: string;
    updateSubmit: string;
    submitting: string;
    recoveryError: string;
    passwordError: string;
    adminPasswordError: string;
    requestSuccess: string;
    requestError: string;
    updateError: string;
    backToLogin: string;
  };
}

export const publicMessages: Record<Language, PublicMessages> = {
  fr: {
    languageSelector: 'Langue',
    login: {
      title: 'Connexion à votre espace',
      subtitle:
        'Accédez à vos comptes, soldes, virements et prêts {bankName} en toute sécurité.',
      email: 'Adresse e-mail',
      password: 'Mot de passe',
      emailPlaceholder: 'vous@exemple.com',
      passwordPlaceholder: 'Saisissez votre mot de passe',
      showPassword: 'Afficher le mot de passe',
      hidePassword: 'Masquer le mot de passe',
      forgotPassword: 'Mot de passe oublié ?',
      submit: 'Se connecter',
      submitting: 'Connexion…',
      newUser: 'Nouveau sur {bankName} ?',
      register: 'Créer un compte',
      genericError: 'Connexion impossible. Vérifiez vos identifiants.',
      errors: {
        auth_callback: 'Le lien de connexion est invalide ou expiré.',
        auth_confirmation: 'Le lien de confirmation est invalide ou expiré.',
        configuration: 'La connexion Supabase doit être configurée par le déploiement.',
        session: 'Votre session a expiré ou a été révoquée. Reconnectez-vous.',
      },
    },
    register: {
      title: 'Créer votre compte {bankName}',
      subtitle: 'Créez votre accès bancaire sécurisé.',
      displayName: 'Nom complet',
      email: 'Adresse e-mail',
      baseCurrency: 'Devise de base',
      password: 'Mot de passe',
      confirmPassword: 'Confirmer le mot de passe',
      displayNamePlaceholder: 'Prénom et nom',
      emailPlaceholder: 'vous@exemple.com',
      baseCurrencyPlaceholder: 'Choisir une devise',
      baseCurrencyHint: 'Choix définitif pour votre compte principal.',
      passwordPlaceholder: 'Créer un mot de passe',
      confirmPasswordPlaceholder: 'Répéter le mot de passe',
      passwordHint: '8–72 caractères : majuscule, minuscule, chiffre, symbole, sans espace.',
      showPassword: 'Afficher le mot de passe',
      hidePassword: 'Masquer le mot de passe',
      submit: 'Créer un compte',
      submitting: 'Création du compte…',
      baseCurrencyRequiredError:
        'Sélectionnez une devise pour poursuivre votre inscription.',
      passwordPolicyError:
        'Le mot de passe doit comporter 8 à 72 caractères avec minuscule, majuscule, chiffre et symbole, sans espace.',
      passwordMismatchError: 'Les mots de passe ne correspondent pas.',
      genericError: 'Création du compte impossible.',
      checkEmailTitle: 'Confirmez votre adresse e-mail',
      checkEmailBody:
        'Si cette adresse peut être inscrite, un code à 6 chiffres a été envoyé à {email}. Saisissez-le ci-dessous. Aucun code ? Connectez-vous ou réinitialisez votre mot de passe.',
      otpLabel: 'Code reçu par e-mail',
      otpPlaceholder: '000000',
      otpHint: 'Ne partagez jamais ce code.',
      otpSubmit: 'Confirmer mon adresse',
      otpSubmitting: 'Vérification…',
      otpInvalidError: 'Saisissez le code à 6 chiffres reçu par e-mail.',
      otpVerificationError: 'Ce code est invalide ou expiré. Vérifiez-le ou demandez un nouveau code.',
      resendPrompt: 'Vous n’avez pas reçu le code ?',
      resendAction: 'Renvoyer le code',
      resending: 'Envoi…',
      resendCooldown: 'Nouvel envoi possible dans {seconds} s',
      resendSuccess: 'Si un code peut être envoyé, l’envoi a été relancé.',
      resendError: 'Le code n’a pas pu être renvoyé. Réessayez dans quelques instants.',
      backToLogin: 'Revenir à la connexion',
      resetAccess: 'Réinitialiser mon mot de passe',
    },
    adminLogin: {
      restricted: 'Accès réservé au chef d’agence',
      email: 'E-mail professionnel',
      password: 'Mot de passe',
      emailPlaceholder: 'prenom.nom@monalyz.com',
      passwordPlaceholder: 'Saisissez votre mot de passe',
      showPassword: 'Afficher le mot de passe',
      hidePassword: 'Masquer le mot de passe',
      submit: 'Ouvrir l’espace chef d’agence',
      submitting: 'Vérification des habilitations…',
      backToUser: 'Retour à l’espace utilisateur',
      forgotPassword: 'Mot de passe oublié ?',
      updatedEmail: 'Adresse e-mail modifiée. Reconnectez-vous avec la nouvelle adresse.',
      updatedPassword: 'Mot de passe modifié. Reconnectez-vous avec le nouveau mot de passe.',
      forbidden: 'Ce compte ne dispose pas de l’habilitation chef d’agence.',
      genericError: 'Authentification Back-Office impossible.',
      errors: {
        configuration: 'La connexion Supabase doit être configurée par le déploiement.',
        session:
          'Votre session Back-Office a expiré ou a été révoquée. Reconnectez-vous.',
      },
    },
    resetPassword: {
      requestTitle: 'Réinitialiser le mot de passe',
      updateTitle: 'Choisir un nouveau mot de passe',
      email: 'Adresse e-mail',
      password: 'Nouveau mot de passe',
      confirmPassword: 'Confirmation',
      emailPlaceholder: 'vous@exemple.com',
      passwordPlaceholder: 'Créez un nouveau mot de passe',
      confirmPasswordPlaceholder: 'Confirmez le nouveau mot de passe',
      passwordHint:
        'Utilisez 8 à 72 caractères avec minuscule, majuscule, chiffre et symbole, sans espace.',
      adminPasswordHint:
        'Pour un compte chef d’agence, utilisez 16 à 72 caractères avec minuscule, majuscule, chiffre et symbole, sans espace.',
      showPassword: 'Afficher le mot de passe',
      hidePassword: 'Masquer le mot de passe',
      requestSubmit: 'Envoyer le lien sécurisé',
      updateSubmit: 'Enregistrer',
      submitting: 'Traitement…',
      recoveryError:
        'Le lien de récupération est invalide ou expiré. Demandez-en un nouveau.',
      passwordError:
        'Utilisez 8 à 72 caractères avec minuscule, majuscule, chiffre et symbole, sans espace, puis saisissez deux valeurs identiques.',
      adminPasswordError:
        'Un mot de passe chef d’agence doit utiliser 16 à 72 caractères avec minuscule, majuscule, chiffre et symbole, sans espace, puis être saisi deux fois à l’identique.',
      requestSuccess:
        'Si cette adresse existe, un lien sécurisé a été envoyé. Il expirera selon la politique Supabase Auth.',
      requestError: 'Demande impossible.',
      updateError: 'Mise à jour impossible.',
      backToLogin: 'Retour à la connexion',
    },
  },
  en: {
    languageSelector: 'Language',
    login: {
      title: 'Sign in to your account',
      subtitle:
        'Securely access your {bankName} accounts, balances, transfers and loans.',
      email: 'Email address',
      password: 'Password',
      emailPlaceholder: 'you@example.com',
      passwordPlaceholder: 'Enter your password',
      showPassword: 'Show password',
      hidePassword: 'Hide password',
      forgotPassword: 'Forgot your password?',
      submit: 'Sign in',
      submitting: 'Signing in…',
      newUser: 'New to {bankName}?',
      register: 'Create an account',
      genericError: 'Unable to sign in. Check your credentials.',
      errors: {
        auth_callback: 'The sign-in link is invalid or has expired.',
        auth_confirmation: 'The confirmation link is invalid or has expired.',
        configuration: 'The deployment must configure the Supabase connection.',
        session: 'Your session has expired or was revoked. Please sign in again.',
      },
    },
    register: {
      title: 'Create your {bankName} account',
      subtitle: 'Create your secure banking access.',
      displayName: 'Full name',
      email: 'Email address',
      baseCurrency: 'Base currency',
      password: 'Password',
      confirmPassword: 'Confirm password',
      displayNamePlaceholder: 'First and last name',
      emailPlaceholder: 'you@example.com',
      baseCurrencyPlaceholder: 'Choose a currency',
      baseCurrencyHint: 'Final choice for your main account.',
      passwordPlaceholder: 'Create a password',
      confirmPasswordPlaceholder: 'Repeat your password',
      passwordHint: '8–72 characters: upper and lowercase, number, symbol, no spaces.',
      showPassword: 'Show password',
      hidePassword: 'Hide password',
      submit: 'Create an account',
      submitting: 'Creating your account…',
      baseCurrencyRequiredError:
        'Select a currency to continue your registration.',
      passwordPolicyError:
        'The password must contain 8 to 72 characters with lowercase, uppercase, a number and a symbol, without spaces.',
      passwordMismatchError: 'The passwords do not match.',
      genericError: 'Unable to create the account.',
      checkEmailTitle: 'Confirm your email address',
      checkEmailBody:
        'If this address can be registered, a 6-digit code was sent to {email}. Enter it below. No code? Sign in or reset your password.',
      otpLabel: 'Code received by email',
      otpPlaceholder: '000000',
      otpHint: 'Never share this code.',
      otpSubmit: 'Confirm my address',
      otpSubmitting: 'Verifying…',
      otpInvalidError: 'Enter the 6-digit code received by email.',
      otpVerificationError: 'This code is invalid or expired. Check it or request a new code.',
      resendPrompt: 'Didn’t receive the code?',
      resendAction: 'Resend code',
      resending: 'Sending…',
      resendCooldown: 'You can resend a code in {seconds}s',
      resendSuccess: 'If a code can be sent, delivery has been restarted.',
      resendError: 'The code could not be resent. Try again in a moment.',
      backToLogin: 'Back to sign in',
      resetAccess: 'Reset my password',
    },
    adminLogin: {
      restricted: 'Branch manager access only',
      email: 'Work email',
      password: 'Password',
      emailPlaceholder: 'first.last@monalyz.com',
      passwordPlaceholder: 'Enter your password',
      showPassword: 'Show password',
      hidePassword: 'Hide password',
      submit: 'Open the branch manager workspace',
      submitting: 'Checking permissions…',
      backToUser: 'Back to the user workspace',
      forgotPassword: 'Forgot your password?',
      updatedEmail: 'Email address updated. Sign in again with the new address.',
      updatedPassword: 'Password updated. Sign in again with the new password.',
      forbidden: 'This account does not have branch manager permission.',
      genericError: 'Back-office authentication failed.',
      errors: {
        configuration: 'The deployment must configure the Supabase connection.',
        session:
          'Your back-office session has expired or was revoked. Please sign in again.',
      },
    },
    resetPassword: {
      requestTitle: 'Reset your password',
      updateTitle: 'Choose a new password',
      email: 'Email address',
      password: 'New password',
      confirmPassword: 'Confirmation',
      emailPlaceholder: 'you@example.com',
      passwordPlaceholder: 'Create a new password',
      confirmPasswordPlaceholder: 'Confirm your new password',
      passwordHint:
        'Use 8 to 72 characters with lowercase, uppercase, a number and a symbol, without spaces.',
      adminPasswordHint:
        'For a branch manager account, use 16 to 72 characters with lowercase, uppercase, a number and a symbol, without spaces.',
      showPassword: 'Show password',
      hidePassword: 'Hide password',
      requestSubmit: 'Send the secure link',
      updateSubmit: 'Save',
      submitting: 'Processing…',
      recoveryError:
        'The recovery link is invalid or has expired. Please request a new one.',
      passwordError:
        'Use 8 to 72 characters with lowercase, uppercase, a number and a symbol, without spaces, then enter the same value twice.',
      adminPasswordError:
        'A branch manager password must use 16 to 72 characters with lowercase, uppercase, a number and a symbol, without spaces, then be entered identically twice.',
      requestSuccess:
        'If this address exists, a secure link has been sent. It will expire according to the Supabase Auth policy.',
      requestError: 'Unable to submit the request.',
      updateError: 'Unable to update the password.',
      backToLogin: 'Back to sign in',
    },
  },
  de: {
    languageSelector: 'Sprache',
    login: {
      title: 'Bei Ihrem Bereich anmelden',
      subtitle:
        'Greifen Sie sicher auf Ihre {bankName}-Konten, Salden, Überweisungen und Kredite zu.',
      email: 'E-Mail-Adresse',
      password: 'Passwort',
      emailPlaceholder: 'sie@beispiel.de',
      passwordPlaceholder: 'Geben Sie Ihr Passwort ein',
      showPassword: 'Passwort anzeigen',
      hidePassword: 'Passwort ausblenden',
      forgotPassword: 'Passwort vergessen?',
      submit: 'Anmelden',
      submitting: 'Anmeldung…',
      newUser: 'Neu bei {bankName}?',
      register: 'Konto erstellen',
      genericError: 'Anmeldung nicht möglich. Prüfen Sie Ihre Zugangsdaten.',
      errors: {
        auth_callback: 'Der Anmeldelink ist ungültig oder abgelaufen.',
        auth_confirmation: 'Der Bestätigungslink ist ungültig oder abgelaufen.',
        configuration: 'Die Supabase-Verbindung muss im Deployment konfiguriert werden.',
        session:
          'Ihre Sitzung ist abgelaufen oder wurde widerrufen. Melden Sie sich erneut an.',
      },
    },
    register: {
      title: '{bankName}-Konto erstellen',
      subtitle: 'Richten Sie Ihren sicheren Bankzugang ein.',
      displayName: 'Vollständiger Name',
      email: 'E-Mail-Adresse',
      baseCurrency: 'Basiswährung',
      password: 'Passwort',
      confirmPassword: 'Passwort bestätigen',
      displayNamePlaceholder: 'Vor- und Nachname',
      emailPlaceholder: 'sie@beispiel.de',
      baseCurrencyPlaceholder: 'Währung wählen',
      baseCurrencyHint: 'Endgültige Auswahl für Ihr Hauptkonto.',
      passwordPlaceholder: 'Passwort erstellen',
      confirmPasswordPlaceholder: 'Passwort wiederholen',
      passwordHint: '8–72 Zeichen: Groß- und Kleinbuchstaben, Zahl, Sonderzeichen, keine Leerzeichen.',
      showPassword: 'Passwort anzeigen',
      hidePassword: 'Passwort ausblenden',
      submit: 'Konto erstellen',
      submitting: 'Konto wird erstellt…',
      baseCurrencyRequiredError:
        'Wählen Sie eine Währung aus, um die Registrierung fortzusetzen.',
      passwordPolicyError:
        'Das Passwort muss 8 bis 72 Zeichen mit Kleinbuchstaben, Großbuchstaben, Zahl und Sonderzeichen enthalten, ohne Leerzeichen.',
      passwordMismatchError: 'Die Passwörter stimmen nicht überein.',
      genericError: 'Das Konto konnte nicht erstellt werden.',
      checkEmailTitle: 'E-Mail-Adresse bestätigen',
      checkEmailBody:
        'Wenn diese Adresse registriert werden kann, wurde ein 6-stelliger Code an {email} gesendet. Geben Sie ihn unten ein. Kein Code? Melden Sie sich an oder setzen Sie Ihr Passwort zurück.',
      otpLabel: 'Per E-Mail erhaltener Code',
      otpPlaceholder: '000000',
      otpHint: 'Geben Sie diesen Code niemals weiter.',
      otpSubmit: 'E-Mail-Adresse bestätigen',
      otpSubmitting: 'Wird geprüft…',
      otpInvalidError: 'Geben Sie den 6-stelligen Code aus der E-Mail ein.',
      otpVerificationError: 'Dieser Code ist ungültig oder abgelaufen. Prüfen Sie ihn oder fordern Sie einen neuen Code an.',
      resendPrompt: 'Keinen Code erhalten?',
      resendAction: 'Code erneut senden',
      resending: 'Wird gesendet…',
      resendCooldown: 'Neuer Code in {seconds} Sek. möglich',
      resendSuccess: 'Wenn für diese Anfrage ein Code gesendet werden kann, wurde der Versand neu gestartet.',
      resendError: 'Der Code konnte nicht erneut gesendet werden. Versuchen Sie es später noch einmal.',
      backToLogin: 'Zurück zur Anmeldung',
      resetAccess: 'Passwort zurücksetzen',
    },
    adminLogin: {
      restricted: 'Nur für Filialleiter',
      email: 'Geschäftliche E-Mail-Adresse',
      password: 'Passwort',
      emailPlaceholder: 'vorname.nachname@monalyz.com',
      passwordPlaceholder: 'Geben Sie Ihr Passwort ein',
      showPassword: 'Passwort anzeigen',
      hidePassword: 'Passwort ausblenden',
      submit: 'Filialleiterbereich öffnen',
      submitting: 'Berechtigungen werden geprüft…',
      backToUser: 'Zurück zum Benutzerbereich',
      forgotPassword: 'Passwort vergessen?',
      updatedEmail: 'E-Mail-Adresse geändert. Melden Sie sich mit der neuen Adresse erneut an.',
      updatedPassword: 'Passwort geändert. Melden Sie sich mit dem neuen Passwort erneut an.',
      forbidden: 'Dieses Konto besitzt keine Filialleiterberechtigung.',
      genericError: 'Backoffice-Anmeldung nicht möglich.',
      errors: {
        configuration: 'Die Supabase-Verbindung muss im Deployment konfiguriert werden.',
        session:
          'Ihre Backoffice-Sitzung ist abgelaufen oder wurde widerrufen. Melden Sie sich erneut an.',
      },
    },
    resetPassword: {
      requestTitle: 'Passwort zurücksetzen',
      updateTitle: 'Neues Passwort wählen',
      email: 'E-Mail-Adresse',
      password: 'Neues Passwort',
      confirmPassword: 'Bestätigung',
      emailPlaceholder: 'sie@beispiel.de',
      passwordPlaceholder: 'Erstellen Sie ein neues Passwort',
      confirmPasswordPlaceholder: 'Bestätigen Sie Ihr neues Passwort',
      passwordHint:
        'Verwenden Sie 8 bis 72 Zeichen mit Kleinbuchstaben, Großbuchstaben, Zahl und Sonderzeichen, ohne Leerzeichen.',
      adminPasswordHint:
        'Verwenden Sie für ein Filialleiterkonto 16 bis 72 Zeichen mit Kleinbuchstaben, Großbuchstaben, Zahl und Sonderzeichen, ohne Leerzeichen.',
      showPassword: 'Passwort anzeigen',
      hidePassword: 'Passwort ausblenden',
      requestSubmit: 'Sicheren Link senden',
      updateSubmit: 'Speichern',
      submitting: 'Verarbeitung…',
      recoveryError:
        'Der Wiederherstellungslink ist ungültig oder abgelaufen. Fordern Sie einen neuen an.',
      passwordError:
        'Verwenden Sie 8 bis 72 Zeichen mit Kleinbuchstaben, Großbuchstaben, Zahl und Sonderzeichen, ohne Leerzeichen, und geben Sie denselben Wert zweimal ein.',
      adminPasswordError:
        'Ein Filialleiter-Passwort muss 16 bis 72 Zeichen mit Kleinbuchstaben, Großbuchstaben, Zahl und Sonderzeichen ohne Leerzeichen enthalten und zweimal identisch eingegeben werden.',
      requestSuccess:
        'Falls diese Adresse existiert, wurde ein sicherer Link gesendet. Er läuft gemäß der Supabase-Auth-Richtlinie ab.',
      requestError: 'Anfrage nicht möglich.',
      updateError: 'Aktualisierung nicht möglich.',
      backToLogin: 'Zurück zur Anmeldung',
    },
  },
  es: {
    languageSelector: 'Idioma',
    login: {
      title: 'Acceda a su espacio',
      subtitle:
        'Acceda de forma segura a sus cuentas, saldos, transferencias y préstamos {bankName}.',
      email: 'Correo electrónico',
      password: 'Contraseña',
      emailPlaceholder: 'usted@ejemplo.com',
      passwordPlaceholder: 'Introduzca su contraseña',
      showPassword: 'Mostrar contraseña',
      hidePassword: 'Ocultar contraseña',
      forgotPassword: '¿Olvidó su contraseña?',
      submit: 'Iniciar sesión',
      submitting: 'Conectando…',
      newUser: '¿Es nuevo en {bankName}?',
      register: 'Crear una cuenta',
      genericError: 'No se pudo iniciar sesión. Compruebe sus credenciales.',
      errors: {
        auth_callback: 'El enlace de inicio de sesión no es válido o ha caducado.',
        auth_confirmation: 'El enlace de confirmación no es válido o ha caducado.',
        configuration: 'El despliegue debe configurar la conexión con Supabase.',
        session: 'Su sesión ha caducado o ha sido revocada. Vuelva a iniciar sesión.',
      },
    },
    register: {
      title: 'Crear su cuenta de {bankName}',
      subtitle: 'Cree su acceso bancario seguro.',
      displayName: 'Nombre completo',
      email: 'Correo electrónico',
      baseCurrency: 'Moneda base',
      password: 'Contraseña',
      confirmPassword: 'Confirmar contraseña',
      displayNamePlaceholder: 'Nombre y apellidos',
      emailPlaceholder: 'usted@ejemplo.com',
      baseCurrencyPlaceholder: 'Elegir una moneda',
      baseCurrencyHint: 'Elección definitiva para su cuenta principal.',
      passwordPlaceholder: 'Crear una contraseña',
      confirmPasswordPlaceholder: 'Repetir la contraseña',
      passwordHint: '8–72 caracteres: mayúscula, minúscula, número, símbolo, sin espacios.',
      showPassword: 'Mostrar contraseña',
      hidePassword: 'Ocultar contraseña',
      submit: 'Crear una cuenta',
      submitting: 'Creando la cuenta…',
      baseCurrencyRequiredError:
        'Seleccione una moneda para continuar con el registro.',
      passwordPolicyError:
        'La contraseña debe tener entre 8 y 72 caracteres con minúscula, mayúscula, número y símbolo, sin espacios.',
      passwordMismatchError: 'Las contraseñas no coinciden.',
      genericError: 'No se pudo crear la cuenta.',
      checkEmailTitle: 'Confirme su correo electrónico',
      checkEmailBody:
        'Si esta dirección puede registrarse, se ha enviado un código de 6 dígitos a {email}. Introdúzcalo abajo. ¿No recibió el código? Inicie sesión o restablezca su contraseña.',
      otpLabel: 'Código recibido por correo',
      otpPlaceholder: '000000',
      otpHint: 'No comparta este código.',
      otpSubmit: 'Confirmar mi dirección',
      otpSubmitting: 'Verificando…',
      otpInvalidError: 'Introduzca el código de 6 dígitos recibido por correo.',
      otpVerificationError: 'Este código no es válido o ha caducado. Compruébelo o solicite uno nuevo.',
      resendPrompt: '¿No ha recibido el código?',
      resendAction: 'Reenviar el código',
      resending: 'Enviando…',
      resendCooldown: 'Podrá reenviar un código en {seconds} s',
      resendSuccess: 'Si se puede enviar un código, se ha reiniciado el envío.',
      resendError: 'No se pudo reenviar el código. Inténtelo de nuevo en unos instantes.',
      backToLogin: 'Volver al inicio de sesión',
      resetAccess: 'Restablecer mi contraseña',
    },
    adminLogin: {
      restricted: 'Acceso exclusivo para el director de sucursal',
      email: 'Correo profesional',
      password: 'Contraseña',
      emailPlaceholder: 'nombre.apellido@monalyz.com',
      passwordPlaceholder: 'Introduzca su contraseña',
      showPassword: 'Mostrar contraseña',
      hidePassword: 'Ocultar contraseña',
      submit: 'Abrir el espacio del director de sucursal',
      submitting: 'Comprobando permisos…',
      backToUser: 'Volver al espacio de usuario',
      forgotPassword: '¿Olvidó su contraseña?',
      updatedEmail: 'Correo actualizado. Vuelva a iniciar sesión con la nueva dirección.',
      updatedPassword: 'Contraseña actualizada. Vuelva a iniciar sesión con la nueva contraseña.',
      forbidden: 'Esta cuenta no tiene permisos de director de sucursal.',
      genericError: 'No se pudo autenticar en el back office.',
      errors: {
        configuration: 'El despliegue debe configurar la conexión con Supabase.',
        session:
          'Su sesión de back office ha caducado o ha sido revocada. Vuelva a iniciar sesión.',
      },
    },
    resetPassword: {
      requestTitle: 'Restablecer la contraseña',
      updateTitle: 'Elegir una nueva contraseña',
      email: 'Correo electrónico',
      password: 'Nueva contraseña',
      confirmPassword: 'Confirmación',
      emailPlaceholder: 'usted@ejemplo.com',
      passwordPlaceholder: 'Cree una contraseña nueva',
      confirmPasswordPlaceholder: 'Confirme la nueva contraseña',
      passwordHint:
        'Use entre 8 y 72 caracteres con minúscula, mayúscula, número y símbolo, sin espacios.',
      adminPasswordHint:
        'Para una cuenta de director de sucursal, use entre 16 y 72 caracteres con minúscula, mayúscula, número y símbolo, sin espacios.',
      showPassword: 'Mostrar contraseña',
      hidePassword: 'Ocultar contraseña',
      requestSubmit: 'Enviar el enlace seguro',
      updateSubmit: 'Guardar',
      submitting: 'Procesando…',
      recoveryError:
        'El enlace de recuperación no es válido o ha caducado. Solicite uno nuevo.',
      passwordError:
        'Use entre 8 y 72 caracteres con minúscula, mayúscula, número y símbolo, sin espacios, e introduzca el mismo valor dos veces.',
      adminPasswordError:
        'La contraseña de un director de sucursal debe tener entre 16 y 72 caracteres con minúscula, mayúscula, número y símbolo, sin espacios, e introducirse dos veces de forma idéntica.',
      requestSuccess:
        'Si esta dirección existe, se ha enviado un enlace seguro. Caducará según la política de Supabase Auth.',
      requestError: 'No se pudo enviar la solicitud.',
      updateError: 'No se pudo actualizar la contraseña.',
      backToLogin: 'Volver al inicio de sesión',
    },
  },
};
