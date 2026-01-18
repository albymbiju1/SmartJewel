import { useRef, useEffect, useState, useCallback } from 'react';
import Webcam from 'react-webcam';
import { Hands, Results } from '@mediapipe/hands';
import { Camera } from '@mediapipe/camera_utils';
import {
    fitWristEllipse,
    renderBraceletBasic,
    renderBraceletWithWarp,
    renderBraceletWithOcclusion,
    type WristEllipse
} from '../utils/braceletWarping2D';

interface BraceletTryOnProps {
    productId: string;
    bangleCount?: number;
    category?: string; // Product category to detect bangle vs bracelet
}

// Smoothing buffer for landmark positions
interface SmoothedPosition {
    ellipse: WristEllipse;
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

    // Smooth angle with wrap-around handling
    const smoothAngle = useCallback((current: number, target: number, alpha: number = 0.3): number => {
        let diff = target - current;
        // Handle wrap-around at ±π
        if (diff > Math.PI) diff -= 2 * Math.PI;
        if (diff < -Math.PI) diff += 2 * Math.PI;
        return current + diff * alpha;
    }, []);

    // Smooth ellipse parameters
    const smoothEllipse = useCallback((
        current: WristEllipse,
        target: WristEllipse,
        alpha: number = 0.3
    ): WristEllipse => {
        return {
            centerX: current.centerX + (target.centerX - current.centerX) * alpha,
            centerY: current.centerY + (target.centerY - current.centerY) * alpha,
            width: current.width + (target.width - current.width) * alpha,
            height: current.height + (target.height - current.height) * alpha,
            rotation: smoothAngle(current.rotation, target.rotation, alpha)
        };
    }, [smoothAngle]);

    const drawBracelet2D = useCallback((ctx: CanvasRenderingContext2D, landmarks: any[], handIndex: number) => {
        if (!braceletImage || !canvasRef.current) return;

        // Key wrist landmarks (MediaPipe Hands)
        const wristCenter = landmarks[0];      // Wrist center
        const thumbBase = landmarks[1];        // Thumb CMC (left edge)
        const pinkyBase = landmarks[17];       // Pinky MCP (right edge)

        // Fit ellipse to wrist using landmarks
        // Note: MediaPipe coordinates are normalized (0-1), need to account for mirroring
        const targetEllipse = fitWristEllipse(
            {
                x: 1 - wristCenter.x, // Mirror X coordinate
                y: wristCenter.y
            },
            {
                x: 1 - thumbBase.x,   // Mirror X coordinate
                y: thumbBase.y
            },
            {
                x: 1 - pinkyBase.x,   // Mirror X coordinate
                y: pinkyBase.y
            },
            canvasRef.current.width,
            canvasRef.current.height
        );

        // Adjust Y position downward (toward arm) for better placement
        targetEllipse.centerY += canvasRef.current.height * 0.05;

        // Smoothing (prevent jitter)
        let smoothed = smoothBuffers.current.get(handIndex);
        if (!smoothed) {
            smoothed = {
                ellipse: { ...targetEllipse }
            };
            smoothBuffers.current.set(handIndex, smoothed);
        }

        smoothed.ellipse = smoothEllipse(smoothed.ellipse, targetEllipse, 0.35);

        // Draw multiple bracelets if needed (stacked)
        const spacing = smoothed.ellipse.height * 0.15;

        for (let i = 0; i < bangleCount; i++) {
            const offsetY = i * spacing;
            const ellipseForBracelet: WristEllipse = {
                ...smoothed.ellipse,
                centerY: smoothed.ellipse.centerY + offsetY
            };

            // STEP 3: Alpha-matte with cylindrical warping
            renderBraceletWithOcclusion(ctx, braceletImage, ellipseForBracelet);

            // STEP 1: Basic rendering (disabled)
            // renderBraceletBasic(ctx, braceletImage, ellipseForBracelet);

            // STEP 2: Simple warp (disabled)
            // renderBraceletWithWarp(ctx, braceletImage, ellipseForBracelet);
        }
    }, [braceletImage, smoothEllipse, bangleCount]);

    const onHandsDetected = useCallback((results: Results) => {
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
    }, [braceletImage, drawBracelet2D]);

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

        let camera: Camera | null = null;

        if (webcamRef.current?.video) {
            camera = new Camera(webcamRef.current.video, {
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

        return () => {
            hands.close();
            if (camera) {
                camera.stop();
            }
        };
    }, [cameraReady, braceletImage, onHandsDetected]);

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
