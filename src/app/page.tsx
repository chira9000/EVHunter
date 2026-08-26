import { redirect } from "next/navigation";

/** Send users straight to the Kalshi dashboard (main app view). */
export default function HomePage() {
  redirect("/dashboard");
}
