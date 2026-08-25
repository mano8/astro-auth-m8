import * as React from "react";

import {
  CallbackView,
  SignupView,
  StarterAccountPage,
  StarterLoginPage,
  StarterLogoutPage
} from "../../../src/runtime/react/default-ui/index.js";
import { AuthErrorBoundary } from "../../../src/runtime/react/AuthErrorBoundary.js";
import { getStubSession, setStubSession, type StubSession } from "./service-stub.js";

const CONFIG = { apiBase: "/auth-api" } as const;

type PanelId = "login" | "account" | "logout" | "signup" | "callback" | "boundary";

const PANELS: { id: PanelId; label: string; description: string }[] = [
  {
    id: "login",
    label: "Login",
    description: "The island `login.astro` mounts. Switch the session to anonymous to see it as a signed-out visitor does."
  },
  {
    id: "account",
    label: "Account",
    description: "The island `account.astro` mounts, over the stubbed profile for the selected session."
  },
  {
    id: "logout",
    label: "Logout",
    description:
      "The island `logout.astro` mounts. The route authors its form as markup and passes it as slot content, so the gallery does the same."
  },
  {
    id: "signup",
    label: "Signup",
    description: "The island `signup.astro` mounts. This backend withholds public signup by default."
  },
  {
    id: "callback",
    label: "OAuth callback",
    description: "The island `callback.astro` mounts with no OAuth state present, which is its failure copy."
  },
  {
    id: "boundary",
    label: "Error boundary",
    description:
      "A render throw inside an island would otherwise blank the whole island — here, the login form. `A-C3`'s boundary degrades it to the plugin's error surface."
  }
];

const SESSIONS: StubSession[] = ["anonymous", "user", "superuser"];

/** Throws on demand so the boundary panel has something real to catch. */
function BoundaryProbe({ failing }: { failing: boolean }) {
  if (failing) throw new Error("The preview probe threw during render.");
  return <p className="preview-copy">The probe is rendering normally. Break it to see the catch.</p>;
}

function BoundaryPanel() {
  const [failing, setFailing] = React.useState(false);
  const [caught, setCaught] = React.useState<string | null>(null);

  return (
    <div className="preview-stack">
      <div className="preview-actions">
        <button type="button" onClick={() => setFailing((current) => !current)}>
          {failing ? "Repair the probe" : "Break the probe"}
        </button>
        {caught ? <span className="preview-note">onError saw: {caught}</span> : null}
      </div>
      <AuthErrorBoundary resetKeys={[failing]} onError={(error) => setCaught(error.message)}>
        <BoundaryProbe failing={failing} />
      </AuthErrorBoundary>
    </div>
  );
}

export function PreviewApp() {
  const [panel, setPanel] = React.useState<PanelId>("login");
  const [session, setSession] = React.useState<StubSession>(getStubSession());
  const active = PANELS.find((entry) => entry.id === panel) ?? PANELS[0];

  const chooseSession = (next: StubSession) => {
    setStubSession(next);
    setSession(next);
  };

  return (
    <main className="preview-shell">
      <header className="preview-hero">
        <p className="preview-kicker">dev-only fixture</p>
        <h1>astro-auth-m8 /_preview</h1>
        <p className="preview-copy">
          Every panel below mounts a real island root against an in-memory stand-in for fa-auth-m8.
          No backend and no mocked hooks: the views, hooks, api wrappers and Zod schemas are the
          shipped ones, and only <code>fetch</code> is replaced.
        </p>
        <nav className="preview-tabs">
          {PANELS.map((entry) => (
            <button
              key={entry.id}
              type="button"
              className={entry.id === panel ? "is-active" : undefined}
              onClick={() => setPanel(entry.id)}
            >
              {entry.label}
            </button>
          ))}
        </nav>
        <div className="preview-actions">
          <span className="preview-note">Session:</span>
          {SESSIONS.map((candidate) => (
            <button
              key={candidate}
              type="button"
              className={candidate === session ? "is-active" : undefined}
              onClick={() => chooseSession(candidate)}
            >
              {candidate}
            </button>
          ))}
        </div>
      </header>

      <section className="preview-card">
        <div className="preview-card__header">
          <h2>{active.label}</h2>
          <p>{active.description}</p>
        </div>
        {/*
          Keyed on the panel *and* the session, so switching either remounts the
          island rather than re-using a mounted one. That is what a route change
          or a sign-in does, and it is the state a gallery should be showing.
        */}
        <div className="preview-stage" key={`${panel}:${session}`}>
          {panel === "login" ? <StarterLoginPage config={CONFIG} /> : null}
          {panel === "account" ? <StarterAccountPage config={CONFIG} /> : null}
          {panel === "logout" ? (
            <StarterLogoutPage config={CONFIG}>
              <p className="preview-copy">Slot content from the route goes here.</p>
            </StarterLogoutPage>
          ) : null}
          {panel === "signup" ? <SignupView /> : null}
          {panel === "callback" ? <CallbackView /> : null}
          {panel === "boundary" ? <BoundaryPanel /> : null}
        </div>
      </section>
    </main>
  );
}
