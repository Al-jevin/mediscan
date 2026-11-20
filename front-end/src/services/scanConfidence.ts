export type ConfidenceTier = 'high' | 'medium' | 'low';

export type ConfidenceTelemetry = {
  trust_score?: number | null;
  confidence_tier?: string | null;
  trust_tier?: string | null;
  dosage_match_status?: string | null;
  fda_match_score?: number | null;
};

export function getConfidenceTier(
  telemetry: ConfidenceTelemetry,
): ConfidenceTier | null {
  const trustScore = telemetry.trust_score;
  if (typeof trustScore === 'number' && Number.isFinite(trustScore)) {
    if (trustScore >= 0.85) return 'high';
    if (trustScore >= 0.65) return 'medium';
    return 'low';
  }

  const reportedTier = telemetry.confidence_tier ?? telemetry.trust_tier;
  switch (reportedTier?.toLowerCase()) {
    case 'high':
      return 'high';
    case 'medium':
      return 'medium';
    case 'low':
      return 'low';
    default:
      break;
  }

  const dosageStatus = telemetry.dosage_match_status?.toLowerCase();
  if (dosageStatus === 'mismatch' || dosageStatus === 'dosage_conflict') return 'low';
  if (
    dosageStatus === 'not_detected' ||
    dosageStatus === 'missing_dosage' ||
    dosageStatus === 'unverified'
  ) {
    return 'medium';
  }
  return null;
}
