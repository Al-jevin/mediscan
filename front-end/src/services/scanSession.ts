import { findPossibleMatch, isScanState, mockScanResults, type PossibleMatch, type ScanResult, type ScanState } from '@/data/mockScanResults';

let latestScanResult: ScanResult | null = null;

export function setLatestScanResult(res: ScanResult): void {
  latestScanResult = res;
}

export function getLatestScanResult(fallbackState?: string): ScanResult {
  if (fallbackState && isScanState(fallbackState)) {
    if (!latestScanResult || latestScanResult.status !== fallbackState) {
      return mockScanResults[fallbackState];
    }
  }
  return latestScanResult ?? mockScanResults.verified;
}

export function clearLatestScanResult(): void {
  latestScanResult = null;
}

export function findMatchById(id: string | undefined): PossibleMatch | undefined {
  if (!id) return undefined;
  if (latestScanResult?.status === 'needs_verification') {
    const found = latestScanResult.matches.find((m) => m.id === id);
    if (found) return found;
  }
  return findPossibleMatch(id);
}
