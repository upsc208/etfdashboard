import urllib.request
import json
import time
from datetime import datetime

def fetch_all_etfs():
    print(f"[{datetime.now().strftime('%Y-%m-%d %H:%M:%S')}] Starting full ETF fetch from Naver Securities API...")
    all_items = []
    page = 1
    total_count = None
    
    while True:
        url = f"https://stock.naver.com/api/stockSecurity/etfs/v2/domestic?listingType=aumDesc&size=100&index={page}"
        req = urllib.request.Request(url, headers={
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36',
            'Accept': 'application/json, text/plain, */*',
            'Referer': 'https://finance.naver.com/'
        })
        try:
            with urllib.request.urlopen(req, timeout=10) as resp:
                data = json.loads(resp.read().decode('utf-8'))
                items = data.get('items', [])
                if not items:
                    break
                total_count = int(data.get('totalCount', 0))
                all_items.extend(items)
                print(f"  Fetched page {page} ({len(items)} items, accumulated: {len(all_items)}/{total_count})")
                
                if not data.get('hasNext', False) or len(all_items) >= total_count:
                    break
                page += 1
                time.sleep(0.05)
        except Exception as e:
            print(f"  Error on page {page}: {e}")
            break
            
    payload = {
        'updatedAt': datetime.now().isoformat(),
        'totalCount': len(all_items),
        'items': all_items
    }
    
    import os
    if os.path.exists('data'):
        with open(os.path.join('data', 'data.json'), 'w', encoding='utf-8') as f:
            json.dump(payload, f, ensure_ascii=False, indent=2)
        print(f"Successfully saved {len(all_items)} ETF items to data/data.json")
    
    with open('data.json', 'w', encoding='utf-8') as f:
        json.dump(payload, f, ensure_ascii=False, indent=2)
    print(f"Successfully saved {len(all_items)} ETF items to data.json")
    return payload

if __name__ == '__main__':
    fetch_all_etfs()
