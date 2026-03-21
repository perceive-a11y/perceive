-- CreateIndex
CREATE INDEX "Scan_merchantId_status_idx" ON "Scan"("merchantId", "status");

-- CreateIndex
CREATE INDEX "Scan_merchantId_startedAt_idx" ON "Scan"("merchantId", "startedAt");

-- CreateIndex
CREATE INDEX "Finding_scanId_idx" ON "Finding"("scanId");

-- CreateIndex
CREATE INDEX "Finding_scanId_criterionId_idx" ON "Finding"("scanId", "criterionId");

-- CreateIndex
CREATE INDEX "Finding_scanId_severity_idx" ON "Finding"("scanId", "severity");
