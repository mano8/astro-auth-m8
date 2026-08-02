export const FA_AUTH_M8_CONTRACT_ID = "fa-auth-m8";
export const FA_AUTH_M8_CONTRACT_VERSION = "2.0";
export const FA_AUTH_M8_CONTRACT = `${FA_AUTH_M8_CONTRACT_ID}@${FA_AUTH_M8_CONTRACT_VERSION}` as const;
// 2.0.0 is the supported fa-auth-m8 service baseline for this plugin.
export const FA_AUTH_M8_TESTED_SERVICE_VERSION = "2.0.0";
export const FA_AUTH_M8_MIN_SERVICE_VERSION = "2.0.0";
export const FA_AUTH_M8_MAX_SERVICE_VERSION_EXCLUSIVE = "3.0.0";
export const FA_AUTH_M8_SERVICE_VERSION_RANGE = `>=${FA_AUTH_M8_MIN_SERVICE_VERSION} <${FA_AUTH_M8_MAX_SERVICE_VERSION_EXCLUSIVE}`;

export type FaAuthM8CompatibilityStatus = "compatible" | "incompatible" | "unknown";

export type FaAuthM8VersionMetadata = {
  // ``contract`` accepts a flat string (legacy) or the GET /meta nested object
  // ``{ name, version, range }`` — the shape auth-sdk-m8 ServiceMeta returns.
  contract?: unknown;
  contract_version?: unknown;
  auth_contract?: unknown;
  auth_contract_version?: unknown;
  fa_auth_m8_contract?: unknown;
  version?: unknown;
  service_version?: unknown;
  fa_auth_m8_version?: unknown;
  // Extra GET /meta keys, accepted so the raw payload is assignable as-is.
  service?: unknown;
  api_version?: unknown;
};

export type FaAuthM8Compatibility = {
  status: FaAuthM8CompatibilityStatus;
  expectedContract: typeof FA_AUTH_M8_CONTRACT;
  expectedServiceVersionRange: typeof FA_AUTH_M8_SERVICE_VERSION_RANGE;
  contractVersion?: string;
  serviceVersion?: string;
  reason?: string;
};

function stringValue(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

// Read ``contract.version`` from the GET /meta nested contract object.
function contractObjectVersion(value: unknown): string | undefined {
  if (typeof value === "object" && value !== null) {
    return stringValue((value as { version?: unknown }).version);
  }
  return undefined;
}

// Read ``contract.name`` from the GET /meta nested contract object.
//
// The flat-string contract forms carry the issuer id inline (``fa-auth-m8@2.0``)
// and are checked against it, but the nested object splits id and version apart.
// Without reading ``name`` the version check alone would bless any service whose
// contract happens to sit at the same version - and ``mount_service_meta`` is a
// shared auth-sdk-m8 helper, so every M8 service serves this same payload shape
// at ``{API_PREFIX}/meta``. A host pointed at the wrong sibling is exactly the
// misconfiguration the preflight exists to name.
function contractObjectName(value: unknown): string | undefined {
  if (typeof value === "object" && value !== null) {
    return stringValue((value as { name?: unknown }).name);
  }
  return undefined;
}

function parseSemver(version: string): [number, number, number] | undefined {
  const match = /^(\d+)\.(\d+)\.(\d+)(?:[-+].*)?$/.exec(version);
  if (!match) return undefined;
  return [Number(match[1]), Number(match[2]), Number(match[3])];
}

function compareSemver(left: string, right: string): number | undefined {
  const parsedLeft = parseSemver(left);
  const parsedRight = parseSemver(right);
  if (!parsedLeft || !parsedRight) return undefined;
  for (let index = 0; index < parsedLeft.length; index += 1) {
    if (parsedLeft[index] > parsedRight[index]) return 1;
    if (parsedLeft[index] < parsedRight[index]) return -1;
  }
  return 0;
}

export function isFaAuthM8ServiceVersionCompatible(version: string): boolean {
  const aboveMin = compareSemver(version, FA_AUTH_M8_MIN_SERVICE_VERSION);
  const belowMax = compareSemver(version, FA_AUTH_M8_MAX_SERVICE_VERSION_EXCLUSIVE);
  return aboveMin !== undefined && belowMax !== undefined && aboveMin >= 0 && belowMax < 0;
}

export function getFaAuthM8Compatibility(metadata: FaAuthM8VersionMetadata = {}): FaAuthM8Compatibility {
  const contractVersion = stringValue(metadata.auth_contract_version)
    ?? stringValue(metadata.contract_version)
    ?? stringValue(metadata.fa_auth_m8_contract)
    ?? stringValue(metadata.auth_contract)
    ?? contractObjectVersion(metadata.contract)
    ?? stringValue(metadata.contract);
  const serviceVersion = stringValue(metadata.fa_auth_m8_version)
    ?? stringValue(metadata.service_version)
    ?? stringValue(metadata.version);

  // Checked before the version, so a wrong service is reported as a wrong
  // service rather than as a version mismatch. Only applies when the payload
  // names an id at all - a nested contract without a `name` still falls through
  // to the version comparison below.
  const contractName = contractObjectName(metadata.contract);
  if (contractName && contractName !== FA_AUTH_M8_CONTRACT_ID) {
    return {
      status: "incompatible",
      expectedContract: FA_AUTH_M8_CONTRACT,
      expectedServiceVersionRange: FA_AUTH_M8_SERVICE_VERSION_RANGE,
      contractVersion,
      serviceVersion,
      reason: `Expected ${FA_AUTH_M8_CONTRACT}, received the ${contractName} contract - check the configured auth API base`
    };
  }

  if (contractVersion && contractVersion !== FA_AUTH_M8_CONTRACT_VERSION && contractVersion !== FA_AUTH_M8_CONTRACT) {
    return {
      status: "incompatible",
      expectedContract: FA_AUTH_M8_CONTRACT,
      expectedServiceVersionRange: FA_AUTH_M8_SERVICE_VERSION_RANGE,
      contractVersion,
      serviceVersion,
      reason: `Expected ${FA_AUTH_M8_CONTRACT}, received ${contractVersion}`
    };
  }

  if (serviceVersion && !isFaAuthM8ServiceVersionCompatible(serviceVersion)) {
    return {
      status: "incompatible",
      expectedContract: FA_AUTH_M8_CONTRACT,
      expectedServiceVersionRange: FA_AUTH_M8_SERVICE_VERSION_RANGE,
      contractVersion,
      serviceVersion,
      reason: `Expected fa-auth-m8 service version ${FA_AUTH_M8_SERVICE_VERSION_RANGE}, received ${serviceVersion}`
    };
  }

  if (contractVersion || serviceVersion) {
    return {
      status: "compatible",
      expectedContract: FA_AUTH_M8_CONTRACT,
      expectedServiceVersionRange: FA_AUTH_M8_SERVICE_VERSION_RANGE,
      contractVersion,
      serviceVersion
    };
  }

  return {
    status: "unknown",
    expectedContract: FA_AUTH_M8_CONTRACT,
    expectedServiceVersionRange: FA_AUTH_M8_SERVICE_VERSION_RANGE,
    reason: "No fa-auth-m8 contract or service version metadata was provided"
  };
}

export function assertFaAuthM8Compatibility(metadata: FaAuthM8VersionMetadata, requireKnown = true): FaAuthM8Compatibility {
  const compatibility = getFaAuthM8Compatibility(metadata);
  if (compatibility.status === "incompatible" || (requireKnown && compatibility.status === "unknown")) {
    throw new Error(compatibility.reason);
  }
  return compatibility;
}
