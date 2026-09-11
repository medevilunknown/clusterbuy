#!/usr/bin/env python3
"""
ClusterBuy Backend API Test Suite - Regression Test for MongoDB Connection Race Fix
Tests all backend endpoints with focus on concurrency and the connected order state machine
"""

import requests
import json
import sys
from datetime import datetime, timedelta
from pymongo import MongoClient
import os
import concurrent.futures
import time

# Configuration
BASE_URL = "https://msme-supply.preview.emergentagent.com/api"
MONGO_URL = "mongodb://localhost:27017"
DB_NAME = "your_database_name"

# Test results tracking
test_results = {
    "passed": [],
    "failed": [],
    "warnings": []
}

def log_pass(test_name):
    print(f"✅ PASS: {test_name}")
    test_results["passed"].append(test_name)

def log_fail(test_name, reason):
    print(f"❌ FAIL: {test_name}")
    print(f"   Reason: {reason}")
    test_results["failed"].append({"test": test_name, "reason": reason})

def log_warning(test_name, message):
    print(f"⚠️  WARNING: {test_name}")
    print(f"   Message: {message}")
    test_results["warnings"].append({"test": test_name, "message": message})

def check_no_mongo_id(data, test_name):
    """Verify no _id fields in response"""
    if isinstance(data, dict):
        if "_id" in data:
            log_fail(test_name, "Response contains Mongo _id field")
            return False
        for value in data.values():
            if not check_no_mongo_id(value, test_name):
                return False
    elif isinstance(data, list):
        for item in data:
            if not check_no_mongo_id(item, test_name):
                return False
    return True

print("=" * 80)
print("ClusterBuy Backend API Test Suite")
print("=" * 80)
print(f"Base URL: {BASE_URL}")
print(f"Started at: {datetime.now().isoformat()}")
print("=" * 80)

# ============================================================================
# PRIORITY 1: POST /api/seed
# ============================================================================
print("\n[1] Testing POST /api/seed (idempotent)")
print("-" * 80)

try:
    # First call
    response = requests.post(f"{BASE_URL}/seed", timeout=30)
    print(f"Status: {response.status_code}")
    
    if response.status_code == 200:
        data = response.json()
        print(f"Response: {json.dumps(data, indent=2)}")
        
        # Check structure
        if data.get("ok") == True and "stats" in data:
            stats = data["stats"]
            expected = {"buyers": 10, "sellers": 6, "warehouses": 3, "orders": 10}
            
            if stats == expected:
                log_pass("POST /api/seed - correct stats")
            else:
                log_fail("POST /api/seed - incorrect stats", f"Expected {expected}, got {stats}")
        else:
            log_fail("POST /api/seed - invalid response structure", f"Got: {data}")
    else:
        log_fail("POST /api/seed", f"Status {response.status_code}: {response.text}")
    
    # Second call (idempotency test)
    print("\nTesting idempotency (second call)...")
    response2 = requests.post(f"{BASE_URL}/seed", timeout=30)
    if response2.status_code == 200:
        data2 = response2.json()
        if data2.get("ok") == True:
            log_pass("POST /api/seed - idempotent")
        else:
            log_fail("POST /api/seed - idempotency", "Second call failed")
    else:
        log_fail("POST /api/seed - idempotency", f"Status {response2.status_code}")
        
except Exception as e:
    log_fail("POST /api/seed", str(e))

# ============================================================================
# PRIORITY 2: CONCURRENCY CHECK (MOST IMPORTANT - MongoDB race fix)
# ============================================================================
print("\n[2] CONCURRENCY CHECK - Testing MongoDB connection race fix")
print("=" * 80)
print("Firing 20 parallel GET requests to multiple endpoints...")
print("Checking for: (1) ZERO 500 errors, (2) NO 'Cannot read properties of undefined' errors")
print("-" * 80)

# Endpoints to test concurrently
concurrent_endpoints = [
    "/pools", "/demands", "/orders", "/inventory", "/shipments", 
    "/settlements", "/auctions", "/inspections", "/buyers", "/sellers",
    "/companies", "/warehouses", "/materials", "/notifications", 
    "/action-queue", "/opportunities", "/disputes"
]

def fetch_endpoint(endpoint):
    """Fetch a single endpoint and return result"""
    try:
        start = time.time()
        response = requests.get(f"{BASE_URL}{endpoint}", timeout=10)
        elapsed = time.time() - start
        
        result = {
            "endpoint": endpoint,
            "status": response.status_code,
            "elapsed": elapsed,
            "error": None
        }
        
        # Check for 500 errors
        if response.status_code == 500:
            result["error"] = f"500 Internal Server Error: {response.text[:200]}"
        
        # Check for the specific race condition error
        if response.status_code == 500 or "Cannot read properties of undefined" in response.text:
            result["error"] = f"Race condition error detected: {response.text[:200]}"
        
        # Check response is valid JSON array
        if response.status_code == 200:
            try:
                data = response.json()
                if not isinstance(data, list):
                    result["error"] = f"Expected array, got {type(data)}"
            except:
                result["error"] = "Invalid JSON response"
        
        return result
    except Exception as e:
        return {
            "endpoint": endpoint,
            "status": 0,
            "elapsed": 0,
            "error": str(e)
        }

