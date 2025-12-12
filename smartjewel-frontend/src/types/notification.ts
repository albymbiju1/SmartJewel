export interface NotificationItem {
    _id: string;
    user_id: string;
    title: string;
    message: string;
    type: string;
    status?: string;
    is_read: boolean;
    created_at: string;
    data?: {
        order_id?: string;
        status?: string;
    };
    related_entity_id?: string;
    related_entity_type?: string;
}
