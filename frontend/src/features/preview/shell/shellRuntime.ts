export const PREVIEW_SHELL_RUNTIME = `    <script>
      (function () {
        var s = document.documentElement.style;
        var n = function (v) { return typeof v === 'number' && isFinite(v) && v > 0; };
        var clamp = function (v, min, max) { return Math.max(min, Math.min(max, v)); };
        var state = { fitScale: 1, zoom: 1, width: 0, height: 0, panX: 0, panY: 0 };
        var bootId = Math.random().toString(36).slice(2);
        var readySent = false;
        var root = null;
        var styleTag = null;
        var drag = { active: false, startX: 0, startY: 0, panX: 0, panY: 0 };
        var getRoot = function () {
          if (!root) root = document.getElementById('preview-scale-root');
          return root;
        };
        var getStyleTag = function () {
          if (!styleTag) styleTag = document.getElementById('preview-user-style');
          return styleTag;
        };
        var applyPreviewContent = function (payload) {
          var nextRoot = getRoot();
          var nextStyleTag = getStyleTag();
          if (!nextRoot || !nextStyleTag) return;
          var innerHtml = payload && payload.html || '';
          var resetCss = payload && payload.resetCss || '';
          var styleCss = payload && payload.styleCss || '';
          nextRoot.innerHTML = innerHtml;
          nextStyleTag.textContent = resetCss + '\\n' + styleCss;
        };
        var notifyReady = function () {
          if (readySent) return;
          readySent = true;
          try {
            window.parent && window.parent.postMessage && window.parent.postMessage({ type: 'preview:ready', payload: { bootId: bootId } }, '*');
          } catch (e) {}
        };
        function notifyViewport() {
          try {
            var zoomPercent = Math.round(state.zoom * 100);
            window.parent && window.parent.postMessage && window.parent.postMessage({ type: 'preview:viewport', payload: { bootId: bootId, zoomPercent: zoomPercent } }, '*');
          } catch (e) {}
        }
        function layout() {
          var scale = state.fitScale * state.zoom;
          var width = state.width;
          var height = state.height;
          if (!n(scale) || !n(width) || !n(height)) return;
          var scaledW = width * scale;
          var scaledH = height * scale;
          var baseOffsetX = (window.innerWidth - scaledW) / 2;
          var baseOffsetY = (window.innerHeight - scaledH) / 2;
          var offsetX = baseOffsetX + state.panX;
          var offsetY = baseOffsetY + state.panY;
          s.setProperty('--preview-scale', String(scale));
          s.setProperty('--preview-width', width + 'px');
          s.setProperty('--preview-height', height + 'px');
          s.setProperty('--preview-offset-x', offsetX + 'px');
          s.setProperty('--preview-offset-y', offsetY + 'px');
          s.setProperty('--preview-ready-opacity', '1');
          try {
            window.parent && window.parent.postMessage && window.parent.postMessage({ type: 'preview:layout:applied', payload: { bootId: bootId } }, '*');
          } catch (e) {}
          notifyViewport();
        }
        function zoomBy(factor) {
          state.zoom = clamp(state.zoom * factor, 0.1, 8);
          layout();
        }
        function resetViewport() {
          state.zoom = 1;
          state.panX = 0;
          state.panY = 0;
          layout();
        }
        function fitViewport() {
          state.zoom = 1;
          state.panX = 0;
          state.panY = 0;
          layout();
        }
        function handleCommand(command) {
          if (command === 'zoom-in') {
            zoomBy(1.1);
            return;
          }
          if (command === 'zoom-out') {
            zoomBy(1 / 1.1);
            return;
          }
          if (command === 'fit') {
            fitViewport();
            return;
          }
          if (command === 'reset') {
            resetViewport();
          }
        }
        window.addEventListener('message', function (e) {
          var d = e && e.data;
          if (!d || typeof d !== 'object') return;
          if (d.type === 'preview:update') {
            var previewPayload = d.payload || {};
            if (typeof previewPayload.bootId === 'string' && previewPayload.bootId !== bootId) return;
            applyPreviewContent(previewPayload);
            return;
          }
          if (d.type === 'preview:command') {
            var cp = d.payload || {};
            if (typeof cp.bootId === 'string' && cp.bootId !== bootId) return;
            handleCommand(cp.command);
            return;
          }
          if (d.type !== 'preview:layout') return;
          var p = d.payload || d;
          var scale = p.scale, width = p.width, height = p.height, bid = p.bootId;
          if (typeof bid === 'string' && bid !== bootId) return;
          if (n(scale)) state.fitScale = scale;
          if (n(width)) state.width = width;
          if (n(height)) state.height = height;
          layout();
        });
        window.addEventListener('wheel', function (event) {
          if (!event) return;
          if (!(event.ctrlKey || event.metaKey)) return;
          if (event.cancelable) event.preventDefault();
          var dy = typeof event.deltaY === 'number' ? event.deltaY : 0;
          zoomBy(dy < 0 ? 1.08 : 1 / 1.08);
        }, { passive: false });
        window.addEventListener('pointerdown', function (event) {
          if (!event) return;
          if (!(event.button === 1 || event.shiftKey)) return;
          drag.active = true;
          drag.startX = event.clientX;
          drag.startY = event.clientY;
          drag.panX = state.panX;
          drag.panY = state.panY;
          try { event.preventDefault(); } catch (e) {}
        });
        window.addEventListener('pointermove', function (event) {
          if (!drag.active || !event) return;
          state.panX = drag.panX + (event.clientX - drag.startX);
          state.panY = drag.panY + (event.clientY - drag.startY);
          layout();
        });
        window.addEventListener('pointerup', function () { drag.active = false; });
        window.addEventListener('pointercancel', function () { drag.active = false; });
        if (document.readyState === 'complete' || document.readyState === 'interactive') {
          notifyReady();
        } else {
          document.addEventListener('DOMContentLoaded', notifyReady);
        }
        window.addEventListener('load', notifyReady);
        window.addEventListener('resize', function () { layout(); });
      })();
    </script>
`
