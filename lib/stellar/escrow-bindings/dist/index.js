import { Buffer } from "buffer";
import { Client as ContractClient, Spec as ContractSpec, } from "@stellar/stellar-sdk/contract";
export * from "@stellar/stellar-sdk";
export * as contract from "@stellar/stellar-sdk/contract";
export * as rpc from "@stellar/stellar-sdk/rpc";
if (typeof window !== "undefined") {
    //@ts-ignore Buffer exists
    window.Buffer = window.Buffer || Buffer;
}
export const networks = {
    testnet: {
        networkPassphrase: "Test SDF Network ; September 2015",
        contractId: "CCNF3MF3JJAX5ZZNLNJYFHVHJ3HVSNWX2M73IPWPGB7L3NGU6UF3AGL3",
    }
};
export var RefundType;
(function (RefundType) {
    RefundType[RefundType["Full"] = 0] = "Full";
    RefundType[RefundType["Partial"] = 1] = "Partial";
    RefundType[RefundType["Disputed"] = 2] = "Disputed";
    RefundType[RefundType["None"] = 3] = "None";
})(RefundType || (RefundType = {}));
/**
 * Current state of an escrow vault.
 * Mirrors `EscrowStatus` in the MariTrade TypeScript types.
 */
export var EscrowStatus;
(function (EscrowStatus) {
    EscrowStatus[EscrowStatus["Unfunded"] = 0] = "Unfunded";
    EscrowStatus[EscrowStatus["Funded"] = 1] = "Funded";
    EscrowStatus[EscrowStatus["Released"] = 2] = "Released";
    EscrowStatus[EscrowStatus["Refunded"] = 3] = "Refunded";
    EscrowStatus[EscrowStatus["Disputed"] = 4] = "Disputed";
})(EscrowStatus || (EscrowStatus = {}));
/**
 * All milestone types across all logistics roles.
 * Matches `MilestoneType` in `types/index.ts`.
 */
export var MilestoneType;
(function (MilestoneType) {
    MilestoneType[MilestoneType["BookingConfirmed"] = 0] = "BookingConfirmed";
    MilestoneType[MilestoneType["DocumentsSubmittedToCarrier"] = 1] = "DocumentsSubmittedToCarrier";
    MilestoneType[MilestoneType["SpaceOnVesselSecured"] = 2] = "SpaceOnVesselSecured";
    MilestoneType[MilestoneType["ContainerGatedOutOrigin"] = 3] = "ContainerGatedOutOrigin";
    MilestoneType[MilestoneType["ContainerLoadedOnVessel"] = 4] = "ContainerLoadedOnVessel";
    MilestoneType[MilestoneType["VesselClearedToDepart"] = 5] = "VesselClearedToDepart";
    MilestoneType[MilestoneType["VesselDepartedOrigin"] = 6] = "VesselDepartedOrigin";
    MilestoneType[MilestoneType["BillOfLadingIssued"] = 7] = "BillOfLadingIssued";
    MilestoneType[MilestoneType["VesselArrivedAtBerth"] = 8] = "VesselArrivedAtBerth";
    MilestoneType[MilestoneType["VesselArrivedDestination"] = 9] = "VesselArrivedDestination";
    MilestoneType[MilestoneType["ContainerOffloaded"] = 10] = "ContainerOffloaded";
    MilestoneType[MilestoneType["ContainerGatedInDestination"] = 11] = "ContainerGatedInDestination";
    MilestoneType[MilestoneType["CargoReleasedForPickup"] = 12] = "CargoReleasedForPickup";
    MilestoneType[MilestoneType["InTransitToDestination"] = 13] = "InTransitToDestination";
    MilestoneType[MilestoneType["ArrivedAtDeliveryAddress"] = 14] = "ArrivedAtDeliveryAddress";
    MilestoneType[MilestoneType["DeliveredAndSignedOff"] = 15] = "DeliveredAndSignedOff";
    MilestoneType[MilestoneType["BocEntryFiled"] = 16] = "BocEntryFiled";
    MilestoneType[MilestoneType["PortHoldPlacedOrLifted"] = 17] = "PortHoldPlacedOrLifted";
    MilestoneType[MilestoneType["DutiesAndTaxesPaid"] = 18] = "DutiesAndTaxesPaid";
    MilestoneType[MilestoneType["CustomsExaminationRequested"] = 19] = "CustomsExaminationRequested";
    MilestoneType[MilestoneType["CustomsClearanceApproved"] = 20] = "CustomsClearanceApproved";
    MilestoneType[MilestoneType["CargoReadyForCollection"] = 21] = "CargoReadyForCollection";
    MilestoneType[MilestoneType["CargoInspectedAndPacked"] = 22] = "CargoInspectedAndPacked";
    MilestoneType[MilestoneType["CargoStagedForPickup"] = 23] = "CargoStagedForPickup";
    MilestoneType[MilestoneType["CargoHandedOffToCarrier"] = 24] = "CargoHandedOffToCarrier";
    MilestoneType[MilestoneType["CargoPickedUpFromPort"] = 25] = "CargoPickedUpFromPort";
    MilestoneType[MilestoneType["CargoReceivedAtWarehouse"] = 26] = "CargoReceivedAtWarehouse";
    MilestoneType[MilestoneType["IncomingCargoStored"] = 27] = "IncomingCargoStored";
})(MilestoneType || (MilestoneType = {}));
/**
 * Corresponds to `CancellationStage` in `/lib/escrow/cancellation.ts`.
 * Determines refund policy when an escrow is cancelled.
 */
