import {
  EvidenceVerificationAuthorityService,
  UnauthorizedVerificationError
} from './evidence-verification-authority.service';

describe('EvidenceVerificationAuthorityService', () => {
  let service: EvidenceVerificationAuthorityService;

  beforeEach(() => {
    service = new EvidenceVerificationAuthorityService();
  });

  describe('Ticket Issuance & Validation', () => {
    it('should issue a cryptographically signed ticket with valid HMAC', () => {
      const ticket = service.issueTicket('sec-auditor-1', 'INTERNAL_AUDITOR', 300);

      expect(ticket.ticketId).toBeDefined();
      expect(ticket.ticketId.startsWith('ticket:')).toBe(true);
      expect(ticket.actorId).toBe('sec-auditor-1');
      expect(ticket.actorRole).toBe('INTERNAL_AUDITOR');
      expect(ticket.signature).toBeDefined();

      const validation = service.validateTicket(ticket);
      expect(validation.isValid).toBe(true);
    });

    it('should reject a ticket with an invalid signature (tampered payload)', () => {
      const ticket = service.issueTicket('sec-auditor-1', 'INTERNAL_AUDITOR', 300);
      const tamperedTicket = { ...ticket, actorRole: 'REGISTRY_SUPERVISOR' as const };

      const validation = service.validateTicket(tamperedTicket);
      expect(validation.isValid).toBe(false);
      expect(validation.reason).toBe('INVALID_CRYPTOGRAPHIC_SIGNATURE');
    });

    it('should reject an expired ticket', () => {
      const ticket = service.issueTicket('sec-auditor-1', 'INTERNAL_AUDITOR', -10); // already expired

      const validation = service.validateTicket(ticket);
      expect(validation.isValid).toBe(false);
      expect(validation.reason).toBe('TICKET_EXPIRED');
    });

    it('should enforce role restrictions', () => {
      const ticket = service.issueTicket('operator-1', 'SYSTEM_VERIFIER', 300);

      const validRole = service.validateTicket(ticket, ['SYSTEM_VERIFIER']);
      expect(validRole.isValid).toBe(true);

      const invalidRole = service.validateTicket(ticket, ['REGISTRY_SUPERVISOR']);
      expect(invalidRole.isValid).toBe(false);
      expect(invalidRole.reason).toContain('ROLE_UNAUTHORIZED');
    });

    it('should reject consumed ticket if consumeTicket=true is requested', () => {
      const ticket = service.issueTicket('operator-2', 'INTERNAL_AUDITOR', 300);

      const firstUse = service.validateTicket(ticket, undefined, true);
      expect(firstUse.isValid).toBe(true);

      const secondUse = service.validateTicket(ticket, undefined, true);
      expect(secondUse.isValid).toBe(false);
      expect(secondUse.reason).toBe('TICKET_ALREADY_CONSUMED');
    });

    it('should throw UnauthorizedVerificationError when assertTicket fails', () => {
      const ticket = service.issueTicket('operator-1', 'SYSTEM_VERIFIER', 300);

      expect(() => {
        service.assertTicket(ticket, 'admin-action', ['REGISTRY_SUPERVISOR']);
      }).toThrow(UnauthorizedVerificationError);
    });
  });

  describe('ValidatorProof Issuance & Validation', () => {
    it('should generate and validate a valid ValidatorProof bound to candidateId', () => {
      const properties = {
        isClaimContentVerified: true,
        theatricalRunExplicitlyEnded: true,
        directToOttVerified: false,
        historicalVerificationStatus: 'VERIFIED_NO_PRIOR_PREMIERE' as const
      };

      const proof = service.generateValidatorProof('cand:movie:kalki2898ad:2024', properties);
      expect(proof.proofId).toBeDefined();
      expect(proof.candidateId).toBe('cand:movie:kalki2898ad:2024');
      expect(proof.verifiedProperties).toEqual(properties);

      const result = service.validateValidatorProof('cand:movie:kalki2898ad:2024', proof, properties);
      expect(result.isValid).toBe(true);
    });

    it('should reject proof if candidateId does not match validation input', () => {
      const properties = {
        isClaimContentVerified: true,
        theatricalRunExplicitlyEnded: false,
        directToOttVerified: true
      };

      const proof = service.generateValidatorProof('cand:movie:kalki2898ad:2024', properties);
      const result = service.validateValidatorProof('cand:movie:other-movie:2024', proof);

      expect(result.isValid).toBe(false);
      expect(result.reason).toContain('CANDIDATE_ID_MISMATCH');
    });

    it('should reject proof if signature is invalid or tampered', () => {
      const properties = {
        isClaimContentVerified: true,
        theatricalRunExplicitlyEnded: false,
        directToOttVerified: true
      };

      const proof = service.generateValidatorProof('cand:movie:kalki2898ad:2024', properties);
      const tamperedProof = {
        ...proof,
        verifiedProperties: { ...properties, isClaimContentVerified: false }
      };

      const result = service.validateValidatorProof('cand:movie:kalki2898ad:2024', tamperedProof);
      expect(result.isValid).toBe(false);
      expect(result.reason).toBe('INVALID_PROOF_SIGNATURE');
    });

    it('should reject proof if expectedProperties do not strictly match proof properties', () => {
      const properties = {
        isClaimContentVerified: false,
        theatricalRunExplicitlyEnded: false,
        directToOttVerified: false
      };

      // Authority generated proof certifying that properties are FALSE
      const proof = service.generateValidatorProof('cand:movie:unverified:2025', properties);

      // Caller claims to the validator that isClaimContentVerified is TRUE
      const result = service.validateValidatorProof('cand:movie:unverified:2025', proof, {
        isClaimContentVerified: true
      });

      expect(result.isValid).toBe(false);
      expect(result.reason).toContain('VALIDATOR_PROOF_PROPERTIES_MISMATCH');
    });
  });
});
