import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../../api';
import { ImageUploader } from '../../components/ImageUploader';

interface KYCDocument {
    type: string;
    masked_number: string;
    uploaded_at: string;
    verified: boolean;
    has_back_image: boolean;
}

interface KYCStatus {
    status: 'not_submitted' | 'pending' | 'verified' | 'rejected';
    verified_at: string | null;
    rejection_reason: string | null;
    documents: KYCDocument[];
    can_rent: boolean;
    last_updated: string | null;
}

const DOCUMENT_TYPES = [
    { value: 'aadhar', label: 'Aadhar Card', format: 'XXXX-XXXX-XXXX (12 digits)', needsBack: true },
    { value: 'pan', label: 'PAN Card', format: 'ABCDE1234F (10 characters)', needsBack: false },
    { value: 'driving_license', label: 'Driving License', format: 'Alphanumeric', needsBack: true },
    { value: 'passport', label: 'Passport', format: 'A1234567 (1 letter + 7 digits)', needsBack: false },
];

export const KYCVerificationPage: React.FC = () => {
    const navigate = useNavigate();
    const [kycStatus, setKycStatus] = useState<KYCStatus | null>(null);
    const [loading, setLoading] = useState(true);
    const [uploading, setUploading] = useState(false);

    // Upload form state
    const [showUploadForm, setShowUploadForm] = useState(false);
    const [documentType, setDocumentType] = useState('aadhar');
    const [documentNumber, setDocumentNumber] = useState('');
    const [frontImage, setFrontImage] = useState<File | null>(null);
    const [backImage, setBackImage] = useState<File | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [success, setSuccess] = useState<string | null>(null);

    useEffect(() => {
        fetchKYCStatus();
    }, []);

    const fetchKYCStatus = async () => {
        try {
            setLoading(true);
            const response = await api.get('/customers/me/kyc');
            setKycStatus(response.data);
        } catch (error: any) {
            console.error('Error fetching KYC status:', error);
            // If no KYC exists yet, show upload form
            setShowUploadForm(true);
        } finally {
            setLoading(false);
        }
    };

    const handleUpload = async (e: React.FormEvent) => {
        e.preventDefault();
        setError(null);
        setSuccess(null);

        // Validation
        if (!documentType || !documentNumber) {
            setError('Please select document type and enter document number');
            return;
        }

        if (!frontImage) {
            setError('Please upload front image of your document');
            return;
        }

        const selectedDocType = DOCUMENT_TYPES.find(d => d.value === documentType);
        if (selectedDocType?.needsBack && !backImage) {
            setError('Please upload back image of your document');
            return;
        }

        try {
            setUploading(true);

            const formData = new FormData();
            formData.append('document_type', documentType);
            formData.append('document_number', documentNumber);
            formData.append('front_image', frontImage);
            if (backImage) {
                formData.append('back_image', backImage);
            }

            await api.post('/customers/me/kyc/upload', formData, {
                headers: {
                    'Content-Type': 'multipart/form-data',
                },
            });

            setSuccess('KYC document uploaded successfully! Your documents are under review.');
            setShowUploadForm(false);
            setDocumentNumber('');
            setFrontImage(null);
            setBackImage(null);

            // Refresh KYC status
            fetchKYCStatus();
        } catch (error: any) {
            console.error('Error uploading KYC:', error);
            setError(error.response?.data?.error || 'Failed to upload KYC document');
        } finally {
            setUploading(false);
        }
    };

    const getStatusBadge = (status: string) => {
        const badges = {
            not_submitted: { bg: 'bg-gray-100', text: 'text-gray-800', label: 'Not Submitted' },
            pending: { bg: 'bg-yellow-100', text: 'text-yellow-800', label: 'Under Review' },
            verified: { bg: 'bg-green-100', text: 'text-green-800', label: 'Verified ✓' },
            rejected: { bg: 'bg-red-100', text: 'text-red-800', label: 'Rejected' },
        };
        const badge = badges[status as keyof typeof badges] || badges.not_submitted;

        return (
            <span className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${badge.bg} ${badge.text}`}>
                {badge.label}
            </span>
        );
    };

    if (loading) {
        return (
            <div className="min-h-screen bg-gray-50 flex items-center justify-center">
                <div className="text-center">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-amber-600 mx-auto"></div>
                    <p className="mt-4 text-gray-600">Loading KYC status...</p>
                </div>
            </div>
        );
    }

    const selectedDocType = DOCUMENT_TYPES.find(d => d.value === documentType);

    return (
        <div className="min-h-screen bg-gray-50 py-8">
            <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
                {/* Header */}
                <div className="bg-white rounded-lg shadow-sm p-6 mb-6">
                    <div className="flex items-center justify-between">
                        <div>
                            <h1 className="text-2xl font-bold text-gray-900">KYC Verification</h1>
                            <p className="mt-1 text-sm text-gray-600">
                                Verify your identity to rent jewelry items
                            </p>
                        </div>
                        <button
                            onClick={() => navigate('/profile')}
                            className="text-amber-600 hover:text-amber-700 text-sm font-medium"
                        >
                            ← Back to Profile
                        </button>
                    </div>

                    {kycStatus && (
                        <div className="mt-6">
                            {kycStatus.status === 'verified' ? (
                                <div className="bg-gradient-to-r from-green-50 to-emerald-50 border-2 border-green-500 rounded-lg p-6">
                                    <div className="flex items-center gap-4">
                                        <div className="flex-shrink-0">
                                            <svg className="w-12 h-12 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                                            </svg>
                                        </div>
                                        <div className="flex-1">
                                            <h3 className="text-lg font-bold text-green-900">KYC Verified ✓</h3>
                                            <p className="mt-1 text-sm text-green-700">
                                                Your identity has been verified. You can now rent jewelry items!
                                            </p>
                                            {kycStatus.verified_at && (
                                                <p className="mt-2 text-xs text-green-600">
                                                    Verified on {new Date(kycStatus.verified_at).toLocaleDateString()}
                                                </p>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            ) : (
                                <div className="flex items-center gap-4">
                                    <span className="text-sm text-gray-600">Status:</span>
                                    {getStatusBadge(kycStatus.status)}
                                    {kycStatus.can_rent && (
                                        <span className="text-sm text-green-600 font-medium">You can now rent jewelry!</span>
                                    )}
                                </div>
                            )}
                        </div>
                    )}
                </div>

                {/* Success Message */}
                {success && (
                    <div className="bg-green-50 border border-green-200 rounded-lg p-4 mb-6">
                        <div className="flex">
                            <div className="flex-shrink-0">
                                <svg className="h-5 w-5 text-green-400" viewBox="0 0 20 20" fill="currentColor">
                                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                                </svg>
                            </div>
                            <div className="ml-3">
                                <p className="text-sm text-green-800">{success}</p>
                            </div>
                        </div>
                    </div>
                )}

                {/* Rejection Message */}
                {kycStatus?.status === 'rejected' && kycStatus.rejection_reason && (
                    <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
                        <div className="flex">
                            <div className="flex-shrink-0">
                                <svg className="h-5 w-5 text-red-400" viewBox="0 0 20 20" fill="currentColor">
                                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                                </svg>
                            </div>
                            <div className="ml-3">
                                <h3 className="text-sm font-medium text-red-800">KYC Rejected</h3>
                                <p className="mt-1 text-sm text-red-700">{kycStatus.rejection_reason}</p>
                                <p className="mt-2 text-sm text-red-700">Please upload new documents.</p>
                            </div>
                        </div>
                    </div>
                )}

                {/* Existing Documents */}
                {kycStatus && kycStatus.documents.length > 0 && (
                    <div className="bg-white rounded-lg shadow-sm p-6 mb-6">
                        <h2 className="text-lg font-semibold text-gray-900 mb-4">Submitted Documents</h2>
                        <div className="space-y-4">
                            {kycStatus.documents.map((doc, index) => (
                                <div key={index} className="border border-gray-200 rounded-lg p-4">
                                    <div className="flex items-center justify-between">
                                        <div>
                                            <p className="font-medium text-gray-900">
                                                {DOCUMENT_TYPES.find(d => d.value === doc.type)?.label || doc.type}
                                            </p>
                                            <p className="text-sm text-gray-600 mt-1">Number: {doc.masked_number}</p>
                                            <p className="text-xs text-gray-500 mt-1">
                                                Uploaded: {new Date(doc.uploaded_at).toLocaleDateString()}
                                            </p>
                                        </div>
                                        <div className="text-right">
                                            {doc.verified ? (
                                                <span className="text-green-600 font-medium">✓ Verified</span>
                                            ) : (
                                                <span className="text-yellow-600 font-medium">⏳ Pending</span>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {/* Upload Form */}
                {(showUploadForm || kycStatus?.status === 'rejected' || kycStatus?.status === 'not_submitted') && (
                    <div className="bg-white rounded-lg shadow-sm p-6">
                        <h2 className="text-lg font-semibold text-gray-900 mb-4">
                            {kycStatus?.status === 'rejected' ? 'Upload New Documents' : 'Upload KYC Documents'}
                        </h2>

                        {error && (
                            <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-4">
                                <p className="text-sm text-red-800">{error}</p>
                            </div>
                        )}

                        <form onSubmit={handleUpload} className="space-y-6">
                            {/* Document Type */}
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-2">
                                    Document Type *
                                </label>
                                <select
                                    value={documentType}
                                    onChange={(e) => setDocumentType(e.target.value)}
                                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-amber-500"
                                    required
                                >
                                    {DOCUMENT_TYPES.map(type => (
                                        <option key={type.value} value={type.value}>
                                            {type.label} ({type.format})
                                        </option>
                                    ))}
                                </select>
                            </div>

                            {/* Document Number */}
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-2">
                                    Document Number *
                                </label>
                                <input
                                    type="text"
                                    value={documentNumber}
                                    onChange={(e) => setDocumentNumber(e.target.value)}
                                    placeholder={selectedDocType?.format}
                                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-amber-500"
                                    required
                                />
                                <p className="mt-1 text-xs text-gray-500">
                                    Enter your {selectedDocType?.label} number
                                </p>
                            </div>

                            {/* Front Image */}
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-2">
                                    Front Image *
                                </label>
                                <ImageUploader
                                    onImageSelect={(file: File) => setFrontImage(file)}
                                    maxSizeMB={5}
                                    acceptedFormats={['image/jpeg', 'image/png', 'image/jpg']}
                                />
                                {frontImage && (
                                    <p className="mt-2 text-sm text-green-600">✓ {frontImage.name} selected</p>
                                )}
                            </div>

                            {/* Back Image (conditional) */}
                            {selectedDocType?.needsBack && (
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-2">
                                        Back Image *
                                    </label>
                                    <ImageUploader
                                        onImageSelect={(file: File) => setBackImage(file)}
                                        maxSizeMB={5}
                                        acceptedFormats={['image/jpeg', 'image/png', 'image/jpg']}
                                    />
                                    {backImage && (
                                        <p className="mt-2 text-sm text-green-600">✓ {backImage.name} selected</p>
                                    )}
                                </div>
                            )}

                            {/* Submit Button */}
                            <div className="flex gap-4">
                                <button
                                    type="submit"
                                    disabled={uploading}
                                    className="flex-1 bg-amber-600 text-white px-6 py-3 rounded-lg font-medium hover:bg-amber-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                                >
                                    {uploading ? (
                                        <span className="flex items-center justify-center">
                                            <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                            </svg>
                                            Uploading...
                                        </span>
                                    ) : (
                                        'Submit for Verification'
                                    )}
                                </button>
                                {showUploadForm && kycStatus && (
                                    <button
                                        type="button"
                                        onClick={() => setShowUploadForm(false)}
                                        className="px-6 py-3 border border-gray-300 rounded-lg font-medium text-gray-700 hover:bg-gray-50 transition-colors"
                                    >
                                        Cancel
                                    </button>
                                )}
                            </div>
                        </form>
                    </div>
                )}

                {/* Info Box */}
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mt-6">
                    <h3 className="text-sm font-medium text-blue-900 mb-2">Why KYC Verification?</h3>
                    <ul className="text-sm text-blue-800 space-y-1">
                        <li>• Required to rent high-value jewelry items</li>
                        <li>• Verification typically completed within 24 hours</li>
                        <li>• Your documents are securely stored and encrypted</li>
                        <li>• One-time verification - valid for lifetime</li>
                    </ul>
                </div>
            </div>
        </div>
    );
};
