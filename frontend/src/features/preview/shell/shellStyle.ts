export const PREVIEW_SHELL_STYLE = `    <style>
      html, body {
        width: 100%;
        height: 100%;
        margin: 0;
        padding: 0;
        background: rgb(12, 14, 23) !important;
      }
      #preview-container {
        position: relative;
        overflow: hidden;
        width: 100%;
        height: 100%;
        background-color: #0c0e17 !important;
        background-image:
          radial-gradient(circle, rgba(148, 163, 184, 0.12) 0.9px, transparent 1.2px),
          radial-gradient(circle, rgba(148, 163, 184, 0.07) 0.9px, transparent 1.2px),
          linear-gradient(
            180deg,
            rgba(255, 255, 255, 0.022) 0%,
            rgba(255, 255, 255, 0.016) 45%,
            rgba(255, 255, 255, 0.02) 100%
          ),
          linear-gradient(90deg, rgba(56, 189, 248, 0.02) 0%, rgba(56, 189, 248, 0.008) 100%);
        background-size: 12px 12px, 60px 60px, 100% 100%, 100% 100%;
        background-position: 0 0, 0 0, 0 0, 0 0;
        filter: saturate(0.9) blur(0.18px);
      }
      #preview-scale-root {
        width: var(--preview-width, 0px);
        height: var(--preview-height, 0px);
        position: absolute;
        left: 0;
        top: 0;
        opacity: var(--preview-ready-opacity, 0);
        transition: opacity 120ms ease;
        background-color: #ffffff;
        box-shadow: 0 22px 48px rgba(0, 0, 0, 0.5), 0 3px 10px rgba(0, 0, 0, 0.35);
        outline: 1px solid rgba(148, 163, 184, 0.2);
        transform: translate(var(--preview-offset-x, 0px), var(--preview-offset-y, 0px)) scale(var(--preview-scale, 1));
        transform-origin: top left;
        will-change: transform;
      }
    </style>
`
