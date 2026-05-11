// components/ui/background-image.tsx
"use client"

interface BackgroundImageProps {
  src: string;
  mobileSrc?: string;
  fallback?: string;
  opacity?: number;
  overlayOpacity?: number;
  className?: string;
}

export function BackgroundImage({
  src,
  mobileSrc,
  fallback,
  opacity = 0.08,
  overlayOpacity = 0.92,
  className = ""
}: BackgroundImageProps) {
  // CSS background-image con fallback: si la primera no carga, muestra la segunda
  const desktopBg = fallback
    ? `url(${src}), url(${fallback})`
    : `url(${src})`
  const mobileBg = mobileSrc
    ? (fallback ? `url(${mobileSrc}), url(${fallback})` : `url(${mobileSrc})`)
    : desktopBg

  return (
    <>
      {/* Fondo desktop: visible >= 807px */}
      <div
        className={`bg-desktop fixed inset-0 z-0 pointer-events-none ${className}`}
        style={{
          backgroundImage: desktopBg,
          backgroundSize: 'cover',
          backgroundPosition: 'center',
          backgroundRepeat: 'no-repeat',
          opacity,
        }}
      />

      {/* Fondo mobile: visible < 807px */}
      <div
        className={`bg-mobile fixed inset-0 z-0 pointer-events-none ${className}`}
        style={{
          backgroundImage: mobileBg,
          backgroundSize: 'cover',
          backgroundPosition: 'center',
          backgroundRepeat: 'no-repeat',
          opacity,
        }}
      />

      {/* Overlay blanco */}
      <div
        className="fixed inset-0 z-0 pointer-events-none"
        style={{
          backgroundColor: `rgba(255,255,255,${overlayOpacity})`,
        }}
      />

      <style jsx>{`
        .bg-desktop { display: block; }
        .bg-mobile { display: none; }
        @media (max-width: 806px) {
          .bg-desktop { display: none; }
          .bg-mobile { display: block; }
        }
      `}</style>
    </>
  )
}
