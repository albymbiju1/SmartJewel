/**
 * 2D Bracelet Warping Pipeline for Virtual Try-On
 * 
 * This module implements a purely 2D solution to make circular bracelet product images
 * appear naturally wrapped around the wrist using perspective warping, elliptical fitting,
 * and image-space lighting effects.
 */

export interface WristEllipse {
    centerX: number;
    centerY: number;
    width: number;  // Major axis (horizontal)
    height: number; // Minor axis (vertical)
    rotation: number; // Rotation angle in radians
}

export interface BraceletSegment {
    image: HTMLImageElement;
    canvas: HTMLCanvasElement;
    startAngle: number;
    endAngle: number;
    isFront: boolean;
}

export interface WarpParams {
    frontThickness: number;    // Thickness multiplier for front segment (1.0 = normal)
    sideCompression: number;   // Compression factor for side segments (0.5 = 50% width)
    occlusionOpacity: number;  // Opacity for back segment (0.0-1.0)
    shadowIntensity: number;   // Shadow intensity (0.0-1.0)
    highlightIntensity: number; // Highlight intensity (0.0-1.0)
}

/**
 * Fit an ellipse to wrist landmarks
 */
export function fitWristEllipse(
    wristCenter: { x: number; y: number },
    thumbBase: { x: number; y: number },
    pinkyBase: { x: number; y: number },
    canvasWidth: number,
    canvasHeight: number
): WristEllipse {
    // Convert normalized coordinates to pixel coordinates
    const centerX = wristCenter.x * canvasWidth;
    const centerY = wristCenter.y * canvasHeight;

    const thumbX = thumbBase.x * canvasWidth;
    const thumbY = thumbBase.y * canvasHeight;
    const pinkyX = pinkyBase.x * canvasWidth;
    const pinkyY = pinkyBase.y * canvasHeight;

    // Calculate wrist width (major axis)
    const width = Math.sqrt(
        Math.pow(thumbX - pinkyX, 2) + Math.pow(thumbY - pinkyY, 2)
    );

    // Minor axis is typically 60-70% of major axis for wrist
    const height = width * 0.65;

    // Calculate rotation angle
    const dx = pinkyX - thumbX;
    const dy = pinkyY - thumbY;
    const rotation = Math.atan2(dy, dx);

    return {
        centerX,
        centerY,
        width: width * 1.8, // Slightly larger for bracelet fit
        height: height * 1.6,
        rotation
    };
}

/**
 * Split circular bracelet image into front and back segments
 * Front: -45° to +45° (90° arc)
 * Back: 135° to 225° (90° arc, will be occluded)
 * Sides: remaining angles (will be compressed)
 */
export function splitBraceletIntoSegments(
    braceletImage: HTMLImageElement,
    numSegments: number = 8
): BraceletSegment[] {
    const segments: BraceletSegment[] = [];
    const segmentAngle = (2 * Math.PI) / numSegments;

    // Create canvas for each segment
    const segmentSize = Math.max(braceletImage.width, braceletImage.height);

    for (let i = 0; i < numSegments; i++) {
        const startAngle = i * segmentAngle;
        const endAngle = (i + 1) * segmentAngle;

        // Determine if this is front, back, or side segment
        const centerAngle = (startAngle + endAngle) / 2;
        const normalizedAngle = ((centerAngle % (2 * Math.PI)) + (2 * Math.PI)) % (2 * Math.PI);

        // Front segment: around 0° (top of image)
        const isFront = normalizedAngle >= (7 * Math.PI / 4) || normalizedAngle <= (Math.PI / 4);
        // Back segment: around 180° (bottom of image)
        const isBack = normalizedAngle >= (3 * Math.PI / 4) && normalizedAngle <= (5 * Math.PI / 4);

        const canvas = document.createElement('canvas');
        canvas.width = segmentSize;
        canvas.height = segmentSize;
        const ctx = canvas.getContext('2d');

        if (ctx) {
            ctx.save();

            // Move to center
            ctx.translate(segmentSize / 2, segmentSize / 2);

            // Create clipping path for segment
            ctx.beginPath();
            ctx.moveTo(0, 0);
            ctx.arc(0, 0, segmentSize / 2, startAngle, endAngle);
            ctx.closePath();
            ctx.clip();

            // Draw the bracelet image
            ctx.drawImage(
                braceletImage,
                -segmentSize / 2,
                -segmentSize / 2,
                segmentSize,
                segmentSize
            );

            ctx.restore();
        }

        segments.push({
            image: braceletImage,
            canvas,
            startAngle,
            endAngle,
            isFront
        });
    }

    return segments;
}

