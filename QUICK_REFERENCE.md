# Quick Reference - Multi-Tenant Architecture

## 📊 Current State Assessment

| Aspect | Status | Score |
|--------|--------|-------|
| Tenant Schema | ✅ Well-designed | 9/10 |
| Tenant Detection | ✅ Robust | 9/10 |
| Data Isolation | ⚠️ Frontend-only | 6/10 |
| Row-Level Security | ❌ Not implemented | 0/10 |
| Copy Data Feature | ❌ Missing | 0/10 |
| Audit Logging | ❌ Missing | 0/10 |
| **Overall Score** | **⚠️ Needs work** | **7.5/10** |

---

## 🎯 Top 3 Issues to Fix

### 1. 🔴 No RLS (Row-Level Security)
**Risk:** Any authenticated user can theoretically query any tenant's data
**Fix:** Implement RLS policies (1-2 days)
**Impact:** HIGH - Critical security issue

### 2. 🔴 Junction Tables Missing tenant_id
**Risk:** Cross-tenant data references possible
**Tables:** `event_songs`, `event_song_types`, `rehearsal_attendance`
**Fix:** Add `tenant_id` column + migrate data (1 day)
**Impact:** HIGH - Data integrity risk

### 3. 🟡 No Copy Data Feature
**Risk:** Manual copying between tenants prone to error
**Fix:** Build Edge Function + UI (2-3 days)
**Impact:** MEDIUM - Usability issue for admins

---

## ✅ Implementation Checklist

### Week 1: Security
- [ ] Create SQL migration: `001_add_tenant_id_to_junctions.sql`
- [ ] Run migration on production (with backup!)
- [ ] Create SQL migration: `003_implement_rls_policies.sql`
- [ ] Enable RLS on all tables
- [ ] Test RLS with multiple users
- [ ] Document security model

### Week 2: Features
- [ ] Create Edge Function: `copy-tenant-data`
- [ ] Add `useCopyTenantData` hook
- [ ] Extend AdminTenants UI with copy dialog
- [ ] Create SQL migration: `002_create_audit_logs.sql`
- [ ] Implement audit logging in Edge Function

### Week 3+: Polish & Testing
- [ ] Load test with 1000+ records
- [ ] Penetration test data isolation
- [ ] Create monitoring/alerts
- [ ] Document for team
- [ ] Train admins on copy feature

---

## 📁 Key Files by Category

### Architecture & Analysis
- **MULTI_TENANT_ARCHITECTURE_ANALYSIS.md** - Full architectural review
- **DATA_FLOW_DIAGRAMS.md** - Visual data flow representations
- **SECURITY_BEST_PRACTICES.md** - Security guidelines

### Implementation
- **IMPLEMENTATION_GUIDE.md** - Code & SQL to deploy
- **QUICK_REFERENCE.md** - This file

### Code Files to Modify/Create
```
Frontend:
  src/
    ├─ hooks/
    │  └─ useCopyTenantData.tsx [NEW]
    ├─ pages/
    │  └─ AdminTenants.tsx [MODIFY: add copy dialog]
    └─ contexts/
       └─ TenantContext.tsx [REVIEW]

Backend (Supabase):
  supabase/
    ├─ migrations/
    │  ├─ 001_add_tenant_id_to_junctions.sql [NEW]
    │  ├─ 002_create_audit_logs.sql [NEW]
    │  └─ 003_implement_rls_policies.sql [NEW]
    └─ functions/
       └─ copy-tenant-data/
          ├─ index.ts [NEW]
          └─ deno.json [NEW]
```

---

## 🔐 Security Quick Rules

### ALWAYS DO:
```typescript
✅ const { tenantId } = useTenant();
✅ .eq("tenant_id", tenantId)
✅ Check role via RPC before DELETE
✅ Log sensitive operations
✅ Validate on server, not just client
```

### NEVER DO:
```typescript
❌ Trust tenant ID from URL params
❌ Query without tenant_id filter
❌ Skip role checks
❌ Send auth token in response
❌ Hard-code tenant IDs
```

---

## 📋 SQL Commands Reference

### Check RLS Status
```sql
SELECT schemaname, tablename, rowsecurity 
FROM pg_tables 
WHERE schemaname = 'public';
```

### Count Records per Tenant
```sql
SELECT 
  tenant_id,
  COUNT(*) as song_count
FROM songs
GROUP BY tenant_id
ORDER BY song_count DESC;
```

### View Audit Logs
```sql
SELECT 
  user_id,
  action,
  entity_type,
  created_at
FROM audit_logs
WHERE tenant_id = 'uuid-1234'
ORDER BY created_at DESC
LIMIT 50;
```

### Simulate Tenant A accessing Tenant B data
```sql
-- As Tenant A user:
SELECT * FROM songs 
WHERE tenant_id = 'other-tenant-id'
AND created_at > NOW() - INTERVAL '1 day';
-- Result: 0 rows (RLS blocks it)
```

---

## 🚀 Deployment Steps

### Step 1: Backup
```bash
# Backup your Supabase database
# Via Supabase dashboard: Settings → Backups → Create backup
```

### Step 2: Run Migrations
```bash
# Option A: Via Supabase CLI
supabase db push

# Option B: Via SQL Editor in Supabase dashboard
# Copy/paste migration SQL one by one
```

### Step 3: Deploy Edge Function
```bash
supabase functions deploy copy-tenant-data
```

### Step 4: Test
```bash
# Via Supabase SQL Editor:
# 1. Try RLS: SELECT * FROM songs WHERE tenant_id = 'other-tenant';
# 2. Should return 0 rows if RLS working

# Via frontend:
# 1. User from Quixadá tries to access Fortaleza songs
# 2. Should get error or empty list
```

