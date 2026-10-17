import { describe, expect, it } from "vitest";
import { loadAttendanceCredits } from "@/modules/attendance/creditsLoader";

function row(i: number) {
  return { person_key: `r:${i}`, meeting_id: "m", counts_for_meeting_id: "m", lessons: [1], minutes: 60, source: "qr", location_status: null };
}

/** Cliente falso: guarda as chamadas e devolve no máximo `cap` linhas por página, como o Supabase. */
function fakeClient(total: number, cap = 1000) {
  const calls: { args: unknown; inKeys?: string[]; range?: [number, number]; orders: string[] }[] = [];
  const client = {
    rpc(_name: string, args: unknown) {
      const call: (typeof calls)[number] = { args, orders: [] };
      calls.push(call);
      const builder = {
        in(_col: string, keys: string[]) {
          call.inKeys = keys;
          return builder;
        },
        order(col: string) {
          call.orders.push(col);
          return builder;
        },
        range(from: number, to: number) {
          call.range = [from, to];
          const end = Math.min(to + 1, total, from + cap);
          const data = Array.from({ length: Math.max(0, end - from) }, (_, k) => row(from + k));
          return Promise.resolve({ data, error: null });
        },
      };
      return builder;
    },
  };
  return { client: client as never, calls };
}

describe("loadAttendanceCredits", () => {
  it("busca em páginas até vir tudo (o Supabase corta em mil linhas)", async () => {
    const { client, calls } = fakeClient(2500);
    const rows = await loadAttendanceCredits(client);
    expect(rows).toHaveLength(2500);
    expect(new Set(rows.map((r) => r.person_key)).size).toBe(2500);
    expect(calls.map((c) => c.range)).toEqual([[0, 999], [1000, 1999], [2000, 2999]]);
    expect(calls[0]!.orders[0]).toBe("person_key");
  });

  it("com exatamente mil linhas, confere a página seguinte vazia", async () => {
    const { client, calls } = fakeClient(1000);
    expect(await loadAttendanceCredits(client)).toHaveLength(1000);
    expect(calls).toHaveLength(2);
  });

  it("passa a turma e filtra pelas chaves da pessoa no banco", async () => {
    const { client, calls } = fakeClient(3);
    await loadAttendanceCredits(client, { classId: "c1", personKeys: ["r:1", "s:2"] });
    expect(calls[0]!.args).toEqual({ p_class_id: "c1" });
    expect(calls[0]!.inKeys).toEqual(["r:1", "s:2"]);
  });

  it("erro do banco vira erro, e não frequência zerada", async () => {
    const client = {
      rpc: () => {
        const b = { in: () => b, order: () => b, range: () => Promise.resolve({ data: null, error: { message: "falhou" } }) };
        return b;
      },
    };
    await expect(loadAttendanceCredits(client as never)).rejects.toThrow("falhou");
  });
});
