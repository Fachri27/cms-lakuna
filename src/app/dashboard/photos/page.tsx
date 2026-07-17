import { unstable_noStore as noStore } from "next/cache";
import PhotosClient from "./PhotoClient";

export default function PhotosPage() {
  noStore();
  return <PhotosClient />;
}