import { unstable_noStore as noStore } from "next/cache";
import SubscriptionsClient from "./SubscriptionsClient";

export default function SubscriptionsPage() {
  noStore();
  return <SubscriptionsClient />;
}