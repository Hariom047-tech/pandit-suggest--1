import { useLocation } from "react-router-dom";
import { Seo } from "../lib/Seo";
import { useLang } from "../lib/i18n";
import { LEGAL, HINDI_PREVAILS, type LegalBlock } from "./legalContent";

/**
 * Privacy Policy and Terms of Use — the same component for both routes,
 * chosen by the path.
 *
 * The text moved out to legalContent.ts so it can carry a Hindi version
 * without the paragraphs and the markup being tangled together. On the Hindi
 * rendering a notice says the English version governs, which is the ordinary
 * practice for a translated legal document: the reader is told which one is
 * authoritative rather than left to assume.
 */
export default function Legal() {
  const location = useLocation();
  const { lang } = useLang();
  const isPrivacy = location.pathname.includes("privacy");

  const doc = LEGAL[isPrivacy ? "privacy" : "terms"][lang === "hi" ? "hi" : "en"];

  return (
    <div style={{ backgroundColor: "#fff", minHeight: "100vh", color: "#333", fontFamily: "Arial, sans-serif" }}>
      <Seo
        title={isPrivacy ? "Privacy Policy" : "Terms of Use"}
        description={isPrivacy
          ? "How PanditSuggest collects, uses and protects your personal data."
          : "The terms governing your use of PanditSuggest."}
        path={isPrivacy ? "/privacy" : "/terms"}
      />
      <div style={{ maxWidth: 1000, margin: "0 auto", padding: "40px 20px" }}>
        <h1 style={{ textAlign: "center", fontSize: "1.5rem", marginBottom: 30, letterSpacing: "1px", color: "#000" }}>
          {doc.title}
        </h1>

        {lang === "hi" && (
          <p style={{
            fontSize: "0.85rem", lineHeight: 1.6, color: "#6b5b3e", background: "#fffbeb",
            border: "1px solid #f5d78e", borderRadius: 8, padding: "12px 14px", marginBottom: 24,
          }}>
            {HINDI_PREVAILS}
          </p>
        )}

        <div style={{ fontSize: "0.95rem", lineHeight: 1.6, display: "flex", flexDirection: "column", gap: 16 }}>
          {doc.blocks.map((b: LegalBlock, i) => (
            <div key={i} style={{ display: "contents" }}>
              {b.h && (
                <h3 style={{ fontSize: "1.1rem", marginTop: 24, marginBottom: 8, color: "#000" }}>{b.h}</h3>
              )}
              {/* textTransform, not pre-uppercased text: the statutory warnings
                  must read as shouted in English, but forcing Devanagari
                  through the same rule does nothing at all — Hindi has no case
                  — so the emphasis is carried by weight there instead. */}
              <p style={b.upper
                ? (lang === "hi"
                    ? { fontWeight: 600 }
                    : { textTransform: "uppercase" as const })
                : undefined}
              >
                {b.p}
              </p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
