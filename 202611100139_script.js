
    document.addEventListener('DOMContentLoaded', function() {
        var mapObj = L.map('map', {
            center: [37.0, 137.0],
            zoom: 7,
            zoomSnap: 0.25,
            zoomDelta: 0.25
        });

        var paleLayer = L.tileLayer('https://cyberjapandata.gsi.go.jp/xyz/pale/{z}/{x}/{y}.png', {
            attribution: '国土地理院 (淡色地図)'
        }).addTo(mapObj);

        var stdLayer = L.tileLayer('https://cyberjapandata.gsi.go.jp/xyz/std/{z}/{x}/{y}.png', {
            attribution: '国土地理院 (標準地図)'
        });

        var afmLayer = L.tileLayer('https://cyberjapandata.gsi.go.jp/xyz/afm/{z}/{x}/{y}.png', {
            attribution: '国土地理院 (都市圏活断層図)', opacity: 0.7, maxZoom: 16
        });

        var blankLayer = L.tileLayer('https://cyberjapandata.gsi.go.jp/xyz/blank/{z}/{x}/{y}.png', {
            attribution: '国土地理院 (白地図)', className: 'multiply-blank-tile'
        }).addTo(mapObj);

        var meshGroup = L.layerGroup().addTo(mapObj);
        var numberGroup = L.layerGroup();

        L.control.layers({
            "淡色地図": paleLayer,
            "標準地図": stdLayer
        }, {
            "Zスコア比較メッシュ": meshGroup,
            "地震回数・Zスコアテキスト": numberGroup,
            "都市圏活断層図": afmLayer,
            "白地図 (境界線)": blankLayer
        }, { collapsed: false }).addTo(mapObj);

        window.earthquakeData = {};
        var textColors = {
            "激増": "#800000", "増加": "#804000", "微増": "#736100",
            "同等": "#333333", "微減": "#004080", "減少": "#000080",
            "激減": "#000055", "新規": "#4B0082"
        };

        fetch('202611100139_earthquake_data.json')
            .then(response => response.json())
            .then(data => {
                window.earthquakeData = data;
                
                Object.keys(data).forEach(meshKey => {
                    var row = data[meshKey];
                    var parts = meshKey.split('_');
                    var lat = parseFloat(parts[0]);
                    var lon = parseFloat(parts[1]);

                    var bounds = [[roundVal(lat - 0.05), roundVal(lon - 0.05)], [roundVal(lat + 0.05), roundVal(lon + 0.05)]];
                    var isWhite = row.color_hex === "#FFFFFF";

                    var rect = L.rectangle(bounds, {
                        stroke: isWhite,
                        color: isWhite ? "#CCCCCC" : null,
                        weight: 1,
                        fillColor: row.color_hex,
                        fillOpacity: 0.65,
                        className: "mesh-rectangle"
                    }).addTo(meshGroup);

                    rect.bindPopup('<div class="p-box" data-mesh="' + meshKey + '">データを読み込み中...</div>', { maxWidth: 280 });

                    var display_text = "";
                    if (row.category === "新規") {
                        display_text = "+" + row.test_count + "回<br>(新規)";
                    } else {
                        var z_val = row.z_score;
                        display_text = Math.abs(z_val) < 100 ? (z_val >= 0 ? "+" + z_val.toFixed(1) : z_val.toFixed(1)) : (z_val >= 0 ? "+" + Math.round(z_val) : Math.round(z_val));
                    }

                    var textColor = textColors[row.category] || "#000000";
                    var iconHtml = '<div class="count-number" style="font-size: 13px; font-weight: 900; color: ' + textColor + '; font-family: 'Arial Black', sans-serif; pointer-events: none; display: flex; justify-content: center; align-items: center; width: 70px; height: 70px; line-height: 1.1; text-align: center; text-shadow: 2px 2px 0px #ffffff, -2px 2px 0px #ffffff, 2px -2px 0px #ffffff, -2px -2px 0px #ffffff;">' + display_text + '</div>';

                    L.marker([lat, lon], {
                        icon: L.divIcon({ html: iconHtml, iconSize: [70, 70], iconAnchor: [35, 35] })
                    }).addTo(numberGroup);
                });
            });

        function roundVal(num) { return Math.round(num * 100) / 100; }

        mapObj.on('popupopen', function(e) {
            var popupDiv = e.popup.getElement().querySelector('[data-mesh]');
            if (popupDiv) {
                var meshKey = popupDiv.getAttribute('data-mesh');
                var row = window.earthquakeData[meshKey];
                if (row) {
                    var parts = meshKey.split('_');
                    var lat = parts[0];
                    var lon = parts[1];
                    var headerColor = textColors[row.category] || "#333333";
                    var zStr = row.category === "新規" ? "(新規)" : (row.z_score >= 0 ? "+" + row.z_score.toFixed(2) : row.z_score.toFixed(2));
                    var diffStr = row.category === "新規" ? "+" + row.test_count + "回 (新規)" : ((row.test_rate - row.base_rate >= 0 ? "+" : "") + (row.test_rate - row.base_rate).toFixed(2) + "回/日");

                    var eqHtml = "";
                    if (row.test_earthquakes && row.test_earthquakes.length > 0) {
                        eqHtml += '<div class="eq-list-title">テスト期間の地震 (' + row.test_earthquakes.length + '件):</div>';
                        eqHtml += '<table class="eq-table"><tr><th>日時</th><th>M</th><th>深さ</th><th>震源地</th></tr>';
                        row.test_earthquakes.forEach(function(eq) {
                            eqHtml += '<tr><td>' + eq.time + '</td><td>M' + eq.mag.toFixed(1) + '</td><td>' + eq.depth + 'km</td><td>' + eq.region + '</td></tr>';
                        });
                        eqHtml += '</table>';
                    }

                    popupDiv.innerHTML = '<div class="p-box"><div class="p-header"><span>' + lat + '_' + lon + '</span><span style="color:' + headerColor + ';font-weight:bold;">【' + row.category + '】</span></div><table class="p-table"><tr><td class="p-label">Zスコア:</td><td class="p-bold">' + zStr + '</td></tr><tr><td class="p-label">ベース (311日):</td><td class="p-val">' + row.base_count + '回</td></tr><tr><td class="p-label">テスト (1日):</td><td class="p-val">' + row.test_count + '回</td></tr><tr class="p-dash"><td class="p-label">ペース差:</td><td class="p-bold">' + diffStr + '</td></tr></table>' + eqHtml + '</div>';
                }
            }
        });

        var zoomVal = document.getElementById('zoom-level-val');
        if (zoomVal) {
            zoomVal.textContent = mapObj.getZoom().toFixed(2);
            mapObj.on('zoomend', function() { zoomVal.textContent = mapObj.getZoom().toFixed(2); });
        }

        document.getElementById('mesh-opacity').addEventListener('input', function() {
            var opacity = parseFloat(this.value);
            document.getElementById('opacity-val').textContent = opacity.toFixed(2);
            document.querySelectorAll('path.mesh-rectangle').forEach(function(path) { path.setAttribute('fill-opacity', opacity); });
        });

        document.getElementById('text-size').addEventListener('input', function() {
            var size = parseInt(this.value, 10);
            document.getElementById('size-val').textContent = size + 'px';
            document.querySelectorAll('.count-number').forEach(function(el) { el.style.fontSize = size + 'px'; });
        });

        var locations = {
            'japan': [36.0, 138.0, 5.5], 'kanto_area': [35.8, 139.8, 8.25], 'chubu_area': [36.0, 137.5, 8.0],
            'aichi': [35.0, 137.0, 9.25], 'shizuoka': [35.0, 138.3, 9.0]
        };

        document.getElementById('area-select').addEventListener('change', function() {
            var target = locations[this.value];
            if (target) mapObj.flyTo([target[0], target[1]], target[2], { duration: 1.5 });
        });

        var guideCheck = document.getElementById('toggle-guide');
        var squareGuide = document.getElementById('square-guide');
        guideCheck.addEventListener('change', function() { squareGuide.style.display = this.checked ? 'block' : 'none'; });

        var toggleBtn = document.getElementById('ui-toggle-btn');
        var isVisible = true;
        toggleBtn.addEventListener('click', function() {
            isVisible = !isVisible;
            document.getElementById('control-panel').style.display = isVisible ? 'flex' : 'none';
            document.querySelector('.leaflet-control-layers').style.display = isVisible ? 'block' : 'none';
            toggleBtn.textContent = isVisible ? '👁️' : '🙈';
        });
    });
    