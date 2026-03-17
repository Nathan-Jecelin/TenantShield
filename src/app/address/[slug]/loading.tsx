export default function Loading() {
  return (
    <div style={{
      minHeight: "100vh",
      background: "#f6f8fa",
      fontFamily: "-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif",
    }}>
      {/* Nav skeleton */}
      <div style={{
        background: "#fff",
        borderBottom: "1px solid #e8ecf0",
        padding: "12px 24px",
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        position: "sticky",
        top: 0,
        zIndex: 100,
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <div className="skeleton" style={{ width: 22, height: 22, borderRadius: "50%" }} />
          <div className="skeleton" style={{ width: 120, height: 18 }} />
        </div>
        <div style={{ display: "flex", gap: 10 }}>
          <div className="skeleton" style={{ width: 50, height: 32, borderRadius: 6 }} />
          <div className="skeleton" style={{ width: 100, height: 32, borderRadius: 6 }} />
        </div>
      </div>

      <div style={{ maxWidth: 720, margin: "0 auto", padding: "24px 20px" }}>
        {/* Breadcrumb */}
        <div style={{ marginBottom: 16 }}>
          <div className="skeleton" style={{ width: 280, height: 14 }} />
        </div>

        {/* Summary card */}
        <div style={{
          background: "#fff",
          border: "1px solid #e8ecf0",
          borderRadius: 12,
          overflow: "hidden",
          marginBottom: 16,
          boxShadow: "0 1px 4px rgba(0,0,0,0.06)",
        }}>
          <div style={{ padding: "28px 28px 20px", borderBottom: "1px solid #e8ecf0" }}>
            <div className="skeleton" style={{ width: 340, height: 26, marginBottom: 8 }} />
            <div className="skeleton" style={{ width: 220, height: 14, marginBottom: 20 }} />
            <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
              <div className="skeleton" style={{ width: 52, height: 40 }} />
              <div className="skeleton" style={{ width: 120, height: 18 }} />
              <div style={{ width: 1, height: 36, background: "#e8ecf0" }} />
              <div className="skeleton" style={{ width: 48, height: 48, borderRadius: 10 }} />
              <div>
                <div className="skeleton" style={{ width: 110, height: 14, marginBottom: 4 }} />
                <div className="skeleton" style={{ width: 90, height: 12 }} />
              </div>
            </div>
          </div>
          <div style={{ padding: "20px 28px" }}>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12 }}>
              {[1, 2, 3, 4].map((i) => (
                <div key={i} style={{ padding: 16, background: "#f6f8fa", borderRadius: 8, textAlign: "center" }}>
                  <div className="skeleton" style={{ width: 20, height: 20, margin: "0 auto 8px", borderRadius: 4 }} />
                  <div className="skeleton" style={{ width: 40, height: 24, margin: "0 auto 4px" }} />
                  <div className="skeleton" style={{ width: 60, height: 10, margin: "0 auto" }} />
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Tab bar */}
        <div style={{
          background: "#fff",
          borderBottom: "1px solid #e8ecf0",
          borderRadius: "8px 8px 0 0",
          marginBottom: 16,
          padding: "0 8px",
          display: "flex",
          gap: 8,
        }}>
          {[80, 100, 100, 80, 80].map((w, i) => (
            <div key={i} style={{ padding: "12px 8px" }}>
              <div className="skeleton" style={{ width: w, height: 14 }} />
            </div>
          ))}
        </div>

        {/* Content sections */}
        {[1, 2].map((i) => (
          <div key={i} style={{
            background: "#fff",
            border: "1px solid #e8ecf0",
            borderRadius: 10,
            padding: 24,
            marginBottom: 16,
            boxShadow: "0 1px 3px rgba(0,0,0,0.04)",
          }}>
            <div className="skeleton" style={{ width: 200, height: 16, marginBottom: 16 }} />
            <div className="skeleton" style={{ width: "100%", height: 14, marginBottom: 10 }} />
            <div className="skeleton" style={{ width: "90%", height: 14, marginBottom: 10 }} />
            <div className="skeleton" style={{ width: "75%", height: 14 }} />
          </div>
        ))}
      </div>
    </div>
  );
}
