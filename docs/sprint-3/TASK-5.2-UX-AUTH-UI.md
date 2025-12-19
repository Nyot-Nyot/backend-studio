# Epic E5 – Task 5.2: UX Authentication in MockEditor

## Overview

Implementation of an intuitive authentication configuration UI in the MockEditor component. Users can now easily configure Bearer Token or API Key authentication for their mock endpoints with clear visual guidance.

## Acceptance Criteria ✅

All acceptance criteria have been met:

- ✅ **Dropdown Auth Type**: Users can select between NONE, BEARER_TOKEN, API_KEY
- ✅ **Token Input**: Field to enter the token/key value that requests must match
- ✅ **Header Key Input**: For API_KEY, users can customize the header name
- ✅ **Explanatory Text**: Brief descriptions and examples of expected headers
- ✅ **Config Persistence**: Auth configuration is saved with the mock endpoint

## Features Implemented

### 1. Authentication Type Dropdown

Located in the "Authentication & Security" section of MockEditor:

- **No Authentication (Public)**: Endpoint is accessible without credentials
- **Bearer Token**: Requires `Authorization: Bearer <token>` header
- **API Key**: Requires custom header with API key value

### 2. Bearer Token Configuration

When BEARER_TOKEN is selected:

- **Token Value Input**: Enter the secret token that clients must provide
- **Live Header Preview**: Shows the exact header format clients need:
  ```
  Authorization: Bearer <your-token-value>
  ```
- **Visual Feedback**: Rose-colored panel with helpful icons

### 3. API Key Configuration

When API_KEY is selected:

- **Header Name Input**: Customize the header name (default: `x-api-key`)
  - Examples: `x-api-key`, `X-API-Token`, `Authorization`, etc.
- **API Key Value Input**: Enter the secret key value
- **Live Header Preview**: Shows the exact header clients need:
  ```
  <header-name>: <api-key-value>
  ```
- **Helpful Guidance**: Explains the purpose of each field

### 4. Public Endpoint Info

When NONE is selected:

- Simple informational message indicating the endpoint is public
- No credentials required

### 5. Enhanced UX Elements

- **Icons**: Shield icon for security section, Key icons for inputs
- **Color Coding**: Rose-themed colors for security settings
- **Animated Transitions**: Smooth fade-in of auth config fields
- **Real-time Preview**: Header examples update as user types
- **Helpful Descriptions**: Contextual explanations at each step

## UI Layout

```
┌─ AUTHENTICATION & SECURITY ─────────────────────┐
│                                                  │
│ Protect your endpoint by requiring              │
│ authentication credentials...                   │
│                                                  │
│ Authentication Type: [DROPDOWN ▼]              │
│                                                  │
│ ┌─ When BEARER_TOKEN selected ───────────────┐ │
│ │ Bearer Token Value: [input field]          │ │
│ │                                             │ │
│ │ 📋 Expected Header:                        │ │
│ │ Authorization: Bearer my-secret-token      │ │
│ └─────────────────────────────────────────────┘ │
│                                                  │
│ ┌─ When API_KEY selected ────────────────────┐ │
│ │ Header Name: [input field]                 │ │
│ │ API Key Value: [input field]               │ │
│ │                                             │ │
│ │ 📋 Expected Header:                        │ │
│ │ x-api-key: sk-api-1234567890abcdef        │ │
│ └─────────────────────────────────────────────┘ │
│                                                  │
│ ┌─ When NONE selected ──────────────────────┐  │
│ │ 🌐 This endpoint is public and accessible  │  │
│ │    without authentication.                 │  │
│ └──────────────────────────────────────────── ┘ │
│                                                  │
└──────────────────────────────────────────────────┘
```

## Code Changes

### Modified File: `components/MockEditor.tsx`

**Location**: Lines 1035-1135 (Auth Configuration Section)

**Key Changes**:

1. Enhanced section title with "Authentication & Security"
2. Added introductory explanation text
3. Improved dropdown with emoji indicators and clearer labels
4. Separated BEARER_TOKEN and API_KEY configuration into distinct sections
5. Added rose-colored background to active auth sections
6. Implemented live header preview with code-style formatting
7. Added helpful descriptions for each field
8. Included public endpoint information when NONE is selected

**Example Bearer Token UI**:

