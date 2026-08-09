import Link from "next/link";

export function SiteFooter() {
  return (
    <footer className="shell footer">
      <div>
        <strong>CommitPass</strong>
        <p>
          Built by {"Atakan G\u00fcndall\u0131"} for the Programmable Money
          Hackathon.
        </p>
      </div>

      <div className="footerLinks">
        <Link href="/create">Create reservation</Link>
        <Link href="/reservations">My reservations</Link>
        <Link href="/reservation">Open by ID</Link>
        <Link href="/proof">Verified proof</Link>
        <a
          href="https://github.com/AtakanGs/commitpass"
          target="_blank"
          rel="noreferrer"
        >
          GitHub
        </a>
      </div>
    </footer>
  );
}
