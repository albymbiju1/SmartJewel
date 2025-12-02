"""
WhatsApp Service Integration
Handles communication with the WhatsApp microservice
"""

import requests
from typing import Dict, List, Optional, Any
from flask import current_app


class WhatsAppService:
    """Service to send WhatsApp messages via Node.js microservice"""

    def __init__(self, base_url: str = "http://localhost:3300"):
        """
        Initialize WhatsApp service

        Args:
            base_url: URL of the WhatsApp Node.js microservice
        """
        self.base_url = base_url
        self.timeout = 10  # seconds

    def is_ready(self) -> bool:
        """
        Check if WhatsApp service is ready

        Returns:
            True if service is ready, False otherwise
        """
        try:
            response = requests.get(
                f"{self.base_url}/health",
                timeout=self.timeout
            )
            data = response.json()
            return data.get('success', False) and data.get('ready', False)
        except Exception as e:
            current_app.logger.warning(f"WhatsApp service health check failed: {e}")
            return False

    def send_registration_message(
        self,
        name: str,
        phone: str
    ) -> Dict[str, Any]:
        """
        Send registration confirmation via WhatsApp

        Args:
            name: Customer name
            phone: Phone number (10-digit or with country code)

        Returns:
            Dictionary with success status and message
        """
        try:
            response = requests.post(
                f"{self.base_url}/send/register",
                json={
                    'name': name,
                    'phone': phone
                },
                timeout=self.timeout
            )

            if response.status_code == 200:
                data = response.json()
                current_app.logger.info(
                    f"WhatsApp registration message sent to {name} ({phone})"
                )
                return {
                    'success': True,
                    'message': 'WhatsApp notification sent',
                    'data': data.get('data', {})
                }
            else:
                error_data = response.json()
                current_app.logger.error(
                    f"WhatsApp service error: {error_data.get('error', 'Unknown error')}"
                )
                return {
                    'success': False,
                    'message': error_data.get('error', 'Failed to send WhatsApp message')
                }

        except requests.exceptions.ConnectionError:
            current_app.logger.warning("WhatsApp service is not available")
            return {
                'success': False,
                'message': 'WhatsApp service unavailable'
            }
        except requests.exceptions.Timeout:
            current_app.logger.warning("WhatsApp service timeout")
            return {
                'success': False,
                'message': 'WhatsApp service timeout'
            }
        except Exception as e:
            current_app.logger.error(f"WhatsApp service error: {str(e)}")
            return {
                'success': False,
                'message': f'WhatsApp error: {str(e)}'
            }

    def send_order_confirmation(
        self,
        name: str,
        phone: str,
        order_id: str,
        items: List[Dict[str, Any]],
        total: float
    ) -> Dict[str, Any]:
        """
        Send order confirmation via WhatsApp

        Args:
            name: Customer name
            phone: Phone number (10-digit or with country code)
            order_id: Order ID
            items: List of order items with name, price, quantity
            total: Total order amount

        Returns:
            Dictionary with success status and message
        """
        try:
            response = requests.post(
                f"{self.base_url}/send/order",
                json={
                    'name': name,
                    'phone': phone,
                    'orderId': order_id,
                    'items': items,
                    'total': total
                },
                timeout=self.timeout
            )

            if response.status_code == 200:
                data = response.json()
                current_app.logger.info(
                    f"WhatsApp order confirmation sent to {name} ({phone}) for order {order_id}"
                )
                return {
                    'success': True,
                    'message': 'WhatsApp order confirmation sent',
                    'data': data.get('data', {})
                }
            else:
                error_data = response.json()
                current_app.logger.error(
                    f"WhatsApp service error: {error_data.get('error', 'Unknown error')}"
                )
                return {
                    'success': False,
                    'message': error_data.get('error', 'Failed to send WhatsApp message')
                }

        except requests.exceptions.ConnectionError:
            current_app.logger.warning("WhatsApp service is not available")
            return {
                'success': False,
                'message': 'WhatsApp service unavailable'
            }
        except requests.exceptions.Timeout:
            current_app.logger.warning("WhatsApp service timeout")
            return {
                'success': False,
                'message': 'WhatsApp service timeout'
            }
        except Exception as e:
            current_app.logger.error(f"WhatsApp service error: {str(e)}")
            return {
                'success': False,
                'message': f'WhatsApp error: {str(e)}'
            }


# Singleton instance
_whatsapp_service = None


def get_whatsapp_service() -> WhatsAppService:
    """
    Get or create WhatsApp service instance

    Returns:
        WhatsAppService instance
    """
    global _whatsapp_service
    if _whatsapp_service is None:
        # Get URL from config if available
        whatsapp_url = current_app.config.get(
            'WHATSAPP_SERVICE_URL',
            'http://localhost:3300'
        )
        _whatsapp_service = WhatsAppService(base_url=whatsapp_url)
    return _whatsapp_service