```tsx
{
  formData.authConfig?.type === "BEARER_TOKEN" && (
    <div className="space-y-4 p-4 bg-rose-50 border border-rose-200 rounded-lg animate-in fade-in slide-in-from-top-2">
      <div>
        <Label>Bearer Token Value</Label>
        <div className="relative">
          <Key className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            type="text"
            value={formData.authConfig?.token || ""}
            onChange={(e) =>
              setFormData((prev) => ({
                ...prev,
                authConfig: { ...prev.authConfig!, token: e.target.value },
              }))
            }
            className="w-full bg-white border border-slate-200 rounded-lg pl-9 pr-4 py-2.5 text-sm font-mono focus:border-rose-500 focus:ring-1 focus:ring-rose-500 outline-none"
            placeholder="my-secret-token-12345"
          />
        </div>
        <p className="text-[11px] text-slate-600 mt-2 ml-1 space-y-1">
          <div>
            📋 <strong>Expected Header:</strong>
          </div>
          <div className="font-mono bg-slate-900 text-emerald-400 px-3 py-2 rounded-md overflow-x-auto text-[10px] mt-1">
            Authorization: Bearer{" "}
            {formData.authConfig?.token || "my-secret-token-12345"}
          </div>
        </p>
      </div>
    </div>
  );
}
```

## User Workflow

### Setting Up Bearer Token Authentication:

1. User selects "Bearer Token (Authorization Header)" from dropdown
2. Rose-colored panel appears with token input field
3. User enters token value (e.g., "my-secret-token-12345")
4. Real-time preview shows: `Authorization: Bearer my-secret-token-12345`
5. User saves endpoint
6. Requests without this header or with invalid token receive 401 Unauthorized

### Setting Up API Key Authentication:

1. User selects "API Key (Custom Header)" from dropdown
2. Rose-colored panel appears with two input fields
3. User customizes header name (default: "x-api-key")
4. User enters API key value (e.g., "sk-api-1234567890")
5. Real-time preview shows: `x-api-key: sk-api-1234567890`
6. User saves endpoint
7. Requests without this header or with invalid key receive 401 Unauthorized

### Setting Up Public Endpoint:

1. User selects "No Authentication (Public)" from dropdown
2. Informational message confirms endpoint is public
3. No additional fields needed
4. User saves endpoint
5. All requests are accepted regardless of headers

## Integration Points

### MockEditor Component

- **Form State**: Auth config stored in `formData.authConfig`
- **State Update**: `setFormData()` updates auth configuration
- **Persistence**: Auth config saved when endpoint is saved
- **Validation**: No validation needed (optional authentication)

### Types

Authentication config type is defined in `types.ts`:

```typescript
authConfig: {
  type: 'NONE' | 'BEARER_TOKEN' | 'API_KEY',
  token?: string,           // Token/key value
  headerKey?: string        // (API_KEY only) custom header name
}
```

## Testing

The authentication logic is thoroughly tested in:

- [test/authSimulation.test.ts](../test/authSimulation.test.ts)
  - 20 comprehensive test cases
  - All authentication scenarios covered
  - Validates request/response flows

## Accessibility & UX Features

✅ **Visual Hierarchy**: Clear section organization with icons
✅ **Color Coding**: Rose theme for security settings  
✅ **Helpful Text**: Explanations and examples for each field
✅ **Live Preview**: Header format updates as user types
✅ **Smooth Transitions**: Animated reveal of auth sections
✅ **Clear Labels**: Bold, uppercase labels with proper spacing
✅ **Placeholder Text**: Examples to guide user input
✅ **Responsive Design**: Works on all screen sizes

## Status

**Task Status: COMPLETE** ✅

- ✅ Authentication UI implemented in MockEditor
- ✅ All three auth types supported (NONE, BEARER_TOKEN, API_KEY)
- ✅ Live header preview with examples
- ✅ Helpful guidance text
- ✅ Smooth animations and transitions
- ✅ Config persistence with endpoint
- ✅ Tested with auth simulation tests

## Next Steps

- Integrate with frontend request builder
- Add visual indicators to endpoints list (lock icon for secured endpoints)
- Implement auth preset templates (JWT, OAuth, Basic Auth)
- Add copy-to-clipboard button for header examples
- Support multiple auth types per endpoint (if needed)