# Run concurrent requests (20 parallel requests)
concurrent_results = []
with concurrent.futures.ThreadPoolExecutor(max_workers=20) as executor:
    # Submit all requests at once
    futures = []
    for _ in range(2):  # Do 2 rounds to get ~20 requests
        for endpoint in concurrent_endpoints[:10]:  # Use first 10 endpoints
            futures.append(executor.submit(fetch_endpoint, endpoint))
    
    # Collect results
    for future in concurrent.futures.as_completed(futures):
        concurrent_results.append(future.result())

# Analyze results
print(f"\nCompleted {len(concurrent_results)} concurrent requests")
print("-" * 80)

errors_500 = []
race_errors = []
other_errors = []
success_count = 0

for result in concurrent_results:
    if result["status"] == 200:
        success_count += 1
        print(f"✓ {result['endpoint']}: {result['status']} ({result['elapsed']:.3f}s)")
    else:
        print(f"✗ {result['endpoint']}: {result['status']} - {result['error']}")
        
        if result["status"] == 500:
            errors_500.append(result)
        if result["error"] and "Cannot read properties of undefined" in result["error"]:
            race_errors.append(result)
        elif result["error"]:
            other_errors.append(result)

print("\n" + "=" * 80)
print("CONCURRENCY TEST RESULTS")
print("=" * 80)
print(f"Total requests: {len(concurrent_results)}")
print(f"Successful (200): {success_count}")
print(f"500 errors: {len(errors_500)}")
print(f"Race condition errors: {len(race_errors)}")
print(f"Other errors: {len(other_errors)}")

if len(errors_500) == 0 and len(race_errors) == 0:
    log_pass("CONCURRENCY CHECK - ZERO 500 errors and NO race condition errors")
    print("✅ MongoDB connection race fix is working correctly!")
else:
    if len(errors_500) > 0:
        log_fail("CONCURRENCY CHECK - 500 errors", f"Found {len(errors_500)} 500 errors")
        for err in errors_500[:3]:  # Show first 3
            print(f"   {err['endpoint']}: {err['error']}")
    if len(race_errors) > 0:
        log_fail("CONCURRENCY CHECK - race condition", f"Found {len(race_errors)} race condition errors")
        for err in race_errors[:3]:  # Show first 3
            print(f"   {err['endpoint']}: {err['error']}")

# ============================================================================
# PRIORITY 3: List GET endpoints (sequential for detailed checks)
# ============================================================================
print("\n[3] Testing List GET endpoints (sequential for detailed validation)")
print("-" * 80)

list_endpoints = [
    "/companies", "/buyers", "/sellers", "/warehouses", "/materials",
    "/demands", "/pools", "/auctions", "/orders", "/inventory",
    "/shipments", "/inspections", "/settlements", "/disputes",
    "/notifications", "/action-queue", "/opportunities"
]

# Store IDs for detail tests
stored_ids = {}

for endpoint in list_endpoints:
    try:
        response = requests.get(f"{BASE_URL}{endpoint}", timeout=10)
        
        if response.status_code == 200:
            data = response.json()
            
            if isinstance(data, list):
                print(f"✓ GET {endpoint}: {len(data)} items")
                
                # Check no _id
                if check_no_mongo_id(data, f"GET {endpoint}"):
                    log_pass(f"GET {endpoint} - no _id fields")
                
                # Store first ID for detail tests
                if len(data) > 0 and "id" in data[0]:
                    key = endpoint.strip("/")
                    stored_ids[key] = data[0]["id"]
                    
                    # Special handling for pools (need for quotes test)
                    if endpoint == "/pools" and len(data) > 0:
                        stored_ids["pool_id"] = data[0]["id"]
                    
                    # Store order in SUPPLIER_DISPATCHED state for state machine test
                    if endpoint == "/orders":
                        for order in data:
                            if order.get("state") == "SUPPLIER_DISPATCHED":
                                stored_ids["order_supplier_dispatched"] = order["id"]
                                stored_ids["inbound_shipment_id"] = order.get("inbound_shipment_id")
                                stored_ids["lot_id"] = order.get("lot_id")
                                print(f"   Found order {order.get('order_no')} in SUPPLIER_DISPATCHED state")
                                break
                        # Also find another order for FAIL test
                        for order in data:
                            if order.get("state") in ["HUB_RECEIVED", "QC_PENDING"] and order["id"] != stored_ids.get("order_supplier_dispatched"):
                                stored_ids["order_for_fail"] = order["id"]
                                stored_ids["lot_id_fail"] = order.get("lot_id")
                                print(f"   Found order {order.get('order_no')} for FAIL test")
                                break
                    
                    # Store warehouse code
                    if endpoint == "/warehouses" and len(data) > 0:
                        stored_ids["warehouse_code"] = data[0].get("code", "WH01")
            else:
                log_fail(f"GET {endpoint}", f"Expected array, got {type(data)}")
        else:
            log_fail(f"GET {endpoint}", f"Status {response.status_code}")
            
    except Exception as e:
        log_fail(f"GET {endpoint}", str(e))

