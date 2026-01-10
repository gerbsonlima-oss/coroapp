# Security Best Practices - Multi-Tenant Architecture

## 1. Row Level Security (RLS) - CRITICAL

### ✅ Enable RLS on ALL tenant-scoped tables

```sql
ALTER TABLE events ENABLE ROW LEVEL SECURITY;
ALTER TABLE songs ENABLE ROW LEVEL SECURITY;
ALTER TABLE song_types ENABLE ROW LEVEL SECURITY;
ALTER TABLE song_audios ENABLE ROW LEVEL SECURITY;
ALTER TABLE rehearsals ENABLE ROW LEVEL SECURITY;
ALTER TABLE event_songs ENABLE ROW LEVEL SECURITY;
ALTER TABLE event_song_types ENABLE ROW LEVEL SECURITY;
ALTER TABLE rehearsal_attendance ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_roles ENABLE ROW LEVEL SECURITY;
```

### ✅ Default DENY policy

Always create a restrictive default policy first:

```sql
CREATE POLICY "Deny all by default"
ON events FOR ALL
USING (false)
WITH CHECK (false);
```

Then add specific ALLOW policies.

### ✅ Tenant ID Validation in Policies

Always check that user's tenant matches data's tenant:

```sql
-- BAD (incomplete)
CREATE POLICY "Users can view events"
ON events FOR SELECT
USING (true); -- ❌ No tenant check!

-- GOOD
CREATE POLICY "Users can view events in their tenant"
ON events FOR SELECT
USING (
  tenant_id = (
    SELECT tenant_id FROM profiles 
    WHERE id = auth.uid()
  )
);
```

---

## 2. Data Isolation Patterns

### ✅ Always filter by tenant_id

```typescript
// ❌ WRONG - No tenant filter
const { data } = await supabase
  .from("songs")
  .select("*");

// ✅ CORRECT - Filter by tenant
const { data } = await supabase
  .from("songs")
  .select("*")
  .eq("tenant_id", currentTenantId);
```

### ✅ Tenant ID from Context, NOT from user input

```typescript
// ❌ WRONG - Trusts user input
const tenantId = new URLSearchParams(location.search).get("tenantId");
const { data } = await supabase
  .from("songs")
  .select("*")
  .eq("tenant_id", tenantId);

// ✅ CORRECT - Uses TenantContext
const { tenantId } = useTenant();
const { data } = await supabase
  .from("songs")
  .select("*")
  .eq("tenant_id", tenantId);
```

### ✅ Junction tables MUST have tenant_id

Every table that holds references across tenants needs tenant_id:

```typescript
// ❌ WRONG
event_songs {
  event_id ← events (has tenant_id)
  song_id ← songs (has tenant_id)
  // No tenant_id!
}

// ✅ CORRECT
event_songs {
  event_id ← events (has tenant_id)
  song_id ← songs (has tenant_id)
  tenant_id ← tenants (PK check)
}
```

---

## 3. Authentication & Authorization

### ✅ Verify user is authenticated

```typescript
// ❌ WRONG - No auth check
const getSongs = async () => {
  const { data } = await supabase
    .from("songs")
    .select("*");
};

// ✅ CORRECT
const getSongs = async () => {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");
  
  const { data } = await supabase
    .from("songs")
    .select("*")
    .eq("tenant_id", userTenantId);
};
```

### ✅ Check role for sensitive operations

```typescript
// ❌ WRONG - No role check
const deleteSong = async (id: string) => {
  await supabase.from("songs").delete().eq("id", id);
};

// ✅ CORRECT
const deleteSong = async (id: string) => {
  const { data: { user } } = await supabase.auth.getUser();
  const { data: isAdmin } = await supabase.rpc("is_tenant_admin", {
    _user_id: user.id,
    _tenant_id: tenantId,
  });
  
  if (!isAdmin) throw new Error("Only admins can delete");
  
  await supabase
    .from("songs")
    .delete()
    .eq("id", id)
    .eq("tenant_id", tenantId);
};
```

### ✅ Super Admin operations need extra validation

```typescript
const copyTenantData = async (
  sourceTenantId: string,
  targetTenantId: string
) => {
  const { data: { user } } = await supabase.auth.getUser();
  
  // Check SUPER_ADMIN role (not tenant-scoped)
  const { data: isSuperAdmin } = await supabase.rpc("is_super_admin", {
    _user_id: user.id,
  });
  
  if (!isSuperAdmin) {
    throw new Error("Only super admins can copy data");
  }
  
  // Verify both tenants exist
  const { data: sourceTenant } = await supabase
    .from("tenants")
    .select("id")
    .eq("id", sourceTenantId)
    .single();
  
  const { data: targetTenant } = await supabase
    .from("tenants")
    .select("id")
    .eq("id", targetTenantId)
    .single();
  
  if (!sourceTenant || !targetTenant) {
    throw new Error("Source or target tenant not found");
  }
  
  // Proceed with copy
};
```

---

## 4. Common Security Vulnerabilities

### 🔴 Vulnerability 1: Tenant ID Leakage in URLs

```typescript
// ❌ WRONG - Tenant ID in query param
// /events?tenantId=abc123&id=song-id

// ✅ CORRECT - Tenant from path or context
// /:tenantSlug/songs/:id
const { tenantSlug } = useParams();
const { tenantId } = useTenant(); // Verified server-side
```

### 🔴 Vulnerability 2: Missing tenant_id in WHERE clause

