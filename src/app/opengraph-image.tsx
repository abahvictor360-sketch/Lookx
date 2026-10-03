import { ImageResponse } from "next/og";

export const alt = "LookX: Look it up before you pay, date, or trust";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

/** Social share card in the brand style (mint background, deep green). */
export default function OpengraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          padding: 80,
          background: "linear-gradient(135deg, #e7f8f0 0%, #f4faf7 55%, #d6f3e6 100%)",
          color: "#0f2e27",
          fontFamily: "sans-serif",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 18, fontSize: 44, fontWeight: 800 }}>
          <div style={{ width: 64, height: 64, borderRadius: 16, background: "#077a54", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
              <path d="m5 12.5 4.5 4.5L19 7.5" />
            </svg>
          </div>
          <span>Look<span style={{ color: "#12a877" }}>X</span></span>
        </div>
        <div style={{ marginTop: 40, fontSize: 76, fontWeight: 800, lineHeight: 1.05, display: "flex", flexDirection: "column" }}>
          <span>Look it up before you</span>
          <span style={{ color: "#12a877" }}>pay, date, or trust.</span>
        </div>
        <div style={{ marginTop: 32, fontSize: 30, color: "#4c6860" }}>
          Check phone numbers and photos for scams, fake vendors and stolen pictures.
        </div>
      </div>
    ),
    size,
  );
}
