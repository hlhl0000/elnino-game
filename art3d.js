(function (global) {
  'use strict';

  var TAU = Math.PI * 2;
  var ZUP = new THREE.Vector3(0, 1, 0);
  var TOON_RAMP = null;

  function clamp(v) {
    return v < 0 ? 0 : (v > 1 ? 1 : v);
  }

  function num(v, d) {
    return typeof v === 'number' && isFinite(v) ? v : d;
  }

  function hash(n) {
    var x = Math.sin(n * 127.1 + 311.7) * 43758.5453123;
    return x - Math.floor(x);
  }

  function mat(color, rough, shine) {
    return new THREE.MeshToonMaterial({
      color: color,
      flatShading: rough !== false,
      side: THREE.DoubleSide,
      gradientMap: TOON_RAMP,
      emissive: new THREE.Color(color).multiplyScalar(0.035)
    });
  }

  function makeRampTexture() {
    var data = new Uint8Array([
      50, 60, 72, 255,
      142, 154, 165, 255,
      232, 224, 203, 255
    ]);
    var texture = new THREE.DataTexture(data, 3, 1, THREE.RGBAFormat);
    texture.minFilter = THREE.NearestFilter;
    texture.magFilter = THREE.NearestFilter;
    texture.generateMipmaps = false;
    texture.needsUpdate = true;
    return texture;
  }

  function fadeMat(color, opacity) {
    return new THREE.MeshPhongMaterial({
      color: color,
      transparent: true,
      opacity: opacity,
      depthWrite: false,
      shininess: 26,
      side: THREE.DoubleSide
    });
  }

  function basic(color, opacity) {
    return new THREE.MeshBasicMaterial({
      color: color,
      transparent: opacity < 1,
      opacity: opacity,
      depthWrite: opacity >= 1,
      side: THREE.DoubleSide
    });
  }

  function outlineMat() {
    var material = new THREE.MeshBasicMaterial({
      color: 0x13294b,
      side: THREE.BackSide,
      depthWrite: true,
      toneMapped: false
    });
    return material;
  }

  function terrainMaterial() {
    return new THREE.MeshToonMaterial({
      color: 0xa8a8a8,   /* 조명 합이 커서 정점색이 바래던 것(민트 · 연모래) — 밝기만 낮춤 */
      vertexColors: true,
      flatShading: true,
      side: THREE.DoubleSide,
      gradientMap: TOON_RAMP,
      emissive: new THREE.Color(0x16251b).multiplyScalar(0.035)
    });
  }

  function addBox(scene, geo, material, x, y, z, sx, sy, sz) {
    var o = new THREE.Mesh(geo, material);
    o.position.set(x, y, z);
    o.scale.set(sx, sy, sz);
    scene.add(o);
    return o;
  }

  function makeInstance(scene, geometry, material, count) {
    var o = new THREE.InstancedMesh(geometry, material, count);
    o.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    o.frustumCulled = false;
    scene.add(o);
    return o;
  }

  function triangleGeometry(w, h) {
    var g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute([
      -w * 0.5, -h * 0.5, 0,
      w * 0.5, -h * 0.5, 0,
      -w * 0.5, h * 0.5, 0
    ], 3));
    g.computeVertexNormals();
    return g;
  }

  function fishGeometry() {
    var g = new THREE.BufferGeometry();
    var p = [];
    var tone = [];
    var segments = 16;
    var i;
    var a0;
    var a1;
    function tri(a, b, c, t) {
      p.push(a[0],a[1],a[2], b[0],b[1],b[2], c[0],c[1],c[2]);
      tone.push(t,t,t);
    }
    for (i = 0; i < segments; i += 1) {
      a0 = i / segments * TAU;
      a1 = (i + 1) / segments * TAU;
      tri([0,0,0], [Math.cos(a0) * 0.34, Math.sin(a0) * 0.16, 0],
        [Math.cos(a1) * 0.34, Math.sin(a1) * 0.16, 0], i < 8 ? 0.86 : 0.55);
    }
    tri([0.29,0,0],[0.56,0.19,0],[0.56,-0.19,0],0.32);
    g.setAttribute('position', new THREE.Float32BufferAttribute([
    ].concat(p), 3));
    g.setAttribute('aTone', new THREE.Float32BufferAttribute(tone, 1));
    g.computeVertexNormals();
    return g;
  }

  function terrainGeometry(west) {
    var g = new THREE.BufferGeometry();
    var cols = 15;
    var rows = 8;
    var p = [];
    var c = [];
    var indices = [];
    var ix;
    var iz;
    var x;
    var z;
    var y;
    var h1;
    var h2;
    var color = new THREE.Color();
    for (iz = 0; iz < rows; iz += 1) {
      z = -15 + iz * (17 / (rows - 1));
      for (ix = 0; ix < cols; ix += 1) {
        x = -6.5 + ix * (13 / (cols - 1));
        h1 = Math.exp(-Math.pow((x + 2.1) / 2.8, 2) - Math.pow((z + 6.2) / 7.5, 2));
        h2 = Math.exp(-Math.pow((x - 2.4) / 2.4, 2) - Math.pow((z + 9.0) / 5.8, 2));
        y = 0.05 + h1 * (west ? 3.4 : 3.05) + h2 * (west ? 2.55 : 3.8);
        y += Math.sin(x * 0.85 + z * 0.18) * (west ? 0.24 : 0.34);
        var vx = x - (west ? 2.6 : -2.8), vz = z + 0.1, vd = Math.sqrt(vx * vx + vz * vz);
        var flat = Math.min(1, Math.max(0, (vd - 1.6) / 2.4));
        y = 0.12 + (y - 0.12) * flat * flat * (3 - 2 * flat);   /* 마을 자리(반지름 ≈ 1.6~4) */
        p.push(x, y, z);
        if (west) {
          color.set(ix % 3 === 0 ? 0x1f6b3c : (iz % 2 ? 0x2f8a45 : 0x267a3c));   /* 밀림 — 조명에 바래 민트색이 되던 것 진하게 */
        } else {
          color.set(ix % 3 === 0 ? 0xb87832 : (iz % 2 ? 0xd29b4b : 0x9f6b31));
        }
        c.push(color.r, color.g, color.b);
      }
    }
    for (iz = 0; iz < rows - 1; iz += 1) {
      for (ix = 0; ix < cols - 1; ix += 1) {
        var a = iz * cols + ix;
        var b = a + 1;
        var d = (iz + 1) * cols + ix;
        var e = d + 1;
        indices.push(a, d, b, b, d, e);
      }
    }
    g.setAttribute('position', new THREE.Float32BufferAttribute(p, 3));
    g.setAttribute('color', new THREE.Float32BufferAttribute(c, 3));
    g.setIndex(indices);
    g.computeVertexNormals();
    return g;
  }

  function fishMaterial(color) {
    return new THREE.ShaderMaterial({
      transparent: true,
      depthTest: false,
      depthWrite: false,
      toneMapped: false,
      side: THREE.DoubleSide,
      uniforms: {uTime: {value: 0}, uColor: {value: new THREE.Color(color)}},
      vertexShader: [
        'uniform float uTime;',
        'attribute float aTone; varying float vLight; varying float vTone;',
        'void main(){',
        'vec3 p=position;',
        'float seed=instanceMatrix[3].x*1.7+instanceMatrix[3].z*.9;',
        'float tail=smoothstep(.22,.5,p.x);',
        'p.y+=sin(uTime*7.0+seed+p.x*16.0)*.075*tail;',
        'vLight=.9+.1*abs(sin(seed+uTime*1.7)); vTone=aTone;',
        'gl_Position=projectionMatrix*modelViewMatrix*instanceMatrix*vec4(p,1.0);',
        '}'
      ].join('\n'),
      fragmentShader: [
        'precision mediump float; uniform vec3 uColor; varying float vLight; varying float vTone;',
        'void main(){vec3 dark=uColor*.42;vec3 pale=mix(uColor,vec3(1.0,.92,.62),.34);vec3 c=mix(dark,pale,vTone);gl_FragColor=vec4(c*vLight,1.0);}'
      ].join('\n')
    });
  }

  function hullStations() {
    var st = [];
    var n = 10;
    var i;
    var u;
    var w;
    for (i = 0; i <= n; i += 1) {
      u = i / n;
      w = u <= 0.36 ? 0.205 + 0.055 * Math.sin(u / 0.36 * Math.PI * 0.5) : 0.26 * Math.sqrt(Math.max(0, 1 - Math.pow((u - 0.36) / 0.64, 2)));
      st.push({x: -0.58 + 1.2 * u, w: w, top: 0.06 + 0.11 * Math.pow(u, 2.2), keel: -0.2 + 0.13 * Math.pow(u, 2.6)});
    }
    return st;
  }

  function hullGeometry() {
    var g = new THREE.BufferGeometry();
    var p = [];
    var st = hullStations();
    var i;
    var k;
    function sec(o) {
      var mid = o.top - (o.top - o.keel) * 0.55;
      return [[o.x, o.top, -o.w], [o.x, mid, -o.w * 0.86], [o.x, o.keel, 0], [o.x, mid, o.w * 0.86], [o.x, o.top, o.w]];
    }
    function tri(a, b, c) { p.push(a[0], a[1], a[2], b[0], b[1], b[2], c[0], c[1], c[2]); }
    for (i = 0; i < st.length - 1; i += 1) {
      var A = sec(st[i]);
      var B = sec(st[i + 1]);
      for (k = 0; k < 4; k += 1) {
        tri(A[k], B[k], A[k + 1]);
        tri(A[k + 1], B[k], B[k + 1]);
      }
    }
    var T = sec(st[0]);
    var c = [st[0].x, (st[0].top + st[0].keel) * 0.5, 0];
    for (k = 0; k < 4; k += 1) {
      tri(c, T[k + 1], T[k]);
    }
    g.setAttribute('position', new THREE.Float32BufferAttribute(p, 3));
    g.computeVertexNormals();
    return g;
  }

  function deckGeometry() {
    var g = new THREE.BufferGeometry();
    var p = [];
    var st = hullStations();
    var i;
    for (i = 0; i < st.length - 1; i += 1) {
      var a = st[i];
      var b = st[i + 1];
      var ya = a.top - 0.012;
      var yb = b.top - 0.012;
      p.push(a.x, ya, -a.w * 0.94, b.x, yb, -b.w * 0.94, a.x, ya, a.w * 0.94);
      p.push(a.x, ya, a.w * 0.94, b.x, yb, -b.w * 0.94, b.x, yb, b.w * 0.94);
    }
    g.setAttribute('position', new THREE.Float32BufferAttribute(p, 3));
    g.computeVertexNormals();
    return g;
  }

  function pinGeometry() {
    var pts = [new THREE.Vector2(0, 0)];
    var r = 0.45;
    var a0 = -Math.asin(r) - (Math.PI * 0.5 - Math.asin(r)) + Math.PI * 0.5;
    var i;
    var a;
    a0 = -(Math.PI * 0.5 - Math.asin(r));
    for (i = 0; i <= 12; i += 1) {
      a = a0 + (Math.PI * 0.5 - a0) * i / 12;
      pts.push(new THREE.Vector2(Math.max(0.0001, r * Math.cos(a)), 1.0 + r * Math.sin(a)));
    }
    return new THREE.LatheGeometry(pts, 18);
  }

  function sailGeometry() {
    var g = new THREE.BufferGeometry();
    var p = [];
    var i;
    var y0;
    var y1;
    var x0;
    var x1;
    for (i = 0; i < 4; i += 1) {
      y0 = i / 4;
      y1 = (i + 1) / 4;
      x0 = (1 - y0) * (0.55 + Math.sin(y0 * Math.PI) * 0.08);
      x1 = (1 - y1) * (0.55 + Math.sin(y1 * Math.PI) * 0.08);
      p.push(0,y0,0, x0,y0,0.025, 0,y1,0);
      p.push(x0,y0,0.025, x1,y1,0.025, 0,y1,0);
    }
    g.setAttribute('position', new THREE.Float32BufferAttribute(p, 3));
    g.computeVertexNormals();
    return g;
  }

  function makeSkyTexture() {
    var c = global.document.createElement('canvas');
    var x = c.getContext('2d');
    var g;
    var sun;
    c.width = 256;
    c.height = 256;
    g = x.createLinearGradient(0, 0, 0, 256);
    g.addColorStop(0, '#62c8df');
    g.addColorStop(0.12, '#9de1e4');
    g.addColorStop(0.26, '#ffe0ad');
    g.addColorStop(1, '#f2d3a5');
    x.fillStyle = g;
    x.fillRect(0, 0, 256, 256);
    sun = x.createRadialGradient(184, 40, 2, 184, 40, 45);
    sun.addColorStop(0, 'rgba(255,247,204,.92)');
    sun.addColorStop(0.18, 'rgba(255,219,151,.44)');
    sun.addColorStop(1, 'rgba(255,190,111,0)');
    x.fillStyle = sun;
    x.fillRect(130, 0, 120, 100);
    g = new THREE.CanvasTexture(c);
    g.encoding = THREE.sRGBEncoding;
    g.minFilter = THREE.LinearFilter;
    g.magFilter = THREE.LinearFilter;
    return g;
  }

  function waterMaterial() {
    return new THREE.ShaderMaterial({
      transparent: true,
      opacity: 0.96,
      depthWrite: false,
      side: THREE.DoubleSide,
      uniforms: {
        uTime: {value: 0},
        uWarm: {value: 0},
        uWarmK: {value: 0.36},
        uCoolW: {value: 0},
        uSun: {value: new THREE.Vector3(-0.4, 0.82, 0.36)}
      },
      vertexShader: [
        'varying vec2 vUv;',
        'varying vec3 vWorld;',
        'void main(){',
        'vUv=uv; vec4 w=modelMatrix*vec4(position,1.0); vWorld=w.xyz;',
        'gl_Position=projectionMatrix*viewMatrix*w;',
        '}'
      ].join('\n'),
      fragmentShader: [
        'precision mediump float;',
        'uniform float uTime; uniform float uWarm; uniform float uWarmK; uniform float uCoolW; uniform vec3 uSun;',
        'varying vec2 vUv; varying vec3 vWorld;',
        'void main(){',
        'float w1=sin(vWorld.x*1.35+uTime*1.4)+sin(vWorld.z*1.9-uTime*1.05);',
        'float n=.5+.5*sin(vWorld.x*3.2+vWorld.z*2.7+uTime*2.0+w1*.35);',
        'float fres=pow(1.0-clamp(abs(normalize(cameraPosition-vWorld).y),0.0,1.0),2.0);',
        'vec3 cool=mix(vec3(.035,.34,.52),vec3(.08,.61,.68),n*.32+vUv.y*.25);',
        'vec3 warm=vec3(1.0,.58,.34);',
        'float east=smoothstep(uWarmK > .5 ? -3.0 : 0.0,uWarmK > .5 ? 11.0 : 12.0,vWorld.x)*uWarm;',
        'float west=(1.0-smoothstep(-12.0,0.0,vWorld.x))*uCoolW;',
        'vec3 col=mix(cool,warm,east*uWarmK); col=mix(col,vec3(.025,.29,.46),west*.28);',
        'float glint=pow(max(0.0,sin(vWorld.x*.55+vWorld.z*.16+uTime*.5)),18.0);',
        'col+=vec3(1.0,.72,.34)*glint*(.38+east*.42)+vec3(.34,.66,.8)*fres*.25;',   /* 따뜻한 바다 = 금빛 반짝임이 강해짐 */
        'gl_FragColor=vec4(col,.94);',
        '}'
      ].join('\n')
    });
  }

  function underwaterMaterial() {
    return new THREE.ShaderMaterial({
      depthWrite: false,
      side: THREE.DoubleSide,
      uniforms: {uWarm: {value: 0}, uTime: {value: 0}},
      vertexShader: 'varying vec2 vUv; varying vec3 vWorld; void main(){vUv=uv;vec4 w=modelMatrix*vec4(position,1.0);vWorld=w.xyz;gl_Position=projectionMatrix*viewMatrix*w;}',
      fragmentShader: [
        'precision mediump float; varying vec2 vUv; varying vec3 vWorld; uniform float uWarm; uniform float uTime;',
        'void main(){',
        'float across=clamp(vWorld.x/22.0+.5,0.0,1.0); float depth=max(0.0,-vWorld.y);',
        'float normalD=mix(3.05,.02,smoothstep(.05,.88,across)); float elninoD=mix(3.05,2.82,across);',
        'float boundary=mix(normalD,elninoD,uWarm); float ripple=sin(across*19.0+uTime*.28)*.055+sin(across*41.0-depth*2.0)*.025;',
        'float edge=1.0-smoothstep(boundary-.28+ripple,boundary+.28+ripple,depth);',
        'float shallow=1.0-clamp(depth/8.0,0.0,1.0);',
        'vec3 deep=mix(vec3(.035,.25,.44),vec3(.055,.64,.70),shallow);',
        'float eastGain=smoothstep(.48,.75,across)*uWarm;',
        'vec3 hot=mix(vec3(1.0,.58,.32),vec3(1.0,.64,.36),eastGain);',   /* 복숭앗빛 — 청록과 섞여 회색이 되지 않게 비율을 높임 */
        'float shaftA=pow(max(0.0,sin(across*25.132+uTime*.05)),18.0);',
        'float shaftB=pow(max(0.0,sin(across*31.416+1.7)),22.0);',
        'float ray=(shaftA*.72+shaftB*.46)*(1.0-smoothstep(.3,5.8,depth));',
        'float thermo=exp(-abs(depth-boundary)*4.2);',
        'float grain=.5+.5*sin(vWorld.x*2.8+depth*5.1+uTime*.22);',
        'vec3 col=mix(deep,hot,edge*.74); col+=vec3(.43,.82,.92)*ray*.16+vec3(.35,.79,.82)*thermo*.18;',
        'col*=.88+.18*shallow+grain*.018;',
        'gl_FragColor=vec4(col,1.0);',
        '}'
      ].join('\n')
    });
  }

  function warmFaceGeometry() {
    var g = new THREE.BufferGeometry();
    var xs = [0, 10, 20, 30, 40];
    var p = [];
    var i;
    for (i = 0; i < 4; i += 1) {
      p.push(xs[i], -0.06, 2.08, xs[i], -1, 2.08, xs[i + 1], -0.06, 2.08);
      p.push(xs[i + 1], -0.06, 2.08, xs[i], -1, 2.08, xs[i + 1], -1, 2.08);
    }
    g.setAttribute('position', new THREE.Float32BufferAttribute(p, 3));
    g.computeVertexNormals();
    return g;
  }

  function SceneView(canvas, opt) {
    var glopt;
    opt = opt || {};
    this.canvas = canvas;
    this.view = opt.view === 'phone' ? 'phone' : 'tv';
    this.side = opt.side === 'east' ? 'east' : 'west';
    this.quality = opt.quality === 'low' ? 'low' : 'high';
    this.dpr = Math.min(3, Math.max(0.5, num(opt.dpr, global.devicePixelRatio || 1)));
    this.w = 300;
    this.h = 150;
    this.t = 0;
    this.lastMs = 0;
    this.startMs = 0;
    this.boatPoints = {};
    this.boatBounds = {};
    this.markerPoints = {};
    this.phoneCameraX = this.side === 'west' ? -12 : 12;
    this.phoneCameraY = 4.2;
    this.phoneCameraZ = 6.2;
    this.phoneLookX = this.side === 'west' ? -1 : 1;
    this.phoneLookZ = -1.2;
    this.phoneWind = 1;
    this.phoneFire = 0;
    this.tmpM = new THREE.Matrix4();
    this.tmpP = new THREE.Vector3();
    this.tmpS = new THREE.Vector3();
    this.tmpQ = new THREE.Quaternion();
    this.tmpC = new THREE.Color();
    this.outHull = new THREE.Color(0x777777);
    this.outCabin = new THREE.Color(0x999999);
    this.outSail = new THREE.Color(0xb8b8b8);
    this.outMast = new THREE.Color(0x707070);
    if (!TOON_RAMP) {
      TOON_RAMP = makeRampTexture();
    }
    glopt = {canvas: canvas, antialias: true, alpha: false, preserveDrawingBuffer: true, powerPreference: 'high-performance'};
    this.renderer = new THREE.WebGLRenderer(glopt);
    this.renderer.setPixelRatio(this.dpr);
    this.renderer.setSize(this.w, this.h, false);
    this.renderer.outputEncoding = THREE.sRGBEncoding;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.02;
    this.renderer.setClearColor(0x183e62, 1);
    this.renderer.info.autoReset = false;
    this.scene = new THREE.Scene();
    this.skyTexture = makeSkyTexture();
    this.scene.background = this.skyTexture;
    this.scene.fog = new THREE.FogExp2(0x80b9c6, 0.014);
    this.camera = new THREE.PerspectiveCamera(34, 2, 0.1, 100);
    this.scene.add(new THREE.HemisphereLight(0xdaf6ff, 0x496c65, 0.92));
    this.sun = new THREE.DirectionalLight(0xffe5b5, 1.0);
    this.sun.position.set(-8, 14, 15);
    this.scene.add(this.sun);
    this.rim = new THREE.DirectionalLight(0x76d9ff, 0.72);
    this.rim.position.set(9, 6, -12);
    this.scene.add(this.rim);
    this.build();
    this.buildPost();
    this.resize(300, 150);
    this.update(0, {});
  }

  SceneView.prototype.buildPost = function () {
    this.postTarget = new THREE.WebGLRenderTarget(300, 150, {depthBuffer: true, stencilBuffer: false});
    this.postScene = new THREE.Scene();
    this.postCamera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
    this.postMaterial = new THREE.ShaderMaterial({
      depthTest: false,
      depthWrite: false,
      uniforms: {tScene: {value: this.postTarget.texture}, uResolution: {value: new THREE.Vector2(300, 150)}},
      vertexShader: 'varying vec2 vUv;void main(){vUv=uv;gl_Position=vec4(position.xy,0.0,1.0);}',
      fragmentShader: [
        'precision mediump float; varying vec2 vUv; uniform sampler2D tScene; uniform vec2 uResolution;',
        'void main(){',
        'vec2 px=1.0/uResolution; vec3 c=texture2D(tScene,vUv).rgb;',
        'vec3 n=texture2D(tScene,vUv+vec2(0.0,px.y)).rgb; vec3 s=texture2D(tScene,vUv-vec2(0.0,px.y)).rgb;',
        'vec3 e=texture2D(tScene,vUv+vec2(px.x,0.0)).rgb; vec3 w=texture2D(tScene,vUv-vec2(px.x,0.0)).rgb;',
        'float lc=dot(c,vec3(.299,.587,.114)); float ln=dot(n,vec3(.299,.587,.114)); float ls=dot(s,vec3(.299,.587,.114));',
        'float le=dot(e,vec3(.299,.587,.114)); float lw=dot(w,vec3(.299,.587,.114));',
        'float lo=min(lc,min(min(ln,ls),min(le,lw))); float hi=max(lc,max(max(ln,ls),max(le,lw)));',
        'float edge=smoothstep(.055,.2,hi-lo); vec3 aa=(n+s+e+w+c*2.0)/6.0; c=mix(c,aa,edge*.74);',
        'c+=aa*max(0.0,max(max(aa.r,aa.g),aa.b)-.74)*.18;',
        'c=(c-.5)*1.08+.5; c=mix(vec3(dot(c,vec3(.2126,.7152,.0722))),c,.88);',
        'float v=1.0-smoothstep(.22,.78,length(vUv-.5)); c*=.92+.08*v;',
        'c.r+=.018; c.b+=.012*(1.0-vUv.y);',
        'gl_FragColor=vec4(clamp(c,0.0,1.0),1.0);',
        '}'
      ].join('\n')
    });
    this.postQuad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), this.postMaterial);
    this.postScene.add(this.postQuad);
  };

  SceneView.prototype.build = function () {
    var s = this.scene;
    var box = new THREE.BoxGeometry(1, 1, 1);
    var sphere = new THREE.IcosahedronGeometry(1, 1);
    var cone = new THREE.ConeGeometry(1, 1, 6);
    var cyl = new THREE.CylinderGeometry(1, 1, 1, 8);
    var plane;
    var i;
    var m;

    this.underwater = new THREE.Mesh(new THREE.PlaneGeometry(180, 19, 1, 1), underwaterMaterial());
    this.underwater.position.set(0, -7.25, 1.92);
    this.underwater.frustumCulled = false;
    s.add(this.underwater);
    this.deep = addBox(s, box, mat(0x063554), 0, -5.8, -14, 60, 12, 3);
    this.deep.visible = false;
    this.warmFace = new THREE.Mesh(warmFaceGeometry(), basic(0xf05a24, 0.76));
    this.warmFace.frustumCulled = false;
    this.warmFace.material.depthTest = false;
    this.warmFace.material.toneMapped = false;
    this.warmFace.renderOrder = 10;
    this.warmFace.visible = false;
    s.add(this.warmFace);

    plane = new THREE.PlaneGeometry(1000, 120, this.quality === 'high' ? 44 : 24, this.quality === 'high' ? 18 : 10);
    plane.rotateX(-Math.PI * 0.5);
    this.waterBaseY = [];
    for (i = 0; i < plane.attributes.position.count; i += 1) {
      this.waterBaseY.push(plane.attributes.position.getY(i));
    }
    this.water = new THREE.Mesh(plane, waterMaterial());
    if (this.view === 'phone') { this.water.material.uniforms.uWarmK.value = 0.52; }   /* 휴대폰은 단면이 없어 표면 수온 빛이 신호 */
    this.water.position.set(0, 0.04, -60);
    s.add(this.water);
    this.farWater = new THREE.Mesh(new THREE.PlaneGeometry(1000, 110), fadeMat(0x075a9d, 0.2));
    this.farWater.rotation.x = -Math.PI * 0.5;
    this.farWater.position.set(0, 0.09, -55);
    s.add(this.farWater);
    this.nearWater = new THREE.Mesh(new THREE.PlaneGeometry(1000, 16), fadeMat(0x1476a8, 0.12));
    this.nearWater.rotation.x = -Math.PI * 0.5;
    this.nearWater.position.set(0, 0.1, -8);
    s.add(this.nearWater);
    this.warmWest = new THREE.Mesh(new THREE.PlaneGeometry(110, 110), fadeMat(0xe69362, 0.3));
    this.warmWest.rotation.x = -Math.PI * 0.5;
    this.warmWest.position.set(-55, 0.105, -52);
    this.warmWest.visible = false;
    s.add(this.warmWest);
    this.warmEast = new THREE.Mesh(new THREE.PlaneGeometry(110, 110), fadeMat(0xef8f61, 0.03));
    this.warmEast.rotation.x = -Math.PI * 0.5;
    this.warmEast.position.set(55, 0.112, -52);
    this.warmEast.visible = false;
    s.add(this.warmEast);

    this.land = makeInstance(s, box, mat(0xb99757), 8);
    this.land.instanceMatrix.setUsage(THREE.StaticDrawUsage);
    for (i = 0; i < 8; i += 1) {
      m = this.tmpM;
      this.tmpP.set(i < 4 ? -13.0 - (i % 2) * 4.8 : 13.0 + (i % 2) * 4.8, -0.1 + (i % 3) * 0.09, -1.2 - Math.floor(i % 4 / 2) * 3.2);
      this.tmpS.set(5.7, 0.55, 4.2);
      m.compose(this.tmpP, this.tmpQ.set(0, 0, 0, 1), this.tmpS);
      this.land.setMatrixAt(i, m);
      this.land.setColorAt(i, new THREE.Color(i < 4 ? 0x5f954f : 0xc9a45d));
    }

    this.westTerrainGeometry = terrainGeometry(true);
    this.eastTerrainGeometry = terrainGeometry(false);
    this.westTerrainOutline = new THREE.Mesh(this.westTerrainGeometry, outlineMat());
    this.westTerrainOutline.position.set(-14.1, -0.02, 0);
    this.westTerrainOutline.scale.set(1.035, 1.045, 1.035);
    this.westTerrainOutline.renderOrder = 1;
    s.add(this.westTerrainOutline);
    this.eastTerrainOutline = new THREE.Mesh(this.eastTerrainGeometry, outlineMat());
    this.eastTerrainOutline.position.set(14.1, -0.02, 0);
    this.eastTerrainOutline.scale.set(1.035, 1.045, 1.035);
    this.eastTerrainOutline.renderOrder = 1;
    s.add(this.eastTerrainOutline);
    this.westTerrain = new THREE.Mesh(this.westTerrainGeometry, terrainMaterial());
    this.westTerrain.position.set(-14.1, 0.04, 0);
    this.westTerrain.renderOrder = 2;
    s.add(this.westTerrain);
    this.eastTerrain = new THREE.Mesh(this.eastTerrainGeometry, terrainMaterial());
    this.eastTerrain.position.set(14.1, 0.04, 0);
    this.eastTerrain.renderOrder = 2;
    s.add(this.eastTerrain);

    this.jungleTrunks = makeInstance(s, cyl, mat(0x70462d), 8);
    this.jungleCanopyOutline = makeInstance(s, sphere, outlineMat(), 8);
    this.jungleCanopies = makeInstance(s, sphere, mat(0x35a853), 8);
    for (i = 0; i < 8; i += 1) {
      this.tmpP.set(-17.1 + i * 0.82, 1.02 + (i % 3) * 0.18, -3.2 - (i % 2) * 1.25);
      this.tmpS.set(0.1, 0.72, 0.1);
      this.tmpM.compose(this.tmpP, this.tmpQ.set(0, 0, 0, 1), this.tmpS);
      this.jungleTrunks.setMatrixAt(i, this.tmpM);
      this.tmpP.y += 0.8;
      this.tmpS.set(0.62, 0.52, 0.6);
      this.tmpM.compose(this.tmpP, this.tmpQ.set(0, 0, 0, 1), this.tmpS);
      this.jungleCanopyOutline.setMatrixAt(i, this.tmpM);
      this.tmpS.set(0.53, 0.43, 0.51);
      this.tmpM.compose(this.tmpP, this.tmpQ.set(0, 0, 0, 1), this.tmpS);
      this.jungleCanopies.setMatrixAt(i, this.tmpM);
      this.jungleCanopies.setColorAt(i, new THREE.Color(i % 2 ? 0x2d9148 : 0x49b85b));
    }

    this.houses = makeInstance(s, box, mat(0xe2a95f), 12);
    this.roofsW = makeInstance(s, cone, mat(0xb94931), 6);
    this.roofsE = makeInstance(s, box, mat(0x9a8e68), 6);
    for (i = 0; i < 12; i += 1) {
      this.tmpP.set(i < 6 ? -12.15 + (i % 3) * 0.65 : 10.55 + (i % 3) * 0.72, 0.72 + Math.floor((i % 6) / 3) * 0.45, 0.5 - Math.floor((i % 6) / 3) * 1.2);
      this.tmpS.set(0.48, i < 6 ? 0.48 : 0.58, 0.48);
      this.tmpM.compose(this.tmpP, this.tmpQ.set(0, 0, 0, 1), this.tmpS);
      this.houses.setMatrixAt(i, this.tmpM);
      this.houses.setColorAt(i, new THREE.Color(i < 6 ? (i % 2 ? 0xf0bb67 : 0xe18e49) : (i % 2 ? 0xd6aa70 : 0xe6c28d)));
      this.tmpP.y += i < 6 ? 0.7 : 0.65;
      if (i < 6) {
        this.tmpS.set(0.62, 0.42, 0.62);
        this.tmpM.compose(this.tmpP, this.tmpQ.set(0, 0, 0, 1), this.tmpS);
        this.roofsW.setMatrixAt(i, this.tmpM);
      } else {
        this.tmpS.set(0.58, 0.1, 0.58);
        this.tmpM.compose(this.tmpP, this.tmpQ.set(0, 0, 0, 1), this.tmpS);
        this.roofsE.setMatrixAt(i - 6, this.tmpM);
        this.roofsE.setColorAt(i - 6, new THREE.Color(i % 2 ? 0x88906a : 0x9b9675));
      }
    }

    this.trunks = makeInstance(s, cyl, mat(0x7f572f), 7);
    this.palms = makeInstance(s, sphere, mat(0x2f8b51), 7);
    for (i = 0; i < 7; i += 1) {
      this.tmpP.set(-12.45 + i * 0.52, 0.9 + hash(i + 20) * 0.28, -0.4 + (i % 2) * 0.85);
      this.tmpS.set(0.08, 0.78, 0.08);
      this.tmpM.compose(this.tmpP, this.tmpQ.setFromAxisAngle(ZUP, 0), this.tmpS);
      this.trunks.setMatrixAt(i, this.tmpM);
      this.tmpP.y += 0.85;
      this.tmpS.set(0.44, 0.22, 0.5);
      this.tmpM.compose(this.tmpP, this.tmpQ.set(0, 0, 0, 1), this.tmpS);
      this.palms.setMatrixAt(i, this.tmpM);
    }
    this.fronds = makeInstance(s, triangleGeometry(0.95, 0.32), mat(0x237b4a), 28);
    this.stilts = makeInstance(s, cyl, mat(0x70462d), 12);
    for (i = 0; i < 12; i += 1) {
      this.tmpP.set(-12.15 + (i % 6) * 0.33, 0.28, 0.15 - Math.floor(i / 6) * 1.18);
      this.tmpS.set(0.045, 0.34, 0.045);
      this.tmpM.compose(this.tmpP, this.tmpQ.set(0, 0, 0, 1), this.tmpS);
      this.stilts.setMatrixAt(i, this.tmpM);
    }
    this.dryRacks = makeInstance(s, box, mat(0x765340), 16);
    for (i = 0; i < 16; i += 1) {
      this.tmpP.set(10.15 + (i % 4) * 0.37, 0.48 + (i % 2) * 0.25, 0.95 - Math.floor(i / 4) * 0.38);
      this.tmpS.set(i % 2 ? 0.035 : 0.28, i % 2 ? 0.32 : 0.035, 0.035);
      this.tmpM.compose(this.tmpP, this.tmpQ.set(0, 0, 0, 1), this.tmpS);
      this.dryRacks.setMatrixAt(i, this.tmpM);
    }
    this.westJetty = addBox(s, box, mat(0x765239), -9.55, 0.28, 0.18, 1.75, 0.11, 0.62);
    this.jettyPosts = makeInstance(s, cyl, mat(0x52382a), 8);
    for (i = 0; i < 8; i += 1) {
      this.tmpP.set(-10.3 + (i % 4) * 0.48, 0.02, -0.08 + Math.floor(i / 4) * 0.52);
      this.tmpS.set(0.045, 0.42, 0.045);
      this.tmpM.compose(this.tmpP, this.tmpQ.set(0, 0, 0, 1), this.tmpS);
      this.jettyPosts.setMatrixAt(i, this.tmpM);
    }
    this.rocks = makeInstance(s, sphere, mat(0x65756d), 22);
    this.shrubs = makeInstance(s, sphere, mat(0x3b8a4d), 18);
    this.landContacts = makeInstance(s, sphere, basic(0x24483d, 0.2), 24);
    for (i = 0; i < 22; i += 1) {
      this.tmpP.set(i < 11 ? -10.1 - hash(i + 301) * 4.6 : 9.6 + hash(i + 321) * 4.8, 0.42, -1.15 + hash(i + 341) * 2.7);
      this.tmpS.set(0.18 + hash(i + 361) * 0.34, 0.12 + hash(i + 381) * 0.28, 0.2 + hash(i + 401) * 0.35);
      this.tmpM.compose(this.tmpP, this.tmpQ.setFromAxisAngle(ZUP, hash(i + 421) * Math.PI), this.tmpS);
      this.rocks.setMatrixAt(i, this.tmpM);
      this.rocks.setColorAt(i, new THREE.Color(i < 11 ? (i % 2 ? 0x55745e : 0x718b72) : (i % 2 ? 0x8d806d : 0x6e7772)));
    }
    for (i = 0; i < 18; i += 1) {
      this.tmpP.set(-10.35 - hash(i + 441) * 4.2, 0.65 + hash(i + 461) * 0.18, -1.1 + hash(i + 481) * 2.4);
      this.tmpS.set(0.22 + hash(i + 501) * 0.28, 0.2 + hash(i + 521) * 0.32, 0.22 + hash(i + 541) * 0.3);
      this.tmpM.compose(this.tmpP, this.tmpQ.set(0, 0, 0, 1), this.tmpS);
      this.shrubs.setMatrixAt(i, this.tmpM);
      this.shrubs.setColorAt(i, new THREE.Color(i % 3 ? 0x2f8f50 : 0x55a64d));
    }
    for (i = 0; i < 24; i += 1) {
      this.tmpP.set(i < 12 ? -12.2 + (i % 6) * 0.52 : 10.35 + (i % 6) * 0.55, 0.34, -0.4 + Math.floor((i % 12) / 6) * -1.15);
      this.tmpS.set(0.42, 0.035, 0.33);
      this.tmpM.compose(this.tmpP, this.tmpQ.set(0, 0, 0, 1), this.tmpS);
      this.landContacts.setMatrixAt(i, this.tmpM);
    }

    this.cloudW = makeInstance(s, sphere, fadeMat(0xffffff, 0.9), 10);
    this.cloudE = makeInstance(s, sphere, fadeMat(0xf5f7fa, 0.9), 10);
    if (this.quality === 'low') {
      this.cloudW.count = 6;
      this.cloudE.count = 6;
    }
    for (i = 0; i < 10; i += 1) {
      this.tmpP.set(-8.8 + (i % 5) * 0.75, 3.75 + Math.floor(i / 5) * 0.35, -0.5 + (i % 3) * 0.22);
      this.tmpS.set(0.7 + hash(i) * 0.35, 0.38 + hash(i + 1) * 0.18, 0.5);
      if (this.view === 'phone') {
        this.tmpS.multiplyScalar(0.58);
      }
      this.tmpM.compose(this.tmpP, this.tmpQ.set(0, 0, 0, 1), this.tmpS);
      this.cloudW.setMatrixAt(i, this.tmpM);
      this.tmpP.x += 16.3;
      this.tmpM.compose(this.tmpP, this.tmpQ.set(0, 0, 0, 1), this.tmpS);
      this.cloudE.setMatrixAt(i, this.tmpM);
    }

    this.rainW = makeInstance(s, box, basic(0x246fe5, 0.9), 56);
    this.rainE = makeInstance(s, box, basic(0x246fe5, 0.9), 56);
    this.ripplesW = makeInstance(s, new THREE.RingGeometry(0.13, 0.18, 8, 1), basic(0xb9efff, 0.62), 18);
    this.ripplesE = makeInstance(s, new THREE.RingGeometry(0.13, 0.18, 8, 1), basic(0xb9efff, 0.62), 18);
    if (this.quality === 'low') {
      this.rainW.count = 30;
      this.rainE.count = 30;
      this.ripplesW.count = 8;
      this.ripplesE.count = 8;
    }
    this.windRibbon = addBox(s, box, basic(0xeafcff, 0.75), 0.45, 4.72, 1.65, 12.3, 0.36, 0.14);
    this.windHead = new THREE.Mesh(cone, basic(0xeafcff, 0.82));
    this.windHead.rotation.z = Math.PI * 0.5;
    this.windHead.position.set(-6.4, 4.72, 1.65);
    s.add(this.windHead);
    this.windStreak = makeInstance(s, box, basic(0xbcecff, 0.82), 18);

    this.fishGeo = fishGeometry();
    this.fishWOutline = makeInstance(s, this.fishGeo, basic(0x13294b, 1), 42);
    this.fishEOutline = makeInstance(s, this.fishGeo, basic(0x13294b, 1), 42);
    this.fishW = makeInstance(s, this.fishGeo, fishMaterial(0xffd438), 42);
    this.fishE = makeInstance(s, this.fishGeo, fishMaterial(0x16b8a6), 42);
    this.fishWOutline.renderOrder = 19;
    this.fishEOutline.renderOrder = 19;
    this.fishW.renderOrder = 20;
    this.fishE.material.transparent = true;
    this.fishE.material.depthTest = false;
    this.fishE.material.depthWrite = false;
    this.fishE.material.toneMapped = false;
    this.fishE.renderOrder = 20;

    this.upBars = makeInstance(s, cyl, basic(0x59d7ff, 0.78), 3);
    this.upHeads = makeInstance(s, sphere, basic(0xc9f6ff, 0.9), 12);

    this.zoneRope = addBox(s, box, basic(0xd5edf0, 0.8), 0, 0.17, -0.16, 16.4, 0.025, 0.035);
    this.zoneBuoys = makeInstance(s, sphere, basic(0xffdd45, 1), 14);
    for (i = 0; i < 14; i += 1) {
      this.tmpP.set(-7.8 + i * 1.2, 0.22, -0.16);
      this.tmpS.set(0.09, 0.09, 0.09);
      this.tmpM.compose(this.tmpP, this.tmpQ.set(0, 0, 0, 1), this.tmpS);
      this.zoneBuoys.setMatrixAt(i, this.tmpM);
    }

    if (this.view === 'phone') {
      var sign = this.side === 'west' ? -1 : 1;
      this.land.visible = false;
      this.water.position.z = -50;
      this.farWater.visible = false;
      this.nearWater.visible = false;
      if (this.side === 'west') {
        this.eastTerrain.position.x = 23.5;
        this.eastTerrain.scale.set(0.68, 0.68, 0.68);
        this.eastTerrainOutline.position.x = 23.5;
        this.eastTerrainOutline.scale.set(0.704, 0.711, 0.704);
      } else {
        this.westTerrain.position.x = -23.5;
        this.westTerrain.scale.set(0.68, 0.68, 0.68);
        this.westTerrainOutline.position.x = -23.5;
        this.westTerrainOutline.scale.set(0.704, 0.711, 0.704);
      }
      this.zoneRope.visible = false;
      this.zoneBuoys.visible = false;
      this.phoneNearBand = new THREE.Mesh(new THREE.CircleGeometry(1, 40), fadeMat(0x5bd0d2, 0.13));
      this.phoneNearBand.rotation.x = -Math.PI * 0.5;
      this.phoneNearBand.position.set(sign * 3.4, 0.135, 0);
      this.phoneNearBand.scale.set(1.55, 1.9, 1);
      s.add(this.phoneNearBand);
      this.phoneFarBand = new THREE.Mesh(new THREE.CircleGeometry(1, 40), fadeMat(0x087b9e, 0.16));
      this.phoneFarBand.rotation.x = -Math.PI * 0.5;
      this.phoneFarBand.position.set(sign * (-0.4), 0.14, 0);
      this.phoneFarBand.scale.set(1.55, 1.9, 1);
      s.add(this.phoneFarBand);
      this.phoneDivider = addBox(s, box, basic(0xe5f7f4, 0.9), sign * 5.5, 0.185, 0, 0.035, 0.025, 3.4);
      this.phoneDivider.visible = false;
      this.phoneBuoys = makeInstance(s, sphere, basic(0xf0503a, 1), 9);   /* 부표 = 빨강(노랑이면 물고기와 헷갈림) */
      for (i = 0; i < 9; i += 1) {
        this.tmpP.set(sign * (i < 4 ? 3.4 : (-0.4)) + (hash(i + 401) - .5) * 2.0, 0.24, -1.25 + hash(i + 421) * 2.5);
        this.tmpS.set(0.095, 0.13, 0.095);
        this.tmpM.compose(this.tmpP, this.tmpQ.set(0, 0, 0, 1), this.tmpS);
        this.phoneBuoys.setMatrixAt(i, this.tmpM);
      }
      this.groundGlints = makeInstance(s, new THREE.TorusGeometry(0.28, 0.018, 4, 10, Math.PI * 1.25), basic(0xd8fbff, 0.66), 18);
      for (i = 0; i < 18; i += 1) {
        this.tmpP.set(sign * (i < 9 ? 3.4 : (-0.4)) + (hash(i + 451) - .5) * 2.15, 0.205, -1.25 + hash(i + 471) * 2.5);
        this.tmpS.set(0.55 + hash(i + 491) * 0.8, 0.42, 0.7);
        this.tmpQ.setFromAxisAngle(new THREE.Vector3(1, 0, 0), -Math.PI * 0.5);
        this.tmpM.compose(this.tmpP, this.tmpQ, this.tmpS);
        this.groundGlints.setMatrixAt(i, this.tmpM);
      }
      this.gulls = makeInstance(s, triangleGeometry(0.42, 0.15), basic(0xf7f0dd, 0.94), 8);
      for (i = 0; i < 8; i += 1) {
        this.tmpP.set(sign * (i < 4 ? 3.4 : (-0.4)) + (hash(i + 511) - .5) * 2.2, 1.65 + hash(i + 531) * 0.75, -0.5 + hash(i + 551));
        this.tmpS.set(i % 2 ? -0.9 : 0.9, 0.9, 0.9);
        this.tmpM.compose(this.tmpP, this.tmpQ.setFromAxisAngle(ZUP, (hash(i + 571) - .5) * 0.8), this.tmpS);
        this.gulls.setMatrixAt(i, this.tmpM);
      }
      this.phoneWaves = makeInstance(s, box, basic(0xdff8ff, 0.86), 8);
      for (i = 0; i < 8; i += 1) {
        this.tmpP.set(sign * (2.85 + (i % 4) * 0.72), 0.245 + (i % 2) * 0.025, -1.2 + Math.floor(i / 4) * 1.8);
        this.tmpS.set(0.38 + (i % 3) * 0.1, 0.025, 0.035);
        this.tmpM.compose(this.tmpP, this.tmpQ.set(0, 0, 1, 0), this.tmpS);
        this.phoneWaves.setMatrixAt(i, this.tmpM);
      }
      this.phoneJetty = addBox(s, box, mat(0xb88d4b), sign * 6.75, 0.27, 1.3, 1.5, 0.14, 0.5);
      this.phoneTarget = new THREE.Mesh(new THREE.TorusGeometry(1.18, 0.1, 8, 32), fadeMat(0xffe56e, 0.32));
      this.phoneTarget.position.set(sign * 7, 0.92, 0.7);
      this.phoneTarget.visible = false;
      s.add(this.phoneTarget);
      this.phoneTank = new THREE.Mesh(cyl, fadeMat(0x485b60, 0.72));
      this.phoneTank.position.set(-10.45, 1.3, 1.28);
      this.phoneTank.scale.set(0.42, 0.72, 0.42);
      this.phoneTank.visible = this.side === 'west';
      s.add(this.phoneTank);
      this.phoneTankWater = new THREE.Mesh(cyl, basic(0x4cb9d3, 0.9));
      this.phoneTankWater.position.set(-10.45, 1.12, 1.56);
      this.phoneTankWater.scale.set(0.34, 0.42, 0.34);
      this.phoneTankWater.visible = this.side === 'west';
      s.add(this.phoneTankWater);
      this.windRibbon.visible = false;
      this.windHead.visible = false;
      this.windStreak.visible = false;
      this.underwater.visible = false;
      this.warmFace.visible = false;
      this.upBars.visible = false;
      this.upHeads.visible = false;
      this.phoneNearBand.visible = false;
      this.phoneFarBand.visible = false;
      this.phoneUpwell = makeInstance(s, new THREE.RingGeometry(0.42, 0.62, 24, 1), basic(0x83e2cc, 0.58), 12);
      this.phoneWhitecaps = makeInstance(s, new THREE.TorusGeometry(0.42, 0.035, 4, 12, Math.PI * 1.25), basic(0xf1fbff, 0.82), 28);
      this.phoneWindLines = makeInstance(s, box, basic(0xc9f5ff, 0.58), 22);
      this.phoneWarmSurface = new THREE.Mesh(new THREE.CircleGeometry(1, 48), fadeMat(0xf28b5f, 0.02));
      this.phoneWarmSurface.rotation.x = -Math.PI * 0.5;
      this.phoneWarmSurface.position.set(9.0, 0.19, -14.0);
      this.phoneWarmSurface.scale.set(14.0, 20.0, 1);
      this.phoneWarmSurface.visible = false;   /* 원판은 경계가 딱딱해 모래톱처럼 보임 — 물 셰이더 수온 빛으로만 */
      s.add(this.phoneWarmSurface);
      this.phoneMountains = makeInstance(s, new THREE.ConeGeometry(1, 1, 5), basic(0x6f97a3, 1), 9);   /* 상대 해안 = 수평선의 흐린 산줄기(높낮이 들쭉날쭉) */
      for (i = 0; i < 9; i += 1) {
        var mh = [1.6, 3.1, 2.2, 4.4, 2.8, 3.7, 1.9, 2.9, 1.4][i];
        this.tmpP.set(-sign * (20.0 + (i - 4) * 3.1 * 0.84 + (hash(i + 600) - 0.5) * 1.2), mh * 0.5 - 0.1, -38.0 + (i - 4) * 3.1 * 0.55 - hash(i + 605) * 3.0);
        this.tmpS.set(2.6 + hash(i + 620) * 2.6, mh, 2.2 + hash(i + 640) * 1.4);
        this.tmpM.compose(this.tmpP, this.tmpQ.setFromAxisAngle(ZUP, hash(i + 650) * 0.35), this.tmpS);
        this.phoneMountains.setMatrixAt(i, this.tmpM);
      }
      this.phoneMountains.instanceMatrix.needsUpdate = true;
      this.phoneHuts = makeInstance(s, box, basic(0xffffff, 1), 3);
      this.phoneHutRoofs = makeInstance(s, cone, basic(0xffffff, 1), 3);
      for (i = 0; i < 3; i += 1) {
        this.tmpP.set(sign * (9.3 + i * 0.55), 0.58 + (i % 2) * 0.1, -1.9 + (i % 2) * 0.5);   /* 항구 배 자리(7.5~8.3)와 겹치지 않게 마을 안쪽 */
        this.tmpS.set(0.36, 0.42, 0.36);
        this.tmpM.compose(this.tmpP, this.tmpQ.set(0, 0, 0, 1), this.tmpS);
        this.phoneHuts.setMatrixAt(i, this.tmpM);
        this.phoneHuts.setColorAt(i, new THREE.Color(this.side === 'west' ? (i % 2 ? 0xe18e49 : 0xf0bb67) : (i % 2 ? 0xd6aa70 : 0xe6c28d)));
        this.tmpP.y += 0.52;
        this.tmpS.set(0.48, 0.3, 0.48);
        this.tmpM.compose(this.tmpP, this.tmpQ.setFromAxisAngle(ZUP, Math.PI * 0.25), this.tmpS);
        this.phoneHutRoofs.setMatrixAt(i, this.tmpM);
        this.phoneHutRoofs.setColorAt(i, new THREE.Color(this.side === 'west' ? 0xb94931 : 0x88906a));
      }
      this.phoneHuts.instanceMatrix.needsUpdate = true;
      this.phoneHutRoofs.instanceMatrix.needsUpdate = true;
    }

    this.flood = addBox(s, box, basic(0x37a9d0, 0.72), 11.4, 0.36, 0.1, 1.55, 0.05, 1.45);
    this.dry = addBox(s, box, basic(0xc8843e, 0.74), -11.5, 0.37, 0.1, 1.6, 0.055, 1.45);
    this.cracks = makeInstance(s, box, basic(0x6f4932, 0.72), 12);
    for (i = 0; i < 12; i += 1) {
      this.tmpP.set(-12.2 + (i % 4) * 0.48, 0.405, -0.42 + Math.floor(i / 4) * 0.46);
      this.tmpS.set(0.22, 0.012, 0.022);
      this.tmpQ.setFromAxisAngle(ZUP, (i % 3 - 1) * 0.62);
      this.tmpM.compose(this.tmpP, this.tmpQ, this.tmpS);
      this.cracks.setMatrixAt(i, this.tmpM);
    }
    this.fire = makeInstance(s, sphere, basic(0xff7a20, 0.75), 8);
    this.smoke = makeInstance(s, sphere, fadeMat(0x68717b, 0.7), 8);
    if (this.quality === 'low') {
      this.fire.count = 5;
      this.smoke.count = 5;
    }

    this.pulse = new THREE.Mesh(new THREE.PlaneGeometry(2.6, 3.5), fadeMat(0xfff4bd, 0.2));
    this.pulse.rotation.x = -Math.PI * 0.5;
    this.pulse.position.set(-14, 0.18, 0);
    if (this.view === 'phone') {
      this.pulse.visible = false;
    }
    s.add(this.pulse);

    this.boatHull = makeInstance(s, hullGeometry(), basic(0xffffff, 1), 30);   /* 중립 비조명 경로: 탈락 회색에 햇빛/림라이트 색이 곱해지지 않음 */
    this.boatRims = makeInstance(s, hullGeometry(), basic(0xffffff, 1), 30);
    this.boatRims.material.side = THREE.BackSide;
    this.boatDeck = makeInstance(s, deckGeometry(), basic(0xffffff, 1), 30);
    this.boatBow = makeInstance(s, new THREE.BufferGeometry(), mat(0xd54c36), 30);
    this.boatBowOutline = makeInstance(s, new THREE.BufferGeometry(), basic(0xffffff, 1), 30);
    this.boatBow.visible = false;
    this.boatBowOutline.visible = false;
    this.boatCabinGeometry = new THREE.CylinderGeometry(0.34, 0.42, 0.34, 6);
    this.boatCabinOutline = makeInstance(s, this.boatCabinGeometry, basic(0xffffff, 1), 30);
    this.boatCabinOutline.material.side = THREE.BackSide;
    this.boatCabin = makeInstance(s, this.boatCabinGeometry, basic(0xffffff, 1), 30);
    this.boatSailOutline = makeInstance(s, sailGeometry(), basic(0xffffff, 1), 30);
    this.boatSail = makeInstance(s, sailGeometry(), basic(0xffffff, 1), 30);
    this.boatMastOutline = makeInstance(s, cyl, basic(0xffffff, 1), 30);
    this.boatMast = makeInstance(s, cyl, basic(0xffffff, 1), 30);
    this.wakes = makeInstance(s, box, basic(0xffffff, 0.64), 30);
    this.boatShadows = makeInstance(s, sphere, basic(0x0a2a3a, 0.12), 30);   /* 옅은 그림자 */
    this.haloOutlines = makeInstance(s, new THREE.TorusGeometry(0.68, 0.1, 8, 32), basic(0x13294b, 0.96), 30);
    this.halos = makeInstance(s, new THREE.TorusGeometry(0.62, 0.065, 8, 32), basic(0xffffff, 0.92), 30);
    this.pinGeometry = pinGeometry();
    this.mePinOutline = makeInstance(s, this.pinGeometry, basic(0x13294b, 1), 30);
    this.mePinOutline.material.side = THREE.BackSide;
    this.mePin = makeInstance(s, this.pinGeometry, mat(0xffffff, false), 30);
    this.meFlagOutline = makeInstance(s, triangleGeometry(0.72, 0.38), basic(0x13294b, 1), 30);
    this.meFlag = makeInstance(s, triangleGeometry(0.62, 0.30), basic(0xffffff, 1), 30);
    if (this.view !== 'phone') {
      this.haloOutlines.visible = false;
      this.halos.visible = false;
      this.mePinOutline.visible = false;
      this.mePin.visible = false;
      this.meFlagOutline.visible = false;
      this.meFlag.visible = false;
    } else {
      this.haloOutlines.count = 1;
      this.halos.count = 1;
      this.mePinOutline.visible = false;
      this.mePin.visible = false;
      this.meFlagOutline.count = 1;
      this.meFlag.count = 1;
    }
    this.nets = makeInstance(s, new THREE.TorusGeometry(0.42, 0.025, 5, 18), basic(0xd8f0e6, 0.88), 30);
    if (this.view === 'phone') {   /* 휴대폰 어군은 물속(배 위에 그려지지 않게) */
      [this.fishW, this.fishE, this.fishWOutline, this.fishEOutline].forEach(function (m) { m.material.depthTest = true; m.renderOrder = 3; });
    }
    this.catchFish = makeInstance(s, this.fishGeo, fishMaterial(0xffd43b), 270);
    this.splashes = makeInstance(s, sphere, basic(0xb8f5ff, 0.72), 24);
    this.splashes.count = this.quality === 'high' ? 24 : 8;
    this.shoreFoam = makeInstance(s, new THREE.TorusGeometry(0.45, 0.035, 5, 12, Math.PI), basic(0xd9faff, 0.72), 18);
    for (i = 0; i < 18; i += 1) {
      this.tmpP.set(i < 9 ? -9.5 - (i % 3) * 0.42 : 9.5 + (i % 3) * 0.42, 0.23, -1.15 + Math.floor(i % 9 / 3) * 0.72);
      this.tmpS.set(0.7, 0.25, 0.7);
      this.tmpM.compose(this.tmpP, this.tmpQ.setFromAxisAngle(ZUP, i < 9 ? 0 : Math.PI), this.tmpS);
      this.shoreFoam.setMatrixAt(i, this.tmpM);
    }
    /* 인스턴스 색 속성을 처음부터 만들어 둔다 — 배가 없는 첫 프레임(TV 대기실)에 셰이더가 «인스턴스 색 없음»으로 컴파일되면
       나중에 setColorAt을 해도 색이 안 먹어 배가 전부 흰 회색이 됨(11-01 실측) */
    [this.boatRims, this.boatSailOutline, this.boatMastOutline, this.boatCabinOutline, this.boatBowOutline].forEach(function (m) { m.material.toneMapped = false; });   /* 배 외곽선도 지형 외곽선처럼 톤 매핑 없이 진한 남색 */
    [this.boatHull, this.boatDeck, this.boatRims, this.boatCabin, this.boatCabinOutline, this.boatSail, this.boatSailOutline,
     this.boatMast, this.boatMastOutline, this.boatBow, this.boatBowOutline, this.halos, this.mePin, this.meFlag].forEach(function (m) {
      var w = new THREE.Color(0xffffff);
      for (var k = 0; k < m.count; k += 1) { m.setColorAt(k, w); }
    });
    if (this.quality === 'low') {   /* 저화질(휴대폰): 잔장식 생략 — 그리기 호출 수를 줄임 */
      this.shoreFoam.visible = false;
      this.landContacts.visible = false;
      this.splashes.visible = false;
      if (this.view === 'phone') {
        this.phoneBuoys.visible = false;
        this.groundGlints.visible = false;
        this.gulls.visible = false;
        this.phoneWaves.visible = false;
        this.boatCabinOutline.visible = false;
        this.boatSailOutline.visible = false;
        this.boatMastOutline.visible = false;
        this.catchFish.visible = false;
      }
    }
    this.hideAllBoats();
  };

  SceneView.prototype.hideMatrix = function (mesh, i) {
    this.tmpP.set(0, -80, 0);
    this.tmpS.set(0.001, 0.001, 0.001);
    this.tmpM.compose(this.tmpP, this.tmpQ.set(0, 0, 0, 1), this.tmpS);
    mesh.setMatrixAt(i, this.tmpM);
  };

  SceneView.prototype.hideAllBoats = function () {
    var i;
    var a = [this.boatHull, this.boatDeck, this.boatRims, this.boatBow, this.boatBowOutline,
      this.boatCabinOutline, this.boatCabin, this.boatSailOutline, this.boatSail,
      this.boatMastOutline, this.boatMast, this.wakes, this.boatShadows,
      this.haloOutlines, this.halos, this.mePinOutline, this.mePin,
      this.meFlagOutline, this.meFlag, this.nets];
    var j;
    for (j = 0; j < a.length; j += 1) {
      for (i = 0; i < 30; i += 1) {
        this.hideMatrix(a[j], i);
      }
      a[j].instanceMatrix.needsUpdate = true;
    }
    for (i = 0; i < 270; i += 1) {
      this.hideMatrix(this.catchFish, i);
    }
    this.catchFish.instanceMatrix.needsUpdate = true;
    for (i = 0; i < 24; i += 1) {
      this.hideMatrix(this.splashes, i);
    }
    this.splashes.instanceMatrix.needsUpdate = true;
  };

  SceneView.prototype.resize = function (cssW, cssH) {
    var aspect;
    this.w = Math.max(1, Math.floor(cssW));
    this.h = Math.max(1, Math.floor(cssH));
    aspect = this.w / this.h;
    this.renderer.setPixelRatio(this.dpr);
    this.renderer.setSize(this.w, this.h, false);
    if (this.postTarget) {
      this.postTarget.setSize(Math.max(1, Math.floor(this.w * this.dpr)), Math.max(1, Math.floor(this.h * this.dpr)));
      this.postMaterial.uniforms.uResolution.value.set(this.w * this.dpr, this.h * this.dpr);
    }
    this.camera.aspect = aspect;
    if (this.view === 'phone') {
      this.camera.fov = 44;
      this.phoneCameraX = this.side === 'west' ? -12 : 12;
      this.phoneCameraY = 4.2;
      this.phoneCameraZ = 6.2;
      this.phoneLookX = this.side === 'west' ? -1 : 1;
      this.phoneLookZ = -1.2;
      this.camera.position.set(this.phoneCameraX, this.phoneCameraY, this.phoneCameraZ);
      this.camera.lookAt(new THREE.Vector3(this.phoneLookX, 1.0, this.phoneLookZ));
    } else {
      this.camera.fov = 31;
      this.camera.position.set(0, 8.2, 29);
      this.camera.lookAt(new THREE.Vector3(0, 1.25, 0));
    }
    this.camera.updateProjectionMatrix();
  };

  SceneView.prototype.slot = function (side, name, id) {
    var west = side !== 'east';
    var sign = west ? -1 : 1;
    var lane = id % 15;
    var spread = (lane - 7) * 0.11;
    var x;
    var z;
    if (this.view === 'phone') {
      var own = side === this.side;
      if (name === 'port') {
        x = sign * ((own ? 7.5 : 9.4) + (lane % 5) * (own ? 0.18 : 0.2));
        z = -1.15 + Math.floor(lane / 5) * 1.05 + ((lane % 5) - 2) * 0.1;
      } else if (name === 'far') {
        x = sign * ((own ? 0.9 : 4.8) + (lane % 5) * (own ? 0.28 : 0.22));
        z = -1.55 + Math.floor(lane / 5) * 1.15 + ((lane % 5) - 2) * 0.14;
      } else {
        x = sign * ((own ? 4.1 : 7.0) + (lane % 5) * (own ? 0.26 : 0.22));
        z = -1.35 + Math.floor(lane / 5) * 1.1 + ((lane % 5) - 2) * 0.12;
      }
      return {x: x, y: 0.42 + Math.abs(spread) * 0.02, z: z};
    }
    /* TV: 한 자리 15척 = 5열 × 3줄 — 줄 간격을 깊이 2.2로 벌리고 가운데 줄은 반 칸 엇갈림(낮은 TV 시점에서 줄끼리 겹치지 않게 · R4) */
    /* TV 해안선 ≈ x ±8.5(그 바깥은 마을 땅 · 덤불) → 먼바다 0.3~3.5 · 가까운 바다 3.4~6.6 · 항구 6.4~8.9(부두 옆 물 위) */
    var row = Math.floor(lane / 5), stag = row === 1 ? 0.35 : 0;
    if (name === 'port') {
      x = sign * (6.4 + (lane % 5) * 0.55 + stag * 0.8);
      return {x: x, y: 0.38 + Math.abs(spread) * 0.02, z: -0.4 + row * 1.1};   /* 항구 줄은 언덕(지형 z < 0) 앞 */
    } else if (name === 'far') {
      x = sign * (0.3 + (lane % 5) * 0.7 + stag);
    } else {
      x = sign * (3.4 + (lane % 5) * 0.7 + stag);
    }
    z = -2.6 + row * 2.2;
    return {x: x, y: 0.38 + Math.abs(spread) * 0.02, z: z};
  };

  SceneView.prototype.placeRain = function (mesh, west, amount, t) {
    var i;
    var active = Math.floor(clamp(amount) * 56 + 0.001);
    var x0 = west ? -10.3 : 2.1;
    for (i = 0; i < 56; i += 1) {
      if (i < active) {
        this.tmpP.set(x0 + hash(i + (west ? 10 : 80)) * 8.2, 0.55 + ((hash(i + 23) * 3.1 - t * 2.2) % 3.1 + 3.1) % 3.1, 1.7 + hash(i + 45) * 0.22);
        if (this.view === 'phone') { this.tmpS.set(0.011, 0.32, 0.011); } else { this.tmpS.set(0.025, 0.24, 0.025); }   /* 휴대폰은 가까워서 가는 빗줄기 */
        this.tmpQ.setFromAxisAngle(new THREE.Vector3(0, 0, 1), -0.13);
        this.tmpM.compose(this.tmpP, this.tmpQ, this.tmpS);
        mesh.setMatrixAt(i, this.tmpM);
      } else {
        this.hideMatrix(mesh, i);
      }
    }
    mesh.instanceMatrix.needsUpdate = true;
  };

  SceneView.prototype.placeRipples = function (mesh, west, amount, t) {
    var i;
    var active = Math.floor(clamp(amount) * mesh.count + 0.001);
    var x0 = west ? -10.1 : 2.2;
    var phase;
    for (i = 0; i < mesh.count; i += 1) {
      if (i < active) {
        phase = (t * 0.8 + hash(i + (west ? 210 : 260)) * 1.7) % 1;
        this.tmpP.set(x0 + hash(i + (west ? 230 : 280)) * 8, 0.205, -0.7 + hash(i + 245) * 2.0);
        this.tmpS.set(0.45 + phase * 1.2, 0.45 + phase * 1.2, 0.45 + phase * 1.2);
        this.tmpQ.setFromAxisAngle(new THREE.Vector3(1, 0, 0), Math.PI * 0.5);
        this.tmpM.compose(this.tmpP, this.tmpQ, this.tmpS);
        mesh.setMatrixAt(i, this.tmpM);
      } else {
        this.hideMatrix(mesh, i);
      }
    }
    mesh.material.opacity = 0.16 + clamp(amount) * 0.48;
    mesh.instanceMatrix.needsUpdate = true;
  };

  SceneView.prototype.placeFish = function (mesh, outline, west, amount, t) {
    var i;
    var a = clamp(amount);
    var active = a <= 0 ? 0 : 6 + Math.floor(14 * clamp((a - 0.3) / 0.7) + 0.001);
    var sign = west ? -1 : 1;
    var nearN;
    var farN;
    var shownFar;
    var far;
    var local;
    if (this.view === 'phone') {
      nearN = Math.floor(active / 3);
      farN = active - nearN;
      shownFar = farN;
      if (west && this.side === 'west' && this.phoneFire > 0.5) {
        shownFar = Math.floor(farN * (1 - this.phoneFire * 0.82));
      }
      for (i = 0; i < 42; i += 1) {
        far = i >= nearN;
        local = far ? i - nearN : i;
        if (i < nearN || (far && local < shownFar)) {
          this.tmpP.set(sign * ((far ? 2.0 : 5.1) + (hash(i + (west ? 11 : 71)) - 0.5) * 2.0), 0.07 + (i % 3) * 0.012, -6.1 + hash(i + 19) * 6.8);
          this.tmpP.x += Math.sin(t * 1.4 + i * 2.1) * (0.08 + (this.fishScatter || 0) * 0.2);
          this.tmpP.z += Math.sin(t * 2.2 + i) * (this.fishScatter || 0) * 0.28;
          this.tmpS.set(sign * (0.26 + hash(i + 90) * 0.06), 0.26 + hash(i + 70) * 0.06, 0.3);
          this.tmpS.multiplyScalar(1.18);
          this.tmpM.compose(this.tmpP, this.tmpQ.set(0, 0, 0, 1), this.tmpS);
          outline.setMatrixAt(i, this.tmpM);
          this.tmpS.multiplyScalar(1 / 1.18);
          this.tmpM.compose(this.tmpP, this.tmpQ.set(0, 0, 0, 1), this.tmpS);
          mesh.setMatrixAt(i, this.tmpM);
        } else {
          this.hideMatrix(mesh, i);
          this.hideMatrix(outline, i);
        }
      }
      mesh.instanceMatrix.needsUpdate = true;
      outline.instanceMatrix.needsUpdate = true;
      return;
    }
    for (i = 0; i < 42; i += 1) {
      if (i < active) {
        /* 어군 = 엇갈린 격자(6열) — 한 마리씩 셀 수 있게, 물고기 하나 ≤ 배의 1/3(R1) */
        this.tmpP.set(sign * ((west ? 4.4 : 6.15) + (i % 6) * (west ? 0.66 : 0.5) + (Math.floor(i / 6) % 2) * 0.3 + (hash(i + 1) - 0.5) * 0.12), -0.5 - Math.floor(i / 6) * 0.36 - (hash(i + 7) - 0.5) * 0.08, 3.03 + (i % 3) * 0.035);
        this.tmpP.x += Math.sin(t * 1.4 + i * 2.1) * (0.06 + (this.fishScatter || 0) * 0.2);
        this.tmpS.set(sign * (0.3 + a * 0.03), 0.3 + a * 0.03, 0.38);
        this.tmpS.multiplyScalar(1.36);
        this.tmpM.compose(this.tmpP, this.tmpQ.set(0, 0, 0, 1), this.tmpS);
        outline.setMatrixAt(i, this.tmpM);
        this.tmpS.multiplyScalar(1 / 1.36);
        this.tmpM.compose(this.tmpP, this.tmpQ.set(0, 0, 0, 1), this.tmpS);
        mesh.setMatrixAt(i, this.tmpM);
      } else {
        this.hideMatrix(mesh, i);
        this.hideMatrix(outline, i);
      }
    }
    mesh.instanceMatrix.needsUpdate = true;
    outline.instanceMatrix.needsUpdate = true;
  };

  SceneView.prototype.placeWeather = function (e, t) {
    var wind = clamp(num(e.wind, 1));
    var i;
    var x;
    var ribbonW;
    var fire = clamp(num(e.fire, 0));
    var drought = clamp(num(e.drought, 0));
    var tankLevel;
    this.phoneFire = fire;
    this.phoneWind = wind;
    ribbonW = 7.5 + wind * 4.8;
    this.windRibbon.scale.y = 0.36 * (0.58 + wind * 0.92);
    this.windRibbon.scale.x = ribbonW;
    this.windRibbon.position.x = 6.3 - ribbonW * 0.5;
    this.windRibbon.material.opacity = 0.68 + wind * 0.22;
    this.windHead.scale.set(0.34 + wind * 0.28, 0.55 + wind * 0.45, 0.34);
    this.windHead.position.x = 6.3 - ribbonW - 0.15;
    this.windHead.material.opacity = 0.68 + wind * 0.26;
    for (i = 0; i < 18; i += 1) {
      if (i < Math.floor(3 + wind * 15)) {
        x = 6.5 - ((t * (0.45 + wind * 2.0) + i * 0.83) % 13.2);
        this.tmpP.set(x, 4.26 + (i % 3) * 0.42, 1.72);
        this.tmpS.set(0.18 + wind * 0.32, 0.025 + wind * 0.025, 0.025);
        this.tmpM.compose(this.tmpP, this.tmpQ.set(0, 0, 0, 1), this.tmpS);
        this.windStreak.setMatrixAt(i, this.tmpM);
      } else {
        this.hideMatrix(this.windStreak, i);
      }
    }
    this.windStreak.instanceMatrix.needsUpdate = true;
    this.placeRain(this.rainW, true, num(e.rainW, 0), t);
    this.placeRain(this.rainE, false, num(e.rainE, 0), t);
    this.placeRipples(this.ripplesW, true, num(e.rainW, 0), t);
    this.placeRipples(this.ripplesE, false, num(e.rainE, 0), t);
    this.cloudW.material.opacity = 0.12 + clamp(num(e.rainW, 0)) * 0.86;
    this.cloudE.material.opacity = 0.12 + clamp(num(e.rainE, 0)) * 0.86;
    this.cloudW.visible = this.cloudW.material.opacity > 0.13;
    this.cloudE.visible = this.cloudE.material.opacity > 0.13;
    this.flood.visible = num(e.flood, 0) > 0.02;
    this.flood.scale.y = clamp(num(e.flood, 0));
    this.flood.material.opacity = 0.22 + clamp(num(e.flood, 0)) * 0.55;
    this.dry.visible = drought > 0.02;
    this.dry.material.opacity = 0.16 + drought * 0.68;
    this.cracks.visible = drought > 0.08;
    this.cracks.material.opacity = 0.18 + drought * 0.62;
    this.palms.material.color.set(0x2f8b51).lerp(new THREE.Color(0x8b763b), drought * 0.72);
    this.fronds.material.color.set(0x237b4a).lerp(new THREE.Color(0x8e7135), drought * 0.78);
    if (this.view === 'phone') {
      tankLevel = 0.18 + (1 - drought) * 0.82;
      this.phoneTankWater.scale.y = 0.42 * tankLevel;
      this.phoneTankWater.position.y = 0.91 + 0.21 * tankLevel;
    }
    for (i = 0; i < 8; i += 1) {
      if (i < Math.floor(fire * 8 + 0.001)) {
        this.tmpP.set(-12.2 + i * 0.34, 1.3 + Math.sin(t * 2 + i) * 0.15 + (i % 3) * 0.22, -1.15);
        this.tmpS.set(0.18 + hash(i) * 0.18, 0.38 + hash(i + 4) * 0.3, 0.18);
        this.tmpM.compose(this.tmpP, this.tmpQ.set(0, 0, 0, 1), this.tmpS);
        this.fire.setMatrixAt(i, this.tmpM);
        if (this.view === 'phone' && this.side === 'west') {
          this.tmpP.set(-5.25 + (i % 4) * 0.48 + t * 0.025, 0.75 + Math.floor(i / 4) * 0.62 + hash(i) * 0.28, -0.9 + (i % 4) * 0.48);
          this.tmpS.set(0.62 + hash(i) * 0.42, 0.58 + hash(i + 2) * 0.38, 0.5);
        } else {
          this.tmpP.set(-12.1 + i * 0.36 + t * 0.025, 2.0 + (i % 3) * 0.42, -1.35);
          this.tmpS.set(0.28 + hash(i) * 0.25, 0.25 + hash(i + 2) * 0.2, 0.28);
        }
        this.tmpM.compose(this.tmpP, this.tmpQ.set(0, 0, 0, 1), this.tmpS);
        this.smoke.setMatrixAt(i, this.tmpM);
      } else {
        this.hideMatrix(this.fire, i);
        this.hideMatrix(this.smoke, i);
      }
    }
    this.fire.instanceMatrix.needsUpdate = true;
    this.smoke.instanceMatrix.needsUpdate = true;
  };

  SceneView.prototype.placeUpwell = function (amount, t) {
    /* 용승(11-01 손질): 화살표 대신 물방울이 솟는 기둥 3개 — 양(amount)이 크면 굵고 빠르고 진함 */
    var a = clamp(amount);
    var i;
    var k;
    var u;
    for (i = 0; i < 3; i += 1) {
      if (a > 0.04) {
        this.tmpP.set(8.0 + i * 0.62, -1.42, 2.35);
        this.tmpS.set(0.16 + a * 0.12, 1.4 + a * 0.5, 0.02);
        this.tmpM.compose(this.tmpP, this.tmpQ.set(0, 0, 0, 1), this.tmpS);
        this.upBars.setMatrixAt(i, this.tmpM);
      } else {
        this.hideMatrix(this.upBars, i);
      }
    }
    for (k = 0; k < 12; k += 1) {
      i = k % 3;
      if (a > 0.04) {
        u = ((t * (0.25 + a * 0.35) + k * 0.27 + i * 0.13) % 1 + 1) % 1;
        this.tmpP.set(8.0 + i * 0.62 + Math.sin(t * 2 + k) * 0.05, -2.3 + u * 2.05, 2.36);
        this.tmpS.setScalar((0.05 + a * 0.05) * (0.7 + 0.6 * u));
        this.tmpM.compose(this.tmpP, this.tmpQ.set(0, 0, 0, 1), this.tmpS);
        this.upHeads.setMatrixAt(k, this.tmpM);
      } else {
        this.hideMatrix(this.upHeads, k);
      }
    }
    this.upBars.material.opacity = 0.08 + a * 0.16;
    this.upHeads.material.opacity = 0.35 + a * 0.6;
    this.upBars.instanceMatrix.needsUpdate = true;
    this.upHeads.instanceMatrix.needsUpdate = true;
  };

  SceneView.prototype.placePhoneSurface = function (e, t) {
    var warm;
    var upwell;
    var wind;
    var patchN;
    var capN;
    var lineN;
    var i;
    var phase;
    if (this.view !== 'phone') {
      return;
    }
    warm = clamp(num(e.warmE, 0));
    upwell = clamp(num(e.upwell, 1));
    wind = clamp(num(e.wind, 1));
    patchN = Math.floor(12 * upwell * (1 - warm) + 0.001);
    capN = Math.floor(20 * wind + 0.001);
    lineN = Math.floor(22 * wind + 0.001);
    this.phoneWarmSurface.material.opacity = warm * 0.42;
    for (i = 0; i < 12; i += 1) {
      if (i < patchN) {
        phase = 0.72 + 0.18 * Math.sin(t * 0.55 + i);
        this.tmpP.set(6.4 + (i % 4) * 1.35, 0.205, -6.4 + Math.floor(i / 4) * 2.35 + hash(i + 710) * 0.5);
        this.tmpS.set(phase * (0.9 + hash(i + 720) * 0.7), phase * (0.75 + hash(i + 730) * 0.55), phase);
        this.tmpM.compose(this.tmpP, this.tmpQ.setFromAxisAngle(new THREE.Vector3(1, 0, 0), -Math.PI * 0.5), this.tmpS);
        this.phoneUpwell.setMatrixAt(i, this.tmpM);
      } else {
        this.hideMatrix(this.phoneUpwell, i);
      }
    }
    for (i = 0; i < 28; i += 1) {
      if (i < capN) {
        this.tmpP.set(-9.5 + hash(i + 740) * 19, 0.235, -8.8 + hash(i + 750) * 10.2);
        this.tmpS.set(0.28 + wind * 0.3 + hash(i + 760) * 0.18, 0.32 + hash(i + 770) * 0.16, 0.5);
        this.tmpM.compose(this.tmpP, this.tmpQ.setFromAxisAngle(new THREE.Vector3(1, 0, 0), -Math.PI * 0.5), this.tmpS);
        this.phoneWhitecaps.setMatrixAt(i, this.tmpM);
      } else {
        this.hideMatrix(this.phoneWhitecaps, i);
      }
    }
    for (i = 0; i < 22; i += 1) {
      if (i < lineN) {
        this.tmpP.set(-10 + ((hash(i + 780) * 18 + t * (0.25 + wind)) % 20), 0.225, -9 + hash(i + 790) * 10);
        this.tmpS.set(0.35 + wind * 0.72, 0.012, 0.018 + wind * 0.018);
        this.tmpM.compose(this.tmpP, this.tmpQ.setFromAxisAngle(ZUP, (hash(i + 800) - 0.5) * 0.24), this.tmpS);
        this.phoneWindLines.setMatrixAt(i, this.tmpM);
      } else {
        this.hideMatrix(this.phoneWindLines, i);
      }
    }
    this.phoneUpwell.material.opacity = 0.2 + upwell * (1 - warm) * 0.48;
    this.phoneWhitecaps.material.opacity = 0.28 + wind * 0.62;
    this.phoneWindLines.material.opacity = 0.12 + wind * 0.5;
    this.phoneUpwell.instanceMatrix.needsUpdate = true;
    this.phoneWhitecaps.instanceMatrix.needsUpdate = true;
    this.phoneWindLines.instanceMatrix.needsUpdate = true;
  };

  SceneView.prototype.placeBoatPart = function (mesh, i, x, y, z, sx, sy, sz, q) {
    this.tmpP.set(x, y, z);
    this.tmpS.set(sx, sy, sz);
    this.tmpM.compose(this.tmpP, q || this.tmpQ.set(0, 0, 0, 1), this.tmpS);
    mesh.setMatrixAt(i, this.tmpM);
  };

  SceneView.prototype.placeWarmFace = function (warm) {
    var pos = this.warmFace.geometry.attributes.position;
    var xs = [0, 10, 20, 30, 40];
    var i;
    var j;
    var x0;
    var x1;
    var n0;
    var n1;
    var e0;
    var e1;
    var y0;
    var y1;
    for (i = 0; i < 4; i += 1) {
      x0 = xs[i];
      x1 = xs[i + 1];
      n0 = -1.65 + (x0 + 40) * 1.45 / 80;
      n1 = -1.65 + (x1 + 40) * 1.45 / 80;
      e0 = n0 + Math.max(0, Math.min(1, x0 / 20)) * (-1.2 - n0);
      e1 = n1 + Math.max(0, Math.min(1, x1 / 20)) * (-1.2 - n1);
      y0 = n0 + (e0 - n0) * warm;
      y1 = n1 + (e1 - n1) * warm;
      j = i * 6;
      pos.setY(j + 1, y0);
      pos.setY(j + 4, y0);
      pos.setY(j + 5, y1);
    }
    pos.needsUpdate = true;
  };

  SceneView.prototype.placeBoats = function (boats, t) {
    var i;
    var j;
    var b;
    var from;
    var to;
    var p;
    var q;
    var x;
    var y;
    var z;
    var moving;
    var out;
    var haul;
    var color;
    var sat;
    var catchN;
    var catchIndex = 0;
    var show;
    var boatScale;
    var dir;
    var target;
    var rawP;
    var roll;
    var splashIndex = 0;
    var meX = null;
    var meY = null;
    var meZ = null;
    var markerColor;
    var hsl;
    var phoneMeX = null;
    var phoneMeZ = null;
    var scan;
    var scanP;
    var scanFrom;
    var scanTo;
    var palette = [0xe84a3b, 0x2979d8, 0xf2a51a, 0x22a46b, 0x9a57c7, 0x1f9fb5, 0xd9508b, 0x6e8f35, 0xe06b22, 0x455ec7, 0xc93c58, 0x2b887f, 0xad7134, 0x6d67b3, 0xd68c2c];
    this.boatPoints = {};
    this.boatBounds = {};
    this.markerPoints = {};
    this.fishScatter = 0;
    if (this.view === 'phone') {
      this.phoneTarget.visible = false;
      for (j = 0; j < boats.length; j += 1) {
        scan = boats[j] || {};
        if (scan.me) {
          scanP = clamp(num(scan.p, 0));
          scanP = scanP * scanP * (3 - 2 * scanP);
          scanFrom = this.slot(scan.village, scan.from || 'port', num(scan.id, j));
          scanTo = this.slot(scan.village, scan.to || 'near', num(scan.id, j));
          phoneMeX = scanFrom.x + (scanTo.x - scanFrom.x) * scanP;
          phoneMeZ = scanFrom.z + (scanTo.z - scanFrom.z) * scanP;
          break;
        }
      }
    }
    for (i = 0; i < 30; i += 1) {
      b = i < boats.length ? (boats[i] || {}) : null;
      show = !!b;
      if (show) {
        rawP = clamp(num(b.p, 0));
        p = rawP * rawP * (3 - 2 * rawP);
        from = this.slot(b.village, b.from || 'port', num(b.id, i));
        to = this.slot(b.village, b.to || 'near', num(b.id, i));
        x = from.x + (to.x - from.x) * p;
        z = from.z + (to.z - from.z) * p;
        if (this.view === 'phone' && b.village !== this.side && (b.from !== 'port' || b.to !== 'port') && phoneMeX !== null) {
          var phoneLane = num(b.id, i) % 15;
          var phoneRow = Math.floor(phoneLane / 5);
          var phoneCol = phoneLane % 5;
          var phoneHeading = this.side === 'west' ? 1 : -1;
          x = phoneMeX + phoneHeading * (8.2 + phoneCol * 0.72 + phoneRow * 0.3);
          z = phoneMeZ - (12.1 + phoneCol * 0.72 - phoneRow * 0.85);
        }
        moving = Math.abs(to.x - from.x) > 0.1 && p > 0.01 && p < 0.99;
        y = from.y + (to.y - from.y) * p + (moving ? Math.sin(Math.PI * p) * 0.22 : 0) + Math.sin(t * 2.2 + num(b.id, i)) * 0.035;
        out = clamp(num(b.out, 0));
        y -= out * 0.04;
        haul = clamp(num(b.haul, 0));
        if (haul > this.fishScatter) {
          this.fishScatter = haul;
        }
        boatScale = this.view === 'phone' ? (b.me ? 1.78 : (b.village === this.side ? 0.76 : 0.62)) : 0.74;
        dir = Math.abs(to.x - from.x) < 0.01 ? (b.village === 'west' ? 1 : -1) : (to.x >= from.x ? 1 : -1);
        roll = moving ? Math.sin(rawP * Math.PI * 2) * 0.11 : 0;
        q = this.tmpQ.setFromAxisAngle(ZUP, (to.x >= from.x ? 0 : Math.PI) + roll);
        color = new THREE.Color(b.village === 'west' ? 0xe60032 : 0x0c47c7);
        if (this.view === 'phone' && !b.me) {
          hsl = {};
          color.getHSL(hsl);
          color.setHSL(hsl.h, hsl.s * 0.3, hsl.l * 0.94);
        }
        if (out > 0) {
          color.lerp(this.outHull, out);
        }
        this.boatHull.setColorAt(i, color);
        this.tmpC.set(0xd9a25e).lerp(new THREE.Color(0x8e9196), out);
        this.boatDeck.setColorAt(i, this.tmpC);
        this.boatBow.setColorAt(i, color);
        this.tmpC.set(0x13294b).lerp(new THREE.Color(0x777b7f), out);
        this.boatRims.setColorAt(i, this.tmpC);
        this.boatBowOutline.setColorAt(i, this.tmpC);
        this.boatCabinOutline.setColorAt(i, this.tmpC);
        this.boatSailOutline.setColorAt(i, this.tmpC);
        this.boatMastOutline.setColorAt(i, this.tmpC);
        this.tmpC.set(0xffc400).lerp(this.outCabin, out);
        this.boatCabin.setColorAt(i, this.tmpC);
        this.tmpC.set(0xffdd8a).lerp(this.outSail, out);   /* 크림색 돛(카드와 같은 결) */
        this.boatSail.setColorAt(i, this.tmpC);
        this.tmpC.set(0x8a6a53).lerp(this.outMast, out);
        this.boatMast.setColorAt(i, this.tmpC);
        /* 돛단배(11-01): 몸통(이물 뾰족 · 뱃전 휨) + 갑판 + 작은 선실 + 돛대 + 주돛(돛대에서 고물 쪽 직각삼각형). 진행 방향은 이물 모양과 물결 자국만 */
        this.placeBoatPart(this.boatRims, i, x, y + 0.008 * boatScale, z, 0.58 * boatScale, 0.565 * boatScale, 0.35 * boatScale, q);   /* 외곽선: 옆·앞뒤로만 굵게 — 위로 키우면 안쪽 면이 갑판을 덮어 배가 남색 덩어리가 됨 */
        this.placeBoatPart(this.boatHull, i, x, y + 0.02 * boatScale, z, 0.46 * boatScale, 0.55 * boatScale, 0.26 * boatScale, q);
        this.placeBoatPart(this.boatDeck, i, x, y + 0.02 * boatScale, z, 0.46 * boatScale, 0.55 * boatScale, 0.26 * boatScale, q);
        this.hideMatrix(this.boatBow, i);
        this.hideMatrix(this.boatBowOutline, i);
        this.placeBoatPart(this.boatCabinOutline, i, x - dir * 0.13 * boatScale, y + 0.1 * boatScale, z, 0.24 * boatScale, 0.62 * boatScale, 0.25 * boatScale, this.tmpQ.set(0, 0, 0, 1));
        this.placeBoatPart(this.boatCabin, i, x - dir * 0.13 * boatScale, y + 0.1 * boatScale, z, 0.2 * boatScale, 0.52 * boatScale, 0.21 * boatScale, this.tmpQ.set(0, 0, 0, 1));
        this.placeBoatPart(this.boatMastOutline, i, x + dir * 0.06 * boatScale, y + 0.56 * boatScale, z - 0.005, 0.05 * boatScale, 0.98 * boatScale, 0.05 * boatScale, this.tmpQ.set(0, 0, 0, 1));
        this.placeBoatPart(this.boatMast, i, x + dir * 0.06 * boatScale, y + 0.56 * boatScale, z + 0.01, 0.032 * boatScale, 0.96 * boatScale, 0.032 * boatScale, this.tmpQ.set(0, 0, 0, 1));
        var sSx = dir > 0 ? -0.8 * boatScale : 0.8 * boatScale, sSy = 0.84 * boatScale, sK = this.view === "phone" ? 1.16 : 1.45;   /* 돛 외곽선 = 돛 무게중심(0.183, 0.333) 기준으로 1.22배 — 돛을 빙 둘러싼 굵은 테 */
        this.placeBoatPart(this.boatSailOutline, i, x + dir * 0.035 * boatScale + 0.183 * sSx * (1 - sK), y + 0.2 * boatScale + 0.333 * sSy * (1 - sK), z + 0.02, sSx * sK, sSy * sK, 0.8 * boatScale, this.tmpQ.set(0, 0, 0, 1));
        this.placeBoatPart(this.boatSail, i, x + dir * 0.035 * boatScale, y + 0.2 * boatScale, z + 0.035, dir > 0 ? -0.8 * boatScale : 0.8 * boatScale, 0.84 * boatScale, 0.8 * boatScale, this.tmpQ.set(0, 0, 0, 1));
        this.placeBoatPart(this.boatShadows, i, x, 0.13, z, 0.62 * boatScale, 0.025, 0.3 * boatScale, this.tmpQ.set(0, 0, 0, 1));
        if (moving) {
          this.placeBoatPart(this.wakes, i, x - dir * 0.58 * boatScale, y - 0.06, z, (0.24 + Math.sin(rawP * Math.PI) * 0.42 + Math.sin(t * 5 + i) * 0.06) * boatScale, 0.025, 0.2 * boatScale, this.tmpQ.set(0, 0, 0, 1));
        } else {
          this.hideMatrix(this.wakes, i);
        }
        if (this.view === 'phone' && b.me) {
          markerColor = new THREE.Color(out >= 1 ? 0x76828b : (b.village === 'west' ? 0xe52f43 : 0x175bd1));
          this.halos.setColorAt(0, markerColor);
          this.meFlag.setColorAt(0, markerColor);
          this.hideMatrix(this.haloOutlines, 0);
          this.placeBoatPart(this.halos, 0, x, 0.215, z, (0.78 + Math.sin(t * 3) * 0.08) * boatScale, (0.78 + Math.sin(t * 3) * 0.08) * boatScale, 0.45, this.tmpQ.setFromAxisAngle(new THREE.Vector3(1, 0, 0), -Math.PI * 0.5));
          this.halos.material.opacity = 0.42 + Math.sin(t * 3) * 0.12;
          var flagY = y + 1.05 * boatScale;
          var flagFill = 0.22 + this.phoneWind * 0.78;
          this.placeBoatPart(this.meFlagOutline, 0, x + dir * 0.15 * boatScale * flagFill, flagY, z + 0.02, dir * 0.58 * boatScale * flagFill, 0.58 * boatScale, 1, this.tmpQ.set(0, 0, 0, 1));
          this.placeBoatPart(this.meFlag, 0, x + dir * 0.15 * boatScale * flagFill, flagY + 0.012, z + 0.035, dir * 0.48 * boatScale * flagFill, 0.46 * boatScale, 1, this.tmpQ.set(0, 0, 0, 1));
          this.markerPoints[String(b.id)] = {x: x + dir * 0.2 * boatScale * flagFill, y: flagY + 0.05, z: z + 0.035};
          meX = x;
          meY = y;
          meZ = z;
        } else {
          this.hideMatrix(this.halos, i);
          this.hideMatrix(this.haloOutlines, i);
          this.hideMatrix(this.mePinOutline, i);
          this.hideMatrix(this.mePin, i);
          this.hideMatrix(this.meFlagOutline, i);
          this.hideMatrix(this.meFlag, i);
        }
        if (haul > 0.03 && b.to !== 'port') {
          this.placeBoatPart(this.nets, i, x, y - 0.28 - Math.sin(haul * Math.PI) * 0.72, z + 0.03, 0.5 + haul * 0.45, 0.5 + haul * 0.45, 0.5, this.tmpQ.set(0, 0, 0, 1));
          for (j = 0; j < 3 && splashIndex < this.splashes.count; j += 1) {
            this.placeBoatPart(this.splashes, splashIndex, x + (j - 1) * 0.22, 0.22 + Math.abs(Math.sin(t * 4 + j + i)) * 0.25, z + 0.08, 0.055, 0.12 + haul * 0.12, 0.055, this.tmpQ.set(0, 0, 0, 1));
            splashIndex += 1;
          }
        } else {
          this.hideMatrix(this.nets, i);
        }
        catchN = Math.max(0, Math.min(9, Math.floor(num(b.catch, 0))));
        for (j = 0; j < catchN; j += 1) {
          this.placeBoatPart(this.catchFish, catchIndex, x + (j % 3 - 1) * 0.14, y - 0.27 - Math.sin(haul * Math.PI) * 0.7 - Math.floor(j / 3) * 0.11, z + 0.06, 0.32, 0.32, 0.32, this.tmpQ.set(0, 0, 0, 1));
          catchIndex += 1;
        }
        this.boatPoints[String(b.id)] = {x: x, y: y + 0.32 * boatScale, z: z};
        this.boatBounds[String(b.id)] = {
          a: {x: x - dir * 0.52 * boatScale, y: y + 0.25 * boatScale, z: z},
          b: {x: x + dir * 0.72 * boatScale, y: y + 0.25 * boatScale, z: z}
        };
        if (this.phoneTarget) {
          this.phoneTarget.visible = false;
        }
      } else {
        this.hideMatrix(this.boatHull, i);
        this.hideMatrix(this.boatDeck, i);
        this.hideMatrix(this.boatRims, i);
        this.hideMatrix(this.boatBow, i);
        this.hideMatrix(this.boatBowOutline, i);
        this.hideMatrix(this.boatCabinOutline, i);
        this.hideMatrix(this.boatCabin, i);
        this.hideMatrix(this.boatSailOutline, i);
        this.hideMatrix(this.boatSail, i);
        this.hideMatrix(this.boatMastOutline, i);
        this.hideMatrix(this.boatMast, i);
        this.hideMatrix(this.wakes, i);
        this.hideMatrix(this.boatShadows, i);
        this.hideMatrix(this.halos, i);
        this.hideMatrix(this.haloOutlines, i);
        this.hideMatrix(this.mePinOutline, i);
        this.hideMatrix(this.mePin, i);
        this.hideMatrix(this.meFlagOutline, i);
        this.hideMatrix(this.meFlag, i);
        this.hideMatrix(this.nets, i);
      }
    }
    while (catchIndex < 270) {
      this.hideMatrix(this.catchFish, catchIndex);
      catchIndex += 1;
    }
    while (splashIndex < 24) {
      this.hideMatrix(this.splashes, splashIndex);
      splashIndex += 1;
    }
    if (this.view === 'phone' && meX !== null) {
      var heading = this.side === 'west' ? 1 : -1;
      var desiredX = meX - heading * 4.9;
      var desiredY = meY + 3.3 + Math.sin(t * 1.25) * 0.055;
      var desiredZ = meZ + 7.5;
      var desiredLookX = meX + heading * 4.9;
      var desiredLookZ = meZ - 7.5;
      this.phoneCameraX += (desiredX - this.phoneCameraX) * 0.3;
      this.phoneCameraY += (desiredY - this.phoneCameraY) * 0.3;
      this.phoneCameraZ += (desiredZ - this.phoneCameraZ) * 0.3;
      this.phoneLookX += (desiredLookX - this.phoneLookX) * 0.3;
      this.phoneLookZ += (desiredLookZ - this.phoneLookZ) * 0.3;
      this.camera.position.set(this.phoneCameraX, this.phoneCameraY, this.phoneCameraZ);
      this.camera.lookAt(new THREE.Vector3(this.phoneLookX, meY + 1.45, this.phoneLookZ));
      this.camera.updateMatrixWorld(true);
    }
    this.boatHull.instanceMatrix.needsUpdate = true;
    this.boatDeck.instanceMatrix.needsUpdate = true;
    this.boatRims.instanceMatrix.needsUpdate = true;
    this.boatBow.instanceMatrix.needsUpdate = true;
    this.boatBowOutline.instanceMatrix.needsUpdate = true;
    this.boatCabinOutline.instanceMatrix.needsUpdate = true;
    this.boatCabin.instanceMatrix.needsUpdate = true;
    this.boatSailOutline.instanceMatrix.needsUpdate = true;
    this.boatSail.instanceMatrix.needsUpdate = true;
    this.boatMastOutline.instanceMatrix.needsUpdate = true;
    this.boatMast.instanceMatrix.needsUpdate = true;
    this.wakes.instanceMatrix.needsUpdate = true;
    this.boatShadows.instanceMatrix.needsUpdate = true;
    this.haloOutlines.instanceMatrix.needsUpdate = true;
    this.halos.instanceMatrix.needsUpdate = true;
    this.mePinOutline.instanceMatrix.needsUpdate = true;
    this.mePin.instanceMatrix.needsUpdate = true;
    this.meFlagOutline.instanceMatrix.needsUpdate = true;
    this.meFlag.instanceMatrix.needsUpdate = true;
    this.nets.instanceMatrix.needsUpdate = true;
    this.catchFish.instanceMatrix.needsUpdate = true;
    this.splashes.instanceMatrix.needsUpdate = true;
    if (this.boatHull.instanceColor) {
      this.boatHull.instanceColor.needsUpdate = true;
      if (this.boatDeck.instanceColor) this.boatDeck.instanceColor.needsUpdate = true;
      this.boatBow.instanceColor.needsUpdate = true;
      this.boatRims.instanceColor.needsUpdate = true;
      this.boatBowOutline.instanceColor.needsUpdate = true;
      this.boatCabinOutline.instanceColor.needsUpdate = true;
      this.boatSailOutline.instanceColor.needsUpdate = true;
      this.boatMastOutline.instanceColor.needsUpdate = true;
      if (this.boatCabin.instanceColor) {
        this.boatCabin.instanceColor.needsUpdate = true;
      }
      this.boatSail.instanceColor.needsUpdate = true;
      this.boatMast.instanceColor.needsUpdate = true;
    }
    if (this.halos.instanceColor) {
      this.halos.instanceColor.needsUpdate = true;
      this.mePin.instanceColor.needsUpdate = true;
      this.meFlag.instanceColor.needsUpdate = true;
    }
  };

  SceneView.prototype.update = function (t, state) {
    var e;
    var warm;
    var cool;
    var a;
    var pos;
    var i;
    var palm;
    var arm;
    this.startMs = global.performance && global.performance.now ? global.performance.now() : 0;
    this.t = num(t, 0);
    state = state || {};
    e = state.env || {};
    warm = clamp(num(e.warmE, 0));
    cool = clamp(num(e.coolW, 0));
    this.warmEast.material.opacity = 0.03 + warm * 0.34;
    this.warmFace.material.opacity = 0.16 + warm * 0.6;
    this.water.material.uniforms.uTime.value = this.t;
    this.water.material.uniforms.uWarm.value = warm;
    this.water.material.uniforms.uCoolW.value = cool;
    if (this.underwater.material.uniforms) {   /* 재질이 바뀐 경우(검사 주입 등) 대비 */
      this.underwater.material.uniforms.uTime.value = this.t;
      this.underwater.material.uniforms.uWarm.value = warm;
    }
    this.fishW.material.uniforms.uTime.value = this.t;
    this.fishE.material.uniforms.uTime.value = this.t;
    this.catchFish.material.uniforms.uTime.value = this.t;
    this.warmWest.material.opacity = 0.3;
    this.warmWest.material.color.setRGB(0.9 - cool * 0.2, 0.62 + cool * 0.03, 0.43 + cool * 0.12);
    this.placeWarmFace(warm);
    pos = this.water.geometry.attributes.position;
    for (i = 0; i < pos.count; i += 1) {
      pos.setY(i, this.waterBaseY[i] + Math.sin(this.t * 1.25 + pos.getX(i) * 1.4 + pos.getZ(i) * 2.1) * 0.045);
    }
    pos.needsUpdate = true;
    for (i = 0; i < 28; i += 1) {
      palm = Math.floor(i / 4);
      arm = i % 4;
      this.tmpP.set(-12.45 + palm * 0.52, 1.78 + hash(palm + 20) * 0.28, -0.4 + (palm % 2) * 0.85 + 0.04);
      this.tmpS.set(0.62, 0.62, 0.62);
      this.tmpQ.setFromAxisAngle(ZUP, arm * Math.PI * 0.5 + Math.sin(this.t * 1.25 + palm) * 0.1);
      this.tmpM.compose(this.tmpP, this.tmpQ, this.tmpS);
      this.fronds.setMatrixAt(i, this.tmpM);
    }
    this.fronds.instanceMatrix.needsUpdate = true;
    this.placeWeather(e, this.t);
    this.placePhoneSurface(e, this.t);
    this.placeBoats(state.boats || [], this.t);
    this.placeFish(this.fishW, this.fishWOutline, true, num(e.fishW, 0.7), this.t);
    this.placeFish(this.fishE, this.fishEOutline, false, num(e.fishE, 1), this.t);
    this.placeUpwell(num(e.upwell, 1), this.t);
    a = clamp(num(state.pulse, 0));
    this.pulse.visible = this.view !== 'phone' && a > 0.001;
    this.pulse.position.x = -13.5 + a * 27;
    this.pulse.material.opacity = Math.sin(a * Math.PI) * 0.24;
    if (state.spotlight === 'west') {
      this.renderer.setClearColor(0x67b9d5, 1);
      this.warmEast.material.opacity *= 0.38;
      this.cloudE.material.opacity *= 0.42;
    } else if (state.spotlight === 'east') {
      this.renderer.setClearColor(0x67b9d5, 1);
      this.warmWest.material.opacity = 0.12;
      this.cloudW.material.opacity *= 0.42;
    } else {
      this.renderer.setClearColor(0x78c9e5, 1);
      this.warmWest.material.opacity = 0.3;
    }
  };

  SceneView.prototype.render = function () {
    var end;
    this.renderer.info.reset();
    this.renderer.setRenderTarget(this.postTarget);
    this.renderer.render(this.scene, this.camera);
    this.renderer.setRenderTarget(null);
    this.renderer.render(this.postScene, this.postCamera);
    end = global.performance && global.performance.now ? global.performance.now() : this.startMs;
    this.lastMs = Math.max(0, end - this.startMs);
  };

  SceneView.prototype.anchor = function (name, i) {
    var p;
    var slot;
    if (name === 'boat') {
      p = this.boatPoints[String(i)];
    } else if (name === 'marker') {
      p = this.markerPoints[String(i)];
    } else if (name === 'boat-start') {
      p = this.boatBounds[String(i)] && this.boatBounds[String(i)].a;
    } else if (name === 'boat-end') {
      p = this.boatBounds[String(i)] && this.boatBounds[String(i)].b;
    } else if (name === 'village-west') {
      p = {x: -11.4, y: 1.1, z: 0};
    } else if (name === 'village-east') {
      p = {x: 11.35, y: 1.1, z: 0};
    } else if (name === 'port-west') {
      p = this.slot('west', 'port', 7);
    } else if (name === 'port-east') {
      p = this.slot('east', 'port', 7);
    } else if (name === 'zone-west-near') {
      p = this.slot('west', 'near', 7);
    } else if (name === 'zone-west-far') {
      p = this.slot('west', 'far', 7);
    } else if (name === 'zone-east-near') {
      p = this.slot('east', 'near', 7);
    } else if (name === 'zone-east-far') {
      p = this.slot('east', 'far', 7);
    } else if (name === 'wind') {
      p = {x: 0, y: 4.7, z: 1.7};
    } else if (name === 'front-top') {
      p = {x: this.side === 'west' ? -7 : 7, y: -0.06, z: 2.08};
    }
    if (!p) {
      return null;
    }
    slot = new THREE.Vector3(p.x, p.y, p.z);
    slot.project(this.camera);
    return {x: (slot.x + 1) * this.w * 0.5, y: (1 - slot.y) * this.h * 0.5};
  };

  SceneView.prototype.project = function (name, i) {
    return this.anchor(name, i);
  };

  SceneView.prototype.stats = function () {
    return {
      triangles: this.renderer.info.render.triangles,
      calls: this.renderer.info.render.calls,
      ms: Math.round(this.lastMs * 1000) / 1000
    };
  };

  SceneView.prototype.dispose = function () {
    var seen = [];
    this.scene.traverse(function (o) {
      if (o.geometry && seen.indexOf(o.geometry) < 0) {
        seen.push(o.geometry);
        o.geometry.dispose();
      }
      if (o.material && seen.indexOf(o.material) < 0) {
        seen.push(o.material);
        o.material.dispose();
      }
    });
    if (this.skyTexture) {
      this.skyTexture.dispose();
    }
    if (this.postTarget) {
      this.postTarget.dispose();
      this.postQuad.geometry.dispose();
      this.postMaterial.dispose();
    }
    this.renderer.dispose();
  };

  var iconState = {
    canvas: null,
    renderer: null,
    cache: {},
    resources: []
  };

  function iconTrack(resource) {
    if (resource && iconState.resources.indexOf(resource) < 0) {
      iconState.resources.push(resource);
    }
    return resource;
  }

  function iconMat(color, opacity, unlit) {
    var opt = {
      color: color,
      side: THREE.DoubleSide,
      transparent: opacity < 1,
      opacity: opacity,
      depthWrite: opacity >= 1
    };
    var material;
    if (unlit) {
      material = new THREE.MeshBasicMaterial(opt);
    } else {
      opt.flatShading = true;
      opt.emissive = new THREE.Color(color).multiplyScalar(0.045);
      material = new THREE.MeshToonMaterial(opt);
    }
    return iconTrack(material);
  }

  function iconMesh(parent, geometry, material, x, y, z, sx, sy, sz, rx, ry, rz) {
    var mesh = new THREE.Mesh(iconTrack(geometry), material);
    mesh.position.set(x, y, z);
    mesh.scale.set(sx, sy, sz);
    mesh.rotation.set(rx || 0, ry || 0, rz || 0);
    parent.add(mesh);
    return mesh;
  }

  function iconDisc(scene, color, radius, zscale) {
    return iconMesh(scene, new THREE.CircleGeometry(radius, 24), iconMat(color, 0.96, true),
      0, 0, 0, 1, zscale, 1, -Math.PI * 0.5, 0, 0);
  }

  function iconBoat(scene, village, out, x, y, z, scale) {
    /* 아이콘 배 = 게임 장면의 돛단배 형상 그대로(11-01 사용자: «3D 에셋을 가져오지»). 색은 선명하게(톤 매핑 끔) */
    var group = new THREE.Group();
    var hull = new THREE.Color(out ? 0x7a828c : (village === 'west' ? 0xd7263d : 0x1f56d6));
    var deck = new THREE.Color(out ? 0x9aa0a7 : 0xd6e6f6);   /* 아이콘에서는 흰 갑판 · 흰 선실(나뭇빛 · 노랑은 «모래»로 읽혀 먼바다=육지 없음과 충돌) */
    var cabin = new THREE.Color(out ? 0x8a919b : 0xdcebfb);
    var sail = new THREE.Color(out ? 0xa7adb5 : 0xd9eaff);   /* 아주 옅은 하늘빛 돛(모래색 아님 · 아이콘 채도) */
    var mast = new THREE.Color(out ? 0x6c7178 : 0x7a5638);
    var edge = iconMat(0x13294b, 1, true);
    var back = iconTrack(new THREE.MeshBasicMaterial({color: 0x13294b, side: THREE.BackSide}));
    function lit(c) { return iconTrack(new THREE.MeshLambertMaterial({color: c, side: THREE.DoubleSide, emissive: c.clone().multiplyScalar(0.12)})); }
    group.position.set(x, y, z);
    group.scale.set(scale, scale, scale);
    scene.add(group);
    iconMesh(group, hullGeometry(), back, 0, 0, 0, 1.1, 1.25, 1.14, 0, 0, 0);
    iconMesh(group, hullGeometry(), lit(hull), 0, 0, 0, 1, 1.1, 1, 0, 0, 0);
    iconMesh(group, deckGeometry(), lit(deck), 0, 0.001, 0, 1, 1.1, 1, 0, 0, 0);
    iconMesh(group, new THREE.CylinderGeometry(0.34, 0.42, 0.34, 6), back, -0.28, 0.2, 0, 0.55, 0.62, 0.55, 0, 0, 0);
    iconMesh(group, new THREE.CylinderGeometry(0.34, 0.42, 0.34, 6), lit(cabin), -0.28, 0.2, 0, 0.45, 0.5, 0.45, 0, 0, 0);
    iconMesh(group, new THREE.CylinderGeometry(1, 1, 1, 6), edge, 0.12, 0.66, 0, 0.05, 1.1, 0.05, 0, 0, 0);
    iconMesh(group, new THREE.CylinderGeometry(1, 1, 1, 6), lit(mast), 0.12, 0.66, 0.01, 0.032, 1.08, 0.032, 0, 0, 0);
    iconMesh(group, sailGeometry(), edge, 0.1, 0.22, -0.01, -1.42, 1.0, 1, 0, 0, 0);
    iconMesh(group, sailGeometry(), lit(sail), 0.085, 0.25, 0.01, -1.3, 0.92, 1, 0, 0, 0);
    return group;
  }

  function iconHouse(scene, store, x, y, z, scale) {
    var group = new THREE.Group();
    group.position.set(x, y, z);
    group.scale.set(scale, scale, scale);
    scene.add(group);
    iconMesh(group, new THREE.BoxGeometry(1, 1, 1), iconMat(store ? 0xd6aa70 : 0xe18e49, 1, false),
      0, 0.62, 0, store ? 0.82 : 0.68, store ? 0.72 : 0.62, store ? 0.7 : 0.62, 0, 0, 0);
    iconMesh(group, new THREE.ConeGeometry(1, 0.72, 4), iconMat(store ? 0x88906a : 0xb94931, 1, false),
      0, 1.46, 0, store ? 1.16 : 1, 1, store ? 1.04 : 0.94, 0, Math.PI * 0.25, 0);
    iconMesh(group, new THREE.BoxGeometry(1, 1, 1), iconMat(0x765340, 1, false),
      0.12, 0.55, 0.705, 0.25, 0.43, 0.035, 0, 0, 0);
    if (store) {
      iconMesh(group, new THREE.CylinderGeometry(1, 1, 1, 5), iconMat(0x70462d, 1, false),
        -0.55, 0.02, -0.42, 0.07, 0.4, 0.07, 0, 0, 0);
      iconMesh(group, new THREE.CylinderGeometry(1, 1, 1, 5), iconMat(0x70462d, 1, false),
        0.55, 0.02, -0.42, 0.07, 0.4, 0.07, 0, 0, 0);
      iconMesh(group, new THREE.CylinderGeometry(1, 1, 1, 5), iconMat(0x70462d, 1, false),
        -0.55, 0.02, 0.42, 0.07, 0.4, 0.07, 0, 0, 0);
      iconMesh(group, new THREE.CylinderGeometry(1, 1, 1, 5), iconMat(0x70462d, 1, false),
        0.55, 0.02, 0.42, 0.07, 0.4, 0.07, 0, 0, 0);
    }
    return group;
  }

  function iconCrate(scene, x, z, scale) {
    iconMesh(scene, new THREE.BoxGeometry(1, 1, 1), iconMat(0x9a6338, 1, false),
      x, 0.16, z, 0.45 * scale, 0.24 * scale, 0.38 * scale, 0, 0, 0);
    iconMesh(scene, fishGeometry(), iconMat(0xffd438, 1, true),
      x, 0.31, z + 0.2, 0.9 * scale, 0.9 * scale, 0.9 * scale, -0.35, 0, 0);
  }

  function iconRipple(scene, x, y, z, sx, color) {
    iconMesh(scene, new THREE.TorusGeometry(0.45, 0.045, 4, 7, Math.PI), iconMat(color, 0.82, true),
      x, y, z, sx, 0.55, 1, -Math.PI * 0.5, 0, 0);
  }

  function iconScene(kind, village, out) {
    var scene = new THREE.Scene();
    var light = new THREE.HemisphereLight(0xfff4d4, 0x174e68, 1.35);
    var sun = new THREE.DirectionalLight(0xfff0c8, 1.55);
    var camera;
    scene.add(light);
    sun.position.set(-3, 6, 5);
    scene.add(sun);
    if (kind === 'card') {
      scene.background = new THREE.Color(0x8ed9df);
      camera = new THREE.OrthographicCamera(-3.2, 3.2, 2.4, -2.4, 0.1, 40);
      camera.position.set(4.7, 4.1, 6.4);
      camera.lookAt(new THREE.Vector3(0, 0.45, 0));
      iconMesh(scene, new THREE.CircleGeometry(0.82, 20), iconMat(0xffd267, 0.72, true),
        -1.72, 2.05, -1.75, 1, 1, 1, 0, 0, 0);
      iconMesh(scene, new THREE.PlaneGeometry(3.3, 3.2), iconMat(0x4bc7cf, 0.96, false),
        -1.5, -0.05, 0, 1, 1, 1, -Math.PI * 0.5, 0.08, 0);
      iconMesh(scene, new THREE.PlaneGeometry(3.5, 3.2), iconMat(0x176f9d, 0.96, false),
        1.65, 0, 0, 1, 1, 1, -Math.PI * 0.5, -0.08, 0);
      iconRipple(scene, -1.52, 0.12, 0.8, 1.15, 0xffe1a3);
      iconRipple(scene, 1.65, 0.12, -0.82, 1.45, 0xc8f5ff);
      iconMesh(scene, new THREE.ConeGeometry(1, 1.8, 6), iconMat(0x3d7659, 1, false),
        -2.5, 0.45, -1.3, 0.8, 1.25, 0.8, 0, 0, 0);
      iconMesh(scene, new THREE.ConeGeometry(1, 2.2, 6), iconMat(0x7c8069, 1, false),
        2.55, 0.55, -1.45, 0.92, 1.35, 0.92, 0, 0, 0);
      iconBoat(scene, village, out, 0.2, 0.1, 0.05, 1.25);
      return {scene: scene, camera: camera};
    }
    camera = new THREE.OrthographicCamera(-0.95, 0.95, 0.95, -0.95, 0.1, 40);
    camera.position.set(1.5, 1.35, 3.4);
    camera.lookAt(new THREE.Vector3(0.0, 0.64, 0));
    light.intensity = 0.5;
    sun.intensity = 0.7;
    if (kind !== 'store') {
      iconBoat(scene, village, out, 0.02, 0, 0, 1.3);
    }
    return {scene: scene, camera: camera};
  }

  function iconEnsureRenderer() {
    if (iconState.renderer) {
      return true;
    }
    try {
      iconState.canvas = global.document.createElement('canvas');
      iconState.renderer = new THREE.WebGLRenderer({
        canvas: iconState.canvas,
        alpha: true,
        antialias: true,
        premultipliedAlpha: false,
        powerPreference: 'low-power'
      });
      iconState.renderer.setClearColor(0x000000, 0);
      iconState.renderer.outputEncoding = THREE.sRGBEncoding;
      iconState.renderer.toneMapping = THREE.NoToneMapping;
      return true;
    } catch (e) {
      iconState.canvas = null;
      iconState.renderer = null;
      return false;
    }
  }

  function paintIcon(context, width, height, kind, village, out, boatCanvas) {
    var sx = width / 100;
    var sy = height / 100;
    var edge = '#13294b';
    var tile = kind === 'near' ? '#22c9c0' : (kind === 'far' ? '#4fa6ff' : (kind === 'rest' ? '#f59e0b' : '#e8964c'));   /* 가까운 = 밝은 청록 + 모래, 먼 = 짙은 남색 */
    var hull = out ? '#64748b' : (village === 'west' ? '#c81e3a' : '#173b91');
    var sail = out ? '#a7adb5' : '#fbfdff';   /* 흰 돛 — 크림색이면 모래로 읽힘(먼바다에 육지 없음 검사) */
    var cabin = out ? '#8a919b' : '#dff3ff';
    context.save();
    context.setTransform(sx, 0, 0, sy, 0, 0);
    context.clearRect(0, 0, 100, 100);
    context.fillStyle = tile;
    context.strokeStyle = edge;
    context.lineWidth = 3.5;
    context.beginPath();
    context.arc(50, 50, 45, 0, TAU);
    context.fill();
    context.stroke();
    context.save();
    context.beginPath();
    context.arc(50, 50, 42, 0, TAU);
    context.clip();
    if (kind === 'near') {
      context.fillStyle = '#f2c66d';
      context.beginPath();
      context.moveTo(0, 62); context.quadraticCurveTo(30, 50, 62, 66); context.lineTo(62, 100); context.lineTo(0, 100); context.closePath(); context.fill();
      context.strokeStyle = edge; context.lineWidth = 3; context.stroke();
    } else if (kind === 'far') {
      context.strokeStyle = '#8be5ef'; context.lineWidth = 4; context.lineCap = 'round';
      context.beginPath(); context.moveTo(8, 68); context.quadraticCurveTo(24, 58, 40, 68); context.moveTo(58, 80); context.quadraticCurveTo(75, 68, 92, 79); context.stroke();
    } else if (kind === 'rest') {
      context.fillStyle = '#754225'; context.strokeStyle = edge; context.lineWidth = 4;
      context.fillRect(0, 67, 52, 15); context.strokeRect(-2, 67, 54, 15);
      context.fillRect(9, 78, 8, 22); context.fillRect(39, 78, 8, 22);
    }
    context.restore();
    if (kind === 'store') {
      context.fillStyle = '#f3bc6b'; context.strokeStyle = edge; context.lineWidth = 3.5; context.lineJoin = 'round';
      context.fillRect(23, 43, 54, 38); context.strokeRect(23, 43, 54, 38);
      context.fillStyle = '#d45b32'; context.beginPath(); context.moveTo(16, 44); context.lineTo(50, 17); context.lineTo(84, 44); context.closePath(); context.fill(); context.stroke();
      context.fillStyle = '#5c321d'; context.fillRect(43, 58, 16, 23); context.strokeRect(43, 58, 16, 23);
      context.restore();
      return;
    }
    if (boatCanvas) {   /* 3D 돛단배(게임과 같은 형상)를 원판 위에 */
      context.setTransform(1, 0, 0, 1, 0, 0);
      context.drawImage(boatCanvas, 0, 0, width, height);
      context.setTransform(sx, 0, 0, sy, 0, 0);
    }
    context.strokeStyle = '#e8fbff'; context.lineWidth = 3; context.lineCap = 'round';
    context.beginPath(); context.moveTo(18, 86); context.quadraticCurveTo(50, 93, 82, 85); context.stroke();
    context.restore();
  }

  function paintCard(context, width, height, village, out) {
    var sx = width / 480;
    var sy = height / 360;
    var g;
    var hull = out ? '#66727a' : (village === 'west' ? '#c51f3a' : '#123fa2');
    var edge = '#102b3e';
    context.save();
    context.setTransform(sx, 0, 0, sy, 0, 0);
    g = context.createLinearGradient(0, 0, 0, 220);
    g.addColorStop(0, '#58bcd3');
    g.addColorStop(0.55, '#b9e3d9');
    g.addColorStop(1, '#f5cf91');
    context.fillStyle = g;
    context.fillRect(0, 0, 480, 220);
    g = context.createRadialGradient(365, 68, 4, 365, 68, 54);
    g.addColorStop(0, 'rgba(255,247,185,.98)');
    g.addColorStop(0.25, 'rgba(255,220,127,.62)');
    g.addColorStop(1, 'rgba(255,205,118,0)');
    context.fillStyle = g;
    context.fillRect(305, 8, 120, 120);
    g = context.createLinearGradient(0, 150, 0, 360);
    g.addColorStop(0, '#2598b3');
    g.addColorStop(0.58, '#0b658d');
    g.addColorStop(1, '#073b63');
    context.fillStyle = g;
    context.fillRect(0, 150, 480, 210);
    context.fillStyle = '#5b8c6c';
    context.beginPath();
    context.moveTo(0, 185); context.lineTo(42, 112); context.lineTo(76, 176); context.lineTo(110, 96); context.lineTo(154, 186); context.closePath(); context.fill();
    context.fillStyle = '#2f7f4c';
    context.beginPath();
    context.moveTo(0, 208); context.lineTo(52, 145); context.lineTo(82, 205); context.lineTo(127, 136); context.lineTo(168, 211); context.closePath(); context.fill();
    context.fillStyle = '#9a8a70';
    context.beginPath();
    context.moveTo(480, 202); context.lineTo(434, 102); context.lineTo(397, 192); context.lineTo(366, 126); context.lineTo(332, 211); context.closePath(); context.fill();
    context.fillStyle = '#c6a360';
    context.beginPath();
    context.moveTo(480, 186); context.lineTo(480, 238); context.lineTo(416, 226); context.lineTo(370, 214); context.lineTo(404, 177); context.closePath(); context.fill();
    context.strokeStyle = 'rgba(225,250,250,.7)';
    context.lineWidth = 4;
    context.lineCap = 'round';
    context.beginPath(); context.moveTo(16, 238); context.bezierCurveTo(92, 218, 142, 248, 216, 228); context.stroke();
    context.beginPath(); context.moveTo(292, 272); context.bezierCurveTo(345, 252, 407, 281, 463, 259); context.stroke();
    context.fillStyle = 'rgba(4,42,67,.28)';
    context.beginPath(); context.ellipse(250, 303, 106, 18, 0, 0, TAU); context.fill();
    context.strokeStyle = '#f5f0cf';
    context.lineWidth = 9;
    context.beginPath(); context.moveTo(225, 163); context.lineTo(225, 282); context.stroke();
    context.fillStyle = edge;
    context.beginPath(); context.moveTo(120, 276); context.lineTo(332, 276); context.lineTo(300, 318); context.lineTo(150, 318); context.closePath(); context.fill();
    context.fillStyle = hull;
    context.beginPath(); context.moveTo(130, 282); context.lineTo(319, 282); context.lineTo(292, 308); context.lineTo(156, 308); context.closePath(); context.fill();
    context.fillStyle = '#ffd274';
    context.strokeStyle = edge;
    context.lineWidth = 7;
    context.beginPath(); context.roundRect(164, 244, 56, 42, 8); context.fill(); context.stroke();
    context.fillStyle = '#ffdfa0';
    context.beginPath(); context.moveTo(235, 168); context.lineTo(235, 270); context.lineTo(327, 259); context.closePath(); context.fill(); context.stroke();
    context.fillStyle = '#ffffff';
    context.globalAlpha = 0.86;
    context.beginPath(); context.moveTo(236, 178); context.lineTo(236, 258); context.lineTo(304, 251); context.closePath(); context.fill();
    context.globalAlpha = 1;
    context.strokeStyle = 'rgba(225,250,250,.92)';
    context.lineWidth = 5;
    context.beginPath(); context.moveTo(124, 327); context.quadraticCurveTo(224, 347, 332, 326); context.stroke();
    context.strokeStyle = '#f5f0cf';
    context.lineWidth = 4;
    context.beginPath(); context.moveTo(70, 82); context.quadraticCurveTo(84, 69, 98, 82); context.moveTo(104, 98); context.quadraticCurveTo(118, 85, 132, 98); context.stroke();
    context.fillStyle = '#ffd052';
    for (var i = 0; i < 7; i += 1) {
      context.beginPath();
      context.ellipse(342 + (i % 4) * 22, 310 + Math.floor(i / 4) * 14, 9, 4, 0, 0, TAU);
      context.fill();
      context.beginPath(); context.moveTo(350 + (i % 4) * 22, 310 + Math.floor(i / 4) * 14); context.lineTo(360 + (i % 4) * 22, 304 + Math.floor(i / 4) * 14); context.lineTo(360 + (i % 4) * 22, 316 + Math.floor(i / 4) * 14); context.closePath(); context.fill();
    }
    context.restore();
  }

  function icon(kind, px, opts) {
    var dpr;
    var width;
    var cssHeight;
    var height;
    var village;
    var out;
    var key;
    var target;
    var context;
    var built;
    try {
      opts = opts || {};
      if (['near', 'far', 'rest', 'store', 'card'].indexOf(kind) < 0) {
        return null;
      }
      px = Math.max(1, Math.round(num(px, 44)));
      dpr = Math.max(1, Math.min(3, num(opts.dpr, 1)));
      village = opts.village === 'west' ? 'west' : 'east';
      out = !!opts.out;
      cssHeight = kind === 'card' ? Math.round(px * 0.75) : px;
      width = Math.max(1, Math.round(px * dpr));
      height = Math.max(1, Math.round(cssHeight * dpr));
      key = [kind, px, dpr, village, out ? 1 : 0].join('|');
      if (iconState.cache[key]) {
        return iconState.cache[key];
      }
      if (!global.THREE || !iconEnsureRenderer()) {
        return null;
      }
      built = iconScene(kind, village, out);
      iconState.renderer.setPixelRatio(1);
      iconState.renderer.setSize(width, height, false);
      iconState.renderer.setViewport(0, 0, width, height);
      iconState.renderer.clear(true, true, true);
      iconState.renderer.render(built.scene, built.camera);
      target = global.document.createElement('canvas');
      target.width = width;
      target.height = height;
      target.style.width = px + 'px';
      target.style.height = cssHeight + 'px';
      context = target.getContext('2d');
      if (!context) {
        return null;
      }
      context.clearRect(0, 0, width, height);
      if (kind === 'card') {
        context.drawImage(iconState.canvas, 0, 0, width, height);
        paintCard(context, width, height, village, out);
      } else {
        paintIcon(context, width, height, kind, village, out, kind === 'store' ? null : iconState.canvas);
      }
      iconState.cache[key] = target;
      return target;
    } catch (e) {
      return null;
    }
  }

  function iconDispose() {
    var i;
    for (i = 0; i < iconState.resources.length; i += 1) {
      if (iconState.resources[i] && iconState.resources[i].dispose) {
        iconState.resources[i].dispose();
      }
    }
    iconState.resources = [];
    iconState.cache = {};
    if (iconState.renderer) {
      iconState.renderer.dispose();
      iconState.renderer.forceContextLoss();
    }
    iconState.renderer = null;
    iconState.canvas = null;
  }

  function supported() {
    var c;
    var gl;
    try {
      c = global.document.createElement('canvas');
      gl = c.getContext('webgl2') || c.getContext('webgl') || c.getContext('experimental-webgl');
      return !!gl && !!global.THREE;
    } catch (e) {
      return false;
    }
  }

  global.ELNINO_3D = {
    contract: 1,
    version: '2.5.0',
    supported: supported,
    icon: icon,
    iconDispose: iconDispose,
    create: function (canvas, opt) {
      if (!global.THREE) {
        throw new Error('3D engine unavailable');
      }
      return new SceneView(canvas, opt);
    }
  };
}(window));