/**
 * Apply perspective warping to create cylindrical illusion
 * Uses non-uniform scaling: front segments are thicker, side segments are compressed
 */
export function applyPerspectiveWarp(
    segment: BraceletSegment,
    ellipse: WristEllipse,
    params: WarpParams
): { canvas: HTMLCanvasElement; transform: DOMMatrix } {
    const outputCanvas = document.createElement('canvas');
    const ctx = outputCanvas.getContext('2d');
    if (!ctx) return { canvas: outputCanvas, transform: new DOMMatrix() };

    // Calculate segment position on ellipse
    const centerAngle = (segment.startAngle + segment.endAngle) / 2;
    const normalizedAngle = ((centerAngle % (2 * Math.PI)) + (2 * Math.PI)) % (2 * Math.PI);

    // Determine scaling based on position
    let scaleX = 1.0;
    let scaleY = 1.0;

    if (segment.isFront) {
        // Front segment: full thickness, no compression
        scaleX = params.frontThickness;
        scaleY = 1.0;
    } else {
        // Side/back segments: compressed horizontally
        const angleFromFront = Math.min(
            Math.abs(normalizedAngle),
            Math.abs(normalizedAngle - 2 * Math.PI)
        );
        const compressionFactor = params.sideCompression +
            (1 - params.sideCompression) * Math.cos(angleFromFront);
        scaleX = compressionFactor;
        scaleY = 0.9; // Slightly thinner vertically for depth
    }

    // Calculate position on ellipse
    const ellipseX = ellipse.centerX +
        (ellipse.width / 2) * Math.cos(centerAngle + ellipse.rotation);
    const ellipseY = ellipse.centerY +
        (ellipse.height / 2) * Math.sin(centerAngle + ellipse.rotation);

    // Set canvas size
    const segmentWidth = segment.canvas.width * scaleX;
    const segmentHeight = segment.canvas.height * scaleY;
    outputCanvas.width = segmentWidth;
    outputCanvas.height = segmentHeight;

    // Apply transformation
    ctx.save();
    ctx.scale(scaleX, scaleY);
    ctx.drawImage(segment.canvas, 0, 0);
    ctx.restore();

    // Create transform matrix for positioning
    const transform = new DOMMatrix()
        .translate(ellipseX, ellipseY)
        .rotate((centerAngle + ellipse.rotation) * (180 / Math.PI));

    return { canvas: outputCanvas, transform };
}

/**
 * NOTE: Wrist occlusion is now handled directly in renderWarpedBracelet
 * using destination-out composite operation. No separate mask canvas is needed.
 * This ensures masks are used only for processing, not rendering.
 */

/**
 * Split bracelet into front and back segments (not a closed ellipse)
 * Front: top 120° arc (visible)
 * Back: bottom 120° arc (will be occluded)
 * Sides: left and right arcs (compressed)
 */
