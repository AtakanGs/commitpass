import Link from "next/link";
import { WalletStatus } from "@/components/WalletStatus";

export function SiteNav() {
  return (
    <nav className="nav shell">
      <Link
        className="brand"
        href="/"
        aria-label="CommitPass home"
      >
        <span className="brandMark">C</span>
        <span>CommitPass</span>
      </Link>

      <div className="navLinks">
        <Link href="/#how">How it works</Link>
        <Link href="/proof">Verified proof</Link>
        <Link href="/create">Create reservation</Link>
      </div>

      <div className="navMeta">
        <span className="networkPill">Arc Testnet</span>
        <WalletStatus />
      </div>
    </nav>
  );
}
