import { useRef, useEffect, useState } from 'react';
import Webcam from 'react-webcam';
import { Hands, Results } from '@mediapipe/hands';
import { Camera } from '@mediapipe/camera_utils';

interface BraceletTryOnProps {
    productId: string;
    bangleCount?: number;
    category?: string; // Product category to detect bangle vs bracelet
}

// Smoothing buffer for landmark positions
interface SmoothedPosition {
    wristX: number;
    wristY: number;
    wristWidth: number;
    rotationAngle: number;
}

export function BraceletTryOn({ productId, bangleCount = 1, category = '' }: BraceletTryOnProps) {
    const webcamRef = useRef<Webcam>(null);
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [braceletImage, setBraceletImage] = useState<HTMLImageElement | null>(null);
    const [cameraReady, setCameraReady] = useState(false);

    // Smoothing buffer per hand
    const smoothBuffers = useRef<Map<number, SmoothedPosition>>(new Map());

    useEffect(() => {
        const img = new Image();
        img.crossOrigin = 'anonymous';
        // Add cache-busting to ensure fresh transparent image
        img.src = `/api/product/${productId}/transparent?t=${Date.now()}`;

        img.onload = () => {
            console.log('Bracelet image loaded:', img.src);
            setBraceletImage(img);
            setIsLoading(false);
        };

        img.onerror = (e) => {
            console.error('Failed to load bracelet image:', e);
            setError('Failed to load bracelet image');
            setIsLoading(false);
        };
    }, [productId]);

    useEffect(() => {
        if (!cameraReady || !braceletImage) return;

        const hands = new Hands({
            locateFile: (file) => `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${file}`,
        });

        hands.setOptions({
            maxNumHands: 2,
            modelComplexity: 1,
            minDetectionConfidence: 0.7,
            minTrackingConfidence: 0.7,
        });

        hands.onResults(onHandsDetected);

        if (webcamRef.current?.video) {
            const camera = new Camera(webcamRef.current.video, {
                onFrame: async () => {
                    if (webcamRef.current?.video) {
                        await hands.send({ image: webcamRef.current.video });
                    }
                },
                width: 1280,
                height: 720,
            });
            camera.start();
        }

        return () => hands.close();
    }, [cameraReady, braceletImage]);

    // Smooth interpolation (exponential moving average)
    function smoothValue(current: number, target: number, alpha: number = 0.3): number {
        return current + (target - current) * alpha;
    }

    // Smooth angle with wrap-around handling
    function smoothAngle(current: number, target: number, alpha: number = 0.3): number {
        let diff = target - current;
        // Handle wrap-around at ±π
        if (diff > Math.PI) diff -= 2 * Math.PI;
        if (diff < -Math.PI) diff += 2 * Math.PI;
        return current + diff * alpha;
    }

    function onHandsDetected(results: Results) {
        const canvas = canvasRef.current;
        const video = webcamRef.current?.video;
        if (!canvas || !video || !braceletImage) return;

        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;

        // Draw mirrored video
        ctx.save();
        ctx.scale(-1, 1);
        ctx.translate(-canvas.width, 0);
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        ctx.restore();

        // Draw bracelets
        if (results.multiHandLandmarks) {
            results.multiHandLandmarks.forEach((landmarks, handIndex) => {
                drawBracelet2D(ctx, landmarks, handIndex);
            });
        }
    }

    function drawBracelet2D(ctx: CanvasRenderingContext2D, landmarks: any[], handIndex: number) {
        if (!braceletImage || !canvasRef.current) return;

        // Key wrist landmarks (MediaPipe Hands)
        const wristCenter = landmarks[0];      // Wrist center
        const thumbBase = landmarks[1];        // Thumb CMC (left edge)
        const indexBase = landmarks[5];        // Index MCP
        const pinkyBase = landmarks[17];       // Pinky MCP (right edge)

        // 1. WRIST CENTER CALCULATION (use actual wrist landmark)
        // Landmark 0 is wrist center - use it directly
        const wristCenterX = wristCenter.x;
        const wristCenterY = wristCenter.y;

        // 2. WRIST WIDTH CALCULATION (for sizing only)
        const wristWidthPixels = Math.sqrt(
            Math.pow((thumbBase.x - pinkyBase.x) * canvasRef.current.width, 2) +
            Math.pow((thumbBase.y - pinkyBase.y) * canvasRef.current.height, 2)
        );

        // 3. BRACELET ROTATION - Horizontal orientation
        // Source images are vertical, rotate +90° to make horizontal
        const braceletRotation = Math.PI / 2; // +90 degrees for horizontal display

        // 4. BRACELET PLACEMENT - Move DOWN to wrist base (toward arm)
        // Simple downward offset in normalized coordinates
        const downwardOffset = 0.08; // Move 8% down from wrist center toward arm
        const braceletCenterX = wristCenterX;
        const braceletCenterY = wristCenterY + downwardOffset; // DOWN toward arm

        // Convert to canvas coordinates (mirrored)
        const targetX = (1 - braceletCenterX) * canvasRef.current.width;
        const targetY = braceletCenterY * canvasRef.current.height;

        // 5. BRACELET SCALING - Sized to fit wrist snugly
        const braceletDiameter = wristWidthPixels * 1.8; // 180% of wrist width for snug fit

        // 6. SMOOTHING (prevent jitter)
        let smoothed = smoothBuffers.current.get(handIndex);
        if (!smoothed) {
            smoothed = {
                wristX: targetX,
                wristY: targetY,
                wristWidth: braceletDiameter,
                rotationAngle: braceletRotation  // Use base + wrist angle
            };
            smoothBuffers.current.set(handIndex, smoothed);
        }

        smoothed.wristX = smoothValue(smoothed.wristX, targetX, 0.35);
        smoothed.wristY = smoothValue(smoothed.wristY, targetY, 0.35);
        smoothed.wristWidth = smoothValue(smoothed.wristWidth, braceletDiameter, 0.25);
        smoothed.rotationAngle = smoothAngle(smoothed.rotationAngle, braceletRotation, 0.35);  // Full rotation with base

        // 7. DRAW BRACELETS (stacked if multiple)
        const spacing = smoothed.wristWidth * 0.12;

        for (let i = 0; i < bangleCount; i++) {
            const offset = i * spacing;

            ctx.save();
            ctx.translate(smoothed.wristX, smoothed.wristY + offset);

            // Debug: log rotation angle
            if (handIndex === 0 && i === 0) {
                console.log('Bracelet rotation (radians):', smoothed.rotationAngle, 'degrees:', (smoothed.rotationAngle * 180 / Math.PI));
            }

            ctx.rotate(smoothed.rotationAngle); // Apply rotation as specified

            // Optional: Slight transparency for depth feel
            ctx.globalAlpha = 0.95 - (i * 0.05);

            // Force elliptical shape for bracelets (wider than tall)
            // Source images are often square/circular, so we force a 3:2 ratio
            // to make rotation visible
            const braceletWidth = smoothed.wristWidth * 1.5; // Wider
            const braceletHeight = smoothed.wristWidth; // Standard height

            // Draw bracelet as ellipse (horizontal oval)
            ctx.drawImage(
                braceletImage,
                -braceletWidth / 2,
                -braceletHeight / 2,
                braceletWidth,
                braceletHeight
            );

            ctx.restore();
        }
    }

    if (error) {
        return (
            <div className="flex items-center justify-center h-96 bg-gray-100 rounded-lg">
                <div className="text-center">
                    <p className="text-red-500 font-semibold">{error}</p>
                    <p className="text-sm text-gray-600 mt-2">Please try again later</p>
                </div>
            </div>
        );
    }

    if (isLoading) {
        return (
            <div className="flex items-center justify-center h-96 bg-gray-100 rounded-lg">
                <div className="text-center">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-amber-600 mx-auto"></div>
                    <p className="mt-4 text-gray-600">Loading Virtual Try-On...</p>
                </div>
            </div>
        );
    }

    return (
        <div className="relative w-full max-w-4xl mx-auto">
            <div className="relative bg-black rounded-lg overflow-hidden" style={{ aspectRatio: '16/9' }}>
                <Webcam
                    ref={webcamRef}
                    audio={false}
                    mirrored={true}
                    className="absolute inset-0 w-full h-full object-cover opacity-0"
                    onUserMedia={() => setCameraReady(true)}
                    onUserMediaError={() => setError('Camera access denied')}
                />

                <canvas
                    ref={canvasRef}
                    className="absolute inset-0 w-full h-full object-cover"
                />

                {!cameraReady && (
                    <div className="absolute inset-0 flex items-center justify-center bg-gray-900">
                        <p className="text-white">Initializing camera...</p>
                    </div>
                )}
            </div>

            <div className="mt-4 text-center text-sm text-gray-600">
                <p>Show your hand to the camera</p>
                <p className="mt-1">Bracelet will lock to your wrist automatically</p>
            </div>
        </div>
    );
}
