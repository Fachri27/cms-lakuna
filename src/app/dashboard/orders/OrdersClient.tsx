"use client";

import { useState, useEffect } from "react";
import { api } from "@/lib/axios";
import { formatPrice } from "@/lib/format";
import {
  SectionHeader,
  Panel,
  Th,
  Td,
  Badge,
  Pagination,
  EmptyState,
  Skeleton,
} from "@/components/ui";

interface Order {
  id: string;
  userId: string;
  userName: string;
  userEmail: string;
  total: number;
  status: string;
  license?: string;
  createdAt: string;
}

interface PaginationState {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export default function OrdersClient() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [pagination, setPagination] = useState<PaginationState>({
    page: 1,
    limit: 20,
    total: 0,
    totalPages: 0,
  });
  const [fetching, setFetching] = useState(true);

  useEffect(() => {
    fetchOrders();
  }, [pagination.page]);

  async function fetchOrders() {
    try {
      const res = await api.get(
        `/order/admin?page=${pagination.page}&limit=${pagination.limit}`,
      );
      setOrders(res.data.data || []);
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

  function handlePageChange(newPage: number) {
    setPagination((prev) => ({ ...prev, page: newPage }));
  }

  return (
    <div className="rise">
      <SectionHeader
        index="03"
        kicker="Transaksi"
        title="Pesanan"
        className="mb-8"
      />

      {fetching ? (
        <Panel className="p-7 space-y-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-12" />
          ))}
        </Panel>
      ) : orders.length === 0 ? (
        <Panel>
          <EmptyState>Belum ada order</EmptyState>
        </Panel>
      ) : (
        <Panel className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr>
                <Th>Order</Th>
                <Th>Pelanggan</Th>
                <Th>Nominal</Th>
                <Th>Status</Th>
                <Th>Lisensi</Th>
                <Th>Tanggal</Th>
              </tr>
            </thead>
            <tbody>
              {orders.map((order) => (
                <tr key={order.id} className="hover:bg-ink/[0.02] transition-colors">
                  <Td>
                    <span className="font-mono text-xs text-ash tnum">
                      {order.id.slice(0, 8)}
                    </span>
                  </Td>
                  <Td>
                    <div className="text-ink">{order.userName}</div>
                    <div className="font-mono text-[11px] text-ash-2">
                      {order.userEmail}
                    </div>
                  </Td>
                  <Td className="font-display text-base tnum">
                    {formatPrice(order.total)}
                  </Td>
                  <Td>
                    <Badge status={order.status} />
                  </Td>
                  <Td className="font-mono text-[11px] text-ash">
                    {order.license || "—"}
                  </Td>
                  <Td className="font-mono text-[11px] text-ash">
                    {new Date(order.createdAt).toLocaleDateString("id-ID", {
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
      )}

      <Pagination
        page={pagination.page}
        totalPages={pagination.totalPages}
        onChange={handlePageChange}
      />
    </div>
  );
}