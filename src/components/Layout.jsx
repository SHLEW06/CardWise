import React, { useState } from "react";
import { Compass, LogIn, LogOut, User } from "lucide-react";
import { useAuth } from "../firebase/useAuth.js";

/* App shell: aurora background, header (logo + auth + optional nav slot), footer with
   the honest seed-data disclaimer. */
export default function Layout({ children, nav, onLogoClick }) {
  const { user, loading, firebaseActive, signInWithGoogle, signOut } = useAuth();
  const [authBusy, setAuthBusy] = useState(false);

  const handleGoogleSignIn = async () => {
    setAuthBusy(true);
    try { await signInWithGoogle(); }
    catch (e) { console.error("Google sign-in failed:", e); }
    finally { setAuthBusy(false); }
  };

  const handleSignOut = async () => {
    setAuthBusy(true);
    try { await signOut(); }
    catch (e) { console.error("Sign-out failed:", e); }
    finally { setAuthBusy(false); }
  };

  return (
    <div className="cw-root">
      <div className="cw-aurora" />
      <header className="cw-header">
        <button className="cw-logo" onClick={onLogoClick} aria-label="CardWise home">
          <span className="cw-logo-mark"><Compass size={18} /></span>
          <span className="cw-logo-text">CardWise</span>
        </button>
        {nav}
        {firebaseActive && !loading && (
          <div className="cw-auth">
            {user && !user.isAnonymous ? (
              <div className="cw-auth-user">
                <span className="cw-auth-name" title={user.email}>
                  <User size={14} /> {user.displayName || user.email || "Signed in"}
                </span>
                <button className="cw-auth-btn" onClick={handleSignOut} disabled={authBusy} aria-label="Sign out">
                  <LogOut size={14} /> Sign out
                </button>
              </div>
            ) : (
              <button className="cw-auth-btn cw-auth-signin" onClick={handleGoogleSignIn} disabled={authBusy} aria-label="Sign in with Google">
                <LogIn size={14} /> {authBusy ? "Signing in..." : "Sign in"}
              </button>
            )}
          </div>
        )}
      </header>
      <main className="cw-main">{children}</main>
      <footer className="cw-footer">
        Card fees, earn rates, credits, and point values are best-effort seed data (June 2026) and change often — verify current terms before relying on them.
        CardWise is not financial advice. Pay your balance in full every month, and never spend extra to chase rewards.
      </footer>
    </div>
  );
}
