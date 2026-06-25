/**
 * lib/stellar/milestone-map.ts
 *
 * Bridges the gap between the DB's SCREAMING_SNAKE_CASE MilestoneType string
 * union (types/index.ts) and the numeric MilestoneType enum used by the
 * Soroban escrow contract (lib/stellar/escrow-contract.ts).
 */

import { MilestoneType as DbMilestoneType } from '@/types';
import { MilestoneType as ContractMilestoneType } from './escrow-contract';

const DB_TO_CONTRACT: Record<DbMilestoneType, ContractMilestoneType | null> = {
  BOOKING_CONFIRMED:               ContractMilestoneType.BookingConfirmed,
  DOCUMENTS_SUBMITTED_TO_CARRIER:  ContractMilestoneType.DocumentsSubmittedToCarrier,
  SPACE_ON_VESSEL_SECURED:         ContractMilestoneType.SpaceOnVesselSecured,
  CONTAINER_GATED_OUT_ORIGIN:      ContractMilestoneType.ContainerGatedOutOrigin,
  CONTAINER_LOADED_ON_VESSEL:      ContractMilestoneType.ContainerLoadedOnVessel,
  VESSEL_CLEARED_TO_DEPART:        ContractMilestoneType.VesselClearedToDepart,
  VESSEL_DEPARTED_ORIGIN:          ContractMilestoneType.VesselDepartedOrigin,
  BILL_OF_LADING_ISSUED:           ContractMilestoneType.BillOfLadingIssued,
  VESSEL_ARRIVED_AT_BERTH:         ContractMilestoneType.VesselArrivedAtBerth,
  VESSEL_ARRIVED_DESTINATION:      ContractMilestoneType.VesselArrivedDestination,
  CONTAINER_OFFLOADED:             ContractMilestoneType.ContainerOffloaded,
  CONTAINER_GATED_IN_DESTINATION:  ContractMilestoneType.ContainerGatedInDestination,
  CARGO_RELEASED_FOR_PICKUP:       ContractMilestoneType.CargoReleasedForPickup,
  IN_TRANSIT_TO_DESTINATION:       ContractMilestoneType.InTransitToDestination,
  ARRIVED_AT_DELIVERY_ADDRESS:     ContractMilestoneType.ArrivedAtDeliveryAddress,
  DELIVERED_AND_SIGNED_OFF:        ContractMilestoneType.DeliveredAndSignedOff,
  BOC_ENTRY_FILED:                 ContractMilestoneType.BocEntryFiled,
  PORT_HOLD_PLACED_OR_LIFTED:      ContractMilestoneType.PortHoldPlacedOrLifted,
  DUTIES_AND_TAXES_PAID:           ContractMilestoneType.DutiesAndTaxesPaid,
  CUSTOMS_EXAMINATION_REQUESTED:   ContractMilestoneType.CustomsExaminationRequested,
  CUSTOMS_CLEARANCE_APPROVED:      ContractMilestoneType.CustomsClearanceApproved,
  CARGO_READY_FOR_COLLECTION:      ContractMilestoneType.CargoReadyForCollection,
  CARGO_INSPECTED_AND_PACKED:      ContractMilestoneType.CargoInspectedAndPacked,
  CARGO_STAGED_FOR_PICKUP:         ContractMilestoneType.CargoStagedForPickup,
  CARGO_HANDED_OFF_TO_CARRIER:     ContractMilestoneType.CargoHandedOffToCarrier,
  CARGO_PICKED_UP_FROM_PORT:       ContractMilestoneType.CargoPickedUpFromPort,
  CARGO_RECEIVED_AT_WAREHOUSE:     ContractMilestoneType.CargoReceivedAtWarehouse,
  INCOMING_CARGO_STORED:           ContractMilestoneType.IncomingCargoStored,
  FAILED_DELIVERY_ATTEMPT:         null,  // No corresponding contract enum value
};

/**
 * Convert a DB MilestoneType string to the contract enum number.
 * Returns null for milestones that have no on-chain counterpart (e.g. FAILED_DELIVERY_ATTEMPT).
 */
export function dbMilestoneToContractEnum(
  dbType: DbMilestoneType,
): ContractMilestoneType | null {
  return DB_TO_CONTRACT[dbType] ?? null;
}

/**
 * Convert an array of DB MilestoneType strings to contract enum numbers,
 * silently dropping any with no on-chain counterpart.
 */
export function dbMilestonesToContractEnums(
  dbTypes: DbMilestoneType[],
): ContractMilestoneType[] {
  return dbTypes
    .map(dbMilestoneToContractEnum)
    .filter((v): v is ContractMilestoneType => v !== null);
}
