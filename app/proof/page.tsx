import type { Metadata } from "next";
import { SiteFooter } from "@/components/SiteFooter";
import { SiteNav } from "@/components/SiteNav";
import { VerifiedScenarios } from "@/components/VerifiedScenarios";

export const metadata: Metadata = {
  title: "Verified outcomes | CommitPass",
  description:
    "See how CommitPass pays out funds after cancellations, completed visits, and no-shows.",
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
