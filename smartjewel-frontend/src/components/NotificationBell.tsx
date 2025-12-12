import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Bell, Check, Package, X, Truck, CreditCard, Clock, RefreshCw } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api';
import { NotificationItem } from '../types/notification';
import { useAuth } from '../contexts/AuthContext';

export const NotificationBell: React.FC = () => {
    const navigate = useNavigate();
    const { isAuthenticated, user } = useAuth();
    const [notifications, setNotifications] = useState<NotificationItem[]>([]);
    const [unreadCount, setUnreadCount] = useState(0);
    const [showNotifications, setShowNotifications] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const notificationRef = useRef<HTMLDivElement>(null);
    const lastFetchRef = useRef<number>(0);

    const fetchNotifications = useCallback(async (force = false, retryCount = 0) => {
        // Don't fetch if not authenticated
        if (!isAuthenticated) {
            setNotifications([]);
            setUnreadCount(0);
            return;
        }

        // Prevent duplicate fetches within 2 seconds unless forced
        const now = Date.now();
        if (!force && now - lastFetchRef.current < 2000) {
            return;
        }
        lastFetchRef.current = now;

        try {
            setIsLoading(true);
            console.log('Fetching notifications...');
            const res = await api.get('/api/notifications/');
            const notifs = res.data.notifications || [];
            console.log('Fetched notifications:', notifs.length);
            setNotifications(notifs);
            setUnreadCount(notifs.filter((n: NotificationItem) => !n.is_read).length);
        } catch (err: any) {
            // Handle 500 errors with retry (up to 2 retries)
            if (err?.response?.status === 500 && retryCount < 2) {
                console.log(`Notification fetch failed (500), retrying in ${(retryCount + 1) * 2}s...`);
                setTimeout(() => fetchNotifications(true, retryCount + 1), (retryCount + 1) * 2000);
                return;
            }
            // Only log if not a 401 (unauthenticated) error
            if (err?.response?.status !== 401) {
                console.error("Failed to fetch notifications", err);
            }
            // Clear notifications on auth error
            if (err?.response?.status === 401) {
                setNotifications([]);
                setUnreadCount(0);
            }
        } finally {
            setIsLoading(false);
        }
    }, [isAuthenticated]);

    // Fetch notifications when authentication state changes or user changes
    useEffect(() => {
        if (isAuthenticated && user) {
            // Force fetch when user logs in
            fetchNotifications(true);
        } else {
            // Clear notifications when logged out
            setNotifications([]);
            setUnreadCount(0);
        }
    }, [isAuthenticated, user?.id, fetchNotifications]);

    // Set up polling interval - only when authenticated
    useEffect(() => {
        if (!isAuthenticated) return;

        // Poll every 30 seconds instead of 60 for better responsiveness
        const interval = setInterval(() => fetchNotifications(false), 30000);
        return () => clearInterval(interval);
    }, [isAuthenticated, fetchNotifications]);

    // Listen for custom events to trigger notification refresh (e.g., after order status change)
    useEffect(() => {
        const handleRefresh = () => {
            if (isAuthenticated) {
                fetchNotifications(true);
            }
        };

        window.addEventListener('sj:notifications:refresh', handleRefresh);
        // Also refresh when the window regains focus
        window.addEventListener('focus', handleRefresh);

        return () => {
            window.removeEventListener('sj:notifications:refresh', handleRefresh);
            window.removeEventListener('focus', handleRefresh);
        };
    }, [isAuthenticated, fetchNotifications]);

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (notificationRef.current && !notificationRef.current.contains(event.target as Node)) {
                setShowNotifications(false);
            }
        };
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, []);

    const markAsRead = async (id: string) => {
        try {
            await api.post(`/api/notifications/${id}/read`);
            setNotifications(prev => prev.map(n => n._id === id ? { ...n, is_read: true } : n));
            setUnreadCount(prev => Math.max(0, prev - 1));
        } catch (err) {
            console.error("Failed to mark notification as read", err);
        }
    };

    const markAllAsRead = async () => {
        try {
            await api.post('/api/notifications/read-all');
            setNotifications(prev => prev.map(n => ({ ...n, is_read: true })));
            setUnreadCount(0);
        } catch (err) {
            console.error("Failed to mark all as read", err);
        }
    };

    const clearAllNotifications = async () => {
        try {
            await api.delete('/api/notifications/clear-all');
            setNotifications([]);
            setUnreadCount(0);
        } catch (err) {
            console.error("Failed to clear notifications", err);
        }
    };

    const handleNotificationClick = (n: NotificationItem) => {
        if (!n.is_read) {
            markAsRead(n._id);
        }
        setShowNotifications(false);

        // Navigate to order details page for the specific order
        if (n.related_entity_type === 'order' && n.related_entity_id) {
            navigate(`/order-details/${n.related_entity_id}`);
        }
    };

    // Format date/time in IST
    const formatNotificationTime = (dateString: string) => {
        const date = new Date(dateString);
        // Convert to IST (UTC+5:30)
        const istDate = new Date(date.getTime() + (5.5 * 60 * 60 * 1000));

        const dateStr = istDate.toLocaleDateString('en-IN', {
            day: '2-digit',
            month: 'short',
            year: 'numeric'
        });

        const timeStr = istDate.toLocaleTimeString('en-IN', {
            hour: '2-digit',
            minute: '2-digit',
            hour12: true
        });

        return { dateStr, timeStr };
    };

    return (
        <div className="relative" ref={notificationRef}>
            <button
                className="inline-flex items-center justify-center w-9 h-9 rounded-full border border-gray-200 text-gray-700 hover:bg-gray-50 hover:text-brand-burgundy"
                onClick={() => setShowNotifications(!showNotifications)}
                title="Notifications"
            >
                <Bell className="w-5 h-5" strokeWidth={1.5} />
                {unreadCount > 0 && (
                    <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 rounded-full bg-red-600 text-white text-[10px] leading-[18px] text-center shadow">
                        {unreadCount}
                    </span>
                )}
            </button>

            {showNotifications && (
                <div className="absolute top-full right-0 mt-2 w-80 md:w-96 bg-white rounded-lg shadow-xl border border-gray-100 overflow-hidden z-[60]">
                    <div className="p-2.5 border-b border-gray-100 flex items-center justify-between bg-gray-50">
                        <h3 className="font-medium text-sm text-gray-700">Notifications</h3>
                        {unreadCount > 0 && (
                            <button
                                onClick={markAllAsRead}
                                className="text-xs text-amber-600 hover:text-amber-700 font-medium"
                            >
                                Mark all read
                            </button>
                        )}
                    </div>

                    <div className="max-h-[70vh] overflow-y-auto">
                        {notifications.length === 0 ? (
                            <div className="p-5 text-center text-gray-500">
                                <Bell className="w-6 h-6 mx-auto mb-2 text-gray-300" />
                                <p className="text-xs">No notifications yet</p>
                            </div>
                        ) : (
                            <>
                                <div className="divide-y divide-gray-50 max-h-[50vh] overflow-y-auto">
                                    {notifications.map((n) => (
                                        <div
                                            key={n._id}
                                            className={`p-2.5 hover:bg-gray-50 transition-colors cursor-pointer flex gap-2.5 ${!n.is_read ? 'bg-amber-50/40' : ''}`}
                                            onClick={() => handleNotificationClick(n)}
                                        >
                                            <div className={`mt-0.5 flex-shrink-0 w-7 h-7 rounded-full flex items-center justify-center ${
                                                n.status === 'delivered' ? 'bg-green-100 text-green-600' :
                                                n.status === 'shipped' ? 'bg-blue-100 text-blue-600' :
                                                n.status === 'out_for_delivery' ? 'bg-indigo-100 text-indigo-600' :
                                                n.status === 'cancelled' ? 'bg-red-100 text-red-600' :
                                                n.status === 'refunded' ? 'bg-orange-100 text-orange-600' :
                                                n.status === 'paid' ? 'bg-emerald-100 text-emerald-600' :
                                                n.status === 'confirmed' ? 'bg-teal-100 text-teal-600' :
                                                n.status === 'processing' ? 'bg-yellow-100 text-yellow-600' :
                                                'bg-gray-100 text-gray-600'
                                            }`}>
                                                {n.status === 'delivered' ? <Check className="w-3.5 h-3.5" /> :
                                                n.status === 'shipped' ? <Package className="w-3.5 h-3.5" /> :
                                                n.status === 'out_for_delivery' ? <Truck className="w-3.5 h-3.5" /> :
                                                n.status === 'cancelled' ? <X className="w-3.5 h-3.5" /> :
                                                n.status === 'refunded' ? <RefreshCw className="w-3.5 h-3.5" /> :
                                                n.status === 'paid' ? <CreditCard className="w-3.5 h-3.5" /> :
                                                n.status === 'confirmed' ? <Check className="w-3.5 h-3.5" /> :
                                                n.status === 'processing' ? <Clock className="w-3.5 h-3.5" /> :
                                                <Bell className="w-3.5 h-3.5" />}
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <p className={`text-xs ${!n.is_read ? 'font-semibold text-gray-900' : 'text-gray-700'}`}>
                                                    {n.title}
                                                </p>
                                                <p className="text-[11px] text-gray-500 mt-0.5 line-clamp-2">{n.message}</p>
                                                <p className="text-[9px] text-gray-400 mt-0.5">
                                                    {(() => {
                                                        const { dateStr, timeStr } = formatNotificationTime(n.created_at);
                                                        return `${dateStr} ${timeStr}`;
                                                    })()}
                                                </p>
                                            </div>
                                            {!n.is_read && (
                                                <div className="flex-shrink-0 self-center">
                                                    <span className="block w-2 h-2 rounded-full bg-amber-500"></span>
                                                </div>
                                            )}
                                        </div>
                                    ))}
                                </div>

                                <div className="border-t border-gray-100">
                                    <button
                                        onClick={clearAllNotifications}
                                        className="w-full px-3 py-2.5 text-xs text-center text-red-500 hover:bg-gray-50 font-medium transition-colors"
                                    >
                                        Clear All Notifications
                                    </button>
                                </div>
                            </>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
};
