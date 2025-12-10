const canvas = document.getElementById("webglCanvas");
const gl = canvas.getContext("webgl2");
canvas.width = window.innerWidth;
canvas.height = window.innerHeight;
gl.viewport(0, 0, canvas.width, canvas.height);

// --- Vertex shader (fullscreen quad) ---
const vertexShaderSource = `#version 300 es
in vec4 position;
void main() { gl_Position = position; }
`;

// --- Fragment shader ---
const fragmentShaderSource = `#version 300 es
precision highp float;

uniform float iTime;
uniform vec2 iResolution;
uniform float iRainActive;
out vec4 fragColor;

// --- 3D Simplex noise ---
vec4 permute(vec4 x){return mod(((x*34.0)+1.0)*x,289.0);}
float snoise3(vec3 v){
  const vec2 C = vec2(1.0/6.0, 1.0/3.0);
  const vec4 D = vec4(0.0, 0.5, 1.0, 2.0);

  vec3 i = floor(v + dot(v,C.yyy));
  vec3 x0 = v - i + dot(i,C.xxx);

  vec3 g = step(x0.yzx,x0.xyz);
  vec3 l = 1.0 - g;
  vec3 i1 = min(g.xyz, l.zxy);
  vec3 i2 = max(g.xyz, l.zxy);

  vec3 x1 = x0 - i1 + C.xxx;
  vec3 x2 = x0 - i2 + C.yyy;
  vec3 x3 = x0 - D.yyy;

  i = mod(i,289.0);
  vec4 p = permute( permute( permute(
             i.z + vec4(0.0,i1.z,i2.z,1.0))
           + i.y + vec4(0.0,i1.y,i2.y,1.0))
           + i.x + vec4(0.0,i1.x,i2.x,1.0));

  float n_ = 1.0/7.0;
  vec3 ns = n_ * D.wyz - D.xzx;

  vec4 j = p - 49.0 * floor(p*ns.z*ns.z);
  vec4 x_ = floor(j*ns.z);
  vec4 y_ = floor(j - 7.0*x_);

  vec4 x = x_*ns.x + ns.yyyy;
  vec4 y = y_*ns.x + ns.yyyy;
  vec4 h = 1.0 - abs(x) - abs(y);

  vec4 b0 = vec4(x.xy,y.xy);
  vec4 b1 = vec4(x.zw,y.zw);
  vec4 s0 = floor(b0)*2.0 + 1.0;
  vec4 s1 = floor(b1)*2.0 + 1.0;
  vec4 sh = -step(h,vec4(0.0));

  vec4 a0 = b0.xzyw + s0.xzyw*sh.xxyy;
  vec4 a1 = b1.xzyw + s1.xzyw*sh.zzww;

  vec3 p0 = vec3(a0.xy,h.x);
  vec3 p1 = vec3(a0.zw,h.y);
  vec3 p2 = vec3(a1.xy,h.z);
  vec3 p3 = vec3(a1.zw,h.w);

  vec4 norm = inversesqrt(vec4(dot(p0,p0), dot(p1,p1), dot(p2,p2), dot(p3,p3)));
  p0 *= norm.x; p1 *= norm.y; p2 *= norm.z; p3 *= norm.w;

  vec4 m = max(0.6 - vec4(dot(x0,x0),dot(x1,x1),dot(x2,x2),dot(x3,x3)),0.0);
  m = m*m;
  return 42.0 * dot(m*m, vec4(dot(p0,x0), dot(p1,x1), dot(p2,x2), dot(p3,x3)));
}

// --- FBM ---
float fbm3(vec2 uv, float t){
  float total = 0.0;
  float amplitude = 0.5;
  float frequency = 1.0;
  for(int i=0;i<6;i++){
    vec3 p = vec3(uv*frequency, t*0.1);
    total += snoise3(p) * amplitude;
    frequency *= 2.0;
    amplitude *= 0.5;
  }
  return total*0.5 + 0.5;
}

void main() {
  vec2 fragCoord = gl_FragCoord.xy;
  vec2 uv = fragCoord / iResolution.xy;
  uv = uv*2.0 - 1.0;
  uv.x *= iResolution.x / iResolution.y;

  uv += vec2(iTime*0.01, iTime*0.03);
  float n = fbm3(uv*1.5, iTime);
  float cloud = smoothstep(0.4,0.75,n);

  vec3 skyBlue = vec3(0.5608,0.7098,0.8627);
  vec3 skyGrey = vec3(0.4, 0.45, 0.5);
  vec3 skyColor = mix(skyBlue, skyGrey, smoothstep(0.0, 1.0, iRainActive));
  vec3 cloudWhite = vec3(1.0);
  vec3 cloudGrey = vec3(0.65, 0.67, 0.7);
  vec3 cloudColor = mix(cloudWhite, cloudGrey, smoothstep(0.0, 1.0, iRainActive));
  vec3 col = mix(skyColor, cloudColor, cloud);

  fragColor = vec4(col,1.0);
}
`;

// --- Compile Shader Helper ---
function compileShader(gl, type, source){
  const shader = gl.createShader(type);
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  if(!gl.getShaderParameter(shader, gl.COMPILE_STATUS)){
    console.error(gl.getShaderInfoLog(shader));
  }
  return shader;
}

// --- Create Program ---
const vertexShader = compileShader(gl, gl.VERTEX_SHADER, vertexShaderSource);
const fragmentShader = compileShader(gl, gl.FRAGMENT_SHADER, fragmentShaderSource);
const program = gl.createProgram();
gl.attachShader(program, vertexShader);
gl.attachShader(program, fragmentShader);
gl.linkProgram(program);
gl.useProgram(program);

// --- Fullscreen Quad ---
const vertices = new Float32Array([
  -1,-1,  1,-1,  -1,1,
  -1,1,   1,-1,   1,1
]);
const buffer = gl.createBuffer();
gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
gl.bufferData(gl.ARRAY_BUFFER, vertices, gl.STATIC_DRAW);

const positionLoc = gl.getAttribLocation(program,"position");
gl.enableVertexAttribArray(positionLoc);
gl.vertexAttribPointer(positionLoc,2,gl.FLOAT,false,0,0);

// --- Uniform Locations ---
const iTimeLoc = gl.getUniformLocation(program,"iTime");
const iResLoc = gl.getUniformLocation(program,"iResolution");
const iRainLoc = gl.getUniformLocation(program,"iRainActive");

// --- Render Loop ---
function render(t){
  t *= 0.001; // seconds
  gl.uniform1f(iTimeLoc, t);
  gl.uniform2f(iResLoc, canvas.width, canvas.height);

  // Smooth transition over time
  const targetRain = document.body.classList.contains('rain-active') ? 1.0 : 0.0;
  if (!window.currentRainValue) window.currentRainValue = 0.0;
  window.currentRainValue += (targetRain - window.currentRainValue) * 0.05; // 0.05 = transition speed
  gl.uniform1f(iRainLoc, window.currentRainValue);

  gl.drawArrays(gl.TRIANGLES,0,6);
  requestAnimationFrame(render);
}
requestAnimationFrame(render);

// --- Resize Handling ---
window.addEventListener('resize',()=>{
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
  gl.viewport(0,0,canvas.width,canvas.height);
});
