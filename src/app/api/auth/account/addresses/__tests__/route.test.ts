import { beforeEach, describe, expect, it, vi } from "vitest";
import { GET, POST } from "../route";
import { PATCH, DELETE } from "../[id]/route";
import { prisma } from "@/server/db/client";
import { resetDb } from "@/server/__tests__/helpers/reset-db";

const sessionMock = vi.fn();
vi.mock("@/server/auth/session", () => ({
  getSessionUser: () => sessionMock(),
  requireSessionUser: async () => {
    const u = await sessionMock();
    if (!u) {
      const e = new Error("UNAUTHENTICATED") as Error & { status?: number };
      e.status = 401;
      throw e;
    }
    return u;
  },
}));
vi.mock("@/server/auth/csrf", () => ({ assertCsrf: vi.fn() }));

const fixtureBody = {
  label: "Home",
  isDefault: true,
  firstName: "Jane",
  lastName: "Doe",
  line1: "1 King's Road",
  line2: null,
  city: "London",
  postcode: "SW3 4ND",
  country: "GB",
  phone: "+44 7700 900123",
};

function jsonReq(url: string, method: string, body?: unknown): Request {
  return new Request(url, {
    method,
    headers: { "content-type": "application/json", "x-csrf-token": "t" },
    body: body === undefined ? null : JSON.stringify(body),
  });
}

describe("/api/auth/account/addresses", () => {
  beforeEach(() => resetDb());

  it("GET returns addresses for the session user, default first", async () => {
    const u = await prisma.user.create({ data: { email: "u@x.com", passwordHash: "$2b$10$h" } });
    await prisma.address.createMany({
      data: [
        { ...fixtureBody, userId: u.id, label: "Work", isDefault: false },
        { ...fixtureBody, userId: u.id, label: "Home", isDefault: true },
      ],
    });
    sessionMock.mockResolvedValue({ id: u.id, email: "u@x.com", name: null, role: "CUSTOMER", emailVerifiedAt: null });
    const res = await GET();
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.addresses.map((a: { label: string }) => a.label)).toEqual(["Home", "Work"]);
  });

  it("POST creates an address tied to the session user", async () => {
    const u = await prisma.user.create({ data: { email: "u@x.com", passwordHash: "$2b$10$h" } });
    sessionMock.mockResolvedValue({ id: u.id, email: "u@x.com", name: null, role: "CUSTOMER", emailVerifiedAt: null });
    const res = await POST(jsonReq("http://localhost/api/auth/account/addresses", "POST", fixtureBody));
    expect(res.status).toBe(201);
    const all = await prisma.address.findMany({ where: { userId: u.id } });
    expect(all).toHaveLength(1);
    expect(all[0].label).toBe("Home");
  });

  it("PATCH on another user's address returns 404 (IDOR check)", async () => {
    const a = await prisma.user.create({ data: { email: "a@x.com", passwordHash: "$2b$10$h" } });
    const b = await prisma.user.create({ data: { email: "b@x.com", passwordHash: "$2b$10$h" } });
    const addrA = await prisma.address.create({ data: { ...fixtureBody, userId: a.id } });
    sessionMock.mockResolvedValue({ id: b.id, email: "b@x.com", name: null, role: "CUSTOMER", emailVerifiedAt: null });
    const res = await PATCH(
      jsonReq(`http://localhost/api/auth/account/addresses/${addrA.id}`, "PATCH", { label: "Hijacked" }),
      { params: Promise.resolve({ id: addrA.id }) },
    );
    expect(res.status).toBe(404);
    const after = await prisma.address.findUnique({ where: { id: addrA.id } });
    expect(after?.label).toBe("Home");
  });

  it("PATCH updates own address", async () => {
    const u = await prisma.user.create({ data: { email: "u@x.com", passwordHash: "$2b$10$h" } });
    const addr = await prisma.address.create({ data: { ...fixtureBody, userId: u.id } });
    sessionMock.mockResolvedValue({ id: u.id, email: "u@x.com", name: null, role: "CUSTOMER", emailVerifiedAt: null });
    const res = await PATCH(
      jsonReq(`http://localhost/api/auth/account/addresses/${addr.id}`, "PATCH", { label: "Renamed" }),
      { params: Promise.resolve({ id: addr.id }) },
    );
    expect(res.status).toBe(200);
    const after = await prisma.address.findUnique({ where: { id: addr.id } });
    expect(after?.label).toBe("Renamed");
  });

  it("DELETE removes the address", async () => {
    const u = await prisma.user.create({ data: { email: "u@x.com", passwordHash: "$2b$10$h" } });
    const addr = await prisma.address.create({ data: { ...fixtureBody, userId: u.id } });
    sessionMock.mockResolvedValue({ id: u.id, email: "u@x.com", name: null, role: "CUSTOMER", emailVerifiedAt: null });
    const res = await DELETE(
      jsonReq(`http://localhost/api/auth/account/addresses/${addr.id}`, "DELETE"),
      { params: Promise.resolve({ id: addr.id }) },
    );
    expect(res.status).toBe(200);
    expect(await prisma.address.findUnique({ where: { id: addr.id } })).toBeNull();
  });
});
