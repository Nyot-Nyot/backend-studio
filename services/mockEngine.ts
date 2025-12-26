
import { EnvironmentVariable, HttpMethod, MockEndpoint } from "../types";
import { dbService } from "./dbService";
import { logger } from "./logger";

// Helper: Match Route Pattern
export const matchRoute = (pattern: string, requestPath: string): { matches: boolean; params: Record<string, string | undefined> } => {
  // Normalize paths (remove trailing slash, ensure leading slash)
  const cleanReqPath = requestPath.split('?')[0].replace(/\/+$/, '');
  const cleanPattern = pattern.replace(/\/+$/, '');

  const patternSegments = cleanPattern.split('/').filter(Boolean);
  const pathSegments = cleanReqPath.split('/').filter(Boolean);
  const params: Record<string, string | undefined> = {};

  // Two-pointer approach to allow optional params (:id?), single '*' wildcard (matches one segment)
  // and trailing '*' wildcard that matches the rest of the path.
  let p = 0; // index in patternSegments
  let i = 0; // index in pathSegments

  while (p < patternSegments.length) {
    const seg = patternSegments[p];

    // Trailing wildcard: match the rest
    if (seg === '*' && p === patternSegments.length - 1) {
      // capture rest as wildcard param if desired; here we just match
      return { matches: true, params };
    }

    const pathSeg = pathSegments[i];

    // If we've run out of path segments
    if (pathSeg === undefined) {
      // Segment can still match if it's an optional param like ':id?'
      if (seg.startsWith(':') && seg.endsWith('?')) {
        const paramName = seg.substring(1, seg.length - 1);
        params[paramName] = undefined;
        p++;
        continue;
      }
      // otherwise no match
      return { matches: false, params: {} };
    }

    if (seg === '*') {
      // single-segment wildcard
      p++;
      i++;
      continue;
    }

    if (seg.startsWith(':')) {
      const isOptional = seg.endsWith('?');
      const paramName = isOptional ? seg.substring(1, seg.length - 1) : seg.substring(1);
      params[paramName] = pathSeg;
      p++;
      i++;
      continue;
    }

    // exact match
    if (seg === pathSeg) {
      p++;
      i++;
      continue;
    }

    // no match
    return { matches: false, params: {} };
  }

  // Only match if all path segments are consumed
  if (i !== pathSegments.length) {
    return { matches: false, params: {} };
  }

  return { matches: true, params };
};
// Check whether two route patterns may conflict (i.e., there exists at least one path
// that would be matched by both patterns). This is a conservative check used by
// the editor to prevent saving overlapping routes.
export const patternsConflict = (a: string, b: string): boolean => {
  const clean = (s: string) => s.replace(/\/+$/g, '').split('/').filter(Boolean);
  const pa = clean(a);
  const pb = clean(b);

  // Quick equality
  if (a.trim().toLowerCase() === b.trim().toLowerCase()) return true;

  const MAX_CHECK = 10; // reasonable cap for path length exploration

  const minLen = (p: string[]) => p.filter(seg => !(seg.startsWith(':') && seg.endsWith('?'))).length;
  const hasTrailingWildcard = (p: string[]) => p.length > 0 && p[p.length - 1] === '*';
  const maxLen = (p: string[]) => hasTrailingWildcard(p) ? MAX_CHECK : p.length;

  const minA = minLen(pa);
  const minB = minLen(pb);
  const maxA = maxLen(pa);
  const maxB = maxLen(pb);

  const start = Math.max(minA, minB);
  const end = Math.min(maxA, maxB);
  const trailingIndexA = hasTrailingWildcard(pa) ? pa.length - 1 : -1;
  const trailingIndexB = hasTrailingWildcard(pb) ? pb.length - 1 : -1;

  for (let n = start; n <= end; n++) {
    let ok = true;
    for (let i = 0; i < n; i++) {
      const segA = pa[i];
      const segB = pb[i];

      const segAIsWildcardRest = segA === '*' && i === pa.length - 1;
      const segBIsWildcardRest = segB === '*' && i === pb.length - 1;

      const segAExists = segA !== undefined && !segAIsWildcardRest;
      const segBExists = segB !== undefined && !segBIsWildcardRest;

      // If segment in A is undefined
      if (!segAExists) {
        // If A has trailing wildcard earlier, it can absorb remaining segments
        if (trailingIndexA >= 0 && trailingIndexA <= i) {
          // ok, wildcard at end of A covers this position
        } else if (segAIsWildcardRest) {
          // wildcard at end of A can match remaining segments
        } else {
          ok = false;
          break;
        }
      }

      if (!segBExists) {
        if (trailingIndexB >= 0 && trailingIndexB <= i) {
          // ok, wildcard at end of B covers this position
        } else if (segBIsWildcardRest) {
          // wildcard at end of B
        } else {
          ok = false;
          break;
        }
      }

      // Treat trailing wildcard earlier as an effective '*' for matching
      const effectiveSegA = (trailingIndexA >= 0 && trailingIndexA <= i) ? '*' : segA;
      const effectiveSegB = (trailingIndexB >= 0 && trailingIndexB <= i) ? '*' : segB;

      // If either is a trailing rest wildcard at this position, this position can be matched
      if (segAIsWildcardRest || segBIsWildcardRest) continue;

      // If either is a single '*' wildcard, it's fine
      if (effectiveSegA === '*' || effectiveSegB === '*') continue;

      // If either is a param (including optional), it's fine
      if ((effectiveSegA && effectiveSegA.startsWith(':')) || (effectiveSegB && effectiveSegB.startsWith(':'))) continue;

      // Both literals must match to be compatible at this position
      if (effectiveSegA !== effectiveSegB) {
        ok = false;
        break;
      }
    }

    if (ok) return true;
  }

  return false;
};
export const processMockResponse = (
  bodyTemplate: string,
  requestPath: string,
  routePattern: string,
  envVars: EnvironmentVariable[] = [],
  requestBody: string | null = null
): string => {
  let processedBody = bodyTemplate;

  // Try to parse request body JSON if present
  let parsedBody: unknown = null;
  if (requestBody) {
    try {
      parsedBody = JSON.parse(requestBody) as unknown;
    } catch (e) {
      parsedBody = null;
    }
  }

  // Debug helper: if parsedBody is null but requestBody exists, log a warning so we can see malformed JSON (dev only)
  if (requestBody && parsedBody === null) {
    if (import.meta.env?.DEV) {
      try {
        logger('mockEngine').warn('mockEngine: failed to parse requestBody as JSON', String(requestBody).slice(0, 200));
      } catch (e) { }
    }
  }

  // 0. Environment Variables Injection (User Defined)
  // Replaces {{key}} with value
  envVars.forEach(variable => {
    // Escape special regex characters in the key if any
    const escapedKey = variable.key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const regex = new RegExp(`{{${escapedKey}}}`, 'g');
    processedBody = processedBody.replace(regex, variable.value);
  });

  // 1. Route Param Injection
  // Example: Pattern /users/:id, Request /users/123 -> Inject {{@param.id}} with 123
  const [cleanPath, queryString] = requestPath.split('?');
  const patternSegments = routePattern.split('/').filter(Boolean);
  const pathSegments = cleanPath.split('/').filter(Boolean);

  patternSegments.forEach((seg, index) => {
    if (seg.startsWith(':') && pathSegments[index]) {
      const paramName = seg.substring(1); // remove :
      const paramValue = pathSegments[index];
      const regex = new RegExp(`{{@param.${paramName}}}`, 'g');
      processedBody = processedBody.replace(regex, paramValue);
    }
  });

  // 2. Query Param Injection
  // Example: Request /users?page=2&sort=asc -> Inject {{@query.page}} with 2
  if (queryString) {
    const params = new URLSearchParams(queryString);
    params.forEach((value, key) => {
      const regex = new RegExp(`{{@query.${key}}}`, 'g');
      processedBody = processedBody.replace(regex, value);
    });
  }

  // 3. Request Body Injection
  // Allows placeholders like {{@body.name}} to be replaced with values from JSON body
  if (parsedBody && typeof parsedBody === 'object') {
    const walk = (obj: Record<string, unknown>, prefix = '') => {
      Object.keys(obj).forEach(k => {
        const val = obj[k];
        const placeholder = `{{@body${prefix}.${k}}}`;
        const regex = new RegExp(placeholder.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g');
        const replacement = (val === undefined || val === null) ? '' : String(val);
        processedBody = processedBody.replace(regex, replacement);

        if (typeof val === 'object' && val !== null) {
          walk(val as Record<string, unknown>, `${prefix}.${k}`);
        }
      });
    };
    walk(parsedBody as Record<string, unknown>, '');
  }

  // 4. Dynamic Variables Replacement (System)
  const replacements: Record<string, () => string | number> = {
    '{{$uuid}}': () => crypto.randomUUID(),
    '{{$randomInt}}': () => Math.floor(Math.random() * 1000),
    '{{$timestamp}}': () => Date.now(),
    '{{$isoDate}}': () => new Date().toISOString(),
    '{{$randomName}}': () => {
      const names = ['Alice', 'Bob', 'Charlie', 'David', 'Eve', 'Frank', 'Grace', 'Heidi', 'Ivan'];
      return names[Math.floor(Math.random() * names.length)];
    },
    '{{$randomCity}}': () => {
      const cities = ['New York', 'London', 'Tokyo', 'Jakarta', 'Berlin', 'Paris', 'Sydney'];
      return cities[Math.floor(Math.random() * cities.length)];
    },
    '{{$randomBool}}': () => Math.random() > 0.5 ? 'true' : 'false',

    // Faker-like aliases (no external dep): map to existing generators
    '{{$fakerName}}': () => replacements['{{$randomName}}'](),
    '{{$fakerCity}}': () => replacements['{{$randomCity}}']()
  };

  Object.entries(replacements).forEach(([key, generator]) => {
    // Regex allows exact match globally
    const regex = new RegExp(key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g');
    processedBody = processedBody.replace(regex, () => String(generator()));
  });

  return processedBody;
};

export const MOCK_VARIABLES_HELP = [
  { label: '{{$uuid}}', desc: 'Random UUID v4' },
  { label: '{{$randomInt}}', desc: 'Random number (0-1000)' },
  { label: '{{$randomName}}', desc: 'Random first name' },
  { label: '{{$randomCity}}', desc: 'Random city' },
  { label: '{{$isoDate}}', desc: 'Current ISO 8601 Date' },
  { label: '{{$fakerName}}', desc: 'Faker-like alias for random name' },
  { label: '{{$fakerCity}}', desc: 'Faker-like alias for random city' },
  { label: '{{@param.id}}', desc: 'Value from URL path /:id' },
  { label: '{{@query.page}}', desc: 'Value from query string e.g. ?page=2' },
  { label: '{{@body.name}}', desc: 'Value from JSON request body' },
  { label: '{{my_var}}', desc: 'User defined Env Variable' },
];

export interface SimulationResult {
  response: {
    status: number;
    body: string;
    headers: { key: string; value: string }[];
    delay: number;
  };
  matchedMockId?: string;
}

// The core logic that acts as the "Server"
export const simulateRequest = async (
  method: string,
  url: string,
  headers: Record<string, string>, // Headers passed from SW
  body: string,
  mocks: MockEndpoint[],
  envVars: EnvironmentVariable[] = [] // NEW: Env Vars
): Promise<SimulationResult> => {
  const urlObj = new URL(url);
  const pathname = urlObj.pathname;

  let matchedMock: MockEndpoint | null = null;
  let urlParams: Record<string, string | undefined> = {};

  // Find matching route
  for (const m of mocks) {
    if (m.isActive && m.method === method) {
      const result = matchRoute(m.path, pathname);
      if (result.matches) {
        matchedMock = m;
        urlParams = result.params;
        break;
      }
    }
  }

  if (!matchedMock) {
    return {
      response: {
        status: 404,
        body: JSON.stringify({ error: "Not Found", message: `No active route found for ${method} ${pathname}` }, null, 2),
        headers: [{ key: 'Content-Type', value: 'application/json' }],
        delay: 50
      }
    };
  }

  // --- SECURITY & AUTHENTICATION CHECK ---
  if (matchedMock.authConfig && matchedMock.authConfig.type !== 'NONE') {
    const auth = matchedMock.authConfig;
    const reqHeadersLower = Object.keys(headers).reduce((acc, key) => {
      acc[key.toLowerCase()] = headers[key];
      return acc;
    }, {} as Record<string, string>);

    let isAuthorized = false;

    if (auth.type === 'BEARER_TOKEN') {
      const authHeader = reqHeadersLower['authorization'] || '';
      if (authHeader.startsWith('Bearer ') && authHeader.substring(7) === auth.token) {
        isAuthorized = true;
      }
    } else if (auth.type === 'API_KEY') {
      const headerKey = (auth.headerKey || 'x-api-key').toLowerCase();
      const apiKey = reqHeadersLower[headerKey];
      if (apiKey === auth.token) {
        isAuthorized = true;
      }
    }

    if (!isAuthorized) {
      return {
        response: {
          status: 401,
          body: JSON.stringify({ error: "Unauthorized", message: "Invalid or missing authentication credentials" }, null, 2),
          headers: [{ key: 'Content-Type', value: 'application/json' }],
          delay: matchedMock.delay
        },
        matchedMockId: matchedMock.id
      };
    }
  }

  // --- PROXY / PASSTHROUGH ---
  if (matchedMock.proxy && matchedMock.proxy.enabled && matchedMock.proxy.target) {
    try {
      const proxyTarget = matchedMock.proxy.target.replace(/\/+$/g, '');

      // Basic validation: only allow http(s) schemes and block known local/private hosts
      try {
        const targetUrl = new URL(proxyTarget);
        const scheme = targetUrl.protocol.replace(':', '').toLowerCase();
        const hostname = targetUrl.hostname;

        // Only allow http or https
        if (scheme !== 'http' && scheme !== 'https') {
          return {
            response: {
              status: 400,
              body: JSON.stringify({ error: 'Invalid Proxy Target', message: 'Only http(s) proxy targets are allowed' }, null, 2),
              headers: [{ key: 'Content-Type', value: 'application/json' }],
              delay: matchedMock.delay,
            },
            matchedMockId: matchedMock.id,
          };
        }

        // Disallow common local hostnames and IP ranges (basic IP pattern checks)
        const lowerHost = hostname.toLowerCase();
        const isIp = /^\d+\.\d+\.\d+\.\d+$/.test(lowerHost);
        if (
          lowerHost === 'localhost' ||
          lowerHost === '::1' ||
          lowerHost === '127.0.0.1' ||
          (isIp && (() => {
            const parts = lowerHost.split('.').map(Number);
            // 10.0.0.0/8
            if (parts[0] === 10) return true;
            // 172.16.0.0/12
            if (parts[0] === 172 && parts[1] >= 16 && parts[1] <= 31) return true;
            // 192.168.0.0/16
            if (parts[0] === 192 && parts[1] === 168) return true;
            // link-local 169.254.0.0/16
            if (parts[0] === 169 && parts[1] === 254) return true;
            return false;
          })())
        ) {
          return {
            response: {
              status: 400,
              body: JSON.stringify({ error: 'Invalid Proxy Target', message: 'Proxy target resolves to a disallowed local or private address' }, null, 2),
              headers: [{ key: 'Content-Type', value: 'application/json' }],
              delay: matchedMock.delay,
            },
            matchedMockId: matchedMock.id,
          };
        }
      } catch (err) {
        return {
          response: {
            status: 400,
            body: JSON.stringify({ error: 'Invalid Proxy Target', message: 'Proxy target is not a valid URL' }, null, 2),
            headers: [{ key: 'Content-Type', value: 'application/json' }],
            delay: matchedMock.delay,
          },
          matchedMockId: matchedMock.id,
        };
      }

      const urlObj = new URL(url);
      const proxyUrl = proxyTarget + urlObj.pathname + (urlObj.search || '');

      // Prepare headers for proxy request (pass-through existing headers)
      const proxyHeaders: Record<string, string> = { ...headers };

      // Use AbortController for timeout
      const controller = new AbortController();
      const timeout = typeof matchedMock.proxy.timeout === 'number' ? matchedMock.proxy.timeout : 5000;
      const timeoutId = setTimeout(() => controller.abort(), timeout);

      const fetchResponse = await fetch(proxyUrl, {
        method,
        headers: proxyHeaders,
        body: body || undefined,
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      // Read response body as text
      const proxiedBody = await fetchResponse.text();

      // Convert headers to array
      const finalHeadersArray: { key: string; value: string }[] = [];
      try {
        if (fetchResponse.headers && typeof fetchResponse.headers.forEach === 'function') {
          fetchResponse.headers.forEach((v, k) => finalHeadersArray.push({ key: k, value: String(v) }));
        }
      } catch (e) {
        // ignore header conversion errors
      }

      return {
        response: {
          status: fetchResponse.status || 200,
          body: proxiedBody,
          headers: finalHeadersArray,
          delay: matchedMock.delay,
        },
        matchedMockId: matchedMock.id,
      };
    } catch (err: any) {
      // On failure, either fallback to local mock or return 502
      if (matchedMock.proxy.fallbackToMock) {
        // continue to mock handling
      } else {
        return {
          response: {
            status: 502,
            body: JSON.stringify({ error: 'Bad Gateway', message: String(err.message || err) }, null, 2),
            headers: [{ key: 'Content-Type', value: 'application/json' }],
            delay: matchedMock.delay,
          },
          matchedMockId: matchedMock.id,
        };
      }
    }
  }

  let dynamicBody = "";
  let finalStatus = matchedMock.statusCode;

  // -- STATEFUL LOGIC START --
  if (matchedMock.storeName) {
    const collection = matchedMock.storeName;

    // GET
    if (method === HttpMethod.GET) {
      const paramKeys = Object.keys(urlParams);
      if (paramKeys.length > 0) {
        const id = (urlParams as any)[paramKeys[0]];
        const item = dbService.find(collection, id);
        if (item) {
          dynamicBody = JSON.stringify(item, null, 2);
        } else {
          finalStatus = 404;
          dynamicBody = JSON.stringify({ error: "Item not found" }, null, 2);
        }
      } else {
        const list = dbService.getCollection(collection);
        dynamicBody = JSON.stringify(list, null, 2);
      }
    }
    // POST
    else if (method === HttpMethod.POST) {
      try {
        const payload = body ? JSON.parse(body) : {};
        const newItem = dbService.insert(collection, payload);
        dynamicBody = JSON.stringify(newItem, null, 2);
      } catch (e) {
        finalStatus = 400;
        dynamicBody = JSON.stringify({ error: "Invalid JSON body" }, null, 2);
      }
    }
    // PUT / PATCH
    else if (method === HttpMethod.PUT || method === HttpMethod.PATCH) {
      const paramKeys = Object.keys(urlParams);
      if (paramKeys.length > 0) {
        const id = (urlParams as any)[paramKeys[0]];
        try {
          const payload = body ? JSON.parse(body) : {};
          const updated = dbService.update(collection, id, payload);
          if (updated) {
            dynamicBody = JSON.stringify(updated, null, 2);
          } else {
            finalStatus = 404;
            dynamicBody = JSON.stringify({ error: "Item not found to update" }, null, 2);
          }
        } catch (e) {
          finalStatus = 400;
          dynamicBody = JSON.stringify({ error: "Invalid JSON body" }, null, 2);
        }
      } else {
        finalStatus = 400;
        dynamicBody = JSON.stringify({ error: "Missing ID parameter in URL" }, null, 2);
      }
    }
    // DELETE
    else if (method === HttpMethod.DELETE) {
      const paramKeys = Object.keys(urlParams);
      if (paramKeys.length > 0) {
        const id = (urlParams as any)[paramKeys[0]];
        const deleted = dbService.delete(collection, id);
        if (deleted) {
          finalStatus = 200;
          dynamicBody = JSON.stringify({ success: true, message: "Item deleted" }, null, 2);
        } else {
          finalStatus = 404;
          dynamicBody = JSON.stringify({ error: "Item not found" }, null, 2);
        }
      } else {
        finalStatus = 400;
        dynamicBody = JSON.stringify({ error: "Missing ID parameter in URL" }, null, 2);
      }
    }
  }
  // -- STATELESS LOGIC --
  else {
    // Pass envVars to the processor
    // Use full path with query to enable {{@query.*}} injection
    const requestPathWithQuery = urlObj.pathname + (urlObj.search || '');
    dynamicBody = processMockResponse(matchedMock.responseBody, requestPathWithQuery, matchedMock.path, envVars, body);
  }

  // Merge headers
  const finalHeaders = [
    ...(matchedMock.headers || []),
    { key: 'Content-Type', value: 'application/json' },
    { key: 'X-Powered-By', value: 'BackendStudio' }
  ];

  return {
    response: {
      status: finalStatus,
      body: dynamicBody,
      headers: finalHeaders,
      delay: matchedMock.delay
    },
    matchedMockId: matchedMock.id
  };
}
