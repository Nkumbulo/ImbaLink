import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const root = process.cwd();
const sql = fs.readFileSync(path.join(root, "backend/034-immutable-audit-and-transactional-admin.sql"), "utf8");
const edge = fs.readFileSync(path.join(root, "supabase/functions/admin-user-action/index.ts"), "utf8");

describe("Phase 5 security contract", () => {
  it("makes the audit log append-only", () => {
    expect(sql).toContain("trg_admin_audit_immutable_update");
    expect(sql).toContain("trg_admin_audit_immutable_delete");
    expect(sql).toContain("AUDIT_LOG_IMMUTABLE");
    expect(sql).toContain("REVOKE INSERT, UPDATE, DELETE ON public.admin_audit_log");
  });

  it("provides one canonical audit_event boundary", () => {
    expect(sql).toContain("CREATE OR REPLACE FUNCTION public.audit_event(");
    expect(sql).toContain("REVOKE ALL ON FUNCTION public.audit_event");
    expect(sql).toContain("GRANT EXECUTE ON FUNCTION public.audit_event(text,text,text,jsonb,text) TO service_role");
  });

  it("uses a durable two-phase hard-delete workflow", () => {
    for (const fn of ["admin_begin_hard_delete", "admin_mark_hard_delete_auth_complete", "admin_cancel_hard_delete", "admin_finalize_hard_delete"]) {
      expect(sql).toContain(`FUNCTION public.${fn}`);
    }
    expect(edge).toContain("admin_begin_hard_delete");
    expect(edge).toContain("admin_mark_hard_delete_auth_complete");
    expect(edge).toContain("admin_finalize_hard_delete");
    expect(edge).toContain("admin_cancel_hard_delete");
    expect(edge).toContain("retryable: true");
  });

  it("does not directly mutate admin operational tables from authenticated RLS", () => {
    expect(sql).toContain("REVOKE INSERT, UPDATE, DELETE ON public.admin_user_notes, public.admin_warnings, public.admin_settings, public.admin_broadcasts FROM anon, authenticated");
  });
});
