import { useState, type FormEvent } from "react";
import { Link, Navigate, useLocation, useNavigate } from "react-router-dom";
import { Icon } from "../lib/icons";
import { useAuth, readContactIntent, clearContactIntent } from "../lib/Auth";
import { useToast } from "../components/ui/Toast";
import { api } from "../lib/api";
import { toE164 } from "../lib/format";
import { motion, AnimatePresence } from "framer-motion";
import { Seo } from "../lib/Seo";

const SECTIONS = [
  { id: "profile", label: "My Profile", icon: "user" },
  { id: "bookings", label: "My Consultations", icon: "calendar" },
  { id: "saved", label: "Saved Pandits", icon: "heart" },
];

export default function Dashboard() {
  const { user, loading, logout, updateUser } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [section, setSection] = useState("profile");
  const [saving, setSaving] = useState(false);
  const toast = useToast();

  const [name, setName] = useState(user?.full_name || "");
  const [phone, setPhone] = useState(user?.phone || "");
  const [email, setEmail] = useState(user?.email || "");
  const [city, setCity] = useState(user?.city || "");
  const [state, setState] = useState(user?.state || "");

  // --- Mobile verification ---------------------------------------------
  // A devotee who signed in with Google has email_verified but no phone at
  // all, and record_qualified_lead() gates every lead on phone_verified
  // specifically. Before this existed, such a user pressing Call/WhatsApp was
  // bounced here to "?verify=mobile" and found only a plain text box that
  // saved a number without ever proving it — so they were bounced here again
  // on the next press, forever. This is the missing half: request an OTP for
  // the number, confirm it, and let the backend set the flag.
  const [otpSent, setOtpSent] = useState(false);
  const [otpCode, setOtpCode] = useState("");
  const [otpBusy, setOtpBusy] = useState(false);
  const [otpError, setOtpError] = useState<string | null>(null);
  // Set when the contact flow redirected here, so the reason is stated up
  // front rather than leaving the devotee to guess why the page opened.
  const wantsMobile = new URLSearchParams(location.search).get("verify") === "mobile";
  
  // Astrology / Kundli specific fields
  const [dob, setDob] = useState("");
  const [tob, setTob] = useState("");
  const [pob, setPob] = useState("");
  const [gender, setGender] = useState("male");

  if (loading) return null;
  if (!user) return <Navigate to="/login" state={{ from: location }} replace />;

  /** Sends the code. The number is normalised first: OTP delivery needs the
   *  full international number, and the field accepts "98765 43210" just as
   *  happily as "+91 98765 43210". */
  async function onSendOtp() {
    const target = toE164(phone);
    if (!target) {
      setOtpError("Poora mobile number daaliye, jaise +91 98765 43210");
      return;
    }
    setOtpBusy(true);
    setOtpError(null);
    try {
      await api.post("/auth/otp/request", { target, targetType: "phone" });
      setOtpSent(true);
      setOtpCode("");
      toast(`OTP bheja gaya ${target} par (WhatsApp)`);
    } catch (err: any) {
      setOtpError(err.message || "OTP bhej nahi paye. Thodi der baad try karein.");
    } finally {
      setOtpBusy(false);
    }
  }

  /** Confirms the code. The backend writes the number AND the verified flag in
   *  one statement (auth.controller.js verifyOtp), so there is nothing to save
   *  separately here — refreshing the user is enough to unblock Call/WhatsApp
   *  on the next press. */
  async function onConfirmOtp() {
    const target = toE164(phone);
    if (!target || otpCode.trim().length < 4) {
      setOtpError("4-digit code daaliye");
      return;
    }
    setOtpBusy(true);
    setOtpError(null);
    try {
      const res = await api.post<{ merged?: boolean }>("/auth/otp/verify", {
        target, targetType: "phone", otp: otpCode.trim(),
      });
      const fresh = await api.get<any>("/auth/me");
      updateUser({ ...user!, ...fresh });
      setPhone(fresh.phone || target);
      setOtpSent(false);
      setOtpCode("");
      // Said out loud rather than left to be noticed: when the number was
      // already on a phone-login account, that account's saved pandits,
      // reviews and enquiries have just moved into this one.
      toast(res?.merged
        ? "Mobile verify ho gaya ✓ Aapka purana phone-login account isme mila diya gaya."
        : "Mobile number verify ho gaya ✓");

      // They only came to this page because a Call/WhatsApp press sent them
      // here. Verifying is the last thing standing between them and that
      // pandit, so finish the journey instead of leaving them on a profile
      // form to navigate back on their own. The intent is cleared because it
      // has now been acted on; a fresh press parks a new one.
      const intent = readContactIntent();
      if (intent) {
        clearContactIntent();
        navigate(`/pandits/${intent.panditSlug}`);
      }
    } catch (err: any) {
      setOtpError(err.message || "Code galat hai. Dobara try karein.");
    } finally {
      setOtpBusy(false);
    }
  }

  async function onProfileSave(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSaving(true);
    try {
      // Save to backend — PATCH /api/auth/me updates full_name, phone and email
      const updated = await api.patch<any>("/auth/me", {
        full_name: name,
        phone: phone || null,
        email: email.trim() || null,
        city: city.trim() || null,
        state: state.trim() || null,
      });
      updateUser({ ...user!, ...updated });
      toast("Profile saved successfully! ✓");
    } catch (err: any) {
      toast(err.message || "Failed to save profile. Please try again.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div style={{ background: "#f8f9fa", minHeight: "100vh", paddingBottom: 60 }}>
      <Seo title="My Dashboard" path="/dashboard" noindex />
      {/* Premium Gradient Hero */}
      <div style={{ 
        background: "linear-gradient(135deg, #1e1e1e 0%, #3a3a3a 100%)", 
        padding: "60px 0 100px", 
        color: "#fff",
        position: "relative",
        overflow: "hidden"
      }}>
        <div 
          style={{
            position: "absolute",
            top: -100,
            right: -100,
            width: 400,
            height: 400,
            background: "url(/assets/img/mandala.svg) no-repeat center/contain",
            opacity: 0.1,
            animation: "spin 60s linear infinite"
          }} 
        />
        <div className="shell" style={{ position: "relative", zIndex: 2 }}>
          <div style={{ display: "flex", justifyContent: "flex-start", alignItems: "center", flexWrap: "wrap", gap: 20 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 24, flexWrap: "wrap" }}>
              {/* Avatar Profile */}
              <div style={{ 
                width: 90, 
                height: 90, 
                borderRadius: "50%", 
                background: "#FFD700", 
                display: "flex", 
                alignItems: "center", 
                justifyContent: "center",
                fontSize: "2.5rem",
                fontWeight: 800,
                color: "#1e1e1e",
                border: "4px solid rgba(255,255,255,0.2)",
                boxShadow: "0 8px 24px rgba(0,0,0,0.2)"
              }}>
                {user.full_name?.charAt(0).toUpperCase() || "D"}
              </div>
              <div>
                <h1 style={{ fontSize: "clamp(1.5rem, 4vw, 2rem)", margin: "0 0 8px 0", fontWeight: 700 }}>{user.full_name}</h1>
                <p style={{ margin: 0, opacity: 0.8, display: "flex", alignItems: "center", gap: 6 }}>
                  <Icon name="phone" size={14} /> {user.phone}
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Main Dashboard Layout */}
      <div className="shell dash" style={{ marginTop: "-40px", position: "relative", zIndex: 10 }}>
        {/* Left Sidebar */}
        <aside className="dash-nav" style={{ 
          background: "#fff", 
          borderRadius: 16, 
          padding: 12,
          boxShadow: "0 10px 30px rgba(0,0,0,0.05)",
          marginBottom: 20
        }}>
          <nav style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            {SECTIONS.map((s) => {
              const isActive = section === s.id;
              return (
                <button 
                  key={s.id} 
                  onClick={() => setSection(s.id)}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 12,
                    padding: "14px 16px",
                    background: isActive ? "#fff9e6" : "transparent",
                    color: isActive ? "#b8860b" : "#555",
                    border: "none",
                    borderRadius: 10,
                    fontWeight: isActive ? 600 : 500,
                    fontSize: "0.95rem",
                    cursor: "pointer",
                    transition: "all 0.2s",
                    textAlign: "left"
                  }}
                >
                  <Icon name={s.icon} size={18} style={{ color: isActive ? "#FFD700" : "#999" }} /> 
                  {s.label}
                </button>
              );
            })}
          </nav>
          <hr style={{ margin: "16px 12px", borderColor: "#f0f0f0" }} />
          <button 
            onClick={logout}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 12,
              padding: "14px 16px",
              background: "transparent",
              color: "#e53e3e",
              border: "none",
              width: "100%",
              borderRadius: 10,
              fontWeight: 500,
              fontSize: "0.95rem",
              cursor: "pointer",
              textAlign: "left"
            }}
          >
            <Icon name="log-out" size={18} /> Log Out
          </button>
        </aside>

        {/* Right Content Area */}
        <main style={{ minHeight: 400 }}>
          <AnimatePresence mode="wait">
            <motion.div
              key={section}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.2 }}
            >
              {/* 1. PROFILE SECTION */}
              {section === "profile" && (
                <div style={{ background: "#fff", borderRadius: 16, padding: "32px clamp(16px, 4vw, 32px)", boxShadow: "0 10px 30px rgba(0,0,0,0.05)" }}>
                  <div style={{ marginBottom: 30 }}>
                    <h2 style={{ fontSize: "1.4rem", margin: "0 0 6px 0", color: "#111" }}>Personal & Astrology Details</h2>
                    <p style={{ margin: 0, color: "#666", fontSize: "0.95rem" }}>Provide your birth details for accurate Kundli and Pandit consultations.</p>
                  </div>

                  {/* Shown only when the contact flow sent them here. Without
                      it the page opens on a profile form with no hint that a
                      Call/WhatsApp press is what interrupted them, or which
                      of these fields is standing in the way. */}
                  {wantsMobile && !user.phone_verified && (
                    <div style={{ marginBottom: 24, padding: "14px 16px", borderRadius: 12, background: "#fffbeb", border: "1px solid #f5a623" }}>
                      <strong style={{ display: "block", fontSize: "0.95rem", color: "#7c4a03", marginBottom: 4 }}>
                        Pandit Ji se contact karne ke liye mobile verify karein
                      </strong>
                      <span style={{ fontSize: "0.85rem", color: "#8a6134" }}>
                        Neeche apna number daaliye aur "Verify karein" dabaiye. WhatsApp par 4-digit code aayega.
                      </span>
                    </div>
                  )}

                  <form onSubmit={onProfileSave}>
                    <h3 style={{ fontSize: "1.1rem", marginBottom: 16, color: "#333", borderBottom: "1px solid #eee", paddingBottom: 8 }}>Basic Info</h3>
                    <div className="grid g-2" style={{ gap: 20, marginBottom: 32 }}>
                      <div>
                        <label style={{ display: "block", fontSize: "0.85rem", color: "#555", marginBottom: 6, fontWeight: 500 }}>Full Name</label>
                        <input 
                          value={name} 
                          onChange={e => setName(e.target.value)} 
                          style={{ width: "100%", padding: "12px 16px", borderRadius: 8, border: "1px solid #ddd", fontSize: "0.95rem", outline: "none" }} 
                        />
                      </div>
                      <div>
                        <label style={{ display: "block", fontSize: "0.85rem", color: "#555", marginBottom: 6, fontWeight: 500 }}>
                          Phone Number
                          {user.phone_verified
                            ? <span style={{ color: "#15803d", fontSize: "0.78rem", marginLeft: 8, fontWeight: 600 }}>✓ Verified</span>
                            : <span style={{ color: "#e53e3e", fontSize: "0.78rem", marginLeft: 8 }}>* Pandit Ji se contact karne ke liye zaroori</span>}
                        </label>

                        {/* The number itself. Editing it after verification
                            clears the flag server-side (updateMe), so the
                            Verify button comes straight back — the field is
                            deliberately left editable rather than locked. */}
                        <input
                          type="tel"
                          value={phone}
                          onChange={e => { setPhone(e.target.value); setOtpSent(false); setOtpError(null); }}
                          placeholder="e.g. +91 98765 43210"
                          autoComplete="tel"
                          style={{ width: "100%", padding: "12px 16px", borderRadius: 8, border: `1px solid ${user.phone_verified ? "#ddd" : "#f5a623"}`, fontSize: "0.95rem", outline: "none" }}
                        />

                        {!user.phone_verified && !otpSent && (
                          <>
                            <button
                              type="button"
                              onClick={onSendOtp}
                              disabled={otpBusy || !phone.trim()}
                              style={{ marginTop: 8, padding: "10px 18px", borderRadius: 8, border: "none", background: otpBusy || !phone.trim() ? "rgba(212,160,23,0.4)" : "var(--gold)", color: "#fff", fontWeight: 600, fontSize: "0.9rem", cursor: otpBusy || !phone.trim() ? "not-allowed" : "pointer" }}
                            >
                              {otpBusy ? "Bhej rahe hain…" : "Verify karein"}
                            </button>
                            <p style={{ margin: "6px 0 0", fontSize: "0.78rem", color: "#888" }}>
                              WhatsApp par ek 4-digit code aayega.
                            </p>
                          </>
                        )}

                        {!user.phone_verified && otpSent && (
                          <div style={{ marginTop: 10 }}>
                            <input
                              value={otpCode}
                              onChange={e => setOtpCode(e.target.value.replace(/\D/g, "").slice(0, 4))}
                              placeholder="4-digit code"
                              inputMode="numeric"
                              autoComplete="one-time-code"
                              maxLength={4}
                              autoFocus
                              style={{ width: "100%", padding: "12px 16px", borderRadius: 8, border: "1px solid #f5a623", fontSize: "1rem", letterSpacing: "0.3em", outline: "none" }}
                            />
                            <div style={{ display: "flex", gap: 8, marginTop: 8, flexWrap: "wrap" }}>
                              <button
                                type="button"
                                onClick={onConfirmOtp}
                                disabled={otpBusy || otpCode.length < 4}
                                style={{ padding: "10px 18px", borderRadius: 8, border: "none", background: otpBusy || otpCode.length < 4 ? "rgba(212,160,23,0.4)" : "var(--gold)", color: "#fff", fontWeight: 600, fontSize: "0.9rem", cursor: otpBusy || otpCode.length < 4 ? "not-allowed" : "pointer" }}
                              >
                                {otpBusy ? "Check kar rahe hain…" : "Confirm"}
                              </button>
                              <button
                                type="button"
                                onClick={onSendOtp}
                                disabled={otpBusy}
                                style={{ padding: "10px 18px", borderRadius: 8, border: "1px solid #ddd", background: "#fff", color: "#555", fontWeight: 500, fontSize: "0.9rem", cursor: otpBusy ? "not-allowed" : "pointer" }}
                              >
                                Dobara bhejein
                              </button>
                            </div>
                          </div>
                        )}

                        {otpError && (
                          <p style={{ margin: "6px 0 0", fontSize: "0.78rem", color: "#991b1b" }}>{otpError}</p>
                        )}
                      </div>
                      <div style={{ gridColumn: "1 / -1" }}>
                        <label style={{ display: "block", fontSize: "0.85rem", color: "#555", marginBottom: 6, fontWeight: 500 }}>
                          Email Address
                          {user.email && user.email_verified && (
                            <span style={{ color: "#15803d", fontSize: "0.78rem", marginLeft: 8, fontWeight: 600 }}>✓ Verified</span>
                          )}
                        </label>
                        <input
                          type="email"
                          value={email}
                          onChange={e => setEmail(e.target.value)}
                          placeholder="aapka@gmail.com"
                          autoComplete="email"
                          style={{ width: "100%", padding: "12px 16px", borderRadius: 8, border: "1px solid #ddd", fontSize: "0.95rem", outline: "none" }} 
                        />
                        {!user.email && (
                          <p style={{ margin: "4px 0 0", fontSize: "0.78rem", color: "#888" }}>
                            Add your email for booking updates and receipts
                          </p>
                        )}
                      </div>

                      {/* The devotee's own town. Nothing here could set it
                          before, so every account fell back to the CloudFront
                          guess — which resolves a mobile connection to the
                          carrier's gateway city, not the village someone is
                          actually in. Whatever they type here wins over that. */}
                      <div>
                        <label style={{ display: "block", fontSize: "0.85rem", color: "#555", marginBottom: 6, fontWeight: 500 }}>
                          City / Town
                        </label>
                        <input
                          value={city}
                          onChange={e => setCity(e.target.value)}
                          placeholder="e.g. Badagaon"
                          autoComplete="address-level2"
                          maxLength={120}
                          style={{ width: "100%", padding: "12px 16px", borderRadius: 8, border: "1px solid #ddd", fontSize: "0.95rem", outline: "none" }}
                        />
                      </div>
                      <div>
                        <label style={{ display: "block", fontSize: "0.85rem", color: "#555", marginBottom: 6, fontWeight: 500 }}>
                          State
                        </label>
                        <input
                          value={state}
                          onChange={e => setState(e.target.value)}
                          placeholder="e.g. Madhya Pradesh"
                          autoComplete="address-level1"
                          maxLength={120}
                          style={{ width: "100%", padding: "12px 16px", borderRadius: 8, border: "1px solid #ddd", fontSize: "0.95rem", outline: "none" }}
                        />
                      </div>

                      <div>
                        <label style={{ display: "block", fontSize: "0.85rem", color: "#555", marginBottom: 6, fontWeight: 500 }}>Gender</label>
                        <select 
                          value={gender}
                          onChange={e => setGender(e.target.value)}
                          style={{ width: "100%", padding: "12px 16px", borderRadius: 8, border: "1px solid #ddd", fontSize: "0.95rem", outline: "none", background: "#fff" }}
                        >
                          <option value="male">Male</option>
                          <option value="female">Female</option>
                          <option value="other">Other</option>
                        </select>
                      </div>
                    </div>

                    <h3 style={{ fontSize: "1.1rem", marginBottom: 16, color: "#333", borderBottom: "1px solid #eee", paddingBottom: 8 }}>Birth Details (For Kundli)</h3>
                    <div className="grid g-3" style={{ gap: 20, marginBottom: 32 }}>
                      <div>
                        <label style={{ display: "block", fontSize: "0.85rem", color: "#555", marginBottom: 6, fontWeight: 500 }}>Date of Birth</label>
                        <input 
                          type="date"
                          value={dob} 
                          onChange={e => setDob(e.target.value)} 
                          style={{ width: "100%", padding: "12px 16px", borderRadius: 8, border: "1px solid #ddd", fontSize: "0.95rem", outline: "none" }} 
                        />
                      </div>
                      <div>
                        <label style={{ display: "block", fontSize: "0.85rem", color: "#555", marginBottom: 6, fontWeight: 500 }}>Time of Birth</label>
                        <input 
                          type="time"
                          value={tob} 
                          onChange={e => setTob(e.target.value)} 
                          style={{ width: "100%", padding: "12px 16px", borderRadius: 8, border: "1px solid #ddd", fontSize: "0.95rem", outline: "none" }} 
                        />
                      </div>
                      <div>
                        <label style={{ display: "block", fontSize: "0.85rem", color: "#555", marginBottom: 6, fontWeight: 500 }}>Place of Birth</label>
                        <input 
                          placeholder="e.g. Ujjain, MP"
                          value={pob} 
                          onChange={e => setPob(e.target.value)} 
                          style={{ width: "100%", padding: "12px 16px", borderRadius: 8, border: "1px solid #ddd", fontSize: "0.95rem", outline: "none" }} 
                        />
                      </div>
                    </div>

                    <div style={{ display: "flex", justifyContent: "flex-end" }}>
                      <button 
                        type="submit" 
                        disabled={saving}
                        style={{
                          background: "#FFD700",
                          color: "#000",
                          border: "none",
                          padding: "14px 32px",
                          borderRadius: 8,
                          fontWeight: 700,
                          fontSize: "1rem",
                          cursor: "pointer",
                          display: "flex",
                          alignItems: "center",
                          gap: 8,
                          width: "100%",
                          justifyContent: "center"
                        }}
                      >
                        <Icon name="check" size={18} /> {saving ? "Saving..." : "Save Details"}
                      </button>
                    </div>
                  </form>
                </div>
              )}

              {/* 3. BOOKINGS SECTION */}
              {section === "bookings" && (
                <div style={{ background: "#fff", borderRadius: 16, padding: "32px clamp(16px, 4vw, 32px)", boxShadow: "0 10px 30px rgba(0,0,0,0.05)" }}>
                  <h2 style={{ fontSize: "1.4rem", margin: "0 0 24px 0", color: "#111" }}>My Consultations</h2>
                  <div style={{ textAlign: "center", padding: "60px 20px" }}>
                    <div style={{ width: 80, height: 80, borderRadius: "50%", background: "#f9f9f9", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 20px" }}>
                      <Icon name="calendar" size={32} style={{ color: "#ccc" }} />
                    </div>
                    <h3 style={{ margin: "0 0 8px 0", color: "#555" }}>No recent consultations</h3>
                    <p style={{ margin: "0 0 24px 0", color: "#999", fontSize: "0.95rem" }}>You haven't chatted or called any Pandit recently.</p>
                    <Link to="/pandits" style={{ display: "inline-block", background: "#FFD700", color: "#000", padding: "12px 24px", borderRadius: 8, textDecoration: "none", fontWeight: 600 }}>
                      Find a Pandit
                    </Link>
                  </div>
                </div>
              )}

              {/* 4. SAVED SECTION */}
              {section === "saved" && (
                <div style={{ background: "#fff", borderRadius: 16, padding: "32px clamp(16px, 4vw, 32px)", boxShadow: "0 10px 30px rgba(0,0,0,0.05)" }}>
                  <h2 style={{ fontSize: "1.4rem", margin: "0 0 24px 0", color: "#111" }}>Saved Pandits</h2>
                  <div style={{ textAlign: "center", padding: "60px 20px" }}>
                    <div style={{ width: 80, height: 80, borderRadius: "50%", background: "#fef2f2", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 20px" }}>
                      <Icon name="heart" size={32} style={{ color: "#f87171" }} />
                    </div>
                    <h3 style={{ margin: "0 0 8px 0", color: "#555" }}>No saved profiles</h3>
                    <p style={{ margin: "0 0 24px 0", color: "#999", fontSize: "0.95rem" }}>Click the heart icon on any Pandit's profile to save them here.</p>
                    <Link to="/pandits" style={{ display: "inline-block", background: "#FFD700", color: "#000", padding: "12px 24px", borderRadius: 8, textDecoration: "none", fontWeight: 600 }}>
                      Explore Pandits
                    </Link>
                  </div>
                </div>
              )}

            </motion.div>
          </AnimatePresence>
        </main>
      </div>
    </div>
  );
}
