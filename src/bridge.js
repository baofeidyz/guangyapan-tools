globalThis.GTR = globalThis.GTR || {};

(() => {
  const API_HOST = 'api.guangyapan.com';
  const SAFE_HEADERS = new Set(['accept', 'authorization', 'content-type', 'did', 'dt', 'x-device-id', 'x-requested-with']);

  function parseBody(body) {
    if (!body) return null;
    if (typeof body === 'string') {
      try { return JSON.parse(body); } catch { return null; }
    }
    if (typeof body === 'object' && !(body instanceof ArrayBuffer)) return body;
    return null;
  }

  function sanitizeObservedHeaders(headersLike) {
    const output = {};
    if (!headersLike) return output;
    try {
      const headers = new Headers(headersLike);
      headers.forEach((value, key) => { if (SAFE_HEADERS.has(key.toLowerCase())) output[key.toLowerCase()] = value; });
    } catch {
      for (const [key, value] of Object.entries(headersLike || {})) if (SAFE_HEADERS.has(key.toLowerCase())) output[key.toLowerCase()] = String(value);
    }
    return output;
  }

  function classifyRequest(url) {
    const value = String(url || '');
    if (!value.includes(API_HOST)) return null;
    if (value.includes('/file/get_file_list')) return 'list';
    if (value.includes('/file/get_file_detail')) return 'detail';
    if (value.includes('/file/rename')) return 'rename';
    return null;
  }

  function createCapture(url, method, headers, body) {
    const kind = classifyRequest(url);
    if (!kind) return null;
    return { kind, url: String(url), method: String(method || 'GET').toUpperCase(), headers: sanitizeObservedHeaders(headers), body: parseBody(body), capturedAt: Date.now() };
  }

  function installGuangyaRequestObserver(pageWindow, onCapture) {
    if (!pageWindow || typeof onCapture !== 'function') return () => {};
    const restores = [];
    if (typeof pageWindow.fetch === 'function') {
      const originalFetch = pageWindow.fetch;
      pageWindow.fetch = function observedFetch(input, init = {}) {
        const url = typeof input === 'string' ? input : input?.url;
        const capture = createCapture(url, init.method || input?.method, init.headers || input?.headers, init.body);
        if (capture) onCapture(capture);
        return originalFetch.apply(this, arguments);
      };
      restores.push(() => { pageWindow.fetch = originalFetch; });
    }
    const proto = pageWindow.XMLHttpRequest?.prototype;
    if (proto) {
      const originalOpen = proto.open;
      const originalSend = proto.send;
      const originalSetHeader = proto.setRequestHeader;
      proto.open = function observedOpen(method, url) {
        this.__gtrRequest = { method, url, headers: {} };
        return originalOpen.apply(this, arguments);
      };
      proto.setRequestHeader = function observedSetHeader(key, value) {
        if (this.__gtrRequest) this.__gtrRequest.headers[key] = value;
        return originalSetHeader.apply(this, arguments);
      };
      proto.send = function observedSend(body) {
        if (this.__gtrRequest) {
          const capture = createCapture(this.__gtrRequest.url, this.__gtrRequest.method, this.__gtrRequest.headers, body);
          if (capture) onCapture(capture);
        }
        return originalSend.apply(this, arguments);
      };
      restores.push(() => { proto.open = originalOpen; proto.send = originalSend; proto.setRequestHeader = originalSetHeader; });
    }
    return () => restores.reverse().forEach((restore) => restore());
  }

  Object.assign(globalThis.GTR, { API_HOST, SAFE_HEADERS, parseBody, sanitizeObservedHeaders, classifyRequest, createCapture, installGuangyaRequestObserver });
})();
