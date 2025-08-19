import React, { useState, useEffect, useRef, useCallback } from "react";

// Slides data (reflecting your latest manual changes)
const slides = [
  {
    id: 1,
    image: "/Slide5.jpg",
    title: "Diamond Collection",
    subtitle: "Timeless Elegance",
    description: "Discover our exquisite diamond jewelry crafted to perfection",
  },
  {
    id: 2,
    image: "/Slide4.jpg",
    title: "Gold Heritage",
    subtitle: "Pure Luxury",
    description: "Experience the finest gold jewelry with unmatched craftsmanship",
  },
  {
    id: 3,
    image: "/Slide7.jpg",
    title: "Precious Gems",
    subtitle: "Natural Beauty",
    description: "Rare gemstones set in designs that celebrate elegance",
  },
  {
    id: 4,
    image: "/Slide9.jpg",
    title: "Bridal Collection",
    subtitle: "Forever Yours",
    description: "Wedding jewelry that marks your special moments",
  },
  {
    id: 5,
    image: "/Slide3.jpg",
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
      className="luxury-slider"
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
      <div className="luxury-slider-container">
        {slides.map((slide, index) => (
          <div
            key={slide.id}
            className={`luxury-slide ${index === currentSlide ? "active" : ""} ${
              index === (currentSlide - 1 + slides.length) % slides.length ? "prev" : ""
            } ${index === (currentSlide + 1) % slides.length ? "next" : ""}`}
            style={{ transform: `translateX(${(index - currentSlide) * 100}%)`, opacity: index === currentSlide ? 1 : 0 }}
          >
            {/* Background Image */}
            <div className="luxury-slide-image-container">
              <img
                src={slide.image}
                alt={slide.title}
                className={`luxury-slide-image ${imagesLoaded[index] ? "loaded" : ""}`}
                onLoad={() => handleImageLoad(index)}
                loading={index <= 2 ? "eager" : "lazy"}
              />
              <div className="luxury-slide-overlay" />
            </div>

            {/* Content */}
            <div className="luxury-slide-content">
              <div className="luxury-content-wrapper">
                <p className="luxury-subtitle">{slide.subtitle}</p>
                <h1 className="luxury-title">{slide.title}</h1>
                <p className="luxury-description">{slide.description}</p>
                <button className="luxury-cta-button" aria-label="Explore collection">
                  <span>Explore Collection</span>
                  <svg className="luxury-cta-arrow" viewBox="0 0 24 24" fill="none" stroke="currentColor">
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
        className="luxury-nav-btn luxury-nav-prev"
        onClick={prevSlide}
        disabled={isTransitioning}
        aria-label="Previous slide"
      >
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
        </svg>
      </button>

      <button
        className="luxury-nav-btn luxury-nav-next"
        onClick={nextSlide}
        disabled={isTransitioning}
        aria-label="Next slide"
      >
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
        </svg>
      </button>

      {/* Dots */}
      <div className="luxury-dots-container" role="tablist" aria-label="Slide pagination">
        {slides.map((_, index) => (
          <button
            key={index}
            className={`luxury-dot ${index === currentSlide ? "active" : ""}`}
            onClick={() => goToSlide(index)}
            disabled={isTransitioning}
            aria-label={`Go to slide ${index + 1}`}
            aria-selected={index === currentSlide}
            role="tab"
          />
        ))}
      </div>

      {/* Counter */}
      <div className="luxury-counter" aria-hidden="true">
        <span className="luxury-counter-current">
          {String(currentSlide + 1).padStart(2, "0")}
        </span>
        <span className="luxury-counter-separator">/</span>
        <span className="luxury-counter-total">
          {String(slides.length).padStart(2, "0")}
        </span>
      </div>

      {/* Auto-play control */}
      <button
        className={`luxury-autoplay-btn ${isAutoPlaying ? "playing" : "paused"}`}
        onClick={() => setIsAutoPlaying(!isAutoPlaying)}
        aria-label={isAutoPlaying ? "Pause slideshow" : "Play slideshow"}
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

