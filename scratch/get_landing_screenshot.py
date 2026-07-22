import os
import subprocess
import time
import json
import socket
import urllib.request
import base64

def ws_send(s, msg):
    payload = json.dumps(msg).encode()
    length = len(payload)
    frame = bytearray([0x81])
    if length < 126:
        frame.append(0x80 | length)
    else:
        frame.append(0x80 | 126)
        frame.append((length >> 8) & 0xff)
        frame.append(length & 0xff)
    mask_key = b"\x01\x02\x03\x04"
    frame.extend(mask_key)
    masked_payload = bytearray()
    for i, b in enumerate(payload):
        masked_payload.append(b ^ mask_key[i % 4])
    frame.extend(masked_payload)
    s.send(frame)

def ws_recv(s, timeout=1.0):
    try:
        s.settimeout(timeout)
        data = s.recv(1024 * 1024 * 10)
        return data
    except Exception:
        return b""

def main():
    chrome_path = r"C:\Program Files\Google\Chrome\Application\chrome.exe"
    temp_profile_dir = r"C:\Users\HP\.gemini\antigravity\brain\9b6ad162-6b2a-41a4-9f90-3da011a64096\scratch\chrome_temp_profile20"
    screenshot_path = r"C:\Users\HP\.gemini\antigravity\brain\9b6ad162-6b2a-41a4-9f90-3da011a64096\landing_screenshot.png"
    
    process = subprocess.Popen([
        chrome_path,
        "--headless",
        "--disable-gpu",
        "--remote-debugging-port=9222",
        f"--user-data-dir={temp_profile_dir}",
        "http://localhost:5173/"
    ])
    
    time.sleep(3)
    
    try:
        req = urllib.request.urlopen("http://127.0.0.1:9222/json/list")
        targets = json.loads(req.read().decode())
        ws_url = None
        for target in targets:
            if target.get("type") == "page" and "localhost" in target.get("url"):
                ws_url = target.get("webSocketDebuggerUrl")
                break
                
        if not ws_url:
            print("No localhost page target found.")
            return

        path = ws_url.split("9222")[1]
        s = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
        s.connect(("127.0.0.1", 9222))

        # Handshake
        handshake = (
            f"GET {path} HTTP/1.1\r\n"
            "Host: 127.0.0.1:9222\r\n"
            "Upgrade: websocket\r\n"
            "Connection: Upgrade\r\n"
            "Sec-WebSocket-Key: dGhlIHNhbXBsZSBub25jZQ==\r\n"
            "Sec-WebSocket-Version: 13\r\n\r\n"
        )
        s.send(handshake.encode())
        
        resp = b""
        while b"\r\n\r\n" not in resp:
            resp += s.recv(1024)

        # Enable domains
        ws_send(s, {"id": 1, "method": "Runtime.enable"})
        ws_send(s, {"id": 2, "method": "DOM.enable"})
        ws_send(s, {"id": 3, "method": "Page.enable"})
        time.sleep(2)
        
        print("Capturing screenshot...")
        ws_send(s, {"id": 6, "method": "Page.captureScreenshot"})
        
        raw_data = b""
        start_time = time.time()
        while time.time() - start_time < 5:
            chunk = ws_recv(s, timeout=1.0)
            if not chunk:
                break
            raw_data += chunk
            if b'"id":6' in raw_data and raw_data.strip().endswith(b'}'):
                break
        
        idx = raw_data.find(b'{"id":6')
        if idx != -1:
            brace_count = 0
            json_str = ""
            for char in raw_data[idx:].decode(errors="ignore"):
                json_str += char
                if char == '{':
                    brace_count += 1
                elif char == '}':
                    brace_count -= 1
                    if brace_count == 0:
                        break
            res = json.loads(json_str)
            b64_data = res.get("result", {}).get("data")
            if b64_data:
                with open(screenshot_path, "wb") as f:
                    f.write(base64.b64decode(b64_data))
                print(f"Saved screenshot to {screenshot_path}")
            else:
                print("Failed: data not found in screenshot response")
        else:
            print("Failed: ID 6 response not found in stream")
            
    except Exception as e:
        print("Error:", e)
    finally:
        process.terminate()
        try:
            process.wait(timeout=2)
        except:
            process.kill()

if __name__ == "__main__":
    main()
