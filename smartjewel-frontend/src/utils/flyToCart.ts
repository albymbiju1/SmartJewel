// Lightweight "fly-to-cart" animation utility
// Creates a ghost image that flies from a source element to the cart icon
// Usage:
//   flyToCart({ source: imgElement });
//   flyToCart({ source: imgElement, imageUrl: 'https://...' });

export function flyToCart(opts: { source: Element | null | undefined; imageUrl?: string; size?: number; durationMs?: number }) {
  try {
    const { source, imageUrl, size = 80, durationMs = 650 } = opts || ({} as any);
    if (!source) return;

    // Try to find the actual Cart button first; if missing (e.g., page without header),
    // fall back to a global invisible anchor rendered at app root.
    const targetEl = (document.querySelector('#app-cart-button') as HTMLElement | null)
      || (document.querySelector('button[aria-label="Cart"]') as HTMLElement | null)
      || (document.querySelector('[data-cart-anchor]') as HTMLElement | null);
    if (!targetEl) return;

    // Compute start rect from source element (typically an <img>)
    const startRect = (source as HTMLElement).getBoundingClientRect();
    const targetRect = targetEl.getBoundingClientRect();

    // Create a ghost image element
    const ghost = document.createElement('img');
    const srcAttr = (source as HTMLImageElement).src;
    ghost.src = srcAttr || imageUrl || '/logo192.png';
    ghost.alt = 'flying-to-cart';
    ghost.style.position = 'fixed';
    ghost.style.left = `${startRect.left}px`;
    ghost.style.top = `${startRect.top}px`;
    ghost.style.width = `${startRect.width}px`;
    ghost.style.height = `${startRect.height}px`;
    ghost.style.objectFit = 'cover';
    ghost.style.borderRadius = '10px';
    ghost.style.boxShadow = '0 8px 24px rgba(0,0,0,0.15)';
    ghost.style.zIndex = '9999';
    ghost.style.pointerEvents = 'none';
    ghost.style.opacity = '0.95';
    ghost.style.transition = `transform ${durationMs}ms cubic-bezier(.2,.7,.3,1), opacity ${durationMs}ms ease`;
    ghost.style.willChange = 'transform, opacity';

    document.body.appendChild(ghost);

    const startCenterX = startRect.left + startRect.width / 2;
    const startCenterY = startRect.top + startRect.height / 2;

    const targetCenterX = targetRect.left + targetRect.width / 2;
    const targetCenterY = targetRect.top + targetRect.height / 2;

    const deltaX = targetCenterX - startCenterX;
    const deltaY = targetCenterY - startCenterY;

    // Scale down to a uniform small square near the badge size
    const scale = Math.max(0.2, Math.min(0.35, size / Math.max(startRect.width, startRect.height)));

    // Force layout, then animate
    // eslint-disable-next-line @typescript-eslint/no-unused-expressions
    ghost.offsetHeight;

    requestAnimationFrame(() => {
      ghost.style.transform = `translate(${deltaX}px, ${deltaY}px) scale(${scale})`;
      ghost.style.opacity = '0.1';
    });

    const cleanup = () => {
      if (ghost && ghost.parentNode) ghost.parentNode.removeChild(ghost);
    };

    const to = window.setTimeout(cleanup, durationMs + 120);
    ghost.addEventListener('transitionend', () => {
      window.clearTimeout(to);
      cleanup();
    }, { once: true });
  } catch (e) {
    // Fail quietly; this is a progressive enhancement
  }
}