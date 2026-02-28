import { api } from '../api';

export type AlertType = 'price_drop' | 'back_in_stock' | 'gold_rate';
export type NotificationMethod = 'email' | 'app';

export interface CreateAlertParams {
    alert_type: AlertType;
    product_id?: string;
    target_price?: number | null;
    gold_purity?: string;
    threshold_drop?: number;
    notification_methods?: NotificationMethod[];
}

export interface AlertItem {
    _id: string;
    user_id: string;
    alert_type: AlertType;
    product_id?: string;
    product?: {
        _id: string;
        name: string;
        price: number;
        image?: string;
        sku: string;
    };
    target_price?: number;
    gold_purity?: string;
    threshold_drop?: number;
    notification_methods: NotificationMethod[];
    is_active: boolean;
    created_at: string;
    triggered_at?: string;
}

const alertService = {
    async createAlert(params: CreateAlertParams): Promise<string | null> {
        try {
            const res = await api.post('/api/alerts/create', params);
            return res.data.alert_id ?? null;
        } catch (err) {
            console.error('[alertService] createAlert failed:', err);
            return null;
        }
    },

    async getMyAlerts(activeOnly = true): Promise<AlertItem[]> {
        try {
            const res = await api.get('/api/alerts/my-alerts', {
                params: { active_only: activeOnly },
            });
            return res.data.alerts ?? [];
        } catch (err) {
            console.error('[alertService] getMyAlerts failed:', err);
            return [];
        }
    },

    async deleteAlert(alertId: string): Promise<boolean> {
        try {
            await api.delete(`/api/alerts/${alertId}`);
            return true;
        } catch (err) {
            console.error('[alertService] deleteAlert failed:', err);
            return false;
        }
    },
};

export default alertService;
