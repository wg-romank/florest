precision highp float;

varying vec3 v_pos_orig;
varying vec3 v_pos;
varying vec3 v_norm;
varying vec4 v_frag_pos_light_space;
varying float v_elev;
varying vec2 v_uv;

uniform vec3 blend;
uniform mat4 normalMatrix;
uniform vec3 lightPosition;
uniform sampler2D shadow_map;
uniform vec2 height_map_size;
uniform sampler2D height_map;
uniform mat4 model;
uniform float mode;
uniform float sharpness;
uniform float scale;
uniform sampler2D waves_1;
uniform sampler2D waves_2;

uniform float diffuse_intensity;
uniform float ambient;

vec3 triplanar(sampler2D t, vec3 norm, vec3 pos) {
  vec3 normalX = texture2D(t, scale * pos.zy).xyz;
  vec3 normalY = texture2D(t, scale * pos.xz).xyz;
  vec3 normalZ = texture2D(t, scale * pos.xy).xyz;

  // vec3 normalSign = sign(norm);

  vec3 blend = pow(abs(norm), vec3(sharpness));
  blend /= dot(blend, vec3(1.));

  // return normalize(
  //   normalX * blendWeight.x + normalY * blendWeight.y + normalZ * blendWeight.z
  // );

  normalX = vec3(normalX.xy + norm.zy, abs(normalX.z) * norm.x);
  normalY = vec3(normalY.xy + norm.xz, abs(normalY.z) * norm.y);
  normalZ = vec3(normalZ.xy + norm.xy, abs(normalZ.z) * norm.z);

  return normalize(
    normalX.zyx * blend.x +
    normalY.xzy * blend.y +
    normalZ.xyz * blend.z
  );
}

float shadow_calc(float dot_ligth_normal) {
  // [-1, 1] => [0, 1]
  vec3 pos = clamp((v_frag_pos_light_space.xyz + 1.) / 2., 0.0, 1.0);

  float bias = max(0.05 * (1.0 - dot_ligth_normal), 0.005);

  // PCF
  float shadow = 0.0;
  // todo: pass texture size
  vec2 texel_size = vec2(1.0, 1.0) / vec2(800, 800);
  for (int x = -1; x <= 1; ++x) {
    for (int y = -1; y <= 1; ++y) {
      float depth = texture2D(shadow_map, pos.xy + vec2(x, y) * texel_size).r;
      shadow += (depth + bias) < pos.z ? 0.0 : 1.0;
    }
  }

  // float depth = texture(shadow_map, pos.xy).r;
  // float shadow = (depth + bias) < pos.z ? 0.0 : 1.0;

  return shadow / 9.0;
}

vec4 color_calc() {
  // vec4 color = texture2D(height_map, v_uv);
  vec4 color = vec4(0.6, 0.5, 0.8, 1.0);
  return color;
}

// vec3 normal_calc(vec2 uv) {
//   // vec2 d = 1. / height_map_size;
//   // vec2 uvNorth = uv + vec2(d.x, 0);
//   // vec2 uvSouth = uv - vec2(d.x, 0);
//   // float x = texture2D(height_map, uv + vec2(d.x, 0)).r - texture2D(height_map, uv - vec2(d.x, 0)).r;
//   // float y = length(texture2D(height_map, uv + vec2(0, d.y)) - texture2D(height_map, uv - vec2(0, d.y)));
//   // // float z = -1.;
//   // // return normalize(vec3(x, y, z));

//   float r = texture2D(normal_r, uv).r;
//   float g = texture2D(normal_g, uv).r;
//   float b = sqrt(1. - pow(r, 2.) - pow(g, 2.));

//   return vec3(r, g, b);
// }


vec3 coordinate_to_point(vec2 lonlat) {
  float y = sin(lonlat.y);
  float r = cos(lonlat.y);
  float x = sin(lonlat.x) * r;
  float z = -cos(lonlat.x) * r;

  return vec3(x, y, z);
}

const float PI = 3.14159;

vec3 world_point(vec2 uv) {
  vec2 lonlat = (uv - 0.5) * PI * vec2(2, 1);
  vec3 spherePoint = coordinate_to_point(lonlat);
  return spherePoint + mix(0., 0.1, texture2D(height_map, uv).r);
}

vec3 normal_calc(vec2 uv) {
  vec2 d = 1. / height_map_size;

  vec3 north = world_point(uv + vec2(0., d.y));
  vec3 south = world_point(uv - vec2(0., d.y));
  vec3 east = world_point(uv + vec2(d.x, 0.));
  vec3 west = world_point(uv - vec2(d.x, 0.));

  vec3 ns = normalize(north - south);
  vec3 ew = normalize(east - west);

  vec3 normal = normalize(cross(ns, ew));

  return normal;
}

void main() {
  vec4 color = color_calc();
  // vec3 trip_normal = triplanar(waves_1, v_norm, v_pos_orig);
  // vec3 trip_normal = v_norm;
  // vec3 norm_transformed = (normalMatrix * vec4(trip_normal, 0.)).xyz;
  vec3 norm_transformed = normal_calc(v_uv).xyz;

  //ambient
  vec3 ambient = ambient * color.xyz;

  // diffuse
  vec3 light_dir = normalize(lightPosition - v_pos);
  float dot_light_normal = dot(light_dir, norm_transformed);
  float diff = max(dot_light_normal, 0.0);
  vec3 diffuse = diffuse_intensity * diff * color.xyz;

  // vec3 norm_transformed = (normalMatrix * vec4(v_norm, 0.)).xyz;
  // float kd = dot(norm_transformed, -normalize(lightPosition));
  // vec3 diffuse = kd * color.xyz;
  
  // float shadow = shadow_calc(dot_light_normal);
  float shadow = 1.0;

  vec3 lighting = ((diffuse * shadow) + ambient) * color.xyz;

  if (mode == 0.) {
    gl_FragColor = vec4(norm_transformed, 1.);
  }

  if (mode == 1.) {
    gl_FragColor = vec4(v_uv, 0., 1.);
  }

  if (mode == 2.) {
    gl_FragColor = vec4(lighting, 1.);
  }
}