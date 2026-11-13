export default function MapDrawPage() {
  return (
    <div dangerouslySetInnerHTML={{ __html: `
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Draw Parcel</title>
    <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { font-family: Arial, sans-serif; background: #020305; }
        #map { width: 100vw; height: 100vh; }
        .controls { position: fixed; bottom: 20px; left: 50%; transform: translateX(-50%); z-index: 1000; display: flex; gap: 10px; }
        button { padding: 15px 25px; font-size: 16px; border: none; border-radius: 8px; cursor: pointer; font-weight: bold; }
        .btn-primary { background: #38BDF8; color: #000; }
        .btn-success { background: #10b981; color: #fff; }
        .btn-danger { background: #ef4444; color: #fff; }
        button:disabled { opacity: 0.5; }
        .info { position: fixed; top: 20px; left: 20px; right: 20px; background: rgba(10,15,22,0.95); padding: 15px; border-radius: 8px; z-index: 1000; max-width: 400px; color: #F4F7FB; }
    </style>
</head>
<body>
    <div id="map"></div>
    <div class="info" id="info">Tap "Start Drawing" to begin</div>
    <div class="controls">
        <button id="startBtn" class="btn-primary">Start Drawing</button>
        <button id="finishBtn" class="btn-success" style="display:none">Finish</button>
        <button id="cancelBtn" class="btn-danger" style="display:none">Cancel</button>
    </div>
    <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
    <script>
        const map = L.map('map').setView([9.0765, 7.3986], 13);
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png').addTo(map);
        let isDrawing = false, points = [], polygon = null;
        const startBtn = document.getElementById('startBtn');
        const finishBtn = document.getElementById('finishBtn');
        const cancelBtn = document.getElementById('cancelBtn');
        
        startBtn.addEventListener('click', () => {
            isDrawing = true;
            points = [];
            startBtn.style.display = 'none';
            finishBtn.style.display = 'block';
            cancelBtn.style.display = 'block';
            document.getElementById('info').textContent = 'Tap map to add points';
        });
        
        cancelBtn.addEventListener('click', () => {
            isDrawing = false;
            points = [];
            if (polygon) map.removeLayer(polygon);
            startBtn.style.display = 'block';
            finishBtn.style.display = 'none';
            cancelBtn.style.display = 'none';
        });
        
        finishBtn.addEventListener('click', () => {
            if (points.length < 3) return alert('Need 3+ points');
            const wkt = 'SRID=4326;POLYGON((' + points.map(p => p.lng + ' ' + p.lat).join(',') + ',' + points[0].lng + ' ' + points[0].lat + '))';
            alert('WKT: ' + wkt);
            window.opener?.postMessage({ wkt, coords: points }, '*');
        });
        
        map.on('click', (e) => {
            if (!isDrawing) return;
            points.push(e.latlng);
            if (polygon) map.removeLayer(polygon);
            if (points.length > 1) polygon = L.polygon(points, {color: '#3b82f6'}).addTo(map);
            finishBtn.disabled = points.length < 3;
        });
    </script>
</body>
</html>
    `}} />
  );
}