export var CancellationStage;
(function (CancellationStage) {
    CancellationStage[CancellationStage["Unfunded"] = 0] = "Unfunded";
    CancellationStage[CancellationStage["PreDeparture"] = 1] = "PreDeparture";
    CancellationStage[CancellationStage["InTransit"] = 2] = "InTransit";
    CancellationStage[CancellationStage["Delivered"] = 3] = "Delivered";
})(CancellationStage || (CancellationStage = {}));
export const EscrowError = {
    /**
     * Contract has already been initialized (re-init attack prevention).
     */
    1: { message: "AlreadyInitialized" },
    /**
     * Constructor arguments are invalid (zero address, empty milestones, etc.).
     */
    2: { message: "InvalidInitParams" },
    /**
     * Caller is not the importer.
     */
    3: { message: "NotImporter" },
    /**
     * Caller is not the exporter.
     */
    4: { message: "NotExporter" },
    /**
     * Caller is not the MariTrade platform.
     */
    5: { message: "NotPlatform" },
    /**
     * Caller is not an authorized logistics user for this shipment.
     */
    6: { message: "NotAuthorizedLogisticsUser" },
    /**
     * Operation requires both importer and platform to sign.
     */
    7: { message: "RequiresBothPartiesSignature" },
    /**
     * Escrow has already been funded; cannot fund twice.
     */
    8: { message: "AlreadyFunded" },
    /**
     * Escrow must be in Funded state for this operation.
     */
    9: { message: "NotFunded" },
    /**
     * Amount deposited does not match the agreed escrow amount.
     */
    10: { message: "AmountMismatch" },
    /**
     * USDC transfer to the escrow account failed.
     */
    11: { message: "TransferFailed" },
    /**
     * Evidence URI is required when confirming a milestone.
     */
    12: { message: "MissingEvidence" },
    /**
     * This milestone type is not in the required milestones list.
     */
    13: { message: "MilestoneNotRequired" },
    /**
     * This milestone has already been confirmed.
     */
    14: { message: "MilestoneAlreadyConfirmed" },
    /**
     * Attempted to confirm a milestone on a non-active escrow.
     */
    15: { message: "EscrowNotActive" },
    /**
     * Not all required milestones are confirmed yet.
     */
    16: { message: "PriorityMilestonesIncomplete" },
    /**
     * Escrow has already been released or refunded.
     */
    17: { message: "AlreadySettled" },
    /**
     * Release requires importer authorization.
     */
    18: { message: "ReleaseNotAuthorized" },
    /**
     * Cancellation is not allowed at this stage (e.g., DELIVERED).
     */
    19: { message: "CancellationNotAllowed" },
    /**
     * In-transit cancellation requires platform arbitration signature.
     */
    20: { message: "RequiresPlatformArbitration" },
    /**
     * Pre-departure cancellation requires both importer + platform to sign.
     */
    21: { message: "RequiresBothPartiesForPreDeparture" },
    /**
     * Escrow is already in dispute state.
     */
    22: { message: "AlreadyDisputed" },
    /**
     * Only platform can resolve a dispute.
     */
    23: { message: "OnlyPlatformCanResolveDispute" },
    /**
     * Arithmetic overflow or underflow detected.
     */
    24: { message: "ArithmeticError" },
    /**
     * Storage entry not found (contract not initialized for this key).
     */
    25: { message: "NotFound" },
    /**
     * Partial refund basis points must be between 0 and 10_000.
     */
    26: { message: "InvalidBps" }
};
export class Client extends ContractClient {
    options;
    static async deploy(
    /** Constructor/Initialization Args for the contract's `__constructor` method */
    { platform, usdc_token }, 
    /** Options for initializing a Client as well as for calling a method, with extras specific to deploying. */
    options) {
        return ContractClient.deploy({ platform, usdc_token }, options);
    }
    constructor(options) {
        super(new ContractSpec(["AAAAAwAAAAAAAAAAAAAAClJlZnVuZFR5cGUAAAAAAAQAAAAAAAAABEZ1bGwAAAAAAAAAAAAAAAdQYXJ0aWFsAAAAAAEAAAAAAAAACERpc3B1dGVkAAAAAgAAAAAAAAAETm9uZQAAAAM=",
            "AAAAAQAAADxUaGUgZnVsbCBvbi1jaGFpbiBzdGF0ZSBvZiBhIHNpbmdsZSBzaGlwbWVudCdzIGVzY3JvdyB2YXVsdC4AAAAAAAAADEVzY3Jvd1JlY29yZAAAAA0AAABFQW1vdW50IGhlbGQgaW4gZXNjcm93LCBpbiBVU0RDIHN0cm9iZXMgKDEgVVNEQyA9IDEwXzAwMF8wMDAgc3Ryb2JlcykuAAAAAAAABmFtb3VudAAAAAAACwAAAAAAAAASY2FuY2VsbGF0aW9uX3N0YWdlAAAAAAfQAAAAEUNhbmNlbGxhdGlvblN0YWdlAAAAAAAAO01pbGVzdG9uZXMgdGhhdCBoYXZlIGJlZW4gY29uZmlybWVkIGJ5IHRoZSBsb2dpc3RpY3MgY2hhaW4uAAAAABRjb25maXJtZWRfbWlsZXN0b25lcwAAA+oAAAfQAAAAFU1pbGVzdG9uZUNvbmZpcm1hdGlvbgAAAAAAAAAAAAARY3JlYXRlZF9hdF9sZWRnZXIAAAAAAAAEAAAAPkV4cG9ydGVyIChzZWxsZXIpIOKAlCByZWNlaXZlcyB0aGUgVVNEQyBvbiBzdWNjZXNzZnVsIHJlbGVhc2UuAAAAAAAIZXhwb3J0ZXIAAAATAAAAAAAAABBmdW5kZWRfYXRfbGVkZ2VyAAAABAAAACZJbXBvcnRlciAoYnV5ZXIpIOKAlCBmdW5kcyB0aGUgZXNjcm93LgAAAAAACGltcG9ydGVyAAAAEwAAAIBQYXJ0aWFsIHJlZnVuZCBwZXJjZW50YWdlICgw4oCTMTAwKSBhcHBsaWNhYmxlIGluIFBSRV9ERVBBUlRVUkUgc3RhZ2UuClNldCBhdCBjb250cmFjdCBjcmVhdGlvbiB0aW1lIGJ5IHRoZSBpbXBvcnRlciBhbmQgbG9ja2VkLgAAABJwYXJ0aWFsX3JlZnVuZF9icHMAAAAAAAQAAAA4TWFyaVRyYWRlIFN0ZWxsYXIgYWRkcmVzcyDigJQgY28tc2lnbmVyIGZvciBhcmJpdHJhdGlvbi4AAAAIcGxhdGZvcm0AAAATAAAAbk1hcmlUcmFkZSByZWZlcmVuY2UgY29kZSwgZS5nLiAiTVQtMjAyNi0wMDA0MiIuClN0b3JlZCBhcyBhIFNvcm9iYW4gU3RyaW5nIChtYXggMjggY2hhcnMgdG8gZml0IFN0ZWxsYXIgTWVtbykuAAAAAAAOcmVmZXJlbmNlX2NvZGUAAAAAABAAAAB+TGlzdCBvZiBNaWxlc3RvbmVUeXBlcyB0aGUgaW1wb3J0ZXIgcmVxdWlyZXMgYmVmb3JlIGZ1bmRzIGNhbiBiZSByZWxlYXNlZC4KTWF0Y2hlcyBgUHJpb3JpdHlNaWxlc3RvbmVbXWAgaW4gdGhlIFByaXNtYSBzY2hlbWEuAAAAAAATcmVxdWlyZWRfbWlsZXN0b25lcwAAAAPqAAAH0AAAAA1NaWxlc3RvbmVUeXBlAAAAAAAAAAAAAAZzdGF0dXMAAAAAB9AAAAAMRXNjcm93U3RhdHVzAAAAQFVTREMgdG9rZW4gY29udHJhY3QgYWRkcmVzcyAoU0FDIGFkZHJlc3Mgb24gdGhlIHRhcmdldCBuZXR3b3JrKS4AAAAKdXNkY190b2tlbgAAAAAAEw==",
            "AAAAAwAAAFtDdXJyZW50IHN0YXRlIG9mIGFuIGVzY3JvdyB2YXVsdC4KTWlycm9ycyBgRXNjcm93U3RhdHVzYCBpbiB0aGUgTWFyaVRyYWRlIFR5cGVTY3JpcHQgdHlwZXMuAAAAAAAAAAAMRXNjcm93U3RhdHVzAAAABQAAABdObyBmdW5kcyBkZXBvc2l0ZWQgeWV0LgAAAAAIVW5mdW5kZWQAAAAAAAAAMEltcG9ydGVyIGhhcyBkZXBvc2l0ZWQgVVNEQy4gU2hpcG1lbnQgaXMgYWN0aXZlLgAAAAZGdW5kZWQAAAAAAAEAAABHQWxsIHByaW9yaXR5IG1pbGVzdG9uZXMgY29uZmlybWVkOyBpbXBvcnRlciByZWxlYXNlZCBmdW5kcyB0byBleHBvcnRlci4AAAAACFJlbGVhc2VkAAAAAgAAAEJDYW5jZWxsZWQgYmVmb3JlIGRlcGFydHVyZSDigJQgZnVsbCBvciBwYXJ0aWFsIHJlZnVuZCB0byBpbXBvcnRlci4AAAAAAAhSZWZ1bmRlZAAAAAMAAAA8SW4gYXJiaXRyYXRpb24uIE1hcmlUcmFkZSBwbGF0Zm9ybSBpcyByZXNvbHZpbmcgdGhlIGRpc3B1dGUuAAAACERpc3B1dGVkAAAABA==",
            "AAAAAwAAAFxBbGwgbWlsZXN0b25lIHR5cGVzIGFjcm9zcyBhbGwgbG9naXN0aWNzIHJvbGVzLgpNYXRjaGVzIGBNaWxlc3RvbmVUeXBlYCBpbiBgdHlwZXMvaW5kZXgudHNgLgAAAAAAAAANTWlsZXN0b25lVHlwZQAAAAAAABwAAAAAAAAAEEJvb2tpbmdDb25maXJtZWQAAAAAAAAAAAAAABtEb2N1bWVudHNTdWJtaXR0ZWRUb0NhcnJpZXIAAAAAAQAAAAAAAAAUU3BhY2VPblZlc3NlbFNlY3VyZWQAAAACAAAAAAAAABdDb250YWluZXJHYXRlZE91dE9yaWdpbgAAAAADAAAAAAAAABdDb250YWluZXJMb2FkZWRPblZlc3NlbAAAAAAEAAAAAAAAABVWZXNzZWxDbGVhcmVkVG9EZXBhcnQAAAAAAAAFAAAAAAAAABRWZXNzZWxEZXBhcnRlZE9yaWdpbgAAAAYAAAAAAAAAEkJpbGxPZkxhZGluZ0lzc3VlZAAAAAAABwAAAAAAAAAUVmVzc2VsQXJyaXZlZEF0QmVydGgAAAAIAAAAAAAAABhWZXNzZWxBcnJpdmVkRGVzdGluYXRpb24AAAAJAAAAAAAAABJDb250YWluZXJPZmZsb2FkZWQAAAAAAAoAAAAAAAAAG0NvbnRhaW5lckdhdGVkSW5EZXN0aW5hdGlvbgAAAAALAAAAAAAAABZDYXJnb1JlbGVhc2VkRm9yUGlja3VwAAAAAAAMAAAAAAAAABZJblRyYW5zaXRUb0Rlc3RpbmF0aW9uAAAAAAANAAAAAAAAABhBcnJpdmVkQXREZWxpdmVyeUFkZHJlc3MAAAAOAAAAAAAAABVEZWxpdmVyZWRBbmRTaWduZWRPZmYAAAAAAAAPAAAAAAAAAA1Cb2NFbnRyeUZpbGVkAAAAAAAAEAAAAAAAAAAWUG9ydEhvbGRQbGFjZWRPckxpZnRlZAAAAAAAEQAAAAAAAAASRHV0aWVzQW5kVGF4ZXNQYWlkAAAAAAASAAAAAAAAABtDdXN0b21zRXhhbWluYXRpb25SZXF1ZXN0ZWQAAAAAEwAAAAAAAAAYQ3VzdG9tc0NsZWFyYW5jZUFwcHJvdmVkAAAAFAAAAAAAAAAXQ2FyZ29SZWFkeUZvckNvbGxlY3Rpb24AAAAAFQAAAAAAAAAXQ2FyZ29JbnNwZWN0ZWRBbmRQYWNrZWQAAAAAFgAAAAAAAAAUQ2FyZ29TdGFnZWRGb3JQaWNrdXAAAAAXAAAAAAAAABdDYXJnb0hhbmRlZE9mZlRvQ2FycmllcgAAAAAYAAAAAAAAABVDYXJnb1BpY2tlZFVwRnJvbVBvcnQAAAAAAAAZAAAAAAAAABhDYXJnb1JlY2VpdmVkQXRXYXJlaG91c2UAAAAaAAAAAAAAABNJbmNvbWluZ0NhcmdvU3RvcmVkAAAAABs=",
            "AAAAAwAAAHpDb3JyZXNwb25kcyB0byBgQ2FuY2VsbGF0aW9uU3RhZ2VgIGluIGAvbGliL2VzY3Jvdy9jYW5jZWxsYXRpb24udHNgLgpEZXRlcm1pbmVzIHJlZnVuZCBwb2xpY3kgd2hlbiBhbiBlc2Nyb3cgaXMgY2FuY2VsbGVkLgAAAAAAAAAAABFDYW5jZWxsYXRpb25TdGFnZQAAAAAAAAQAAABBRXNjcm93IGNyZWF0ZWQgYnV0IG5vdCB5ZXQgZnVuZGVkIOKAlCBmdWxsIHJlZnVuZCwgaW1wb3J0ZXIgb25seS4AAAAAAAAIVW5mdW5kZWQAAAAAAAAAWkZ1bmRlZCBidXQgY2FyZ28gbm90IHlldCBkZXBhcnRlZCBvcmlnaW4gcG9ydCDigJQgcGFydGlhbCByZWZ1bmQsIGJvdGggcGFydGllcyArIHBsYXRmb3JtLgAAAAAADFByZURlcGFydHVyZQAAAAEAAABHVmVzc2VsIGhhcyBkZXBhcnRlZCDigJQgZGlzcHV0ZWQgcmVmdW5kLCBwbGF0Zm9ybSBhcmJpdHJhdGlvbiByZXF1aXJlZC4AAAAACUluVHJhbnNpdAAAAAAAAAIAAAA1RGVsaXZlcmVkIGFuZCBzaWduZWQgb2ZmIOKAlCBubyBjYW5jZWxsYXRpb24gYWxsb3dlZC4AAAAAAAAJRGVsaXZlcmVkAAAAAAAAAw==",
            "AAAAAQAAAClPbi1jaGFpbiByZWNvcmQgb2YgYSBjb25maXJtZWQgbWlsZXN0b25lLgAAAAAAAAAAAAAVTWlsZXN0b25lQ29uZmlybWF0aW9uAAAAAAAABAAAADpMZWRnZXIgc2VxdWVuY2UgbnVtYmVyIHdoZW4gdGhlIGNvbmZpcm1hdGlvbiB3YXMgcmVjb3JkZWQuAAAAAAATY29uZmlybWVkX2F0X2xlZGdlcgAAAAAEAAAAQ1N0ZWxsYXIgYWRkcmVzcyBvZiB0aGUgbG9naXN0aWNzIHVzZXIgd2hvIGNvbmZpcm1lZCB0aGlzIG1pbGVzdG9uZS4AAAAADGNvbmZpcm1lZF9ieQAAABMAAACASVBGUyBDSUQgb3Igb3RoZXIgVVJJIHBvaW50aW5nIHRvIHRoZSBwcm9vZiBkb2N1bWVudCAvIHBob3RvLgpSZXF1aXJlZCDigJQgbWF0Y2hlcyB0aGUgYGV2aWRlbmNlVXJsYCBydWxlIGZyb20gdGhlIHByb2R1Y3Qgc3BlYy4AAAAMZXZpZGVuY2VfdXJpAAAAEAAAAClUaGUgdHlwZSBvZiBtaWxlc3RvbmUgdGhhdCB3YXMgY29uZmlybWVkLgAAAAAAAA5taWxlc3RvbmVfdHlwZQAAAAAH0AAAAA1NaWxlc3RvbmVUeXBlAAAA",
            "AAAABAAAAAAAAAAAAAAAC0VzY3Jvd0Vycm9yAAAAABoAAABCQ29udHJhY3QgaGFzIGFscmVhZHkgYmVlbiBpbml0aWFsaXplZCAocmUtaW5pdCBhdHRhY2sgcHJldmVudGlvbikuAAAAAAASQWxyZWFkeUluaXRpYWxpemVkAAAAAAABAAAASUNvbnN0cnVjdG9yIGFyZ3VtZW50cyBhcmUgaW52YWxpZCAoemVybyBhZGRyZXNzLCBlbXB0eSBtaWxlc3RvbmVzLCBldGMuKS4AAAAAAAARSW52YWxpZEluaXRQYXJhbXMAAAAAAAACAAAAG0NhbGxlciBpcyBub3QgdGhlIGltcG9ydGVyLgAAAAALTm90SW1wb3J0ZXIAAAAAAwAAABtDYWxsZXIgaXMgbm90IHRoZSBleHBvcnRlci4AAAAAC05vdEV4cG9ydGVyAAAAAAQAAAAlQ2FsbGVyIGlzIG5vdCB0aGUgTWFyaVRyYWRlIHBsYXRmb3JtLgAAAAAAAAtOb3RQbGF0Zm9ybQAAAAAFAAAAPUNhbGxlciBpcyBub3QgYW4gYXV0aG9yaXplZCBsb2dpc3RpY3MgdXNlciBmb3IgdGhpcyBzaGlwbWVudC4AAAAAAAAaTm90QXV0aG9yaXplZExvZ2lzdGljc1VzZXIAAAAAAAYAAAA2T3BlcmF0aW9uIHJlcXVpcmVzIGJvdGggaW1wb3J0ZXIgYW5kIHBsYXRmb3JtIHRvIHNpZ24uAAAAAAAcUmVxdWlyZXNCb3RoUGFydGllc1NpZ25hdHVyZQAAAAcAAAAyRXNjcm93IGhhcyBhbHJlYWR5IGJlZW4gZnVuZGVkOyBjYW5ub3QgZnVuZCB0d2ljZS4AAAAAAA1BbHJlYWR5RnVuZGVkAAAAAAAACAAAADJFc2Nyb3cgbXVzdCBiZSBpbiBGdW5kZWQgc3RhdGUgZm9yIHRoaXMgb3BlcmF0aW9uLgAAAAAACU5vdEZ1bmRlZAAAAAAAAAkAAAA5QW1vdW50IGRlcG9zaXRlZCBkb2VzIG5vdCBtYXRjaCB0aGUgYWdyZWVkIGVzY3JvdyBhbW91bnQuAAAAAAAADkFtb3VudE1pc21hdGNoAAAAAAAKAAAAK1VTREMgdHJhbnNmZXIgdG8gdGhlIGVzY3JvdyBhY2NvdW50IGZhaWxlZC4AAAAADlRyYW5zZmVyRmFpbGVkAAAAAAALAAAANUV2aWRlbmNlIFVSSSBpcyByZXF1aXJlZCB3aGVuIGNvbmZpcm1pbmcgYSBtaWxlc3RvbmUuAAAAAAAAD01pc3NpbmdFdmlkZW5jZQAAAAAMAAAAO1RoaXMgbWlsZXN0b25lIHR5cGUgaXMgbm90IGluIHRoZSByZXF1aXJlZCBtaWxlc3RvbmVzIGxpc3QuAAAAABRNaWxlc3RvbmVOb3RSZXF1aXJlZAAAAA0AAAAqVGhpcyBtaWxlc3RvbmUgaGFzIGFscmVhZHkgYmVlbiBjb25maXJtZWQuAAAAAAAZTWlsZXN0b25lQWxyZWFkeUNvbmZpcm1lZAAAAAAAAA4AAAA4QXR0ZW1wdGVkIHRvIGNvbmZpcm0gYSBtaWxlc3RvbmUgb24gYSBub24tYWN0aXZlIGVzY3Jvdy4AAAAPRXNjcm93Tm90QWN0aXZlAAAAAA8AAAAuTm90IGFsbCByZXF1aXJlZCBtaWxlc3RvbmVzIGFyZSBjb25maXJtZWQgeWV0LgAAAAAAHFByaW9yaXR5TWlsZXN0b25lc0luY29tcGxldGUAAAAQAAAALUVzY3JvdyBoYXMgYWxyZWFkeSBiZWVuIHJlbGVhc2VkIG9yIHJlZnVuZGVkLgAAAAAAAA5BbHJlYWR5U2V0dGxlZAAAAAAAEQAAAChSZWxlYXNlIHJlcXVpcmVzIGltcG9ydGVyIGF1dGhvcml6YXRpb24uAAAAFFJlbGVhc2VOb3RBdXRob3JpemVkAAAAEgAAADxDYW5jZWxsYXRpb24gaXMgbm90IGFsbG93ZWQgYXQgdGhpcyBzdGFnZSAoZS5nLiwgREVMSVZFUkVEKS4AAAAWQ2FuY2VsbGF0aW9uTm90QWxsb3dlZAAAAAAAEwAAAEBJbi10cmFuc2l0IGNhbmNlbGxhdGlvbiByZXF1aXJlcyBwbGF0Zm9ybSBhcmJpdHJhdGlvbiBzaWduYXR1cmUuAAAAG1JlcXVpcmVzUGxhdGZvcm1BcmJpdHJhdGlvbgAAAAAUAAAARVByZS1kZXBhcnR1cmUgY2FuY2VsbGF0aW9uIHJlcXVpcmVzIGJvdGggaW1wb3J0ZXIgKyBwbGF0Zm9ybSB0byBzaWduLgAAAAAAACJSZXF1aXJlc0JvdGhQYXJ0aWVzRm9yUHJlRGVwYXJ0dXJlAAAAAAAVAAAAI0VzY3JvdyBpcyBhbHJlYWR5IGluIGRpc3B1dGUgc3RhdGUuAAAAAA9BbHJlYWR5RGlzcHV0ZWQAAAAAFgAAACRPbmx5IHBsYXRmb3JtIGNhbiByZXNvbHZlIGEgZGlzcHV0ZS4AAAAdT25seVBsYXRmb3JtQ2FuUmVzb2x2ZURpc3B1dGUAAAAAAAAXAAAAKkFyaXRobWV0aWMgb3ZlcmZsb3cgb3IgdW5kZXJmbG93IGRldGVjdGVkLgAAAAAAD0FyaXRobWV0aWNFcnJvcgAAAAAYAAAAQFN0b3JhZ2UgZW50cnkgbm90IGZvdW5kIChjb250cmFjdCBub3QgaW5pdGlhbGl6ZWQgZm9yIHRoaXMga2V5KS4AAAAITm90Rm91bmQAAAAZAAAAOVBhcnRpYWwgcmVmdW5kIGJhc2lzIHBvaW50cyBtdXN0IGJlIGJldHdlZW4gMCBhbmQgMTBfMDAwLgAAAAAAAApJbnZhbGlkQnBzAAAAAAAa",
            "AAAAAAAAAipEZXBvc2l0IFVTREMgaW50byB0aGUgZXNjcm93IHZhdWx0LgoKUHVsbHMgYGFtb3VudGAgVVNEQyBmcm9tIHRoZSBpbXBvcnRlcidzIHdhbGxldCBpbnRvIHRoZSBjb250cmFjdCBhY2NvdW50CnVzaW5nIHRoZSBTQUMgYHRyYW5zZmVyYCBvcGVyYXRpb24uIFRoZSBpbXBvcnRlciBtdXN0IGhhdmUgYXBwcm92ZWQgdGhlCmFsbG93YW5jZSBvciBiZSBzaWduaW5nIHZpYSBGcmVpZ2h0ZXIgLyBXYWxsZXQgS2l0LgoKQ29ycmVzcG9uZHMgdG8gdGhlICJGdW5kIEVzY3JvdyB2aWEgU3RlbGxhciIgYnV0dG9uIGluIFN0ZXAgNC4KCiMgQXJndW1lbnRzCiogYHJlZmVyZW5jZV9jb2RlYCDigJQgU2hpcG1lbnQgcmVmZXJlbmNlIGNvZGUKKiBgaW1wb3J0ZXJgICAgICAgIOKAlCBNdXN0IG1hdGNoIHRoZSBpbXBvcnRlciBvbiB0aGUgZXNjcm93IHJlY29yZAoKIyBFcnJvcnMKKiBgQWxyZWFkeUZ1bmRlZGAgIOKAlCBFc2Nyb3cgaGFzIGFscmVhZHkgYmVlbiBmdW5kZWQKKiBgTm90SW1wb3J0ZXJgICAgIOKAlCBDYWxsZXIgaXMgbm90IHRoZSBpbXBvcnRlciBvbiB0aGlzIGVzY3JvdwAAAAAABGZ1bmQAAAACAAAAAAAAAA5yZWZlcmVuY2VfY29kZQAAAAAAEAAAAAAAAAAIaW1wb3J0ZXIAAAATAAAAAQAAA+kAAAACAAAH0AAAAAtFc2Nyb3dFcnJvcgA=",
            "AAAAAAAABABDYW5jZWwgdGhlIGVzY3JvdyBhbmQgcmVmdW5kIHRoZSBpbXBvcnRlciBwZXIgdGhlIGNhbmNlbGxhdGlvbiBwb2xpY3kuCgpJbXBsZW1lbnRzIHRoZSBsb2dpYyBmcm9tIGAvbGliL2VzY3Jvdy9jYW5jZWxsYXRpb24udHNgOgoKfCBTdGFnZSAgICAgICAgICB8IEFsbG93ZWQgfCBSZWZ1bmQgICB8IFdobyBjYW4gY2FuY2VsICAgICAgICAgICAgICAgICAgICAgIHwKfC0tLS0tLS0tLS0tLS0tLS18LS0tLS0tLS0tfC0tLS0tLS0tLS18LS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLXwKfCBVTkZVTkRFRCAgICAgICB8IFllcyAgICAgfCBGdWxsICAgICB8IEltcG9ydGVyIG9ubHkgICAgICAgICAgICAgICAgICAgICAgICB8CnwgUFJFX0RFUEFSVFVSRSAgfCBZZXMgICAgIHwgUGFydGlhbCAgfCBJbXBvcnRlciArIFBsYXRmb3JtIG11c3QgYm90aCBzaWduICAgfAp8IElOX1RSQU5TSVQgICAgIHwgWWVzICAgICB8IERpc3B1dGVkIHwgTXVzdCB1c2UgYHJhaXNlX2Rpc3B1dGVgIGZpcnN0ICAgICAgIHwKfCBERUxJVkVSRUQgICAgICB8IE5vICAgICAgfCBOb25lICAgICB8IEJsb2NrZWQgICAgICAgICAgICAgICAgICAgICAgICAgICAgICB8CgojIEFyZ3VtZW50cwoqIGByZWZlcmVuY2VfY29kZWAg4oCUIFNoaXBtZW50IHJlZmVyZW5jZSBjb2RlCiogYGltcG9ydGVyYCAgICAgICDigJQgTXVzdCBtYXRjaCB0aGUgaW1wb3J0ZXIgb24gdGhlIGVzY3JvdwoqIGBwbGF0Zm9ybWAgICAgICAg4oCUIFJlcXVpcmVkIGZvciBQUkVfREVQQVJUVVJFOyBwYXNzIHNhbWUgYWRkcmVzcyBhcyBwbGF0Zm9ybQoKIyBFcnJvcnMKKiBgQ2FuY2VsbGF0aW9uTm90QWxsb3dlZGAgICAgICAgICAgICDigJQgREVMSVZFUkVEIHN0YWdlCiogYFJlcXVpcmVzUGxhdGZvcm1BcmJpdHJhdGlvbmAgICAgICAg4oCUIElOX1RSQU5TSVQ7IHVzZSByYWlzZV9kaXNwdXRlIGluc3RlYWQKKiBgUmVxdWlyZXNCb3RoUGFydGllc0ZvclByZURlcGFydHVyZWDigJQgUFJFX0RFUEFSVFVSRSBuZWVkcyBib3RoIGF1dGhzAAAABmNhbmNlbAAAAAAAAwAAAAAAAAAOcmVmZXJlbmNlX2NvZGUAAAAAABAAAAAAAAAACGltcG9ydGVyAAAAEwAAAAAAAAAIcGxhdGZvcm0AAAATAAAAAQAAA+kAAAACAAAH0AAAAAtFc2Nyb3dFcnJvcgA=",
            "AAAAAAAAAhRSZWxlYXNlIFVTREMgZnJvbSB0aGUgZXNjcm93IHZhdWx0IHRvIHRoZSBleHBvcnRlci4KClRoZSAiUmVsZWFzZSBGdW5kcyIgYnV0dG9uIGluIHRoZSBzaGlwbWVudCBkZXRhaWwgZXNjcm93IHBhbmVsIGNhbGxzIHRoaXMuCkFsbCBwcmlvcml0eSBtaWxlc3RvbmVzIG11c3QgYmUgY29uZmlybWVkIGJlZm9yZSB0aGlzIGlzIHBlcm1pdHRlZC4KCiMgQXJndW1lbnRzCiogYHJlZmVyZW5jZV9jb2RlYCDigJQgU2hpcG1lbnQgcmVmZXJlbmNlIGNvZGUKKiBgaW1wb3J0ZXJgICAgICAgIOKAlCBNdXN0IGJlIHRoZSBpbXBvcnRlciBvbiB0aGlzIGVzY3JvdwoKIyBFcnJvcnMKKiBgUHJpb3JpdHlNaWxlc3RvbmVzSW5jb21wbGV0ZWAg4oCUIE5vdCBhbGwgcmVxdWlyZWQgbWlsZXN0b25lcyBjb25maXJtZWQKKiBgTm90RnVuZGVkYCAgICAgICAgICAgICAgICAgICAg4oCUIEVzY3JvdyBpcyBub3QgaW4gRnVuZGVkIHN0YXRlCiogYEFscmVhZHlTZXR0bGVkYCAgICAgICAgICAgICAgIOKAlCBBbHJlYWR5IHJlbGVhc2VkIG9yIHJlZnVuZGVkAAAAB3JlbGVhc2UAAAAAAgAAAAAAAAAOcmVmZXJlbmNlX2NvZGUAAAAAABAAAAAAAAAACGltcG9ydGVyAAAAEwAAAAEAAAPpAAAAAgAAB9AAAAALRXNjcm93RXJyb3IA",
            "AAAAAAAAADNSZXR1cm4gdGhlIGZ1bGwgZXNjcm93IHJlY29yZCBmb3IgYSBnaXZlbiBzaGlwbWVudC4AAAAACmdldF9lc2Nyb3cAAAAAAAEAAAAAAAAADnJlZmVyZW5jZV9jb2RlAAAAAAAQAAAAAQAAA+kAAAfQAAAADEVzY3Jvd1JlY29yZAAAB9AAAAALRXNjcm93RXJyb3IA",
            "AAAAAAAAAD9SZXR1cm4gdGhlIGN1cnJlbnQgZXNjcm93IHN0YXR1cyBmb3IgYSBzaGlwbWVudCByZWZlcmVuY2UgY29kZS4AAAAACmdldF9zdGF0dXMAAAAAAAEAAAAAAAAADnJlZmVyZW5jZV9jb2RlAAAAAAAQAAAAAQAAA+kAAAfQAAAADEVzY3Jvd1N0YXR1cwAAB9AAAAALRXNjcm93RXJyb3IA",
            "AAAAAAAAAH5SZXR1cm4gdHJ1ZSBpZiBhbGwgcHJpb3JpdHkgbWlsZXN0b25lcyBoYXZlIGJlZW4gY29uZmlybWVkLgpVc2VkIGJ5IHRoZSBmcm9udGVuZCB0byBlbmFibGUvZGlzYWJsZSB0aGUgIlJlbGVhc2UgRnVuZHMiIGJ1dHRvbi4AAAAAAAtjYW5fcmVsZWFzZQAAAAABAAAAAAAAAA5yZWZlcmVuY2VfY29kZQAAAAAAEAAAAAEAAAPpAAAAAQAAB9AAAAALRXNjcm93RXJyb3IA",
            "AAAAAAAAAUVJbml0aWFsaXplIHRoZSBjb250cmFjdCB3aXRoIHRoZSBNYXJpVHJhZGUgcGxhdGZvcm0gYWRkcmVzcyBhbmQgdGhlClVTREMgU0FDIChTdGVsbGFyIEFzc2V0IENvbnRyYWN0KSB0b2tlbiBhZGRyZXNzLgoKQ2FsbGVkIGF1dG9tYXRpY2FsbHkgYXQgZGVwbG95bWVudC4gQ2Fubm90IGJlIGNhbGxlZCBhZ2Fpbi4KCiMgQXJndW1lbnRzCiogYHBsYXRmb3JtYCAgIOKAlCBNYXJpVHJhZGUncyBTdGVsbGFyIGFjY291bnQgKEcuLi4gYWRkcmVzcykKKiBgdXNkY190b2tlbmAg4oCUIFVTREMgU0FDIGFkZHJlc3Mgb24gdGhlIHRhcmdldCBuZXR3b3JrIChDLi4uIGFkZHJlc3MpAAAAAAAADV9fY29uc3RydWN0b3IAAAAAAAACAAAAAAAAAAhwbGF0Zm9ybQAAABMAAAAAAAAACnVzZGNfdG9rZW4AAAAAABMAAAAA",
            "AAAAAAAAASBQbGF0Zm9ybS1vbmx5OiBhZHZhbmNlIHRoZSBjYW5jZWxsYXRpb24gc3RhZ2UgYXMgdGhlIHNoaXBtZW50IHByb2dyZXNzZXMuCgpDYWxsZWQgYnkgTWFyaVRyYWRlIGJhY2tlbmQgd2hlbiBrZXkgbWlsZXN0b25lcyBhcmUgbG9nZ2VkOgotIFZFU1NFTF9ERVBBUlRFRF9PUklHSU4gICDihpIgSU5fVFJBTlNJVAotIERFTElWRVJFRF9BTkRfU0lHTkVEX09GRiDihpIgREVMSVZFUkVECgpUaGlzIGNvbnRyb2xzIHdoaWNoIGNhbmNlbGxhdGlvbiBwb2xpY3kgYXBwbGllcyBwZXIgdGhlIHByb2R1Y3Qgc3BlYy4AAAANYWR2YW5jZV9zdGFnZQAAAAAAAAMAAAAAAAAADnJlZmVyZW5jZV9jb2RlAAAAAAAQAAAAAAAAAAhwbGF0Zm9ybQAAABMAAAAAAAAACW5ld19zdGFnZQAAAAAAB9AAAAARQ2FuY2VsbGF0aW9uU3RhZ2UAAAAAAAABAAAD6QAAAAIAAAfQAAAAC0VzY3Jvd0Vycm9yAA==",
            "AAAAAAAAAzVSZWdpc3RlciBhIG5ldyBzaGlwbWVudCBlc2Nyb3cgdmF1bHQuCgpDYWxsZWQgYnkgdGhlIGltcG9ydGVyIGltbWVkaWF0ZWx5IGFmdGVyIHRoZSBleHBvcnRlciBhY2NlcHRzIHRoZSBkZWFsLgpDb3JyZXNwb25kcyB0byBTdGVwIDQgIkZ1bmQgRXNjcm93IiBpbiB0aGUgTmV3U2hpcG1lbnRQYWdlIGZsb3cg4oCUCnNwZWNpZmljYWxseSB0aGUgcHJlLWZ1bmRpbmcgcmVjb3JkIGNyZWF0aW9uIHN0ZXAuCgojIEFyZ3VtZW50cwoqIGByZWZlcmVuY2VfY29kZWAgICAgICDigJQgTWFyaVRyYWRlIHJlZiBjb2RlIChlLmcuICJNVC0yMDI2LTAwMDQyIikKKiBgaW1wb3J0ZXJgICAgICAgICAgICAg4oCUIEltcG9ydGVyJ3MgU3RlbGxhciBhZGRyZXNzCiogYGV4cG9ydGVyYCAgICAgICAgICAgIOKAlCBFeHBvcnRlcidzIFN0ZWxsYXIgYWRkcmVzcwoqIGBhbW91bnRgICAgICAgICAgICAgICDigJQgVVNEQyBhbW91bnQgaW4gc3Ryb2JlcyAodG90YWxWYWx1ZVVTRCAqIDEwXzAwMF8wMDApCiogYHJlcXVpcmVkX21pbGVzdG9uZXNgIOKAlCBQcmlvcml0eSBtaWxlc3RvbmVzIHRoZSBpbXBvcnRlciBzZWxlY3RzIGluIFN0ZXAgMwoqIGBwYXJ0aWFsX3JlZnVuZF9icHNgICDigJQgUmVmdW5kICUgaWYgY2FuY2VsbGVkIHByZS1kZXBhcnR1cmUgKDDigJMxMF8wMDAgYnBzKQoKIyBFcnJvcnMKKiBgQWxyZWFkeUluaXRpYWxpemVkYCAg4oCUIEVzY3JvdyB3aXRoIHRoaXMgcmVmZXJlbmNlIGNvZGUgYWxyZWFkeSBleGlzdHMKKiBgSW52YWxpZEluaXRQYXJhbXNgICAg4oCUIEVtcHR5IG1pbGVzdG9uZXMsIHplcm8gYW1vdW50LCBvciBpbnZhbGlkIGJwcwAAAAAAAA1jcmVhdGVfZXNjcm93AAAAAAAABgAAAAAAAAAOcmVmZXJlbmNlX2NvZGUAAAAAABAAAAAAAAAACGltcG9ydGVyAAAAEwAAAAAAAAAIZXhwb3J0ZXIAAAATAAAAAAAAAAZhbW91bnQAAAAAAAsAAAAAAAAAE3JlcXVpcmVkX21pbGVzdG9uZXMAAAAD6gAAB9AAAAANTWlsZXN0b25lVHlwZQAAAAAAAAAAAAAScGFydGlhbF9yZWZ1bmRfYnBzAAAAAAAEAAAAAQAAA+kAAAACAAAH0AAAAAtFc2Nyb3dFcnJvcgA=",
            "AAAAAAAAANVFc2NhbGF0ZSBhbiBpbi10cmFuc2l0IHNoaXBtZW50IHRvIGRpc3B1dGVkIHN0YXR1cyBmb3IgcGxhdGZvcm0gYXJiaXRyYXRpb24uCgpPbmx5IGNhbGxhYmxlIGJ5IHRoZSBpbXBvcnRlciB3aGVuIGBjYW5jZWxsYXRpb25fc3RhZ2UgPT0gSU5fVFJBTlNJVGAuCkFmdGVyIHRoaXMsIHRoZSBwbGF0Zm9ybSBjYWxscyBgcmVzb2x2ZV9kaXNwdXRlYCB0byBzcGxpdCBmdW5kcy4AAAAAAAANcmFpc2VfZGlzcHV0ZQAAAAAAAAIAAAAAAAAADnJlZmVyZW5jZV9jb2RlAAAAAAAQAAAAAAAAAAhpbXBvcnRlcgAAABMAAAABAAAD6QAAAAIAAAfQAAAAC0VzY3Jvd0Vycm9yAA==",
            "AAAAAAAAAihQbGF0Zm9ybS1vbmx5OiByZXNvbHZlIGEgZGlzcHV0ZWQgZXNjcm93IGJ5IHNwbGl0dGluZyBmdW5kcy4KCmBpbXBvcnRlcl9icHMgKyBleHBvcnRlcl9icHNgIG11c3QgZXF1YWwgMTBfMDAwICgxMDAlKS4KTWFyaVRyYWRlIHBsYXRmb3JtIGNhbiByZXRhaW4gYSBwb3J0aW9uIGlmIG5lZWRlZCAodmlhIHBsYXRmb3JtX2JwcykuCgojIEFyZ3VtZW50cwoqIGByZWZlcmVuY2VfY29kZWAg4oCUIFNoaXBtZW50IHJlZmVyZW5jZSBjb2RlCiogYHBsYXRmb3JtYCAgICAgICDigJQgTXVzdCBtYXRjaCB0aGUgcGxhdGZvcm0gYWRkcmVzcwoqIGBpbXBvcnRlcl9icHNgICAg4oCUIEJhc2lzIHBvaW50cyB0byByZWZ1bmQgdG8gaW1wb3J0ZXIgKDDigJMxMF8wMDApCiogYGV4cG9ydGVyX2Jwc2AgICDigJQgQmFzaXMgcG9pbnRzIHRvIHBheSB0byBleHBvcnRlciAoMOKAkzEwXzAwMCkKCk5vdGU6IEFueSByZW1haW5kZXIgKDEwXzAwMCAtIGltcG9ydGVyX2JwcyAtIGV4cG9ydGVyX2JwcykgaXMgcmV0YWluZWQKYnkgdGhlIHBsYXRmb3JtIGFzIGFuIGFyYml0cmF0aW9uIGZlZS4AAAAPcmVzb2x2ZV9kaXNwdXRlAAAAAAQAAAAAAAAADnJlZmVyZW5jZV9jb2RlAAAAAAAQAAAAAAAAAAhwbGF0Zm9ybQAAABMAAAAAAAAADGltcG9ydGVyX2JwcwAAAAQAAAAAAAAADGV4cG9ydGVyX2JwcwAAAAQAAAABAAAD6QAAAAIAAAfQAAAAC0VzY3Jvd0Vycm9yAA==",
            "AAAAAAAAA0tSZWNvcmQgYSBjb25maXJtZWQgbWlsZXN0b25lIGV2ZW50IG9uLWNoYWluLgoKT25seSBjYWxsYWJsZSBieSBhbiBhZGRyZXNzIGluIHRoZSBsb2dpc3RpY3MgdXNlcnMgbGlzdCBmb3IgdGhpcyBzaGlwbWVudC4KUmVxdWlyZXMgYW4gZXZpZGVuY2UgVVJJIChJUEZTIENJRCBvciBVUkwpIOKAlCBtYXRjaGVzIHRoZSBwcm9kdWN0IHJ1bGU6CiJQcm9vZiB1cGxvYWQgaXMgUkVRVUlSRUQgZm9yIG1pbGVzdG9uZSBzdWJtaXNzaW9uLiIKCiMgQXJndW1lbnRzCiogYHJlZmVyZW5jZV9jb2RlYCAg4oCUIFNoaXBtZW50IHJlZmVyZW5jZSBjb2RlCiogYGNvbmZpcm1lcmAgICAgICAg4oCUIExvZ2lzdGljcyB1c2VyIGNvbmZpcm1pbmcgdGhpcyBtaWxlc3RvbmUKKiBgbWlsZXN0b25lX3R5cGVgICDigJQgVGhlIE1pbGVzdG9uZVR5cGUgYmVpbmcgY29uZmlybWVkCiogYGV2aWRlbmNlX3VyaWAgICAg4oCUIFByb29mIGRvY3VtZW50IFVSSSAoSVBGUyBoYXNoIG9yIEhUVFBTIFVSTCkKCiMgRXJyb3JzCiogYEVzY3Jvd05vdEFjdGl2ZWAgICAgICAgICAgICAg4oCUIEVzY3JvdyBpcyBub3QgaW4gRnVuZGVkIHN0YXRlCiogYE5vdEF1dGhvcml6ZWRMb2dpc3RpY3NVc2VyYCAg4oCUIENhbGxlciBub3QgaW4gbG9naXN0aWNzIHVzZXIgbGlzdAoqIGBNaWxlc3RvbmVOb3RSZXF1aXJlZGAgICAgICAgIOKAlCBNaWxlc3RvbmUgbm90IGluIGltcG9ydGVyJ3MgcHJpb3JpdHkgbGlzdAoqIGBNaWxlc3RvbmVBbHJlYWR5Q29uZmlybWVkYCAgIOKAlCBNaWxlc3RvbmUgYWxyZWFkeSByZWNvcmRlZAoqIGBNaXNzaW5nRXZpZGVuY2VgICAgICAgICAgICAgIOKAlCBFdmlkZW5jZSBVUkkgaXMgZW1wdHkAAAAAEWNvbmZpcm1fbWlsZXN0b25lAAAAAAAABAAAAAAAAAAOcmVmZXJlbmNlX2NvZGUAAAAAABAAAAAAAAAACWNvbmZpcm1lcgAAAAAAABMAAAAAAAAADm1pbGVzdG9uZV90eXBlAAAAAAfQAAAADU1pbGVzdG9uZVR5cGUAAAAAAAAAAAAADGV2aWRlbmNlX3VyaQAAABAAAAABAAAD6QAAAAIAAAfQAAAAC0VzY3Jvd0Vycm9yAA==",
            "AAAAAAAAAZ1Bc3NpZ24gbG9naXN0aWNzIGNoYWluIHVzZXJzIHdobyBhcmUgcGVybWl0dGVkIHRvIGNvbmZpcm0gbWlsZXN0b25lcy4KCkNvcnJlc3BvbmRzIHRvIFN0ZXAgMyAiQXNzaWduIExvZ2lzdGljcyBVc2VycyIgaW4gdGhlIHNoaXBtZW50IGNyZWF0ZSBmbG93LgpDYW4gYmUgY2FsbGVkIG11bHRpcGxlIHRpbWVzIHRvIGFkZCBuZXcgdXNlcnMgKHJlcGxhY2VzIHRoZSBleGlzdGluZyBsaXN0KS4KCiMgQXJndW1lbnRzCiogYHJlZmVyZW5jZV9jb2RlYCDigJQgU2hpcG1lbnQgcmVmZXJlbmNlIGNvZGUKKiBgaW1wb3J0ZXJgICAgICAgIOKAlCBNdXN0IGJlIHRoZSBpbXBvcnRlciB3aG8gY3JlYXRlZCB0aGlzIGVzY3JvdwoqIGB1c2Vyc2AgICAgICAgICAg4oCUIFZlYyBvZiBsb2dpc3RpY3MgdXNlciBTdGVsbGFyIGFkZHJlc3NlcwAAAAAAABZhc3NpZ25fbG9naXN0aWNzX3VzZXJzAAAAAAADAAAAAAAAAA5yZWZlcmVuY2VfY29kZQAAAAAAEAAAAAAAAAAIaW1wb3J0ZXIAAAATAAAAAAAAAAV1c2VycwAAAAAAA+oAAAATAAAAAQAAA+kAAAACAAAH0AAAAAtFc2Nyb3dFcnJvcgA=",
            "AAAAAAAAAIJSZXR1cm4gdGhlIGxpc3Qgb2YgcmVxdWlyZWQgbWlsZXN0b25lcyB0aGF0IGhhdmUgTk9UIHlldCBiZWVuIGNvbmZpcm1lZC4KVXNlZnVsIGZvciB0aGUgc2hpcG1lbnQgZGV0YWlsIHBhZ2UgbWlsZXN0b25lIGdhdGUgcGFuZWwuAAAAAAAWZ2V0X3BlbmRpbmdfbWlsZXN0b25lcwAAAAAAAQAAAAAAAAAOcmVmZXJlbmNlX2NvZGUAAAAAABAAAAABAAAD6QAAA+oAAAfQAAAADU1pbGVzdG9uZVR5cGUAAAAAAAfQAAAAC0VzY3Jvd0Vycm9yAA==",
            "AAAAAAAAADVSZXR1cm4gdGhlIGxpc3Qgb2YgY29uZmlybWVkIG1pbGVzdG9uZSBjb25maXJtYXRpb25zLgAAAAAAABhnZXRfY29uZmlybWVkX21pbGVzdG9uZXMAAAABAAAAAAAAAA5yZWZlcmVuY2VfY29kZQAAAAAAEAAAAAEAAAPpAAAD6gAAB9AAAAAVTWlsZXN0b25lQ29uZmlybWF0aW9uAAAAAAAH0AAAAAtFc2Nyb3dFcnJvcgA=",
            "AAAAAgAAAAAAAAAAAAAAB0RhdGFLZXkAAAAABAAAAAAAAABESW5zdGFuY2Ugc3RvcmFnZTogTWFyaVRyYWRlIHBsYXRmb3JtIGFkZHJlc3MgKGdsb2JhbCwgc2luZ2xlIHZhbHVlKS4AAAAIUGxhdGZvcm0AAAAAAAAAPkluc3RhbmNlIHN0b3JhZ2U6IFVTREMgU0FDIHRva2VuIGFkZHJlc3MgKHNldCBhdCBkZXBsb3kgdGltZSkuAAAAAAAJVXNkY1Rva2VuAAAAAAAAAQAAAElQZXJzaXN0ZW50IHN0b3JhZ2U6IGZ1bGwgZXNjcm93IHJlY29yZCwga2V5ZWQgYnkgc2hpcG1lbnQgcmVmZXJlbmNlIGNvZGUuAAAAAAAABkVzY3JvdwAAAAAAAQAAABAAAAABAAAAb1BlcnNpc3RlbnQgc3RvcmFnZTogc2V0IG9mIFN0ZWxsYXIgYWRkcmVzc2VzIGF1dGhvcml6ZWQgYXMgbG9naXN0aWNzIHVzZXJzCmZvciBhIGdpdmVuIHNoaXBtZW50IHJlZmVyZW5jZSBjb2RlLgAAAAAOTG9naXN0aWNzVXNlcnMAAAAAAAEAAAAQ"]), options);
        this.options = options;
    }
    fromJSON = {
        fund: (this.txFromJSON),
        cancel: (this.txFromJSON),
        release: (this.txFromJSON),
        get_escrow: (this.txFromJSON),
        get_status: (this.txFromJSON),
        can_release: (this.txFromJSON),
        advance_stage: (this.txFromJSON),
        create_escrow: (this.txFromJSON),
        raise_dispute: (this.txFromJSON),
        resolve_dispute: (this.txFromJSON),
        confirm_milestone: (this.txFromJSON),
        assign_logistics_users: (this.txFromJSON),
        get_pending_milestones: (this.txFromJSON),
        get_confirmed_milestones: (this.txFromJSON)
    };
}
