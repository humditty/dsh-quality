export interface VerificationObligation {
  id: string;
  kind: "test";
  required: boolean;
  scope: string[];
  inputDigest: string;
  reason: string;
}

export interface QualityPlan {
  id: string;
  changeSetId: string;
  digest: string;
  obligations: VerificationObligation[];
  createdAt: Date;
}
