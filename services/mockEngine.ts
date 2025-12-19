
import { EnvironmentVariable, HttpMethod, MockEndpoint } from "../types";
import { dbService } from "./dbService";
import { 
  EmailSendRequest, 
  EmailSendResponse, 
  EmailStatusResponse, 
  EmailMessage, 
  generateSMTPTrace, 
  validateEmail,
  scheduleStatusUpdate 
} from './emailService';
import { STORAGE_KEYS } from '../constants';

// Helper: Match Route Pattern
export const matchRoute = (pattern: string, requestPath: string): { matches: boolean, params: any } => {
  // Normalize paths (remove trailing slash, ensure leading slash)
  const cleanReqPath = requestPath.split('?')[0].replace(/\/+$/, '');
  const cleanPattern = pattern.replace(/\/+$/, '');

  const patternSegments = cleanPattern.split('/').filter(Boolean);
  const pathSegments = cleanReqPath.split('/').filter(Boolean);
  const params: any = {};

  if (patternSegments.length !== pathSegments.length) return { matches: false, params: {} };

  const matches = patternSegments.every((seg, i) => {
    if (seg.startsWith(':')) {
      params[seg.substring(1)] = pathSegments[i];
      return true;
    }
    return seg === pathSegments[i];
  });

  return { matches, params };
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
  let parsedBody: any = null;
  if (requestBody) {
    try {
      parsedBody = JSON.parse(requestBody);
    } catch (e) {
      parsedBody = null;
    }
  }

  // Debug helper: if parsedBody is null but requestBody exists, log a warning so we can see malformed JSON (dev only)
  if (requestBody && parsedBody === null) {
    try {
      if (import.meta.env?.DEV) {
        console.warn('mockEngine: failed to parse requestBody as JSON', requestBody.slice(0, 200));
      }
    } catch (e) { }
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
    const walk = (obj: any, prefix = '') => {
      Object.keys(obj).forEach(k => {
        const val = obj[k];
        const placeholder = `{{@body${prefix}.${k}}}`;
        const regex = new RegExp(placeholder.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g');
        const replacement = (val === undefined || val === null) ? '' : String(val);
        processedBody = processedBody.replace(regex, replacement);

        if (typeof val === 'object' && val !== null) {
          walk(val, `${prefix}.${k}`);
        }
      });
    };
    walk(parsedBody, '');
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
    '{{$randomEmail}}': () => {
      const domains = ['example.com', 'test.io', 'demo.net', 'acme.org'];
      const user = Math.random().toString(36).substring(7);
      const domain = domains[Math.floor(Math.random() * domains.length)];
      return `${user}@${domain}`;
    },
    '{{$randomCity}}': () => {
      const cities = ['New York', 'London', 'Tokyo', 'Jakarta', 'Berlin', 'Paris', 'Sydney'];
      return cities[Math.floor(Math.random() * cities.length)];
    },
    '{{$randomBool}}': () => Math.random() > 0.5 ? 'true' : 'false',

    // Faker-like aliases (no external dep): map to existing generators
    '{{$fakerName}}': () => replacements['{{$randomName}}'](),
    '{{$fakerEmail}}': () => replacements['{{$randomEmail}}'](),
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
  { label: '{{$randomEmail}}', desc: 'Random email address' },
  { label: '{{$randomCity}}', desc: 'Random city' },
  { label: '{{$isoDate}}', desc: 'Current ISO 8601 Date' },
  { label: '{{$fakerName}}', desc: 'Faker-like alias for random name' },
  { label: '{{$fakerEmail}}', desc: 'Faker-like alias for random email' },
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
export const simulateRequest = (
  method: string,
  url: string,
  headers: Record<string, string>, // Headers passed from SW
  body: string,
  mocks: MockEndpoint[],
  envVars: EnvironmentVariable[] = [] // NEW: Env Vars
): SimulationResult => {
  const urlObj = new URL(url);
  const pathname = urlObj.pathname;

  // Handle built-in email endpoints
  if (pathname.startsWith('/api/email/')) {
    if (import.meta.env?.DEV) {
      console.log('Email endpoint detected:', method, pathname);
    }
    return handleEmailEndpoint(method, pathname, urlObj, headers, body);
  }

  let matchedMock: MockEndpoint | null = null;
  let urlParams: any = {};

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

// Email endpoints handler
function handleEmailEndpoint(
  method: string,
  pathname: string,
  urlObj: URL,
  headers: Record<string, string>,
  body: string | undefined
): SimulationResult {
  if (import.meta.env?.DEV) {
    console.log('handleEmailEndpoint called:', { method, pathname, body });
  }
  
  const OUTBOX_KEY = STORAGE_KEYS.EMAIL_OUTBOX;
  const INBOX_KEY = STORAGE_KEYS.EMAIL_INBOX;

  // POST /api/email/send
  if (method === 'POST' && pathname === '/api/email/send') {
    let requestData: EmailSendRequest;
    try {
      requestData = JSON.parse(body || '{}');
    } catch (e) {
      return {
        response: {
          status: 400,
          headers: [
            { key: 'Content-Type', value: 'application/json' },
            { key: 'X-Powered-By', value: 'BackendStudio' }
          ],
          body: JSON.stringify({ error: 'Invalid JSON body' }),
          delay: 0
        }
      };
    }

    // Validate required fields
    if (!requestData.to || !requestData.subject || !requestData.body) {
      return {
        response: {
          status: 400,
          headers: [
            { key: 'Content-Type', value: 'application/json' },
            { key: 'X-Powered-By', value: 'BackendStudio' }
          ],
          body: JSON.stringify({ error: 'Missing required fields: to, subject, body' }),
          delay: 0
        }
      };
    }

    // Validate email format
    if (!validateEmail(requestData.to)) {
      return {
        response: {
          status: 400,
          headers: [
            { key: 'Content-Type', value: 'application/json' },
            { key: 'X-Powered-By', value: 'BackendStudio' }
          ],
          body: JSON.stringify({ error: 'Invalid email address' }),
          delay: 0
        }
      };
    }

    const messageId = crypto.randomUUID();
    const now = Date.now();
    const trace = generateSMTPTrace(requestData.to);

    const message: EmailMessage = {
      id: messageId,
      to: requestData.to,
      subject: requestData.subject,
      body: requestData.body,
      status: 'queued',
      trace,
      createdAt: now,
      updatedAt: now
    };

    // Store in outbox
    const outbox = JSON.parse(localStorage.getItem(OUTBOX_KEY) || '[]');
    outbox.push(message);
    localStorage.setItem(OUTBOX_KEY, JSON.stringify(outbox));

    // Schedule status updates
    scheduleStatusUpdate(messageId, (id, status) => {
      if (import.meta.env?.DEV) {
        console.log('Status update callback called:', id, status);
      }
      
      const currentOutbox = JSON.parse(localStorage.getItem(OUTBOX_KEY) || '[]');
      const msgIndex = currentOutbox.findIndex((m: EmailMessage) => m.id === id);
      
      if (import.meta.env?.DEV) {
        console.log('Found message at index:', msgIndex, 'of', currentOutbox.length);
      }
      
      if (msgIndex !== -1) {
        currentOutbox[msgIndex].status = status;
        currentOutbox[msgIndex].updatedAt = Date.now();
        localStorage.setItem(OUTBOX_KEY, JSON.stringify(currentOutbox));
        
        if (import.meta.env?.DEV) {
          console.log('Status updated in localStorage, dispatching event');
        }
        
        // Notify via custom event (for real-time updates later)
        if (typeof window !== 'undefined') {
          window.dispatchEvent(new CustomEvent('emailStatusUpdate', { 
            detail: { messageId: id, status, updatedAt: Date.now() } 
          }));
        }
      } else {
        if (import.meta.env?.DEV) {
          console.warn('Message not found for status update:', id);
        }
      }
    });

    const response: EmailSendResponse = {
      messageId,
      status: 'queued',
      trace
    };

    return {
      response: {
        status: 200,
        headers: [
          { key: 'Content-Type', value: 'application/json' },
          { key: 'X-Powered-By', value: 'BackendStudio' }
        ],
        body: JSON.stringify(response),
        delay: 50
      }
    };
  }

  // GET /api/email/status/:id
  if (method === 'GET' && pathname.startsWith('/api/email/status/')) {
    const messageId = pathname.split('/').pop();
    if (!messageId) {
      return {
        response: {
          status: 400,
          headers: [
            { key: 'Content-Type', value: 'application/json' },
            { key: 'X-Powered-By', value: 'BackendStudio' }
          ],
          body: JSON.stringify({ error: 'Missing message ID' }),
          delay: 0
        }
      };
    }

    const outbox = JSON.parse(localStorage.getItem(OUTBOX_KEY) || '[]');
    const message = outbox.find((m: EmailMessage) => m.id === messageId);

    if (!message) {
      return {
        response: {
          status: 404,
          headers: [
            { key: 'Content-Type', value: 'application/json' },
            { key: 'X-Powered-By', value: 'BackendStudio' }
          ],
          body: JSON.stringify({ error: 'Message not found' }),
          delay: 0
        }
      };
    }

    const response: EmailStatusResponse = {
      messageId: message.id,
      status: message.status,
      updatedAt: message.updatedAt,
      trace: message.trace
    };

    return {
      response: {
        status: 200,
        headers: [
          { key: 'Content-Type', value: 'application/json' },
          { key: 'X-Powered-By', value: 'BackendStudio' }
        ],
        body: JSON.stringify(response),
        delay: 10
      }
    };
  }

  // GET /api/email/inbox
  if (method === 'GET' && pathname === '/api/email/inbox') {
    const inbox = JSON.parse(localStorage.getItem(INBOX_KEY) || '[]');
    return {
      response: {
        status: 200,
        headers: [
          { key: 'Content-Type', value: 'application/json' },
          { key: 'X-Powered-By', value: 'BackendStudio' }
        ],
        body: JSON.stringify({ messages: inbox }),
        delay: 20
      }
    };
  }

  // Unknown email endpoint
  return {
    response: {
      status: 404,
      headers: [
        { key: 'Content-Type', value: 'application/json' },
        { key: 'X-Powered-By', value: 'BackendStudio' }
      ],
      body: JSON.stringify({ error: 'Email endpoint not found' }),
      delay: 0
    }
  };
}
