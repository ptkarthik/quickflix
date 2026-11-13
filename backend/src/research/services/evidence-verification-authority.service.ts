import { Injectable, Logger } from '@nestjs/common';
import * as crypto from 'crypto';
import {
  VerificationActorRole,
  VerificationTicket,
  ValidatorProof,
  HistoricalVerificationStatus
} from '../evidence/indian-ott-evidence.interface';

export class UnauthorizedVerificationError extends Error {
  constructor(message: string) {
    super(`[VerificationAuthority] ${message}`);
    this.name = 'UnauthorizedVerificationError';
  }
}

@Injectable()
export class EvidenceVerificationAuthorityService {
  private readonly logger = new Logger(EvidenceVerificationAuthorityService.name);

  // Cryptographically strong internal secret key unique to the active process lifetime
  private readonly internalSecret: string;

  // Active tickets index to enforce ticket single-use or lifecycle revocation
  private readonly issuedTickets = new Map<string, VerificationTicket>();

  // Track used tickets to prevent replay attacks
  private readonly consumedTickets = new Set<string>();

  constructor() {
    this.internalSecret = process.env.VERIFICATION_AUTHORITY_SECRET || crypto.randomBytes(32).toString('hex');
  }

  /**
   * Issue a cryptographically signed VerificationTicket for an authorized internal actor.
   */
  public issueTicket(
    actorId: string,
    role: VerificationActorRole,
    ttlSeconds = 300
  ): VerificationTicket {
    const ticketId = `ticket:${crypto.randomBytes(16).toString('hex')}`;
    const issuedAt = new Date().toISOString();
    const expiresAt = new Date(Date.now() + ttlSeconds * 1000).toISOString();

    const payload = `${ticketId}:${actorId}:${role}:${issuedAt}:${expiresAt}`;
    const signature = crypto
      .createHmac('sha256', this.internalSecret)
      .update(payload)
      .digest('hex');

    const ticket: VerificationTicket = {
      ticketId,
      actorId,
      actorRole: role,
      issuedAt,
      expiresAt,
      signature
    };

    this.issuedTickets.set(ticketId, ticket);
    return ticket;
  }

  /**
   * Validate a VerificationTicket presented by an internal caller.
   */
  public validateTicket(
    ticket: VerificationTicket | undefined | null,
    allowedRoles: VerificationActorRole[] = [
      'INTERNAL_AUDITOR',
      'REGISTRY_SUPERVISOR',
      'EXHIBITION_AUDITOR',
      'SYSTEM_VERIFIER'
    ],
    consumeTicket = false
  ): { isValid: boolean; reason?: string } {
    if (!ticket || !ticket.ticketId || !ticket.signature || !ticket.actorRole) {
      return { isValid: false, reason: 'MISSING_OR_MALFORMED_TICKET' };
    }

    if (!allowedRoles.includes(ticket.actorRole)) {
      return {
        isValid: false,
        reason: `ROLE_UNAUTHORIZED: Role "${ticket.actorRole}" is not permitted for this operation.`
      };
    }

    if (new Date(ticket.expiresAt).getTime() < Date.now()) {
      return { isValid: false, reason: 'TICKET_EXPIRED' };
    }

    if (this.consumedTickets.has(ticket.ticketId)) {
      return { isValid: false, reason: 'TICKET_ALREADY_CONSUMED' };
    }

    const payload = `${ticket.ticketId}:${ticket.actorId}:${ticket.actorRole}:${ticket.issuedAt}:${ticket.expiresAt}`;
    const expectedSignature = crypto
      .createHmac('sha256', this.internalSecret)
      .update(payload)
      .digest('hex');

    if (ticket.signature !== expectedSignature) {
      return { isValid: false, reason: 'INVALID_CRYPTOGRAPHIC_SIGNATURE' };
    }

    if (consumeTicket) {
      this.consumedTickets.add(ticket.ticketId);
    }

    return { isValid: true };
  }

