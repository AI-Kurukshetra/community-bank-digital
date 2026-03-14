"use client";

import {
  createContext,
  startTransition,
  useEffect,
  useMemo,
  useState
} from "react";
import { useRouter } from "next/navigation";
import type { Session, User } from "@supabase/supabase-js";

import { useNavigationProgress } from "@/hooks/useNavigationProgress";
import { getSupabaseBrowserClient } from "@/lib/supabase";
import type { Profile, UserRole } from "@/types";
import { writeAuditLog } from "@/utils/audit";

type AuthContextValue = {
  isAuthenticated: boolean;
  isLoading: boolean;
  logout: () => Promise<void>;
  profile: Profile | null;
  role: UserRole | null;
  user: User | null;
};

export const AuthContext = createContext<AuthContextValue | null>(null);

async function fetchProfile(userId: string) {
  const supabase = getSupabaseBrowserClient();
  const { data, error } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", userId)
    .maybeSingle();

  if (error) {
    return null;
  }

  return (data ?? null) as Profile | null;
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const supabase = getSupabaseBrowserClient();
  const { startNavigation } = useNavigationProgress();
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [role, setRole] = useState<UserRole | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;

    async function syncSession(session: Session | null) {
      if (!isMounted) {
        return;
      }

      if (!session?.user) {
        startTransition(() => {
          setUser(null);
          setProfile(null);
          setRole(null);
          setIsLoading(false);
        });
        return;
      }

      const nextProfile = await fetchProfile(session.user.id);

      if (!isMounted) {
        return;
      }

      startTransition(() => {
        setUser(session.user);
        setProfile(nextProfile);
        setRole(nextProfile?.role ?? null);
        setIsLoading(false);
      });
    }

    void supabase.auth.getSession().then(({ data }) => {
      void syncSession(data.session);
    });

    const {
      data: { subscription }
    } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "SIGNED_OUT") {
        startTransition(() => {
          setUser(null);
          setProfile(null);
          setRole(null);
          setIsLoading(false);
        });
        return;
      }

      if (event === "SIGNED_IN" || event === "INITIAL_SESSION") {
        void syncSession(session);
      }
    });

    return () => {
      isMounted = false;
      subscription.unsubscribe();
    };
  }, [supabase]);

  async function logout() {
    if (user) {
      await writeAuditLog(supabase, {
        action: "logout",
        actor_id: user.id,
        entity_id: user.id,
        entity_type: "profiles"
      });
    }

    await supabase.auth.signOut();

    startTransition(() => {
      setUser(null);
      setProfile(null);
      setRole(null);
      setIsLoading(false);
    });

    startNavigation();
    router.replace("/login");
  }

  const value = useMemo<AuthContextValue>(
    () => ({
      isAuthenticated: Boolean(user),
      isLoading,
      logout,
      profile,
      role,
      user
    }),
    [isLoading, profile, role, user]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
