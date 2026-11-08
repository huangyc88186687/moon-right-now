/* ============================================================
   此刻的月亮 · The Moon, Right Now
   月面光照由真实天文历表驱动：
   - 太阳方向：低精度太阳历表（Astronomical Almanac 级）
   - 月球位置：Schlyter 低精度月球历表（误差约 0.3°）
   - 月球姿态：IAU/WGCCRE 月球定向参数（α0, δ0, W）
   - 地照：暗面那一抹微光，来自地球反射的日光
   ============================================================ */
(function () {
  'use strict';

  // 调试：把未捕获错误显示到加载屏
  window.addEventListener('error', function (e) {
    var tip = document.getElementById('loadTip');
    if (tip) tip.textContent = '错误: ' + e.message;
  });

  var D2R = Math.PI / 180;
  var DEG = 180 / Math.PI;
  var sin = Math.sin, cos = Math.cos;

  /* ---------------- 天文计算 ---------------- */

  // 自 J2000.0 起的天数
  function daysSinceJ2000(ms) {
    return ms / 86400000 + 2440587.5 - 2451545.0;
  }

  function norm360(x) {
    x = x % 360;
    return x < 0 ? x + 360 : x;
  }

  // 太阳的地心黄道经度（低精度）
  function sunEcliptic(d) {
    var L = 280.460 + 0.9856474 * d;
    var g = (357.528 + 0.9856003 * d) * D2R;
    var lambda = (L + 1.915 * sin(g) + 0.020 * sin(2 * g)) * D2R;
    return lambda;
  }

  // 月球的地心黄道坐标（Schlyter 低精度历表）
  // 注意：Schlyter 公式的历元是 2000 Jan 0.0（JD 2451543.5），
  // 比 J2000.0（2451545.0）早 1.5 天，所以这里必须 d + 1.5
  function moonEcliptic(dIn) {
    var d = dIn + 1.5;
    var N = (125.1228 - 0.0529538083 * d) * D2R;
    var i = 5.1454 * D2R;
    var w = (318.0634 + 0.1643573223 * d) * D2R;
    var a = 60.2666; // 地球半径
    var e = 0.054900;
    var M = (115.3654 + 13.0649929509 * d) * D2R;

    // 开普勒方程迭代
    var E = M + e * sin(M) * (1 + e * cos(M));
    for (var k = 0; k < 3; k++) {
      E = E - (E - e * sin(E) - M) / (1 - e * cos(E));
    }
    var x = a * (cos(E) - e);
    var y = a * Math.sqrt(1 - e * e) * sin(E);
    var r = Math.sqrt(x * x + y * y);
    var v = Math.atan2(y, x);

    var vw = v + w;
    var xe = r * (cos(N) * cos(vw) - sin(N) * sin(vw) * cos(i));
    var ye = r * (sin(N) * cos(vw) + cos(N) * sin(vw) * cos(i));
    var ze = r * sin(vw) * sin(i);
    var lon = Math.atan2(ye, xe) * DEG;
    var lat = Math.asin(ze / r) * DEG;

    /* ---- Schlyter 主要摄动项 ----
       注意历元：轨道根数 N/w/M 已按 Schlyter 历元（d+1.5）计算，
       平黄经直接取 Lm = N+w+M 保证自洽；太阳量用 J2000 的 dIn */
    var Ls = 280.460 + 0.9856474 * dIn;      // 太阳平黄经
    var Ms = 357.528 + 0.9856003 * dIn;      // 太阳平近点角
    var Lm = norm360(N / D2R + w / D2R + M / D2R); // 月球平黄经（自洽）
    var Dp = Lm - Ls;                        // 平距角
    var F = Lm - N / D2R;                    // 升交点距角
    var Mdeg = M / D2R;
    function s(x) { return Math.sin(x * D2R); }
    lon += (-1.274 * s(Mdeg - 2 * Dp) + 0.658 * s(2 * Dp) - 0.186 * s(Ms)
          - 0.059 * s(2 * Mdeg - 2 * Dp) - 0.057 * s(Mdeg - 2 * Dp + Ms)
          + 0.053 * s(Mdeg + 2 * Dp) + 0.046 * s(2 * Dp - Ms)
          + 0.041 * s(Mdeg - Ms) - 0.035 * s(Dp)
          - 0.031 * s(Mdeg + Ms) - 0.015 * s(2 * F - 2 * Dp)
          + 0.011 * s(Mdeg - 4 * Dp));
    lat += (-0.173 * s(F - 2 * Dp) - 0.055 * s(Mdeg - F - 2 * Dp)
          - 0.046 * s(Mdeg + F - 2 * Dp) + 0.033 * s(F + 2 * Dp)
          + 0.017 * s(2 * Mdeg + F));
    lon *= D2R;
    lat *= D2R;

    return {
      lon: lon,
      lat: lat,
      r: r
    };
  }

  function eclToVec(lon, lat) {
    return new THREE.Vector3(cos(lat) * cos(lon), cos(lat) * sin(lon), sin(lat));
  }

  // 黄道 → 赤道
  function eclToEquatorial(v) {
    var e = 23.439 * D2R;
    return new THREE.Vector3(v.x, v.y * cos(e) - v.z * sin(e), v.y * sin(e) + v.z * cos(e));
  }

  // IAU 月球定向 → 月固系(mx 指向经度0, mz 指北) → ICRF 的旋转矩阵
  var _rotTmp = new THREE.Matrix4();
  function moonFixedRotation(d) {
    var T = d / 36525;
    var a0 = 269.9949 + 0.0031 * T - 0.0019 * T * T;
    var d0 = 66.5392 + 0.0130 * T - 0.0137 * T * T;
    var W = 38.3213 + 13.17635815 * d - 1.4e-12 * d * d;

    var m = new THREE.Matrix4().makeRotationZ((a0 + 90) * D2R);
    m.multiply(_rotTmp.makeRotationX((90 - d0) * D2R));
    m.multiply(_rotTmp.makeRotationZ(W * D2R));
    return m; // mf -> ICRF
  }

  // 一次性算出某时刻的全部关键量（带缓存：模拟时刻不变就不重算）
  var _ephCache = { ms: NaN, v: null };
  function ephemeris(ms) {
    if (_ephCache.v && Math.abs(ms - _ephCache.ms) < 15000) return _ephCache.v;
    var v = ephemerisRaw(ms);
    _ephCache.ms = ms;
    _ephCache.v = v;
    return v;
  }

  function ephemerisRaw(ms) {
    var d = daysSinceJ2000(ms);
    var lambdaS = sunEcliptic(d);
    var sunEq = eclToEquatorial(eclToVec(lambdaS, 0));      // ICRF 单位向量
    var moon = moonEcliptic(d);
    var moonEq = eclToEquatorial(eclToVec(moon.lon, moon.lat));

    // 相位角与照亮比例
    // ψ = 地心距角：新月 ψ≈0，满月 ψ≈180°
    // 照亮比例 = (1 - cos ψ) / 2
    var psi = sunEq.angleTo(moonEq);          // 地心距角
    var illum = (1 - cos(psi)) / 2;

    // ICRF -> 月固
    var R = moonFixedRotation(d);
    var Rt = R.clone().transpose();
    var sunMF = sunEq.clone().applyMatrix4(Rt);
    var earthMF = moonEq.clone().multiplyScalar(-1).applyMatrix4(Rt); // 月→地方向

    // 日下点 / 地下点（月固经纬）
    function toLatLon(v) {
      var n = v.clone().normalize();
      return { lat: Math.asin(n.z) * DEG, lon: norm360(Math.atan2(n.y, n.x) * DEG) };
    }

    return {
      d: d,
      illum: illum,
      elong: psi * DEG,
      sub: toLatLon(sunMF),      // 日下点
      earth: toLatLon(earthMF),  // 地下点（含天平动）
      sunMF: sunMF.normalize(),
      earthMF: earthMF.normalize(),
      moonDistKm: moon.r * 6371
    };
  }

  // 距角（地心，度，范围 0~180）：新月≈0，满月≈180
  function elongDeg(ms) {
    return ephemeris(ms).elong;
  }

  // 在时间轴上找距角极值：wantMin=true 找新月，false 找满月
  // dir: -1 向过去扫描，+1 向未来扫描
  function findMoonEvent(ms, dir, wantMin) {
    var step = 0.02 * dir * 86400000; // 约 29 分钟
    var fPrev = elongDeg(ms);
    var fCur = elongDeg(ms + step);
    var rising = fCur > fPrev;
    for (var i = 2; i < 2400; i++) {
      var t = ms + step * i;
      var f = elongDeg(t);
      var nowRising = f > fCur;
      // 极值判定：沿扫描方向由降转升 = 极小（新月），由升转降 = 极大（满月）
      if (wantMin ? (!rising && nowRising) : (rising && !nowRising)) {
        var lo = ms + step * (i - 2), hi = t;
        for (var k = 0; k < 48; k++) {
          var m1 = lo + (hi - lo) / 3, m2 = hi - (hi - lo) / 3;
          var g1 = elongDeg(m1), g2 = elongDeg(m2);
          if (wantMin ? (g1 < g2) : (g1 > g2)) hi = m2; else lo = m1;
        }
        return (lo + hi) / 2;
      }
      rising = nowRising;
      fCur = f;
    }
    return null;
  }

  // 最近一次新月（用于月龄）
  function lastNewMoon(ms) {
    var t = findMoonEvent(ms, -1, true);
    return t === null ? ms : t;
  }

  // 下一次满月
  function nextFullMoon(ms) {
    var t = findMoonEvent(ms, 1, false);
    return t === null ? ms + 15 * 86400000 : t;
  }

  function phaseName(age) {
    if (age < 1.0 || age > 28.5) return '新月';
    if (age < 6.6) return '娥眉月';
    if (age < 8.2) return '上弦月';
    if (age < 13.8) return '盈凸月';
    if (age < 15.8) return '满月';
    if (age < 21.3) return '亏凸月';
    if (age < 22.9) return '下弦月';
    return '残月';
  }

  /* ---------------- 月面地标（IAU 真实坐标） ---------------- */

  var LANDMARKS = [
    { name: '静海 · 阿波罗11号着陆点', lat: 0.67, lon: 23.47, note: '1969年7月20日，人类第一次踏上月球。脚印还在，因为没有风。' },
    { name: '虹湾 (Sinus Iridum)', lat: 44.1, lon: -31.5, note: '嫦娥三号着陆区，月面观测新手的第一目标。' },
    { name: '雨海 (Mare Imbrium)', lat: 32.8, lon: -15.6, note: '38亿年前一颗小行星砸出的大盆地，岩浆把它填成了平原。' },
    { name: '哥白尼环形山', lat: 9.62, lon: -20.08, note: '93公里宽，放射状的溅射痕在满月时最醒目。' },
    { name: '风暴洋 · 嫦娥五号落区', lat: 43.1, lon: -51.8, note: '月球最大的月海，2020年嫦娥五号从这里带回1731克月壤。' },
    { name: '第谷环形山', lat: -43.31, lon: -11.36, note: '85公里宽的年轻撞击坑，长长的亮纹像车轮辐条。' },
    { name: '危海 (Mare Criscium)', lat: 17.0, lon: 59.1, note: '孤零零的圆形月海，独立于主月海系统。' },
    { name: '冯·卡门坑 · 嫦娥四号着陆区', lat: -45.5, lon: 177.6, note: '月球背面，2019年1月3日人类探测器首次背面软着陆。' },
    { name: '南极-艾特肯盆地', lat: -53, lon: -169, note: '月球最大最古老的撞击盆地，深达13公里。' }
  ];

  /* ---------------- 场景 ---------------- */

  var MOON_R = 1.2718;         // NASA 模型半径
  var stage = document.getElementById('stage');

  var renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 2));
  renderer.setSize(innerWidth, innerHeight);
  renderer.outputEncoding = THREE.sRGBEncoding;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.1;
  renderer.setClearColor(0x020308, 1);
  stage.appendChild(renderer.domElement);

  var scene = new THREE.Scene();
  var camera = new THREE.PerspectiveCamera(38, innerWidth / innerHeight, 0.05, 300);

  // 光照
  var sun = new THREE.DirectionalLight(0xfff6ec, 2.3);
  scene.add(sun);
  scene.add(sun.target);
  var earthshine = new THREE.DirectionalLight(0x7d92c8, 0.028);
  scene.add(earthshine);
  scene.add(earthshine.target);
  scene.add(new THREE.AmbientLight(0x11131c, 0.05));

  // 星空（两层）
  (function stars() {
    function layer(n, size, opacity) {
      var pos = new Float32Array(n * 3);
      for (var i = 0; i < n; i++) {
        var u = Math.random() * 2 - 1;
        var t = Math.random() * Math.PI * 2;
        var r = 80 + Math.random() * 60;
        var s = Math.sqrt(1 - u * u);
        pos[i * 3] = r * s * cos(t);
        pos[i * 3 + 1] = r * u;
        pos[i * 3 + 2] = r * s * sin(t);
      }
      var g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
      var m = new THREE.PointsMaterial({
        color: 0xdfe4f2, size: size, sizeAttenuation: false,
        transparent: true, opacity: opacity, depthWrite: false
      });
      scene.add(new THREE.Points(g, m));
    }
    layer(1500, 1.4, 0.55);
    layer(140, 2.6, 0.9);
  })();

  // 太阳光斑
  var sunGlow = null;

  /* ---- 月固坐标(z=北,x=经度0,y=东) ↔ three 坐标 ----
     场景约定：+Z 朝地球（相机默认位），+Y 指北，+X 朝东经90°。
     这样从地球方向看去，东在右、北在上，与北半球目视一致。 */
  function mfToScene(v) {
    return new THREE.Vector3(v.y, v.z, v.x);
  }
  function sceneToMf(v) {
    return new THREE.Vector3(v.z, v.x, v.y);
  }
  function latLonToScene(lat, lon, r) {
    var z = sin(lat * D2R), c = cos(lat * D2R);
    return mfToScene(new THREE.Vector3(c * cos(lon * D2R), c * sin(lon * D2R), z)).multiplyScalar(r);
  }

  /* ---------------- 月球加载 ---------------- */

  var moonMesh = null;
  var markerGroup = new THREE.Group();
  scene.add(markerGroup);
  var markers = [];

  function buildMarkers() {
    // 低调的仪器标记：细环 + 中心点，白色半透明，不抢月面质感
    var cvs = document.createElement('canvas');
    cvs.width = cvs.height = 64;
    var ctx = cvs.getContext('2d');
    ctx.strokeStyle = 'rgba(255,255,255,0.9)';
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.arc(32, 32, 22, 0, Math.PI * 2);
    ctx.stroke();
    ctx.fillStyle = 'rgba(255,255,255,0.95)';
    ctx.beginPath();
    ctx.arc(32, 32, 3.5, 0, Math.PI * 2);
    ctx.fill();
    var tex = new THREE.CanvasTexture(cvs);

    LANDMARKS.forEach(function (lm) {
      var sm = new THREE.SpriteMaterial({
        map: tex, transparent: true, opacity: 0.55, depthTest: true
      });
      var sp = new THREE.Sprite(sm);
      sp.position.copy(latLonToScene(lm.lat, lm.lon, MOON_R * 1.006));
      sp.scale.set(0.042, 0.042, 1);
      sp.userData.lm = lm;
      markerGroup.add(sp);
      markers.push(sp);
    });
  }

  var manager = new THREE.LoadingManager();
  var loadBar = document.getElementById('loadBar');
  var loadTip = document.getElementById('loadTip');
  manager.onProgress = function (url, done, total) {
    loadBar.style.width = Math.round(done / total * 100) + '%';
  };

  // Chromium 在部分环境下 createImageBitmap 解码 4096² 大图会挂起，
  // 统一退回 <img> 解码路径（glTF flipY=false 两条路径行为一致）
  window.createImageBitmap = undefined;

  new THREE.GLTFLoader(manager).load(
    'static/models/moon_opt.glb',
    function (gltf) {
      var model = gltf.scene;
      // —— 校准：模型坐标 → 月固坐标 ——
      // NASA 导出的模型姿态与月固系的差异，在此旋转对齐
      model.rotation.set(0, 0, 0);
      scene.add(model);
      moonMesh = model;
      buildMarkers();
      var el = document.getElementById('loading');
      el.classList.add('done');
      setTimeout(function () { el.remove(); }, 700);
    },
    undefined,
    function (err) {
      loadTip.textContent = '模型加载失败，请刷新重试';
      console.error(err);
    }
  );

  /* ---------------- 轨道相机 ---------------- */

  var orbit = { theta: 0, phi: Math.PI / 2, dist: 3.8 };
  var target = { theta: 0, phi: Math.PI / 2, dist: 3.8 };

  function applyCamera() {
    var sp = sin(orbit.phi);
    camera.position.set(
      orbit.dist * sp * sin(orbit.theta),
      orbit.dist * cos(orbit.phi),
      orbit.dist * sp * cos(orbit.theta)
    );
    camera.lookAt(0, 0, 0);
  }

  // 拖动 / 缩放
  var dragging = false, lastX = 0, lastY = 0;
  var pinchD = 0;
  var pointers = new Map();

  stage.addEventListener('pointerdown', function (e) {
    pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pointers.size === 1) {
      dragging = true;
      lastX = e.clientX; lastY = e.clientY;
    } else if (pointers.size === 2) {
      var ps = Array.from(pointers.values());
      pinchD = Math.hypot(ps[0].x - ps[1].x, ps[0].y - ps[1].y);
    }
  });
  window.addEventListener('pointermove', function (e) {
    if (!pointers.has(e.pointerId)) return;
    pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pointers.size === 2) {
      var ps = Array.from(pointers.values());
      var d = Math.hypot(ps[0].x - ps[1].x, ps[0].y - ps[1].y);
      if (pinchD > 0) {
        target.dist = THREE.MathUtils.clamp(target.dist * pinchD / d, MOON_R * 1.14, 14);
      }
      pinchD = d;
      return;
    }
    if (!dragging) return;
    target.theta -= (e.clientX - lastX) * 0.005;
    target.phi = THREE.MathUtils.clamp(target.phi - (e.clientY - lastY) * 0.005, 0.05, Math.PI - 0.05);
    lastX = e.clientX; lastY = e.clientY;
  });
  window.addEventListener('pointerup', function (e) {
    pointers.delete(e.pointerId);
    if (pointers.size < 2) pinchD = 0;
    if (pointers.size === 0) dragging = false;
  });
  stage.addEventListener('wheel', function (e) {
    e.preventDefault();
    target.dist = THREE.MathUtils.clamp(target.dist * (1 + Math.sign(e.deltaY) * 0.09), MOON_R * 1.14, 14);
  }, { passive: false });

  /* ---------------- 拾取 ---------------- */

  var raycaster = new THREE.Raycaster();
  var ndc = new THREE.Vector2();

  function pickMoon(x, y) {
    ndc.x = (x / innerWidth) * 2 - 1;
    ndc.y = -(y / innerHeight) * 2 + 1;
    raycaster.setFromCamera(ndc, camera);
    if (!moonMesh) return null;
    var hits = raycaster.intersectObject(moonMesh, true);
    return hits.length ? hits[0] : null;
  }

  var spotCard = document.getElementById('spotCard');
  var activeMarker = null;

  function fmtLat(v) {
    return Math.abs(v).toFixed(2) + '°' + (v >= 0 ? 'N' : 'S');
  }
  function fmtLon(v) {
    // 月球经度习惯：东经 E 为正
    return Math.abs(v).toFixed(2) + '°' + (v >= 0 ? 'E' : 'W');
  }

  function showSpot(point, lm) {
    var mf = sceneToMf(point).normalize();
    var lat = Math.asin(mf.z) * DEG;
    var lon = norm360(Math.atan2(mf.y, mf.x) * DEG);
    var eph = ephemeris(tSim);
    var sunElev = Math.asin(THREE.MathUtils.clamp(mf.dot(eph.sunMF), -1, 1)) * DEG;
    var farSide = Math.abs(((lon + 180) % 360) - 180) > 90;

    if (lm) {
      document.getElementById('scName').textContent = lm.name;
      document.getElementById('scNote').textContent = lm.note;
    } else {
      document.getElementById('scName').textContent = farSide ? '月面 · 背面' : '月面 · 正面';
      document.getElementById('scNote').textContent = '月球总以同一面朝向地球，背面的我们直到1959年才第一次看到。';
    }
    document.getElementById('scLat').textContent = fmtLat(lat);
    document.getElementById('scLon').textContent = fmtLon(lon);
    document.getElementById('scSun').textContent = sunElev.toFixed(1) + '°';
    var dayEl = document.getElementById('scDay');
    if (sunElev > 0.5) dayEl.textContent = '白昼';
    else if (sunElev < -0.5) dayEl.textContent = '黑夜';
    else dayEl.textContent = '晨昏线上';
    spotCard.hidden = false;
  }

  document.getElementById('scClose').addEventListener('click', function () {
    spotCard.hidden = true;
    setActive(null);
  });

  function setActive(sp) {
    if (activeMarker) {
      activeMarker.scale.set(0.042, 0.042, 1);
      activeMarker.material.opacity = 0.55;
    }
    activeMarker = sp;
    if (sp) {
      sp.scale.set(0.075, 0.075, 1);
      sp.material.opacity = 0.95;
    }
  }

  var downXY = null;
  stage.addEventListener('pointerdown', function (e) { downXY = { x: e.clientX, y: e.clientY }; });
  stage.addEventListener('pointerup', function (e) {
    if (!downXY) return;
    var moved = Math.hypot(e.clientX - downXY.x, e.clientY - downXY.y);
    downXY = null;
    if (moved > 6) return; // 拖动不算点击

    // 先试地标
    ndc.x = (e.clientX / innerWidth) * 2 - 1;
    ndc.y = -(e.clientY / innerHeight) * 2 + 1;
    raycaster.setFromCamera(ndc, camera);
    var hitSprites = raycaster.intersectObjects(markers, false);
    if (hitSprites.length) {
      var sp = hitSprites[0].object;
      setActive(sp);
      // 相机转向该地标
      var dir = sp.position.clone().normalize();
      target.theta = Math.atan2(dir.x, dir.z);
      target.phi = THREE.MathUtils.clamp(Math.acos(THREE.MathUtils.clamp(dir.y, -1, 1)), 0.05, Math.PI - 0.05);
      showSpot(sp.position, sp.userData.lm);
      return;
    }
    var hit = pickMoon(e.clientX, e.clientY);
    if (hit) {
      setActive(null);
      showSpot(hit.point, null);
    }
  });

  /* ---------------- 时间轴 ---------------- */

  var now0 = Date.now();
  var tSim = now0;

  // 支持 #2026-11-24T22:54 这样的锚点，直达某个时刻的月亮
  var mHash = location.hash.match(/^#(\d{4})-(\d{2})-(\d{2})(?:[T ](\d{2}):(\d{2}))?/);
  if (mHash) {
    tSim = new Date(+mHash[1], +mHash[2] - 1, +mHash[3],
      +(mHash[4] || 0), +(mHash[5] || 0)).getTime();
  }

  var playing = false;
  var speed = 3600; // 模拟秒 / 真实秒
  var btnPlay = document.getElementById('btnPlay');
  var tlRange = document.getElementById('tlRange');

  btnPlay.addEventListener('click', function () {
    playing = !playing;
    btnPlay.textContent = playing ? '❚❚' : '▶';
    btnPlay.classList.toggle('on', playing);
  });
  document.querySelectorAll('.tl-speed button').forEach(function (b) {
    b.addEventListener('click', function () {
      speed = parseInt(b.dataset.spd, 10);
      document.querySelectorAll('.tl-speed button').forEach(function (x) { x.classList.remove('on'); });
      b.classList.add('on');
    });
  });
  document.getElementById('btnNow').addEventListener('click', function () {
    tSim = Date.now();
    syncSlider();
  });
  tlRange.addEventListener('input', function () {
    tSim = now0 + parseFloat(tlRange.value) * 86400000;
  });

  function syncSlider() {
    var off = (tSim - now0) / 86400000;
    if (off > 30) { tSim = now0 - 30 * 86400000; off = -30; }
    if (off < -30) { tSim = now0 + 30 * 86400000; off = 30; }
    tlRange.value = off;
  }

  /* ---------------- 读数面板 ---------------- */

  var roTime = document.getElementById('roTime');
  var roPhase = document.getElementById('roPhase');
  var roAge = document.getElementById('roAge');
  var roIllum = document.getElementById('roIllum');
  var roSub = document.getElementById('roSub');
  var roFull = document.getElementById('roFull');

  var fmtTime = new Intl.DateTimeFormat('zh-CN', {
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', hour12: false
  });

  var cachedAgeBase = null, cachedAge = 0;
  function moonAge(ms) {
    // 新月一旦找到就长期复用：25 天内无需重扫（朔望月 29.53 天）
    if (cachedAgeBase === null || ms < cachedAgeBase ||
        ms > cachedAgeBase + 25 * 86400000) {
      cachedAgeBase = lastNewMoon(ms);
    }
    return (ms - cachedAgeBase) / 86400000;
  }

  var lastReadout = 0;
  function updateReadout(force) {
    var now = performance.now();
    if (!force && now - lastReadout < 250) return;
    lastReadout = now;

    var eph = ephemeris(tSim);
    var isNow = Math.abs(tSim - Date.now()) < 60000;
    roTime.textContent = fmtTime.format(new Date(tSim)) + (isNow ? ' · 现在' : '');
    roIllum.textContent = (eph.illum * 100).toFixed(1) + '%';
    roSub.textContent = fmtLat(eph.sub.lat) + ' ' + fmtLon(eph.sub.lon);

    var age = moonAge(tSim);
    roPhase.textContent = phaseName(age);
    roAge.textContent = age.toFixed(1) + ' 天';

    // 下次满月：结果在 2 天前 ~ 28 天内的窗口里一直有效，避免播放时反复扫描
    var fullT = updateReadout._full;
    if (fullT === undefined || tSim > fullT - 2 * 86400000 ||
        tSim < fullT - 28 * 86400000) {
      updateReadout._full = nextFullMoon(tSim);
    }
    var dt = (updateReadout._full - tSim) / 86400000;
    roFull.textContent = dt < 1 ? Math.max(0, dt * 24).toFixed(1) + ' 小时后' : dt.toFixed(1) + ' 天后';
  }

  /* ---------------- 地标列表 ---------------- */

  var lmList = document.getElementById('lmList');
  LANDMARKS.forEach(function (lm, idx) {
    var b = document.createElement('button');
    b.className = 'lm-item';
    b.innerHTML = '<span>' + lm.name + '</span><i>' + fmtLat(lm.lat) + ' ' + fmtLon(lm.lon) + '</i>';
    b.addEventListener('click', function () {
      setActive(markers[idx]);
      var dir = markers[idx].position.clone().normalize();
      target.theta = Math.atan2(dir.x, dir.z);
      target.phi = THREE.MathUtils.clamp(Math.acos(THREE.MathUtils.clamp(dir.y, -1, 1)), 0.05, Math.PI - 0.05);
      if (target.dist < MOON_R * 1.7) target.dist = MOON_R * 1.9;
      showSpot(markers[idx].position, lm);
    });
    lmList.appendChild(b);
  });

  /* ---------------- 光照更新 ---------------- */

  var CAL = false; // 校准模式：太阳跟随相机
  if (location.hash === '#cal') CAL = true;

  function updateLighting() {
    var eph = ephemeris(tSim);
    if (CAL) {
      var cd = camera.position.clone().normalize();
      sun.position.copy(cd.multiplyScalar(10));
    } else {
      sun.position.copy(mfToScene(eph.sunMF).multiplyScalar(10));
    }
    sun.target.position.set(0, 0, 0);
    // 地照：新月附近地球把大量日光反照到月球暗面，满月附近几乎为零
    earthshine.intensity = 0.02 + 0.13 * (1 - eph.illum);
    earthshine.position.copy(mfToScene(eph.earthMF).multiplyScalar(10));
    earthshine.target.position.set(0, 0, 0);
    if (sunGlow) sunGlow.position.copy(sun.position).multiplyScalar(6);
  }

  // 太阳光斑（加载后创建）
  (function makeSunGlow() {
    var cvs = document.createElement('canvas');
    cvs.width = cvs.height = 128;
    var ctx = cvs.getContext('2d');
    var g = ctx.createRadialGradient(64, 64, 4, 64, 64, 62);
    g.addColorStop(0, 'rgba(255,250,240,1)');
    g.addColorStop(0.18, 'rgba(255,240,214,0.55)');
    g.addColorStop(0.5, 'rgba(255,225,180,0.12)');
    g.addColorStop(1, 'rgba(255,220,170,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 128, 128);
    sunGlow = new THREE.Sprite(new THREE.SpriteMaterial({
      map: new THREE.CanvasTexture(cvs), transparent: true,
      depthWrite: false, depthTest: true
    }));
    sunGlow.scale.set(26, 26, 1);
    scene.add(sunGlow);
  })();

  /* ---------------- 主循环 ---------------- */

  var prevT = performance.now();

  function animate(now) {
    requestAnimationFrame(animate);
    var dt = Math.min((now - prevT) / 1000, 0.1);
    prevT = now;

    if (playing) {
      tSim += speed * dt * 1000;
      syncSlider();
    }

    // 相机阻尼
    orbit.theta += (target.theta - orbit.theta) * Math.min(1, dt * 7);
    orbit.phi += (target.phi - orbit.phi) * Math.min(1, dt * 7);
    orbit.dist += (target.dist - orbit.dist) * Math.min(1, dt * 7);
    applyCamera();

    updateLighting();
    updateReadout(false);
    renderer.render(scene, camera);
  }

  window.addEventListener('resize', function () {
    camera.aspect = innerWidth / innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(innerWidth, innerHeight);
  });

  syncSlider();
  updateReadout(true);
  requestAnimationFrame(animate);
})();