  /**
   * Generate an authoritative ValidatorProof bound to candidateId and verified properties.
   * This proof is passed from IndianOttRegistry to OttValidatorService to prevent direct validator bypass.
   */
  public generateValidatorProof(
    candidateId: string,
    properties: {
      isClaimContentVerified: boolean;
      theatricalRunExplicitlyEnded: boolean;
      directToOttVerified: boolean;
      historicalVerificationStatus?: HistoricalVerificationStatus;
    }
  ): ValidatorProof {
    const proofId = `proof:${crypto.randomBytes(16).toString('hex')}`;
    const issuedAt = new Date().toISOString();

    const payload = `${proofId}:${candidateId}:${JSON.stringify(properties)}:${issuedAt}`;
    const signature = crypto
      .createHmac('sha256', this.internalSecret)
      .update(payload)
      .digest('hex');

    return {
      proofId,
      candidateId,
      issuedAt,
      verifiedProperties: { ...properties },
      signature
    };
  }

  /**
   * Validate a ValidatorProof presented to OttValidatorService.
   */
  public validateValidatorProof(
    candidateId: string,
    proof: ValidatorProof | undefined | null,
    expectedProperties?: {
      isClaimContentVerified?: boolean;
      theatricalRunExplicitlyEnded?: boolean;
      directToOttVerified?: boolean;
      historicalVerificationStatus?: HistoricalVerificationStatus;
    }
  ): { isValid: boolean; reason?: string } {
    if (!proof || !proof.proofId || !proof.signature || !proof.candidateId) {
      return { isValid: false, reason: 'MISSING_VALIDATOR_PROOF' };
    }

    if (proof.candidateId !== candidateId) {
      return {
        isValid: false,
        reason: `CANDIDATE_ID_MISMATCH: Proof candidateId "${proof.candidateId}" does not match validation input "${candidateId}".`
      };
    }

    const payload = `${proof.proofId}:${proof.candidateId}:${JSON.stringify(proof.verifiedProperties)}:${proof.issuedAt}`;
    const expectedSignature = crypto
      .createHmac('sha256', this.internalSecret)
      .update(payload)
      .digest('hex');

    if (proof.signature !== expectedSignature) {
      return { isValid: false, reason: 'INVALID_PROOF_SIGNATURE' };
    }

    if (expectedProperties) {
      if (
        expectedProperties.isClaimContentVerified !== undefined &&
        proof.verifiedProperties.isClaimContentVerified !== expectedProperties.isClaimContentVerified
      ) {
        return {
          isValid: false,
          reason: `VALIDATOR_PROOF_PROPERTIES_MISMATCH: isClaimContentVerified expected ${expectedProperties.isClaimContentVerified} but proof has ${proof.verifiedProperties.isClaimContentVerified}`
        };
      }
      if (
        expectedProperties.theatricalRunExplicitlyEnded !== undefined &&
        proof.verifiedProperties.theatricalRunExplicitlyEnded !== expectedProperties.theatricalRunExplicitlyEnded
      ) {
        return {
          isValid: false,
          reason: `VALIDATOR_PROOF_PROPERTIES_MISMATCH: theatricalRunExplicitlyEnded expected ${expectedProperties.theatricalRunExplicitlyEnded} but proof has ${proof.verifiedProperties.theatricalRunExplicitlyEnded}`
        };
      }
      if (
        expectedProperties.directToOttVerified !== undefined &&
        proof.verifiedProperties.directToOttVerified !== expectedProperties.directToOttVerified
      ) {
        return {
          isValid: false,
          reason: `VALIDATOR_PROOF_PROPERTIES_MISMATCH: directToOttVerified expected ${expectedProperties.directToOttVerified} but proof has ${proof.verifiedProperties.directToOttVerified}`
        };
      }
      if (
        expectedProperties.historicalVerificationStatus !== undefined &&
        proof.verifiedProperties.historicalVerificationStatus !== expectedProperties.historicalVerificationStatus
      ) {
        return {
          isValid: false,
          reason: `VALIDATOR_PROOF_PROPERTIES_MISMATCH: historicalVerificationStatus expected ${expectedProperties.historicalVerificationStatus} but proof has ${proof.verifiedProperties.historicalVerificationStatus}`
        };
      }
    }

    return { isValid: true };
  }

  /**
   * Helper to assert ticket validity and throw UnauthorizedVerificationError if invalid.
   */
  public assertTicket(
    ticket: VerificationTicket | undefined | null,
    operationName: string,
    allowedRoles?: VerificationActorRole[],
    consumeTicket = false
  ): void {
    const result = this.validateTicket(ticket, allowedRoles, consumeTicket);
    if (!result.isValid) {
      throw new UnauthorizedVerificationError(
        `Unauthorized access to "${operationName}": ${result.reason}`
      );
    }
  }
}

