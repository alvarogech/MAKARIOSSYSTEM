import { describe, expect, it } from "vitest";
import { can } from "@/authorization";
import type { AuthContext } from "@/authorization";

const ctx = (role: string) =>
  ({ userId: "u", fullName: "x", profileStatus: "active", roles: [role], activeRole: role }) as unknown as AuthContext;

describe("permissão de editar cadastro de professores", () => {
  const check = { resource: "teacher_profile", action: "edit" } as const;
  it("só o administrador", () => {
    expect(can(ctx("admin"), check)).toBe(true);
    expect(can(ctx("coordinator"), check)).toBe(false);
    expect(can(ctx("teacher"), check)).toBe(false);
    expect(can(ctx("student"), check)).toBe(false);
  });
});