# Test filtered endpoints
print("\nTesting filtered endpoints...")

# /shipments?direction=inbound
try:
    response = requests.get(f"{BASE_URL}/shipments?direction=inbound", timeout=10)
    if response.status_code == 200:
        data = response.json()
        if all(s.get("direction") == "inbound" for s in data):
            log_pass("GET /shipments?direction=inbound - filter works")
        else:
            log_fail("GET /shipments?direction=inbound", "Filter not working correctly")
    else:
        log_fail("GET /shipments?direction=inbound", f"Status {response.status_code}")
except Exception as e:
    log_fail("GET /shipments?direction=inbound", str(e))

# /shipments?direction=outbound
try:
    response = requests.get(f"{BASE_URL}/shipments?direction=outbound", timeout=10)
    if response.status_code == 200:
        data = response.json()
        if all(s.get("direction") == "outbound" for s in data):
            log_pass("GET /shipments?direction=outbound - filter works")
        else:
            log_fail("GET /shipments?direction=outbound", "Filter not working correctly")
    else:
        log_fail("GET /shipments?direction=outbound", f"Status {response.status_code}")
except Exception as e:
    log_fail("GET /shipments?direction=outbound", str(e))

# /notifications?role=BUYER
try:
    response = requests.get(f"{BASE_URL}/notifications?role=BUYER", timeout=10)
    if response.status_code == 200:
        data = response.json()
        if all(n.get("role") == "BUYER" for n in data):
            log_pass("GET /notifications?role=BUYER - filter works")
        else:
            log_fail("GET /notifications?role=BUYER", "Filter not working correctly")
    else:
        log_fail("GET /notifications?role=BUYER", f"Status {response.status_code}")
except Exception as e:
    log_fail("GET /notifications?role=BUYER", str(e))

# ============================================================================
# PRIORITY 4: Detail GET endpoints
# ============================================================================
print("\n[4] Testing Detail GET endpoints")
print("-" * 80)

# GET /pools/:id
if "pool_id" in stored_ids:
    try:
        response = requests.get(f"{BASE_URL}/pools/{stored_ids['pool_id']}", timeout=10)
        if response.status_code == 200:
            data = response.json()
            if check_no_mongo_id(data, "GET /pools/:id"):
                log_pass("GET /pools/:id")
        else:
            log_fail("GET /pools/:id", f"Status {response.status_code}")
    except Exception as e:
        log_fail("GET /pools/:id", str(e))

# GET /quotes/:poolId
if "pool_id" in stored_ids:
    try:
        response = requests.get(f"{BASE_URL}/quotes/{stored_ids['pool_id']}", timeout=10)
        if response.status_code == 200:
            data = response.json()
            if isinstance(data, list) and check_no_mongo_id(data, "GET /quotes/:poolId"):
                log_pass("GET /quotes/:poolId")
        else:
            log_fail("GET /quotes/:poolId", f"Status {response.status_code}")
    except Exception as e:
        log_fail("GET /quotes/:poolId", str(e))

# GET /orders/:id (with joined objects)
if "orders" in stored_ids:
    try:
        response = requests.get(f"{BASE_URL}/orders/{stored_ids['orders']}", timeout=10)
        if response.status_code == 200:
            data = response.json()
            
            # Check for joined objects
            has_lot = "lot" in data
            has_inbound = "inbound" in data
            has_outbound = "outbound" in data
            has_settlement = "settlement" in data
            
            if has_lot and has_inbound and has_outbound and has_settlement:
                if check_no_mongo_id(data, "GET /orders/:id"):
                    log_pass("GET /orders/:id - with joined objects")
            else:
                log_fail("GET /orders/:id", f"Missing joined objects: lot={has_lot}, inbound={has_inbound}, outbound={has_outbound}, settlement={has_settlement}")
        else:
            log_fail("GET /orders/:id", f"Status {response.status_code}")
    except Exception as e:
        log_fail("GET /orders/:id", str(e))

# GET /auctions/:id
if "auctions" in stored_ids:
    try:
        response = requests.get(f"{BASE_URL}/auctions/{stored_ids['auctions']}", timeout=10)
        if response.status_code == 200:
            data = response.json()
            if check_no_mongo_id(data, "GET /auctions/:id"):
                log_pass("GET /auctions/:id")
        else:
            log_fail("GET /auctions/:id", f"Status {response.status_code}")
    except Exception as e:
        log_fail("GET /auctions/:id", str(e))

