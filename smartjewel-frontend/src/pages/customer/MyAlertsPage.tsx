import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Bell, Trash2, TrendingDown, Package, Tag } from 'lucide-react';
import alertService, { AlertItem } from '../../services/alertService';
import { API_BASE_URL } from '../../api';

const toAbsoluteImage = (img?: string) => {
    if (!img) return undefined;
    if (img.startsWith('http://') || img.startsWith('https://')) return img;
    return `${API_BASE_URL}${img.startsWith('/') ? img : '/' + img}`;
};

const AlertTypeBadge: React.FC<{ type: AlertItem['alert_type'] }> = ({ type }) => {
    if (type === 'price_drop')
        return (
            <span className="inline-flex items-center gap-1 text-xs font-medium bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full">
                <TrendingDown className="w-3 h-3" /> Price Drop
            </span>
        );
    if (type === 'back_in_stock')
        return (
            <span className="inline-flex items-center gap-1 text-xs font-medium bg-green-100 text-green-700 px-2 py-0.5 rounded-full">
                <Package className="w-3 h-3" /> Back in Stock
            </span>
        );
    return (
        <span className="inline-flex items-center gap-1 text-xs font-medium bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full">
            <Tag className="w-3 h-3" /> Gold Rate
        </span>
    );
};

const MyAlertsPage: React.FC = () => {
    const navigate = useNavigate();
    const [alerts, setAlerts] = useState<AlertItem[]>([]);
    const [loading, setLoading] = useState(true);
    const [deletingId, setDeletingId] = useState<string | null>(null);
    const [showAll, setShowAll] = useState(false);

    const load = async (all = showAll) => {
        setLoading(true);
        const data = await alertService.getMyAlerts(!all);
        setAlerts(data);
        setLoading(false);
    };

    useEffect(() => {
        load();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const handleDelete = async (id: string) => {
        setDeletingId(id);
        const ok = await alertService.deleteAlert(id);
        if (ok) setAlerts(prev => prev.filter(a => a._id !== id));
        setDeletingId(null);
    };

    const toggleShowAll = () => {
        const next = !showAll;
        setShowAll(next);
        load(next);
    };

    return (
        <div className="min-h-screen bg-gray-50">
            {/* Breadcrumb */}
            <div className="bg-white border-b">
                <div className="container mx-auto px-6 py-3 text-sm text-gray-600 flex items-center gap-2">
                    <button onClick={() => navigate('/')} className="hover:text-blue-600">Home</button>
                    <span>/</span>
                    <span className="text-gray-900">My Price Alerts</span>
                </div>
            </div>

            {/* Header */}
            <div className="bg-gradient-to-r from-amber-50 to-orange-50 py-10">
                <div className="container mx-auto px-6 text-center">
                    <div className="inline-flex items-center justify-center w-14 h-14 rounded-full bg-amber-100 text-amber-600 mb-4">
                        <Bell className="w-7 h-7" />
                    </div>
                    <h1 className="text-3xl md:text-4xl font-bold text-gray-900 mb-2">My Price Alerts</h1>
                    <p className="text-gray-600">We'll notify you when prices drop on your watched items</p>
                </div>
            </div>

            <div className="container mx-auto px-6 py-8 max-w-3xl">
                {/* Toggle active/all */}
                <div className="flex items-center justify-between mb-6">
                    <p className="text-sm text-gray-500">
                        {loading ? 'Loading…' : `${alerts.length} alert${alerts.length !== 1 ? 's' : ''}`}
                    </p>
                    <button
                        onClick={toggleShowAll}
                        className="text-xs text-amber-600 hover:text-amber-700 font-medium underline underline-offset-2"
                    >
                        {showAll ? 'Show active only' : 'Show all (including triggered)'}
                    </button>
                </div>

                {loading ? (
                    <div className="text-center py-16">
                        <div className="inline-block animate-spin rounded-full h-10 w-10 border-b-2 border-amber-500" />
                    </div>
                ) : alerts.length === 0 ? (
                    <div className="bg-white rounded-xl border border-gray-200 p-12 text-center shadow-sm">
                        <Bell className="w-12 h-12 text-gray-300 mx-auto mb-4" />
                        <h2 className="text-xl font-semibold text-gray-900 mb-2">No active alerts</h2>
                        <p className="text-gray-600 mb-6">
                            Set a price alert on any product page and we'll notify you the moment the price drops.
                        </p>
                        <button
                            onClick={() => navigate('/products/all')}
                            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-gray-900 text-white hover:opacity-90 text-sm"
                        >
                            Browse Jewellery
                        </button>
                    </div>
                ) : (
                    <div className="space-y-4">
                        {alerts.map(alert => (
                            <div
                                key={alert._id}
                                className={`bg-white rounded-xl border ${alert.is_active ? 'border-gray-200' : 'border-gray-100 opacity-60'} shadow-sm p-4 flex gap-4 items-start`}
                            >
                                {/* Product image or icon */}
                                {alert.product?.image ? (
                                    <img
                                        src={toAbsoluteImage(alert.product.image)}
                                        alt={alert.product.name}
                                        className="w-16 h-16 object-cover rounded-lg flex-shrink-0 bg-gray-100 cursor-pointer hover:opacity-80"
                                        onClick={() => alert.product && navigate(`/product/${alert.product._id}`)}
                                        onError={(e) => { (e.target as HTMLImageElement).src = '/jewel1.png'; }}
                                    />
                                ) : (
                                    <div className="w-16 h-16 rounded-lg bg-amber-50 flex items-center justify-center flex-shrink-0">
                                        <Bell className="w-7 h-7 text-amber-400" />
                                    </div>
                                )}

                                {/* Info */}
                                <div className="flex-1 min-w-0">
                                    <div className="flex items-start justify-between gap-2">
                                        <div>
                                            {alert.product && (
                                                <button
                                                    onClick={() => navigate(`/product/${alert.product!._id}`)}
                                                    className="font-medium text-gray-900 hover:text-blue-600 text-sm leading-snug line-clamp-2 text-left"
                                                >
                                                    {alert.product.name}
                                                </button>
                                            )}
                                            {alert.alert_type === 'gold_rate' && (
                                                <p className="font-medium text-gray-900 text-sm">Gold Rate Alert ({alert.gold_purity})</p>
                                            )}
                                        </div>
                                        <button
                                            onClick={() => handleDelete(alert._id)}
                                            disabled={deletingId === alert._id}
                                            className="flex-shrink-0 p-1.5 rounded-lg text-gray-400 hover:text-red-500 hover:bg-red-50 transition-colors"
                                            title="Remove alert"
                                        >
                                            {deletingId === alert._id
                                                ? <div className="w-4 h-4 animate-spin rounded-full border-b-2 border-red-400" />
                                                : <Trash2 className="w-4 h-4" />}
                                        </button>
                                    </div>

                                    <div className="mt-2 flex flex-wrap items-center gap-2">
                                        <AlertTypeBadge type={alert.alert_type} />

                                        {alert.target_price && (
                                            <span className="text-xs text-gray-500">
                                                Target: <span className="font-medium text-gray-700">₹{alert.target_price.toLocaleString('en-IN')}</span>
                                            </span>
                                        )}
                                        {alert.product?.price && (
                                            <span className="text-xs text-gray-500">
                                                Current: <span className="font-medium text-gray-700">₹{alert.product.price.toLocaleString('en-IN')}</span>
                                            </span>
                                        )}
                                        {!alert.is_active && alert.triggered_at && (
                                            <span className="text-xs text-green-600 font-medium">✓ Triggered</span>
                                        )}
                                    </div>

                                    <p className="text-[11px] text-gray-400 mt-1">
                                        Set on {new Date(alert.created_at).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
                                    </p>
                                </div>
                            </div>
                        ))}
                    </div>
                )}

                {/* CTA to browse more */}
                {!loading && alerts.length > 0 && (
                    <div className="mt-8 text-center">
                        <button
                            onClick={() => navigate('/products/all')}
                            className="text-sm text-amber-600 hover:text-amber-700 font-medium underline underline-offset-2"
                        >
                            + Set alerts on more products
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
};

export default MyAlertsPage;
