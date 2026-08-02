import type { Metadata } from "next";
import { SiteFooter } from "@/components/SiteFooter";
import { SiteNav } from "@/components/SiteNav";
import { VerifiedScenarios } from "@/components/VerifiedScenarios";

export const metadata: Metadata = {
  title: "Verified proof | CommitPass",
  description:
    "Inspect completed CommitPass settlement outcomes on Arc Testnet.",
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
