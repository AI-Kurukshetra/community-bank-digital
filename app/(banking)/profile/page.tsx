"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { useAuth } from "@/hooks/useAuth";
import { useNavigationProgress } from "@/hooks/useNavigationProgress";
import { getSupabaseBrowserClient } from "@/lib/supabase";
import { writeAuditLog } from "@/utils/audit";

export default function ProfilePage() {
  const router = useRouter();
  const supabase = getSupabaseBrowserClient();
  const { startNavigation } = useNavigationProgress();
  const { profile, user } = useAuth();
  const [fullName, setFullName] = useState(profile?.full_name ?? "");
  const [phone, setPhone] = useState(profile?.phone ?? "");
  const [profileMessage, setProfileMessage] = useState("");
  const [profileError, setProfileError] = useState("");
  const [savingProfile, setSavingProfile] = useState(false);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [passwordMessage, setPasswordMessage] = useState("");
  const [passwordError, setPasswordError] = useState("");
  const [changingPassword, setChangingPassword] = useState(false);
  const [signingOutAll, setSigningOutAll] = useState(false);

  async function handleSaveProfile() {
    setSavingProfile(true);
    setProfileMessage("");
    setProfileError("");

    try {
      const response = await fetch("/api/v1/profile", {
        body: JSON.stringify({
          full_name: fullName.trim(),
          phone: phone.trim() || null
        }),
        headers: {
          "Content-Type": "application/json"
        },
        method: "PATCH"
      });

      const payload = (await response.json().catch(() => ({}))) as {
        error?: string;
      };

      if (!response.ok) {
        setProfileError(payload.error || "Unable to save your profile.");
        return;
      }

      setProfileMessage("Profile updated.");
      router.refresh();
    } finally {
      setSavingProfile(false);
    }
  }

  async function handleChangePassword() {
    if (!user?.email) {
      return;
    }

    setChangingPassword(true);
    setPasswordMessage("");
    setPasswordError("");

    try {
      if (!/\d/.test(newPassword) || newPassword.length < 8) {
        setPasswordError("New password must be at least 8 characters and include a digit.");
        return;
      }

      if (newPassword !== confirmPassword) {
        setPasswordError("Passwords do not match.");
        return;
      }

      const verifyResult = await supabase.auth.signInWithPassword({
        email: user.email,
        password: currentPassword
      });

      if (verifyResult.error) {
        setPasswordError("Current password is incorrect.");
        return;
      }

      const updateResult = await supabase.auth.updateUser({ password: newPassword });

      if (updateResult.error) {
        setPasswordError("Unable to update your password.");
        return;
      }

      await writeAuditLog(supabase, {
        action: "password_changed",
        actor_id: user.id,
        entity_id: user.id,
        entity_type: "profiles"
      });

      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      setPasswordMessage("Password changed.");
    } finally {
      setChangingPassword(false);
    }
  }

  async function handleGlobalSignOut() {
    setSigningOutAll(true);

    try {
      await supabase.auth.signOut({ scope: "global" });
      startNavigation();
      router.replace("/login");
    } finally {
      setSigningOutAll(false);
    }
  }

  return (
    <div className="space-y-6">
      <Card className="banking-panel border-white/50 bg-white/70">
        <CardContent className="space-y-4 p-6">
          <h2 className="text-2xl font-semibold tracking-tight text-slate-950">
            Personal Details
          </h2>

          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <label className="text-sm font-medium text-slate-700">Full name</label>
              <input
                className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm"
                onChange={(event) => setFullName(event.target.value)}
                value={fullName}
              />
            </div>
            <div>
              <label className="text-sm font-medium text-slate-700">Phone</label>
              <input
                className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm"
                onChange={(event) => setPhone(event.target.value)}
                value={phone}
              />
            </div>
          </div>

          <div>
            <label className="text-sm font-medium text-slate-700">Email</label>
            <input
              className="mt-1 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm text-slate-500"
              readOnly
              value={user?.email ?? ""}
            />
            <p className="mt-1 text-xs text-slate-400">Email is read-only in this build.</p>
          </div>

          {profileError ? <p className="text-sm text-red-600">{profileError}</p> : null}
          {profileMessage ? <p className="text-sm text-emerald-600">{profileMessage}</p> : null}

          <Button
            className="rounded-xl bg-[#3047ff] hover:bg-[#2538cc]"
            disabled={savingProfile}
            onClick={() => void handleSaveProfile()}
            type="button"
          >
            {savingProfile ? "Saving..." : "Save"}
          </Button>
        </CardContent>
      </Card>

      <Card className="banking-panel border-white/50 bg-white/70">
        <CardContent className="space-y-4 p-6">
          <h2 className="text-2xl font-semibold tracking-tight text-slate-950">Security</h2>

          <div className="grid gap-4 md:grid-cols-3">
            <div>
              <label className="text-sm font-medium text-slate-700">Current password</label>
              <input
                className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm"
                onChange={(event) => setCurrentPassword(event.target.value)}
                type="password"
                value={currentPassword}
              />
            </div>
            <div>
              <label className="text-sm font-medium text-slate-700">New password</label>
              <input
                className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm"
                onChange={(event) => setNewPassword(event.target.value)}
                type="password"
                value={newPassword}
              />
            </div>
            <div>
              <label className="text-sm font-medium text-slate-700">Confirm password</label>
              <input
                className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm"
                onChange={(event) => setConfirmPassword(event.target.value)}
                type="password"
                value={confirmPassword}
              />
            </div>
          </div>

          {passwordError ? <p className="text-sm text-red-600">{passwordError}</p> : null}
          {passwordMessage ? <p className="text-sm text-emerald-600">{passwordMessage}</p> : null}

          <div className="flex flex-wrap gap-3">
            <Button
              className="rounded-xl bg-[#3047ff] hover:bg-[#2538cc]"
              disabled={changingPassword}
              onClick={() => void handleChangePassword()}
              type="button"
            >
              {changingPassword ? "Updating..." : "Change password"}
            </Button>
            <Button
              disabled={signingOutAll}
              onClick={() => void handleGlobalSignOut()}
              type="button"
              variant="outline"
            >
              {signingOutAll ? "Signing out..." : "Sign out all devices"}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