# GET /shipments/:id
if "shipments" in stored_ids:
    try:
        response = requests.get(f"{BASE_URL}/shipments/{stored_ids['shipments']}", timeout=10)
        if response.status_code == 200:
            data = response.json()
            if check_no_mongo_id(data, "GET /shipments/:id"):
                log_pass("GET /shipments/:id")
        else:
            log_fail("GET /shipments/:id", f"Status {response.status_code}")
    except Exception as e:
        log_fail("GET /shipments/:id", str(e))

# GET /warehouses/:code
if "warehouse_code" in stored_ids:
    try:
        response = requests.get(f"{BASE_URL}/warehouses/{stored_ids['warehouse_code']}", timeout=10)
        if response.status_code == 200:
            data = response.json()
            if check_no_mongo_id(data, "GET /warehouses/:code"):
                log_pass("GET /warehouses/:code")
        else:
            log_fail("GET /warehouses/:code", f"Status {response.status_code}")
    except Exception as e:
        log_fail("GET /warehouses/:code", str(e))

# ============================================================================
# PRIORITY 5: POST /api/demands (with new fields from redesigned form)
# ============================================================================
print("\n[5] Testing POST /api/demands (with new fields)")
print("-" * 80)

try:
    demand_payload = {
        "material": "PP Grade X",
        "category": "Polymers",
        "grade": "A",
        "brand": "Reliance",
        "application": "Injection molding for automotive components",
        "quantity": 5,
        "unit": "tonnes",
        "required_date": "2025-07-15",
        "cluster": "Peenya, Bengaluru",
        "delivery_pref": "Hub pickup",
        "target_price": 85,
        "spec": "MFI: 10-12 g/10min, Density: 0.905 g/cm³, Tensile strength: 32 MPa"  # spec as STRING
    }
    
    response = requests.post(f"{BASE_URL}/demands", json=demand_payload, timeout=10)
    print(f"Status: {response.status_code}")
    
    if response.status_code == 200:
        data = response.json()
        print(f"Response: {json.dumps(data, indent=2)}")
        
        # Check demand_no format
        demand_no = data.get("demand_no", "")
        if demand_no.startswith("DEM-") and len(demand_no) > 4:
            log_pass("POST /api/demands - demand_no format correct (DEM-####)")
        else:
            log_fail("POST /api/demands - demand_no", f"Invalid format: {demand_no}")
        
        # Check status
        if data.get("status") == "Matching":
            log_pass("POST /api/demands - status is Matching")
        else:
            log_fail("POST /api/demands - status", f"Expected 'Matching', got '{data.get('status')}'")
        
        # Check UUID id exists
        if data.get("id") and len(data.get("id")) > 10:
            log_pass("POST /api/demands - UUID id present")
        else:
            log_fail("POST /api/demands - id", "UUID id missing or invalid")
        
        # Check no _id
        if check_no_mongo_id(data, "POST /api/demands"):
            log_pass("POST /api/demands - no _id field")
            
    else:
        log_fail("POST /api/demands", f"Status {response.status_code}: {response.text}")
        
except Exception as e:
    log_fail("POST /api/demands", str(e))

# ============================================================================
# PRIORITY 6: POST /api/auctions/:id/bid
# ============================================================================
print("\n[6] Testing POST /api/auctions/:id/bid")
print("-" * 80)

if "auctions" in stored_ids:
    try:
        # Get current auction state
        response = requests.get(f"{BASE_URL}/auctions/{stored_ids['auctions']}", timeout=10)
        if response.status_code == 200:
            auction_before = response.json()
            current_bid = auction_before.get("current_bid", 80)
            new_bid = current_bid - 2
            
            print(f"Current bid: {current_bid}, placing bid: {new_bid}")
            
            # Place bid
            bid_payload = {"bid": new_bid}
            response = requests.post(f"{BASE_URL}/auctions/{stored_ids['auctions']}/bid", json=bid_payload, timeout=10)
            
            if response.status_code == 200:
                auction_after = response.json()
                print(f"Response: {json.dumps(auction_after, indent=2)}")
                
                # Check your_bid updated
                if auction_after.get("your_bid") == new_bid:
                    log_pass("POST /api/auctions/:id/bid - your_bid updated")
                else:
                    log_fail("POST /api/auctions/:id/bid - your_bid", f"Expected {new_bid}, got {auction_after.get('your_bid')}")
                
                # Check rank is 1
                if auction_after.get("your_rank") == 1:
                    log_pass("POST /api/auctions/:id/bid - rank is #1")
                else:
                    log_fail("POST /api/auctions/:id/bid - rank", f"Expected 1, got {auction_after.get('your_rank')}")
                
                # Check new bid prepended to bids array
                bids = auction_after.get("bids", [])
                if len(bids) > 0 and bids[0].get("bid") == new_bid:
                    log_pass("POST /api/auctions/:id/bid - bid prepended to history")
                else:
                    log_fail("POST /api/auctions/:id/bid - bid history", "New bid not prepended")
            else:
                log_fail("POST /api/auctions/:id/bid", f"Status {response.status_code}")
        else:
            log_fail("POST /api/auctions/:id/bid", "Could not get auction state")
            
    except Exception as e:
        log_fail("POST /api/auctions/:id/bid", str(e))