export function splitBraceletFrontBack(
    braceletImage: HTMLImageElement
): { front: HTMLCanvasElement; back: HTMLCanvasElement; leftSide: HTMLCanvasElement; rightSide: HTMLCanvasElement } {
    const size = Math.max(braceletImage.width, braceletImage.height);
    const center = size / 2;
    const radius = size / 2;

    // Front segment: -60° to +60° (120° arc at top)
    const frontCanvas = document.createElement('canvas');
    frontCanvas.width = size;
    frontCanvas.height = size;
    const frontCtx = frontCanvas.getContext('2d', { alpha: true });
    if (frontCtx) {
        // Clear to transparent
        frontCtx.clearRect(0, 0, size, size);
        frontCtx.save();
        frontCtx.translate(center, center);
        frontCtx.beginPath();
        frontCtx.moveTo(0, 0);
        frontCtx.arc(0, 0, radius, -Math.PI / 3, Math.PI / 3);
        frontCtx.closePath();
        frontCtx.clip();
        // Draw full RGB bracelet image (not just alpha)
        frontCtx.globalCompositeOperation = 'source-over';
        frontCtx.drawImage(braceletImage, -center, -center, size, size);
        frontCtx.restore();
    }

    // Back segment: 120° to 240° (120° arc at bottom)
    const backCanvas = document.createElement('canvas');
    backCanvas.width = size;
    backCanvas.height = size;
    const backCtx = backCanvas.getContext('2d', { alpha: true });
    if (backCtx) {
        backCtx.clearRect(0, 0, size, size);
        backCtx.save();
        backCtx.translate(center, center);
        backCtx.beginPath();
        backCtx.moveTo(0, 0);
        backCtx.arc(0, 0, radius, (2 * Math.PI) / 3, (4 * Math.PI) / 3);
        backCtx.closePath();
        backCtx.clip();
        // Draw full RGB bracelet image (not just alpha)
        backCtx.globalCompositeOperation = 'source-over';
        backCtx.drawImage(braceletImage, -center, -center, size, size);
        backCtx.restore();
    }

    // Left side: 60° to 120° (60° arc)
    const leftSideCanvas = document.createElement('canvas');
    leftSideCanvas.width = size;
    leftSideCanvas.height = size;
    const leftCtx = leftSideCanvas.getContext('2d', { alpha: true });
    if (leftCtx) {
        leftCtx.clearRect(0, 0, size, size);
        leftCtx.save();
        leftCtx.translate(center, center);
        leftCtx.beginPath();
        leftCtx.moveTo(0, 0);
        leftCtx.arc(0, 0, radius, Math.PI / 3, (2 * Math.PI) / 3);
        leftCtx.closePath();
        leftCtx.clip();
        // Draw full RGB bracelet image (not just alpha)
        leftCtx.globalCompositeOperation = 'source-over';
        leftCtx.drawImage(braceletImage, -center, -center, size, size);
        leftCtx.restore();
    }

    // Right side: 240° to 300° (60° arc)
    const rightSideCanvas = document.createElement('canvas');
    rightSideCanvas.width = size;
    rightSideCanvas.height = size;
    const rightCtx = rightSideCanvas.getContext('2d', { alpha: true });
    if (rightCtx) {
        rightCtx.clearRect(0, 0, size, size);
        rightCtx.save();
        rightCtx.translate(center, center);
        rightCtx.beginPath();
        rightCtx.moveTo(0, 0);
        rightCtx.arc(0, 0, radius, (4 * Math.PI) / 3, (5 * Math.PI) / 3);
        rightCtx.closePath();
        rightCtx.clip();
        // Draw full RGB bracelet image (not just alpha)
        rightCtx.globalCompositeOperation = 'source-over';
        rightCtx.drawImage(braceletImage, -center, -center, size, size);
        rightCtx.restore();
    }

    return {
        front: frontCanvas,
        back: backCanvas,
        leftSide: leftSideCanvas,
        rightSide: rightSideCanvas
    };
}

/**
 * Apply lighting and shadow effects to bracelet segment
 */
