export type CancellationStage =
  | 'UNFUNDED'
  | 'PRE_DEPARTURE'
  | 'IN_TRANSIT'
  | 'DELIVERED';

export interface CancellationPolicy {
  allowed: boolean;
  refundType: 'FULL' | 'PARTIAL' | 'DISPUTED' | 'NONE';
  authorizedBy: 'IMPORTER_ONLY' | 'BOTH_PARTIES_MARITRADE' | 'MARITRADE_ARBITRATION' | 'NONE';
}

export function getCancellationPolicy(stage: CancellationStage): CancellationPolicy {
  switch (stage) {
    case 'UNFUNDED':
      return { allowed: true, refundType: 'FULL', authorizedBy: 'IMPORTER_ONLY' };
    case 'PRE_DEPARTURE':
      return { allowed: true, refundType: 'PARTIAL', authorizedBy: 'BOTH_PARTIES_MARITRADE' };
    case 'IN_TRANSIT':
      return { allowed: true, refundType: 'DISPUTED', authorizedBy: 'MARITRADE_ARBITRATION' };
    case 'DELIVERED':
      return { allowed: false, refundType: 'NONE', authorizedBy: 'NONE' };
    default:
      return { allowed: false, refundType: 'NONE', authorizedBy: 'NONE' };
  }
}
