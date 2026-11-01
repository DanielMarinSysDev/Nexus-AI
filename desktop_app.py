import threading
import time
import webview
from server import app

def start_server():
    app.run(host="127.0.0.1", port=5000, debug=False, use_reloader=False)

if __name__ == "__main__":
    server_thread = threading.Thread(target=start_server, daemon=True)
    server_thread.start()
    time.sleep(0.8)

    window = webview.create_window(
        title="NEXUS_CORE // AI Super-Resolution Studio",
        url="http://127.0.0.1:5000",
        width=1280,
        height=850,
        min_size=(960, 640),
        background_color="#050811"
    )
    webview.start()

