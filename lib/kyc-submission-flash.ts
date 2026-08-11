export const KYC_SUBMISSION_FLASHES = ['kyc_submitted', 'kyc_resubmitted'] as const;

export type KycSubmissionFlash = (typeof KYC_SUBMISSION_FLASHES)[number];

export function consumeKycSubmissionFlash(href: string): {
  flash: KycSubmissionFlash;
  nextPath: string;
} | null {
  const url = new URL(href);
  const flashes = url.searchParams.getAll('flash');
  if (flashes.length !== 1) return null;
  const [flash] = flashes;
  if (!KYC_SUBMISSION_FLASHES.includes(flash as KycSubmissionFlash)) return null;

  url.searchParams.delete('flash');
  return {
    flash: flash as KycSubmissionFlash,
    nextPath: `${url.pathname}${url.search}${url.hash}`,
  };
}
