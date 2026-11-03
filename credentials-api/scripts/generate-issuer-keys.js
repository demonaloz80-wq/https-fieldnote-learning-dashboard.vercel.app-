import { randomBytes, generateKeyPairSync } from "node:crypto";
import { existsSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

const envPath = resolve(process.cwd(), ".env");
if (existsSync(envPath)) {
	throw new Error("credentials-api/.env already exists; refusing to overwrite issuer secrets.");
}

const { privateKey, publicKey } = generateKeyPairSync("ed25519");
const privateJwk = privateKey.export({ format: "jwk" });
const publicJwk = publicKey.export({ format: "jwk" });
const privateEncoded = Buffer.from(JSON.stringify(privateJwk)).toString("base64url");
const publicEncoded = Buffer.from(JSON.stringify(publicJwk)).toString("base64url");
const env = [
	"PORT=3000",
	"PUBLIC_BASE_URL=http://localhost:3000",
	"ISSUER_NAME=Fieldnote Learning",
	"ADMIN_API_TOKEN=" + randomBytes(32).toString("base64url"),
	"ISSUER_PRIVATE_JWK_B64=" + privateEncoded,
	"ISSUER_PUBLIC_JWK_B64=" + publicEncoded,
	""
].join("\n");

writeFileSync(envPath, env, { flag: "wx", mode: 0o600 });
console.log("Created credentials-api/.env with a new Ed25519 issuer key pair and admin token.");
console.log("Keep this file private. Set PUBLIC_BASE_URL to the public HTTPS origin before deployment.");