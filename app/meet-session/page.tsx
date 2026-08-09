import type {
  Metadata,
} from "next";
import {
  Suspense,
} from "react";

import {
  GoogleMeetEvidenceRoom,
} from "@/components/GoogleMeetEvidenceRoom";
import {
  SiteFooter,
} from "@/components/SiteFooter";
import {
  SiteNav,
} from "@/components/SiteNav";

export const metadata: Metadata = {
  title:
    "Google Meet evidence | CommitPass",
  description:
    "Hackathon Google Meet evidence adapter for CommitPass V3 session settlement on Arc.",
};

export default function
GoogleMeetSessionPage() {
  return (
    <main>
      <SiteNav />
      <Suspense
        fallback={
          <section className="shell section">
            Loading Google Meet adapter...
          </section>
        }
      >
        <GoogleMeetEvidenceRoom />
      </Suspense>
      <SiteFooter />
    </main>
  );
}
