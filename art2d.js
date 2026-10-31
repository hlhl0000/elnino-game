(function (root) {
  'use strict';

  var TAU = Math.PI * 2;
  var cache = {};
  var cacheOrder = [];
  var cacheLimit = 10;
  var palette = ['#1d4ed8', '#15803d', '#b45309', '#b91c1c', '#6d28d9', '#0f5c8c', '#be185d', '#475569', '#0f766e', '#c2410c', '#4338ca', '#166534', '#9f1239', '#0369a1', '#854d0e'];

  function clamp(v, a, b) {
    v = +v || 0;
    return Math.max(a, Math.min(b, v));
  }

  function q(v) {
    return Math.round(clamp(v, 0, 1) * 20) / 20;
  }

  function circle(ctx, x, y, r, color) {
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, TAU);
    ctx.fill();
  }

  function ellipse(ctx, x, y, rx, ry, color) {
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.ellipse(x, y, rx, ry, 0, 0, TAU);
    ctx.fill();
  }

  function rounded(ctx, x, y, w, h, r) {
    r = Math.min(r, w / 2, h / 2);
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }

  function poly(ctx, pts) {
    var i;
    ctx.beginPath();
    ctx.moveTo(pts[0][0], pts[0][1]);
    for (i = 1; i < pts.length; i += 1) {
      ctx.lineTo(pts[i][0], pts[i][1]);
    }
    ctx.closePath();
  }

  function lineArrow(ctx, x0, y0, x1, y1, width, color, alpha) {
    var ang = Math.atan2(y1 - y0, x1 - x0);
    var head = Math.max(10, width * 1.1 + 5);
    var wing = Math.max(8, width * 0.8 + 4);
    var bx = x1 - Math.cos(ang) * head;
    var by = y1 - Math.sin(ang) * head;
    var nx = -Math.sin(ang);
    var ny = Math.cos(ang);
    ctx.save();
    ctx.globalAlpha = alpha === undefined ? 1 : alpha;
    ctx.strokeStyle = color;
    ctx.fillStyle = color;
    ctx.lineWidth = width;
    ctx.lineCap = 'butt';
    ctx.beginPath();
    ctx.moveTo(x0, y0);
    ctx.lineTo(bx, by);
    ctx.stroke();
    poly(ctx, [[x1, y1], [bx + nx * wing, by + ny * wing], [bx - nx * wing, by - ny * wing]]);
    ctx.fill();
    ctx.restore();
  }

  function curvedUpwelling(ctx, x0, y0, bendX, bendY, x1, y1, strength, scale) {
    var reach = 0.12 + strength * 0.88;
    var qx = x0 + (bendX - x0) * reach;
    var qy = y0 + (bendY - y0) * reach;
    var ex = (1 - reach) * (1 - reach) * x0 + 2 * (1 - reach) * reach * bendX + reach * reach * x1;
    var ey = (1 - reach) * (1 - reach) * y0 + 2 * (1 - reach) * reach * bendY + reach * reach * y1;
    var width = (3 + strength * 5) * scale;
    var alpha = 0.08 + strength * 0.82;
    var ang = Math.atan2(ey - qy, ex - qx);
    var head = (8 + strength * 7) * scale;
    var wing = (5 + strength * 5) * scale;
    var bx = ex - Math.cos(ang) * head;
    var by = ey - Math.sin(ang) * head;
    var nx = -Math.sin(ang);
    var ny = Math.cos(ang);
    var dots = Math.max(1, Math.round(1 + strength * 10));
    var i;
    var u;
    var px;
    var py;
    ctx.save();
    ctx.lineCap = 'round';
    ctx.globalAlpha = alpha * 0.25;
    ctx.strokeStyle = '#d7f3ff';
    ctx.lineWidth = width + 6 * scale;
    ctx.beginPath();
    ctx.moveTo(x0, y0);
    ctx.quadraticCurveTo(qx, qy, ex, ey);
    ctx.stroke();
    ctx.globalAlpha = alpha;
    ctx.strokeStyle = '#38a8df';
    ctx.lineWidth = width;
    ctx.beginPath();
    ctx.moveTo(x0, y0);
    ctx.quadraticCurveTo(qx, qy, ex, ey);
    ctx.stroke();
    ctx.fillStyle = '#38a8df';
    poly(ctx, [[ex, ey], [bx + nx * wing, by + ny * wing], [bx - nx * wing, by - ny * wing]]);
    ctx.fill();
    ctx.globalAlpha = alpha * 0.92;
    for (i = 0; i < dots; i += 1) {
      u = reach * (0.12 + (i + 1) / (dots + 2) * 0.72);
      px = (1 - u) * (1 - u) * x0 + 2 * (1 - u) * u * bendX + u * u * x1;
      py = (1 - u) * (1 - u) * y0 + 2 * (1 - u) * u * bendY + u * u * y1;
      circle(ctx, px - (i % 2) * 5 * scale, py + (i % 3 - 1) * 4 * scale, (1.7 + i % 2) * scale, '#34d399');
    }
    ctx.restore();
  }

  function fishingZone(ctx, zone) {
    ctx.save();
    ctx.fillStyle = 'rgba(224,247,255,0.1)';
    ctx.beginPath();
    ctx.ellipse(zone[0], zone[1], zone[2], zone[3], 0, 0, TAU);
    ctx.fill();
    ctx.strokeStyle = 'rgba(219,244,255,0.58)';
    ctx.lineWidth = 1.4;
    ctx.setLineDash([7, 6]);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.restore();
  }

  function boardSchool(ctx, zoneNear, zoneFar, count, size, color, flipBase) {
    var i;
    var zone;
    var local;
    var col;
    var row;
    for (i = 0; i < count; i += 1) {
      zone = i % 2 === 0 ? zoneNear : zoneFar;
      local = Math.floor(i / 2);
      col = local % 3;
      row = Math.floor(local / 3);
      drawFish(ctx, zone[0] + (col - 1) * zone[2] * 0.48, zone[1] + (row - 1) * zone[3] * 0.58, size, color, (i + flipBase) % 2, 0.98);
    }
  }

  function drawFish(ctx, x, y, size, color, flip, alpha) {
    var d = flip ? -1 : 1;
    ctx.save();
    ctx.globalAlpha = alpha === undefined ? 1 : alpha;
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.ellipse(x, y, size * 0.72, size * 0.38, 0, 0, TAU);
    ctx.fill();
    poly(ctx, [[x - d * size * 0.55, y], [x - d * size * 1.05, y - size * 0.48], [x - d * size * 1.05, y + size * 0.48]]);
    ctx.fill();
    circle(ctx, x + d * size * 0.35, y - size * 0.08, Math.max(0.7, size * 0.08), '#0f172a');
    ctx.restore();
  }

  function drawCloud(ctx, x, y, scale, dark) {
    var base = dark ? '#cbd5e1' : '#eef6fb';
    ellipse(ctx, x, y + 8 * scale, 35 * scale, 12 * scale, 'rgba(71,85,105,0.18)');
    circle(ctx, x - 21 * scale, y + 3 * scale, 16 * scale, base);
    circle(ctx, x + 20 * scale, y + 2 * scale, 18 * scale, base);
    circle(ctx, x, y - 7 * scale, 23 * scale, dark ? '#e2e8f0' : '#ffffff');
    ctx.fillStyle = base;
    ctx.fillRect(x - 24 * scale, y, 50 * scale, 13 * scale);
  }

  function drawRain(ctx, x0, x1, y0, y1, amount, t) {
    var i;
    var count = Math.round(24 * amount);
    var span = Math.max(4, x1 - x0);
    var fall = (t * 74) % Math.max(12, y1 - y0);
    ctx.save();
    ctx.strokeStyle = '#1d4ed8';
    ctx.lineWidth = 1.6;
    ctx.lineCap = 'round';
    ctx.globalAlpha = 0.25 + amount * 0.62;
    for (i = 0; i < count; i += 1) {
      var x = x0 + ((i * 47 + 13) % Math.floor(span));
      var y = y0 + ((i * 31 + fall) % Math.max(14, y1 - y0));
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x - 3, Math.min(y1, y + 10));
      ctx.stroke();
    }
    ctx.restore();
  }

  function drawPalm(ctx, x, y, s, dry) {
    ctx.strokeStyle = '#7c4a24';
    ctx.lineWidth = 4 * s;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.quadraticCurveTo(x - 2 * s, y - 20 * s, x + 4 * s, y - 38 * s);
    ctx.stroke();
    ctx.strokeStyle = dry ? '#b45309' : '#15803d';
    ctx.lineWidth = 5 * s;
    var i;
    for (i = 0; i < 5; i += 1) {
      var a = -2.75 + i * 0.69;
      ctx.beginPath();
      ctx.moveTo(x + 4 * s, y - 38 * s);
      ctx.quadraticCurveTo(x + Math.cos(a) * 13 * s, y - 43 * s + Math.sin(a) * 6 * s, x + Math.cos(a) * 25 * s, y - 38 * s + Math.sin(a) * 18 * s);
      ctx.stroke();
    }
  }

  function drawWestVillage(ctx, x, y, scale, drought, fire) {
    var s = scale;
    ctx.save();
    ctx.fillStyle = '#6d8f46';
    ctx.beginPath();
    ctx.ellipse(x, y + 5 * s, 78 * s, 24 * s, -0.08, 0, TAU);
    ctx.fill();
    if (drought > 0) {
      ctx.fillStyle = 'rgba(180,83,9,' + (drought * 0.36) + ')';
      ctx.fill();
    }
    ctx.fillStyle = '#8b5a2b';
    ctx.fillRect(x - 32 * s, y - 25 * s, 55 * s, 28 * s);
    ctx.fillStyle = '#f1c27d';
    ctx.fillRect(x - 28 * s, y - 21 * s, 47 * s, 23 * s);
    ctx.fillStyle = '#b45309';
    poly(ctx, [[x - 38 * s, y - 25 * s], [x - 4 * s, y - 50 * s], [x + 29 * s, y - 25 * s]]);
    ctx.fill();
    ctx.fillStyle = '#6b4423';
    ctx.fillRect(x - 25 * s, y + 1 * s, 4 * s, 14 * s);
    ctx.fillRect(x + 13 * s, y + 1 * s, 4 * s, 14 * s);
    drawPalm(ctx, x - 58 * s, y + 2 * s, s, drought > 0.55);
    drawPalm(ctx, x + 55 * s, y + 5 * s, s * 0.82, drought > 0.55);
    if (fire > 0.02) {
      ctx.globalAlpha = 0.22 + fire * 0.55;
      ctx.fillStyle = '#f97316';
      poly(ctx, [[x - 73 * s, y - 20 * s], [x - 65 * s, y - 48 * s], [x - 58 * s, y - 25 * s], [x - 49 * s, y - 55 * s], [x - 39 * s, y - 17 * s]]);
      ctx.fill();
      ctx.fillStyle = '#64748b';
      circle(ctx, x - 63 * s, y - 67 * s, 13 * s, '#64748b');
      circle(ctx, x - 49 * s, y - 76 * s, 17 * s, '#64748b');
    }
    ctx.restore();
  }

  function drawEastVillage(ctx, x, y, scale, flood) {
    var s = scale;
    ctx.save();
    ctx.fillStyle = '#b7a06a';
    poly(ctx, [[x - 92 * s, y + 12 * s], [x - 60 * s, y - 61 * s], [x - 31 * s, y - 23 * s], [x - 5 * s, y - 76 * s], [x + 31 * s, y - 17 * s], [x + 79 * s, y + 12 * s]]);
    ctx.fill();
    ctx.fillStyle = '#d6b87a';
    ctx.fillRect(x - 30 * s, y - 29 * s, 68 * s, 34 * s);
    ctx.fillStyle = '#c99555';
    ctx.fillRect(x - 35 * s, y - 33 * s, 77 * s, 7 * s);
    ctx.fillStyle = '#7c4a24';
    ctx.fillRect(x - 5 * s, y - 14 * s, 13 * s, 19 * s);
    ctx.fillStyle = '#2563eb';
    ctx.fillRect(x - 25 * s, y - 21 * s, 10 * s, 8 * s);
    if (flood > 0.02) {
      ctx.globalAlpha = 0.2 + flood * 0.55;
      ctx.fillStyle = '#38bdf8';
      ctx.beginPath();
      ctx.ellipse(x + 6 * s, y + 8 * s, 75 * s, 15 * s, 0, 0, TAU);
      ctx.fill();
      ctx.strokeStyle = '#e0f2fe';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(x - 48 * s, y + 5 * s);
      ctx.quadraticCurveTo(x - 15 * s, y, x + 17 * s, y + 6 * s);
      ctx.stroke();
    }
    ctx.restore();
  }

  function anchors(W, H, view) {
    var surface = view === '25d' ? H * 0.48 : H * 0.5;
    return {
      west: {
        village: [W * 0.09, surface - H * 0.025],
        near: [W * 0.22, surface + H * 0.045, W * 0.075, H * 0.055],
        far: [W * 0.37, surface + H * 0.02, W * 0.075, H * 0.052],
        port: [W * 0.145, surface + H * 0.005]
      },
      east: {
        village: [W * 0.91, surface - H * 0.025],
        near: [W * 0.78, surface + H * 0.045, W * 0.075, H * 0.055],
        far: [W * 0.63, surface + H * 0.02, W * 0.075, H * 0.052],
        port: [W * 0.855, surface + H * 0.005]
      },
      wind: { x0: W * 0.78, x1: W * 0.27, y: H * 0.2 },
      surfaceY: [surface + (view === '25d' ? H * 0.025 : 0), surface - (view === '25d' ? H * 0.025 : 0)],
      front: { y0: view === '25d' ? H * 0.62 : surface + H * 0.04, y1: H * 0.94 }
    };
  }

  function normalizeBoard(s) {
    s = s || {};
    return {
      view: s.view === '2d' ? '2d' : '25d',
      t: +s.t || 0,
      wind: q(s.wind), warmE: q(s.warmE), coolW: q(s.coolW), upwell: q(s.upwell),
      fishE: q(s.fishE), fishW: q(s.fishW), rainE: q(s.rainE), rainW: q(s.rainW),
      flood: q(s.flood), drought: q(s.drought), fire: q(s.fire), dimW: q(s.dimW), dimE: q(s.dimE)
    };
  }

  function drawBoardCore(ctx, W, H, s) {
    var a = anchors(W, H, s.view);
    var syW = a.surfaceY[0];
    var syE = a.surfaceY[1];
    var sky = ctx.createLinearGradient(0, 0, 0, H * 0.58);
    sky.addColorStop(0, '#dff4ff');
    sky.addColorStop(1, '#f8fcff');
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, W, H);

    ctx.fillStyle = '#9ec9dc';
    if (s.view === '25d') {
      poly(ctx, [[W * 0.09, syW], [W * 0.18, H * 0.39], [W * 0.83, H * 0.39], [W * 0.91, syE], [W * 0.91, a.front.y0], [W * 0.09, a.front.y0]]);
    } else {
      ctx.fillRect(W * 0.08, syW, W * 0.84, a.front.y1 - syW);
    }
    ctx.fill();

    var cold = ctx.createLinearGradient(W * 0.1, 0, W * 0.9, 0);
    cold.addColorStop(0, '#256b92');
    cold.addColorStop(0.58, '#1675a3');
    cold.addColorStop(1, '#075985');
    ctx.fillStyle = cold;
    if (s.view === '25d') {
      poly(ctx, [[W * 0.09, a.front.y0], [W * 0.91, a.front.y0], [W * 0.91, a.front.y1], [W * 0.09, a.front.y1]]);
      ctx.fill();
    } else {
      ctx.fillRect(W * 0.08, syW + H * 0.04, W * 0.84, a.front.y1 - syW - H * 0.04);
    }

    var warmDepthW = H * (0.19 - 0.075 * s.coolW - 0.035 * s.warmE);
    var warmDepthE = H * (0.025 + 0.13 * s.warmE);
    var warm = ctx.createLinearGradient(W * 0.15, 0, W * 0.87, 0);
    warm.addColorStop(0, '#e95d32');
    warm.addColorStop(0.32, '#e95d32');
    warm.addColorStop(0.48, s.warmE > 0.35 ? '#ee7040' : '#d87953');
    warm.addColorStop(1, s.warmE > 0.6 ? '#f07b49' : '#4ca4c7');
    ctx.fillStyle = warm;
    ctx.beginPath();
    ctx.moveTo(W * 0.09, syW);
    ctx.bezierCurveTo(W * 0.32, syW - H * 0.018, W * 0.68, syE + H * 0.012, W * 0.91, syE);
    ctx.lineTo(W * 0.91, syE + warmDepthE);
    ctx.bezierCurveTo(W * 0.66, syE + warmDepthE + H * 0.03, W * 0.34, syW + warmDepthW - H * 0.015, W * 0.09, syW + warmDepthW);
    ctx.closePath();
    ctx.fill();

    ctx.strokeStyle = 'rgba(255,255,255,0.55)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(W * 0.1, syW + 1);
    ctx.bezierCurveTo(W * 0.34, syW - H * 0.02, W * 0.69, syE + H * 0.015, W * 0.9, syE);
    ctx.stroke();

    fishingZone(ctx, a.west.near);
    fishingZone(ctx, a.west.far);
    fishingZone(ctx, a.east.near);
    fishingZone(ctx, a.east.far);

    if (s.upwell > 0.01) {
      curvedUpwelling(ctx, W * 0.72, syE + H * 0.28, W * 0.875, syE + H * 0.235, W * 0.89, syE + H * 0.025, s.upwell, Math.max(0.58, W / 1366));
    }

    drawWestVillage(ctx, W * 0.075, syW - H * 0.005, Math.max(0.48, Math.min(1.2, W / 1120)), s.drought, s.fire);
    drawEastVillage(ctx, W * 0.925, syE - H * 0.005, Math.max(0.48, Math.min(1.2, W / 1120)), s.flood);

    var westCount = Math.round(s.fishW * 14);
    var eastCount = Math.round(s.fishE * 18);
    var fishSize = Math.max(4, W / 165);
    boardSchool(ctx, a.west.near, a.west.far, westCount, fishSize, '#facc15', 0);
    boardSchool(ctx, a.east.near, a.east.far, eastCount, fishSize, '#34d399', 1);
  }

  function cachePut(key, canvas) {
    cache[key] = canvas;
    cacheOrder.push(key);
    if (cacheOrder.length > cacheLimit) {
      delete cache[cacheOrder.shift()];
    }
  }

  function board(ctx, W, H, state) {
    var s = normalizeBoard(state);
    var key = ['b', W, H, s.view, s.warmE, s.coolW, s.upwell, s.fishE, s.fishW, s.flood, s.drought, s.fire].join('|');
    var cv = cache[key];
    if (!cv) {
      cv = document.createElement('canvas');
      cv.width = W;
      cv.height = H;
      drawBoardCore(cv.getContext('2d'), W, H, s);
      cachePut(key, cv);
    }
    ctx.drawImage(cv, 0, 0, W, H);
    var a = anchors(W, H, s.view);
    var width = 4 + 14 * s.wind;
    var lengthScale = 0.55 + 0.45 * s.wind;
    var wx0 = a.wind.x0;
    var wx1 = wx0 - (wx0 - a.wind.x1) * lengthScale;
    var windY = Math.round(a.wind.y) + 0.5;
    lineArrow(ctx, wx0, windY, wx1, windY, width, '#1d4ed8', 1);
    var streaks = Math.max(1, Math.round(1 + s.wind * 4));
    var i;
    ctx.save();
    ctx.strokeStyle = '#56b4e9';
    ctx.lineWidth = 1.5;
    ctx.globalAlpha = 0.35 + s.wind * 0.5;
    for (i = 0; i < streaks; i += 1) {
      var travel = ((s.t * (18 + 48 * s.wind) + i * 79) % Math.max(30, wx0 - wx1));
      var sx = wx0 - travel;
      var yy = windY + (i - (streaks - 1) / 2) * (width + 6);
      ctx.beginPath();
      ctx.moveTo(sx, yy);
      ctx.lineTo(Math.max(wx1, sx - 22 - s.wind * 18), yy);
      ctx.stroke();
    }
    ctx.restore();
    if (s.rainW > 0) {
      drawCloud(ctx, W * 0.24, H * 0.29, Math.max(0.45, W / 1500), s.rainW > 0.5);
      drawRain(ctx, W * 0.14, W * 0.39, H * 0.31, H * 0.48, s.rainW, s.t);
    }
    if (s.rainE > 0) {
      drawCloud(ctx, W * 0.76, H * 0.29, Math.max(0.45, W / 1500), s.rainE > 0.5);
      drawRain(ctx, W * 0.61, W * 0.87, H * 0.31, H * 0.48, s.rainE, s.t);
    }
    if (s.dimW > 0) {
      ctx.fillStyle = 'rgba(15,23,42,' + (s.dimW * 0.45) + ')';
      ctx.fillRect(0, 0, W * 0.5, H);
    }
    if (s.dimE > 0) {
      ctx.fillStyle = 'rgba(15,23,42,' + (s.dimE * 0.45) + ')';
      ctx.fillRect(W * 0.5, 0, W * 0.5, H);
    }
  }

  function seaAnchors(W, H, side) {
    return {
      far: [W * 0.07, H * 0.08, W * 0.86, H * 0.25],
      near: [W * 0.07, H * 0.38, W * 0.86, H * 0.27],
      port: [W * 0.07, H * 0.7, W * 0.86, H * 0.25]
    };
  }

  function zoneHighlight(ctx, box, active, color) {
    if (!active) {
      return;
    }
    ctx.save();
    rounded(ctx, box[0] - 3, box[1] - 3, box[2] + 6, box[3] + 6, 13);
    ctx.strokeStyle = color;
    ctx.lineWidth = 4;
    ctx.globalAlpha = 0.85;
    ctx.stroke();
    ctx.restore();
  }

  function sea(ctx, W, H, state) {
    var s = state || {};
    var side = s.side === 'west' ? 'west' : 'east';
    var fish = q(s.fish);
    var warmV = q(s.warm);
    var upwell = q(s.upwell);
    var rain = q(s.rain);
    var fire = q(s.fire);
    var flood = q(s.flood);
    var drought = q(s.drought);
    var t = +s.t || 0;
    var a = seaAnchors(W, H, side);
    var g = ctx.createLinearGradient(0, 0, 0, H * 0.68);
    g.addColorStop(0, warmV > 0.5 ? '#d85f43' : '#177fa8');
    g.addColorStop(1, warmV > 0.5 ? '#2e91a7' : '#075985');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H * 0.69);
    ctx.fillStyle = side === 'west' ? '#7f9b50' : '#c3a66b';
    ctx.fillRect(0, H * 0.69, W, H * 0.31);
    ctx.strokeStyle = 'rgba(255,255,255,0.42)';
    ctx.lineWidth = 1.4;
    var wi;
    for (wi = 0; wi < 6; wi += 1) {
      ctx.beginPath();
      ctx.moveTo(W * 0.08 + wi * W * 0.145, H * (0.11 + (wi % 3) * 0.09));
      ctx.quadraticCurveTo(W * (0.13 + wi * 0.145), H * (0.09 + (wi % 3) * 0.09), W * (0.18 + wi * 0.145), H * (0.11 + (wi % 3) * 0.09));
      ctx.stroke();
    }
    ctx.strokeStyle = 'rgba(226,232,240,0.36)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(W * 0.08, H * 0.35);
    ctx.lineTo(W * 0.92, H * 0.35);
    ctx.moveTo(W * 0.08, H * 0.67);
    ctx.lineTo(W * 0.92, H * 0.67);
    ctx.stroke();

    var farCount = Math.round(fish * 18);
    var nearCount = Math.round(fish * 11);
    var i;
    for (i = 0; i < farCount; i += 1) {
      drawFish(ctx, W * (0.13 + (i % 6) * 0.135), H * (0.15 + Math.floor(i / 6) * 0.065), Math.max(3.4, W / 72), '#facc15', i % 2, 0.96);
    }
    for (i = 0; i < nearCount; i += 1) {
      drawFish(ctx, W * (0.18 + (i % 5) * 0.155), H * (0.45 + Math.floor(i / 5) * 0.075), Math.max(3.5, W / 68), '#34d399', i % 2, 0.96);
    }
    if (side === 'east' && upwell > 0.01) {
      curvedUpwelling(ctx, W * 0.57, H * 0.64, W * 0.84, H * 0.61, W * 0.86, H * 0.37, upwell, Math.max(0.72, W / 500));
    }
    if (fire > 0.5) {
      var smoke = ctx.createLinearGradient(0, a.far[1], 0, a.far[1] + a.far[3]);
      smoke.addColorStop(0, 'rgba(71,85,105,' + (0.42 + fire * 0.26) + ')');
      smoke.addColorStop(1, 'rgba(100,116,139,' + (0.25 + fire * 0.24) + ')');
      ctx.fillStyle = smoke;
      rounded(ctx, a.far[0], a.far[1], a.far[2], a.far[3], 10);
      ctx.fill();
      for (i = 0; i < 5; i += 1) {
        circle(ctx, W * (0.2 + i * 0.15) + Math.sin(t * 0.4 + i) * 4, H * (0.12 + (i % 2) * 0.06), W * (0.055 + (i % 2) * 0.016), 'rgba(100,116,139,0.18)');
      }
    }

    if (side === 'west') {
      drawWestVillage(ctx, W * 0.5, H * 0.88, Math.min(0.9, W / 430), drought, fire);
    } else {
      drawEastVillage(ctx, W * 0.5, H * 0.89, Math.min(0.9, W / 430), flood);
    }
    if (rain > 0) {
      drawCloud(ctx, W * 0.5, H * 0.72, Math.min(0.6, W / 620), rain > 0.5);
      drawRain(ctx, W * 0.25, W * 0.75, H * 0.74, H * 0.93, rain, t);
    }
    zoneHighlight(ctx, a.far, s.sel === 'far', '#a78bfa');
    zoneHighlight(ctx, a.near, s.sel === 'near', '#facc15');
    zoneHighlight(ctx, a.port, s.sel === 'rest', '#34d399');
  }

  function strip(ctx, W, H, state) {
    var s = state || {};
    var wind = q(s.wind);
    var warmE = q(s.warmE);
    var coolW = q(s.coolW);
    var grad = ctx.createLinearGradient(0, 0, W, 0);
    grad.addColorStop(0, coolW > 0.3 ? '#3890b5' : '#e6633f');
    grad.addColorStop(0.5, warmE > 0.4 ? '#ed7147' : '#3b95b8');
    grad.addColorStop(1, warmE > 0.25 ? '#f07b49' : '#1c82ad');
    ctx.fillStyle = grad;
    rounded(ctx, 1, 1, W - 2, H - 2, H * 0.22);
    ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,0.6)';
    ctx.lineWidth = 1;
    ctx.stroke();
    lineArrow(ctx, W * 0.72, H * 0.35, W * (0.34 + 0.18 * (1 - wind)), H * 0.35, 2 + wind * 7, '#ffffff', 0.9);
    var markerX = s.side === 'west' ? W * 0.1 : W * 0.9;
    ctx.strokeStyle = '#ffffff';
    ctx.fillStyle = s.side === 'west' ? '#34d399' : '#facc15';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(markerX, H * 0.7, H * 0.13, 0, TAU);
    ctx.fill();
    ctx.stroke();
  }

  function boat(ctx, x, y, size, state) {
    var s = state || {};
    var k = Math.max(0, Math.min(14, Math.round(+s.k || 0)));
    var out = s.state === 'out';
    var stateName = s.state || 'port';
    var t = +s.t || 0;
    var scale = size / 28;
    var bob = stateName === 'near' || stateName === 'far' ? Math.sin(t * 2.2 + k * 0.7) * scale : 0;
    var color = out ? '#7b8794' : palette[k];
    ctx.save();
    ctx.translate(x, y + bob);
    if (s.me) {
      ctx.strokeStyle = '#facc15';
      ctx.lineWidth = Math.max(2, size * 0.1);
      ctx.globalAlpha = 0.9;
      ctx.beginPath();
      ctx.arc(0, 0, size * 0.72, 0, TAU);
      ctx.stroke();
    }
    if ((stateName === 'near' || stateName === 'far') && !out) {
      ctx.strokeStyle = 'rgba(255,255,255,0.7)';
      ctx.lineWidth = Math.max(1, scale * 1.4);
      ctx.beginPath();
      ctx.moveTo(-size * 0.8, size * 0.28);
      ctx.quadraticCurveTo(-size * 0.55, size * (0.12 + Math.sin(t * 3) * 0.04), -size * 0.3, size * 0.25);
      ctx.moveTo(-size * 0.92, size * 0.42);
      ctx.quadraticCurveTo(-size * 0.66, size * 0.28, -size * 0.42, size * 0.39);
      ctx.stroke();
    }
    ctx.rotate(out ? -0.28 : 0);
    ctx.fillStyle = color;
    poly(ctx, [[-size * 0.48, size * 0.08], [size * 0.5, size * 0.08], [size * 0.3, size * 0.4], [-size * 0.3, size * 0.4]]);
    ctx.fill();
    ctx.strokeStyle = out ? '#5f6b7a' : '#334155';
    ctx.lineWidth = Math.max(1, scale * 1.4);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(0, size * 0.08);
    ctx.lineTo(0, -size * 0.48);
    ctx.stroke();
    if (!out) {
      ctx.fillStyle = k % 2 ? '#f8fafc' : '#fef3c7';
      if (k % 3 === 0) {
        poly(ctx, [[0, -size * 0.45], [size * 0.38, -size * 0.08], [0, -size * 0.08]]);
      } else if (k % 3 === 1) {
        poly(ctx, [[0, -size * 0.45], [-size * 0.32, -size * 0.08], [0, -size * 0.08]]);
      } else {
        poly(ctx, [[0, -size * 0.45], [size * 0.28, -size * 0.19], [0, -size * 0.08], [-size * 0.2, -size * 0.22]]);
      }
      ctx.fill();
      ctx.stroke();
    }
    if (stateName === 'port') {
      ctx.strokeStyle = '#7c4a24';
      ctx.lineWidth = Math.max(1, scale);
      ctx.beginPath();
      ctx.moveTo(size * 0.43, size * 0.32);
      ctx.quadraticCurveTo(size * 0.72, size * 0.56, size * 0.83, size * 0.24);
      ctx.stroke();
    }
    ctx.restore();
  }

  function cardBase(ctx, x, y, w, h, edge, bg) {
    ctx.save();
    rounded(ctx, x, y, w, h, Math.min(22, Math.min(w, h) * 0.09));
    ctx.fillStyle = bg;
    ctx.fill();
    ctx.strokeStyle = edge;
    ctx.lineWidth = Math.max(2, Math.min(w, h) * 0.014);
    ctx.stroke();
    ctx.clip();
  }

  function cardHouse(ctx, cx, cy, s, east) {
    ctx.fillStyle = east ? '#d6b87a' : '#f1c27d';
    ctx.fillRect(cx - 25 * s, cy - 12 * s, 50 * s, 30 * s);
    ctx.fillStyle = east ? '#c99555' : '#b45309';
    if (east) {
      ctx.fillRect(cx - 29 * s, cy - 17 * s, 58 * s, 7 * s);
    } else {
      poly(ctx, [[cx - 31 * s, cy - 12 * s], [cx, cy - 38 * s], [cx + 31 * s, cy - 12 * s]]);
    }
    ctx.fill();
    ctx.fillStyle = '#7c4a24';
    ctx.fillRect(cx - 6 * s, cy + 1 * s, 12 * s, 17 * s);
  }

  function card(ctx, x, y, w, h, state) {
    var s = state || {};
    var kind = s.kind;
    var t = +s.t || 0;
    var cx = x + w / 2;
    var cy = y + h / 2;
    var z = Math.min(w, h) / 168;
    var i;
    var edge = kind === 'flood' || kind === 'warm' ? '#1d4ed8' : kind === 'eco' ? '#15803d' : kind === 'price' ? '#6d28d9' : '#b45309';
    var bg = kind === 'warm' ? '#cfeaf5' : kind === 'eco' ? '#dff3eb' : kind === 'flood' ? '#d8ebf3' : kind === 'drought' ? '#f3d6a0' : kind === 'fire' ? '#f0c995' : '#eee9fa';
    cardBase(ctx, x, y, w, h, edge, bg);
    if (kind === 'warm') {
      ctx.fillStyle = '#b9def0';
      ctx.fillRect(x, y + h * 0.17, w, h * 0.34);
      ctx.fillStyle = '#075985';
      ctx.fillRect(x, y + h * 0.43, w, h * 0.57);
      ctx.fillStyle = '#f97316';
      ctx.beginPath();
      ctx.moveTo(x, y + h * 0.43);
      ctx.bezierCurveTo(x + w * 0.35, y + h * 0.39 + Math.sin(t * 0.7) * 2 * z, x + w * 0.68, y + h * 0.48, x + w, y + h * 0.4);
      ctx.lineTo(x + w, y + h * 0.69);
      ctx.bezierCurveTo(x + w * 0.65, y + h * 0.76, x + w * 0.31, y + h * 0.64, x, y + h * 0.78);
      ctx.closePath();
      ctx.fill();
      curvedUpwelling(ctx, cx + 2 * z, y + h * 0.86, cx + 49 * z, y + h * 0.8, cx + 52 * z, y + h * 0.57, 0.22, 0.82 * z);
      ctx.strokeStyle = '#b91c1c';
      ctx.lineWidth = 5.5 * z;
      ctx.beginPath();
      ctx.moveTo(cx + 28 * z, y + h * 0.58);
      ctx.lineTo(cx + 66 * z, y + h * 0.79);
      ctx.stroke();
    } else if (kind === 'eco') {
      ctx.fillStyle = '#0f5c8c';
      ctx.fillRect(x, y + h * 0.43, w, h * 0.57);
      ctx.strokeStyle = '#cbd5e1';
      ctx.lineWidth = 2 * z;
      ctx.beginPath();
      ctx.moveTo(cx - 55 * z, cy - 45 * z);
      ctx.quadraticCurveTo(cx, cy + 55 * z, cx + 56 * z, cy - 45 * z);
      ctx.stroke();
      for (i = 0; i < 5; i += 1) {
        ctx.beginPath();
        ctx.moveTo(cx - 42 * z + i * 20 * z, cy - 21 * z);
        ctx.lineTo(cx - 28 * z + i * 10 * z, cy + 30 * z);
        ctx.stroke();
      }
      drawFish(ctx, cx + 42 * z, cy + 39 * z, 10 * z, '#facc15', 0, 1);
      drawFish(ctx, cx - 36 * z, cy + 58 * z, 8 * z, '#34d399', 1, 1);
    } else if (kind === 'flood') {
      cardHouse(ctx, cx, cy + 15 * z, z, 1);
      drawCloud(ctx, cx, cy - 62 * z, z * 0.9, 1);
      drawRain(ctx, cx - 55 * z, cx + 55 * z, cy - 47 * z, cy + 2 * z, 1, t);
      ctx.fillStyle = 'rgba(56,189,248,0.72)';
      ctx.beginPath();
      ctx.ellipse(cx, cy + 60 * z, 75 * z, 26 * z, 0, 0, TAU);
      ctx.fill();
    } else if (kind === 'drought') {
      ctx.fillStyle = '#d6a85e';
      ctx.fillRect(x, y + h * 0.34, w, h * 0.66);
      ctx.strokeStyle = 'rgba(255,255,255,0.55)';
      ctx.lineWidth = 3 * z;
      ctx.beginPath();
      ctx.moveTo(x + w * 0.14 + Math.sin(t * 0.45) * 2 * z, y + h * 0.23);
      ctx.quadraticCurveTo(cx, y + h * 0.18, x + w * 0.86, y + h * 0.24);
      ctx.stroke();
      ctx.strokeStyle = '#8a4b20';
      ctx.lineWidth = 3 * z;
      for (i = 0; i < 6; i += 1) {
        ctx.beginPath();
        ctx.moveTo(cx - 70 * z + i * 28 * z, y + h * 0.43);
        ctx.lineTo(cx - 58 * z + i * 25 * z, y + h * 0.62);
        ctx.lineTo(cx - 72 * z + i * 28 * z, y + h * 0.82);
        ctx.stroke();
      }
      ctx.fillStyle = '#b87333';
      ctx.beginPath();
      ctx.ellipse(cx + 43 * z, y + h * 0.49, 28 * z, 39 * z, 0, 0, TAU);
      ctx.fill();
      ctx.fillStyle = '#f8fafc';
      ctx.fillRect(cx + 30 * z, y + h * 0.49 - 43 * z, 26 * z, 11 * z);
      ctx.fillStyle = '#7c4a24';
      ctx.fillRect(cx - 42 * z, y + h * 0.41, 6 * z, 58 * z);
      ctx.strokeStyle = '#8c6a35';
      ctx.beginPath();
      ctx.moveTo(cx - 39 * z, y + h * 0.45);
      ctx.lineTo(cx - 68 * z, y + h * 0.3);
      ctx.moveTo(cx - 39 * z, y + h * 0.52);
      ctx.lineTo(cx - 15 * z, y + h * 0.35);
      ctx.stroke();
    } else if (kind === 'fire') {
      ctx.fillStyle = '#6e8b4a';
      poly(ctx, [[x, cy + 45 * z], [cx - 55 * z, cy - 18 * z], [cx - 10 * z, cy + 20 * z], [cx + 35 * z, cy - 42 * z], [x + w, cy + 45 * z]]);
      ctx.fill();
      ctx.fillStyle = '#f97316';
      for (i = 0; i < 5; i += 1) {
        poly(ctx, [[cx - 61 * z + i * 29 * z, cy + 45 * z], [cx - 49 * z + i * 29 * z, cy - (18 + (i % 2) * 18) * z], [cx - 36 * z + i * 29 * z, cy + 45 * z]]);
        ctx.fill();
      }
      ctx.fillStyle = '#94a3b8';
      for (i = 0; i < 4; i += 1) {
        circle(ctx, cx - 40 * z + i * 27 * z + Math.sin(t * 0.5 + i) * 5 * z, cy - 58 * z - (i % 2) * 15 * z, 19 * z, 'rgba(100,116,139,0.5)');
      }
      cardHouse(ctx, cx, cy + 77 * z, z * 0.62, 0);
    } else {
      ctx.fillStyle = '#e2e8f0';
      rounded(ctx, cx - 61 * z, cy - 16 * z, 92 * z, 61 * z, 8 * z);
      ctx.fill();
      ctx.strokeStyle = '#6d28d9';
      ctx.lineWidth = 4 * z;
      ctx.stroke();
      for (i = 0; i < 4; i += 1) {
        circle(ctx, cx - 45 * z + i * 27 * z, cy + 62 * z - i * 5 * z, 12 * z, '#facc15');
        ctx.strokeStyle = '#b45309';
        ctx.lineWidth = 2 * z;
        ctx.stroke();
      }
      lineArrow(ctx, cx + 50 * z, cy + 48 * z, cx + 50 * z, cy - 60 * z - Math.sin(t) * 3 * z, 11 * z, '#6d28d9', 1);
      ctx.strokeStyle = '#6d28d9';
      ctx.lineWidth = 4 * z;
      ctx.beginPath();
      ctx.moveTo(cx - 44 * z, cy - 17 * z);
      ctx.lineTo(cx - 30 * z, cy + 9 * z);
      ctx.lineTo(cx + 15 * z, cy + 9 * z);
      ctx.lineTo(cx + 28 * z, cy - 17 * z);
      ctx.stroke();
    }
    ctx.restore();
  }

  function svgWrap(size, body, opt) {
    var n = Math.max(8, +size || 28);
    return '<svg width="' + n + '" height="' + n + '" viewBox="0 0 28 28" role="img" aria-hidden="true">' + body + '</svg>';
  }

  function iconPath(body) {
    return function (size, opt) { return svgWrap(size, body, opt); };
  }

  var svg = {
    stamina: iconPath('<path d="M14 24C6 19 2 14 4 8c2-5 8-4 10 0 2-4 8-5 10 0 2 6-2 11-10 16Z" fill="#b91c1c"/><path d="M8 13h3l2-4 3 8 2-4h3" fill="none" stroke="white" stroke-width="2" stroke-linecap="round"/>'),
    fish: iconPath('<path d="M5 14 1 9v10l4-5c4-7 13-7 20 0-7 7-16 7-20 0Z" fill="currentColor"/><circle cx="20" cy="12" r="1.3" fill="white"/>'),
    fishSmall: iconPath('<path d="M8 14 4 10v8l4-4c3-5 9-5 15 0-6 5-12 5-15 0Z" fill="currentColor"/><circle cx="19" cy="12.8" r="1" fill="white"/>'),
    store: iconPath('<path d="M4 11h20v13H4Z" fill="#d6b87a" stroke="currentColor" stroke-width="1.5"/><path d="M2 11 5 5h18l3 6" fill="#facc15" stroke="currentColor" stroke-width="1.5"/><path d="M11 16h6v8h-6Z" fill="#7c4a24"/>'),
    signal: iconPath('<path d="M14 23V8" stroke="currentColor" stroke-width="2" stroke-linecap="round"/><circle cx="14" cy="6" r="2.5" fill="#facc15"/><path d="M9 10a6 6 0 0 1 0-8M19 10a6 6 0 0 0 0-8M6 13a10 10 0 0 1 0-14M22 13a10 10 0 0 0 0-14" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"/>'),
    near: iconPath('<path d="M3 18c4-4 7 4 11 0s7 4 11 0" fill="none" stroke="currentColor" stroke-width="2"/><path d="M5 10h8l3 5H7Z" fill="#facc15" stroke="currentColor" stroke-width="1.3"/><circle cx="7" cy="22" r="2" fill="#34d399"/>'),
    far: iconPath('<path d="M2 20c4-4 7 4 11 0s7 4 13 0" fill="none" stroke="currentColor" stroke-width="2"/><path d="M15 6h8l3 6h-9Z" fill="#a78bfa" stroke="currentColor" stroke-width="1.3"/><path d="M5 7 8 4l3 3" fill="none" stroke="currentColor" stroke-width="1.5"/>'),
    rest: iconPath('<path d="m3 13 11-9 11 9v11H3Z" fill="#d6b87a" stroke="currentColor" stroke-width="1.5"/><path d="M11 24v-7h6v7" fill="#7c4a24"/><path d="M6 13h16" stroke="#f8fafc" stroke-width="2"/>'),
    timer: iconPath('<circle cx="14" cy="15" r="9" fill="none" stroke="currentColor" stroke-width="2"/><path d="M11 3h6M14 6v9l5 3" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>'),
    turn: iconPath('<rect x="4" y="5" width="20" height="19" rx="3" fill="none" stroke="currentColor" stroke-width="2"/><path d="M8 3v5M20 3v5M4 10h20" stroke="currentColor" stroke-width="2"/><circle cx="10" cy="15" r="2" fill="#56b4e9"/><circle cx="18" cy="19" r="2" fill="#34d399"/>'),
    people: iconPath('<circle cx="9" cy="9" r="4" fill="#56b4e9"/><circle cx="20" cy="10" r="3.5" fill="#a78bfa"/><path d="M2 24c0-6 3-9 7-9s7 3 7 9M14 24c0-5 2-8 6-8s6 3 6 8" fill="none" stroke="currentColor" stroke-width="2"/><path d="M11 13h6" stroke="#34d399" stroke-width="2"/>'),
    out: iconPath('<path d="M5 19h18l-4 5H9Z" fill="#94a3b8" stroke="currentColor" stroke-width="1.5"/><path d="M14 18V7M14 7l7 6H14" fill="none" stroke="#64748b" stroke-width="2"/><path d="M5 5 23 23" stroke="#b91c1c" stroke-width="2.5" stroke-linecap="round"/>'),
    crown: iconPath('<path d="m3 8 6 6 5-9 5 9 6-6-3 15H6Z" fill="#facc15" stroke="#b45309" stroke-width="1.5"/><circle cx="14" cy="5" r="2" fill="#a78bfa"/>'),
    wind: iconPath('<path d="M25 8H8l4-4M8 8l4 4M23 15H4l4-4M4 15l4 4M20 22H9" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/>'),
    windWeak: iconPath('<path d="M24 9H12l3-3M12 9l3 3M19 18H7l3-3M7 18l3 3" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/><path d="M22 4v20" stroke="#b91c1c" stroke-width="2" stroke-dasharray="3 3"/>'),
    westVillage: iconPath('<path d="M2 23h24" stroke="#15803d" stroke-width="3"/><path d="M7 20V9l5-4 5 4v11" fill="#f1c27d" stroke="currentColor" stroke-width="1.5"/><path d="M5 10 12 3l7 7" fill="#b45309"/><path d="M22 22c0-8 1-13 3-17M25 5l-5 2M25 5l2 4" stroke="#15803d" stroke-width="1.8" stroke-linecap="round"/>'),
    eastVillage: iconPath('<path d="M2 23h24" stroke="#b45309" stroke-width="3"/><path d="m2 18 5-12 5 9 5-13 8 16" fill="#c3a66b"/><path d="M8 12h12v10H8Z" fill="#d6b87a" stroke="currentColor" stroke-width="1.5"/><path d="M7 12h14" stroke="#c99555" stroke-width="3"/>'),
    play: iconPath('<circle cx="14" cy="14" r="12" fill="#15803d"/><path d="m11 8 9 6-9 6Z" fill="white"/>'),
    pause: iconPath('<circle cx="14" cy="14" r="12" fill="#b45309"/><path d="M9 8h4v12H9ZM16 8h4v12h-4Z" fill="white"/>'),
    elnino: iconPath('<path d="M2 20h24" stroke="#1d4ed8" stroke-width="3"/><path d="M3 18c6-8 13 2 22-7v9H3Z" fill="#f97316"/><path d="M24 5H10l3-3M10 5l3 3" fill="none" stroke="#5f6b7a" stroke-width="1.4"/><path d="M4 11h8" stroke="#5f6b7a" stroke-width="1"/>'),
    warm: iconPath('<path d="M2 20h24v6H2Z" fill="#1d4ed8"/><path d="M2 20c8-11 16 2 24-8v8Z" fill="#f97316"/><path d="M20 11V4" stroke="#93c5fd" stroke-width="2"/><path d="m17 7 3-3 3 3M16 3l8 8" stroke="#b91c1c" stroke-width="2"/>'),
    eco: iconPath('<path d="M4 5c5 14 15 14 20 0M7 10h14M9 15h10" fill="none" stroke="currentColor" stroke-width="1.5"/><path d="M18 21c3-3 6-2 8 0-2 2-5 3-8 0Z" fill="#34d399"/>'),
    flood: iconPath('<path d="m5 13 9-7 9 7v9H5Z" fill="#d6b87a"/><path d="M2 21c4-4 7 4 11 0s7 4 13 0v5H2Z" fill="#56b4e9"/><path d="M6 5h2M12 2h2M18 5h2" stroke="#1d4ed8" stroke-width="2"/>'),
    drought: iconPath('<path d="M2 20h24v6H2Z" fill="#d6a85e"/><path d="m5 20 4 3-3 3M14 20l-3 3 4 3M21 20l-3 3" fill="none" stroke="#8a4b20" stroke-width="1.5"/><path d="M14 4c5 7 5 11 0 13-5-2-5-6 0-13Z" fill="none" stroke="#b45309" stroke-width="2"/>'),
    fire: iconPath('<path d="M14 25C4 22 6 12 12 4c0 6 4 5 4 10 2-3 4-5 4-8 6 9 5 17-6 19Z" fill="#f97316"/><path d="M14 23c-5-2-3-7 0-11 0 3 3 4 2 7 2-1 2-2 3-4 1 5-1 7-5 8Z" fill="#facc15"/>'),
    price: iconPath('<circle cx="7" cy="22" r="4" fill="#facc15" stroke="#b45309"/><circle cx="13" cy="18" r="4" fill="#facc15" stroke="#b45309"/><path d="M4 13h10l3 6H6Z" fill="#e2e8f0" stroke="currentColor"/><path d="M21 19V4M16 9l5-5 5 5" fill="none" stroke="#6d28d9" stroke-width="3" stroke-linecap="round"/>' )
  };

  function info() {
    return { cacheEntries: cacheOrder.length };
  }

  root.ELNINO_ART = {
    contract: 1,
    version: '1.1.0',
    board: board,
    anchors: anchors,
    sea: sea,
    seaAnchors: seaAnchors,
    strip: strip,
    boat: boat,
    card: card,
    svg: svg,
    info: info
  };
}(window));
