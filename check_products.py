from app import create_app

app = create_app()
with app.app_context():
    db = app.extensions['mongo_db']
    print('Total products:', db.items.count_documents({}))

    gold_products = list(db.items.find({
        'metal': {'$regex': 'gold', '$options': 'i'},
        'status': 'active',
        'weight': {'$gt': 0},
        '$or': [
            {'karat': {'$exists': True}},
            {'purity': {'$exists': True}}
        ]
    }))

    print('Active gold products matching criteria:', len(gold_products))

    if gold_products:
        for p in gold_products[:10]:
            print(f"  SKU: {p.get('sku')}, Name: {p.get('name')}, Weight: {p.get('weight')} {p.get('weight_unit')}, Karat: {p.get('karat')}, Price: {p.get('price')}")
    else:
        print("No active gold products found with required fields.")

        # Check for any gold products
        any_gold = list(db.items.find({'metal': {'$regex': 'gold', '$options': 'i'}}))
        print('Total gold products (any status):', len(any_gold))
        if any_gold:
            for p in any_gold[:5]:
                print(f"  SKU: {p.get('sku')}, Status: {p.get('status')}, Karat: {p.get('karat')}")