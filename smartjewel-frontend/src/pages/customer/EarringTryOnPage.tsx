import { useParams, useNavigate } from 'react-router-dom';
import { EarringTryOn } from '../../components/EarringTryOn';
import { ArrowLeft, Camera, Share2 } from 'lucide-react';
import { useRef } from 'react';

export function EarringTryOnPage() {
    const { productId } = useParams<{ productId: string }>();
    const navigate = useNavigate();
    const canvasRef = useRef<HTMLCanvasElement>(null);

    const handleScreenshot = () => {
        const canvas = document.querySelector('canvas');
        if (canvas) {
            const link = document.createElement('a');
            link.download = `earring-tryon-${Date.now()}.png`;
            link.href = canvas.toDataURL();
            link.click();
        }
    };

    const handleShare = async () => {
        const canvas = document.querySelector('canvas');
        if (canvas) {
            canvas.toBlob(async (blob) => {
                if (blob) {
                    const file = new File([blob], 'earring-tryon.png', { type: 'image/png' });

                    if (navigator.share && navigator.canShare({ files: [file] })) {
                        try {
                            await navigator.share({
                                title: 'My Virtual Try-On',
                                text: 'Check out how these earrings look on me!',
                                files: [file]
                            });
                        } catch (err) {
                            console.error('Share failed:', err);
                        }
                    } else {
                        // Fallback: download
                        handleScreenshot();
                    }
                }
            });
        }
    };

    if (!productId) {
        return (
            <div className="min-h-screen bg-gray-50 flex items-center justify-center">
                <div className="text-center">
                    <p className="text-red-500 font-semibold">Product ID not found</p>
                    <button
                        onClick={() => navigate('/products')}
                        className="mt-4 px-6 py-2 bg-amber-600 text-white rounded-lg hover:bg-amber-700"
                    >
                        Back to Products
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gray-50 py-8">
            <div className="max-w-6xl mx-auto px-4">
                {/* Header */}
                <div className="flex items-center justify-between mb-6">
                    <button
                        onClick={() => navigate(-1)}
                        className="flex items-center gap-2 text-gray-700 hover:text-gray-900"
                    >
                        <ArrowLeft className="w-5 h-5" />
                        <span>Back</span>
                    </button>

                    <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
                        <Camera className="w-6 h-6 text-amber-600" />
                        Virtual Try-On - Earrings
                    </h1>

                    <div className="w-20"></div> {/* Spacer for centering */}
                </div>

                {/* Instructions Card */}
                <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 mb-6">
                    <h3 className="font-semibold text-amber-900 mb-2 flex items-center gap-2">
                        👋 How to use Virtual Try-On
                    </h3>
                    <ul className="text-sm text-amber-800 space-y-1">
                        <li>• Allow camera access when prompted</li>
                        <li>• Make sure your face is well-lit and both ears are visible</li>
                        <li>• The earrings will appear on your ears automatically</li>
                        <li>• Turn your head to see from different angles</li>
                        <li>• Click "Save Screenshot" to capture the moment</li>
                    </ul>
                </div>

                {/* Try-On Component */}
                <div className="bg-white rounded-xl shadow-lg p-6 mb-6">
                    <EarringTryOn productId={productId} />
                </div>

                {/* Action Buttons */}
                <div className="flex justify-center gap-4">
                    <button
                        onClick={handleScreenshot}
                        className="px-8 py-3 bg-amber-600 text-white rounded-lg hover:bg-amber-700 transition flex items-center gap-2 font-medium"
                    >
                        <Camera className="w-5 h-5" />
                        Save Screenshot
                    </button>

                    <button
                        onClick={handleShare}
                        className="px-8 py-3 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition flex items-center gap-2 font-medium"
                    >
                        <Share2 className="w-5 h-5" />
                        Share
                    </button>
                </div>

                {/* Tips Section */}
                <div className="mt-8 bg-blue-50 border border-blue-200 rounded-lg p-4">
                    <h3 className="font-semibold text-blue-900 mb-2">💡 Tips for best results</h3>
                    <ul className="text-sm text-blue-800 space-y-1">
                        <li>• Ensure good lighting from the front (avoid backlighting)</li>
                        <li>• Keep your face steady for clearer tracking</li>
                        <li>• Move hair behind ears if necessary</li>
                        <li>• Try different angles to see how the earrings look from the side</li>
                    </ul>
                </div>
            </div>
        </div>
    );
}