else:
    log_warning("POST /api/auctions/:id/bid", "No auction ID available")

# ============================================================================
# PRIORITY 7: CRITICAL - Connected order state machine
# ============================================================================
print("\n[7] Testing CRITICAL Connected Order State Machine")
print("=" * 80)

# Re-seed to reset state
print("\nRe-seeding database to reset state...")
try:
    requests.post(f"{BASE_URL}/seed", timeout=30)
    print("✓ Database re-seeded")
except Exception as e:
    print(f"✗ Failed to re-seed: {e}")

# Get fresh order list
print("\nFetching fresh order list...")
try:
    response = requests.get(f"{BASE_URL}/orders", timeout=10)
    if response.status_code == 200:
        orders = response.json()
        
        # Find order in SUPPLIER_DISPATCHED state (CB-1042)
        test_order = None
        for order in orders:
            if order.get("order_no") == "CB-1042" and order.get("state") == "SUPPLIER_DISPATCHED":
                test_order = order
                break
        
        if not test_order:
            log_fail("State machine test", "Could not find order CB-1042 in SUPPLIER_DISPATCHED state")
        else:
            order_id = test_order["id"]
            inbound_id = test_order["inbound_shipment_id"]
            lot_id = test_order["lot_id"]
            order_no = test_order["order_no"]
            
            print(f"\n✓ Found test order: {order_no}")
            print(f"  Order ID: {order_id}")
            print(f"  Inbound shipment ID: {inbound_id}")
            print(f"  Lot ID: {lot_id}")
            print(f"  Initial state: {test_order['state']}")
            
            # ================================================================
            # Step A: POST /api/inbound/{inbound_shipment_id}/receive
            # ================================================================
            print("\n[7a] POST /api/inbound/{id}/receive")
            print("-" * 80)
            
            try:
                receive_payload = {"received_qty": test_order["quantity"]}
                response = requests.post(f"{BASE_URL}/inbound/{inbound_id}/receive", json=receive_payload, timeout=10)
                
                if response.status_code == 200:
                    print("✓ Receive API call successful")
                    
                    # Get updated order
                    response = requests.get(f"{BASE_URL}/orders/{order_id}", timeout=10)
                    if response.status_code == 200:
                        order_data = response.json()
                        
                        # Check order state
                        if order_data.get("state") == "QC_PENDING":
                            log_pass("Inbound receive - order state = QC_PENDING")
                        else:
                            log_fail("Inbound receive - order state", f"Expected QC_PENDING, got {order_data.get('state')}")
                        
                        # Check lot status
                        lot = order_data.get("lot", {})
                        if lot.get("status") == "QC pending":
                            log_pass("Inbound receive - lot status = QC pending")
                        else:
                            log_fail("Inbound receive - lot status", f"Expected 'QC pending', got '{lot.get('status')}'")
                        
                        # Check inspection status (via separate query)
                        response = requests.get(f"{BASE_URL}/inspections", timeout=10)
                        if response.status_code == 200:
                            inspections = response.json()
                            insp = next((i for i in inspections if i.get("lot_id") == lot_id), None)
                            if insp and insp.get("status") == "Pending":
                                log_pass("Inbound receive - inspection status = Pending")
                            else:
                                log_fail("Inbound receive - inspection", f"Expected Pending, got {insp.get('status') if insp else 'not found'}")
                    else:
                        log_fail("Inbound receive", "Could not fetch updated order")
                else:
                    log_fail("POST /api/inbound/{id}/receive", f"Status {response.status_code}")
                    
            except Exception as e:
                log_fail("POST /api/inbound/{id}/receive", str(e))
            
            # ================================================================
            # Step B: POST /api/quality/{lot_id}/decision {"decision":"PASS"}
            # ================================================================
            print("\n[7b] POST /api/quality/{lot_id}/decision (PASS)")
            print("-" * 80)
            
            try:
                qc_payload = {"decision": "PASS"}
                response = requests.post(f"{BASE_URL}/quality/{lot_id}/decision", json=qc_payload, timeout=10)
                
                if response.status_code == 200:
                    print("✓ QC PASS API call successful")
                    
                    # Get updated order
                    response = requests.get(f"{BASE_URL}/orders/{order_id}", timeout=10)
                    if response.status_code == 200:
                        order_data = response.json()
                        
                        # Check order state
                        if order_data.get("state") == "QC_PASSED":
                            log_pass("QC PASS - order state = QC_PASSED")
                        else:
                            log_fail("QC PASS - order state", f"Expected QC_PASSED, got {order_data.get('state')}")
                        
                        # Check lot status
                        lot = order_data.get("lot", {})
                        if lot.get("status") == "Available":
                            log_pass("QC PASS - lot status = Available")
                        else:
                            log_fail("QC PASS - lot status", f"Expected 'Available', got '{lot.get('status')}'")
                    else:
                        log_fail("QC PASS", "Could not fetch updated order")
                else:
                    log_fail("POST /api/quality/{lot_id}/decision (PASS)", f"Status {response.status_code}")
                    
            except Exception as e:
                log_fail("POST /api/quality/{lot_id}/decision (PASS)", str(e))
            
            # ================================================================
            # Step C: POST /api/orders/{id}/advance {"target":"ALLOCATED"}
            # ================================================================
            print("\n[7c] POST /api/orders/{id}/advance (ALLOCATED)")
            print("-" * 80)
            
            try:
                advance_payload = {"target": "ALLOCATED"}
                response = requests.post(f"{BASE_URL}/orders/{order_id}/advance", json=advance_payload, timeout=10)
                
                if response.status_code == 200:
                    print("✓ Advance to ALLOCATED successful")
                    
                    # Get updated order
                    response = requests.get(f"{BASE_URL}/orders/{order_id}", timeout=10)
                    if response.status_code == 200:
                        order_data = response.json()
                        lot = order_data.get("lot", {})
                        
                        if lot.get("status") == "Allocated":
                            log_pass("Advance ALLOCATED - lot status = Allocated")
                        else:
                            log_fail("Advance ALLOCATED - lot status", f"Expected 'Allocated', got '{lot.get('status')}'")
                    else:
                        log_fail("Advance ALLOCATED", "Could not fetch updated order")
                else:
                    log_fail("POST /api/orders/{id}/advance (ALLOCATED)", f"Status {response.status_code}")
                    
            except Exception as e:
                log_fail("POST /api/orders/{id}/advance (ALLOCATED)", str(e))
            
            # ================================================================
            # Step D: POST /api/orders/{id}/advance {"target":"OUTBOUND_DISPATCHED"}
            # ================================================================
            print("\n[7d] POST /api/orders/{id}/advance (OUTBOUND_DISPATCHED)")
            print("-" * 80)
            
            try:
                advance_payload = {"target": "OUTBOUND_DISPATCHED"}
                response = requests.post(f"{BASE_URL}/orders/{order_id}/advance", json=advance_payload, timeout=10)
                
                if response.status_code == 200:
                    print("✓ Advance to OUTBOUND_DISPATCHED successful")
                    
                    # Get updated order
                    response = requests.get(f"{BASE_URL}/orders/{order_id}", timeout=10)
                    if response.status_code == 200:
                        order_data = response.json()
                        outbound = order_data.get("outbound", {})
                        
                        if outbound.get("status") == "Dispatched":
                            log_pass("Advance OUTBOUND_DISPATCHED - outbound status = Dispatched")
                        else:
                            log_fail("Advance OUTBOUND_DISPATCHED - outbound status", f"Expected 'Dispatched', got '{outbound.get('status')}'")
                    else:
                        log_fail("Advance OUTBOUND_DISPATCHED", "Could not fetch updated order")
                else:
                    log_fail("POST /api/orders/{id}/advance (OUTBOUND_DISPATCHED)", f"Status {response.status_code}")
                    
            except Exception as e:
                log_fail("POST /api/orders/{id}/advance (OUTBOUND_DISPATCHED)", str(e))
            
            # ================================================================
            # Step E: POST /api/orders/{id}/advance {"target":"DELIVERED"}
            # ================================================================
            print("\n[7e] POST /api/orders/{id}/advance (DELIVERED)")
            print("-" * 80)
            
            try:
                advance_payload = {"target": "DELIVERED"}
                response = requests.post(f"{BASE_URL}/orders/{order_id}/advance", json=advance_payload, timeout=10)
                
                if response.status_code == 200:
                    print("✓ Advance to DELIVERED successful")
                    
                    # Get updated order
                    response = requests.get(f"{BASE_URL}/orders/{order_id}", timeout=10)
                    if response.status_code == 200:
                        order_data = response.json()
                        outbound = order_data.get("outbound", {})
                        
                        if outbound.get("status") == "Delivered":
                            log_pass("Advance DELIVERED - outbound status = Delivered")
                        else:
                            log_fail("Advance DELIVERED - outbound status", f"Expected 'Delivered', got '{outbound.get('status')}'")
                        
                        if outbound.get("pod") == True:
                            log_pass("Advance DELIVERED - outbound pod = true")
                        else:
                            log_fail("Advance DELIVERED - outbound pod", f"Expected true, got {outbound.get('pod')}")
                    else:
                        log_fail("Advance DELIVERED", "Could not fetch updated order")
                else:
                    log_fail("POST /api/orders/{id}/advance (DELIVERED)", f"Status {response.status_code}")
                    
            except Exception as e:
                log_fail("POST /api/orders/{id}/advance (DELIVERED)", str(e))
            
            # ================================================================
            # Step F: POST /api/orders/{id}/advance {"target":"ACCEPTED"}
            # ================================================================
            print("\n[7f] POST /api/orders/{id}/advance (ACCEPTED)")
            print("-" * 80)
            
            try:
                advance_payload = {"target": "ACCEPTED"}
                response = requests.post(f"{BASE_URL}/orders/{order_id}/advance", json=advance_payload, timeout=10)
                
                if response.status_code == 200:
                    print("✓ Advance to ACCEPTED successful")
                    
                    # Get updated order
                    response = requests.get(f"{BASE_URL}/orders/{order_id}", timeout=10)
                    if response.status_code == 200:
                        order_data = response.json()
                        settlement = order_data.get("settlement", {})
                        
                        if settlement.get("status") == "Approved":
                            log_pass("Advance ACCEPTED - settlement status = Approved")
                        else:
                            log_fail("Advance ACCEPTED - settlement status", f"Expected 'Approved', got '{settlement.get('status')}'")
                    else:
                        log_fail("Advance ACCEPTED", "Could not fetch updated order")
                else:
                    log_fail("POST /api/orders/{id}/advance (ACCEPTED)", f"Status {response.status_code}")
                    
            except Exception as e:
                log_fail("POST /api/orders/{id}/advance (ACCEPTED)", str(e))
            
            # ================================================================
            # FAIL PATH: Test QC FAIL on a different order
            # ================================================================
            print("\n[7g] Testing QC FAIL path (creates dispute)")
            print("-" * 80)
            
            # Find another order for FAIL test
            fail_order = None
            for order in orders:
                if order.get("state") in ["HUB_RECEIVED", "QC_PENDING"] and order["id"] != order_id:
                    fail_order = order
                    break
            
            if fail_order:
                fail_lot_id = fail_order["lot_id"]
                fail_order_id = fail_order["id"]
                
                # Get disputes count before
                response = requests.get(f"{BASE_URL}/disputes", timeout=10)
                disputes_before = len(response.json()) if response.status_code == 200 else 0
                
                try:
                    qc_fail_payload = {"decision": "FAIL"}
                    response = requests.post(f"{BASE_URL}/quality/{fail_lot_id}/decision", json=qc_fail_payload, timeout=10)
                    
                    if response.status_code == 200:
                        print("✓ QC FAIL API call successful")
                        
                        # Get updated order
                        response = requests.get(f"{BASE_URL}/orders/{fail_order_id}", timeout=10)
                        if response.status_code == 200:
                            order_data = response.json()
                            
                            # Check order state
                            if order_data.get("state") == "QC_FAILED":
                                log_pass("QC FAIL - order state = QC_FAILED")
                            else:
                                log_fail("QC FAIL - order state", f"Expected QC_FAILED, got {order_data.get('state')}")
                            
                            # Check lot status
                            lot = order_data.get("lot", {})
                            if lot.get("status") == "Quality hold":
                                log_pass("QC FAIL - lot status = Quality hold")
                            else:
                                log_fail("QC FAIL - lot status", f"Expected 'Quality hold', got '{lot.get('status')}'")
                            
                            # Check disputes count increased
                            response = requests.get(f"{BASE_URL}/disputes", timeout=10)
                            if response.status_code == 200:
                                disputes_after = len(response.json())
                                if disputes_after > disputes_before:
                                    log_pass("QC FAIL - new dispute created")
                                else:
                                    log_fail("QC FAIL - dispute creation", f"Disputes count did not increase: {disputes_before} -> {disputes_after}")
                        else:
                            log_fail("QC FAIL", "Could not fetch updated order")
                    else:
                        log_fail("POST /api/quality/{lot_id}/decision (FAIL)", f"Status {response.status_code}")
                        
                except Exception as e:
                    log_fail("POST /api/quality/{lot_id}/decision (FAIL)", str(e))
            else:
                log_warning("QC FAIL test", "No suitable order found for FAIL test")
                
    else:
        log_fail("State machine test", f"Could not fetch orders: {response.status_code}")
        
