"use client";

import { useState, useEffect, useRef } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import Image from "next/image";

const SLIDES = [
  {
    id: "cool-fruit",
    title: "Cool Fruit",
    subtitle: "Frescura y sabor natural en cada bocado",
    image: "https://www.miohelados.com.ar/modules/highlighted/images/big/imagenes/slide/2025_10 MIO--Slider--Cool-Fruit.jpg",
    fallback: "/fondo.jpg",
  },
  {
    id: "sin-gluten",
    title: "Copas Stop Sin Gluten",
    subtitle: "Opciones sin TACC para disfrutar sin preocupaciones",
    image: "https://www.miohelados.com.ar/modules/highlighted/images/big/imagenes/slide/2025_10-MIO--Slider--Copas-Stop-Sin-Gluten.jpg",
    fallback: "/fondo.png",
  },
  {
    id: "multipacks",
    title: "Multipacks",
    subtitle: "Variedad para compartir con toda la familia",
    image: "https://www.miohelados.com.ar/modules/highlighted/images/big/imagenes/slide/2025_10-MIO--Slider--Multipacks.jpg",
    fallback: "/fondocel.jpg",
  },
];

export function HeroCarousel() {
  const [index, setIndex] = useState(0);
  const [imgErrors, setImgErrors] = useState<Record<number, boolean>>({});
  const [logoLoaded, setLogoLoaded] = useState(false);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  const resetInterval = () => {
    if (intervalRef.current) clearInterval(intervalRef.current);
    intervalRef.current = setInterval(
      () => setIndex((p) => (p + 1) % SLIDES.length),
      4500,
    );
  };

  useEffect(() => {
    resetInterval();
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, []);

  const go = (dir: number) => {
    setIndex((p) => (p + dir + SLIDES.length) % SLIDES.length);
    resetInterval();
  };

  return (
    <section className="relative w-full overflow-hidden rounded-2xl h-[200px] sm:h-[280px] md:h-[360px]">
      {SLIDES.map((slide, i) => (
        <div
          key={slide.id}
          className="absolute inset-0 transition-opacity duration-700"
          style={{ opacity: i === index ? 1 : 0, pointerEvents: i === index ? "auto" : "none" }}
        >
          <Image
            src={imgErrors[i] ? slide.fallback : slide.image}
            alt={slide.title}
            fill
            priority={i === 0}
            className="object-cover"
            onError={() => setImgErrors((prev) => ({ ...prev, [i]: true }))}
          />
          {/* Dark overlay with gradient */}
          <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/40 to-black/20" />

          <div className="relative z-10 flex items-end sm:items-center justify-center h-full pb-10 sm:pb-0">
            <div className="text-center text-white px-6 max-w-2xl mx-auto">
              <div className="mb-2 sm:mb-3 flex justify-center">
                <div className="relative h-14 w-14 sm:h-20 sm:w-20 md:h-24 md:w-24 drop-shadow-lg">
                  {!logoLoaded && <div className="absolute inset-0 animate-pulse rounded-full bg-white/20" />}
                  <Image
                    src="/logo.png"
                    alt="Helados Mio"
                    fill
                    priority
                    className={`object-contain animate-float transition-opacity duration-300 ${logoLoaded ? "opacity-100" : "opacity-0"}`}
                    onLoad={() => setLogoLoaded(true)}
                  />
                </div>
              </div>
              <h2 className="text-xl sm:text-3xl md:text-4xl font-extrabold mb-1 sm:mb-2 drop-shadow-md tracking-tight">
                {slide.title}
              </h2>
              <p className="text-xs sm:text-sm md:text-base text-white/85 max-w-md mx-auto">
                {slide.subtitle}
              </p>
            </div>
          </div>
        </div>
      ))}

      <button
        aria-label="Anterior"
        onClick={() => go(-1)}
        className="absolute left-2 sm:left-3 top-1/2 -translate-y-1/2 z-20 h-8 w-8 sm:h-10 sm:w-10 rounded-full bg-black/30 hover:bg-black/50 active:bg-black/60 text-white flex items-center justify-center transition-colors"
      >
        <ChevronLeft className="h-4 w-4 sm:h-5 sm:w-5" />
      </button>
      <button
        aria-label="Siguiente"
        onClick={() => go(1)}
        className="absolute right-2 sm:right-3 top-1/2 -translate-y-1/2 z-20 h-8 w-8 sm:h-10 sm:w-10 rounded-full bg-black/30 hover:bg-black/50 active:bg-black/60 text-white flex items-center justify-center transition-colors"
      >
        <ChevronRight className="h-4 w-4 sm:h-5 sm:w-5" />
      </button>

      <div className="absolute bottom-3 sm:bottom-4 left-1/2 -translate-x-1/2 z-20 flex gap-1.5">
        {SLIDES.map((slide, i) => (
          <button
            key={slide.id}
            aria-label={`Slide ${i + 1}`}
            onClick={() => { setIndex(i); resetInterval(); }}
            className={`rounded-full transition-all duration-300 ${i === index ? "w-6 h-2 bg-white shadow-sm" : "w-2 h-2 bg-white/40 hover:bg-white/60"}`}
          />
        ))}
      </div>

      <style jsx>{`
        @keyframes float {
          0%, 100% { transform: translateY(0px); }
          50% { transform: translateY(-6px); }
        }
        :global(.animate-float) {
          animation: float 3s ease-in-out infinite;
        }
      `}</style>
    </section>
  );
}
