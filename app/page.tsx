import Image from "next/image";
import { CreateReservationForm } from "@/components/CreateReservationForm";
import { ManageReservation } from "@/components/ManageReservation";
import { WalletStatus } from "@/components/WalletStatus";

const outcomes = [
  ["Both attend", "Both commitments return automatically."],
  ["Customer cancels early", "Both commitments return and the slot can reopen."],
  ["Customer no-show", "The provider receives the pre-agreed customer commitment."],
  ["Provider no-show", "The customer is refunded and compensated from the provider bond."],
];

export default function Home() {
  return (
    <main>
      <nav className="nav shell">
        <a className="brand" href="#top" aria-label="CommitPass home">
          <span className="brandMark">C</span>
          <span>CommitPass</span>
        </a>
        <div className="navMeta">
          <span className="networkPill">Arc Testnet</span>
          <WalletStatus />
        </div>
      </nav>

      <section className="hero shell" id="top">
        <div className="heroCopy">
          <p className="eyebrow">PROGRAMMABLE RESERVATION PROTECTION</p>
          <h1>Both sides commit.<br />Trust is programmable.</h1>
          <p className="lead">
            CommitPass protects scarce appointments with two-sided refundable USDC commitments.
            Customers compensate providers when they no-show. Providers compensate customers when
            they cancel late.
          </p>
          <div className="heroActions">
            <a className="button primary" href="#create">Create a commitment</a>
            <a className="button secondary" href="#manage">Manage reservation</a>
          </div>
          <div className="proofRow">
            <span>USDC commitments</span><span>Conditional settlement</span><span>Built on Arc</span>
          </div>
        </div>
        <div className="heroVisual card">
          <Image
            src="/commitpass-cover.png"
            alt="CommitPass two-sided programmable commitments"
            width={720}
            height={720}
            priority
          />
        </div>
      </section>

      <section className="shell section">
        <div className="sectionHead">
          <p className="eyebrow">WHY IT EXISTS</p>
          <h2>A neutral settlement layer for time that cannot be recovered.</h2>
        </div>
        <div className="outcomeGrid">
          {outcomes.map(([title, description], index) => (
            <article className="outcomeCard" key={title}>
              <span className="stepNumber">0{index + 1}</span>
              <h3>{title}</h3>
              <p>{description}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="shell workbench" id="create">
        <div className="workbenchIntro">
          <p className="eyebrow">PROVIDER FLOW</p>
          <h2>Create a two-sided commitment.</h2>
          <p>
            The provider locks a performance bond first. The invited customer then accepts and
            locks their smaller refundable commitment.
          </p>
        </div>
        <CreateReservationForm />
      </section>

      <section className="shell workbench reverse" id="manage">
        <ManageReservation />
        <div className="workbenchIntro">
          <p className="eyebrow">RESOLUTION FLOW</p>
          <h2>Resolve the reservation transparently.</h2>
          <p>
            Confirm attendance, cancel in time, open a no-show claim or dispute a false claim. Every
            outcome follows rules visible before funds are locked.
          </p>
        </div>
      </section>

      <footer className="shell footer">
        <div>
          <strong>CommitPass</strong>
          <p>Built by Atakan Gündallı for the Programmable Money Hackathon.</p>
        </div>
        <div className="footerLinks">
          <a href="https://github.com/AtakanGs" target="_blank" rel="noreferrer">GitHub</a>
          <a href="https://testnet.arcscan.app" target="_blank" rel="noreferrer">Arcscan</a>
        </div>
      </footer>
    </main>
  );
}
