import { unstable_noStore as noStore } from "next/cache";
import ManageSubscriptionsClient from "./ManageSubscriptionsClient";

export default function ManageSubscriptionsPage() {
  noStore();
  return <ManageSubscriptionsClient />;
}
