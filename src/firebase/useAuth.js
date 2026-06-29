import { useState, useEffect } from "react";
import { ensureUser, onAuthChange, signInWithGoogle, signOutUser } from "./auth.js";
import { isFirebaseConfigured } from "./config.js";

export function useAuth() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    ensureUser().then((u) => {
      if (!cancelled) { setUser(u); setLoading(false); }
    });

    const unsub = onAuthChange((u) => {
      if (!cancelled && u) setUser(u);
    });

    return () => { cancelled = true; unsub(); };
  }, []);

  return {
    user,
    loading,
    firebaseActive: isFirebaseConfigured(),
    signInWithGoogle: async () => {
      const u = await signInWithGoogle();
      if (u) setUser(u);
      return u;
    },
    signOut: async () => {
      await signOutUser();
      // After sign-out, ensureUser will create a new anonymous session
      const u = await ensureUser();
      setUser(u);
    },
  };
}
