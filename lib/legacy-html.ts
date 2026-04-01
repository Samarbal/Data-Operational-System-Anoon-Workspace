import fs from "node:fs";
import path from "node:path";

const LEGACY_DIR = path.join(process.cwd(), "v3 - Operational data system");

const BRIDGE_SCRIPT = `<script id="space-noon-bridge">
(function () {
  if (window.google && window.google.script && window.google.script.run) return;

  var __spaceNoonCache = {
    store: {},
    inflight: {},
    ttlMs: 15000
  };

  function cacheKey(url, body) {
    try { return url + '|' + JSON.stringify(body || {}); } catch (e) { return url; }
  }

  function isReadHeavy(url, body) {
    if (!url) return false;
    if (url.indexOf('/api/') !== 0) return false;
    var action = url.slice('/api/'.length);
    // mirror READ_HEAVY_ACTIONS on the server side
    var heavy = {
      getInitialData: true,
      getDashboard: true,
      getHallBookings: true,
      getFutureBookings: true,
      getFutureHallBookings: true,
      getVisitors: true,
      getSubs: true,
      getTamkeen: true,
      getArchive: true,
      getBootData: true,
      getSecondaryData: true
    };
    return !!heavy[action];
  }

  function parseResponse(response) {
    var ct = response.headers.get('content-type') || '';
    if (ct.indexOf('application/json') !== -1) return response.json();
    return response.text();
  }

  function mapMethod(method, args) {
    if (method === 'processRequest') {
      var action = encodeURIComponent(args[0] || '');
      return { url: '/api/' + action, body: args[1] || {} };
    }
    if (method === 'socialProcessRequest') {
      return { url: '/api/social', body: { action: args[0], data: args[1] || {} } };
    }
    if (method === 'loginByName' || method === 'simpleLogin') {
      return { url: '/api/auth/login', body: { name: args[0] || '' } };
    }
    if (method === 'logoutUser') {
      return { url: '/api/auth/logout', body: {} };
    }
    if (method === 'getAdminPage') {
      return { url: '/api/auth/getAdminPage', body: {} };
    }
    if (method === 'getSocialPage') {
      return { url: '/api/auth/getSocialPage', body: {} };
    }
    return { url: '/api/' + encodeURIComponent(method), body: args[0] || {} };
  }

  function makeRunner(successHandler, failureHandler) {
    var runner = {};

    runner.withSuccessHandler = function (fn) {
      return makeRunner(fn, failureHandler);
    };

    runner.withFailureHandler = function (fn) {
      return makeRunner(successHandler, fn);
    };

    function invoke(method, args) {
      var mapped = mapMethod(method, args);
      var body = mapped.body || {};
      var useCache = isReadHeavy(mapped.url, body);
      var key = useCache ? cacheKey(mapped.url, body) : null;

      if (useCache && key) {
        var now = Date.now();
        var hit = __spaceNoonCache.store[key];
        if (hit && (now - hit.ts) < __spaceNoonCache.ttlMs) {
          Promise.resolve(hit.payload).then(function (payload) {
            if (typeof successHandler === 'function') successHandler(payload);
          });
          return;
        }
        if (__spaceNoonCache.inflight[key]) {
          __spaceNoonCache.inflight[key].then(function (payload) {
            if (typeof successHandler === 'function') successHandler(payload);
          })['catch'](function (error) {
            if (typeof failureHandler === 'function') {
              failureHandler({ message: error && error.message ? error.message : String(error) });
            }
          });
          return;
        }
      }

      var p = fetch(mapped.url, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      })
        .then(function (response) {
          return parseResponse(response).then(function (payload) {
            if (!response.ok) {
              var msg = (payload && payload.error) ? payload.error : ('HTTP ' + response.status);
              throw new Error(msg);
            }
            return payload;
          });
        })
        .then(function (payload) {
          if (useCache && key) {
            __spaceNoonCache.store[key] = { ts: Date.now(), payload: payload };
          }
          if (typeof successHandler === 'function') successHandler(payload);
          return payload;
        })
        .catch(function (error) {
          if (typeof failureHandler === 'function') {
            failureHandler({ message: error && error.message ? error.message : String(error) });
          } else {
            console.error(error);
          }
          throw error;
        });

      if (useCache && key) {
        __spaceNoonCache.inflight[key] = p;
        p['finally'](function () { delete __spaceNoonCache.inflight[key]; });
      }
    }

    var methods = [
      'processRequest',
      'socialProcessRequest',
      'loginByName',
      'simpleLogin',
      'logoutUser',
      'getAdminPage',
      'getSocialPage',
      'getAvailabilityData',
      'getInitialData',
      'getDashboard',
      'getHallBookings',
      'getBootData',
      'getSecondaryData'
    ];

    methods.forEach(function (method) {
      runner[method] = function () {
        invoke(method, Array.prototype.slice.call(arguments));
        return runner;
      };
    });

    return new Proxy(runner, {
      get: function (target, prop) {
        if (prop in target) return target[prop];
        if (typeof prop !== 'string') return undefined;
        return function () {
          invoke(prop, Array.prototype.slice.call(arguments));
          return runner;
        };
      }
    });
  }

  window.google = window.google || {};
  window.google.script = window.google.script || {};
  window.google.script.run = makeRunner(null, null);
})();
</script>`;

