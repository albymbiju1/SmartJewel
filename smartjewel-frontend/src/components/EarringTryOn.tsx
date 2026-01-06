import { useRef, useEffect, useState } from 'react';
import Webcam from 'react-webcam';
import { FaceMesh, Results } from '@mediapipe/face_mesh';
import { Camera } from '@mediapipe/camera_utils';

interface EarringTryOnProps {
    productId: string;
    productImageUrl?: string;
}

// Ear landmark indices for MediaPipe Face Mesh
const EAR_LANDMARKS = {
    left: {
        top: 127,
        bottom: 234,
        middle: 162
    },
    right: {
        top: 356,
        bottom: 454,
        middle: 389
    }
};

export function EarringTryOn({ productId }: EarringTryOnProps) {
    const webcamRef = useRef<Webcam>(null);
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [earringImage, setEarringImage] = useState<HTMLImageElement | null>(null);
    const [cameraReady, setCameraReady] = useState(false);

    // Load transparent earring image
    useEffect(() => {
        const img = new Image();
        img.crossOrigin = 'anonymous';

        const imageUrl = `/api/product/${productId}/transparent`;

        img.onload = () => {
            setEarringImage(img);
            setIsLoading(false);
        };

        img.onerror = () => {
            setError('Failed to load earring image');
            setIsLoading(false);
        };

        img.src = imageUrl;
    }, [productId]);

    // Initialize MediaPipe Face Mesh
    useEffect(() => {
        if (!cameraReady || !earringImage) return;

        const faceMesh = new FaceMesh({
            locateFile: (file) => {
                return `https://cdn.jsdelivr.net/npm/@mediapipe/face_mesh/${file}`;
            },
        });

        faceMesh.setOptions({
            maxNumFaces: 1,
            refineLandmarks: true,
            minDetectionConfidence: 0.5,
            minTrackingConfidence: 0.5,
        });

        faceMesh.onResults(onFaceDetected);

        if (webcamRef.current?.video) {
            const camera = new Camera(webcamRef.current.video, {
                onFrame: async () => {
                    if (webcamRef.current?.video) {
                        await faceMesh.send({ image: webcamRef.current.video });
                    }
                },
                width: 1280,
                height: 720,
            });
            camera.start();
        }

        return () => {
            faceMesh.close();
        };
    }, [cameraReady, earringImage]);

    function onFaceDetected(results: Results) {
        const canvas = canvasRef.current;
        const videoElement = webcamRef.current?.video;

        if (!canvas || !videoElement || !earringImage) return;

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

        // Draw earrings on detected face
        if (results.multiFaceLandmarks && results.multiFaceLandmarks.length > 0) {
            const landmarks = results.multiFaceLandmarks[0];

            // Draw left earring
            drawEarring(ctx, landmarks, 'left');

            // Draw right earring
            drawEarring(ctx, landmarks, 'right');
        }
    }

    function drawEarring(
        ctx: CanvasRenderingContext2D,
        landmarks: any[],
        side: 'left' | 'right'
    ) {
        if (!earringImage) return;

        const earLandmarks = EAR_LANDMARKS[side];

        // Get ear position (use bottom of ear for earring placement)
        const earBottom = landmarks[earLandmarks.bottom];
        const earTop = landmarks[earLandmarks.top];

        // Calculate position on mirrored canvas
        const x = (1 - earBottom.x) * canvasRef.current!.width;
        const y = earBottom.y * canvasRef.current!.height;

        // Calculate ear height for sizing
        const earHeight = Math.abs(
            (earTop.y - earBottom.y) * canvasRef.current!.height
        );

        // Earring size - increased for better visibility
        const earringSize = earHeight * 1.2;

        // Draw the earring hanging from earlobe
        ctx.save();
        ctx.translate(x, y);

        // Draw earring image - offset to hang properly from lobe
        ctx.drawImage(
            earringImage,
            -earringSize / 2,
            earringSize * 0.35, // Fine-tuned offset for optimal hanging position
            earringSize,
            earringSize
        );
        ctx.restore();
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
                <p>Position your face in front of the camera to see the earrings</p>
                <p className="mt-1">Make sure your ears are visible for best results</p>
            </div>
        </div>
    );
}