except Exception as e:
    log_fail("State machine test", str(e))

# ============================================================================
# PRIORITY 8: AUTH endpoints
# ============================================================================
print("\n[8] Testing AUTH endpoints")
print("=" * 80)

# GET /api/auth/me with no cookie (should return 401)
print("\n[8a] GET /api/auth/me (no cookie)")
print("-" * 80)
try:
    response = requests.get(f"{BASE_URL}/auth/me", timeout=10)
    if response.status_code == 401:
        data = response.json()
        if data.get("user") is None:
            log_pass("GET /api/auth/me (no cookie) - returns 401 with user:null")
        else:
            log_fail("GET /api/auth/me (no cookie)", f"Expected user:null, got {data}")
    else:
        log_fail("GET /api/auth/me (no cookie)", f"Expected 401, got {response.status_code}")
except Exception as e:
    log_fail("GET /api/auth/me (no cookie)", str(e))

# POST /api/auth/session with no session_id (should return 400)
print("\n[8b] POST /api/auth/session (no session_id)")
print("-" * 80)
try:
    response = requests.post(f"{BASE_URL}/auth/session", json={}, timeout=10)
    if response.status_code == 400:
        log_pass("POST /api/auth/session (no session_id) - returns 400")
    else:
        log_fail("POST /api/auth/session (no session_id)", f"Expected 400, got {response.status_code}")
