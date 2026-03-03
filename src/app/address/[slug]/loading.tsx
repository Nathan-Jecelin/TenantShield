export default function Loading() {
  return (
    <div style={{ maxWidth: 900, margin: "0 auto", padding: "24px 16px" }}>
      <style>{`
        @keyframes shimmer {
          0% { background-position: -400px 0; }
          100% { background-position: 400px 0; }
        }
        .skeleton {
          background: linear-gradient(90deg, #f0f0f0 25%, #e0e0e0 50%, #f0f0f0 75%);
          background-size: 800px 100%;
          animation: shimmer 1.5s infinite;
          border-radius: 6px;
        }
      `}</style>

      {/* Breadcrumb */}
      <div style={{ marginBottom: 24 }}>
        <div className="skeleton" style={{ width: 260, height: 14 }} />
      </div>

      {/* Header card */}
      <div
        style={{
          background: "#fff",
          border: "1px solid #e8ecf0",
          borderRadius: 12,
          padding: 24,
          marginBottom: 24,
        }}
      >
        <div className="skeleton" style={{ width: 320, height: 24, marginBottom: 12 }} />
        <div className="skeleton" style={{ width: 180, height: 14 }} />
      </div>

      {/* Stat boxes */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(3, 1fr)",
          gap: 16,
          marginBottom: 24,
        }}
      >
        {[1, 2, 3].map((i) => (
          <div
            key={i}
            style={{
              background: "#fff",
              border: "1px solid #e8ecf0",
              borderRadius: 12,
              padding: 20,
            }}
          >
            <div className="skeleton" style={{ width: 80, height: 12, marginBottom: 12 }} />
            <div className="skeleton" style={{ width: 48, height: 28 }} />
          </div>
        ))}
      </div>

      {/* Content sections */}
      {[1, 2].map((i) => (
        <div
          key={i}
          style={{
            background: "#fff",
            border: "1px solid #e8ecf0",
            borderRadius: 12,
            padding: 24,
            marginBottom: 24,
          }}
        >
          <div className="skeleton" style={{ width: 200, height: 18, marginBottom: 16 }} />
          <div className="skeleton" style={{ width: "100%", height: 14, marginBottom: 10 }} />
          <div className="skeleton" style={{ width: "90%", height: 14, marginBottom: 10 }} />
          <div className="skeleton" style={{ width: "75%", height: 14 }} />
        </div>
      ))}
    </div>
  );
}