export function applyLightingEffects(
    warpedCanvas: HTMLCanvasElement,
    ellipse: WristEllipse,
    segment: BraceletSegment,
    params: WarpParams
): HTMLCanvasElement {
    const output = document.createElement('canvas');
    output.width = warpedCanvas.width;
    output.height = warpedCanvas.height;
    const ctx = output.getContext('2d');

    if (!ctx) return warpedCanvas;

    // Draw original warped image
    ctx.drawImage(warpedCanvas, 0, 0);

    // Apply shadow (darker on bottom/back)
    if (params.shadowIntensity > 0) {
        const centerAngle = (segment.startAngle + segment.endAngle) / 2;
        const normalizedAngle = ((centerAngle % (2 * Math.PI)) + (2 * Math.PI)) % (2 * Math.PI);
        const isBack = normalizedAngle >= (3 * Math.PI / 4) && normalizedAngle <= (5 * Math.PI / 4);

        if (isBack) {
            ctx.globalCompositeOperation = 'multiply';
            ctx.fillStyle = `rgba(0, 0, 0, ${params.shadowIntensity * 0.4})`;
            ctx.fillRect(0, 0, output.width, output.height);
            ctx.globalCompositeOperation = 'source-over';
        }
    }

    // Apply highlight (lighter on top/front)
    if (params.highlightIntensity > 0 && segment.isFront) {
        const gradient = ctx.createLinearGradient(0, 0, 0, output.height);
        gradient.addColorStop(0, `rgba(255, 255, 255, ${params.highlightIntensity * 0.3})`);
        gradient.addColorStop(1, 'rgba(255, 255, 255, 0)');

        ctx.globalCompositeOperation = 'screen';
        ctx.fillStyle = gradient;
        ctx.fillRect(0, 0, output.width, output.height);
        ctx.globalCompositeOperation = 'source-over';
    }

    return output;
}

/**
 * STEP 1: Basic bracelet rendering (sanity check)
 * Just place the bracelet image on the wrist without any processing
 * NO masks, NO warping, NO ROI - just the bracelet image
 */
export function renderBraceletBasic(
    ctx: CanvasRenderingContext2D,
    braceletImage: HTMLImageElement,
    ellipse: WristEllipse
): void {
    // Simply draw the bracelet image at the wrist center
    ctx.save();
    ctx.translate(ellipse.centerX, ellipse.centerY);
    ctx.rotate(ellipse.rotation);

    // Draw bracelet image directly (no processing)
    const scale = ellipse.width / braceletImage.width;
    ctx.globalCompositeOperation = 'source-over';
    ctx.drawImage(
        braceletImage,
        -braceletImage.width / 2 * scale,
        -braceletImage.height / 2 * scale,
        braceletImage.width * scale,
        braceletImage.height * scale
    );

    ctx.restore();
}

/**
 * STEP 2: Basic 2D perspective warp (ellipse fit to wrist)
 * Apply simple elliptical warping to fit bracelet to wrist shape
 */
export function renderBraceletWithWarp(
    ctx: CanvasRenderingContext2D,
    braceletImage: HTMLImageElement,
    ellipse: WristEllipse
): void {
    // Draw bracelet with elliptical warping
    ctx.save();
    ctx.translate(ellipse.centerX, ellipse.centerY);
    ctx.rotate(ellipse.rotation);

    // Apply non-uniform scaling to fit ellipse
    const scaleX = ellipse.width / braceletImage.width;
    const scaleY = ellipse.height / braceletImage.height;
    ctx.scale(scaleX, scaleY);

    // Draw bracelet image
    ctx.globalCompositeOperation = 'source-over';
    ctx.drawImage(
        braceletImage,
        -braceletImage.width / 2,
        -braceletImage.height / 2
    );

    ctx.restore();
}

/**
 * STEP 3: Clean 2D water image - realistic and natural
 * Smooth gradient fade from visible to invisible
 */
