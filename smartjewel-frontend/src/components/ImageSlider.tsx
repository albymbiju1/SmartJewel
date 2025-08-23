import React, { useState, useEffect, useRef, useCallback } from "react";

// Slides data (reflecting your latest manual changes)
const slides = [
  {
    id: 1,
    image: "/pexel6.jpg",
    title: "Diamond Collection",
    subtitle: "Timeless Elegance",
    description: "Discover our exquisite diamond jewelry crafted to perfection",
  },
  {
    id: 2,
    image: "/pexel2.jpg",
    title: "Gold Heritage",
    subtitle: "Pure Luxury",
    description: "Experience the finest gold jewelry with unmatched craftsmanship",
  },
  {
    id: 3,
    image: "/pexel3.jpg",
    title: "Precious Gems",
    subtitle: "Natural Beauty",
    description: "Rare gemstones set in designs that celebrate elegance",
  },
  {
    id: 4,
    image: "/pexel1.jpg",
    title: "Bridal Collection",
    subtitle: "Forever Yours",
    description: "Wedding jewelry that marks your special moments",
  },
  {
    id: 5,
    image: "/pexel4.jpg",
    title: "Luxury Ornaments",
    subtitle: "Precision & Style",
    description: "Ornaments that blend traditional craftsmanship with modern elegance",
  },
];

