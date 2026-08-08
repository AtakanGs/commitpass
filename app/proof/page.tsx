import type { Metadata } from "next";
import { SiteFooter } from "@/components/SiteFooter";
import { SiteNav } from "@/components/SiteNav";
import { VerifiedScenarios } from "@/components/VerifiedScenarios";

export const metadata: Metadata = {
  title: "Verified V3 testnet proof | CommitPass",
  description:
    "Inspect public CommitPass V3 Arc Testnet transactions for a controlled verified-session settlement and permissionless stale-reservation recovery.",
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
