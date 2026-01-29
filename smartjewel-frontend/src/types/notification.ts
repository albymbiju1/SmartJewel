export interface NotificationItem {
    _id: string;
    user_id: string;
    title: string;
    message: string;
    type: string;
    status?: string;
    is_read: boolean;
    created_at: string;
    timestamp?: string;  // Backend sends this for KYC notifications
    action_url?: string;  // Action URL for KYC, rentals, etc.
    icon?: string;
    color?: string;
    data?: {
        order_id?: string;
        status?: string;
    };
    related_entity_id?: string;
    related_entity_type?: string;
}