export function renderBraceletWithOcclusion(
    ctx: CanvasRenderingContext2D,
    braceletImage: HTMLImageElement,
    ellipse: WristEllipse
): void {
    // Create temporary canvas
    const tempCanvas = document.createElement('canvas');
    const size = Math.max(braceletImage.width, braceletImage.height);
    tempCanvas.width = size;
    tempCanvas.height = size;
    const tempCtx = tempCanvas.getContext('2d');
    if (!tempCtx) return;

    // Draw the bracelet image
    tempCtx.drawImage(braceletImage, 0, 0, size, size);

    // Create smooth, natural alpha gradient (water image)
    // Very subtle transition for realistic look
    const gradient = tempCtx.createLinearGradient(
        0, 0,           // Top (front, visible)
        0, size         // Bottom (back, hidden)
    );

    // Much more gradual and natural fade
    gradient.addColorStop(0, 'rgba(255, 255, 255, 1.0)');      // Front: fully visible
    gradient.addColorStop(0.35, 'rgba(255, 255, 255, 1.0)');   // Keep front solid
    gradient.addColorStop(0.55, 'rgba(255, 255, 255, 0.6)');   // Gradual fade starts
    gradient.addColorStop(0.75, 'rgba(255, 255, 255, 0.15)');  // Almost invisible
    gradient.addColorStop(1.0, 'rgba(255, 255, 255, 0)');      // Back: fully invisible

    // Apply gradient as alpha mask
    tempCtx.globalCompositeOperation = 'destination-in';
    tempCtx.fillStyle = gradient;
    tempCtx.fillRect(0, 0, size, size);

    // Draw to canvas with proper transform
    ctx.save();
    ctx.translate(ellipse.centerX, ellipse.centerY);
    ctx.rotate(ellipse.rotation);

    // Slightly tighter fit for more realistic sizing
    const scaleX = (ellipse.width * 0.95) / size;  // 95% for snug fit
    const scaleY = (ellipse.height * 0.95) / size;
    ctx.scale(scaleX, scaleY);

    ctx.globalCompositeOperation = 'source-over';
    ctx.globalAlpha = 0.98; // Very slight transparency for natural blending
    ctx.drawImage(
        tempCanvas,
        -size / 2,
        -size / 2,
        size,
        size
    );

    ctx.restore();
}

/**
 * Render bracelet with proper front/back split and occlusion
 * This is the main function that creates realistic wrapping effect
 * 
 * IMPORTANT: All processing is done on temporary canvases.
 * Only warped bracelet pixels are alpha-blended onto the main canvas.
 * No mask layers, bounding boxes, or ROI artifacts are rendered.
 */
