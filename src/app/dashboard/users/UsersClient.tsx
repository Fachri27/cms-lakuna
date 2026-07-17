"use client";

import { useState, useEffect } from "react";
import { api } from "@/lib/axios";
import {
  SectionHeader,
  Panel,
  Th,
  Td,
  Pagination,
  EmptyState,
  Skeleton,
  inputCls,
} from "@/components/ui";
import { cn } from "@/lib/cn";

interface User {
  id: string;
  username: string;
  email: string;
  realName?: string;
  newsletter: boolean;
  role: string;
  createdAt: string;
}

interface PaginationState {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export default function UsersClient() {
  const [users, setUsers] = useState<User[]>([]);
  const [pagination, setPagination] = useState<PaginationState>({
    page: 1,
    limit: 20,
    total: 0,
    totalPages: 0,
  });
  const [fetching, setFetching] = useState(true);
  const [editingRole, setEditingRole] = useState<string | null>(null);

  useEffect(() => {
    fetchUsers();
  }, [pagination.page]);

  async function fetchUsers() {
    try {
      const res = await api.get("/users/admin", {
        params: { page: pagination.page, limit: pagination.limit },
      });
      setUsers(res.data.data || []);
      setPagination((prev) => ({
        ...prev,
        total: res.data.meta?.total || 0,
        totalPages: res.data.meta?.totalPages || 0,
      }));
    } catch (err) {
      console.error(err);
    } finally {
      setFetching(false);
    }
  }

  async function updateRole(userId: string, newRole: string) {
    try {
      await api.patch(`/users/${userId}/role`, { role: newRole });
      setUsers((prev) =>
        prev.map((u) => (u.id === userId ? { ...u, role: newRole } : u)),
      );
      setEditingRole(null);
    } catch (err) {
      console.error(err);
      alert("Gagal mengubah role");
    }
  }

  function handlePageChange(newPage: number) {
    setPagination((prev) => ({ ...prev, page: newPage }));
  }

  return (
    <div className="rise">
      <SectionHeader
        index="04"
        kicker="Sistem"
        title="Pengguna"
        className="mb-8"
      />

      {fetching ? (
        <Panel className="p-7 space-y-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-12" />
          ))}
        </Panel>
      ) : users.length === 0 ? (
        <Panel>
          <EmptyState>Belum ada pengguna</EmptyState>
        </Panel>
      ) : (
        <>
          <Panel className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr>
                  <Th>Username</Th>
                  <Th>Email</Th>
                  <Th>Role</Th>
                  <Th>Newsletter</Th>
                  <Th>Bergabung</Th>
                </tr>
              </thead>
              <tbody>
                {users.map((user) => (
                  <tr key={user.id} className="hover:bg-ink/[0.02] transition-colors">
                    <Td>
                      <div className="text-ink">{user.username}</div>
                      {user.realName && (
                        <div className="font-mono text-[11px] text-ash-2">
                          {user.realName}
                        </div>
                      )}
                    </Td>
                    <Td className="font-mono text-[11px] text-ash">{user.email}</Td>
                    <Td>
                      {editingRole === user.id ? (
                        <select
                          value={user.role}
                          onChange={(e) => updateRole(user.id, e.target.value)}
                          onBlur={() => setEditingRole(null)}
                          className={cn(inputCls, "w-auto py-1.5")}
                          autoFocus
                        >
                          <option value="USER">USER</option>
                          <option value="ADMIN">ADMIN</option>
                          <option value="CONTRIBUTOR">CONTRIBUTOR</option>
                        </select>
                      ) : (
                        <button
                          onClick={() => setEditingRole(user.id)}
                          title="Klik untuk ubah"
                          className="inline-flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-[0.14em] text-ink/70 hover:text-safelight cursor-pointer"
                        >
                          <span
                            className={cn(
                              "inline-block w-1.5 h-1.5 rounded-full",
                              user.role === "ADMIN"
                                ? "bg-safelight"
                                : user.role === "CONTRIBUTOR"
                                  ? "bg-ink"
                                  : "bg-ash-2",
                            )}
                          />
                          {user.role}
                        </button>
                      )}
                    </Td>
                    <Td className="font-mono text-[11px] text-ash">
                      {user.newsletter ? "Ya" : "Tidak"}
                    </Td>
                    <Td className="font-mono text-[11px] text-ash">
                      {new Date(user.createdAt).toLocaleDateString("id-ID", {
                        day: "2-digit",
                        month: "short",
                        year: "numeric",
                      })}
                    </Td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Panel>

          <Pagination
            page={pagination.page}
            totalPages={pagination.totalPages}
            onChange={handlePageChange}
          />
        </>
      )}
    </div>
  );
}