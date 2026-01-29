import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../../api';

interface KYCDocument {
    type: string;
    number: string;
    masked_number: string;
    front_image_url: string;
    back_image_url?: string;
    uploaded_at: string;
    verified: boolean;
}

interface PendingKYC {
    customer_id: string;
    customer_name: string;
    customer_email: string;
    documents: KYCDocument[];
    submitted_at: string;
}

export const AdminKYCVerificationPage: React.FC = () => {
    const navigate = useNavigate();
    const [pendingSubmissions, setPendingSubmissions] = useState<PendingKYC[]>([]);
    const [loading, setLoading] = useState(true);
    const [selectedCustomer, setSelectedCustomer] = useState<PendingKYC | null>(null);
    const [viewingImage, setViewingImage] = useState<string | null>(null);
    const [processing, setProcessing] = useState(false);
    const [notes, setNotes] = useState('');
    const [error, setError] = useState<string | null>(null);
    const [success, setSuccess] = useState<string | null>(null);
    const [statusFilter, setStatusFilter] = useState<'pending' | 'verified' | 'rejected' | 'all'>('pending');

    useEffect(() => {
        fetchPendingSubmissions();
    }, [statusFilter]);

    const fetchPendingSubmissions = async () => {
        try {
            setLoading(true);
            const response = await api.get(`/admin/kyc/pending?status=${statusFilter}`);
            setPendingSubmissions(response.data.submissions || []);
        } catch (error: any) {
            console.error('Error fetching pending KYC:', error);
            setError('Failed to load pending submissions');
        } finally {
            setLoading(false);
        }
    };

    const handleVerify = async (customerId: string, documentIndex: number, action: 'approve' | 'reject') => {
        if (action === 'reject' && !notes.trim()) {
            setError('Please provide a reason for rejection');
            return;
        }

        try {
            setProcessing(true);
            setError(null);

            await api.post(`/admin/kyc/${customerId}/verify`, {
                document_index: documentIndex,
                action: action,
                notes: notes.trim() || undefined,
                rejection_reason: action === 'reject' ? notes.trim() : undefined
            });

            setSuccess(`KYC ${action === 'approve' ? 'approved' : 'rejected'} successfully!`);
            setSelectedCustomer(null);
            setNotes('');

            // Refresh list
            await fetchPendingSubmissions();
        } catch (error: any) {
            console.error('Error verifying KYC:', error);
            setError(error.response?.data?.error || 'Failed to verify KYC');
        } finally {
            setProcessing(false);
        }
    };

    const getDocumentTypeLabel = (type: string) => {
        const labels: Record<string, string> = {
            'aadhar': 'Aadhar Card',
            'pan': 'PAN Card',
            'driving_license': 'Driving License',
            'passport': 'Passport'
        };
        return labels[type] || type;
    };

    if (loading) {
        return (
            <div className="min-h-screen bg-gray-50 flex items-center justify-center">
                <div className="text-center">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-amber-600 mx-auto"></div>
                    <p className="mt-4 text-gray-600">Loading pending KYC submissions...</p>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gray-50 py-8">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                {/* Header */}
                <div className="bg-white rounded-lg shadow-sm p-6 mb-6">
                    <div className="flex items-center justify-between">
                        <div>
                            <h1 className="text-2xl font-bold text-gray-900">KYC Verification</h1>
                            <p className="mt-1 text-sm text-gray-600">
                                Review and verify customer identity documents
                            </p>
                        </div>
                        <button
                            onClick={() => navigate('/admin/dashboard')}
                            className="text-amber-600 hover:text-amber-700 text-sm font-medium"
                        >
                            ← Back to Dashboard
                        </button>
                    </div>
                </div>

                {/* Success/Error Messages */}
                {success && (
                    <div className="bg-green-50 border border-green-200 rounded-lg p-4 mb-6">
                        <p className="text-sm text-green-800">{success}</p>
                    </div>
                )}

                {error && (
                    <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
                        <p className="text-sm text-red-800">{error}</p>
                    </div>
                )}

                {/* Filter Tabs */}
                <div className="bg-white rounded-lg shadow-sm mb-6">
                    <div className="border-b border-gray-200">
                        <nav className="flex -mb-px">
                            {[
                                { value: 'pending', label: 'Pending', color: 'yellow' },
                                { value: 'verified', label: 'Verified', color: 'green' },
                                { value: 'rejected', label: 'Rejected', color: 'red' },
                                { value: 'all', label: 'All', color: 'gray' }
                            ].map((tab) => (
                                <button
                                    key={tab.value}
                                    onClick={() => setStatusFilter(tab.value as any)}
                                    className={`px-6 py-4 text-sm font-medium border-b-2 transition-colors ${statusFilter === tab.value
                                            ? `border-${tab.color}-600 text-${tab.color}-600`
                                            : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                                        }`}
                                >
                                    {tab.label}
                                </button>
                            ))}
                        </nav>
                    </div>
                </div>

                {/* Pending Submissions List */}
                {!selectedCustomer ? (
                    <div className="bg-white rounded-lg shadow-sm overflow-hidden">
                        <div className="px-6 py-4 border-b border-gray-200">
                            <h2 className="text-lg font-semibold text-gray-900">
                                Pending Submissions ({pendingSubmissions.length})
                            </h2>
                        </div>

                        {pendingSubmissions.length === 0 ? (
                            <div className="px-6 py-12 text-center">
                                <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                                </svg>
                                <p className="mt-2 text-sm text-gray-600">No pending KYC submissions</p>
                            </div>
                        ) : (
                            <div className="divide-y divide-gray-200">
                                {pendingSubmissions.map((submission) => (
                                    <div key={submission.customer_id} className="px-6 py-4 hover:bg-gray-50">
                                        <div className="flex items-center justify-between">
                                            <div className="flex-1">
                                                <h3 className="text-sm font-medium text-gray-900">
                                                    {submission.customer_name || 'Unknown'}
                                                </h3>
                                                <p className="mt-1 text-sm text-gray-600">{submission.customer_email}</p>
                                                <div className="mt-2 flex items-center gap-4 text-xs text-gray-500">
                                                    <span>{submission.documents.length} document(s)</span>
                                                    <span>Submitted: {new Date(submission.submitted_at).toLocaleDateString()}</span>
                                                </div>
                                            </div>
                                            <button
                                                onClick={() => setSelectedCustomer(submission)}
                                                className="ml-4 px-4 py-2 bg-amber-600 text-white rounded-lg hover:bg-amber-700 text-sm font-medium transition-colors"
                                            >
                                                Review
                                            </button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                ) : (
                    /* Document Review Panel */
                    <div className="bg-white rounded-lg shadow-sm overflow-hidden">
                        <div className="px-6 py-4 border-b border-gray-200 bg-gray-50">
                            <div className="flex items-center justify-between">
                                <div>
                                    <h2 className="text-lg font-semibold text-gray-900">
                                        {selectedCustomer.customer_name || 'Unknown Customer'}
                                    </h2>
                                    <p className="text-sm text-gray-600">{selectedCustomer.customer_email}</p>
                                </div>
                                <button
                                    onClick={() => {
                                        setSelectedCustomer(null);
                                        setNotes('');
                                        setError(null);
                                    }}
                                    className="text-gray-600 hover:text-gray-700 text-sm font-medium"
                                >
                                    ← Back to List
                                </button>
                            </div>
                        </div>

                        <div className="p-6 space-y-6">
                            {selectedCustomer.documents.map((doc, index) => (
                                <div key={index} className="border border-gray-200 rounded-lg p-6">
                                    <div className="flex items-start justify-between mb-4">
                                        <div>
                                            <h3 className="text-lg font-semibold text-gray-900">
                                                {getDocumentTypeLabel(doc.type)}
                                            </h3>
                                            <p className="mt-1 text-sm text-gray-600">
                                                Document Number: {doc.masked_number}
                                            </p>
                                            <p className="text-xs text-gray-500 mt-1">
                                                Uploaded: {new Date(doc.uploaded_at).toLocaleString()}
                                            </p>
                                        </div>
                                        {doc.verified && (
                                            <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-green-100 text-green-800">
                                                ✓ Verified
                                            </span>
                                        )}
                                    </div>

                                    {/* Document Images */}
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                                        <div>
                                            <p className="text-sm font-medium text-gray-700 mb-2">Front Image</p>
                                            <div
                                                className="border border-gray-300 rounded-lg overflow-hidden cursor-pointer hover:opacity-90 transition-opacity"
                                                onClick={() => setViewingImage(doc.front_image_url)}
                                            >
                                                <img
                                                    src={doc.front_image_url}
                                                    alt="Front"
                                                    className="w-full h-64 object-contain bg-gray-50"
                                                />
                                            </div>
                                            <p className="text-xs text-gray-500 mt-1 text-center">Click to enlarge</p>
                                        </div>

                                        {doc.back_image_url && (
                                            <div>
                                                <p className="text-sm font-medium text-gray-700 mb-2">Back Image</p>
                                                <div
                                                    className="border border-gray-300 rounded-lg overflow-hidden cursor-pointer hover:opacity-90 transition-opacity"
                                                    onClick={() => setViewingImage(doc.back_image_url!)}
                                                >
                                                    <img
                                                        src={doc.back_image_url}
                                                        alt="Back"
                                                        className="w-full h-64 object-contain bg-gray-50"
                                                    />
                                                </div>
                                                <p className="text-xs text-gray-500 mt-1 text-center">Click to enlarge</p>
                                            </div>
                                        )}
                                    </div>

                                    {!doc.verified && (
                                        <>
                                            {/* Verification Notes */}
                                            <div className="mb-4">
                                                <label className="block text-sm font-medium text-gray-700 mb-2">
                                                    Verification Notes (optional for approval, required for rejection)
                                                </label>
                                                <textarea
                                                    value={notes}
                                                    onChange={(e) => setNotes(e.target.value)}
                                                    placeholder="Add notes about this verification..."
                                                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-amber-500"
                                                    rows={3}
                                                />
                                            </div>

                                            {/* Action Buttons */}
                                            <div className="flex gap-3">
                                                <button
                                                    onClick={() => handleVerify(selectedCustomer.customer_id, index, 'approve')}
                                                    disabled={processing}
                                                    className="flex-1 px-6 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed font-medium transition-colors"
                                                >
                                                    {processing ? 'Processing...' : '✓ Approve KYC'}
                                                </button>
                                                <button
                                                    onClick={() => handleVerify(selectedCustomer.customer_id, index, 'reject')}
                                                    disabled={processing}
                                                    className="flex-1 px-6 py-3 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed font-medium transition-colors"
                                                >
                                                    {processing ? 'Processing...' : '✗ Reject KYC'}
                                                </button>
                                            </div>
                                        </>
                                    )}
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {/* Image Viewer Modal */}
                {viewingImage && (
                    <div
                        className="fixed inset-0 bg-black bg-opacity-90 flex items-center justify-center z-50 p-4"
                        onClick={() => setViewingImage(null)}
                    >
                        <div className="relative max-w-6xl max-h-full">
                            <button
                                onClick={() => setViewingImage(null)}
                                className="absolute top-4 right-4 bg-white rounded-full p-2 shadow-lg hover:bg-gray-100"
                            >
                                <svg className="w-6 h-6 text-gray-700" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                </svg>
                            </button>
                            <img
                                src={viewingImage}
                                alt="Document"
                                className="max-w-full max-h-screen object-contain"
                            />
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default AdminKYCVerificationPage;
