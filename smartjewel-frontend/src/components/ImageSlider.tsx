import React, { useState, useEffect, useCallback } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';

const ImageSlider = () => {
  const [currentSlide, setCurrentSlide] = useState(0);
  const [isTransitioning, setIsTransitioning] = useState(false);
  const [imageLoadErrors, setImageLoadErrors] = useState<Set<number>>(new Set());
  const [touchStart, setTouchStart] = useState<number | null>(null);
  const [touchEnd, setTouchEnd] = useState<number | null>(null);

  const slides = [
    {
      id: 1,
      image: '/Slide5.jpg',
      title: 'SmartJewel',
      subtitle: 'Sparkling Avenues',
      description: 'Trendy style, modern sparkle',
      buttonText: 'Shop Now',
      textPosition: 'left',
      badge: 'A Premium Collection'
    },
    {
      id: 2,
      image: '/Slide6.jpg',
      title: 'SmartJewel',
      subtitle: 'Golden Moments',
      description: 'Timeless elegance, modern design',
      buttonText: 'Explore Gold',
      textPosition: 'left',
      badge: 'A Premium Collection'
    },
    {
      id: 3,
      image: '/Slide7.jpg',
      title: 'SmartJewel',
      subtitle: 'Diamond Dreams',
      description: 'Brilliant diamonds, endless sparkle',
      buttonText: 'View Diamonds',
      textPosition: 'left',
      badge: 'A Premium Collection'
    }
  ];

  const goToSlide = useCallback((slideIndex: number) => {
    if (isTransitioning || slideIndex === currentSlide) return;
    setIsTransitioning(true);
    setCurrentSlide(slideIndex);
    setTimeout(() => setIsTransitioning(false), 700);
  }, [isTransitioning, currentSlide]);

  const goToPrevSlide = useCallback(() => {
    if (isTransitioning) return;
    setIsTransitioning(true);
    setCurrentSlide(prev => prev === 0 ? slides.length - 1 : prev - 1);
    setTimeout(() => setIsTransitioning(false), 700);
  }, [isTransitioning, slides.length]);

  const goToNextSlide = useCallback(() => {
    if (isTransitioning) return;
    setIsTransitioning(true);
    setCurrentSlide(prev => prev === slides.length - 1 ? 0 : prev + 1);
    setTimeout(() => setIsTransitioning(false), 700);
  }, [isTransitioning, slides.length]);

  useEffect(() => {
    const interval = setInterval(() => {
      if (!isTransitioning) {
        goToNextSlide();
      }
    }, 5000);

    return () => clearInterval(interval);
  }, [goToNextSlide, isTransitioning]);

  // Touch handlers for swipe functionality
  const handleTouchStart = (e: React.TouchEvent) => {
    setTouchEnd(null);
    setTouchStart(e.targetTouches[0].clientX);
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    setTouchEnd(e.targetTouches[0].clientX);
  };

  const handleTouchEnd = () => {
    if (!touchStart || !touchEnd) return;
    
    const distance = touchStart - touchEnd;
    const isLeftSwipe = distance > 50;
    const isRightSwipe = distance < -50;

    if (isLeftSwipe) {
      goToNextSlide();
    } else if (isRightSwipe) {
      goToPrevSlide();
    }
  };

  // Keyboard navigation
  useEffect(() => {
    const handleKeyPress = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft') {
        goToPrevSlide();
      } else if (e.key === 'ArrowRight') {
        goToNextSlide();
      }
    };

    window.addEventListener('keydown', handleKeyPress);
    return () => window.removeEventListener('keydown', handleKeyPress);
  }, [goToPrevSlide, goToNextSlide]);

  return (
    <div 
      style={{ position: 'relative', width: '100%', height: '100%', overflow: 'hidden' }}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
    >
      {/* Slides Container */}
      <div 
        style={{ 
          display: 'flex', 
          width: '100%', 
          height: '100%', 
          transition: 'transform 0.7s ease-in-out',
          transform: `translateX(-${currentSlide * 100}%)`
        }}
      >
        {slides.map((slide, index) => (
          <div
            key={slide.id}
            style={{
              width: '100%',
              height: '100%',
              flexShrink: 0,
              position: 'relative',
              background: imageLoadErrors.has(index) 
                ? 'linear-gradient(135deg, #f5f5dc 0%, #e6ddd4 100%)' 
                : 'linear-gradient(135deg, #f5f5dc 0%, #e6ddd4 100%)'
            }}
          >
            {/* Background Image */}
            {!imageLoadErrors.has(index) && (
              <img 
                src={slide.image}
                alt={slide.title}
                style={{
                  width: '100%',
                  height: '100%',
                  objectFit: 'cover',
                  objectPosition: 'center top'
                }}
                onError={(e) => {
                  console.error(`Failed to load image: ${slide.image}`);
                  setImageLoadErrors(prev => new Set([...prev, index]));
                }}
                onLoad={() => {
                  console.log(`Successfully loaded image: ${slide.image}`);
                }}
              />
            )}
            
            {/* Gradient Overlay */}
            <div style={{
              position: 'absolute',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              background: 'linear-gradient(to right, rgba(0,0,0,0.4), rgba(0,0,0,0.2), transparent)',
              zIndex: 5
            }}></div>
            
            {/* Content Overlay */}
            <div style={{
              position: 'absolute',
              top: '50%',
              left: '4rem',
              transform: 'translateY(-50%)',
              zIndex: 10,
              color: 'white',
              maxWidth: '450px'
            }}>
              {/* Logo Section */}
              <div style={{ marginBottom: '2rem' }}>
                <div style={{
                  width: '4rem',
                  height: '4rem',
                  background: 'rgba(255, 255, 255, 0.9)',
                  borderRadius: '0.5rem',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  marginBottom: '0.75rem',
                  padding: '0.5rem',
                  boxShadow: '0 4px 8px rgba(0,0,0,0.2)'
                }}>
                  <img 
                    src="/logo192.png" 
                    alt="SmartJewel" 
                    style={{
                      width: '100%',
                      height: '100%',
                      objectFit: 'contain'
                    }}
                  />
                </div>
                <div style={{
                  fontSize: '1.75rem',
                  fontWeight: 'bold',
                  color: 'white',
                  fontFamily: 'serif',
                  marginBottom: '0.25rem',
                  textShadow: '2px 2px 4px rgba(0,0,0,0.5)'
                }}>
                  {slide.title}
                </div>
                <div style={{
                  fontSize: '0.875rem',
                  color: '#f0f0f0',
                  textTransform: 'uppercase',
                  letterSpacing: '1px',
                  textShadow: '1px 1px 2px rgba(0,0,0,0.5)'
                }}>
                  {slide.badge}
                </div>
              </div>
              
              {/* Main Content */}
              <h1 style={{
                fontSize: '3.5rem',
                fontWeight: '300',
                lineHeight: '1.1',
                margin: '0 0 0.5rem 0',
                color: 'white',
                fontFamily: "'Brush Script MT', cursive",
                fontStyle: 'italic',
                textShadow: '2px 2px 4px rgba(0,0,0,0.5)'
              }}>
                {slide.subtitle}
              </h1>
              
              <p style={{
                fontSize: '1.25rem',
                fontWeight: '400',
                color: '#f0f0f0',
                margin: '0 0 2rem 0',
                letterSpacing: '0.5px',
                textShadow: '1px 1px 2px rgba(0,0,0,0.5)'
              }}>
                {slide.description}
              </p>
              
              {/* CTA Button */}
              <button 
                style={{
                  background: '#8B4513',
                  color: 'white',
                  padding: '1rem 2.5rem',
                  border: 'none',
                  borderRadius: '0.25rem',
                  fontSize: '1rem',
                  fontWeight: '600',
                  cursor: 'pointer',
                  transition: 'background-color 0.2s, transform 0.2s',
                  textTransform: 'uppercase',
                  letterSpacing: '0.5px',
                  boxShadow: '0 4px 8px rgba(0,0,0,0.2)'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = '#654321';
                  e.currentTarget.style.transform = 'translateY(-1px)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = '#8B4513';
                  e.currentTarget.style.transform = 'translateY(0)';
                }}
              >
                {slide.buttonText}
              </button>
            </div>
          </div>
        ))}
      </div>
      
      {/* Navigation Arrows */}
      <button
        onClick={goToPrevSlide}
        disabled={isTransitioning}
        style={{
          position: 'absolute',
          left: '2rem',
          top: '50%',
          transform: 'translateY(-50%)',
          background: 'rgba(255, 255, 255, 0.9)',
          border: 'none',
          borderRadius: '50%',
          width: '3rem',
          height: '3rem',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          cursor: 'pointer',
          transition: 'background-color 0.2s, transform 0.2s',
          zIndex: 20,
          opacity: isTransitioning ? 0.5 : 1,
          boxShadow: '0 2px 8px rgba(0,0,0,0.2)'
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.background = 'white';
          e.currentTarget.style.transform = 'translateY(-50%) scale(1.1)';
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.background = 'rgba(255, 255, 255, 0.9)';
          e.currentTarget.style.transform = 'translateY(-50%) scale(1)';
        }}
      >
        <ChevronLeft size={20} color="#8B4513" />
      </button>

      <button
        onClick={goToNextSlide}
        disabled={isTransitioning}
        style={{
          position: 'absolute',
          right: '2rem',
          top: '50%',
          transform: 'translateY(-50%)',
          background: 'rgba(255, 255, 255, 0.9)',
          border: 'none',
          borderRadius: '50%',
          width: '3rem',
          height: '3rem',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          cursor: 'pointer',
          transition: 'background-color 0.2s, transform 0.2s',
          zIndex: 20,
          opacity: isTransitioning ? 0.5 : 1,
          boxShadow: '0 2px 8px rgba(0,0,0,0.2)'
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.background = 'white';
          e.currentTarget.style.transform = 'translateY(-50%) scale(1.1)';
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.background = 'rgba(255, 255, 255, 0.9)';
          e.currentTarget.style.transform = 'translateY(-50%) scale(1)';
        }}
      >
        <ChevronRight size={20} color="#8B4513" />
      </button>
      
      {/* Slider Dots */}
      <div style={{
        position: 'absolute',
        bottom: '2rem',
        left: '50%',
        transform: 'translateX(-50%)',
        display: 'flex',
        gap: '0.75rem',
        zIndex: 20
      }}>
        {slides.map((_, index) => (
          <button
            key={index}
            onClick={() => goToSlide(index)}
            style={{
              width: index === currentSlide ? '2rem' : '0.75rem',
              height: '0.75rem',
              borderRadius: '0.375rem',
              background: index === currentSlide ? '#8B4513' : 'rgba(255, 255, 255, 0.6)',
              border: 'none',
              cursor: 'pointer',
              transition: 'all 0.3s ease',
              boxShadow: '0 2px 4px rgba(0,0,0,0.2)'
            }}
          />
        ))}
      </div>
    </div>
  );
};

export default ImageSlider;