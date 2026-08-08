import type {
  Metadata,
} from "next";
import {
  Suspense,
} from "react";

import {
  LivePresenceRoom,
} from "@/components/LivePresenceRoom";
import {
  SiteFooter,
} from "@/components/SiteFooter";
import {
  SiteNav,
} from "@/components/SiteNav";

export const metadata: Metadata = {
  title:
    "Live presence adapter | CommitPass",
  description:
    "Experimental wallet-authenticated live presence adapter for CommitPass V3 digital sessions.",
};

export default function LiveSessionPage() {
  return (
    <main>
      <SiteNav />
      <Suspense
        fallback={
          <section className="shell section">
            Loading live room...
          </section>
        }
      >
        <LivePresenceRoom />
      </Suspense>
      <SiteFooter />
    </main>
  );
}