```typescript
// ❌ WRONG - Can query across tenants
const { data } = await supabase
  .from("songs")
  .select("*")
  .eq("id", songId);
  // Missing: .eq("tenant_id", tenantId)

// ✅ CORRECT
const { data } = await supabase
  .from("songs")
  .select("*")
  .eq("id", songId)
  .eq("tenant_id", tenantId)
  .single();
```

### 🔴 Vulnerability 3: Trusting client-side role checks

```typescript
// ❌ WRONG - Role stored in frontend
if (localStorage.getItem("user-role") === "admin") {
  // Show delete button
}

// ✅ CORRECT - Verify on backend via RPC
const { data: isAdmin } = await supabase.rpc("is_tenant_admin", {
  _user_id: user.id,
  _tenant_id: tenantId,
});

if (isAdmin) {
  // Show delete button + backend validates before delete
}
```

### 🔴 Vulnerability 4: No audit logging

```typescript
// ❌ WRONG
const deleteSong = async (id: string) => {
  await supabase.from("songs").delete().eq("id", id);
  // No trace of who deleted what
};

// ✅ CORRECT
const deleteSong = async (id: string) => {
  const { data: { user } } = await supabase.auth.getUser();
  
  // Log the action
  await supabase.from("audit_logs").insert({
    user_id: user.id,
    tenant_id: tenantId,
    action: "delete_song",
    entity_type: "song",
    entity_id: id,
    ip_address: userIp,
    user_agent: userAgent,
  });
  
  // Then delete
  await supabase
    .from("songs")
    .delete()
    .eq("id", id)
    .eq("tenant_id", tenantId);
};
```

---

## 5. Data Protection

### ✅ Sensitive fields should be restricted

```sql
-- Example: passwords should never be queried
CREATE POLICY "Never expose password fields"
ON profiles FOR SELECT
USING (true)
WITH CHECK (true)
SELECT id, full_name, email, naipe, birth_date, parish, phone; -- Exclude sensitive

-- Or use view for non-sensitive columns
CREATE VIEW public_profiles AS
SELECT id, full_name, email, naipe, parish
FROM profiles;
```

### ✅ PII (Personally Identifiable Information) should be encrypted

```sql
-- Future improvement: encrypt sensitive fields
-- Requires pgcrypto extension
CREATE EXTENSION IF NOT EXISTS pgcrypto;

ALTER TABLE profiles 
ADD COLUMN phone_encrypted bytea;

-- Encrypt on insert/update
UPDATE profiles SET phone_encrypted = pgp_sym_encrypt(phone, 'secret-key')
WHERE phone IS NOT NULL;
```

### ✅ Soft deletes for audit trail

```sql
-- Add deleted_at for audit trail
ALTER TABLE songs ADD COLUMN deleted_at TIMESTAMP;

-- Exclude deleted in queries
CREATE POLICY "Don't show deleted songs"
ON songs FOR SELECT
USING (deleted_at IS NULL);

-- Soft delete function
CREATE FUNCTION soft_delete_song(song_id UUID) RETURNS void AS $$
BEGIN
  UPDATE songs SET deleted_at = NOW() WHERE id = song_id;
  INSERT INTO audit_logs (...) VALUES (...);
END;
$$ LANGUAGE plpgsql;
```

---

## 6. Monitoring & Alerts

### ✅ Log all sensitive operations

Create audit trail for:
- User sign up / sign in
- Role changes
- Data copy operations
- Administrative actions

```sql
INSERT INTO audit_logs (
  user_id, tenant_id, action, entity_type, entity_id, ip_address
) VALUES (?, ?, ?, ?, ?, ?);
```

### ✅ Set up alerts for suspicious activity

```typescript
// Monitor for:
// - Failed login attempts
// - Role escalation attempts
// - Bulk delete operations
// - Copy data between tenants
// - Super admin login

const checkAnomalousActivity = async (userId: string) => {
  const { data: logs } = await supabase
    .from("audit_logs")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(100);
  
  // Analyze patterns
  // Alert if suspicious
};
```

---

## 7. Deployment Checklist

- [ ] RLS enabled on ALL tenant-scoped tables
- [ ] Default DENY policies in place
- [ ] Tenant ID validation in all policies
- [ ] Junction tables have tenant_id
- [ ] Audit logging implemented
- [ ] All queries include tenant_id filter
- [ ] Frontend uses TenantContext, not user input
- [ ] Roles verified server-side (via RPC)
- [ ] Super admin operations validated
- [ ] Sensitive data protected/encrypted
- [ ] Backup before enabling RLS
- [ ] Test RLS with multiple tenants
- [ ] Monitor logs for RLS violations
- [ ] Document security model for team

---

## 8. Incident Response

### If data isolation is compromised:

1. **Immediately disable affected table**
   ```sql
   ALTER TABLE songs DISABLE ROW LEVEL SECURITY;
   ALTER TABLE songs ENABLE ROW LEVEL SECURITY;
   -- Review policies
   ```

2. **Check audit logs for access**
   ```sql
   SELECT * FROM audit_logs
   WHERE action = 'unauthorized_access'
   ORDER BY created_at DESC;
   ```

3. **Notify affected tenants**
   - Which tenant data was accessed
   - When it was accessed
   - What information was exposed

4. **Review and strengthen policies**
   - Test with multiple users
   - Load test policies
   - Penetration test

---

## 9. References

- [Supabase RLS Documentation](https://supabase.com/docs/guides/auth/row-level-security)
- [OWASP Multi-Tenancy](https://owasp.org/www-community/attacks/Insecure_Direct_Object_Reference)
- [PostgreSQL Security](https://www.postgresql.org/docs/current/sql-syntax.html)