except Exception as e:
    log_fail("POST /api/auth/session (no session_id)", str(e))

# POST /api/auth/session with bogus session_id (should return 401)
print("\n[8c] POST /api/auth/session (bogus session_id)")
print("-" * 80)
try:
    response = requests.post(f"{BASE_URL}/auth/session", headers={"X-Session-ID": "bogus-invalid-session"}, timeout=10)
    if response.status_code == 401:
        log_pass("POST /api/auth/session (bogus session_id) - returns 401")
    else:
        log_fail("POST /api/auth/session (bogus session_id)", f"Expected 401, got {response.status_code}")
except Exception as e:
    log_fail("POST /api/auth/session (bogus session_id)", str(e))

# Optional: Create a test session directly in MongoDB and verify /auth/me
print("\n[8d] Optional: Testing with valid session (direct MongoDB insert)")
print("-" * 80)
try:
    client = MongoClient(MONGO_URL)
    db = client[DB_NAME]
    
    # Create test user
    test_user = {
        "id": "test-user-123",
        "name": "Test User",
        "email": "test@example.com",
        "picture": "",
        "mobile": "",
        "role": "BUYER",
        "company_id": None,
        "status": "Active",
        "permissions": ["all"],
        "created_at": datetime.now().isoformat(),
        "updated_at": datetime.now().isoformat()
    }
    
    # Create test session
    test_token = "test-session-token-123"
    test_session = {
        "id": "test-session-123",
        "session_token": test_token,
        "user_id": test_user["id"],
        "expires_at": (datetime.now() + timedelta(days=7)).isoformat(),
        "created_at": datetime.now().isoformat()
    }
    
    # Insert into MongoDB
    db.users.delete_one({"id": test_user["id"]})  # Clean up if exists
    db.sessions.delete_one({"session_token": test_token})  # Clean up if exists
    db.users.insert_one(test_user)
    db.sessions.insert_one(test_session)
    
    print(f"✓ Created test user and session in MongoDB")
    
    # Test with cookie
    response = requests.get(f"{BASE_URL}/auth/me", cookies={"session_token": test_token}, timeout=10)
    if response.status_code == 200:
        data = response.json()
        if data.get("user") and data["user"].get("id") == test_user["id"]:
            log_pass("GET /api/auth/me (valid session cookie) - returns user")
        else:
            log_fail("GET /api/auth/me (valid session)", f"User mismatch: {data}")
    else:
        log_fail("GET /api/auth/me (valid session)", f"Status {response.status_code}")
    
    # Test with bearer token
    response = requests.get(f"{BASE_URL}/auth/me", headers={"Authorization": f"Bearer {test_token}"}, timeout=10)
    if response.status_code == 200:
        data = response.json()
        if data.get("user") and data["user"].get("id") == test_user["id"]:
            log_pass("GET /api/auth/me (valid bearer token) - returns user")
        else:
            log_fail("GET /api/auth/me (bearer token)", f"User mismatch: {data}")
    else:
        log_fail("GET /api/auth/me (bearer token)", f"Status {response.status_code}")
    
    # Clean up
    db.users.delete_one({"id": test_user["id"]})
    db.sessions.delete_one({"session_token": test_token})
    client.close()
    
except Exception as e:
    log_warning("Auth with valid session", f"Could not test with MongoDB: {e}")

# ============================================================================
# SUMMARY
# ============================================================================
print("\n" + "=" * 80)
print("TEST SUMMARY")
print("=" * 80)

print(f"\n✅ PASSED: {len(test_results['passed'])} tests")
for test in test_results['passed']:
    print(f"   • {test}")

if test_results['failed']:
    print(f"\n❌ FAILED: {len(test_results['failed'])} tests")
    for item in test_results['failed']:
        print(f"   • {item['test']}")
        print(f"     Reason: {item['reason']}")

if test_results['warnings']:
    print(f"\n⚠️  WARNINGS: {len(test_results['warnings'])} items")
    for item in test_results['warnings']:
        print(f"   • {item['test']}: {item['message']}")

print("\n" + "=" * 80)
print(f"Completed at: {datetime.now().isoformat()}")
print("=" * 80)

# Exit with appropriate code
sys.exit(0 if len(test_results['failed']) == 0 else 1)
