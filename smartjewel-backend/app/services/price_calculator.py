"""
Price calculation service for gold jewelry products.
Handles automatic price updates based on current gold rates while preserving markups and charges.
"""

import logging
from datetime import datetime, timezone
from typing import Dict, List, Optional, Tuple
from pymongo.database import Database

logger = logging.getLogger(__name__)

class GoldPriceCalculator:
    """Service for calculating and updating product prices based on gold rates."""
    
    # Purity conversion factors (percentage of 24K gold content)
    PURITY_FACTORS = {
        '24k': 1.0,      # 100%
        '22k': 0.916,    # 91.6%
        '18k': 0.75,     # 75%
        '14k': 0.585,    # 58.5%
    }
    
    @staticmethod
    def calculate_gold_price_standalone(
        price_24k_per_gram: float,
        weight_grams: float,
        karat: int,
        making_charge_type: str,
        making_charge_value: float,
        gst_percent: float = 3.0
    ) -> float:
        """
        Standalone gold price calculation function matching exact requirements.
        
        Args:
            price_24k_per_gram: Current 24K gold rate per gram (from API)
            weight_grams: Product weight in grams
            karat: Purity (24, 22, 18, 14)
            making_charge_type: Either 'percent' or 'per_gram'
            making_charge_value: Numeric value for making charges
            gst_percent: Tax percentage (default 3%)
            
        Returns:
            Final price rounded to 2 decimals
        """
        # Step 1: Select purity factor
        purity_factors = {
            24: 1.0,
            22: 0.916,
            18: 0.750,
            14: 0.585
        }
        purity_factor = purity_factors.get(karat, 1.0)
        
        # Step 2: Calculate Gold Cost = 24K Price × Purity Factor × Weight
        gold_cost = price_24k_per_gram * purity_factor * weight_grams
        
        # Step 3: Add Making Charges
        if making_charge_type == 'percent':
            # Percentage of gold cost
            making_charges = gold_cost * (making_charge_value / 100.0)
        else:  # per_gram
            # Fixed per gram charge
            making_charges = making_charge_value * weight_grams
        
        # Step 4: Add GST: (Gold Cost + Making Charges) × (1 + GST%)
        subtotal = gold_cost + making_charges
        total_price = subtotal * (1 + gst_percent / 100.0)
        
        # Step 5: Return final price rounded to 2 decimals
        return round(total_price, 2)
    
    def __init__(self, db: Database):
        self.db = db
    
    def get_latest_gold_rates(self) -> Optional[Dict[str, float]]:
        """Get the latest gold rates from the database."""
        try:
            doc = self.db.gold_rate.find_one({}, sort=[("updated_at", -1)])
            if doc and doc.get("rates"):
                return doc["rates"]
            return None
        except Exception as e:
            logger.error(f"Failed to fetch gold rates: {e}")
            return None
    
    def convert_weight_to_grams(self, weight: float, unit: str) -> float:
        """Convert weight to grams based on the unit."""
        unit_lower = unit.lower() if unit else 'g'
        
        if unit_lower in ('gram', 'grams', 'g'):
            return weight
        elif unit_lower in ('mg', 'milligram', 'milligrams'):
            return weight / 1000.0
        elif unit_lower in ('kg', 'kilogram', 'kilograms'):
            return weight * 1000.0
        else:
            # Default to grams if unit is unknown
            return weight
    
    def calculate_gold_price(self, weight: float, weight_unit: str, purity: str, 
                           gold_rate_24k: float) -> float:
        """
        Calculate the base gold price for a product.
        
        Args:
            weight: Product weight
            weight_unit: Weight unit (g, mg, kg, etc.)
            purity: Gold purity (24k, 22k, 18k, 14k)
            gold_rate_24k: Current 24K gold rate per gram
            
        Returns:
            Base gold price
        """
        # Convert weight to grams
        grams = self.convert_weight_to_grams(weight, weight_unit)
        
        # Get purity factor
        purity_lower = purity.lower() if purity else '24k'
        purity_factor = self.PURITY_FACTORS.get(purity_lower, 1.0)
        
        # Calculate base price
        base_price = grams * gold_rate_24k * purity_factor
        
        return round(base_price, 2)
    
    def calculate_total_price(self, product: Dict, gold_rate_24k: float) -> Dict[str, float]:
        """
        Calculate total price using the exact formula specified:
        1. Gold Cost = 24K Price × Purity Factor × Weight
        2. Add Making Charges (either % of gold cost or per gram × weight)
        3. Add GST: (Gold Cost + Making Charges) × (1 + GST%)
        
        Args:
            product: Product document from database
            gold_rate_24k: Current 24K gold rate per gram
            
        Returns:
            Dictionary with price breakdown
        """
        # Get product details
        weight_grams = float(product.get("weight", 0))
        weight_unit = product.get("weight_unit", "g")
        karat = str(product.get("karat", product.get("purity", "24"))).replace("k", "").replace("K", "")
        
        # Convert weight to grams if needed
        if weight_unit.lower() in ('mg', 'milligram', 'milligrams'):
            weight_grams = weight_grams / 1000.0
        elif weight_unit.lower() in ('kg', 'kilogram', 'kilograms'):
            weight_grams = weight_grams * 1000.0
        
        # Step 1: Select purity factor and calculate Gold Cost
        purity_factors = {
            '24': 1.0,
            '22': 0.916,
            '18': 0.750,
            '14': 0.585
        }
        purity_factor = purity_factors.get(karat, 1.0)
        gold_cost = gold_rate_24k * purity_factor * weight_grams
        
        # Step 2: Add Making Charges
        making_charge_type = product.get("making_charge_type", "percent")
        making_charge_value = float(product.get("making_charge_value", 25))  # Default 25%
        
        if making_charge_type == "percent":
            # Percentage of gold cost
            making_charges = gold_cost * (making_charge_value / 100.0)
        else:  # per_gram
            # Fixed per gram charge
            making_charges = making_charge_value * weight_grams
        
        # Step 3: Add GST
        gst_percent = float(product.get("gst_percent", 3.0))  # Default 3%
        subtotal = gold_cost + making_charges
        gst_amount = subtotal * (gst_percent / 100.0)
        total_price = subtotal + gst_amount
        
        return {
            "gold_cost": round(gold_cost, 2),
            "making_charges": round(making_charges, 2),
            "making_charge_type": making_charge_type,
            "making_charge_value": making_charge_value,
            "subtotal": round(subtotal, 2),
            "gst_percent": gst_percent,
            "gst_amount": round(gst_amount, 2),
            "total_price": round(total_price, 2),
            "purity_factor": purity_factor,
            "weight_grams": weight_grams,
            "karat": karat
        }
    
    def update_product_prices(self, dry_run: bool = False) -> Dict[str, any]:
        """
        Update prices for all gold products based on current gold rates.
        
        Args:
            dry_run: If True, only calculate prices without updating database
            
        Returns:
            Dictionary with update results
        """
        start_time = datetime.now(timezone.utc)
        results = {
            "success": False,
            "updated_count": 0,
            "error_count": 0,
            "skipped_count": 0,
            "errors": [],
            "start_time": start_time.isoformat(),
            "end_time": None,
            "gold_rates": None,
            "dry_run": dry_run
        }
        
        try:
            # Get latest gold rates
            gold_rates = self.get_latest_gold_rates()
            if not gold_rates:
                results["errors"].append("No gold rates available")
                return results
            
            results["gold_rates"] = gold_rates
            gold_rate_24k = gold_rates.get("24k", 0)
            
            if gold_rate_24k <= 0:
                results["errors"].append("Invalid 24K gold rate")
                return results
            
            # Find all active gold products
            query = {
                "status": "active",
                "metal": {"$regex": "gold", "$options": "i"},
                "weight": {"$gt": 0},
                "$or": [
                    {"karat": {"$exists": True}},
                    {"purity": {"$exists": True}}
                ]
            }
            
            products = list(self.db.items.find(query))
            logger.info(f"Found {len(products)} gold products to update")
            
            updated_products = []
            
            for product in products:
                try:
                    # Calculate new price
                    price_breakdown = self.calculate_total_price(product, gold_rate_24k)
                    new_price = price_breakdown["total_price"]
                    
                    # Skip if price hasn't changed significantly (less than 1 rupee difference)
                    current_price = float(product.get("price", 0))
                    if abs(new_price - current_price) < 1.0:
                        results["skipped_count"] += 1
                        continue
                    
                    if not dry_run:
                        # Update product in database
                        update_data = {
                            "price": new_price,
                            "price_breakdown": price_breakdown,
                            "last_price_update": start_time,
                            "updated_at": start_time
                        }
                        
                        self.db.items.update_one(
                            {"_id": product["_id"]},
                            {"$set": update_data}
                        )
                    
                    updated_products.append({
                        "product_id": str(product["_id"]),
                        "sku": product.get("sku"),
                        "name": product.get("name"),
                        "old_price": current_price,
                        "new_price": new_price,
                        "price_change": round(new_price - current_price, 2),
                        "purity": product.get("purity"),
                        "weight": product.get("weight"),
                        "weight_unit": product.get("weight_unit")
                    })
                    
                    results["updated_count"] += 1
                    
                except Exception as e:
                    error_msg = f"Failed to update product {product.get('sku', 'unknown')}: {str(e)}"
                    logger.error(error_msg)
                    results["errors"].append(error_msg)
                    results["error_count"] += 1
            
            # Log the update operation
            if not dry_run:
                self._log_price_update(results, updated_products)
            
            results["success"] = True
            results["updated_products"] = updated_products
            
        except Exception as e:
            error_msg = f"Price update operation failed: {str(e)}"
            logger.error(error_msg)
            results["errors"].append(error_msg)
        
        finally:
            results["end_time"] = datetime.now(timezone.utc).isoformat()
        
        return results
    
    def _log_price_update(self, results: Dict, updated_products: List[Dict]) -> None:
        """Log the price update operation to the database."""
        try:
            log_entry = {
                "operation": "price_update",
                "timestamp": datetime.now(timezone.utc),
                "success": results["success"],
                "updated_count": results["updated_count"],
                "error_count": results["error_count"],
                "skipped_count": results["skipped_count"],
                "gold_rates": results["gold_rates"],
                "errors": results["errors"],
                "updated_products": updated_products[:10]  # Store first 10 for reference
            }
            
            self.db.price_update_logs.insert_one(log_entry)
            
        except Exception as e:
            logger.error(f"Failed to log price update: {e}")
    
    def get_price_update_history(self, limit: int = 10) -> List[Dict]:
        """Get the history of price update operations."""
        try:
            logs = list(self.db.price_update_logs.find(
                {"operation": "price_update"}
            ).sort("timestamp", -1).limit(limit))
            
            for log in logs:
                log["_id"] = str(log["_id"])
                if "timestamp" in log and hasattr(log["timestamp"], "isoformat"):
                    log["timestamp"] = log["timestamp"].isoformat()
            
            return logs
            
        except Exception as e:
            logger.error(f"Failed to fetch price update history: {e}")
            return []
    
    def get_last_successful_update(self) -> Optional[Dict]:
        """Get the last successful price update."""
        try:
            log = self.db.price_update_logs.find_one(
                {"operation": "price_update", "success": True},
                sort=[("timestamp", -1)]
            )
            
            if log:
                log["_id"] = str(log["_id"])
                if "timestamp" in log and hasattr(log["timestamp"], "isoformat"):
                    log["timestamp"] = log["timestamp"].isoformat()
            
            return log
            
        except Exception as e:
            logger.error(f"Failed to fetch last successful update: {e}")
            return None