export function renderWarpedBracelet(
    ctx: CanvasRenderingContext2D,
    braceletImage: HTMLImageElement,
    ellipse: WristEllipse,
    params: Partial<WarpParams> = {}
): void {
    const defaultParams: WarpParams = {
        frontThickness: 1.3,
        sideCompression: 0.45,
        occlusionOpacity: 1.0, // Fully hide back segment
        shadowIntensity: 0.7,
        highlightIntensity: 0.5
    };

    const finalParams = { ...defaultParams, ...params };

    // Split bracelet into front, back, and side segments
    const segments = splitBraceletFrontBack(braceletImage);

    // Wrist ROI (ellipse) is used ONLY for calculations and mask creation
    // Mask canvases are used ONLY for processing (composite operations)
    // Mask canvases are NEVER drawn to output - only processed bracelet pixels are rendered

    const imageSize = Math.max(braceletImage.width, braceletImage.height);
    const baseScaleX = ellipse.width / imageSize;
    const baseScaleY = ellipse.height / imageSize;

    // Create FINAL bracelet canvas - this is the ONLY canvas drawn to output
    // All processing happens here, then only this canvas is composited
    const finalBraceletCanvas = document.createElement('canvas');
    finalBraceletCanvas.width = ctx.canvas.width;
    finalBraceletCanvas.height = ctx.canvas.height;
    const finalCtx = finalBraceletCanvas.getContext('2d', { alpha: true });

    if (!finalCtx) return;

    // CRITICAL: Initialize with fully transparent background (alpha = 0)
    finalCtx.clearRect(0, 0, finalBraceletCanvas.width, finalBraceletCanvas.height);

    // 1. Render FRONT segment (thicker, brighter, fully visible)
    const frontProcessCanvas = document.createElement('canvas');
    frontProcessCanvas.width = imageSize;
    frontProcessCanvas.height = imageSize;
    const frontProcessCtx = frontProcessCanvas.getContext('2d', { alpha: true });

    if (frontProcessCtx) {
        frontProcessCtx.clearRect(0, 0, imageSize, imageSize); // Transparent
        // Draw segment with full RGB data (not just alpha mask)
        frontProcessCtx.globalCompositeOperation = 'source-over';
        frontProcessCtx.drawImage(segments.front, 0, 0, imageSize, imageSize);

        // Add brightness boost to front (applied to RGB image)
        if (finalParams.highlightIntensity > 0) {
            frontProcessCtx.globalCompositeOperation = 'screen';
            frontProcessCtx.fillStyle = `rgba(255, 255, 255, ${finalParams.highlightIntensity * 0.2})`;
            frontProcessCtx.fillRect(0, 0, imageSize, imageSize);
            frontProcessCtx.globalCompositeOperation = 'source-over';
        }

        // Draw RGB bracelet image to final canvas (not mask)
        finalCtx.save();
        finalCtx.translate(ellipse.centerX, ellipse.centerY);
        finalCtx.rotate(ellipse.rotation);
        finalCtx.scale(baseScaleX * finalParams.frontThickness, baseScaleY);
        finalCtx.globalCompositeOperation = 'source-over';
        // Draw full RGB image, not just alpha
        finalCtx.drawImage(frontProcessCanvas, 0, 0, imageSize, imageSize, -imageSize / 2, -imageSize / 2, imageSize, imageSize);
        finalCtx.restore();
    }

    // 2. Render LEFT SIDE segment (compressed, darker)
    const leftProcessCanvas = document.createElement('canvas');
    leftProcessCanvas.width = imageSize;
    leftProcessCanvas.height = imageSize;
    const leftProcessCtx = leftProcessCanvas.getContext('2d', { alpha: true });

    if (leftProcessCtx) {
        leftProcessCtx.clearRect(0, 0, imageSize, imageSize); // Transparent
        // Draw segment with full RGB data (not just alpha mask)
        leftProcessCtx.globalCompositeOperation = 'source-over';
        leftProcessCtx.drawImage(segments.leftSide, 0, 0, imageSize, imageSize);

        // Darken side segments (applied to RGB image)
        leftProcessCtx.globalCompositeOperation = 'multiply';
        leftProcessCtx.fillStyle = `rgba(0, 0, 0, ${0.7})`;
        leftProcessCtx.fillRect(0, 0, imageSize, imageSize);
        leftProcessCtx.globalCompositeOperation = 'source-over';

        // Draw RGB bracelet image to final canvas (not mask)
        finalCtx.save();
        finalCtx.translate(ellipse.centerX, ellipse.centerY);
        finalCtx.rotate(ellipse.rotation + Math.PI / 2);
        finalCtx.scale(baseScaleX * finalParams.sideCompression, baseScaleY * 0.85);
        finalCtx.globalCompositeOperation = 'source-over';
        // Draw full RGB image, not just alpha
        finalCtx.drawImage(leftProcessCanvas, 0, 0, imageSize, imageSize, -imageSize / 2, -imageSize / 2, imageSize, imageSize);
        finalCtx.restore();
    }

    // 3. Render RIGHT SIDE segment (compressed, darker)
    const rightProcessCanvas = document.createElement('canvas');
    rightProcessCanvas.width = imageSize;
    rightProcessCanvas.height = imageSize;
    const rightProcessCtx = rightProcessCanvas.getContext('2d', { alpha: true });

    if (rightProcessCtx) {
        rightProcessCtx.clearRect(0, 0, imageSize, imageSize); // Transparent
        // Draw segment with full RGB data (not just alpha mask)
        rightProcessCtx.globalCompositeOperation = 'source-over';
        rightProcessCtx.drawImage(segments.rightSide, 0, 0, imageSize, imageSize);

        // Darken side segments (applied to RGB image)
        rightProcessCtx.globalCompositeOperation = 'multiply';
        rightProcessCtx.fillStyle = `rgba(0, 0, 0, ${0.7})`;
        rightProcessCtx.fillRect(0, 0, imageSize, imageSize);
        rightProcessCtx.globalCompositeOperation = 'source-over';

        // Draw RGB bracelet image to final canvas (not mask)
        finalCtx.save();
        finalCtx.translate(ellipse.centerX, ellipse.centerY);
        finalCtx.rotate(ellipse.rotation - Math.PI / 2);
        finalCtx.scale(baseScaleX * finalParams.sideCompression, baseScaleY * 0.85);
        finalCtx.globalCompositeOperation = 'source-over';
        // Draw full RGB image, not just alpha
        finalCtx.drawImage(rightProcessCanvas, 0, 0, imageSize, imageSize, -imageSize / 2, -imageSize / 2, imageSize, imageSize);
        finalCtx.restore();
    }

    // 4. Render BACK segment with occlusion (hidden behind wrist)
    const backProcessCanvas = document.createElement('canvas');
    backProcessCanvas.width = imageSize;
    backProcessCanvas.height = imageSize;
    const backProcessCtx = backProcessCanvas.getContext('2d', { alpha: true });

    if (backProcessCtx) {
        backProcessCtx.clearRect(0, 0, imageSize, imageSize); // Transparent
        // Draw segment with full RGB data (not just alpha mask)
        backProcessCtx.globalCompositeOperation = 'source-over';
        backProcessCtx.drawImage(segments.back, 0, 0, imageSize, imageSize);

        // Draw RGB bracelet image to final canvas (not mask)
        finalCtx.save();
        finalCtx.translate(ellipse.centerX, ellipse.centerY);
        finalCtx.rotate(ellipse.rotation + Math.PI);
        finalCtx.scale(baseScaleX * finalParams.sideCompression, baseScaleY * 0.85);
        finalCtx.globalCompositeOperation = 'source-over';
        finalCtx.globalAlpha = 0.2; // Subtle for depth
        // Draw full RGB image, not just alpha
        finalCtx.drawImage(backProcessCanvas, 0, 0, imageSize, imageSize, -imageSize / 2, -imageSize / 2, imageSize, imageSize);
        finalCtx.restore();

        // Apply occlusion: hide center portion (wrist area) using destination-out
        // This removes pixels where wrist would be - processing only, not rendering
        finalCtx.save();
        finalCtx.translate(ellipse.centerX, ellipse.centerY);
        finalCtx.rotate(ellipse.rotation);
        finalCtx.globalCompositeOperation = 'destination-out';
        finalCtx.fillStyle = 'white'; // White removes pixels
        finalCtx.beginPath();
        finalCtx.ellipse(0, 0, ellipse.width / 2.2, ellipse.height / 2.2, 0, 0, 2 * Math.PI);
        finalCtx.fill();
        finalCtx.restore();
    }

    // 5. Add CONTACT SHADOW under front segment
    finalCtx.save();
    finalCtx.translate(ellipse.centerX, ellipse.centerY);
    finalCtx.rotate(ellipse.rotation);

    const shadowGradient = finalCtx.createRadialGradient(
        0,
        ellipse.height * 0.15,
        0,
        0,
        ellipse.height * 0.15,
        ellipse.width * 0.4
    );

    shadowGradient.addColorStop(0, `rgba(0, 0, 0, ${finalParams.shadowIntensity * 0.4})`);
    shadowGradient.addColorStop(0.5, `rgba(0, 0, 0, ${finalParams.shadowIntensity * 0.2})`);
    shadowGradient.addColorStop(1, 'rgba(0, 0, 0, 0)');

    // Clip to front segment area
    finalCtx.beginPath();
    finalCtx.ellipse(0, 0, ellipse.width / 2, ellipse.height / 2, 0, 0, 2 * Math.PI);
    finalCtx.clip();

    // Draw shadow
    finalCtx.globalCompositeOperation = 'multiply';
    finalCtx.fillStyle = shadowGradient;
    finalCtx.beginPath();
    finalCtx.ellipse(0, 0, ellipse.width / 2, ellipse.height / 2, 0, 0, 2 * Math.PI);
    finalCtx.fill();
    finalCtx.restore();

    // FINAL COMPOSITE: Draw ONLY the final bracelet canvas to output
    // This canvas contains ONLY bracelet pixels (no masks, no ROI, no debug layers)
    ctx.save();
    ctx.globalCompositeOperation = 'source-over';
    ctx.drawImage(finalBraceletCanvas, 0, 0);
    ctx.restore();
}

