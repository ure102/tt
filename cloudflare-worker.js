// Cloudflare Worker: authenticated proxy de ImgBB.
// Secrets/vars: IMGBB_API_KEY (Secret), FIREBASE_PROJECT_ID (Variable),
// ALLOWED_ORIGIN (Variable). CORS is not authentication: se verifica Firebase ID token.
const jwksUrl = "https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com";
async function verifyFirebaseToken(token, projectId) {
  const parts = token.split(".");
  if (parts.length !== 3) throw new Error("Invalid token");
  const decode = s => JSON.parse(atob(s.replace(/-/g, "+").replace(/_/g, "/")));
  const header = decode(parts[0]), claims = decode(parts[1]);
  if (header.alg !== "RS256" || !header.kid) throw new Error("Invalid token header");
  const now = Math.floor(Date.now() / 1000);
  if (claims.aud !== projectId || claims.iss !== `https://securetoken.google.com/${projectId}` ||
      !claims.sub || claims.exp <= now || claims.iat > now || claims.auth_time > now) throw new Error("Invalid token claims");
  const jwks = await fetch(jwksUrl, { cf: { cacheTtl: 3600 } }).then(r => r.json());
  const jwk = jwks.keys.find(k => k.kid === header.kid);
  if (!jwk) throw new Error("Unknown signing key");
  const key = await crypto.subtle.importKey("jwk", jwk, { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" }, false, ["verify"]);
  const data = new TextEncoder().encode(`${parts[0]}.${parts[1]}`);
  const signature = Uint8Array.from(atob(parts[2].replace(/-/g, "+").replace(/_/g, "/")), c => c.charCodeAt(0));
  if (!await crypto.subtle.verify("RSASSA-PKCS1-v1_5", key, signature, data)) throw new Error("Bad token signature");
  return claims;
}
export default {
  async fetch(request, env) {
    const origin = request.headers.get("Origin") || "";
    const list = (env.ALLOWED_ORIGIN || "").split(",").map(x => x.trim().replace(/\/+$/, "")).filter(Boolean);
    const allowed = list.includes(origin) ? origin : "";
    const headers = { "Access-Control-Allow-Origin": allowed || list[0] || "", "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Access-Control-Allow-Headers": "Authorization, Content-Type", "Vary": "Origin" };
    if (!allowed) return Response.json({ error: "Origin not allowed: " + origin }, { status: 403, headers });
    if (request.method === "OPTIONS") return new Response(null, { headers });
    if (request.method !== "POST") return Response.json({ error: "Method not allowed" }, { status: 405, headers });
    if (!env.IMGBB_API_KEY || !env.FIREBASE_PROJECT_ID) return Response.json({ error: "Upload service not configured" }, { status: 500, headers });
    try {
      const authHeader = request.headers.get("Authorization") || "";
      if (!authHeader.startsWith("Bearer ")) throw new Error("Missing auth");
      const claims = await verifyFirebaseToken(authHeader.slice(7), env.FIREBASE_PROJECT_ID);
      // Confirmar perfil activo y rol desde Firestore, no alcanza con tener un token válido.
      const profileUrl = `https://firestore.googleapis.com/v1/projects/${env.FIREBASE_PROJECT_ID}/databases/(default)/documents/users/${encodeURIComponent(claims.sub)}`;
      const profileResponse = await fetch(profileUrl, { headers: { Authorization: `Bearer ${authHeader.slice(7)}` } });
      if (!profileResponse.ok) throw new Error("Profile unavailable");
      const profile = await profileResponse.json();
      const fields = profile.fields || {};
      const active = fields.active?.booleanValue === true;
      const role = fields.role?.stringValue || "";
      if (!active || !["super_admin", "recruiter", "reseller"].includes(role)) throw new Error("Inactive profile");
      const incoming = await request.formData(), image = incoming.get("image");
      if (!(image instanceof File)) return Response.json({ error: "Missing image" }, { status: 400, headers });
      if (!image.type.startsWith("image/")) return Response.json({ error: "Only images are allowed" }, { status: 415, headers });
      if (image.size > 8 * 1024 * 1024) return Response.json({ error: "Image exceeds 8 MB" }, { status: 413, headers });
      const body = new FormData(); body.append("image", image, image.name || "receipt.jpg");
      const upstream = await fetch(`https://api.imgbb.com/1/upload?key=${encodeURIComponent(env.IMGBB_API_KEY)}`, { method: "POST", body });
      const data = await upstream.json();
      if (!upstream.ok || !data.success || !data.data?.url) return Response.json({ error: data.error?.message || "ImgBB upload failed" }, { status: 502, headers });
      return Response.json({ url: data.data.url }, { headers });
    } catch (error) {
      return Response.json({ error: "Authentication or upload failed" }, { status: 401, headers });
    }
  }
};
