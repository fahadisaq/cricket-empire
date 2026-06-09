import { useEffect, useState } from "react";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { Loader2 } from "lucide-react";
import { useAuth } from "./store/authStore";
import { useGame } from "./store/gameStore";
import { Landing } from "./screens/Landing";
import { AuthScreen } from "./screens/AuthScreen";
import { Onboarding } from "./screens/Onboarding";
import { Layout } from "./screens/Layout";
import { Dashboard } from "./pages/Dashboard";
import { Squad } from "./pages/Squad";
import { Lineup } from "./pages/Lineup";
import { Fixtures } from "./pages/Fixtures";
import { Training } from "./pages/Training";
import { Scout } from "./pages/Scout";
import { Auction } from "./pages/Auction";
import { League } from "./pages/League";
import { Legends } from "./pages/Legends";
import { ClubPage } from "./pages/ClubPage";

function FullScreen({ children }: { children: React.ReactNode }) {
  return <div className="min-h-screen flex items-center justify-center text-slate-400 gap-2">{children}</div>;
}

export default function App() {
  const authInit = useAuth((s) => s.init);
  const authReady = useAuth((s) => s.ready);
  const user = useAuth((s) => s.user);

  const loadMe = useGame((s) => s.loadMe);
  const myClubId = useGame((s) => s.myClubId);

  const [checked, setChecked] = useState(false);
  const [entered, setEntered] = useState(false);
  const [showAuth, setShowAuth] = useState(false);

  useEffect(() => {
    void authInit();
  }, [authInit]);

  // When a user logs in, ask the server if they already have a club.
  useEffect(() => {
    if (!authReady) return;
    if (user) {
      setChecked(false);
      loadMe().then(() => setChecked(true));
    } else {
      setChecked(true);
    }
  }, [authReady, user, loadMe]);

  if (!authReady) {
    return <FullScreen><Loader2 className="animate-spin" /> Loading…</FullScreen>;
  }

  // Not logged in → landing page, then auth screen.
  if (!user) {
    return showAuth ? <AuthScreen onBack={() => setShowAuth(false)} /> : <Landing onEnter={() => setShowAuth(true)} />;
  }

  // Logged in, checking club…
  if (!checked) {
    return <FullScreen><Loader2 className="animate-spin" /> Loading your club…</FullScreen>;
  }

  // Logged in but no club yet → onboarding (create starter club).
  if (!myClubId || !entered) {
    return <Onboarding onDone={() => setEntered(true)} hasClub={!!myClubId} />;
  }

  // Guard: don't mount the game until the club view has loaded.
  return <GameShell />;
}

function GameShell() {
  const view = useGame((s) => s.view);
  if (!view) {
    return <FullScreen><Loader2 className="animate-spin" /> Loading your dressing room…</FullScreen>;
  }
  return (
    <BrowserRouter>
      <Layout>
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/squad" element={<Squad />} />
          <Route path="/lineup" element={<Lineup />} />
          <Route path="/fixtures" element={<Fixtures />} />
          <Route path="/training" element={<Training />} />
          <Route path="/scout" element={<Scout />} />
          <Route path="/auction" element={<Auction />} />
          <Route path="/league" element={<League />} />
          <Route path="/legends" element={<Legends />} />
          <Route path="/club" element={<ClubPage />} />
        </Routes>
      </Layout>
    </BrowserRouter>
  );
}