/**
 * Simplified version: Single-pass warping for better performance
 * Uses a single transform instead of multiple segments
 */
export function renderWarpedBraceletSimple(
    ctx: CanvasRenderingContext2D,
    braceletImage: HTMLImageElement,
    ellipse: WristEllipse,
    params: Partial<WarpParams> = {}
): void {
    const defaultParams: WarpParams = {
        frontThickness: 1.2,
        sideCompression: 0.6,
        occlusionOpacity: 0.4,
        shadowIntensity: 0.5,
        highlightIntensity: 0.3
    };

    const finalParams = { ...defaultParams, ...params };

    ctx.save();

    // Move to ellipse center
    ctx.translate(ellipse.centerX, ellipse.centerY);
    ctx.rotate(ellipse.rotation);

    // Apply non-uniform scaling for cylindrical effect
    // Wider horizontally, compressed vertically
    const scaleX = ellipse.width / braceletImage.width;
    const scaleY = ellipse.height / braceletImage.height;

    // Additional perspective effect: compress sides
    ctx.scale(scaleX * finalParams.frontThickness, scaleY);

    // Draw bracelet
    ctx.drawImage(
        braceletImage,
        -braceletImage.width / 2,
        -braceletImage.height / 2
    );

    // Apply lighting overlay
    if (finalParams.highlightIntensity > 0) {
        const gradient = ctx.createLinearGradient(
            -braceletImage.width / 2,
            -braceletImage.height / 2,
            -braceletImage.width / 2,
            braceletImage.height / 2
        );
        gradient.addColorStop(0, `rgba(255, 255, 255, ${finalParams.highlightIntensity * 0.2})`);
        gradient.addColorStop(0.5, 'rgba(255, 255, 255, 0)');
        gradient.addColorStop(1, `rgba(0, 0, 0, ${finalParams.shadowIntensity * 0.2})`);

        ctx.globalCompositeOperation = 'overlay';
        ctx.fillStyle = gradient;
        ctx.fillRect(
            -braceletImage.width / 2,
            -braceletImage.height / 2,
            braceletImage.width,
            braceletImage.height
        );
        ctx.globalCompositeOperation = 'source-over';
    }

    ctx.restore();

    // Draw soft shadow
    ctx.save();
    ctx.globalAlpha = finalParams.shadowIntensity * 0.25;
    ctx.fillStyle = 'rgba(0, 0, 0, 0.6)';
    ctx.beginPath();
    ctx.ellipse(
        ellipse.centerX,
        ellipse.centerY + ellipse.height * 0.25,
        ellipse.width * 0.45,
        ellipse.height * 0.15,
        ellipse.rotation,
        0,
        2 * Math.PI
    );
    ctx.fill();
    ctx.restore();
}
