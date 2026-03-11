import { ImageResponse } from 'next/og';

export const runtime = 'edge';
export const alt = 'TenantShield — Research your landlord before you sign the lease';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

export default function OGImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          background: 'linear-gradient(135deg, #0a1628 0%, #0f2440 50%, #0a1628 100%)',
          fontFamily: 'system-ui, -apple-system, sans-serif',
          position: 'relative',
          overflow: 'hidden',
        }}
      >
        {/* Subtle grid pattern */}
        <div
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            opacity: 0.05,
            backgroundImage: 'linear-gradient(rgba(255,255,255,0.1) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.1) 1px, transparent 1px)',
            backgroundSize: '40px 40px',
            display: 'flex',
          }}
        />

        {/* Glow effect */}
        <div
          style={{
            position: 'absolute',
            top: '-100px',
            width: '600px',
            height: '600px',
            borderRadius: '50%',
            background: 'radial-gradient(circle, rgba(31,111,235,0.15) 0%, transparent 70%)',
            display: 'flex',
          }}
        />

        {/* Shield icon */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            marginBottom: 32,
          }}
        >
          <svg
            width="90"
            height="90"
            viewBox="0 0 32 32"
          >
            <path
              d="M16 29.3s10.7-5.3 10.7-13.3V6.7L16 2.7 5.3 6.7V16c0 8 10.7 13.3 10.7 13.3z"
              fill="#1f6feb"
            />
            <path
              d="M12.5 16.5l2.5 2.5 5-5"
              stroke="#fff"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
              fill="none"
            />
          </svg>
        </div>

        {/* Title */}
        <div
          style={{
            display: 'flex',
            fontSize: 56,
            fontWeight: 800,
            color: '#ffffff',
            letterSpacing: '-1px',
            marginBottom: 16,
          }}
        >
          TenantShield
        </div>

        {/* Tagline */}
        <div
          style={{
            display: 'flex',
            fontSize: 24,
            color: 'rgba(255,255,255,0.65)',
            maxWidth: 700,
            textAlign: 'center',
            lineHeight: 1.4,
          }}
        >
          Research your landlord before you sign the lease
        </div>

        {/* Feature pills */}
        <div
          style={{
            display: 'flex',
            gap: 16,
            marginTop: 40,
          }}
        >
          {['Building Violations', 'Tenant Reviews', 'Landlord Ratings'].map(
            (label) => (
              <div
                key={label}
                style={{
                  display: 'flex',
                  padding: '10px 24px',
                  borderRadius: 30,
                  background: 'rgba(31,111,235,0.15)',
                  border: '1px solid rgba(31,111,235,0.3)',
                  color: '#93c5fd',
                  fontSize: 16,
                  fontWeight: 600,
                }}
              >
                {label}
              </div>
            )
          )}
        </div>

        {/* URL at bottom */}
        <div
          style={{
            position: 'absolute',
            bottom: 32,
            display: 'flex',
            fontSize: 16,
            color: 'rgba(255,255,255,0.35)',
            fontWeight: 600,
          }}
        >
          mytenantshield.com
        </div>
      </div>
    ),
    { ...size },
  );
}
