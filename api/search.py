from http.server import BaseHTTPRequestHandler
import json
import urllib.parse
import urllib.request
import re
from datetime import datetime, timezone

class handler(BaseHTTPRequestHandler):
    def do_GET(self):
        parsed_path = urllib.parse.urlparse(self.path)
        query_params = urllib.parse.parse_qs(parsed_path.query)
        
        query = query_params.get('query', [''])[0].strip()
        match_type = query_params.get('type', ['last'])[0]
        date_from = query_params.get('from', ['']).strip()
        date_to = query_params.get('to', ['']).strip()
        
        # Base API URL matching documentation
        API_BASE = "http://187.53.137.91/ints/api/v1/messages"
        token = "k4d22pFq-__0TkbB3Vg_Dy2X1mh3bEiDz_A3PhAh6zQ"
        
        # Default to current UTC date if dates are not provided
        today_iso = datetime.now(timezone.utc).strftime('%Y-%m-%d')
        f_date = date_from if date_from else f"{today_iso}T00:00:00Z"
        t_date = date_to if date_to else f"{today_iso}T23:59:59Z"
        
        api_url = f"{API_BASE}?token={token}&limit=1000&from={urllib.parse.quote(f_date)}&to={urllib.parse.quote(t_date)}"
        
        try:
            req = urllib.request.Request(api_url, headers={'User-Agent': 'Mozilla/5.0'})
            with urllib.request.urlopen(req, timeout=10) as response:
                raw_data = json.loads(response.read().decode('utf-8'))
                
            messages_list = []
            if isinstance(raw_data, dict):
                messages_list = raw_data.get('records') or raw_data.get('messages') or raw_data.get('data') or []
            elif isinstance(raw_data, list):
                messages_list = raw_data
                
            filtered_messages = []
            for item in messages_list:
                number = str(item.get('number') or item.get('destination') or item.get('to') or '')
                cli = str(item.get('cli') or item.get('sender') or item.get('from') or '')
                text = str(item.get('content') or item.get('text') or item.get('message') or '')
                time_val = str(item.get('time') or item.get('created_at') or '')
                
                clean_number = number.strip()
                
                matched = False
                if query:
                    if match_type == 'exact':
                        if clean_number == query or clean_number.endswith(query):
                            matched = True
                    else:
                        if clean_number.endswith(query):
                            matched = True
                else:
                    # If no query is provided, return all messages fetched for the date range
                    matched = True
                        
                if matched:
                    # Extract OTP (4 to 8 digit numbers) safely from content
                    otp_match = re.search(r'\b\d{4,8}\b', text)
                    otp_code = otp_match.group(0) if otp_match else "N/A"
                    
                    filtered_messages.append({
                        "number": clean_number,
                        "cli": cli,
                        "text": text,
                        "otp": otp_code,
                        "time": time_val
                    })
                    
            response_data = {"success": True, "messages": filtered_messages, "total_fetched": len(messages_list)}
            self.send_response(200)
            self.send_header('Content-type', 'application/json')
            self.end_headers()
            self.wfile.write(json.dumps(response_data).encode('utf-8'))
            
        except Exception as e:
            error_data = {"success": False, "messages": [], "error": str(e)}
            self.send_response(500)
            self.send_header('Content-type', 'application/json')
            self.end_headers()
            self.wfile.write(json.dumps(error_data).encode('utf-8'))
