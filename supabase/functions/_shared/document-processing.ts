/** States that still own processing capacity and can be cancelled. */
export const ACTIVE_DOCUMENT_PROCESSING_STATUSES = [
  "awaiting_upload",
  "queued",
  "submitting",
  "processing",
  "validating",
  "publishing",
];
