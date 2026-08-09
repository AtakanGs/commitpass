import type {
  Metadata,
} from "next";

import {
  SiteFooter,
} from "@/components/SiteFooter";
import {
  SiteNav,
} from "@/components/SiteNav";
import {
  VerifiedScenarios,
} from "@/components/VerifiedScenarios";

export const metadata: Metadata = {
  title:
    "Protocol and verifier proof | CommitPass",
  description:
    "Inspect CommitPass V3 Arc Testnet settlements, live verifier evidence, real Google Meet API evidence and timeout recovery boundaries.",
};

export default function ProofPage() {
  return (
    <main>
      <SiteNav />
      <VerifiedScenarios />
      <SiteFooter />
    </main>
  );
}
