
-- =============================================
-- FIX 1: Remove unauthenticated access from rehearsals and rehearsal_attendance
-- These contain private scheduling data that should require authentication
-- =============================================

-- Rehearsals: remove auth.uid() IS NULL
DROP POLICY IF EXISTS "Users can view rehearsals in their tenant" ON rehearsals;
CREATE POLICY "Users can view rehearsals in their tenant"
ON rehearsals FOR SELECT
TO authenticated
USING (tenant_id = get_user_tenant_id(auth.uid()));

-- Rehearsal attendance: remove auth.uid() IS NULL  
DROP POLICY IF EXISTS "Users can view rehearsal attendance in their tenant" ON rehearsal_attendance;
CREATE POLICY "Users can view rehearsal attendance in their tenant"
ON rehearsal_attendance FOR SELECT
TO authenticated
USING (EXISTS (
  SELECT 1 FROM rehearsals r
  WHERE r.id = rehearsal_attendance.rehearsal_id
  AND r.tenant_id = get_user_tenant_id(auth.uid())
));

-- =============================================
-- FIX 2: Restrict choir_members SELECT to admins only
-- Contains PII: email, phone, birth_date, parish
-- =============================================

DROP POLICY IF EXISTS "Users can view choir_members of their tenant" ON choir_members;
CREATE POLICY "Admins can view choir_members of their tenant"
ON choir_members FOR SELECT
TO authenticated
USING (
  is_tenant_admin(auth.uid(), tenant_id)
  OR is_super_admin(auth.uid())
);