export default function ImageSlider() {
  const [currentSlide, setCurrentSlide] = useState<number>(0);
  const [isAutoPlaying, setIsAutoPlaying] = useState<boolean>(true);
  const [isTransitioning, setIsTransitioning] = useState<boolean>(false);
  const [touchStart, setTouchStart] = useState<number>(0);
  const [touchEnd, setTouchEnd] = useState<number>(0);
  const [imagesLoaded, setImagesLoaded] = useState<boolean[]>(
    new Array(slides.length).fill(false)
  );

  const sliderRef = useRef<HTMLDivElement>(null);
  const autoPlayRef = useRef<number | null>(null);
  const transitionTimeoutRef = useRef<number | null>(null);

  // Navigation helpers
  const nextSlide = useCallback(() => {
    if (isTransitioning) return;
    setIsTransitioning(true);
    setCurrentSlide((prev) => (prev + 1) % slides.length);

    if (transitionTimeoutRef.current) window.clearTimeout(transitionTimeoutRef.current);
    transitionTimeoutRef.current = window.setTimeout(() => {
      setIsTransitioning(false);
    }, 800);
  }, [isTransitioning]);

  const prevSlide = useCallback(() => {
    if (isTransitioning) return;
    setIsTransitioning(true);
    setCurrentSlide((prev) => (prev - 1 + slides.length) % slides.length);

    if (transitionTimeoutRef.current) window.clearTimeout(transitionTimeoutRef.current);
    transitionTimeoutRef.current = window.setTimeout(() => {
      setIsTransitioning(false);
    }, 800);
  }, [isTransitioning]);

  const goToSlide = useCallback(
    (index: number) => {
      if (isTransitioning || index === currentSlide) return;
      setIsTransitioning(true);
      setCurrentSlide(index);

      if (transitionTimeoutRef.current) window.clearTimeout(transitionTimeoutRef.current);
      transitionTimeoutRef.current = window.setTimeout(() => {
        setIsTransitioning(false);
      }, 800);
    },
    [currentSlide, isTransitioning]
  );

  // Auto-play
  const startAutoPlay = useCallback(() => {
    if (autoPlayRef.current) window.clearInterval(autoPlayRef.current);
    autoPlayRef.current = window.setInterval(() => {
      if (isAutoPlaying) nextSlide();
    }, 5000);
  }, [isAutoPlaying, nextSlide]);

  const stopAutoPlay = useCallback(() => {
    if (autoPlayRef.current) {
      window.clearInterval(autoPlayRef.current);
      autoPlayRef.current = null;
    }
  }, []);

  useEffect(() => {
    if (isAutoPlaying) startAutoPlay();
    else stopAutoPlay();

    return () => stopAutoPlay();
  }, [isAutoPlaying, startAutoPlay, stopAutoPlay]);

  // Keyboard navigation
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      switch (e.key) {
        case "ArrowLeft":
          e.preventDefault();
          prevSlide();
          break;
        case "ArrowRight":
          e.preventDefault();
          nextSlide();
          break;
        case " ":
        case "Spacebar":
          e.preventDefault();
          setIsAutoPlaying((prev: boolean) => !prev);
          break;
      }
    },
    [nextSlide, prevSlide]
  );

  useEffect(() => {
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [handleKeyDown]);

  // Touch/swipe
  const onTouchStart = (e: React.TouchEvent) => setTouchStart(e.targetTouches[0].clientX);
  const onTouchMove = (e: React.TouchEvent) => setTouchEnd(e.targetTouches[0].clientX);
  const onTouchEnd = () => {
    if (!touchStart || !touchEnd) return;
    const distance = touchStart - touchEnd;
    if (distance > 50) nextSlide();
    else if (distance < -50) prevSlide();
  };

  // Image load
  const handleImageLoad = (index: number) => {
    setImagesLoaded((prev: boolean[]) => {
      const next = [...prev];
      next[index] = true;
      return next;
    });
  };

  // Cleanup timers on unmount
  useEffect(() => {
    return () => {
      if (autoPlayRef.current) window.clearInterval(autoPlayRef.current);
      if (transitionTimeoutRef.current) window.clearTimeout(transitionTimeoutRef.current);
    };
  }, []);

  return (
    <section
      className="relative w-full h-[60vh] md:h-[70vh] overflow-hidden"
      ref={sliderRef}
      onMouseEnter={() => setIsAutoPlaying(false)}
      onMouseLeave={() => setIsAutoPlaying(true)}
      onTouchStart={onTouchStart}
      onTouchMove={onTouchMove}
      onTouchEnd={onTouchEnd}
      role="region"
      aria-label="Jewelry collection slider"
      aria-live="polite"
    >
      {/* Slides */}
      <div className="absolute inset-0">
        {slides.map((slide, index) => (
          <div
            key={slide.id}
            className="absolute inset-0 transition-opacity duration-700 ease-out"
            style={{ transform: `translateX(${(index - currentSlide) * 100}%)`, opacity: index === currentSlide ? 1 : 0 }}
          >
            {/* Background Image */}
            <div className="absolute inset-0">
              <img
                src={slide.image}
                alt={slide.title}
                className={`w-full h-full object-cover ${index === currentSlide && imagesLoaded[index] ? 'ken-burns' : ''}`}
                onLoad={() => handleImageLoad(index)}
                loading={index <= 2 ? 'eager' : 'lazy'}
              />
              <div className="absolute inset-0 bg-black/40" />
            </div>

            {/* Content */}
            <div className="absolute inset-0 flex items-center">
              <div className="container-xl">
                <p className="text-amber-400 uppercase tracking-wider text-xs md:text-sm mb-2">{slide.subtitle}</p>
                <h1 className="text-white font-serif text-3xl md:text-5xl font-semibold mb-3 drop-shadow-md">{slide.title}</h1>
                <p className="text-gray-100 max-w-xl text-sm md:text-base mb-5">{slide.description}</p>
                <button className="inline-flex items-center gap-2 bg-white/90 text-gray-900 hover:bg-white px-5 py-2.5 rounded-md text-sm font-medium" aria-label="Explore collection">
                  <span>Explore Collection</span>
                  <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Navigation */}
      <button
        className="absolute left-4 top-1/2 -translate-y-1/2 w-10 h-10 flex items-center justify-center rounded-full bg-white/70 hover:bg-white text-gray-900 shadow-md"
        onClick={prevSlide}
        disabled={isTransitioning}
        aria-label="Previous slide"
      >
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
        </svg>
      </button>

      <button
        className="absolute right-4 top-1/2 -translate-y-1/2 w-10 h-10 flex items-center justify-center rounded-full bg-white/70 hover:bg-white text-gray-900 shadow-md"
        onClick={nextSlide}
        disabled={isTransitioning}
        aria-label="Next slide"
      >
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
        </svg>
      </button>

      {/* Dots */}
      <div className="absolute bottom-5 left-1/2 -translate-x-1/2 flex items-center gap-2" role="tablist" aria-label="Slide pagination">
        {slides.map((_, index) => (
          <button
            key={index}
            className={`w-2.5 h-2.5 rounded-full border ${index === currentSlide ? 'bg-white border-white' : 'border-white/60 hover:bg-white/40'}`}
            onClick={() => goToSlide(index)}
            disabled={isTransitioning}
            aria-label={`Go to slide ${index + 1}`}
            aria-selected={index === currentSlide}
            role="tab"
          />
        ))}
      </div>

      {/* Counter */}
      <div className="absolute top-5 right-6 text-white/90 text-sm select-none" aria-hidden="true">
        <span className="font-mono">{String(currentSlide + 1).padStart(2, '0')}</span>
        <span className="mx-1">/</span>
        <span className="font-mono">{String(slides.length).padStart(2, '0')}</span>
      </div>

      {/* Auto-play control */}
      <button
        className="absolute bottom-5 right-6 w-10 h-10 flex items-center justify-center rounded-full bg-white/70 hover:bg-white text-gray-900 shadow-md"
        onClick={() => setIsAutoPlaying(!isAutoPlaying)}
        aria-label={isAutoPlaying ? 'Pause slideshow' : 'Play slideshow'}
      >
        {isAutoPlaying ? (
          <svg viewBox="0 0 24 24" fill="currentColor">
            <path d="M6 4h4v16H6V4zm8 0h4v16h-4V4z" />
          </svg>
        ) : (
          <svg viewBox="0 0 24 24" fill="currentColor">
            <path d="M8 5v14l11-7z" />
          </svg>
        )}
      </button>
    </section>
  );
}

