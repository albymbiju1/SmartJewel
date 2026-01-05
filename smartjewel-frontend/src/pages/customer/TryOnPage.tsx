import { useParams, useNavigate } from 'react-router-dom';
import { VirtualTryOn } from '../../components/VirtualTryOn';
import { ArrowLeft, Camera, Share2, Download } from 'lucide-react';
import { useRef } from 'react';

export function TryOnPage() {
    const { productId } = useParams<{ productId: string }>();
    const navigate = useNavigate();
    const canvasRef = useRef<HTMLCanvasElement>(null);

    if (!productId) {
        return (
            <div className="min-h-screen bg-gray-50 flex items-center justify-center">
                <div className="text-center">
                    <p className="text-red-500 text-lg">Product ID not found</p>
                    <button
                        onClick={() => navigate('/catalog')}
                        className="mt-4 px-4 py-2 bg-amber-600 text-white rounded-lg hover:bg-amber-700"
                    >
                        Go to Catalog
                    </button>
                </div>
            </div>
        );
    }

    const handleScreenshot = () => {
        const canvas = canvasRef.current;
        if (canvas) {
            canvas.toBlob((blob) => {
                if (blob) {
                    const url = URL.createObjectURL(blob);
                    const a = document.createElement('a');
                    a.href = url;
                    a.download = `tryon-${productId}-${Date.now()}.png`;
                    a.click();
                }
            });
        }
    };

    return (
        <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100">
            {/* Header */}
            <div className="bg-white shadow-sm border-b">
                <div className="max-w-7xl mx-auto px-4 py-4 sm:px-6 lg:px-8">
                    <div className="flex items-center justify-between">
                        <button
                            onClick={() => navigate(-1)}
                            className="flex items-center gap-2 text-gray-600 hover:text-gray-900 transition-colors"
                        >
                            <ArrowLeft className="w-5 h-5" />
                            <span className="font-medium">Back</span>
                        </button>

                        <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
                            <Camera className="w-6 h-6 text-amber-600" />
                            Virtual Try-On
                        </h1>

                        <div className="w-20" /> {/* Spacer for centering */}
                    </div>
                </div>
            </div>

            {/* Main Content */}
            <div className="max-w-7xl mx-auto px-4 py-8 sm:px-6 lg:px-8">
                <div className="bg-white rounded-xl shadow-lg p-6">
                    {/* Instructions */}
                    <div className="mb-6 bg-amber-50 border border-amber-200 rounded-lg p-4">
                        <h2 className="font-semibold text-amber-900 mb-2 flex items-center gap-2">
                            <span className="text-2xl">✋</span>
                            How to use Virtual Try-On
                        </h2>
                        <ul className="text-sm text-amber-800 space-y-1 ml-8">
                            <li>• Allow camera access when prompted</li>
                            <li>• Show your hand to the camera with fingers spread</li>
                            <li>• The ring will appear on your ring finger automatically</li>
                            <li>• Move your hand to see it from different angles</li>
                        </ul>
                    </div>

                    {/* Virtual Try-On Component */}
                    <VirtualTryOn productId={productId} />

                    {/* Action Buttons */}
                    <div className="mt-6 flex flex-wrap gap-4 justify-center">
                        <button
                            onClick={handleScreenshot}
                            className="flex items-center gap-2 px-6 py-3 bg-amber-600 text-white rounded-lg hover:bg-amber-700 transition-colors font-medium"
                        >
                            <Download className="w-5 h-5" />
                            Save Screenshot
                        </button>

                        <button
                            className="flex items-center gap-2 px-6 py-3 bg-white text-gray-700 border-2 border-gray-300 rounded-lg hover:bg-gray-50 transition-colors font-medium"
                        >
                            <Share2 className="w-5 h-5" />
                            Share
                        </button>
                    </div>
                </div>

                {/* Tips Card */}
                <div className="mt-6 bg-blue-50 border border-blue-200 rounded-lg p-4">
                    <h3 className="font-semibold text-blue-900 mb-2">💡 Pro Tips</h3>
                    <ul className="text-sm text-blue-800 space-y-1">
                        <li>• Use good lighting for best results</li>
                        <li>• Keep your hand steady and fingers slightly apart</li>
                        <li>• Try different hand orientations to see all angles</li>
                        <li>• If the ring doesn't appear, try showing your full hand to the camera</li>
                    </ul>
                </div>
            </div>
        </div>
    );
}
