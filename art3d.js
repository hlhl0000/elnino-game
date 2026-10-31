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
    g.setAttribute('position', new THREE.Float32BufferAttribute([
      -0.22, 0, 0, 0.08, 0.13, 0, 0.22, 0, 0,
      -0.22, 0, 0, 0.08, -0.13, 0, 0.22, 0, 0,
      0.19, 0, 0, 0.34, 0.13, 0, 0.34, -0.13, 0
    ], 3));
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
        'varying float vLight;',
        'void main(){',
        'vec3 p=position;',
        'float seed=instanceMatrix[3].x*1.7+instanceMatrix[3].z*.9;',
        'float tail=smoothstep(.12,.36,p.x);',
        'p.y+=sin(uTime*7.0+seed+p.x*16.0)*.075*tail;',
        'vLight=.68+.32*abs(sin(seed+uTime*1.7));',
        'gl_Position=projectionMatrix*modelViewMatrix*instanceMatrix*vec4(p,1.0);',
        '}'
      ].join('\n'),
      fragmentShader: [
        'precision mediump float; uniform vec3 uColor; varying float vLight;',
        'void main(){gl_FragColor=vec4(uColor*vLight,1.0);}'
      ].join('\n')
    });
  }

  function hullGeometry() {
    var g = new THREE.BufferGeometry();
    var p = [
      -0.58,0.08,-0.25, 0.36,0.08,-0.25, 0.62,0.10,0,
      -0.58,0.08,-0.25, 0.62,0.10,0, -0.58,0.08,0.25,
      -0.58,0.08,0.25, 0.62,0.10,0, 0.36,0.08,0.25,
      -0.58,0.08,-0.25, -0.38,-0.22,-0.15, 0.48,-0.17,0,
      -0.58,0.08,-0.25, 0.48,-0.17,0, 0.36,0.08,-0.25,
      0.36,0.08,0.25, 0.48,-0.17,0, -0.38,-0.22,0.15,
      0.36,0.08,0.25, -0.38,-0.22,0.15, -0.58,0.08,0.25,
      -0.58,0.08,-0.25, -0.58,0.08,0.25, -0.38,-0.22,0.15,
      -0.58,0.08,-0.25, -0.38,-0.22,0.15, -0.38,-0.22,-0.15
    ];
    g.setAttribute('position', new THREE.Float32BufferAttribute(p, 3));
    g.computeVertexNormals();
    return g;
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
        'uniform float uTime; uniform float uWarm; uniform vec3 uSun;',
        'varying vec2 vUv; varying vec3 vWorld;',
        'void main(){',
        'float w1=sin(vWorld.x*1.35+uTime*1.4)+sin(vWorld.z*1.9-uTime*1.05);',
        'float n=.5+.5*sin(vWorld.x*3.2+vWorld.z*2.7+uTime*2.0+w1*.35);',
        'float fres=pow(1.0-clamp(abs(normalize(cameraPosition-vWorld).y),0.0,1.0),2.0);',
        'vec3 cool=mix(vec3(.035,.34,.52),vec3(.08,.61,.68),n*.32+vUv.y*.25);',
        'vec3 warm=vec3(.94,.43,.23);',
        'float east=smoothstep(0.0,12.0,vWorld.x)*uWarm;',
        'vec3 col=mix(cool,warm,east*.28);',
        'float glint=pow(max(0.0,sin(vWorld.x*.55+vWorld.z*.16+uTime*.5)),18.0);',
        'col+=vec3(1.0,.75,.38)*glint*.38+vec3(.34,.66,.8)*fres*.25;',
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
        'float boundary=mix(normalD,elninoD,uWarm); float edge=1.0-smoothstep(boundary-.14,boundary+.14,depth);',
        'float shallow=1.0-clamp(depth/8.0,0.0,1.0);',
        'vec3 deep=mix(vec3(.025,.20,.34),vec3(.04,.46,.62),shallow);',
        'float eastGain=smoothstep(.48,.75,across)*uWarm;',
        'vec3 hot=mix(vec3(.88,.40,.20),vec3(1.0,.50,.23),eastGain);',
        'float ray=pow(max(0.0,sin(across*42.0+sin(depth*4.0+uTime*.7))),12.0)*(1.0-smoothstep(.25,2.2,depth));',
        'float thermo=exp(-abs(depth-boundary)*4.0);',
        'vec3 col=mix(deep,hot,edge*.82); col+=vec3(.18,.52,1.0)*ray*.16+vec3(.16,.62,.74)*thermo*.16;',
        'col*=.72+.34*shallow;',
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
    this.dpr = Math.min(2, Math.max(0.5, num(opt.dpr, global.devicePixelRatio || 1)));
    this.w = 300;
    this.h = 150;
    this.t = 0;
    this.lastMs = 0;
    this.startMs = 0;
    this.boatPoints = {};
    this.boatBounds = {};
    this.phoneFire = 0;
    this.tmpM = new THREE.Matrix4();
    this.tmpP = new THREE.Vector3();
    this.tmpS = new THREE.Vector3();
    this.tmpQ = new THREE.Quaternion();
    this.tmpC = new THREE.Color();
    this.outHull = new THREE.Color(0x24658e);
    this.outCabin = new THREE.Color(0x5565a9);
    this.outSail = new THREE.Color(0x505462);
    this.outMast = new THREE.Color(0x526d89);
    if (!TOON_RAMP) {
      TOON_RAMP = makeRampTexture();
    }
    glopt = {canvas: canvas, antialias: this.quality === 'high', alpha: false, preserveDrawingBuffer: true, powerPreference: 'high-performance'};
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
    if (this.quality === 'high') {
      this.buildPost();
    }
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
        'vec3 b=(texture2D(tScene,vUv+vec2(px.x,0.0)).rgb+texture2D(tScene,vUv-vec2(px.x,0.0)).rgb+',
        'texture2D(tScene,vUv+vec2(0.0,px.y)).rgb+texture2D(tScene,vUv-vec2(0.0,px.y)).rgb)*.25;',
        'float hi=max(max(b.r,b.g),b.b); c+=b*max(0.0,hi-.72)*.24;',
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

    this.hills = makeInstance(s, cone, mat(0x51794b), 12);
    for (i = 0; i < 12; i += 1) {
      this.tmpP.set(i < 6 ? -11.7 + i * 0.42 : 9.8 + (i - 6) * 0.48, 1.15 + hash(i) * 0.75, -1.8 - hash(i + 8) * 0.8);
      this.tmpS.set(0.85 + hash(i + 4) * 0.55, 2.4 + hash(i + 2), 0.9);
      this.tmpM.compose(this.tmpP, this.tmpQ.set(0, 0, 0, 1), this.tmpS);
      this.hills.setMatrixAt(i, this.tmpM);
      this.hills.setColorAt(i, new THREE.Color(i < 6 ? 0x417a46 : (i % 2 ? 0x8b775e : 0xa39078)));
    }
    this.farHills = makeInstance(s, cone, mat(0x688998), 18);
    for (i = 0; i < 18; i += 1) {
      this.tmpP.set(i < 9 ? -19.5 + i * 1.15 : 9.2 + (i - 9) * 1.18, 1.65 + hash(i + 130) * 1.15, -13.5 - hash(i + 170) * 5.5);
      this.tmpS.set(1.8 + hash(i + 150), 3.6 + hash(i + 160) * 2.4, 1.4);
      this.tmpM.compose(this.tmpP, this.tmpQ.set(0, 0, 0, 1), this.tmpS);
      this.farHills.setMatrixAt(i, this.tmpM);
      this.farHills.setColorAt(i, new THREE.Color(i < 9 ? 0x4e806d : 0x74838b));
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

    this.cloudW = makeInstance(s, sphere, fadeMat(0xffffff, 0.9), 10);
    this.cloudE = makeInstance(s, sphere, fadeMat(0xf5f7fa, 0.9), 10);
    if (this.quality === 'low') {
      this.cloudW.count = 6;
      this.cloudE.count = 6;
    }
    for (i = 0; i < 10; i += 1) {
      this.tmpP.set(-8.8 + (i % 5) * 0.75, 3.75 + Math.floor(i / 5) * 0.35, -0.5 + (i % 3) * 0.22);
      this.tmpS.set(0.7 + hash(i) * 0.35, 0.38 + hash(i + 1) * 0.18, 0.5);
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
    this.fishW = makeInstance(s, this.fishGeo, fishMaterial(0xffd438), 42);
    this.fishE = makeInstance(s, this.fishGeo, fishMaterial(0x24ee9d), 42);
    this.fishW.renderOrder = 20;
    this.fishE.material.transparent = true;
    this.fishE.material.depthTest = false;
    this.fishE.material.depthWrite = false;
    this.fishE.material.toneMapped = false;
    this.fishE.renderOrder = 20;

    this.upBars = makeInstance(s, cyl, basic(0x59d7ff, 0.78), 3);
    this.upHeads = makeInstance(s, cone, basic(0x8cecff, 0.9), 3);

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
      this.zoneRope.visible = false;
      this.zoneBuoys.visible = false;
      this.phoneNearBand = new THREE.Mesh(new THREE.PlaneGeometry(3.0, 3.68), fadeMat(0x5bd0d2, 0.52));
      this.phoneNearBand.rotation.x = -Math.PI * 0.5;
      this.phoneNearBand.position.set(sign * 7.0, 0.135, 0);
      s.add(this.phoneNearBand);
      this.phoneFarBand = new THREE.Mesh(new THREE.PlaneGeometry(3.0, 3.68), fadeMat(0x087b9e, 0.62));
      this.phoneFarBand.rotation.x = -Math.PI * 0.5;
      this.phoneFarBand.position.set(sign * 4.0, 0.14, 0);
      s.add(this.phoneFarBand);
      this.phoneDivider = addBox(s, box, basic(0xe5f7f4, 0.9), sign * 5.5, 0.185, 0, 0.035, 0.025, 3.4);
      this.phoneBuoys = makeInstance(s, sphere, basic(0xffdc3d, 1), 9);
      for (i = 0; i < 9; i += 1) {
        this.tmpP.set(sign * 5.5, 0.235, -1.55 + i * 0.39);
        this.tmpS.set(0.11, 0.11, 0.11);
        this.tmpM.compose(this.tmpP, this.tmpQ.set(0, 0, 0, 1), this.tmpS);
        this.phoneBuoys.setMatrixAt(i, this.tmpM);
      }
      this.phoneWaves = makeInstance(s, box, basic(0xdff8ff, 0.86), 8);
      for (i = 0; i < 8; i += 1) {
        this.tmpP.set(sign * (2.85 + (i % 4) * 0.72), 0.245 + (i % 2) * 0.025, -1.2 + Math.floor(i / 4) * 1.8);
        this.tmpS.set(0.38 + (i % 3) * 0.1, 0.025, 0.035);
        this.tmpM.compose(this.tmpP, this.tmpQ.set(0, 0, 1, 0), this.tmpS);
        this.phoneWaves.setMatrixAt(i, this.tmpM);
      }
      this.phoneJetty = addBox(s, box, mat(0xb88d4b), sign * 9.35, 0.27, 0.3, 1.35, 0.14, 0.72);
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
    s.add(this.pulse);

    this.boatHull = makeInstance(s, hullGeometry(), mat(0xd54c36), 30);
    this.boatBow = makeInstance(s, cone, mat(0xd54c36), 30);
    this.boatCabin = makeInstance(s, new THREE.CylinderGeometry(0.34, 0.42, 0.34, 6), mat(0xf0c979), 30);
    this.boatSail = makeInstance(s, sailGeometry(), mat(0xfff3d1, false, 4), 30);
    this.boatMast = makeInstance(s, cyl, mat(0x5d4638), 30);
    this.wakes = makeInstance(s, box, basic(0xffffff, 0.64), 30);
    this.boatShadows = makeInstance(s, sphere, basic(0x075b72, 0.22), 30);
    this.halos = makeInstance(s, new THREE.TorusGeometry(0.55, 0.07, 6, 24), basic(0xffdc38, 0.92), 30);
    this.nets = makeInstance(s, new THREE.TorusGeometry(0.42, 0.025, 5, 18), basic(0xd8f0e6, 0.88), 30);
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
    var a = [this.boatHull, this.boatBow, this.boatCabin, this.boatSail, this.boatMast, this.wakes, this.boatShadows, this.halos, this.nets];
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
      this.camera.fov = 36;
      this.camera.position.set(this.side === 'west' ? -7 : 7, 4.1, 14.5);
      this.camera.lookAt(new THREE.Vector3(this.side === 'west' ? -7 : 7, 2.35, 0.5));
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
      if (name === 'port') {
        x = sign * (9.65 + (lane % 3) * 0.18);
        z = -0.72 + Math.floor((lane % 9) / 3) * 0.72;
      } else if (name === 'far') {
        x = sign * (3.75 + (lane % 3) * 0.18);
        z = -0.72 + Math.floor((lane % 9) / 3) * 0.72;
      } else {
        x = sign * (6.75 + (lane % 3) * 0.18);
        z = -0.72 + Math.floor((lane % 9) / 3) * 0.72;
      }
      return {x: x, y: 0.42 + Math.abs(spread) * 0.02, z: z};
    }
    if (name === 'port') {
      x = sign * (8.35 + (lane % 8) * 0.55);
      z = -0.82 + Math.floor(lane / 8) * 1.0 + (lane % 2) * 0.04;
    } else if (name === 'far') {
      x = sign * (4.35 + (lane % 5) * 0.34);
      z = -1.15 + Math.floor(lane / 5) * 0.78;
    } else {
      x = sign * (6.25 + (lane % 5) * 0.28);
      z = -1.2 + Math.floor(lane / 5) * 0.76;
    }
    return {x: x, y: 0.38 + Math.abs(spread) * 0.02, z: z};
  };

  SceneView.prototype.placeRain = function (mesh, west, amount, t) {
    var i;
    var active = Math.floor(clamp(amount) * 56 + 0.001);
    var x0 = west ? -10.3 : 2.1;
    for (i = 0; i < 56; i += 1) {
      if (i < active) {
        this.tmpP.set(x0 + hash(i + (west ? 10 : 80)) * 8.2, 0.55 + ((hash(i + 23) * 3.1 - t * 2.2) % 3.1 + 3.1) % 3.1, 1.7 + hash(i + 45) * 0.22);
        this.tmpS.set(0.025, 0.24, 0.025);
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

  SceneView.prototype.placeFish = function (mesh, west, amount, t) {
    var i;
    var a = clamp(amount);
    var active = Math.floor(42 * a * a * a + 0.001);
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
          this.tmpP.set(sign * ((far ? 4.0 : 7.0) + (hash(i + (west ? 11 : 71)) - 0.5) * 2.1), 0.31 + (i % 3) * 0.035, -0.85 + hash(i + 19) * 1.9);
          this.tmpP.x += Math.sin(t * 1.4 + i * 2.1) * (0.08 + (this.fishScatter || 0) * 0.2);
          this.tmpP.z += Math.sin(t * 2.2 + i) * (this.fishScatter || 0) * 0.28;
          this.tmpS.set(sign * (0.5 + hash(i + 90) * 0.18), 0.5 + hash(i + 70) * 0.18, 0.58);
          this.tmpM.compose(this.tmpP, this.tmpQ.set(0, 0, 0, 1), this.tmpS);
          mesh.setMatrixAt(i, this.tmpM);
        } else {
          this.hideMatrix(mesh, i);
        }
      }
      mesh.instanceMatrix.needsUpdate = true;
      return;
    }
    for (i = 0; i < 42; i += 1) {
      if (i < active) {
        this.tmpP.set(sign * (west ? (4.3 + hash(i + 1) * 4.1) : (6.1 + hash(i + 33) * 3.1)), -0.55 - hash(i + 7) * 1.2, 3.03 + (i % 3) * 0.035);
        this.tmpP.x += Math.sin(t * 1.4 + i * 2.1) * (0.12 + (this.fishScatter || 0) * 0.24);
        this.tmpS.set(sign * (1.2 + a * a * 1.65 + hash(i + 90) * 0.34), 1.2 + a * a * 1.65 + hash(i + 70) * 0.34, 1.45 + a * a * 0.45);
        this.tmpM.compose(this.tmpP, this.tmpQ.set(0, 0, 0, 1), this.tmpS);
        mesh.setMatrixAt(i, this.tmpM);
      } else {
        this.hideMatrix(mesh, i);
      }
    }
    mesh.instanceMatrix.needsUpdate = true;
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
    var a = clamp(amount);
    var i;
    for (i = 0; i < 3; i += 1) {
      if (a > 0.04) {
        this.tmpP.set(8.0 + i * 0.62, -1.42 + Math.sin(t * 1.4 + i) * 0.08, 2.35);
        this.tmpS.set(0.045 + a * 0.055, 0.65 + a * 0.48, 0.045);
        this.tmpM.compose(this.tmpP, this.tmpQ.set(0, 0, 0, 1), this.tmpS);
        this.upBars.setMatrixAt(i, this.tmpM);
        this.tmpP.y = -0.32;
        this.tmpS.set(0.17 + a * 0.16, 0.27 + a * 0.22, 0.17);
        this.tmpM.compose(this.tmpP, this.tmpQ.set(0, 0, 0, 1), this.tmpS);
        this.upHeads.setMatrixAt(i, this.tmpM);
      } else {
        this.hideMatrix(this.upBars, i);
        this.hideMatrix(this.upHeads, i);
      }
    }
    this.upBars.material.opacity = 0.2 + a * 0.75;
    this.upHeads.material.opacity = 0.2 + a * 0.75;
    this.upBars.instanceMatrix.needsUpdate = true;
    this.upHeads.instanceMatrix.needsUpdate = true;
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
    var palette = [0xe84a3b, 0x2979d8, 0xf2a51a, 0x22a46b, 0x9a57c7, 0x1f9fb5, 0xd9508b, 0x6e8f35, 0xe06b22, 0x455ec7, 0xc93c58, 0x2b887f, 0xad7134, 0x6d67b3, 0xd68c2c];
    this.boatPoints = {};
    this.boatBounds = {};
    this.fishScatter = 0;
    if (this.view === 'phone') {
      this.phoneTarget.visible = false;
    }
    for (i = 0; i < 30; i += 1) {
      b = i < boats.length ? (boats[i] || {}) : null;
      show = !!b && (this.view !== 'phone' || b.village === this.side);
      if (show) {
        rawP = clamp(num(b.p, 0));
        p = rawP * rawP * (3 - 2 * rawP);
        from = this.slot(b.village, b.from || 'port', num(b.id, i));
        to = this.slot(b.village, b.to || 'near', num(b.id, i));
        x = from.x + (to.x - from.x) * p;
        z = from.z + (to.z - from.z) * p;
        moving = Math.abs(to.x - from.x) > 0.1 && p > 0.01 && p < 0.99;
        y = from.y + (to.y - from.y) * p + (moving ? Math.sin(Math.PI * p) * 0.22 : 0) + Math.sin(t * 2.2 + num(b.id, i)) * 0.035;
        out = clamp(num(b.out, 0));
        y -= out * 0.24;
        haul = clamp(num(b.haul, 0));
        if (haul > this.fishScatter) {
          this.fishScatter = haul;
        }
        boatScale = this.view === 'phone' ? (b.me ? 1.45 : 0.98) : 1;
        dir = to.x >= from.x ? 1 : -1;
        roll = moving ? Math.sin(rawP * Math.PI * 2) * 0.11 : 0;
        q = this.tmpQ.setFromAxisAngle(ZUP, (to.x >= from.x ? 0 : Math.PI) + roll);
        color = new THREE.Color(palette[Math.abs(Math.floor(num(b.k, i))) % 15]);
        if (out > 0) {
          color.lerp(this.outHull, out);
        }
        this.boatHull.setColorAt(i, color);
        this.boatBow.setColorAt(i, color);
        this.tmpC.set(0xffffff).lerp(this.outCabin, out);
        this.boatCabin.setColorAt(i, this.tmpC);
        this.tmpC.set(0xffffff).lerp(this.outSail, out);
        this.boatSail.setColorAt(i, this.tmpC);
        this.tmpC.set(0x8a6a53).lerp(this.outMast, out);
        this.boatMast.setColorAt(i, this.tmpC);
        this.placeBoatPart(this.boatHull, i, x, y + 0.08 * boatScale, z, 0.45 * boatScale, (0.14 - out * 0.04) * boatScale, 0.25 * boatScale, q);
        this.placeBoatPart(this.boatBow, i, x + dir * 0.48 * boatScale, y + 0.12 * boatScale, z, 0.2 * boatScale, 0.36 * boatScale, 0.2 * boatScale, this.tmpQ.setFromAxisAngle(new THREE.Vector3(0, 0, 1), dir > 0 ? -Math.PI * 0.5 : Math.PI * 0.5));
        this.placeBoatPart(this.boatCabin, i, x - dir * 0.12 * boatScale, y + 0.27 * boatScale, z, 0.2 * boatScale, 0.21 * boatScale, 0.23 * boatScale, this.tmpQ.set(0, 0, 0, 1));
        this.placeBoatPart(this.boatMast, i, x, y + (0.5 - out * 0.23) * boatScale, z + 0.01, 0.035 * boatScale, (0.46 - out * 0.25) * boatScale, 0.035 * boatScale, this.tmpQ.set(0, 0, 0, 1));
        this.placeBoatPart(this.boatSail, i, x + dir * 0.16 * boatScale, y + (0.55 - out * 0.32) * boatScale, z + 0.03, dir > 0 ? 0.82 * boatScale : -0.82 * boatScale, (0.82 - out * 0.35) * boatScale, 0.82 * boatScale, this.tmpQ.set(0, 0, 0, 1));
        this.placeBoatPart(this.boatShadows, i, x, 0.13, z, 0.62 * boatScale, 0.025, 0.3 * boatScale, this.tmpQ.set(0, 0, 0, 1));
        if (moving) {
          this.placeBoatPart(this.wakes, i, x - dir * 0.58 * boatScale, y - 0.06, z, (0.24 + Math.sin(rawP * Math.PI) * 0.42 + Math.sin(t * 5 + i) * 0.06) * boatScale, 0.025, 0.2 * boatScale, this.tmpQ.set(0, 0, 0, 1));
        } else {
          this.hideMatrix(this.wakes, i);
        }
        if (b.me && out < 0.5) {
          this.placeBoatPart(this.halos, i, x, y + 0.05, z + 0.02, (0.8 + Math.sin(t * 3) * 0.08) * boatScale, (0.8 + Math.sin(t * 3) * 0.08) * boatScale, 0.8 * boatScale, this.tmpQ.set(0, 0, 0, 1));
        } else {
          this.hideMatrix(this.halos, i);
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
        if (this.view === 'phone' && b.me && (b.to === 'near' || b.to === 'far')) {
          target = this.slot(b.village, b.to, num(b.id, i));
          this.phoneTarget.position.set(target.x, 0.9, target.z + 0.45);
          this.phoneTarget.scale.set(1 + Math.sin(t * 3) * 0.06, 1 + Math.sin(t * 3) * 0.06, 1);
          this.phoneTarget.visible = true;
        }
      } else {
        this.hideMatrix(this.boatHull, i);
        this.hideMatrix(this.boatBow, i);
        this.hideMatrix(this.boatCabin, i);
        this.hideMatrix(this.boatSail, i);
        this.hideMatrix(this.boatMast, i);
        this.hideMatrix(this.wakes, i);
        this.hideMatrix(this.boatShadows, i);
        this.hideMatrix(this.halos, i);
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
    this.boatHull.instanceMatrix.needsUpdate = true;
    this.boatBow.instanceMatrix.needsUpdate = true;
    this.boatCabin.instanceMatrix.needsUpdate = true;
    this.boatSail.instanceMatrix.needsUpdate = true;
    this.boatMast.instanceMatrix.needsUpdate = true;
    this.wakes.instanceMatrix.needsUpdate = true;
    this.boatShadows.instanceMatrix.needsUpdate = true;
    this.halos.instanceMatrix.needsUpdate = true;
    this.nets.instanceMatrix.needsUpdate = true;
    this.catchFish.instanceMatrix.needsUpdate = true;
    this.splashes.instanceMatrix.needsUpdate = true;
    if (this.boatHull.instanceColor) {
      this.boatHull.instanceColor.needsUpdate = true;
      this.boatBow.instanceColor.needsUpdate = true;
      if (this.boatCabin.instanceColor) {
        this.boatCabin.instanceColor.needsUpdate = true;
      }
      this.boatSail.instanceColor.needsUpdate = true;
      this.boatMast.instanceColor.needsUpdate = true;
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
    this.underwater.material.uniforms.uTime.value = this.t;
    this.underwater.material.uniforms.uWarm.value = warm;
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
    this.placeBoats(state.boats || [], this.t);
    this.placeFish(this.fishW, true, num(e.fishW, 0.7), this.t);
    this.placeFish(this.fishE, false, num(e.fishE, 1), this.t);
    this.placeUpwell(num(e.upwell, 1), this.t);
    a = clamp(num(state.pulse, 0));
    this.pulse.visible = a > 0.001;
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
    if (this.quality === 'high') {
      this.renderer.setRenderTarget(this.postTarget);
      this.renderer.render(this.scene, this.camera);
      this.renderer.setRenderTarget(null);
      this.renderer.render(this.postScene, this.postCamera);
    } else {
      this.renderer.setRenderTarget(null);
      this.renderer.render(this.scene, this.camera);
    }
    end = global.performance && global.performance.now ? global.performance.now() : this.startMs;
    this.lastMs = Math.max(0, end - this.startMs);
  };

  SceneView.prototype.anchor = function (name, i) {
    var p;
    var slot;
    if (name === 'boat') {
      p = this.boatPoints[String(i)];
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
    version: '2.1.0',
    supported: supported,
    create: function (canvas, opt) {
      if (!global.THREE) {
        throw new Error('3D engine unavailable');
      }
      return new SceneView(canvas, opt);
    }
  };
}(window));