### Step 5: Monitor
```bash
# Check logs for RLS violations
# Monitor performance (indexes are critical)
# Verify copy function works
```

---

## 🧪 Testing Scenarios

### Scenario 1: Isolate User A from Tenant B
```
1. User A logs into /(quixada)/
2. User A manually tries: /(fortaleza)/songs
3. Expected: Error or empty list (not tenant's data)
4. Verify in browser DevTools: check API response
```

### Scenario 2: Copy 100 Songs
```
1. Superadmin: /admin/tenants → Copy Data
2. Source: Quixadá, Target: Fortaleza
3. Select: All 100 songs
4. Expected: Completes in <10 seconds
5. Verify: Fortaleza has 100 new songs (different IDs)
```

### Scenario 3: Concurrent Users
```
1. Open 2 browsers
2. Browser 1: User A (Quixadá) on /events
3. Browser 2: User B (Fortaleza) on /events
4. Expected: Each sees only their tenant's events
5. Real-time: Changes in one don't affect other
```

---

## 📞 Troubleshooting

### Issue: RLS policy not working
```sql
-- Check if RLS is enabled
SELECT tablename, rowsecurity FROM pg_tables 
WHERE tablename = 'songs';
-- Result should show: rowsecurity = true

-- Check policies
SELECT * FROM pg_policies WHERE tablename = 'songs';
-- Should show multiple policies

-- Test with test user:
SET ROLE authenticated; -- Simulate authenticated user
SELECT * FROM songs; -- Should be blocked if no matching policies
```

### Issue: Copy function returns 403
```
❌ User is not superadmin
→ Check: SELECT * FROM user_roles WHERE user_id = ? AND role = 'super_admin';

❌ Token expired
→ Refresh: supabase.auth.refreshSession()

❌ Function not deployed
→ Deploy: supabase functions deploy copy-tenant-data
```

### Issue: Tenant data mixed up
```
❌ tenant_id was NULL during migration
→ Review: UPDATE statements in migration
→ Check: SELECT * FROM songs WHERE tenant_id IS NULL;

❌ RLS policy too permissive
→ Review: policy conditions (check AND/OR logic)
→ Audit: Check audit_logs for unauthorized access
```

---

## 📚 Documentation Generated

This architecture analysis includes:

1. **MULTI_TENANT_ARCHITECTURE_ANALYSIS.md** (11 sections)
   - Current state assessment
   - Database schema details
   - Issues & recommendations
   - Security analysis
   - Data isolation patterns
   - Scalability considerations
   - Implementation roadmap

2. **IMPLEMENTATION_GUIDE.md** (5 sections)
   - SQL migrations (code-ready)
   - Edge Function implementation (TypeScript-ready)
   - Frontend hook (React-ready)
   - Testing scenarios
   - Deployment checklist

3. **SECURITY_BEST_PRACTICES.md** (9 sections)
   - RLS implementation guide
   - Data isolation patterns
   - Authentication & authorization
   - Vulnerability identification
   - Incident response procedures
   - Monitoring & alerts

4. **DATA_FLOW_DIAGRAMS.md** (8 diagrams)
   - User authentication flow
   - Login & session flow
   - Data querying flow
   - Copy data flow (detailed)
   - Junction table integrity
   - Audit trail example
   - Isolation detection
   - Cascading deletes

5. **QUICK_REFERENCE.md** (This file)
   - Quick assessment & checklist
   - Key issues & fixes
   - Quick SQL reference
   - Testing scenarios
   - Troubleshooting guide

---

## 🎓 Key Concepts

### Tenant Isolation
- **Multi-Tenant:** One app instance, multiple organizations
- **Data Isolation:** Each org sees only its own data
- **Authentication:** User logs in to specific tenant
- **Authorization:** User can only edit their tenant's data

### RLS (Row-Level Security)
- **What:** Database enforces data access rules
- **Why:** Prevents bugs & accidental data leaks
- **How:** Policies on table level, checked on every query

### Copy Data Feature
- **Purpose:** Quickly set up new tenant with existing structure
- **Source:** Songs, Types, Events from one tenant
- **Target:** New IDs, same tenant-scoped data
- **Audit:** Tracks who copied what when

---

## 🔗 Related Resources

- Supabase RLS: https://supabase.com/docs/guides/auth/row-level-security
- PostgreSQL Security: https://www.postgresql.org/docs/current/
- OWASP Multi-Tenancy: https://owasp.org/www-community/attacks/Insecure_Direct_Object_Reference
- Coro Quixadá Repo: `./src/` (current codebase)

---

## ❓ FAQ

**Q: Why add tenant_id to junction tables?**  
A: To prevent cross-tenant references and ensure data integrity.

**Q: Why RLS if we already filter in frontend?**  
A: Frontend filters are bypassable. RLS is enforcement at DB level.

**Q: Can users copy their own data?**  
A: No, only superadmin can copy between tenants.

**Q: What if a tenant is deleted?**  
A: All its data cascades delete (events, songs, rehearsals, etc.)

**Q: How many users per tenant?**  
A: No limit, but recommended <10,000 for performance.

**Q: Can we have sub-tenants?**  
A: Not in current schema. Would need hierarchy redesign.

---

## 📝 Implementation Priority

```
MUST HAVE (Week 1):
  1. RLS policies
  2. tenant_id on junctions
  3. Security validation

SHOULD HAVE (Week 2):
  4. Copy data feature
  5. Audit logging
  6. Monitoring

NICE TO HAVE (Week 3+):
  7. Analytics dashboard
  8. Advanced filtering
  9. Data encryption
```

---

**Next Step:** Review MULTI_TENANT_ARCHITECTURE_ANALYSIS.md for detailed assessment, then follow IMPLEMENTATION_GUIDE.md for code deployment.