const SOCIAL_VISITORS_SCRIPT = `<script id="space-noon-social-visitors">
(function () {
  function installSocialVisitorsCard() {
    if (document.getElementById('social-visitors-tbody')) return;
    if (!document.getElementById('halls-tbody')) return;

    var socialRoot = document.getElementById('page-social') || document.querySelector('.container');
    if (!socialRoot) return;

    var hallCard = document.getElementById('halls-tbody');
    if (!hallCard) return;
    var targetCard = hallCard.closest('.card');
    if (!targetCard || !targetCard.parentNode) return;

    var card = document.createElement('div');
    card.className = 'card';
    card.innerHTML = ''
      + '<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:.75rem;">'
      + '  <div class="sec-title" style="margin:0;border:none;padding:0;">🪑 حضور الاستقبال (اليوم)</div>'
      + '</div>'
      + '<div class="table-wrap">'
      + '  <table>'
      + '    <thead><tr><th>الاسم</th><th>الهاتف</th><th>الاشتراك</th><th>وقت الدخول</th><th>الحالة</th></tr></thead>'
      + '    <tbody id="social-visitors-tbody"><tr><td colspan="5" style="text-align:center;color:#64748b;padding:.85rem;">جاري التحميل...</td></tr></tbody>'
      + '  </table>'
      + '</div>';

    targetCard.parentNode.insertBefore(card, targetCard.nextSibling);

    function esc(v) {
      return String(v || '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
    }

    function renderRows(rows) {
      var tb = document.getElementById('social-visitors-tbody');
      if (!tb) return;
      if (!rows || !rows.length) {
        tb.innerHTML = '<tr><td colspan="5" style="text-align:center;color:#64748b;padding:.85rem;">لا يوجد حضور اليوم</td></tr>';
        return;
      }

      tb.innerHTML = rows.map(function (v) {
        var isOut = !!(v && v.exitTime);
        var status = isOut ? '<span style="color:#64748b;font-weight:700;">تم الخروج</span>' : '<span style="color:#16a34a;font-weight:700;">داخل الآن</span>';
        return '<tr>'
          + '<td>' + esc(v.name) + '</td>'
          + '<td>' + esc(v.phone) + '</td>'
          + '<td>' + esc(v.subType) + '</td>'
          + '<td>' + esc(v.entryTime) + '</td>'
          + '<td>' + status + '</td>'
          + '</tr>';
      }).join('');
    }

    function loadVisitors() {
      if (!window.google || !window.google.script || !window.google.script.run) return;
      window.google.script.run
        .withSuccessHandler(function (rows) {
          renderRows(rows);
        })
        .withFailureHandler(function () {})
        .processRequest('getVisitors', { filter: 'today' });
    }

    window.__spaceNoonLoadSocialVisitors = loadVisitors;
    loadVisitors();
    setInterval(loadVisitors, 15000);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', installSocialVisitorsCard);
  } else {
    installSocialVisitorsCard();
  }
})();
</script>`;

const WARMUP_SCRIPT = `<script id="space-noon-warmup">
(function () {
  try {
    if (!window.fetch) return;
    setTimeout(function () {
      fetch('/api/warmup', { method: 'POST', credentials: 'include' })['catch'](function () {});
    }, 0);
  } catch (e) {}
})();
</script>`;

function readLegacyFile(name: string): string {
  return fs.readFileSync(path.join(LEGACY_DIR, name), "utf8");
}

function injectBridge(html: string, addSocialVisitorsCard = false, addWarmup = false): string {
  if (html.includes("space-noon-bridge")) return html;
  const bundleParts = [BRIDGE_SCRIPT];
  if (addSocialVisitorsCard) bundleParts.push(SOCIAL_VISITORS_SCRIPT);
  if (addWarmup) bundleParts.push(WARMUP_SCRIPT);
  const bundle = bundleParts.join("\n");
  if (html.includes("</head>")) {
    return html.replace("</head>", `${bundle}\n</head>`);
  }
  return `${bundle}\n${html}`;
}

function renderIndexHtml(): string {
  const index = readLegacyFile("Index.html.txt");
  const styles = readLegacyFile("Styles.html.txt");
  const script = readLegacyFile("Script.html.txt");

  const withIncludes = index
    .replace(/<\?!=\s*include\(\s*['"]Styles['"]\s*\)\s*\?>/g, styles)
    .replace(/<\?!=\s*include\(\s*['"]Script['"]\s*\)\s*\?>/g, script);

  return injectBridge(withIncludes);
}

function renderLoginHtml(): string {
  // PERF: keep login page light; social visitors polling script is only needed on social page.
  return injectBridge(readLegacyFile("Login.html.txt"), false, true);
}

function renderSocialHtml(): string {
  return injectBridge(readLegacyFile("Social.html.txt"), true);
}

let cachedAdmin: string | null = null;
let cachedLogin: string | null = null;
let cachedSocial: string | null = null;

export function getAdminHtml(): string {
  cachedAdmin ??= renderIndexHtml();
  return cachedAdmin;
}

export function getLoginHtml(): string {
  cachedLogin ??= renderLoginHtml();
  return cachedLogin;
}

export function getSocialHtml(): string {
  cachedSocial ??= renderSocialHtml();
  return cachedSocial;
}
