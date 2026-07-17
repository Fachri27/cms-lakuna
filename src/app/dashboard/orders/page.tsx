import { unstable_noStore as noStore } from "next/cache";
import OrdersClient from "./OrdersClient";

export default function OrdersPage() {
  noStore();
  return <OrdersClient />;
}