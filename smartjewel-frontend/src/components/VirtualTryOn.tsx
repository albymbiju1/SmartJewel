import { useRef, useEffect, useState } from 'react';
import Webcam from 'react-webcam';
import { Hands, Results } from '@mediapipe/hands';
import { Camera } from '@mediapipe/camera_utils';

interface VirtualTryOnProps {
    productId: string;
    productImageUrl?: string;
}

export function VirtualTryOn({ productId, productImageUrl }: VirtualTryOnProps) {
    const webcamRef = useRef<Webcam>(null);
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [ringImage, setRingImage] = useState<HTMLImageElement | null>(null);
    const [cameraReady, setCameraReady] = useState(false);

    // Load transparent ring image
    useEffect(() => {
        const img = new Image();
        img.crossOrigin = 'anonymous';

        // Use transparent endpoint or fallback to original
        const imageUrl = `/api/product/${productId}/transparent`;

        img.onload = () => {
            setRingImage(img);
            setIsLoading(false);
        };

        img.onerror = () => {
            setError('Failed to load product image');
            setIsLoading(false);
        };

        img.src = imageUrl;
    }, [productId]);

    // Initialize MediaPipe Hands
    useEffect(() => {
        if (!cameraReady || !ringImage) return;

        const hands = new Hands({
            locateFile: (file) => {
                return `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${file}`;
            },
        });

        hands.setOptions({
            maxNumHands: 2,
            modelComplexity: 1,
            minDetectionConfidence: 0.5,
            minTrackingConfidence: 0.5,
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

        return () => {
            hands.close();
        };
    }, [cameraReady, ringImage]);

    function onHandsDetected(results: Results) {
        const canvas = canvasRef.current;
        const videoElement = webcamRef.current?.video;

        if (!canvas || !videoElement || !ringImage) return;

        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        // Set canvas dimensions to match video
        canvas.width = videoElement.videoWidth;
        canvas.height = videoElement.videoHeight;

        // Draw video frame (mirrored)
        ctx.save();
        ctx.scale(-1, 1);
        ctx.translate(-canvas.width, 0);
        ctx.drawImage(videoElement, 0, 0, canvas.width, canvas.height);
        ctx.restore();

        // Draw rings on detected hands
        if (results.multiHandLandmarks) {
            for (const landmarks of results.multiHandLandmarks) {
                // Ring finger landmarks
                const ringFingerBase = landmarks[13];  // MCP joint (base knuckle)
                const ringFingerMid = landmarks[14];   // PIP joint (first knuckle)
                // Landmark 14 = PIP joint (first knuckle on finger) - BETTER for ring position
                // Landmark 15 = DIP joint (second knuckle)
                const ringPosition = landmarks[14];    // Use first knuckle for ring placement
                const fingerTip = landmarks[16];        // Fingertip for orientation

                // Position on mirrored canvas
                const x = (1 - ringPosition.x) * canvas.width;
                const y = ringPosition.y * canvas.height;
                // Calculate finger width for sizing (distance between knuckles)
                const fingerWidth = Math.sqrt(
                    Math.pow((landmarks[13].x - landmarks[14].x) * canvas.width, 2) +
                    Math.pow((landmarks[13].y - landmarks[14].y) * canvas.height, 2)
                );

                // Ring size - optimized for realistic fit on finger
                const ringSize = fingerWidth * 1.2;

                // Rotation angle - align with finger direction
                const angle = Math.atan2(
                    fingerTip.y - ringPosition.y,
                    fingerTip.x - ringPosition.x
                );

                // Draw the ring
                ctx.save();
                ctx.translate(x, y);
                ctx.rotate(-angle);
                ctx.drawImage(
                    ringImage,
                    -ringSize / 2,
                    -ringSize / 2,
                    ringSize,
                    ringSize
                );
                ctx.restore();
            }
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
                {/* Webcam (hidden, used for processing) */}
                <Webcam
                    ref={webcamRef}
                    audio={false}
                    mirrored={true}
                    className="absolute inset-0 w-full h-full object-cover opacity-0"
                    onUserMedia={() => setCameraReady(true)}
                    onUserMediaError={(err) => setError('Camera access denied. Please allow camera permissions.')}
                />

                {/* Canvas (displays result) */}
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
                <p>Position your hand in front of the camera to see the ring</p>
                <p className="mt-1">Try moving your hand closer or further for the best fit</p>
            </div>
        </div>
    );
}
