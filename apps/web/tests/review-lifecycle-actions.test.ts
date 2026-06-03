import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { describe, it } from 'node:test';

const REVIEW_LIFECYCLE_ACTIONS_SOURCE = readFileSync(
  new URL(
    '../src/components/review/ReviewLifecycleActions.tsx',
    import.meta.url,
  ),
  'utf8',
);

const CLAIM_VERDICT_FORM_SOURCE = readFileSync(
  new URL(
    '../src/app/(app)/reviewer-inbox/ClaimVerdictForm.tsx',
    import.meta.url,
  ),
  'utf8',
);

const CLAIM_LINEAGE_PAGE_SOURCE = readFileSync(
  new URL('../src/app/(app)/claim/[claimId]/lineage/page.tsx', import.meta.url),
  'utf8',
);

const SIGN_ROUTE_SOURCE = readFileSync(
  new URL(
    '../src/app/api/claim/[claimId]/review/[reviewId]/sign/route.ts',
    import.meta.url,
  ),
  'utf8',
);

describe('ReviewLifecycleActions', () => {
  it('posts to sign and withdraw review lifecycle endpoints', () => {
    assert.match(REVIEW_LIFECYCLE_ACTIONS_SOURCE, /\/review\/\$\{encodeURIComponent\(reviewId\)\}\/\$\{action\}/);
    assert.match(REVIEW_LIFECYCLE_ACTIONS_SOURCE, /action: 'sign' \| 'withdraw'/);
    assert.match(REVIEW_LIFECYCLE_ACTIONS_SOURCE, /reason/);
  });

  it('is reachable from the reviewer inbox after submit and for existing verdicts', () => {
    assert.match(CLAIM_VERDICT_FORM_SOURCE, /ReviewLifecycleActions/);
    assert.match(CLAIM_VERDICT_FORM_SOURCE, /submittedReviewId/);
    assert.match(CLAIM_VERDICT_FORM_SOURCE, /existingReview/);
  });

  it('is reachable from claim lineage for the current reviewer row', () => {
    assert.match(CLAIM_LINEAGE_PAGE_SOURCE, /getPrincipalIdForUser/);
    assert.match(CLAIM_LINEAGE_PAGE_SOURCE, /principalId === r\.reviewerPrincipalId/);
    assert.match(CLAIM_LINEAGE_PAGE_SOURCE, /ReviewLifecycleActions/);
  });
});

describe('claim review sign route', () => {
  it('prefers server-side ORCID identity before client fallback fields', () => {
    assert.match(SIGN_ROUTE_SOURCE, /getOrcidIdentityForUser\(session\.user\.id\)/);
    assert.match(SIGN_ROUTE_SOURCE, /resolveReviewSignatureInput/);
    assert.match(SIGN_ROUTE_SOURCE, /signatureInput\.callerOrcidId/);
    assert.match(SIGN_ROUTE_SOURCE, /signatureInput\.signedPayloadJws/);
  });
});
