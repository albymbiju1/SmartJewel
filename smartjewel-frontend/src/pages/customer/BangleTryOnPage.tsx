import { useParams, useNavigate } from 'react-router-dom';
import { BangleTryOn } from '../../components/BangleTryOn';
import { ArrowLeft, Camera, Share2 } from 'lucide-react';
import { useState, useEffect } from 'react';

export function BangleTryOnPage() {
    const { productId } = useParams<{ productId: string }>();
    const navigate = useNavigate();
    const [bangleCount, setBangleCount] = useState(1);
    const [category, setCategory] = useState<string>('');

    const handleScreenshot = () => {
        const canvas = document.querySelector('canvas');
        if (canvas) {
            const link = document.createElement('a');
            link.download = `bracelet-tryon-${Date.now()}.png`;
            link.href = canvas.toDataURL();
            link.click();
        }
    };

    const handleShare = async () => {
        const canvas = document.querySelector('canvas');
        if (canvas) {
            canvas.toBlob(async (blob) => {
                if (blob) {
                    const file = new File([blob], 'bracelet-tryon.png', { type: 'image/png' });

                    if (navigator.share && navigator.canShare({ files: [file] })) {
                        try {
                            await navigator.share({
                                title: 'My Virtual Try-On',
                                text: 'Check out how this bracelet looks on me!',
                                files: [file]
                            });
                        } catch (err) {
                            console.error('Share failed:', err);
                        }
                    } else {
                        handleScreenshot();
                    }
                }
            });
        }
    };

    // Fetch product to get category
    useEffect(() => {
        if (productId) {
            fetch(`/inventory/items/${productId}`)
                .then(res => res.json())
                .then(data => setCategory(data.category || ''))
                .catch(err => console.error('Failed to fetch product category:', err));
        }
    }, [productId]);

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
                        Virtual Try-On - Bangle
                    </h1>

                    <div className="w-20"></div>
                </div>

                {/* Instructions Card */}
                <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 mb-6">
                    <h3 className="font-semibold text-amber-900 mb-2 flex items-center gap-2">
                        👋 How to use Virtual Try-On
                    </h3>
                    <ul className="text-sm text-amber-800 space-y-1">
                        <li>• Allow camera access when prompted</li>
                        <li>• Show your hand with palm facing camera</li>
                        <li>• The bracelet will appear on your wrist automatically</li>
                        <li>• Move your hand to see from different angles</li>
                        <li>• Click "Save Screenshot" to capture the moment</li>
                    </ul>
                </div>

                {/* Bangle Count Selector (for stacking) */}
                <div className="bg-white rounded-lg shadow p-4 mb-6">
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                        Number of Bangles (for stacking)
                    </label>
                    <div className="flex gap-2">
                        {[1, 2, 3, 4, 5].map((count) => (
                            <button
                                key={count}
                                onClick={() => setBangleCount(count)}
                                className={`px-4 py-2 rounded-lg font-medium transition ${bangleCount === count
                                    ? 'bg-amber-600 text-white'
                                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                                    }`}
                            >
                                {count}
                            </button>
                        ))}
                    </div>
                    <p className="text-xs text-gray-500 mt-2">
                        Select how many bangles you want to see stacked on your wrist
                    </p>
                </div>

                {/* Try-On Component */}
                <div className="bg-white rounded-xl shadow-lg p-6 mb-6">
                    <BangleTryOn productId={productId} bangleCount={bangleCount} category={category} />
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
                        <li>• Keep your hand steady for better tracking</li>
                        <li>• Ensure good lighting for accurate placement</li>
                        <li>• Try different hand positions to see the bracelet from all angles</li>
                        <li>• Stack multiple bangles to see how they look together</li>
                    </ul>
                </div>
            </div>
        </div>
    );
}
