# smartjewel-backend

## Features

### Order Status Notifications
The application includes a comprehensive order status notification system that automatically sends email notifications to customers when their order status changes. Currently supports email notifications via SMTP, with extensible architecture for SMS and push notifications.

#### Supported Status Changes
- **Shipped**: Sent when order status is updated to "shipped", includes tracking information if available
- **Delivered**: Sent when order is marked as delivered
- **Cancelled**: Sent when order is cancelled, includes cancellation reason if provided
- **Refunded**: Sent when a refund is processed, includes refund amount and details

#### Email Notifications
- Professional HTML and plain text templates
- Dynamic content including order items, pricing, customer details, and tracking information
- Configurable SMTP settings for different email providers
- Error handling and logging for failed deliveries

#### Integration Points
- **Admin Order Management**: Notifications triggered when admins update order status via the admin dashboard
- **Razorpay Webhooks**: Automatic notifications for refund status changes
- **Extensible Service**: Notification service designed to easily add SMS (Twilio) and push notifications (Firebase FCM)

#### Configuration
Set the following environment variables for SMTP configuration:
```
SMTP_SERVER=smtp.gmail.com
SMTP_PORT=587
SMTP_USERNAME=your_email@gmail.com
SMTP_PASSWORD=your_app_password
FROM_EMAIL=your_email@gmail.com
FROM_NAME=SmartJewel
```

#### Future Enhancements
- SMS notifications via Twilio
- Push notifications via Firebase Cloud Messaging
- WhatsApp business API integration
- Custom notification templates per customer preference